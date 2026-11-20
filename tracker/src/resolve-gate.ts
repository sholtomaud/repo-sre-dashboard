/**
 * Circuit breaker and issue selector for the autonomous issue-resolution
 * workflow (.github/workflows/agent-resolve.yml).
 *
 * Pure decision logic lives in `claimedIssues()` and `evaluateResolveGate()`,
 * unit-tested with `node --test`. When invoked directly by GitHub Actions,
 * `main()` reads open issues/PRs and the published dashboard data, evaluates
 * the gate, and writes outputs to `$GITHUB_OUTPUT` and `$GITHUB_STEP_SUMMARY`.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from './github.ts';
import { isAgent } from './issues.ts';
import { agentInSignature, agentInTrailers } from './pulls.ts';

export interface GateIssue {
  number: number;
  title: string;
  labels: string[];
  createdAt: string;
}

export interface GatePr {
  number: number;
  title: string;
  body: string;
  isAgent: boolean;
}

export interface ResolveGateInput {
  issues: GateIssue[];
  openPrs: GatePr[];
  ciFailingNow: string[];
  agenticMonthlySpend: number | null;
  agenticMonthlyBudget: number | null;
  requestedIssue: number | null;
  maxOpenAgentPrs?: number;
}

export type ResolveGateReason =
  | 'selected'
  | 'open-agent-pr-cap'
  | 'agentic-budget-exceeded'
  | 'ci-failing-on-main'
  | 'already-has-pr'
  | 'issue-not-found'
  | 'no-eligible-issues';

export interface ResolveGateDecision {
  proceed: boolean;
  reason: ResolveGateReason;
  message: string;
  issue: GateIssue | null;
}

const CLOSING_LINK = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi;

/** Issue numbers already linked to an open pull request via a closing keyword. */
export function claimedIssues(openPrs: GatePr[]): Set<number> {
  const claimed = new Set<number>();
  for (const pr of openPrs) {
    const text = `${pr.title}\n${pr.body}`;
    for (const match of text.matchAll(CLOSING_LINK)) {
      claimed.add(Number(match[1]));
    }
  }
  return claimed;
}

const hasLabel = (issue: GateIssue, name: string) =>
  issue.labels.some((l) => l.toLowerCase() === name);

const isEligible = (issue: GateIssue) =>
  hasLabel(issue, 'repo-sre-audit') || hasLabel(issue, 'agent-ready');

const isCiOrRecovery = (issue: GateIssue) =>
  hasLabel(issue, 'incident') ||
  hasLabel(issue, 'security') ||
  (hasLabel(issue, 'repo-sre-audit') && /\bci\b/i.test(issue.title));

/** Lower number = higher priority. */
function priorityTier(issue: GateIssue): number {
  if (hasLabel(issue, 'security') || hasLabel(issue, 'incident')) return 0;
  if (hasLabel(issue, 'repo-sre-audit')) return 1;
  if (hasLabel(issue, 'bug')) return 2;
  return 3;
}

/**
 * Decide whether the autonomous resolver may run, and which single issue it
 * should work on. Pauses when open agent PRs hit the cap, when monthly agentic
 * spend exceeds budget, or when CI on the default branch is red (except for
 * CI/incident/security recovery issues).
 */
export function evaluateResolveGate(
  input: ResolveGateInput
): ResolveGateDecision {
  const cap = input.maxOpenAgentPrs ?? 2;
  const openAgentPrs = input.openPrs.filter((pr) => pr.isAgent).length;
  if (openAgentPrs >= cap) {
    return {
      proceed: false,
      reason: 'open-agent-pr-cap',
      message: `Paused: ${openAgentPrs} open agent PR(s) already waiting for review (cap: ${cap}).`,
      issue: null,
    };
  }

  if (
    input.agenticMonthlyBudget !== null &&
    input.agenticMonthlySpend !== null &&
    ((input.agenticMonthlyBudget === 0 && input.agenticMonthlySpend > 0) ||
      input.agenticMonthlySpend > input.agenticMonthlyBudget)
  ) {
    return {
      proceed: false,
      reason: 'agentic-budget-exceeded',
      message: `Paused: estimated monthly agentic spend (${Math.round(input.agenticMonthlySpend)}) exceeds monthly-agentic-budget (${input.agenticMonthlyBudget}).`,
      issue: null,
    };
  }

  const claimed = claimedIssues(input.openPrs);
  const ciBroken = input.ciFailingNow.length > 0;

  if (input.requestedIssue !== null) {
    const found = input.issues.find((i) => i.number === input.requestedIssue);
    if (!found) {
      return {
        proceed: false,
        reason: 'issue-not-found',
        message: `Requested issue #${input.requestedIssue} is not open.`,
        issue: null,
      };
    }
    if (claimed.has(found.number)) {
      return {
        proceed: false,
        reason: 'already-has-pr',
        message: `Issue #${found.number} already has an open pull request.`,
        issue: null,
      };
    }
    if (ciBroken && !isCiOrRecovery(found)) {
      return {
        proceed: false,
        reason: 'ci-failing-on-main',
        message: `Paused: default-branch CI is failing (${input.ciFailingNow.join(', ')}); holding non-recovery issue #${found.number}.`,
        issue: null,
      };
    }
    return {
      proceed: true,
      reason: 'selected',
      message: `Selected requested issue #${found.number}: ${found.title}`,
      issue: found,
    };
  }

  const unclaimed = input.issues.filter(
    (i) => isEligible(i) && !claimed.has(i.number)
  );
  const candidates = ciBroken ? unclaimed.filter(isCiOrRecovery) : unclaimed;
  if (!candidates.length) {
    if (ciBroken && unclaimed.length > 0) {
      return {
        proceed: false,
        reason: 'ci-failing-on-main',
        message: `Paused: default-branch CI is failing (${input.ciFailingNow.join(', ')}) and no CI-recovery issue is queued.`,
        issue: null,
      };
    }
    return {
      proceed: false,
      reason: 'no-eligible-issues',
      message:
        'No unclaimed repo-sre-audit or agent-ready issues are open right now.',
      issue: null,
    };
  }

  candidates.sort(
    (a, b) =>
      priorityTier(a) - priorityTier(b) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.number - b.number
  );
  const chosen = candidates[0];
  return {
    proceed: true,
    reason: 'selected',
    message: `Selected issue #${chosen.number}: ${chosen.title}`,
    issue: chosen,
  };
}

interface RestIssue {
  number: number;
  title: string;
  body?: string | null;
  created_at: string;
  pull_request?: unknown;
  labels: ({ name?: string } | string)[];
}

interface RestPr {
  number: number;
  title: string;
  body?: string | null;
  user?: { login: string; type?: string } | null;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function writeOutput(key: string, value: string) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  const delimiter = `EOF_${key}_${Date.now()}`;
  fs.appendFileSync(file, `${key}<<${delimiter}\n${value}\n${delimiter}\n`);
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY ?? '';
  const token = process.env.GITHUB_TOKEN ?? '';
  if (!repository || !token) {
    throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required');
  }
  const [owner, repo] = repository.split('/');
  const client = createClient({ token });

  const [rawIssues, rawPrs] = await Promise.all([
    client.restAll<RestIssue>(
      `/repos/${repository}/issues?state=open&per_page=100`,
      200
    ),
    client.restAll<RestPr>(
      `/repos/${repository}/pulls?state=open&per_page=100`,
      100
    ),
  ]);

  const issues: GateIssue[] = rawIssues
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      createdAt: i.created_at,
      labels: i.labels.map((l) => (typeof l === 'string' ? l : (l.name ?? ''))),
    }));

  const openPrs: GatePr[] = rawPrs.map((pr) => {
    const body = pr.body ?? '';
    const login = pr.user?.login ?? '';
    const type = pr.user?.type ?? 'User';
    return {
      number: pr.number,
      title: pr.title,
      body,
      isAgent:
        isAgent(login, type) ||
        agentInSignature(body) !== null ||
        agentInTrailers(body) !== null,
    };
  });

  const dataUrl =
    process.env.DASHBOARD_DATA_URL ||
    `https://${owner}.github.io/${repo}/dashboard/data`;
  const [status, config] = await Promise.all([
    fetchJson<{
      ci?: { failing_now?: string[] };
      pulls?: {
        by_origin?: {
          agent?: { opened?: number };
          assisted?: { opened?: number };
        };
      };
    }>(`${dataUrl}/status.json`),
    fetchJson<{
      cost?: {
        agent_per_issue?: number;
        monthly_agentic_budget?: number | null;
      };
    }>(`${dataUrl}/config.json`),
  ]);

  const ciFailingNow = status?.ci?.failing_now ?? [];
  const agenticMonthlyBudget = config?.cost?.monthly_agentic_budget ?? null;
  const agentPerIssue = config?.cost?.agent_per_issue ?? null;
  const recentAgentPrs =
    (status?.pulls?.by_origin?.agent?.opened ?? 0) +
    (status?.pulls?.by_origin?.assisted?.opened ?? 0);
  const agenticMonthlySpend =
    agentPerIssue !== null ? recentAgentPrs * agentPerIssue : null;

  const rawRequested = (process.env.REQUESTED_ISSUE ?? '').trim();
  const requestedIssue = /^\d+$/.test(rawRequested)
    ? Number(rawRequested)
    : null;
  const maxOpenAgentPrs = Number(process.env.MAX_OPEN_AGENT_PRS ?? '2') || 2;

  const decision = evaluateResolveGate({
    issues,
    openPrs,
    ciFailingNow,
    agenticMonthlySpend,
    agenticMonthlyBudget,
    requestedIssue,
    maxOpenAgentPrs,
  });

  writeOutput('proceed', String(decision.proceed));
  writeOutput('reason', decision.reason);
  writeOutput('message', decision.message);
  writeOutput(
    'issue_number',
    decision.issue ? String(decision.issue.number) : ''
  );
  writeOutput('issue_title', decision.issue ? decision.issue.title : '');

  console.log(`[resolve-gate] ${decision.reason}: ${decision.message}`);
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    fs.appendFileSync(
      summaryFile,
      `### Agent resolve gate\n\n- **Decision**: ${decision.proceed ? 'proceed' : 'paused'} (\`${decision.reason}\`)\n- **Detail**: ${decision.message}\n`
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
