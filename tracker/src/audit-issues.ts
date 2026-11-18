/**
 * Opt-in (audit-issues: true): keeps one issue per audit finding, so the
 * repository's to-do list holds the audit's recommendations.
 *
 * - A finding at or above the chosen impact gets an issue, labelled
 *   `repo-sre-audit`, with what was found, why it matters, what to do and
 *   the fix to copy. Its body is updated when the finding changes.
 * - When the check passes, the issue is closed as completed, with a comment.
 *   If the check fails again later, the same issue is reopened.
 * - Checks waiting for data are left alone.
 *
 * Each issue carries a hidden marker naming its check, so it is found again
 * whatever its title. The tracker leaves these issues out of the issue
 * figures (see fetchIssues).
 */
import type { Check, Impact } from './audit.ts';
import type { GitHubClient } from './github.ts';
import { AUDIT_LABEL } from './issues.ts';

const RANK: Record<Impact, number> = { high: 3, medium: 2, low: 1 };

export const marker = (id: string) => `<!-- repo-sre-audit:${id} -->`;
const MARKER = /<!-- repo-sre-audit:([\w-]+) -->/;

interface ExistingIssue {
  number: number;
  state: 'open' | 'closed';
  body: string | null;
  pull_request?: unknown;
}

export function issueTitle(check: Check): string {
  return `Audit: ${check.title}`;
}

export function issueBody(check: Check, dashboardUrl: string): string {
  const fence = (language: string, content: string) => {
    const ticks = content.includes('```') ? '````' : '```';
    return `${ticks}${language}\n${content.trimEnd()}\n${ticks}`;
  };
  const fixes = check.fixes.map((fix) =>
    [
      fix.path
        ? `Add \`${fix.path}\`:`
        : fix.language === 'shell'
          ? 'Run:'
          : 'Add to the workflow:',
      '',
      fence(fix.language === 'text' ? '' : fix.language, fix.content),
    ].join('\n')
  );
  return [
    marker(check.id),
    `**${check.status === 'missing' ? 'Missing' : 'Could improve'}** · ${check.impact} impact · ${check.group}`,
    '',
    `**Found:** ${check.evidence}`,
    '',
    `**Why it matters:** ${check.why}`,
    '',
    `**What to do:** ${check.recommendation}`,
    ...(fixes.length ? ['', ...fixes] : []),
    '',
    [
      check.docs ? `[Documentation](${check.docs})` : '',
      dashboardUrl
        ? `[This check on the dashboard](${dashboardUrl}audit#${check.id})`
        : '',
    ]
      .filter(Boolean)
      .join(' · '),
    '',
    `_Opened by the [Repo SRE Dashboard](https://github.com/sholtomaud/repo-sre-dashboard) audit. It closes itself when the check passes; fix the finding rather than closing it by hand._`,
  ].join('\n');
}

export interface SyncResult {
  opened: number[];
  updated: number[];
  reopened: number[];
  closed: number[];
}

/** Brings the audit's issues in line with the checks. */
export async function syncAuditIssues(
  client: GitHubClient,
  repository: string,
  checks: Check[],
  options: { minImpact?: Impact; dashboardUrl?: string } = {}
): Promise<SyncResult> {
  const base = `/repos/${repository}`;
  const min = RANK[options.minImpact ?? 'medium'];
  const url = options.dashboardUrl ?? '';
  const result: SyncResult = {
    opened: [],
    updated: [],
    reopened: [],
    closed: [],
  };

  // The label, created on first use.
  try {
    await client.send('POST', `${base}/labels`, {
      name: AUDIT_LABEL,
      color: '5319E7',
      description:
        'Opened by the Repo SRE Dashboard audit; closes itself when fixed',
    });
  } catch (error) {
    // 422: it exists already.
    if (!/HTTP 422/.test(String(error))) throw error;
  }

  const existing = new Map<string, ExistingIssue>();
  for (const issue of await client.restAll<ExistingIssue>(
    `${base}/issues?labels=${AUDIT_LABEL}&state=all`,
    500
  )) {
    const id = issue.pull_request ? null : MARKER.exec(issue.body ?? '')?.[1];
    // The newest issue for a check wins (lists are newest first).
    if (id && !existing.has(id)) existing.set(id, issue);
  }

  for (const check of checks) {
    const issue = existing.get(check.id);
    const failing =
      (check.status === 'missing' || check.status === 'improve') &&
      RANK[check.impact] >= min;
    if (failing) {
      const body = issueBody(check, url);
      if (!issue) {
        const created = await client.send<{ number: number }>(
          'POST',
          `${base}/issues`,
          { title: issueTitle(check), body, labels: [AUDIT_LABEL] }
        );
        result.opened.push(created.number);
      } else if (issue.state === 'closed') {
        await client.send('PATCH', `${base}/issues/${issue.number}`, {
          state: 'open',
          title: issueTitle(check),
          body,
        });
        result.reopened.push(issue.number);
      } else if ((issue.body ?? '').trim() !== body.trim()) {
        await client.send('PATCH', `${base}/issues/${issue.number}`, {
          title: issueTitle(check),
          body,
        });
        result.updated.push(issue.number);
      }
    } else if (issue && issue.state === 'open' && check.status === 'pass') {
      await client.send('POST', `${base}/issues/${issue.number}/comments`, {
        body: `The audit now passes this check: ${check.evidence}. Closing.`,
      });
      await client.send('PATCH', `${base}/issues/${issue.number}`, {
        state: 'closed',
        state_reason: 'completed',
      });
      result.closed.push(issue.number);
    }
  }
  return result;
}
