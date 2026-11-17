/**
 * The Action's data step: reads the repository through the GitHub API and
 * writes the dashboard's data files.
 *
 *   data.csv          daily running totals of the repository's issues
 *   agent_queue.csv   daily counts of a file-based queue, when configured
 *   status.json       last update, schedule, breakdowns, response times and
 *                     the habits checklist
 *   config.json       what the dashboard shows: repository, title, queue
 *
 * Inputs come from environment variables set by action.yml.
 */
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
import { checkPractices } from './practices.ts';
import { updateQueue } from './queue.ts';
import {
  UNSCHEDULED,
  describeCron,
  findCron,
  type Schedule,
} from './schedule.ts';

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

/**
 * The cost inputs, or `null` until the user sets them: costs are never
 * guessed. Agent cost per resolved issue, a human hourly rate and hours per
 * issue, and a monthly budget, all in the currency the user chooses.
 */
function costInputs() {
  const read = (name: string) => {
    const n = Number(env(name));
    return env(name) !== '' && Number.isFinite(n) && n >= 0 ? n : null;
  };
  const agentPerIssue = read('SRE_AGENT_COST_PER_ISSUE');
  const humanHourly = read('SRE_HUMAN_HOURLY_RATE');
  const humanHours = read('SRE_HUMAN_HOURS_PER_ISSUE');
  const budget = read('SRE_MONTHLY_BUDGET');
  if (agentPerIssue === null && humanHourly === null) return null;
  return {
    currency: env('SRE_CURRENCY', 'USD'),
    agent_per_issue: agentPerIssue ?? 0,
    human_hourly_rate: humanHourly ?? 0,
    human_hours_per_issue: humanHours ?? 2,
    monthly_budget: budget,
  };
}

/** File names under .github/ISSUE_TEMPLATE, or `null` if there are none. */
async function issueTemplates(client: GitHubClient, repository: string) {
  const entries = await client
    .rest<{ name: string }[]>(
      `/repos/${repository}/contents/.github/ISSUE_TEMPLATE`
    )
    .catch(() => null);
  return Array.isArray(entries) ? entries.map((e) => e.name) : null;
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
  const weight = Number(env('SRE_PUBLIC_WEIGHT', '0.5'));
  const limits = {
    security: days(env('SRE_SECURITY_DAYS'), DEFAULT_LIMITS.security),
    bug: days(env('SRE_BUG_DAYS'), DEFAULT_LIMITS.bug),
    other: days(env('SRE_FEATURE_DAYS'), DEFAULT_LIMITS.other),
  };
  const cost = costInputs();
  const status = {
    updated_at: now.toISOString().replace(/\.\d+Z$/, 'Z'),
    schedule: {
      cron: schedule.cron,
      runs_per_day: schedule.runsPerDay,
      interval_hours: schedule.intervalHours,
      description: schedule.description,
      run_times_utc: schedule.runTimesUtc,
    },
    weighting: {
      default_public_weight: Number.isFinite(weight)
        ? Math.min(1, Math.max(0, weight))
        : 0.5,
    },
    issues: summary,
    responses: responseTimes(issues, now),
    classes: classStatus(issues, limits, now),
    agents: agentRecord(issues),
    practices: checkPractices({
      issueTemplates: await issueTemplates(client, repository),
      summary,
      schedule,
    }),
  };
  fs.writeFileSync(
    path.join(out, 'status.json'),
    JSON.stringify(status, null, 2) + '\n'
  );

  const config = {
    repository,
    repository_url: `${serverUrl}/${repository}`,
    issues_url: `${serverUrl}/${repository}/issues`,
    title: env('SRE_TITLE', 'Developer Doomsday Clock'),
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
