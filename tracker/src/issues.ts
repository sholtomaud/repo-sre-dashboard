/**
 * The repository's issues: who closed each, how it was closed, what kind of
 * issue it is, and how long it took to get a response and a resolution.
 */
import type { GitHubClient } from './github.ts';

/** How a closed issue was closed, judged only from what GitHub records. */
export const EVIDENCE = [
  'fix_referenced',
  'no_reference',
  'declined',
  'withdrawn',
  'duplicate',
] as const;
export type Evidence = (typeof EVIDENCE)[number];

/** What an issue is: a bug-style report, a feature request, or other. */
export const KINDS = ['behavior', 'feature', 'other'] as const;
export type Kind = (typeof KINDS)[number];

export type Closer = 'agent' | 'human';

export interface Issue {
  number: number;
  createdAt: string;
  closedAt: string | null;
  closer: Closer | null;
  evidence: Evidence | null;
  kind: Kind;
  labelled: boolean;
  /** Reopened at least once; `null` when not known. */
  reopened: boolean | null;
  /** When someone other than the reporter first responded. */
  firstResponseAt: string | null;
}

/** Login fragments that mark an account as automation or an AI agent. */
export const AGENT_WORDS = [
  'agent',
  'bot',
  'automation',
  'copilot',
  'claude',
  'devin',
  'codex',
  'cursor',
  'sweep',
  'jules',
];

/** Routine automation whose comments are not a response to the reporter. */
const NOT_A_RESPONSE = new Set([
  'github-actions[bot]',
  'dependabot[bot]',
  'stale[bot]',
]);

export function isAgent(
  login: string | null | undefined,
  type: string | null | undefined,
  extra: string[] = []
): boolean {
  const name = (login ?? '').toLowerCase();
  if (!name) return false;
  if (type === 'Bot') return true;
  if (extra.some((l) => l.toLowerCase() === name)) return true;
  return AGENT_WORDS.some((word) => name.includes(word));
}

/** Issue-form and template headings that mark a bug report or a request. */
const BUG_HEADINGS = [
  'what happened',
  'steps to reproduce',
  'expected behavior',
  'expected behaviour',
  'actual behavior',
  'actual behaviour',
  'describe the bug',
];
const FEATURE_HEADINGS = [
  'use case',
  'what would help',
  'proposed solution',
  'describe the solution',
  'feature request',
  'is your feature request related to a problem',
];
const BUG_LABELS = ['bug', 'defect', 'regression', 'type: bug', 'kind/bug'];
const FEATURE_LABELS = [
  'enhancement',
  'feature',
  'feature-request',
  'feature request',
  'type: feature',
  'kind/feature',
];

/** The kind of issue, from its labels, then from the headings of its form. */
export function classifyKind(body: string | null, labels: string[]): Kind {
  const names = labels.map((l) => l.toLowerCase());
  if (names.some((n) => FEATURE_LABELS.includes(n))) return 'feature';
  if (names.some((n) => BUG_LABELS.includes(n))) return 'behavior';
  const headings = [
    ...(body ?? '').matchAll(/^#{2,3}\s+(.+?)\s*\??\s*$/gm),
  ].map((m) => m[1].toLowerCase().replace(/[*_:]/g, '').trim());
  const has = (list: string[]) =>
    headings.some((h) => list.some((x) => h.startsWith(x)));
  if (has(FEATURE_HEADINGS)) return 'feature';
  if (has(BUG_HEADINGS)) return 'behavior';
  return 'other';
}

/** A commit URL or SHA, or a fix tied to a release version. */
export const FIX_REFERENCE = new RegExp(
  [
    '/commit/[0-9a-f]{7,40}',
    '\\b(?=[0-9a-f]*[0-9])(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\\b',
    '\\b(?:fix|resolv|releas|ship|includ)\\w*\\b.{0,60}?\\bv?\\d+\\.\\d+(?:\\.\\d+)?\\b',
  ].join('|'),
  'i'
);

export interface Comment {
  author: string | null;
  body: string;
}

/**
 * How a closed issue was closed.
 *
 * fix_referenced: a commit or merged pull request closed it, or someone
 *   other than the reporter pointed to a commit or a release.
 * duplicate / declined: the stated reason. withdrawn: the reporter closed
 *   it. no_reference: marked completed with nothing to check it against.
 */
export function classifyEvidence(
  stateReason: string | null,
  closerType: string | null,
  closerMerged: boolean | null,
  closedBy: string | null,
  author: string | null,
  comments: Comment[]
): Evidence {
  const reason = (stateReason ?? '').toLowerCase();
  if (reason === 'duplicate') return 'duplicate';
  if (
    closerType === 'Commit' ||
    (closerType === 'PullRequest' && closerMerged)
  ) {
    return 'fix_referenced';
  }
  if (
    comments.some(
      (c) => c.author !== author && FIX_REFERENCE.test(c.body ?? '')
    )
  ) {
    return 'fix_referenced';
  }
  if (closedBy && closedBy === author) return 'withdrawn';
  if (reason === 'not_planned') return 'declined';
  return 'no_reference';
}

/**
 * When someone other than the reporter first responded: their first comment
 * or, if sooner, closing the issue. Routine automation does not count.
 */
export function firstResponse(
  author: string | null,
  comments: { author: string | null; createdAt: string }[],
  closedAt: string | null,
  closedBy: string | null
): string | null {
  const times = comments
    .filter(
      (c) => c.author && c.author !== author && !NOT_A_RESPONSE.has(c.author)
    )
    .map((c) => c.createdAt);
  if (
    closedAt &&
    closedBy &&
    closedBy !== author &&
    !NOT_A_RESPONSE.has(closedBy)
  ) {
    times.push(closedAt);
  }
  return times.length ? times.sort()[0] : null;
}

const ISSUES_QUERY = `
query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    issues(first: 50, after: $cursor, orderBy: {field: CREATED_AT, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number createdAt closedAt stateReason body
        author { login }
        labels(first: 20) { nodes { name } }
        closedEvents: timelineItems(itemTypes: [CLOSED_EVENT], last: 1) {
          nodes {
            ... on ClosedEvent {
              actor { login __typename }
              closer { __typename ... on PullRequest { merged } }
            }
          }
        }
        reopens: timelineItems(itemTypes: [REOPENED_EVENT]) { totalCount }
        firstComments: comments(first: 10) { nodes { author { login } createdAt } }
        lastComments: comments(last: 20) { nodes { author { login } body } }
      }
    }
  }
}`;

interface IssueNode {
  number: number;
  createdAt: string;
  closedAt: string | null;
  stateReason: string | null;
  body: string | null;
  author: { login: string } | null;
  labels: { nodes: { name: string }[] };
  closedEvents: {
    nodes: ({
      actor: { login: string; __typename: string } | null;
      closer: { __typename: string; merged?: boolean } | null;
    } | null)[];
  };
  reopens: { totalCount: number };
  firstComments: {
    nodes: { author: { login: string } | null; createdAt: string }[];
  };
  lastComments: { nodes: { author: { login: string } | null; body: string }[] };
}

/** Turns one GraphQL issue into the tracker's record. */
export function toIssue(node: IssueNode, agentLogins: string[] = []): Issue {
  const closed = node.closedEvents.nodes.at(-1) ?? null;
  const actor = closed?.actor ?? null;
  const author = node.author?.login ?? null;
  const labels = node.labels.nodes.map((l) => l.name);
  const isClosed = node.closedAt !== null;
  return {
    number: node.number,
    createdAt: node.createdAt,
    closedAt: node.closedAt,
    closer: isClosed
      ? isAgent(actor?.login, actor?.__typename, agentLogins)
        ? 'agent'
        : 'human'
      : null,
    evidence: isClosed
      ? classifyEvidence(
          node.stateReason,
          closed?.closer?.__typename ?? null,
          closed?.closer?.merged ?? null,
          actor?.login ?? null,
          author,
          node.lastComments.nodes.map((c) => ({
            author: c.author?.login ?? null,
            body: c.body,
          }))
        )
      : null,
    kind: classifyKind(node.body, labels),
    labelled: labels.length > 0,
    reopened: node.reopens.totalCount > 0,
    firstResponseAt: firstResponse(
      author,
      node.firstComments.nodes.map((c) => ({
        author: c.author?.login ?? null,
        createdAt: c.createdAt,
      })),
      node.closedAt,
      actor?.login ?? null
    ),
  };
}

/** Every issue in the repository (not pull requests). */
export async function fetchIssues(
  client: GitHubClient,
  repository: string,
  agentLogins: string[] = []
): Promise<Issue[]> {
  const [owner, name] = repository.split('/');
  const issues: Issue[] = [];
  let cursor: string | null = null;
  for (;;) {
    const data: {
      repository: {
        issues: {
          pageInfo: { hasNextPage: boolean; endCursor: string };
          nodes: IssueNode[];
        };
      };
    } = await client.graphql(ISSUES_QUERY, { owner, name, cursor });
    const page = data.repository.issues;
    issues.push(...page.nodes.map((node) => toIssue(node, agentLogins)));
    if (!page.pageInfo.hasNextPage) return issues;
    cursor = page.pageInfo.endCursor;
  }
}

/** The columns of data.csv. */
export const CSV_FIELDS = [
  'date',
  'open',
  'agent_closed',
  'human_closed',
  ...EVIDENCE.map((e) => `closed_${e}`),
  'behavior_created',
  'behavior_closed',
] as const;

const day = (timestamp: string) => timestamp.slice(0, 10);
const MS_PER_DAY = 86_400_000;

/** Running totals for each UTC day from the first issue to `today`. */
export function dailyRows(
  issues: Issue[],
  today: string
): Record<(typeof CSV_FIELDS)[number], string | number>[] {
  const start = issues.length
    ? issues.map((i) => day(i.createdAt)).sort()[0]
    : today;
  const rows = [];
  for (let t = Date.parse(start); t <= Date.parse(today); t += MS_PER_DAY) {
    const date = new Date(t).toISOString().slice(0, 10);
    const created = issues.filter((i) => day(i.createdAt) <= date);
    const closed = created.filter((i) => i.closedAt && day(i.closedAt) <= date);
    const row: Record<string, string | number> = {
      date,
      open: created.length - closed.length,
      agent_closed: closed.filter((i) => i.closer === 'agent').length,
      human_closed: closed.filter((i) => i.closer === 'human').length,
      behavior_created: created.filter((i) => i.kind === 'behavior').length,
      behavior_closed: closed.filter((i) => i.kind === 'behavior').length,
    };
    for (const e of EVIDENCE) {
      row[`closed_${e}`] = closed.filter((i) => i.evidence === e).length;
    }
    rows.push(row as Record<(typeof CSV_FIELDS)[number], string | number>);
  }
  return rows;
}

/** Median and 90th percentile, in hours. */
export interface Durations {
  count: number;
  medianHours: number | null;
  p90Hours: number | null;
}

function durations(hours: number[]): Durations {
  const sorted = [...hours].sort((a, b) => a - b);
  const at = (p: number) =>
    sorted.length
      ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
      : null;
  return { count: sorted.length, medianHours: at(0.5), p90Hours: at(0.9) };
}

const hoursBetween = (from: string, to: string) =>
  (Date.parse(to) - Date.parse(from)) / 3_600_000;

/**
 * Time to first response and time to resolution, for issues opened in the
 * last `windowDays` days, plus how many open issues have had no response.
 */
export function responseTimes(issues: Issue[], now: Date, windowDays = 30) {
  const since = now.getTime() - windowDays * MS_PER_DAY;
  const recent = issues.filter((i) => Date.parse(i.createdAt) >= since);
  return {
    windowDays,
    firstResponse: durations(
      recent
        .filter((i) => i.firstResponseAt)
        .map((i) => hoursBetween(i.createdAt, i.firstResponseAt!))
    ),
    resolution: durations(
      recent
        .filter(
          (i) =>
            i.closedAt &&
            i.evidence !== 'withdrawn' &&
            i.evidence !== 'duplicate'
        )
        .map((i) => hoursBetween(i.createdAt, i.closedAt!))
    ),
    awaitingResponse: issues.filter((i) => !i.closedAt && !i.firstResponseAt)
      .length,
  };
}

/** Today's breakdown of open issues and closure habits, for status.json. */
export function issueSummary(issues: Issue[]) {
  const open = issues.filter((i) => !i.closedAt);
  const everClosed = issues.filter((i) => i.closedAt || i.reopened);
  return {
    total: issues.length,
    open: open.length,
    open_labelled: open.filter((i) => i.labelled).length,
    labelled: issues.filter((i) => i.labelled).length,
    open_by_kind: Object.fromEntries(
      KINDS.map((k) => [k, open.filter((i) => i.kind === k).length])
    ),
    by_kind: Object.fromEntries(
      KINDS.map((k) => [k, issues.filter((i) => i.kind === k).length])
    ),
    ever_closed: everClosed.length,
    reopened: issues.filter((i) => i.reopened).length,
    closed_by_evidence: Object.fromEntries(
      EVIDENCE.map((e) => [
        e,
        issues.filter((i) => i.closedAt && i.evidence === e).length,
      ])
    ),
  };
}
