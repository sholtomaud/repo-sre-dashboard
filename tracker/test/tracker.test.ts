import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '../src/github.ts';
import { describeCron, findCron } from '../src/schedule.ts';
import {
  classifyEvidence,
  classifyKind,
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
