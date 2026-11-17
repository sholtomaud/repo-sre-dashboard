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
import { checkPractices } from '../src/practices.ts';
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
    [2, 2, 1]
  );
  assert.equal(rows[2].agent_closed, 1);
  assert.equal(rows[2].human_closed, 1);
  assert.equal(rows[2].closed_fix_referenced, 1);
  assert.equal(rows[2].behavior_created, 2);
  assert.equal(rows[2].behavior_closed, 1);
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

test('the habits checklist grades and recommends', () => {
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
  const practices = checkPractices({
    issueTemplates: ['bug_report.md', 'config.yml'],
    summary,
    schedule: describeCron('5 */6 * * *'),
  });
  const by = Object.fromEntries(practices.map((p) => [p.id, p]));
  assert.equal(by['issue-forms'].status, 'improve');
  assert.match(by['issue-forms'].evidence, /Markdown templates only/);
  assert.equal(by.labels.status, 'improve');
  assert.equal(by['linked-fixes'].status, 'pass');
  assert.equal(by['linked-fixes'].recommendation, '');
  assert.equal(by.schedule.status, 'pass');

  const none = checkPractices({
    issueTemplates: null,
    summary: issueSummary([]),
    schedule: describeCron('0 0 * * 1'),
  });
  const byNone = Object.fromEntries(none.map((p) => [p.id, p]));
  assert.equal(byNone['issue-forms'].status, 'missing');
  assert.equal(byNone.labels.status, 'unknown');
  assert.equal(byNone['linked-fixes'].status, 'unknown');
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
  const [row] = dailyRows(
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
