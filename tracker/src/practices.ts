/**
 * Checks of the repository's habits that decide how much the dashboard can
 * measure, each with a recommendation. Where the tracker cannot measure
 * something, it says why and what would let it.
 */
import type { issueSummary } from './issues.ts';
import type { Schedule } from './schedule.ts';
import type { pullSummary } from './pulls.ts';

export type PracticeStatus = 'pass' | 'improve' | 'missing' | 'unknown';

export interface Practice {
  id: string;
  title: string;
  status: PracticeStatus;
  /** What the tracker found. */
  evidence: string;
  /** What to do; empty when the check passes. */
  recommendation: string;
  /** GitHub's documentation for the fix. */
  docs: string;
}

/** Fewer issues than this, and share-based checks say "not enough yet". */
export const MIN_ISSUES = 10;

const percent = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : '0%';

/** Grades a share: at least `good` passes, at least `some` could improve. */
function grade(share: number, good = 0.8, some = 0.2): PracticeStatus {
  return share >= good ? 'pass' : share >= some ? 'improve' : 'missing';
}

export interface PracticeInputs {
  /** File names under .github/ISSUE_TEMPLATE, or `null` if none. */
  issueTemplates: string[] | null;
  summary: ReturnType<typeof issueSummary>;
  schedule: Schedule;
  pulls?: ReturnType<typeof pullSummary>;
}

export function checkPractices({
  issueTemplates,
  summary,
  schedule,
  pulls,
}: PracticeInputs): Practice[] {
  const recent = pulls
    ? Object.values(pulls.by_origin).reduce((s, o) => s + o.opened, 0)
    : 0;
  const agentWork = pulls
    ? pulls.by_origin.agent.opened + pulls.by_origin.assisted.opened
    : 0;
  const forms = (issueTemplates ?? []).filter(
    (f) => /\.ya?ml$/i.test(f) && !/^config\.ya?ml$/i.test(f)
  );
  const markdown = (issueTemplates ?? []).filter((f) => /\.md$/i.test(f));
  const closures = summary.closed_by_evidence as Record<string, number>;
  const completed = closures.fix_referenced + closures.no_reference;
  const enough = summary.total >= MIN_ISSUES;

  return [
    {
      id: 'issue-forms',
      title: 'Issue forms',
      status: forms.length ? 'pass' : markdown.length ? 'improve' : 'missing',
      evidence: forms.length
        ? `${forms.length} issue form${forms.length === 1 ? '' : 's'}: ${forms.join(', ')}`
        : markdown.length
          ? `Markdown templates only: ${markdown.join(', ')}`
          : 'No issue templates in .github/ISSUE_TEMPLATE',
      recommendation: forms.length
        ? ''
        : 'Add issue forms (YAML) for bug reports and feature requests. Forms keep reports complete, and a labels: entry in each form labels new issues automatically, so the dashboard can tell bugs from requests.',
      docs: 'https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms',
    },
    {
      id: 'labels',
      title: 'Issues are labelled',
      status: enough ? grade(summary.labelled / summary.total) : 'unknown',
      evidence: enough
        ? `${percent(summary.labelled, summary.total)} of ${summary.total} issues carry a label`
        : `Only ${summary.total} issues so far`,
      recommendation:
        'Label every issue at triage, at least bug or enhancement. Issue forms can add the label for you. Labels let the dashboard separate bugs from feature requests, and incident labels feed the delivery metrics.',
      docs: 'https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels',
    },
    {
      id: 'linked-fixes',
      title: 'Closed issues link to their fix',
      status:
        completed >= 5 ? grade(closures.fix_referenced / completed) : 'unknown',
      evidence:
        completed >= 5
          ? `${percent(closures.fix_referenced, completed)} of ${completed} completed closures reference a commit, pull request or release`
          : `Only ${completed} issues closed as completed so far`,
      recommendation:
        'Close issues from the fix: write "Fixes #123" in the pull request description or commit message. GitHub then closes the issue when the change merges and records the link, so every closure can be verified.',
      docs: 'https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue',
    },
    {
      id: 'agent-attribution',
      title: 'Agent work is attributed',
      status: recent < 5 ? 'unknown' : agentWork > 0 ? 'pass' : 'unknown',
      evidence:
        recent < 5
          ? `Only ${recent} pull requests in the last ${pulls?.window_days ?? 30} days`
          : agentWork > 0
            ? `${agentWork} of ${recent} pull requests in the last ${pulls!.window_days} days show an agent's work`
            : `None of ${recent} pull requests in the last ${pulls!.window_days} days names an agent`,
      recommendation:
        "If people use coding agents through their own accounts, record it: keep the agent's Co-Authored-By trailer on commits (Claude Code, Copilot and Cursor can add one) or its signature in the pull request description. Otherwise agent work is counted as human.",
      docs: 'https://docs.github.com/en/pull-requests/committing-changes-to-your-project/creating-and-editing-commits/creating-a-commit-with-multiple-authors',
    },
    {
      id: 'schedule',
      title: 'The dashboard updates on a schedule',
      status: schedule.cron ? 'pass' : 'improve',
      evidence: schedule.cron
        ? `Runs ${schedule.description}`
        : 'The workflow has no schedule, so the dashboard updates only when it is run',
      recommendation:
        "Add a schedule trigger to the workflow, for example cron: '5 */6 * * *' for every six hours.",
      docs: 'https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule',
    },
  ].map((practice) =>
    practice.status === 'pass' ? { ...practice, recommendation: '' } : practice
  ) as Practice[];
}
