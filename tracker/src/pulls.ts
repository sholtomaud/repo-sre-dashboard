/**
 * The repository's pull requests: who wrote each (an AI agent, a person
 * working with an agent, or a person alone) and what became of it.
 *
 * Most agent work arrives as pull requests rather than issue closures, and
 * much of it through people's accounts, so authorship is read three ways:
 * an agent or bot account; an agent's `Co-Authored-By` trailer on a commit;
 * or an agent's signature in the description, such as "Generated with
 * Claude Code". Agents working through a person's account with no trailer
 * or signature are invisible, so the agent counts are a lower bound.
 */
import type { GitHubClient } from './github.ts';
import {
  ORIGINS,
  agentInCommitAuthor,
  agentInSignature,
  agentInTrailers,
  classifyOrigin,
  type CommitAuthor,
  type Origin,
} from './agents.ts';

export {
  ORIGINS,
  agentInCommitAuthor,
  agentInSignature,
  agentInTrailers,
  classifyOrigin,
  type CommitAuthor,
  type Origin,
};

export interface PullRequest {
  number: number;
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  origin: Origin;
  /** The agent named, when known: "Claude", "Copilot". */
  agent: string | null;
  /** The branch it targets; `null` when not known. */
  base?: string | null;
  /** A revert or hotfix: a change that repairs an earlier one. */
  repair?: boolean;
}

/** A pull request that undoes or hot-fixes an earlier change. */
export function isRepair(title: string, labels: string[]): boolean {
  return (
    /^\s*(revert\b|hot-?fix\b)/i.test(title) ||
    labels.some((l) => /^(revert|hot-?fix|rollback)$/i.test(l.trim()))
  );
}

const PULLS_QUERY = `
query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: 50, after: $cursor, orderBy: {field: CREATED_AT, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title createdAt mergedAt closedAt body baseRefName
        labels(first: 10) { nodes { name } }
        author { login __typename }
        commits(last: 25) { nodes { commit { message author { name email } } } }
        mergeCommit { message author { name email } }
      }
    }
  }
}`;

interface PullNode {
  number: number;
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  body: string | null;
  title?: string | null;
  baseRefName?: string | null;
  labels?: { nodes: { name: string }[] } | null;
  author: { login: string; __typename: string } | null;
  commits: {
    nodes: { commit: { message: string; author?: CommitAuthor | null } }[];
  };
  mergeCommit?: {
    message?: string | null;
    author?: CommitAuthor | null;
  } | null;
}

/**
 * Every pull request, with routine dependency and CI bots left out: they
 * are automation, not agents writing code.
 */
export async function fetchPulls(
  client: GitHubClient,
  repository: string,
  agentLogins: string[] = []
): Promise<PullRequest[]> {
  const [owner, name] = repository.split('/');
  const pulls: PullRequest[] = [];
  let cursor: string | null = null;
  for (;;) {
    const data: {
      repository: {
        pullRequests: {
          pageInfo: { hasNextPage: boolean; endCursor: string };
          nodes: PullNode[];
        };
      };
    } = await client.graphql(PULLS_QUERY, { owner, name, cursor });
    const page = data.repository.pullRequests;
    for (const node of page.nodes) {
      const commitMessages = node.commits.nodes.map((c) => c.commit.message);
      const commitAuthors: (CommitAuthor | null | undefined)[] =
        node.commits.nodes.map((c) => c.commit.author);
      if (node.mergeCommit?.message) {
        commitMessages.push(node.mergeCommit.message);
      }
      if (node.mergeCommit?.author) {
        commitAuthors.push(node.mergeCommit.author);
      }
      const { origin, agent, routine } = classifyOrigin(
        node.author?.login ?? null,
        node.author?.__typename ?? null,
        node.body ?? '',
        commitMessages,
        agentLogins,
        commitAuthors
      );
      if (routine) continue;
      pulls.push({
        number: node.number,
        createdAt: node.createdAt,
        mergedAt: node.mergedAt,
        closedAt: node.closedAt,
        origin,
        agent,
        base: node.baseRefName ?? null,
        repair: isRepair(
          node.title ?? '',
          node.labels?.nodes.map((l) => l.name) ?? []
        ),
      });
    }
    if (!page.pageInfo.hasNextPage) return pulls;
    cursor = page.pageInfo.endCursor;
  }
}

export const PULL_FIELDS = [
  'date',
  ...ORIGINS.flatMap((o) => [
    `${o}_opened`,
    `${o}_merged`,
    `${o}_closed_unmerged`,
  ]),
] as const;

const MS_PER_DAY = 86_400_000;
const day = (t: string) => t.slice(0, 10);

/** Running totals for each UTC day, by origin. */
export function pullRows(pulls: PullRequest[], today: string) {
  const start = pulls.length
    ? pulls.map((p) => day(p.createdAt)).sort()[0]
    : today;
  const rows: Record<string, string | number>[] = [];
  for (let t = Date.parse(start); t <= Date.parse(today); t += MS_PER_DAY) {
    const date = new Date(t).toISOString().slice(0, 10);
    const row: Record<string, string | number> = { date };
    for (const o of ORIGINS) {
      const mine = pulls.filter(
        (p) => p.origin === o && day(p.createdAt) <= date
      );
      row[`${o}_opened`] = mine.length;
      row[`${o}_merged`] = mine.filter(
        (p) => p.mergedAt && day(p.mergedAt) <= date
      ).length;
      row[`${o}_closed_unmerged`] = mine.filter(
        (p) => !p.mergedAt && p.closedAt && day(p.closedAt) <= date
      ).length;
    }
    rows.push(row);
  }
  return rows;
}

/** The last `windowDays` days of pull requests, by origin, for status.json. */
export function pullSummary(pulls: PullRequest[], now: Date, windowDays = 30) {
  const since = now.getTime() - windowDays * MS_PER_DAY;
  const recent = pulls.filter((p) => Date.parse(p.createdAt) >= since);
  const median = (values: number[]) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const byOrigin = Object.fromEntries(
    ORIGINS.map((o) => {
      const mine = recent.filter((p) => p.origin === o);
      const merged = mine.filter((p) => p.mergedAt);
      const decided = mine.filter((p) => p.mergedAt || p.closedAt);
      return [
        o,
        {
          opened: mine.length,
          merged: merged.length,
          closed_unmerged: decided.length - merged.length,
          still_open: mine.length - decided.length,
          merge_rate: decided.length ? merged.length / decided.length : null,
          median_hours_to_merge: median(
            merged.map(
              (p) =>
                (Date.parse(p.mergedAt!) - Date.parse(p.createdAt)) / 3_600_000
            )
          ),
        },
      ];
    })
  );
  const agents: Record<string, number> = {};
  for (const p of recent) {
    if (p.agent) agents[p.agent] = (agents[p.agent] ?? 0) + 1;
  }
  return {
    window_days: windowDays,
    total: pulls.length,
    by_origin: byOrigin,
    agents,
  };
}
