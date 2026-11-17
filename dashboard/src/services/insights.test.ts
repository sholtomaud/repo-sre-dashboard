import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseStatus, toPoints } from './metrics.ts';
import {
  buildAgentQueue,
  closureSummary,
  loadAgentQueue,
  strictRatios,
} from './insights.ts';

const CSV = `date,open,agent_closed,human_closed,closed_fix_referenced,closed_no_reference,closed_declined,closed_withdrawn,closed_duplicate,behavior_created,behavior_closed
2026-11-01,10,0,0,0,0,0,0,0,8,0
2026-11-08,30,0,24,3,12,6,2,1,40,20
`;
const OLD_CSV = `date,open,agent_closed,human_closed
2026-11-01,10,0,0
2026-11-08,30,0,24
`;

test('parseCsv reads the closure and behaviour columns when present', () => {
  const [, last] = parseCsv(CSV);
  assert.deepEqual(last.closures, {
    fix_referenced: 3,
    no_reference: 12,
    declined: 6,
    withdrawn: 2,
    duplicate: 1,
  });
  assert.deepEqual(last.behavior, { created: 40, closed: 20 });
  assert.equal(parseCsv(OLD_CSV)[1].closures, undefined);
});

test('closureSummary totals closures and the share that reference a fix', () => {
  const summary = closureSummary(toPoints(parseCsv(CSV))[1])!;
  assert.equal(summary.total, 24);
  assert.equal(summary.referencedShare, 3 / 24);
  assert.equal(closureSummary(toPoints(parseCsv(OLD_CSV))[1]), null);
});

test('strictRatios narrows what counts as closed', () => {
  const ratios = strictRatios(toPoints(parseCsv(CSV)));
  // 44 opened over the week; only 3 closures reference a fix.
  assert.ok(Math.abs(ratios.referenced! - 44 / 3) < 1e-9);
  // 32 behaviour reports opened, 20 closed.
  assert.ok(Math.abs(ratios.behavior! - 32 / 20) < 1e-9);

  const old = strictRatios(toPoints(parseCsv(OLD_CSV)));
  assert.equal(old.referenced, undefined);
  assert.equal(old.behavior, undefined);

  const none = strictRatios(
    toPoints(parseCsv(CSV.replace('3,12,6,2,1', '0,15,6,2,1')))
  );
  assert.equal(none.referenced, Infinity);
});

test('buildAgentQueue works out the agents\u2019 own rates', () => {
  const queue = buildAgentQueue(
    'date,open,resolved\n2026-11-01,100,1000\n2026-11-08,86,1700\n'
  )!;
  assert.equal(queue.open, 86);
  assert.equal(queue.resolved, 1700);
  assert.equal(queue.velocity.agent, 100);
  // 700 resolved and the backlog fell by 14, so 686 were filed.
  assert.equal(queue.velocity.arrivals, 98);
  assert.equal(queue.ratio, 0.98);
  // The same doom loop measures as the public queue: just under break-even.
  assert.equal(queue.loop.ratio, 0.98);
  assert.equal(queue.loop.level, 'steady');
  assert.equal(queue.loop.clearDays, 43);

  assert.equal(buildAgentQueue('date,open,resolved\n'), null);
  assert.equal(buildAgentQueue(''), null);
});

test('loadAgentQueue returns null when the file is missing', async () => {
  const missing = (async () =>
    new Response('', { status: 404 })) as typeof fetch;
  assert.equal(await loadAgentQueue(undefined, missing), null);
});

test('parseStatus reads the open-issue breakdown', () => {
  const status = parseStatus({
    updated_at: '2026-11-08T12:05:00Z',
    schedule: { description: 'every 6 hours', run_times_utc: ['00:05'] },
    issues: {
      source: 'graphql',
      open: 30,
      open_labelled: 2,
      open_by_kind: { behavior: 20, feature: 4, other: 6 },
    },
  })!;
  assert.deepEqual(status.issues, {
    open: 30,
    openLabelled: 2,
    openByKind: { behavior: 20, feature: 4, other: 6 },
  });
});
