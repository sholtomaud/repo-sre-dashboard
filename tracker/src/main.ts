/**
 * The Action's data step: reads the repository through the GitHub API and
 * writes the dashboard's data files.
 *
 *   data.csv          daily running totals of the repository's issues
 *   agent_queue.csv   daily counts of a file-based queue, when configured
 *   pulls.csv         daily running totals of pull requests, by origin
 *   status.json       last update, schedule, issue and pull request
 *                     breakdowns, the repository's profile, CI and delivery
 *                     metrics, and the best-practice audit. Its shape is
 *                     tracker/schema/status-v<STATUS_SCHEMA_VERSION>.json,
 *                     published beside the dashboard for other readers
 *   config.json       what the dashboard shows: repository, title, queue
 *
 * Inputs come from environment variables set by action.yml.
 */
import { costInputs } from './cost.ts';
import fs from 'node:fs';
import path from 'node:path';
import { writeCsv } from './csv.ts';
import { createClient, type GitHubClient } from './github.ts';
import {
  CSV_FIELDS,
  DEFAULT_LIMITS,
  agentRecord,
  classStatus,
  dailyRows,
  fetchIssues,
  issueSummary,
  responseTimes,
} from './issues.ts';
import { auditScore, runAudit, type Impact } from './audit.ts';
import { syncAuditIssues } from './audit-issues.ts';
import { deliveryMetrics } from './delivery.ts';
import { ciHealth, profileSummary, readProfile } from './repo.ts';
import { PULL_FIELDS, fetchPulls, pullRows, pullSummary } from './pulls.ts';
import { updateQueue } from './queue.ts';
import {
  UNSCHEDULED,
  describeCron,
  findCron,
  type Schedule,
} from './schedule.ts';

/**
 * The version of status.json's shape. Readers other than the dashboard rely
 * on it: a change that removes or renames a field, or changes its type,
 * needs a new version and a new schema file. Adding a field needs only the
 * schema to describe it.
 */
export const STATUS_SCHEMA_VERSION = 1;

const env = (name: string, fallback = '') =>
  process.env[name]?.trim() || fallback;
const list = (value: string) =>
  value
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter(Boolean);

/** The schedule from the workflow file that is running this Action. */
async function readSchedule(client: GitHubClient): Promise<Schedule> {
  // owner/repo/.github/workflows/file.yml@refs/heads/main
  const ref = env('GITHUB_WORKFLOW_REF');
  const match = /^([^/]+\/[^/]+)\/(.+?)@(.+)$/.exec(ref);
  if (!match) return UNSCHEDULED;
  const [, repository, file, gitRef] = match;
  try {
    const content = await client.rest<{ content: string }>(
      `/repos/${repository}/contents/${file}?ref=${encodeURIComponent(gitRef)}`
    );
    const cron =
      content &&
      findCron(Buffer.from(content.content, 'base64').toString('utf8'));
    return cron ? describeCron(cron) : UNSCHEDULED;
  } catch {
    return UNSCHEDULED;
  }
}

/** A positive number of days from an input, or the default. */
function days(value: string, fallback: number): number {
  const n = Number(value);
  return value !== '' && Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function main(now = new Date()): Promise<void> {
  const repository = env('GITHUB_REPOSITORY');
  if (!repository) throw new Error('GITHUB_REPOSITORY is not set');
  const out = env('SRE_DATA_DIR', 'data');
  fs.mkdirSync(out, { recursive: true });
  const serverUrl = env('GITHUB_SERVER_URL', 'https://github.com');
  const token = env('SRE_TOKEN', env('GITHUB_TOKEN'));
  const client = createClient({
    token,
    apiUrl: env('GITHUB_API_URL', 'https://api.github.com'),
  });

  const issues = await fetchIssues(
    client,
    repository,
    list(env('SRE_AGENT_LOGINS'))
  );
  const today = now.toISOString().slice(0, 10);
  writeCsv(path.join(out, 'data.csv'), CSV_FIELDS, dailyRows(issues, today));
  console.log(`Issues: ${issues.length}`);

  const pulls = await fetchPulls(
    client,
    repository,
    list(env('SRE_AGENT_LOGINS'))
  );
  writeCsv(path.join(out, 'pulls.csv'), PULL_FIELDS, pullRows(pulls, today));
  const pullStats = pullSummary(pulls, now);
  console.log(`Pull requests: ${pulls.length}`);

  const queueOpen = env('SRE_QUEUE_OPEN_DIR');
  const queueResolved = env('SRE_QUEUE_RESOLVED_DIR');
  let queue = null;
  if (queueOpen && queueResolved) {
    queue = updateQueue(
      {
        repository: env('SRE_QUEUE_REPOSITORY', repository),
        openDir: queueOpen,
        resolvedDir: queueResolved,
        serverUrl,
        token,
      },
      path.join(out, 'agent_queue.csv'),
      now
    );
    console.log(
      `Queue: ${queue ? `${queue.open} open, ${queue.resolved} resolved` : 'unavailable'}`
    );
  } else {
    fs.rmSync(path.join(out, 'agent_queue.csv'), { force: true });
  }

  const schedule = await readSchedule(client);
  const summary = issueSummary(issues);
  // The workflow running this Action: its own runs are not the project's CI.
  const selfWorkflow =
    /^[^/]+\/[^/]+\/(.+?)@/.exec(env('GITHUB_WORKFLOW_REF'))?.[1] ?? null;
  const profile = await readProfile(client, repository, now, selfWorkflow);
  const ci = ciHealth(profile.ciRuns, now);
  const delivery = deliveryMetrics(profile, pulls, issues, now);
  console.log(
    `Repository: ${profile.files} files, ${profile.workflows.length} workflows, ${profile.ciRuns.length} CI runs` +
      (profile.denied.length
        ? `; could not read ${profile.denied.map((d) => `${d.what} (needs ${d.permission})`).join(', ')}`
        : '')
  );
  const limits = {
    security: days(env('SRE_SECURITY_DAYS'), DEFAULT_LIMITS.security),
    bug: days(env('SRE_BUG_DAYS'), DEFAULT_LIMITS.bug),
    other: days(env('SRE_FEATURE_DAYS'), DEFAULT_LIMITS.other),
  };
  const { cost, warnings: costWarnings } = costInputs((name) => env(name));
  for (const warning of costWarnings) {
    console.warn(`::warning::${warning}`);
    const summaryFile = env('GITHUB_STEP_SUMMARY');
    if (summaryFile)
      fs.appendFileSync(summaryFile, `> [!WARNING]\n> ${warning}\n\n`);
  }
  const checks = runAudit({
    repository,
    profile,
    summary,
    schedule,
    pulls: pullStats,
    ci,
    delivery,
    costConfigured: cost !== null,
  });
  const runId = env('GITHUB_RUN_ID');
  const status = {
    schema_version: STATUS_SCHEMA_VERSION,
    updated_at: now.toISOString().replace(/\.\d+Z$/, 'Z'),
    // The run that wrote this file, where its log and inputs can be seen.
    run_url: runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : null,
    schedule: {
      cron: schedule.cron,
      runs_per_day: schedule.runsPerDay,
      interval_hours: schedule.intervalHours,
      description: schedule.description,
      run_times_utc: schedule.runTimesUtc,
    },
    issues: summary,
    responses: responseTimes(issues, now),
    classes: classStatus(issues, limits, now),
    agents: agentRecord(issues),
    pulls: pullStats,
    repo: profileSummary(profile),
    ci,
    delivery,
    audit: { ...auditScore(checks), checks },
  };
  // Opt-in: one issue per finding, opened, updated and closed with it.
  if (/^(true|yes|1)$/i.test(env('SRE_AUDIT_ISSUES'))) {
    const impact = env('SRE_AUDIT_ISSUES_IMPACT', 'medium').toLowerCase();
    try {
      const synced = await syncAuditIssues(client, repository, checks, {
        minImpact: (['high', 'medium', 'low'].includes(impact)
          ? impact
          : 'medium') as Impact,
        dashboardUrl: env('SRE_DASHBOARD_URL'),
      });
      console.log(
        `Audit issues: ${synced.opened.length} opened, ${synced.updated.length} updated, ${synced.reopened.length} reopened, ${synced.closed.length} closed`
      );
    } catch (error) {
      // Most often the token lacks issues: write. The dashboard still goes out.
      console.warn(
        `::warning::Could not update the audit's issues (give the workflow issues: write): ${(error as Error).message}`
      );
    }
  }

  fs.writeFileSync(
    path.join(out, 'status.json'),
    JSON.stringify(status, null, 2) + '\n'
  );

  const config = {
    repository,
    repository_url: `${serverUrl}/${repository}`,
    issues_url: `${serverUrl}/${repository}/issues`,
    title: env('SRE_TITLE', repository),
    queue: queue
      ? {
          name: env('SRE_QUEUE_NAME', "Agents' own queue"),
          repository: env('SRE_QUEUE_REPOSITORY', repository),
          open_dir: queueOpen,
          resolved_dir: queueResolved,
        }
      : null,
    limits_days: limits,
    cost,
    why: env('SRE_WHY_TEXT')
      ? { text: env('SRE_WHY_TEXT'), url: env('SRE_WHY_URL') }
      : null,
  };
  fs.writeFileSync(
    path.join(out, 'config.json'),
    JSON.stringify(config, null, 2) + '\n'
  );
  console.log(`Wrote ${out}`);
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
