/**
 * What the repository is and how it is set up, read through the API: its
 * languages and files, the workflows that guard it, the rules on its default
 * branch, and the CI runs, releases and deployments that delivery metrics
 * need. Each read that the token is not allowed to make is recorded, so the
 * dashboard can say which permission would let it measure more.
 */
import type { GitHubClient } from './github.ts';

const MS_PER_DAY = 86_400_000;

/** A read that failed for want of a permission, and the permission. */
export interface Denied {
  what: string;
  permission: string;
}

/** Runs `read`; on HTTP 403 records the permission and gives `fallback`. */
async function guarded<T>(
  denied: Denied[],
  what: string,
  permission: string,
  fallback: T,
  read: () => Promise<T>
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (/HTTP 403/.test(String(error))) {
      denied.push({ what, permission });
      return fallback;
    }
    // Anything else (a GitHub Enterprise without the endpoint, a timeout)
    // leaves the figure unknown without failing the run.
    console.warn(`${what}: ${(error as Error).message}`);
    return fallback;
  }
}

/** Files whose presence the setup checks look for, by purpose. */
export const KEY_FILES = {
  readme: /^(readme)(\.\w+)?$/i,
  license: /^(licen[cs]e|copying)(\.\w+)?$/i,
  contributing: /^(\.github\/|docs\/)?contributing(\.\w+)?$/i,
  security: /^(\.github\/|docs\/)?security(\.\w+)?$/i,
  codeowners: /^(\.github\/|docs\/)?codeowners$/i,
  dependencyUpdates:
    /^(\.github\/dependabot\.ya?ml|renovate\.json5?|\.renovaterc(\.json)?|\.github\/renovate\.json5?)$/i,
  pullTemplate:
    /^(\.github\/|docs\/)?pull_request_template(\.md)?$|^\.github\/pull_request_template\//i,
  socket: /^socket\.ya?ml$/i,
  agentInstructions:
    /^(agents\.md|claude\.md|\.github\/copilot-instructions\.md|\.cursorrules|\.cursor\/rules\/.+|gemini\.md|\.windsurfrules|\.clinerules)$/i,
} as const;
export type KeyFile = keyof typeof KEY_FILES;

/** Paths that look like tests. */
export const TEST_PATH =
  /(^|\/)(tests?|__tests__|specs?|e2e)\/|\.(test|spec)\.[cm]?[jt]sx?$|_test\.(go|py|rb|exs?)$|(^|\/)test_[^/]+\.py$|Tests?\.(cs|java|kt|swift)$|_spec\.rb$/i;

/** Paths that are not the project's own code. */
const VENDORED = /(^|\/)(node_modules|vendor|third_party|dist|build|\.git)\//i;

/** Lock files: builds are reproducible. */
const LOCKFILE =
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|poetry\.lock|uv\.lock|Pipfile\.lock|Cargo\.lock|go\.sum|Gemfile\.lock|composer\.lock|packages\.lock\.json|gradle\.lockfile|mix\.lock|pubspec\.lock)$/;

/** Commands that run a test suite, in a workflow file. */
export const TEST_COMMAND =
  /\b(npm (run )?test|npm run (test|e2e|check)|pnpm (run )?test|yarn test|bun test|node --test|npx (jest|vitest|playwright test|mocha)|vitest|jest|pytest|tox|nox|python -m (pytest|unittest)|go test|cargo (test|nextest)|mvn\b.*\b(test|verify)|gradlew?\b.*\b(test|check|build)|dotnet test|rspec|rake test|bundle exec rake|phpunit|mix test|swift test|xcodebuild test|ctest|make (test|check))\b/i;

/** Package ecosystems, by the manifest files that mark them (Dependabot's names). */
export const ECOSYSTEMS: [string, RegExp][] = [
  ['npm', /(^|\/)package\.json$/],
  ['pip', /(^|\/)(requirements[^/]*\.txt|pyproject\.toml|setup\.py|Pipfile)$/],
  ['gomod', /(^|\/)go\.mod$/],
  ['cargo', /(^|\/)Cargo\.toml$/],
  ['maven', /(^|\/)pom\.xml$/],
  ['gradle', /(^|\/)build\.gradle(\.kts)?$/],
  ['bundler', /(^|\/)Gemfile$/],
  ['composer', /(^|\/)composer\.json$/],
  ['nuget', /\.(cs|fs)proj$/],
  ['docker', /(^|\/)Dockerfile$/],
];

export interface WorkflowFile {
  path: string;
  name: string;
  onPullRequest: boolean;
  onPush: boolean;
  runsTests: boolean;
  /**
   * The checks its test jobs report, as GitHub names them: the job's
   * `name:`, or its id when it has none.
   */
  testJobs: string[];
  /** Test jobs whose check name depends on a matrix or an expression. */
  unresolvedTestJobs: number;
  /** Actions it uses, without versions: "actions/checkout". */
  uses: string[];
  /** Actions pinned to a tag or branch rather than a full commit SHA. */
  unpinned: number;
  /** Declares its token permissions. */
  permissions: boolean;
}

/**
 * The jobs that run tests, by the name their status check reports under.
 * A job named with an expression, or run over a matrix, reports under names
 * only known at run time, so it is counted rather than guessed.
 */
function testJobs(text: string): {
  testJobs: string[];
  unresolvedTestJobs: number;
} {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^jobs:\s*(#.*)?$/.test(l));
  const found = { testJobs: [] as string[], unresolvedTestJobs: 0 };
  if (start < 0) return found;
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line) && !line.startsWith('#')) break;
    body.push(line);
  }
  const indent = /^(\s+)\S/.exec(body.find((l) => l.trim()) ?? '')?.[1];
  if (!indent) return found;
  const jobStart = new RegExp(`^${indent}([A-Za-z_][\\w-]*):\\s*(#.*)?$`);
  const jobs: { id: string; lines: string[] }[] = [];
  for (const line of body) {
    const id = jobStart.exec(line)?.[1];
    if (id) jobs.push({ id, lines: [] });
    else jobs.at(-1)?.lines.push(line);
  }
  for (const job of jobs) {
    const text = job.lines.join('\n');
    if (!TEST_COMMAND.test(text)) continue;
    const own = /^(\s+)\S/.exec(job.lines.find((l) => l.trim()) ?? '')?.[1];
    const name = own
      ? new RegExp(`^${own}name:\\s*(.+?)\\s*$`, 'm')
          .exec(text)?.[1]
          ?.replace(/^(['"])(.*)\1$/, '$2')
      : undefined;
    const matrix = own ? new RegExp(`^${own}strategy:`, 'm').test(text) : false;
    if (matrix || name?.includes('${{')) found.unresolvedTestJobs++;
    else found.testJobs.push(name ?? job.id);
  }
  return found;
}

/** What a workflow file triggers on and whether it runs tests. */
export function readWorkflow(path: string, text: string): WorkflowFile {
  const name = /^name:\s*['"]?(.+?)['"]?\s*$/m.exec(text)?.[1] ?? path;
  // The trigger block: `on:` to the next top-level key.
  const on =
    /^(?:on|'on'|"on"|true):(.*(?:\n(?:[ \t].*|\s*))*)/m.exec(text)?.[1] ?? '';
  return {
    path,
    name,
    onPullRequest: /\b(pull_request|pull_request_target|merge_group)\b/.test(
      on
    ),
    onPush: /\bpush\b/.test(on),
    runsTests: TEST_COMMAND.test(text),
    ...testJobs(text),
    uses: [
      ...new Set(
        [
          ...text.matchAll(
            /^\s*-?\s*uses:\s*['"]?([^@\s'"]+)@?(\S*?)['"]?\s*(#.*)?$/gm
          ),
        ].map((m) => m[1].toLowerCase())
      ),
    ],
    unpinned: [
      ...text.matchAll(/^\s*-?\s*uses:\s*['"]?([^@\s'"]+)@([^\s'"#]+)/gm),
    ].filter((m) => !m[1].startsWith('./') && !/^[0-9a-f]{40}$/.test(m[2]))
      .length,
    permissions: /^permissions:/m.test(text),
  };
}

export interface CiRun {
  workflow: string;
  path: string;
  conclusion: string | null;
  createdAt: string;
  startedAt: string;
  updatedAt: string;
}

/** CI on the default branch over the window. */
export function ciHealth(runs: CiRun[], now: Date, windowDays = 30) {
  const since = now.getTime() - windowDays * MS_PER_DAY;
  const recent = runs
    .filter((r) => Date.parse(r.createdAt) >= since)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const judged = recent.filter(
    (r) => r.conclusion === 'success' || r.conclusion === 'failure'
  );
  const failed = judged.filter((r) => r.conclusion === 'failure');
  const minutes = judged
    .map((r) => (Date.parse(r.updatedAt) - Date.parse(r.startedAt)) / 60_000)
    .filter((m) => m >= 0);

  // Time to green: from a workflow's first failure to its next success.
  const restore: number[] = [];
  const failing: string[] = [];
  const byWorkflow = new Map<string, CiRun[]>();
  for (const run of judged) {
    byWorkflow.set(run.path, [...(byWorkflow.get(run.path) ?? []), run]);
  }
  for (const list of byWorkflow.values()) {
    let brokeAt: string | null = null;
    for (const run of list) {
      if (run.conclusion === 'failure') brokeAt ??= run.updatedAt;
      else if (brokeAt) {
        restore.push(
          (Date.parse(run.updatedAt) - Date.parse(brokeAt)) / 3_600_000
        );
        brokeAt = null;
      }
    }
    if (brokeAt) failing.push(list[list.length - 1].workflow);
  }
  return {
    window_days: windowDays,
    runs: judged.length,
    failed: failed.length,
    success_rate: judged.length ? 1 - failed.length / judged.length : null,
    median_minutes: median(minutes),
    median_hours_to_green: median(restore),
    failing_now: failing,
  };
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface Profile {
  description: string | null;
  defaultBranch: string;
  createdAt: string | null;
  pushedAt: string | null;
  visibility: string;
  stars: number;
  forks: number;
  archived: boolean;
  license: string | null;
  topics: string[];
  languages: Record<string, number>;
  files: number;
  testFiles: number;
  /** Files truncated: the repository has more than the API lists at once. */
  truncated: boolean;
  keyFiles: Record<KeyFile, string | null>;
  lockfiles: string[];
  /** Package ecosystems found, one entry per folder with a manifest. */
  ecosystems: { name: string; directory: string }[];
  issueTemplates: string[] | null;
  workflows: WorkflowFile[];
  branch: {
    protected: boolean | null;
    requiresReview: boolean | null;
    requiresChecks: boolean | null;
  };
  /** CI runs on the default branch, newest first. */
  ciRuns: CiRun[];
  releases: { tag: string; publishedAt: string; prerelease: boolean }[];
  deployments: {
    environment: string;
    createdAt: string;
    state: string | null;
  }[];
  /** The repository's labels, by name. */
  labels: string[];
  /** Instruction files for coding agents, with their text. */
  agentDocs: { path: string; text: string }[];
  /** Reads the token could not make. */
  denied: Denied[];
}

/** Files coding agents read before they work, in the order they are judged. */
export const AGENT_DOCS =
  /^(agents\.md|claude\.md|\.claude\/claude\.md|\.github\/copilot-instructions\.md|gemini\.md|\.cursorrules)$/i;

/** What a good instruction file for coding agents covers. */
export const AGENT_DOC_TOPICS: { id: string; name: string; pattern: RegExp }[] =
  [
    {
      id: 'build-test',
      name: 'how to build and test',
      pattern:
        /^#+\s*(build|test|commands|development|setup)|\b(npm|pnpm|yarn|bun) (run )?test\b|\bpytest\b|\bgo test\b|\bcargo test\b|\bmake test\b|\bgradlew? test\b|\bmvn\b.*\btest/im,
    },
    {
      id: 'tdd',
      name: 'test-driven development',
      pattern:
        /\bTDD\b|test[- ]driven|failing test first|write (a |the )?(failing )?tests? first|red[,/ -]+green/i,
    },
    {
      id: 'issues',
      name: 'how to raise issues',
      pattern:
        /^#+\s*(raising|filing|reporting|opening|writing)\s+issues|\bissue forms?\b/im,
    },
    {
      id: 'changes',
      name: 'commit and pull request rules',
      pattern:
        /conventional commits?|\bfixes #|^#+\s*(commits?|pull requests?)/im,
    },
    {
      id: 'safety',
      name: 'security and secrets',
      pattern: /\bsecrets?\b|\bcredentials?\b|\bsecurity\b/i,
    },
    {
      id: 'attribution',
      name: 'attributing agent work',
      pattern: /co-authored-by/i,
    },
  ];

interface RepoResponse {
  description: string | null;
  default_branch: string;
  created_at: string;
  pushed_at: string;
  visibility?: string;
  private: boolean;
  stargazers_count: number;
  forks_count: number;
  archived: boolean;
  license: { spdx_id: string | null; name: string } | null;
  topics?: string[];
}

/**
 * Reads the repository's profile. `selfWorkflow` is the path of the
 * workflow running this Action, left out of CI figures.
 */
export async function readProfile(
  client: GitHubClient,
  repository: string,
  now: Date,
  selfWorkflow: string | null = null,
  windowDays = 90
): Promise<Profile> {
  const denied: Denied[] = [];
  const base = `/repos/${repository}`;
  const repo = await client.rest<RepoResponse>(base);
  if (!repo) throw new Error(`Repository ${repository} not found`);
  const branch = repo.default_branch;

  const [languages, tree, branchInfo, rules] = await Promise.all([
    guarded(
      denied,
      'languages',
      'contents: read',
      {},
      async () =>
        (await client.rest<Record<string, number>>(`${base}/languages`)) ?? {}
    ),
    guarded(denied, 'files', 'contents: read', null, () =>
      client.rest<{
        tree: { path: string; type: string }[];
        truncated: boolean;
      }>(`${base}/git/trees/${encodeURIComponent(branch)}?recursive=1`)
    ),
    guarded(denied, 'branch protection', 'contents: read', null, () =>
      client.rest<{ protected: boolean }>(
        `${base}/branches/${encodeURIComponent(branch)}`
      )
    ),
    guarded(denied, 'branch rules', 'contents: read', null, () =>
      client.rest<{ type: string; parameters?: Record<string, unknown> }[]>(
        `${base}/rules/branches/${encodeURIComponent(branch)}`
      )
    ),
  ]);

  const paths = (tree?.tree ?? [])
    .filter((e) => e.type === 'blob')
    .map((e) => e.path);
  const own = paths.filter((p) => !VENDORED.test(p));
  const keyFiles = Object.fromEntries(
    (Object.keys(KEY_FILES) as KeyFile[]).map((k) => [
      k,
      paths.find((p) => KEY_FILES[k].test(p)) ?? null,
    ])
  ) as Record<KeyFile, string | null>;

  const templates = paths
    .filter((p) => p.toLowerCase().startsWith('.github/issue_template/'))
    .map((p) => p.slice('.github/issue_template/'.length));

  // Read up to 20 workflow files to see what they do.
  const workflowPaths = paths
    .filter((p) => /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(p))
    .slice(0, 20);
  const workflows = (
    await Promise.all(
      workflowPaths.map((path) =>
        guarded(denied, 'workflow files', 'contents: read', null, async () => {
          const file = await client.rest<{ content: string }>(
            `${base}/contents/${path}?ref=${encodeURIComponent(branch)}`
          );
          return file
            ? readWorkflow(
                path,
                Buffer.from(file.content, 'base64').toString('utf8')
              )
            : null;
        })
      )
    )
  ).filter((w): w is WorkflowFile => w !== null);

  // Instruction files for agents: read, so the audit can judge what they say.
  const agentDocs = (
    await Promise.all(
      paths
        .filter((p) => AGENT_DOCS.test(p))
        .slice(0, 6)
        .map((path) =>
          guarded(
            denied,
            'agent instructions',
            'contents: read',
            null,
            async () => {
              const file = await client.rest<{ content: string }>(
                `${base}/contents/${path}?ref=${encodeURIComponent(branch)}`
              );
              return file
                ? {
                    path,
                    text: Buffer.from(file.content, 'base64')
                      .toString('utf8')
                      .slice(0, 100_000),
                  }
                : null;
            }
          )
        )
    )
  ).filter((d): d is { path: string; text: string } => d !== null);

  const labels = await guarded(denied, 'labels', 'issues: read', [], async () =>
    (await client.restAll<{ name: string }>(`${base}/labels`, 300)).map(
      (l) => l.name
    )
  );

  const since = new Date(now.getTime() - windowDays * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
  const runs = await guarded(denied, 'CI runs', 'actions: read', [], () =>
    client
      .rest<{
        workflow_runs: {
          name: string;
          path: string;
          conclusion: string | null;
          created_at: string;
          run_started_at?: string;
          updated_at: string;
          event: string;
        }[];
      }>(
        `${base}/actions/runs?branch=${encodeURIComponent(branch)}&event=push&per_page=100&created=%3E%3D${since}`
      )
      .then((r) => r?.workflow_runs ?? [])
  );
  const ciRuns: CiRun[] = runs
    .filter((r) => !selfWorkflow || !r.path.startsWith(selfWorkflow))
    .map((r) => ({
      workflow: r.name,
      path: r.path.replace(/@.*$/, ''),
      conclusion: r.conclusion,
      createdAt: r.created_at,
      startedAt: r.run_started_at ?? r.created_at,
      updatedAt: r.updated_at,
    }));

  const releases = await guarded(denied, 'releases', 'contents: read', [], () =>
    client.restAll<{
      tag_name: string;
      published_at: string | null;
      draft: boolean;
      prerelease: boolean;
    }>(`${base}/releases`, 200)
  );

  // Deployments, leaving out GitHub Pages: publishing this dashboard is a
  // Pages deployment, and would otherwise count as a delivery.
  const deploymentList = await guarded(
    denied,
    'deployments',
    'deployments: read',
    [],
    () =>
      client.restAll<{
        id: number;
        environment: string;
        created_at: string;
      }>(`${base}/deployments`, 200)
  );
  const productDeployments = deploymentList.filter(
    (d) =>
      !/^github-pages$/i.test(d.environment) &&
      Date.parse(d.created_at) >= Date.parse(since)
  );
  const deployments = await Promise.all(
    productDeployments.slice(0, 60).map(async (d) => {
      const statuses = await guarded(
        denied,
        'deployment statuses',
        'deployments: read',
        null,
        () =>
          client.rest<{ state: string }[]>(
            `${base}/deployments/${d.id}/statuses?per_page=1`
          )
      );
      return {
        environment: d.environment,
        createdAt: d.created_at,
        state: statuses?.[0]?.state ?? null,
      };
    })
  );

  const ruleTypes = rules?.map((r) => r.type) ?? [];
  const reviewRule = rules?.find((r) => r.type === 'pull_request');
  const reviews = Number(
    reviewRule?.parameters?.required_approving_review_count ?? 0
  );

  return {
    description: repo.description,
    defaultBranch: branch,
    createdAt: repo.created_at,
    pushedAt: repo.pushed_at,
    visibility: repo.visibility ?? (repo.private ? 'private' : 'public'),
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    archived: repo.archived,
    license: repo.license?.spdx_id ?? repo.license?.name ?? null,
    topics: repo.topics ?? [],
    languages,
    files: own.length,
    testFiles: own.filter((p) => TEST_PATH.test(p)).length,
    truncated: tree?.truncated ?? false,
    keyFiles,
    lockfiles: own.filter((p) => LOCKFILE.test(p)),
    // Every folder with a manifest, shallowest first, up to 10 per
    // ecosystem: Dependabot needs an entry for each.
    ecosystems: ECOSYSTEMS.flatMap(([name, pattern]) =>
      [
        ...new Set(
          own
            .filter(
              (p) =>
                pattern.test(p) &&
                !/(^|\/)(fixtures?|examples?|samples?)\//i.test(p)
            )
            .map((p) => '/' + p.split('/').slice(0, -1).join('/'))
        ),
      ]
        .sort(
          (a, b) =>
            a.split('/').length - b.split('/').length || a.localeCompare(b)
        )
        .slice(0, 10)
        .map((directory) => ({ name, directory }))
    ),
    issueTemplates: templates.length ? templates : null,
    workflows,
    branch: {
      protected:
        branchInfo === null && rules === null
          ? null
          : (branchInfo?.protected ?? false) || ruleTypes.length > 0,
      // Rulesets say what they require; classic protection is only readable
      // by admins, so it stays unknown.
      requiresReview: reviewRule ? reviews >= 1 : rules ? false : null,
      requiresChecks: rules
        ? ruleTypes.includes('required_status_checks')
        : null,
    },
    ciRuns,
    releases: releases
      .filter((r) => !r.draft && r.published_at)
      .map((r) => ({
        tag: r.tag_name,
        publishedAt: r.published_at!,
        prerelease: r.prerelease,
      })),
    deployments,
    labels,
    agentDocs,
    denied: dedupe(denied),
  };
}

function dedupe(denied: Denied[]): Denied[] {
  const seen = new Set<string>();
  return denied.filter((d) => {
    const key = `${d.what}|${d.permission}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The profile as written to status.json. */
export function profileSummary(profile: Profile) {
  const total = Object.values(profile.languages).reduce((s, n) => s + n, 0);
  return {
    description: profile.description,
    default_branch: profile.defaultBranch,
    created_at: profile.createdAt,
    pushed_at: profile.pushedAt,
    visibility: profile.visibility,
    stars: profile.stars,
    forks: profile.forks,
    archived: profile.archived,
    license: profile.license,
    topics: profile.topics,
    languages: Object.entries(profile.languages)
      .sort((a, b) => b[1] - a[1])
      .map(([name, bytes]) => ({
        name,
        share: total ? bytes / total : 0,
      })),
    files: profile.files,
    test_files: profile.testFiles,
    files_truncated: profile.truncated,
    key_files: profile.keyFiles,
    lockfiles: profile.lockfiles.length,
    ecosystems: [...new Set(profile.ecosystems.map((e) => e.name))],
    workflows: profile.workflows.map((w) => ({
      name: w.name,
      path: w.path,
      on_pull_request: w.onPullRequest,
      runs_tests: w.runsTests,
      uses: w.uses,
      unpinned: w.unpinned,
      permissions: w.permissions,
    })),
    branch: {
      protected: profile.branch.protected,
      requires_review: profile.branch.requiresReview,
      requires_checks: profile.branch.requiresChecks,
    },
    labels: profile.labels.length,
    agent_docs: profile.agentDocs.map((d) => ({
      path: d.path,
      covers: AGENT_DOC_TOPICS.filter((t) => t.pattern.test(d.text)).map(
        (t) => t.id
      ),
    })),
    denied: profile.denied,
  };
}
