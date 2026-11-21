import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '../src/github.ts';
import { describeCron, findCron } from '../src/schedule.ts';
import {
  agentRecord,
  classStatus,
  classifyClass,
  classifyEvidence,
  classifyKind,
  DEFAULT_LIMITS,
  dailyRows,
  firstResponse,
  isAgent,
  issueSummary,
  responseTimes,
  toIssue,
  type Issue,
} from '../src/issues.ts';
import { auditScore, runAudit } from '../src/audit.ts';
import {
  ciHealth,
  hasDependencyCooldown,
  readWorkflow,
  type Profile,
} from '../src/repo.ts';
import {
  deliveryMetrics,
  frequencyBand,
  leadTimeBand,
} from '../src/delivery.ts';
import { isRepair } from '../src/pulls.ts';
import { isAutomationAuthor } from '../src/queue.ts';
import {
  agentInSignature,
  agentInTrailers,
  classifyOrigin,
  pullRows,
  pullSummary,
  type PullRequest,
} from '../src/pulls.ts';
import { readCsv, writeCsv } from '../src/csv.ts';
import { costInputs } from '../src/cost.ts';

test('the schedule is described from the cron line', () => {
  assert.equal(
    findCron("on:\n  schedule:\n    - cron: '5 */6 * * *'\n"),
    '5 */6 * * *'
  );
  assert.equal(findCron('on: push'), null);
  const six = describeCron('5 */6 * * *');
  assert.equal(six.description, 'every 6 hours');
  assert.deepEqual(six.runTimesUtc, ['00:05', '06:05', '12:05', '18:05']);
  assert.equal(describeCron('0 0 * * *').description, 'daily');
  assert.equal(describeCron('0 * * * *').description, 'every hour');
  assert.equal(describeCron('*/30 * * * *').description, 'every 30 minutes');
  assert.equal(describeCron('0 6,7,20 * * *').description, '3 times a day');
  assert.equal(describeCron('0 0 * * 1').runsPerDay, 0);
});

test('agents are recognised by account type and login', () => {
  assert.ok(isAgent('github-actions[bot]', 'Bot'));
  assert.ok(isAgent('copilot-swe-agent', 'User'));
  assert.ok(isAgent('IssueFixerAgent', 'User'));
  assert.ok(isAgent('ada', 'User', ['Ada']));
  assert.ok(!isAgent('ada', 'User'));
  assert.ok(!isAgent(null, null));
  assert.ok(isAutomationAuthor('IssueFixerAgent', 'aws-emulator@amazon.com'));
  assert.ok(
    isAutomationAuthor('dependabot[bot]', 'x@users.noreply.github.com')
  );
  assert.ok(!isAutomationAuthor('Ada Lovelace', 'ada@example.com'));
});

test('issue kinds come from labels, then form headings', () => {
  assert.equal(classifyKind('', ['bug']), 'behavior');
  assert.equal(classifyKind('### What happened\n\nIt broke', []), 'behavior');
  assert.equal(classifyKind('**Describe the bug**\n', []), 'other');
  assert.equal(classifyKind('## Describe the bug\nx', []), 'behavior');
  assert.equal(classifyKind('### Use case\n', []), 'feature');
  assert.equal(classifyKind('### What happened', ['enhancement']), 'feature');
  assert.equal(classifyKind('Is the code conscious?', []), 'other');
});

test('closure evidence follows what GitHub records', () => {
  const evidence = (
    reason = 'COMPLETED',
    closer: string | null = null,
    merged: boolean | null = null,
    by = 'maintainer',
    comments: { author: string; body: string }[] = []
  ) => classifyEvidence(reason, closer, merged, by, 'reporter', comments);
  assert.equal(evidence('COMPLETED', 'Commit'), 'fix_referenced');
  assert.equal(evidence('COMPLETED', 'PullRequest', true), 'fix_referenced');
  assert.equal(evidence('COMPLETED', 'PullRequest', false), 'no_reference');
  assert.equal(
    evidence('COMPLETED', null, null, 'm', [
      { author: 'm', body: 'Fixed in 3fe364395b32' },
    ]),
    'fix_referenced'
  );
  assert.equal(
    evidence('COMPLETED', null, null, 'm', [
      { author: 'm', body: 'Resolved in v1.2.0.' },
    ]),
    'fix_referenced'
  );
  assert.equal(
    evidence('COMPLETED', null, null, 'm', [
      { author: 'reporter', body: 'fixed in abc1234?' },
    ]),
    'no_reference'
  );
  assert.equal(
    evidence('COMPLETED', null, null, 'm', [
      { author: 'm', body: 'Account 1234567890' },
    ]),
    'no_reference'
  );
  assert.equal(evidence('DUPLICATE', 'Commit'), 'duplicate');
  assert.equal(evidence('NOT_PLANNED'), 'declined');
  assert.equal(evidence('COMPLETED', null, null, 'reporter'), 'withdrawn');
});

test('first response is the first comment or closure by someone else', () => {
  const comments = [
    { author: 'reporter', createdAt: '2026-11-01T01:00:00Z' },
    { author: 'github-actions[bot]', createdAt: '2026-11-01T02:00:00Z' },
    { author: 'maintainer', createdAt: '2026-11-01T05:00:00Z' },
  ];
  assert.equal(
    firstResponse('reporter', comments, null, null),
    '2026-11-01T05:00:00Z'
  );
  assert.equal(
    firstResponse('reporter', comments, '2026-11-01T03:00:00Z', 'maintainer'),
    '2026-11-01T03:00:00Z'
  );
  assert.equal(
    firstResponse(
      'reporter',
      comments.slice(0, 2),
      '2026-11-01T03:00:00Z',
      'reporter'
    ),
    null
  );
});

const issue = (overrides: Partial<Issue>): Issue => ({
  number: 1,
  createdAt: '2026-11-01T00:00:00Z',
  closedAt: null,
  closer: null,
  evidence: null,
  kind: 'behavior',
  labelled: false,
  reopened: false,
  firstResponseAt: null,
  opener: 'human',
  issueClass: 'bug',
  ...overrides,
});

test('daily rows are running totals', () => {
  const rows = dailyRows(
    [
      issue({}),
      issue({
        closedAt: '2026-11-02T10:00:00Z',
        closer: 'human',
        evidence: 'no_reference',
      }),
      issue({
        createdAt: '2026-11-02T00:00:00Z',
        closedAt: '2026-11-03T00:00:00Z',
        closer: 'agent',
        evidence: 'fix_referenced',
        kind: 'feature',
      }),
    ],
    '2026-11-03'
  );
  assert.deepEqual(
    rows.map((r) => r.open),
    [0, 2, 2, 1]
  );
  assert.equal(rows[3].agent_closed, 1);
  assert.equal(rows[3].human_closed, 1);
  assert.equal(rows[3].closed_fix_referenced, 1);
  assert.equal(rows[3].behavior_created, 2);
  assert.equal(rows[3].behavior_closed, 1);
});

test('response times cover recent issues', () => {
  const now = new Date('2026-11-30T00:00:00Z');
  const times = responseTimes(
    [
      issue({
        createdAt: '2026-11-20T00:00:00Z',
        firstResponseAt: '2026-11-20T02:00:00Z',
        closedAt: '2026-11-21T00:00:00Z',
        evidence: 'fix_referenced',
      }),
      issue({
        createdAt: '2026-11-21T00:00:00Z',
        firstResponseAt: '2026-11-21T10:00:00Z',
      }),
      issue({ createdAt: '2026-11-22T00:00:00Z' }),
      issue({
        createdAt: '2026-09-01T00:00:00Z',
        firstResponseAt: '2026-09-09T00:00:00Z',
      }),
    ],
    now
  );
  assert.equal(times.firstResponse.count, 2);
  assert.equal(times.firstResponse.medianHours, 10);
  assert.equal(times.resolution.medianHours, 24);
  assert.equal(times.awaitingResponse, 1);
});

test('a GraphQL issue becomes a record', () => {
  const record = toIssue({
    number: 7,
    createdAt: '2026-11-01T00:00:00Z',
    closedAt: '2026-11-02T00:00:00Z',
    stateReason: 'COMPLETED',
    body: '### What happened\n',
    author: { login: 'reporter' },
    labels: { nodes: [{ name: 'bug' }] },
    closedEvents: {
      nodes: [
        {
          actor: { login: 'copilot-swe-agent', __typename: 'Bot' },
          closer: { __typename: 'PullRequest', merged: true },
        },
      ],
    },
    reopens: { totalCount: 1 },
    firstComments: {
      nodes: [
        { author: { login: 'maintainer' }, createdAt: '2026-11-01T06:00:00Z' },
      ],
    },
    lastComments: { nodes: [] },
  });
  assert.equal(record.closer, 'agent');
  assert.equal(record.evidence, 'fix_referenced');
  assert.equal(record.kind, 'behavior');
  assert.equal(record.reopened, true);
  assert.equal(record.firstResponseAt, '2026-11-01T06:00:00Z');
});

const PROFILE: Profile = {
  description: null,
  defaultBranch: 'main',
  createdAt: null,
  pushedAt: null,
  visibility: 'public',
  stars: 0,
  forks: 0,
  archived: false,
  license: 'MIT',
  topics: [],
  languages: { TypeScript: 10 },
  files: 10,
  testFiles: 0,
  truncated: false,
  keyFiles: {
    readme: 'README.md',
    license: 'LICENSE',
    contributing: null,
    security: null,
    codeowners: null,
    dependencyUpdates: null,
    pullTemplate: null,
    socket: null,
    agentInstructions: null,
  },
  dependencyCooldown: null,
  lockfiles: ['package-lock.json'],
  ecosystems: [{ name: 'npm', directory: '/' }],
  issueTemplates: ['bug_report.md', 'config.yml'],
  workflows: [],
  branch: { protected: false, requiresReview: false, requiresChecks: false },
  ciRuns: [],
  releases: [],
  deployments: [],
  labels: [],
  agentDocs: [],
  denied: [],
};

const NOW = new Date('2026-11-17T00:00:00Z');

function audit(profile: Partial<Profile>, issues = issueSummary([])) {
  const full = { ...PROFILE, ...profile };
  const pulls = pullSummary([], NOW);
  const checks = runAudit({
    repository: 'owner/project',
    profile: full,
    summary: issues,
    schedule: describeCron('5 */6 * * *'),
    pulls,
    ci: ciHealth(full.ciRuns, NOW),
    delivery: deliveryMetrics(full, [], [], NOW),
    costConfigured: false,
  });
  return Object.fromEntries(checks.map((c) => [c.id, c]));
}

test('the audit grades setup and habits, with fixes to copy', () => {
  const summary = issueSummary([
    ...Array.from({ length: 12 }, (_, i) =>
      issue({ number: i, labelled: i < 3 })
    ),
    ...Array.from({ length: 6 }, (_, i) =>
      issue({
        number: 100 + i,
        closedAt: '2026-11-02T00:00:00Z',
        evidence: i < 5 ? 'fix_referenced' : 'no_reference',
        labelled: true,
      })
    ),
  ]);
  const by = audit({}, summary);
  assert.equal(by['issue-forms'].status, 'improve');
  assert.match(by['issue-forms'].evidence, /Markdown templates only/);
  assert.equal(by.labels.status, 'improve');
  assert.equal(by['linked-fixes'].status, 'pass');
  assert.equal(by['linked-fixes'].recommendation, '');
  assert.equal(by.schedule.status, 'pass');

  // A bare repository: the fixes name what to add.
  assert.equal(by['ci-on-pull-requests'].status, 'missing');
  assert.match(by['ci-on-pull-requests'].fixes[0].content, /npm test/);
  assert.equal(by['dependency-updates'].status, 'missing');
  const dependabot = by['dependency-updates'].fixes[0].content;
  assert.match(dependabot, /package-ecosystem: npm\n    directory: \//);
  assert.match(dependabot, /package-ecosystem: github-actions/);
  assert.equal(by['auto-patch'].status, 'improve');
  assert.match(by['auto-patch'].fixes[0].content, /fetch-metadata/);
  assert.equal(by['supply-chain-scanning'].status, 'missing');
  assert.match(by['code-scanning'].fixes[0].content, /javascript-typescript/);
  assert.equal(by['security-policy'].status, 'missing');
  assert.match(by['security-policy'].fixes[0].content, /owner\/project/);
  assert.equal(by['agentic-triage'].status, 'improve');
  assert.match(by['agentic-triage'].why, /never go in the dashboard/);
  assert.equal(by.cost.status, 'improve');
  assert.equal(by['project-basics'].status, 'improve');
  assert.match(by['project-basics'].evidence, /CONTRIBUTING/);

  // Nothing to judge yet: habit checks wait rather than fail.
  const empty = audit({});
  assert.equal(empty.labels.status, 'waiting');
  assert.equal(empty['linked-fixes'].status, 'waiting');
  assert.equal(empty['ci-health'].status, 'waiting');
});

test('the audit recognises tools already in place', () => {
  const ci = readWorkflow(
    '.github/workflows/ci.yml',
    `name: CI
on:
  pull_request:
  push:
permissions:
  contents: read
jobs:
  test:
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4
      - uses: github/codeql-action/init@v3
      - uses: dependabot/fetch-metadata@v2
      - run: npm test
`
  );
  assert.equal(ci.onPullRequest, true);
  assert.equal(ci.runsTests, true);
  assert.equal(ci.permissions, true);
  assert.equal(ci.unpinned, 2);
  assert.ok(ci.uses.includes('github/codeql-action/init'));

  const by = audit({
    workflows: [ci],
    testFiles: 4,
    keyFiles: {
      ...PROFILE.keyFiles,
      dependencyUpdates: '.github/dependabot.yml',
      socket: 'socket.yml',
    },
    dependencyCooldown: true,
    branch: { protected: true, requiresReview: true, requiresChecks: true },
  });
  for (const id of [
    'ci-on-pull-requests',
    'tests',
    'branch-rules',
    'dependency-updates',
    'auto-patch',
    'supply-chain-scanning',
    'code-scanning',
    'workflow-permissions',
  ]) {
    assert.equal(by[id].status, 'pass', id);
    assert.deepEqual(by[id].fixes, []);
  }
  assert.equal(by['pinned-actions'].status, 'improve');

  // A denied read is reported with the permission that fixes it.
  const denied = audit({
    denied: [{ what: 'CI runs', permission: 'actions: read' }],
  });
  assert.equal(denied['token-permissions'].status, 'missing');
  assert.match(denied['ci-health'].evidence, /actions: read/);

  const score = auditScore(Object.values(by));
  assert.ok(score.score! > auditScore(Object.values(audit({}))).score!);
  assert.equal(score.waiting, 4);
});

test('test jobs are named as GitHub reports their checks', () => {
  // A GitHub expression, kept out of the template literal below.
  const matrixOs = '${{ matrix.os }}';
  const ci = readWorkflow(
    '.github/workflows/ci.yml',
    `name: CI
on:
  pull_request:
jobs:
  tracker:
    name: Tracker and Action
    runs-on: ubuntu-latest
    steps:
      - run: npm ci
      - run: npm test
  dashboard:
    name: "Dashboard"
    runs-on: ubuntu-latest
    steps:
      - run: npx playwright test
  e2e:
    runs-on: ubuntu-latest
    steps:
      - run: go test ./...
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint
  matrix:
    name: Test (${matrixOs})
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
    runs-on: ${matrixOs}
    steps:
      - run: cargo test
`
  );
  // A check is named after the job's name:, or its id without one; a
  // matrix job's name depends on the matrix, so it is not guessed.
  assert.deepEqual(ci.testJobs, ['Tracker and Action', 'Dashboard', 'e2e']);
  assert.equal(ci.unresolvedTestJobs, 1);
});

test("the branch ruleset requires the repository's own test checks", () => {
  const ci = readWorkflow(
    '.github/workflows/ci.yml',
    `on: [pull_request]
jobs:
  tracker:
    name: Tracker and Action
    steps:
      - run: npm test
  dashboard:
    name: Dashboard
    steps:
      - run: npm test
`
  );
  const fix = audit({ workflows: [ci] })['branch-rules'].fixes[0].content;
  assert.match(
    fix,
    /"required_status_checks": \[\{ "context": "Tracker and Action" \}, \{ "context": "Dashboard" \}\]/
  );
  assert.doesNotMatch(fix, /"context": "test"/);

  // Tests that run only on push are not checks a pull request reports.
  const pushOnly = readWorkflow(
    '.github/workflows/ci.yml',
    `on: [push]
jobs:
  test:
    steps:
      - run: npm test
`
  );
  // Without a test job it can name, the fix says so rather than guess.
  for (const workflows of [[], [pushOnly]]) {
    const check = audit({ workflows })['branch-rules'];
    assert.match(
      check.fixes[0].content,
      /"context": "REPLACE-WITH-CI-JOB-NAME"/
    );
    assert.match(
      check.fixes[0].content,
      /^# Replace REPLACE-WITH-CI-JOB-NAME/m
    );
    assert.match(check.recommendation, /name of each CI job that must pass/);
  }
});

test('Dependabot gets an entry for every folder with a manifest', () => {
  const by = audit({
    ecosystems: [
      { name: 'npm', directory: '/' },
      { name: 'npm', directory: '/dashboard' },
    ],
  });
  const yaml = by['dependency-updates'].fixes[0].content;
  assert.equal(yaml.match(/package-ecosystem: npm/g)?.length, 2);
  assert.match(yaml, /directory: \/dashboard/);
  assert.match(by['ci-on-pull-requests'].fixes[0].content, /npm test/);
});

test('agent instructions: AGENTS.md, CLAUDE.md and what they cover', async () => {
  const none = audit({});
  assert.equal(none['agent-instructions'].status, 'missing');
  assert.equal(none['agent-instructions-content'].status, 'missing');
  const template = none['agent-instructions'].fixes[0].content;
  for (const heading of [
    'Build and test',
    'Test-driven development',
    'Raising issues',
    'Commits and pull requests',
    'Security',
    'Attribution',
  ]) {
    assert.match(template, new RegExp(`## ${heading}`), heading);
  }
  assert.match(template, /`npm test`/);
  assert.match(none['claude-md'].fixes[0].content, /^@AGENTS\.md/);

  // The templates pass the checks they come from.
  const { CLAUDE_TEMPLATE } = await import('../src/audit.ts');
  const good = audit({
    agentDocs: [
      { path: 'AGENTS.md', text: template },
      { path: 'CLAUDE.md', text: CLAUDE_TEMPLATE },
    ],
  });
  for (const id of [
    'agent-instructions',
    'claude-md',
    'agent-instructions-content',
  ]) {
    assert.equal(good[id].status, 'pass', id);
  }

  // A thin AGENTS.md and a CLAUDE.md that does not import it.
  const thin = audit({
    keyFiles: { ...PROFILE.keyFiles, agentInstructions: 'AGENTS.md' },
    agentDocs: [
      {
        path: 'AGENTS.md',
        text: '# Notes\nRun `npm test`. Never commit secrets.',
      },
      { path: 'CLAUDE.md', text: '# Claude\nBe careful.' },
    ],
  });
  assert.equal(thin['claude-md'].status, 'improve');
  assert.match(thin['claude-md'].evidence, /does not import AGENTS\.md/);
  assert.equal(thin['agent-instructions-content'].status, 'missing');
  assert.match(
    thin['agent-instructions-content'].evidence,
    /test-driven development, how to raise issues/
  );
});

test('incident labels pass once the label exists', () => {
  assert.equal(audit({})['incident-labels'].status, 'improve');
  const ready = audit({ labels: ['bug', 'incident'] })['incident-labels'];
  assert.equal(ready.status, 'pass');
  assert.match(ready.evidence, /incident label is ready/);
});

test('audit issues are opened, updated, closed and reopened with their checks', async () => {
  const { syncAuditIssues, marker } = await import('../src/audit-issues.ts');
  type Sent = { method: string; path: string; body: Record<string, unknown> };
  const sent: Sent[] = [];
  let listed: unknown[] = [];
  const client = {
    rest: async () => null,
    restAll: async () => listed,
    graphql: async () => ({}),
    send: async (method: string, path: string, body: unknown) => {
      sent.push({ method, path, body: body as Record<string, unknown> });
      if (path.endsWith('/labels')) throw new Error('HTTP 422');
      return { number: 50 + sent.length };
    },
  };
  const checks = Object.values(audit({}));
  const by = Object.fromEntries(checks.map((c) => [c.id, c]));

  // First run: every medium or high finding gets an issue; waiting checks
  // and low-impact findings do not.
  const first = await syncAuditIssues(
    client as never,
    'owner/project',
    checks,
    {
      dashboardUrl: 'https://owner.github.io/project/dashboard/',
    }
  );
  const created = sent.filter((s) => s.path.endsWith('/issues'));
  assert.equal(first.opened.length, created.length);
  const titles = created.map((s) => s.body.title);
  assert.ok(titles.includes('Audit: Dependencies are updated automatically'));
  assert.ok(!titles.includes(`Audit: ${by.labels.title}`), 'waiting');
  assert.ok(!titles.includes(`Audit: ${by.codeowners.title}`), 'low impact');
  const body = String(
    created.find(
      (s) => s.body.title === 'Audit: Dependencies are updated automatically'
    )!.body.body
  );
  assert.ok(body.startsWith(marker('dependency-updates')));
  assert.match(body, /```yaml\nversion: 2/);
  assert.match(body, /dashboard\/audit#dependency-updates/);
  assert.deepEqual(created[0].body.labels, ['repo-sre-audit']);

  // Next run: the dependency check passes, so its issue closes; a closed
  // issue for a failing check reopens; an unchanged one is left alone.
  sent.length = 0;
  listed = [
    { number: 7, state: 'open', body: marker('dependency-updates') },
    { number: 8, state: 'closed', body: marker('security-policy') },
    {
      number: 9,
      state: 'open',
      body: (await import('../src/audit-issues.ts')).issueBody(
        by['code-scanning'],
        ''
      ),
    },
  ];
  const fixed = checks.map((c) =>
    c.id === 'dependency-updates' ? { ...c, status: 'pass' as const } : c
  );
  const second = await syncAuditIssues(client as never, 'owner/project', fixed);
  assert.deepEqual(second.closed, [7]);
  assert.deepEqual(second.reopened, [8]);
  assert.ok(!second.updated.includes(9));
  assert.ok(
    sent.some(
      (s) => s.path.endsWith('/issues/7') && s.body.state_reason === 'completed'
    )
  );
});

test('CI health: success rate, time to green, failing now', () => {
  const run = (at: string, conclusion: string, path = 'ci.yml') => ({
    workflow: path,
    path,
    conclusion,
    createdAt: at,
    startedAt: at,
    updatedAt: new Date(Date.parse(at) + 10 * 60_000).toISOString(),
  });
  const health = ciHealth(
    [
      run('2026-11-10T00:00:00Z', 'success'),
      run('2026-11-11T00:00:00Z', 'failure'),
      run('2026-11-11T02:00:00Z', 'failure'),
      run('2026-11-11T04:00:00Z', 'success'),
      run('2026-11-12T00:00:00Z', 'cancelled'),
      run('2026-11-12T00:00:00Z', 'failure', 'lint.yml'),
    ],
    NOW
  );
  assert.equal(health.runs, 5);
  assert.equal(health.failed, 3);
  assert.equal(health.median_minutes, 10);
  assert.equal(health.median_hours_to_green, 4);
  assert.deepEqual(health.failing_now, ['lint.yml']);
});

test('delivery metrics fall back from deployments to releases to merges', () => {
  assert.equal(frequencyBand(2), 'elite');
  assert.equal(frequencyBand(0.2), 'high');
  assert.equal(leadTimeBand(30), 'high');
  assert.equal(isRepair('Revert "Add cache"', []), true);
  assert.equal(isRepair('Add cache', ['hotfix']), true);
  assert.equal(isRepair('Add cache', []), false);

  const pull = (n: number, repair = false) => ({
    number: n,
    createdAt: '2026-11-10T00:00:00Z',
    mergedAt: '2026-11-10T06:00:00Z',
    closedAt: '2026-11-10T06:00:00Z',
    origin: 'human' as const,
    agent: null,
    base: 'main',
    repair,
  });
  const merges = deliveryMetrics(PROFILE, [pull(1), pull(2, true)], [], NOW);
  assert.equal(merges.source, 'merges');
  assert.equal(merges.deployment_frequency.count, 2);
  assert.equal(merges.lead_time_hours.value, 6);
  assert.equal(merges.change_failure_rate.value, 0.5);
  assert.equal(merges.time_to_restore_hours.value, null);

  const released = deliveryMetrics(
    {
      ...PROFILE,
      releases: [
        { tag: 'v1', publishedAt: '2026-11-11T00:00:00Z', prerelease: false },
      ],
    },
    [pull(1)],
    [
      issue({
        number: 9,
        incident: true,
        createdAt: '2026-11-12T00:00:00Z',
        closedAt: '2026-11-12T03:00:00Z',
      }),
    ],
    NOW
  );
  assert.equal(released.source, 'releases');
  assert.equal(released.lead_time_hours.value, 24);
  assert.equal(released.time_to_restore_hours.value, 3);
  assert.equal(released.time_to_restore_hours.band, 'high');
});

test('the client pages through REST lists and reports GraphQL errors', async () => {
  const calls: string[] = [];
  const fake = (async (url: string) => {
    calls.push(String(url));
    if (String(url).endsWith('/graphql')) {
      return Response.json({ errors: [{ message: 'nope' }] });
    }
    const page = Number(new URL(String(url)).searchParams.get('page'));
    return Response.json(
      page === 1 ? Array.from({ length: 100 }, (_, i) => i) : [100, 101]
    );
  }) as typeof fetch;
  const client = createClient({ token: 't', fetchImpl: fake });
  assert.equal(
    (await client.restAll<number>('/repos/a/b/releases')).length,
    102
  );
  assert.match(calls[0], /per_page=100&page=1/);
  await assert.rejects(client.graphql('query{x}', {}), /nope/);
});

test('CSV files round-trip', () => {
  const file = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'csv-')),
    'x.csv'
  );
  writeCsv(file, ['date', 'open'], [{ date: '2026-11-01', open: 3 }]);
  assert.deepEqual(readCsv(file), [{ date: '2026-11-01', open: '3' }]);
  assert.deepEqual(readCsv(file + '.missing'), []);
});

test('issues are classed for the manageability limits', () => {
  assert.equal(
    classifyClass('XSS in login', '', ['security'], 'behavior'),
    'security'
  );
  assert.equal(
    classifyClass('Bump lodash for CVE-2026-12345', '', [], 'other'),
    'security'
  );
  assert.equal(classifyClass('x', 'See GHSA-xxxx', [], 'behavior'), 'bug');
  assert.equal(
    classifyClass('x', 'See GHSA-9wx4-h78v-vm56', [], 'other'),
    'security'
  );
  assert.equal(classifyClass('Crash', '', ['bug'], 'behavior'), 'bug');
  assert.equal(classifyClass('Dark mode', '', [], 'feature'), 'other');
});

test('class status flags issues already past their limit', () => {
  const now = new Date('2026-11-30T00:00:00Z');
  const status = classStatus(
    [
      issue({ createdAt: '2026-11-20T00:00:00Z', issueClass: 'security' }),
      issue({ createdAt: '2026-11-28T00:00:00Z', issueClass: 'security' }),
      issue({ createdAt: '2026-11-01T00:00:00Z', issueClass: 'bug' }),
      issue({
        createdAt: '2026-11-01T00:00:00Z',
        issueClass: 'bug',
        closedAt: '2026-11-02T00:00:00Z',
      }),
    ],
    DEFAULT_LIMITS,
    now
  );
  assert.equal(status.security.open, 2);
  assert.equal(status.security.oldest_open_days, 10);
  assert.equal(status.security.over_limit, 1);
  assert.equal(status.bug.over_limit, 0);
  assert.equal(status.other.oldest_open_days, null);
});

test('the agent record counts filings and how closures held', () => {
  const record = agentRecord([
    issue({ opener: 'agent' }),
    issue({
      opener: 'agent',
      closedAt: '2026-11-02T00:00:00Z',
      closer: 'agent',
      evidence: 'fix_referenced',
    }),
    issue({
      closedAt: '2026-11-02T00:00:00Z',
      closer: 'agent',
      evidence: 'no_reference',
      reopened: true,
    }),
  ]);
  assert.deepEqual(record, {
    opened: 2,
    opened_still_open: 1,
    resolved: 2,
    resolved_with_fix: 1,
    resolved_reopened: 1,
  });
});

test('daily rows carry per-class totals by who opened and closed', () => {
  const [before, row] = dailyRows(
    [
      issue({ opener: 'agent', issueClass: 'security' }),
      issue({
        issueClass: 'security',
        closedAt: '2026-11-01T05:00:00Z',
        closer: 'human',
        evidence: 'fix_referenced',
      }),
    ],
    '2026-11-01'
  );
  assert.equal(before.security_opened_by_agents, 0);
  assert.equal(row.security_opened_by_agents, 1);
  assert.equal(row.security_opened_by_humans, 1);
  assert.equal(row.security_closed_by_humans, 1);
  assert.equal(row.bug_opened_by_humans, 0);
});

test('pull requests are attributed to agents, assisted people or people', () => {
  assert.equal(
    agentInTrailers(
      'Fix\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'
    ),
    'Claude'
  );
  assert.equal(
    agentInTrailers(
      'Fix\n\nCo-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>'
    ),
    'Copilot'
  );
  assert.equal(
    agentInTrailers('Fix\n\nCo-authored-by: Ada <ada@example.com>'),
    null
  );
  assert.equal(
    agentInSignature(
      'Done.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)'
    ),
    'Claude'
  );
  assert.equal(agentInSignature('Generated by a script'), null);

  assert.deepEqual(classifyOrigin('Copilot', 'Bot', '', []), {
    origin: 'agent',
    agent: 'Copilot',
    routine: false,
  });
  assert.deepEqual(classifyOrigin('copilot-swe-agent', 'User', '', []), {
    origin: 'agent',
    agent: 'Copilot',
    routine: false,
  });
  assert.equal(classifyOrigin('dependabot', 'Bot', '', []).routine, true);
  assert.equal(classifyOrigin('renovate[bot]', 'Bot', '', []).routine, true);
  assert.deepEqual(
    classifyOrigin('ada', 'User', '', [
      'Fix\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
    ]),
    { origin: 'assisted', agent: 'Claude', routine: false }
  );
  assert.deepEqual(classifyOrigin('ada', 'User', 'Fixes #1', ['Fix']), {
    origin: 'human',
    agent: null,
    routine: false,
  });
});

test('pull request totals and the 30-day summary', () => {
  const pr = (o: Partial<PullRequest>): PullRequest => ({
    number: 1,
    createdAt: '2026-11-20T00:00:00Z',
    mergedAt: null,
    closedAt: null,
    origin: 'human',
    agent: null,
    ...o,
  });
  const pulls = [
    pr({
      origin: 'agent',
      agent: 'Copilot',
      mergedAt: '2026-11-20T06:00:00Z',
      closedAt: '2026-11-20T06:00:00Z',
    }),
    pr({ origin: 'agent', agent: 'Copilot', closedAt: '2026-11-21T00:00:00Z' }),
    pr({
      origin: 'assisted',
      agent: 'Claude',
      mergedAt: '2026-11-22T00:00:00Z',
      closedAt: '2026-11-22T00:00:00Z',
    }),
    pr({}),
  ];
  const rows = pullRows(pulls, '2026-11-22');
  assert.equal(rows.at(-1)!.agent_opened, 2);
  assert.equal(rows.at(-1)!.agent_merged, 1);
  assert.equal(rows.at(-1)!.agent_closed_unmerged, 1);
  assert.equal(rows[0].assisted_merged, 0);
  const summary = pullSummary(pulls, new Date('2026-11-30T00:00:00Z'));
  assert.equal(summary.by_origin.agent.merge_rate, 0.5);
  assert.equal(summary.by_origin.agent.median_hours_to_merge, 6);
  assert.equal(summary.by_origin.human.still_open, 1);
  assert.deepEqual(summary.agents, { Copilot: 2, Claude: 1 });
});

test('people and agents each have their own monthly budget', () => {
  const read = (values: Record<string, string>) => (name: string) =>
    values[name] ?? '';
  const both = costInputs(
    read({
      SRE_AGENT_COST_PER_ISSUE: '1.5',
      SRE_HUMAN_HOURLY_RATE: '95',
      SRE_MONTHLY_HUMAN_BUDGET: '5000',
      SRE_MONTHLY_AGENTIC_BUDGET: '50',
    })
  );
  assert.deepEqual(both.cost, {
    currency: 'USD',
    agent_per_issue: 1.5,
    human_hourly_rate: 95,
    human_hours_per_issue: 2,
    monthly_human_budget: 5000,
    monthly_agentic_budget: 50,
  });
  assert.deepEqual(both.warnings, []);

  // The old input still works for a release, as the human budget, and
  // the run says to rename it.
  const old = costInputs(
    read({ SRE_HUMAN_HOURLY_RATE: '95', SRE_MONTHLY_BUDGET: '5000' })
  );
  assert.equal(old.cost!.monthly_human_budget, 5000);
  assert.equal(old.cost!.monthly_agentic_budget, null);
  assert.match(old.warnings[0], /monthly-budget is deprecated/);
  assert.match(old.warnings[0], /monthly-human-budget/);
  // The new input wins over the old one.
  const mixed = costInputs(
    read({
      SRE_HUMAN_HOURLY_RATE: '95',
      SRE_MONTHLY_BUDGET: '9000',
      SRE_MONTHLY_HUMAN_BUDGET: '5000',
    })
  );
  assert.equal(mixed.cost!.monthly_human_budget, 5000);
  assert.equal(mixed.warnings.length, 1);

  // Costs are never guessed: no prices, no cost figures.
  assert.equal(
    costInputs(read({ SRE_MONTHLY_AGENTIC_BUDGET: '50' })).cost,
    null
  );
  // Nonsense is ignored.
  assert.equal(
    costInputs(
      read({ SRE_HUMAN_HOURLY_RATE: '95', SRE_MONTHLY_AGENTIC_BUDGET: 'lots' })
    ).cost!.monthly_agentic_budget,
    null
  );
});

test('the cost check recommends a budget for people and one for agents', () => {
  const fix = audit({})['cost'].fixes[0].content;
  assert.match(fix, /monthly-human-budget: '5000'/);
  assert.match(fix, /monthly-agentic-budget: '50'/);
  assert.doesNotMatch(fix, /monthly-budget:/);
});

test('daily rows start with a zero baseline before the first issue', () => {
  const rows = dailyRows(
    [
      issue({ createdAt: '2026-11-19T03:00:00Z' }),
      issue({
        createdAt: '2026-11-19T04:00:00Z',
        closedAt: '2026-11-19T08:00:00Z',
        closer: 'human',
        evidence: 'fix_referenced',
      }),
    ],
    '2026-11-19'
  );
  assert.deepEqual(
    rows.map((r) => [r.date, r.open, r.human_closed]),
    [
      ['2026-11-18', 0, 0],
      ['2026-11-19', 1, 1],
    ]
  );

  // With no issues at all, there is no prior baseline to invent.
  const empty = dailyRows([], '2026-11-19');
  assert.equal(empty.length, 1);
  assert.equal(empty[0].date, '2026-11-19');
  assert.equal(empty[0].open, 0);
});

test("the audit's own fixes pin every action to a commit SHA and pass pinned-actions", () => {
  const ecosystems = ['npm', 'pip', 'gomod', 'maven', 'gradle', 'cargo'];
  const generated = [];
  for (const name of ecosystems) {
    const checks = Object.values(
      audit({ ecosystems: [{ name, directory: '/' }] })
    );
    for (const check of checks) {
      for (const fix of check.fixes) {
        if (fix.language !== 'yaml') continue;
        const usesLines = [
          ...fix.content.matchAll(/^\s*-?\s*uses:\s*(.+)$/gm),
        ].map((m) => m[1].trim());
        if (!usesLines.length) continue;
        const workflow = readWorkflow(
          fix.path || `.github/workflows/${check.id}-${name}.yml`,
          fix.content
        );
        assert.equal(
          workflow.unpinned,
          0,
          `${check.id} (${name}) has unpinned action(s):\n${usesLines.join('\n')}`
        );
        for (const line of usesLines) {
          assert.match(
            line,
            /@[0-9a-f]{40}\s+#\s+v\d/,
            `${check.id} (${name}) should include a version comment on: ${line}`
          );
        }
        generated.push(workflow);
      }
    }
  }
  assert.ok(generated.length > 0, 'expected workflow fixes to test');
  assert.equal(
    audit({ workflows: generated })['pinned-actions'].status,
    'pass'
  );
});

test('dependency cooldown is detected in Dependabot and Renovate configs', () => {
  assert.equal(
    hasDependencyCooldown(
      '.github/dependabot.yml',
      `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    cooldown:
      default-days: 7
  - package-ecosystem: github-actions
    directory: /
    cooldown:
      default-days: 7
`
    ),
    true
  );

  // Missing cooldown on one ecosystem fails the check.
  assert.equal(
    hasDependencyCooldown(
      '.github/dependabot.yml',
      `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    cooldown:
      default-days: 7
  - package-ecosystem: npm
    directory: /dashboard
`
    ),
    false
  );

  // Zero days or absent cooldown fails.
  assert.equal(
    hasDependencyCooldown(
      '.github/dependabot.yml',
      `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    cooldown:
      default-days: 0
`
    ),
    false
  );

  // Semver-specific cooldown days also count.
  assert.equal(
    hasDependencyCooldown(
      '.github/dependabot.yml',
      `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    cooldown:
      semver-patch-days: 7
      semver-minor-days: 7
`
    ),
    true
  );

  // Renovate uses minimumReleaseAge.
  assert.equal(
    hasDependencyCooldown('renovate.json', '{"minimumReleaseAge": "7 days"}'),
    true
  );
  assert.equal(
    hasDependencyCooldown('renovate.json', '{"minimumReleaseAge": "0 days"}'),
    false
  );
  assert.equal(hasDependencyCooldown('renovate.json', '{}'), false);
});

test('auto-patch requires a release cooldown and dependency-updates recommends one', () => {
  // The generated Dependabot config includes a cooldown and passes the detector.
  const dependabotFix = audit({})['dependency-updates'].fixes[0].content;
  assert.match(dependabotFix, /cooldown:\n\s+default-days: 7/);
  assert.equal(
    hasDependencyCooldown('.github/dependabot.yml', dependabotFix),
    true
  );

  const autoMergeWorkflow = readWorkflow(
    '.github/workflows/dependabot-auto-merge.yml',
    `name: Dependabot auto-merge
on: pull_request
permissions:
  contents: write
  pull-requests: write
jobs:
  auto-merge:
    runs-on: ubuntu-latest
    steps:
      - uses: dependabot/fetch-metadata@25dd0e34f4fe68f24cc83900b1fe3fe149efef98 # v3.1.0
`
  );

  // No auto-merge workflow -> improve.
  const none = audit({})['auto-patch'];
  assert.equal(none.status, 'improve');
  assert.match(none.fixes[0].content, /fetch-metadata/);

  // Auto-merge without a cooldown -> improve, explaining why and offering the cooldown fix.
  const noCooldown = audit({
    workflows: [autoMergeWorkflow],
    keyFiles: {
      ...PROFILE.keyFiles,
      dependencyUpdates: '.github/dependabot.yml',
    },
    dependencyCooldown: false,
  })['auto-patch'];
  assert.equal(noCooldown.status, 'improve');
  assert.match(noCooldown.evidence, /cooldown/i);
  assert.match(noCooldown.fixes[0].content, /cooldown:/);

  // Auto-merge with a cooldown -> pass, no fixes.
  const withCooldown = audit({
    workflows: [autoMergeWorkflow],
    keyFiles: {
      ...PROFILE.keyFiles,
      dependencyUpdates: '.github/dependabot.yml',
    },
    dependencyCooldown: true,
  })['auto-patch'];
  assert.equal(withCooldown.status, 'pass');
  assert.deepEqual(withCooldown.fixes, []);

  // This repository's own dependabot.yml has a cooldown on every ecosystem.
  const ownDependabot = fs.readFileSync(
    path.join(import.meta.dirname, '../../.github/dependabot.yml'),
    'utf8'
  );
  assert.equal(
    hasDependencyCooldown('.github/dependabot.yml', ownDependabot),
    true
  );
});

test('human-directed agent work counts as agent work on issues', () => {
  const base = {
    number: 45,
    createdAt: '2026-11-19T00:00:00Z',
    closedAt: '2026-11-19T06:00:00Z',
    stateReason: 'COMPLETED',
    body: '### What happened\nNo dials shown',
    author: { login: 'sholtomaud', __typename: 'User' },
    labels: { nodes: [{ name: 'bug' }] },
    closedEvents: { nodes: [] as never[] },
    reopens: { totalCount: 0 },
    firstComments: { nodes: [] },
    lastComments: { nodes: [] },
  };

  // Issue filed by a human, closed by a human merging an agent-assisted PR.
  const closedByPr = toIssue({
    ...base,
    closedEvents: {
      nodes: [
        {
          actor: { login: 'sholtomaud', __typename: 'User' },
          closer: {
            __typename: 'PullRequest',
            merged: true,
            author: { login: 'sholtomaud', __typename: 'User' },
            body: 'Fixes #45',
            commits: {
              nodes: [
                {
                  commit: {
                    message:
                      'fix: baseline\n\nCo-Authored-By: Antigravity (Gemini) <noreply@google.com>',
                    author: { name: 'Sholto Maud', email: 's@example.com' },
                  },
                },
              ],
            },
          },
        },
      ],
    },
  });
  assert.equal(closedByPr.opener, 'human');
  assert.equal(closedByPr.closer, 'agent');

  // Issue closed by a commit with an agent trailer or agent commit author.
  const closedByCommit = toIssue({
    ...base,
    closedEvents: {
      nodes: [
        {
          actor: { login: 'sholtomaud', __typename: 'User' },
          closer: {
            __typename: 'Commit',
            message:
              'fix: ruleset\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>',
            author: { name: 'Claude', email: 'noreply@anthropic.com' },
          },
        },
      ],
    },
  });
  assert.equal(closedByCommit.closer, 'agent');

  // Issue closed by a squash-merged PR whose commits lost trailers, kept in PR body.
  const closedBySquashBody = toIssue({
    ...base,
    closedEvents: {
      nodes: [
        {
          actor: { login: 'sholtomaud', __typename: 'User' },
          closer: {
            __typename: 'PullRequest',
            merged: true,
            author: { login: 'sholtomaud', __typename: 'User' },
            body: 'Fixes #45\n\nGenerated with [Claude Code](https://claude.ai/code)',
            commits: { nodes: [{ commit: { message: 'fix: baseline' } }] },
          },
        },
      ],
    },
  });
  assert.equal(closedBySquashBody.closer, 'agent');

  // Issue closed by a human PR without any agent attribution stays human.
  const closedByHumanPr = toIssue({
    ...base,
    closedEvents: {
      nodes: [
        {
          actor: { login: 'sholtomaud', __typename: 'User' },
          closer: {
            __typename: 'PullRequest',
            merged: true,
            author: { login: 'sholtomaud', __typename: 'User' },
            body: 'Fixes #45',
            commits: { nodes: [{ commit: { message: 'fix: manual' } }] },
          },
        },
      ],
    },
  });
  assert.equal(closedByHumanPr.closer, 'human');

  // Unmerged PR closer does not credit an agent.
  const closedByUnmergedPr = toIssue({
    ...base,
    closedEvents: {
      nodes: [
        {
          actor: { login: 'sholtomaud', __typename: 'User' },
          closer: {
            __typename: 'PullRequest',
            merged: false,
            author: { login: 'sholtomaud', __typename: 'User' },
            body: 'Generated with Claude Code',
            commits: { nodes: [] },
          },
        },
      ],
    },
  });
  assert.equal(closedByUnmergedPr.closer, 'human');

  // Agent-filed issues via a human account: body disclosure or agent label.
  const filedByClaude = toIssue({
    ...base,
    closedAt: null,
    body: "### Problem\nDetails\n\n_Raised by Claude Code (an AI agent) at the maintainer's request._",
  });
  assert.equal(filedByClaude.opener, 'agent');

  const filedByAntigravity = toIssue({
    ...base,
    closedAt: null,
    body: "*Raised by an AI agent (Antigravity) at the maintainer's request.*",
  });
  assert.equal(filedByAntigravity.opener, 'agent');

  const filedWithLabel = toIssue({
    ...base,
    closedAt: null,
    labels: { nodes: [{ name: 'bug' }, { name: 'agent-filed' }] },
  });
  assert.equal(filedWithLabel.opener, 'agent');

  // Talking about agents in prose does not make a human issue agent-filed.
  const humanTalkingAboutAgents = toIssue({
    ...base,
    closedAt: null,
    body: '### What happened\nWhen an agent runs npm ci, the build fails on our repo.',
  });
  assert.equal(humanTalkingAboutAgents.opener, 'human');
});

test('PR attribution recognises newer agents, trailers, commit authors and squash bodies', () => {
  assert.equal(
    agentInTrailers(
      'fix: align\n\nCo-Authored-By: Antigravity (Gemini) <noreply@google.com>'
    ),
    'Gemini'
  );
  assert.equal(
    agentInTrailers('fix: align\n\nCo-Authored-By: Antigravity <a@google.com>'),
    'Antigravity'
  );
  assert.equal(
    agentInTrailers(
      'fix: align\n\nAssisted-by: Claude Code <noreply@anthropic.com>'
    ),
    'Claude'
  );
  assert.equal(
    agentInSignature(
      'Fixes #1\n\nCo-Authored-By: Antigravity (Gemini) <noreply@google.com>'
    ),
    'Gemini'
  );
  assert.equal(
    agentInSignature(
      "_Raised by Antigravity (an AI agent) at the maintainer's request._"
    ),
    'Antigravity'
  );

  // Agent commit author recognised even when a squash/rebase omits trailers.
  assert.deepEqual(
    classifyOrigin(
      'sholtomaud',
      'User',
      'Fixes #1',
      ['fix: update'],
      [],
      [{ name: 'Claude', email: 'noreply@anthropic.com' }]
    ),
    { origin: 'assisted', agent: 'Claude', routine: false }
  );

  // A person named Claude is not misclassified as an agent.
  assert.deepEqual(
    classifyOrigin(
      'claudeshannon',
      'User',
      'Fixes #1',
      ['fix: entropy'],
      [],
      [{ name: 'Claude Shannon', email: 'claude@bell-labs.example' }]
    ),
    { origin: 'human', agent: null, routine: false }
  );
});

test('the agent-attribution audit check flags PR-only attribution when issues have none', () => {
  const prs = pullSummary(
    Array.from({ length: 6 }, (_, i) => ({
      number: i + 1,
      createdAt: '2026-11-10T00:00:00Z',
      mergedAt: '2026-11-10T02:00:00Z',
      closedAt: '2026-11-10T02:00:00Z',
      origin: 'assisted' as const,
      agent: 'Claude',
    })),
    NOW
  );
  const issues = Array.from({ length: 6 }, (_, i) =>
    issue({
      number: i + 1,
      closedAt: '2026-11-11T00:00:00Z',
      closer: 'human',
      opener: 'human',
    })
  );
  const mismatch = Object.fromEntries(
    runAudit({
      repository: 'owner/project',
      profile: PROFILE,
      summary: issueSummary(issues),
      agents: agentRecord(issues),
      schedule: describeCron('5 */6 * * *'),
      pulls: prs,
      ci: ciHealth([], NOW),
      delivery: deliveryMetrics(PROFILE, [], issues, NOW),
      costConfigured: false,
    }).map((c) => [c.id, c])
  );
  assert.equal(mismatch['agent-attribution'].status, 'improve');
  assert.match(mismatch['agent-attribution'].evidence, /no issues/i);

  const attributedIssues = issues.map((i) => ({
    ...i,
    closer: 'agent' as const,
  }));
  const healthy = Object.fromEntries(
    runAudit({
      repository: 'owner/project',
      profile: PROFILE,
      summary: issueSummary(attributedIssues),
      agents: agentRecord(attributedIssues),
      schedule: describeCron('5 */6 * * *'),
      pulls: prs,
      ci: ciHealth([], NOW),
      delivery: deliveryMetrics(PROFILE, [], attributedIssues, NOW),
      costConfigured: false,
    }).map((c) => [c.id, c])
  );
  assert.equal(healthy['agent-attribution'].status, 'pass');
});

test('agent-triage does not grant pull-requests: write to untrusted issues: opened runs', () => {
  const ownWorkflow = fs.readFileSync(
    path.join(import.meta.dirname, '../../.github/workflows/agent-triage.yml'),
    'utf8'
  );
  const auditFix = audit({})['agentic-triage'].fixes[0].content;

  const jobBlock = (text: string, name: string) => {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => l === `  ${name}:`);
    if (start === -1) return null;
    const out: string[] = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (/^  [a-z][\w-]*:/.test(lines[i]) || /^\S/.test(lines[i])) break;
      out.push(lines[i]);
    }
    return out.join('\n');
  };

  for (const [label, text] of [
    ['.github/workflows/agent-triage.yml', ownWorkflow],
    ['audit agentic-triage fix', auditFix],
  ]) {
    const parsed = readWorkflow('.github/workflows/agent-triage.yml', text);
    assert.equal(parsed.permissions, true, `${label} needs permissions block`);
    assert.equal(parsed.unpinned, 0, `${label} must pin all actions`);
    // Top-level permissions must be empty so untrusted triggers inherit nothing.
    assert.match(
      text,
      /^permissions:\s*\{\}/m,
      `${label} top-level permissions`
    );
    // Untrusted triage job runs only on issues and must NOT have pull-requests: write.
    const triageBlock = jobBlock(text, 'triage');
    assert.ok(triageBlock, `${label} should have a triage job`);
    assert.match(triageBlock, /github\.event_name == 'issues'/);
    assert.doesNotMatch(
      triageBlock,
      /pull-requests:\s*write/,
      `${label} triage job must not request pull-requests: write`
    );
    // Collaborator-only respond job handles @claude comments with author_association guard.
    const respondBlock = jobBlock(text, 'respond');
    assert.ok(respondBlock, `${label} should have a respond job`);
    assert.match(respondBlock, /github\.event_name == 'issue_comment'/);
    assert.match(respondBlock, /author_association/);
  }
});
