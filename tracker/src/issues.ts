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

/**
 * Classes of issue for the manageability limits, most urgent first. An
 * issue belongs to the first class it fits.
 */
export const CLASSES = ['security', 'bug', 'other'] as const;
export type IssueClass = (typeof CLASSES)[number];

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
  /** Who filed it. */
  opener: Closer;
  /** Security, bug or other: which manageability limit applies. */
  issueClass: IssueClass;
  /** Labelled as an incident, outage or regression. */
  incident?: boolean;
}

/** Labels that mark an issue as an incident in production. */
export const INCIDENT_LABEL =
  /^(incident|outage|regression|sev[ -]?[0-3]|p0|production|prod[ -]issue)$/i;

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

const SECURITY_LABELS = [
  'security',
  'vulnerability',
  'cve',
  'type: security',
  'kind/security',
  'security-issue',
];
/** A CVE or GitHub security advisory identifier. */
export const ADVISORY_ID =
  /\b(?:CVE-\d{4}-\d{4,}|GHSA(?:-[23456789cfghjmpqrvwx]{4}){3})\b/i;

/**
 * The issue's class: security if it is labelled so or names a CVE or GHSA
 * advisory; otherwise bug if it is a bug report; otherwise other.
 */
export function classifyClass(
  title: string | null,
  body: string | null,
  labels: string[],
  kind: Kind
): IssueClass {
  const names = labels.map((l) => l.toLowerCase());
  if (
    names.some(
      (n) => SECURITY_LABELS.includes(n) || n.startsWith('security')
    ) ||
    ADVISORY_ID.test(title ?? '') ||
    ADVISORY_ID.test(body ?? '')
  ) {
    return 'security';
  }
  return kind === 'behavior' ? 'bug' : 'other';
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
        number title createdAt closedAt stateReason body
        author { login __typename }
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
  title?: string | null;
  createdAt: string;
  closedAt: string | null;
  stateReason: string | null;
  body: string | null;
  author: { login: string; __typename?: string } | null;
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
  const kind = classifyKind(node.body, labels);
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
    kind,
    labelled: labels.length > 0,
    opener: isAgent(author, node.author?.__typename, agentLogins)
      ? 'agent'
      : 'human',
    issueClass: classifyClass(node.title ?? null, node.body, labels, kind),
    reopened: node.reopens.totalCount > 0,
    incident: labels.some((l) => INCIDENT_LABEL.test(l.trim())),
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
  ...CLASSES.flatMap((c) => [
    `${c}_opened_by_agents`,
    `${c}_opened_by_humans`,
    `${c}_closed_by_agents`,
    `${c}_closed_by_humans`,
  ]),
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
    for (const c of CLASSES) {
      const opened = created.filter((i) => i.issueClass === c);
      const done = closed.filter((i) => i.issueClass === c);
      row[`${c}_opened_by_agents`] = opened.filter(
        (i) => i.opener === 'agent'
      ).length;
      row[`${c}_opened_by_humans`] = opened.filter(
        (i) => i.opener === 'human'
      ).length;
      row[`${c}_closed_by_agents`] = done.filter(
        (i) => i.closer === 'agent'
      ).length;
      row[`${c}_closed_by_humans`] = done.filter(
        (i) => i.closer === 'human'
      ).length;
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

/** Manageability limits: how long a new issue may wait, in days, by class. */
export type Limits = Record<IssueClass, number>;

/** The defaults: 7 days for security, 30 for bugs, 180 for anything else. */
export const DEFAULT_LIMITS: Limits = { security: 7, bug: 30, other: 180 };

/**
 * Each class's state now: open issues, the age of the oldest, and how many
 * are already older than the class's limit.
 */
export function classStatus(
  issues: Issue[],
  limits: Limits,
  now: Date,
  windowDays = 30
) {
  const since = now.getTime() - windowDays * MS_PER_DAY;
  const days = (from: string, to: string) =>
    (Date.parse(to) - Date.parse(from)) / MS_PER_DAY;
  const middle = (values: number[]) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  return Object.fromEntries(
    CLASSES.map((c) => {
      const mine = issues.filter((i) => i.issueClass === c);
      const open = mine.filter((i) => !i.closedAt);
      const ages = open.map(
        (i) => (now.getTime() - Date.parse(i.createdAt)) / MS_PER_DAY
      );
      const closedRecently = mine.filter(
        (i) => i.closedAt && Date.parse(i.closedAt) >= since
      );
      const resolved = closedRecently.filter(
        (i) => i.evidence !== 'withdrawn' && i.evidence !== 'duplicate'
      );
      return [
        c,
        {
          total: mine.length,
          open: open.length,
          oldest_open_days: ages.length ? Math.max(...ages) : null,
          median_open_age_days: middle(ages),
          over_limit: ages.filter((age) => age > limits[c]).length,
          limit_days: limits[c],
          window_days: windowDays,
          opened_recent: mine.filter((i) => Date.parse(i.createdAt) >= since)
            .length,
          closed_recent: closedRecently.length,
          closed_recent_by_agents: closedRecently.filter(
            (i) => i.closer === 'agent'
          ).length,
          closed_recent_with_fix: closedRecently.filter(
            (i) => i.evidence === 'fix_referenced'
          ).length,
          median_days_to_resolve: middle(
            resolved.map((i) => days(i.createdAt, i.closedAt!))
          ),
          resolved_within_limit: resolved.filter(
            (i) => days(i.createdAt, i.closedAt!) <= limits[c]
          ).length,
          resolved_recent: resolved.length,
        },
      ];
    })
  );
}

/** What agents have filed and resolved, and how their closures held up. */
export function agentRecord(issues: Issue[]) {
  const resolved = issues.filter((i) => i.closedAt && i.closer === 'agent');
  return {
    opened: issues.filter((i) => i.opener === 'agent').length,
    opened_still_open: issues.filter((i) => i.opener === 'agent' && !i.closedAt)
      .length,
    resolved: resolved.length,
    resolved_with_fix: resolved.filter((i) => i.evidence === 'fix_referenced')
      .length,
    resolved_reopened: issues.filter((i) => i.closer === 'agent' && i.reopened)
      .length,
  };
}
