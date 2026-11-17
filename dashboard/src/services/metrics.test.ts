import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSnapshot,
  loadSnapshot,
  nextUpdate,
  parseStatus,
  clockTime,
  doomLoop,
  doomLoopLevel,
  hoursToMidnight,
  niceCeil,
  parseCsv,
  threatLevel,
  toPoints,
  velocity,
} from './metrics.ts';

const CSV = `date,open,agent_closed,human_closed
2026-11-01,10,0,0
2026-11-05,20,2,8
2026-11-08,24,6,10
2026-11-11,23,10,12
`;

test('parseCsv reads columns by name and sorts by date', () => {
  const rows = parseCsv(
    'human_closed,date,agent_closed,open\r\n3,2026-11-02,1,5\r\n0,2026-11-01,0,4\r\n'
  );
  assert.deepEqual(rows, [
    { date: '2026-11-01', open: 4, agentClosed: 0, humanClosed: 0 },
    { date: '2026-11-02', open: 5, agentClosed: 1, humanClosed: 3 },
  ]);
});

test('parseCsv rejects missing columns and bad values', () => {
  assert.throws(() => parseCsv('date,open\n2026-11-01,1'), /agent_closed/);
  assert.throws(
    () => parseCsv('date,open,agent_closed,human_closed\n2026-11-01,x,0,0'),
    /not a number/
  );
  assert.throws(
    () => parseCsv('date,open,agent_closed,human_closed\nyesterday,1,0,0'),
    /bad date/
  );
  assert.deepEqual(parseCsv(''), []);
});

test('hoursToMidnight follows (1 - agent share) x 24', () => {
  assert.equal(hoursToMidnight(0, 0), 24);
  assert.equal(hoursToMidnight(0, 22), 24);
  assert.equal(hoursToMidnight(1, 3), 18);
  assert.equal(hoursToMidnight(1, 1), 12);
  assert.equal(hoursToMidnight(5, 0), 0);
});

test('clockTime reads the time of day on a 24-hour clock', () => {
  assert.equal(clockTime(24), '00:00');
  assert.equal(clockTime(23), '01:00');
  assert.equal(clockTime(18), '06:00');
  assert.equal(clockTime(2.4), '21:36');
  assert.equal(clockTime(0), '24:00');
});

test('toPoints derives totals and agent share', () => {
  const [point] = toPoints(parseCsv(CSV)).slice(-1);
  assert.equal(point.totalClosed, 22);
  assert.equal(point.created, 45);
  assert.equal(point.agentShare, 10 / 22);
});

test('velocity is the per-day change over the trailing window', () => {
  const points = toPoints(parseCsv(CSV));
  // 11-05 is only 6 days before 11-11, so a 7-day window starts at 11-01.
  const v = velocity(points, 7);
  assert.equal(v.days, 10);
  assert.equal(v.agent, 1);
  assert.equal(v.human, 1.2);
  assert.equal(v.arrivals, (45 - 10) / 10);
  assert.equal(v.netBacklog, 1.3);

  const short = velocity(points, 3);
  assert.equal(short.days, 3);
  assert.equal(short.agent, 4 / 3);
});

test('velocity is zero with fewer than two days of data', () => {
  const v = velocity(
    toPoints(parseCsv('date,open,agent_closed,human_closed\n2026-11-01,3,0,0'))
  );
  assert.deepEqual(v, {
    agent: 0,
    human: 0,
    arrivals: 0,
    netBacklog: 0,
    days: 0,
    since: '',
  });
});

test('buildSnapshot summarises the latest day', () => {
  const snapshot = buildSnapshot(CSV, 3);
  assert.equal(snapshot.latest.date, '2026-11-11');
  assert.equal(snapshot.openDelta, -1);
  assert.equal(snapshot.daysToClearByAgents, 23 / (4 / 3));

  const idle = buildSnapshot(
    'date,open,agent_closed,human_closed\n2026-11-01,3,0,0\n2026-11-02,5,0,1'
  );
  assert.equal(idle.daysToClearByAgents, Infinity);
  assert.throws(
    () => buildSnapshot('date,open,agent_closed,human_closed\n'),
    /no rows/
  );
});

test('niceCeil rounds up to 1, 2, 2.5 or 5 x 10^n', () => {
  assert.equal(niceCeil(0), 1);
  assert.equal(niceCeil(0.7), 1);
  assert.equal(niceCeil(1), 1);
  assert.equal(niceCeil(1.2), 2);
  assert.equal(niceCeil(2.2), 2.5);
  assert.equal(niceCeil(31), 50);
  assert.equal(niceCeil(444), 500);
});

test('threatLevel bands the clock', () => {
  assert.equal(threatLevel(24), 'safe');
  assert.equal(threatLevel(18), 'elevated');
  assert.equal(threatLevel(12), 'elevated');
  assert.equal(threatLevel(11.9), 'severe');
  assert.equal(threatLevel(4), 'critical');
});

test('loadSnapshot fetches the CSV and reports HTTP errors', async () => {
  const ok = (async () => new Response(CSV)) as typeof fetch;
  assert.equal((await loadSnapshot(ok)).latest.open, 23);

  const failing = (async () =>
    new Response('', { status: 404 })) as typeof fetch;
  await assert.rejects(loadSnapshot(failing), /HTTP 404/);
});

test('doomLoop: issues opened per issue closed, with a projection', () => {
  const loop = doomLoop(toPoints(parseCsv(CSV)), 7);
  // 11-01 to 11-11: 35 opened, 22 closed.
  assert.equal(loop.ratio, 35 / 22);
  assert.equal(loop.level, 'behind');
  assert.equal(loop.doublingDays, 23 / 1.3);
  assert.equal(loop.clearDays, null);
  assert.deepEqual(
    loop.history.map((h) => h.date),
    ['2026-11-05', '2026-11-08', '2026-11-11']
  );
  assert.equal(loop.history[0].ratio, 20 / 10);

  const shrinking = doomLoop(
    toPoints(
      parseCsv(
        'date,open,agent_closed,human_closed\n2026-11-01,10,0,0\n2026-11-03,6,2,4'
      )
    )
  );
  // 2 opened, 6 closed; the backlog falls by 2 a day.
  assert.equal(shrinking.ratio, 1 / 3);
  assert.equal(shrinking.level, 'burning');
  assert.equal(shrinking.clearDays, 3);

  const stalled = doomLoop(
    toPoints(
      parseCsv(
        'date,open,agent_closed,human_closed\n2026-11-01,1,0,0\n2026-11-02,4,0,0'
      )
    )
  );
  assert.equal(stalled.ratio, Infinity);
  assert.equal(stalled.level, 'doom');

  assert.equal(doomLoop(toPoints(parseCsv(CSV)).slice(0, 1)).level, 'unknown');
});

test('doomLoopLevel bands the ratio', () => {
  assert.equal(doomLoopLevel(null), 'unknown');
  assert.equal(doomLoopLevel(0.5), 'burning');
  assert.equal(doomLoopLevel(1), 'steady');
  assert.equal(doomLoopLevel(1.5), 'behind');
  assert.equal(doomLoopLevel(21), 'doom');
});

const STATUS_JSON = {
  updated_at: '2026-11-11T06:05:00Z',
  schedule: {
    cron: '5 */6 * * *',
    runs_per_day: 4,
    interval_hours: 6,
    description: 'every 6 hours',
    run_times_utc: ['00:05', '06:05', '12:05', '18:05'],
  },
};

test('parseStatus reads status.json and rejects other shapes', () => {
  const status = parseStatus(STATUS_JSON)!;
  assert.equal(status.updatedAt, '2026-11-11T06:05:00Z');
  assert.equal(status.schedule.description, 'every 6 hours');
  assert.equal(status.schedule.intervalHours, 6);
  assert.deepEqual(
    status.schedule.runTimesUtc,
    STATUS_JSON.schedule.run_times_utc
  );

  assert.equal(parseStatus(null), null);
  assert.equal(parseStatus({ updated_at: 'soon', schedule: {} }), null);
  assert.equal(parseStatus({ updated_at: '2026-11-11T06:05:00Z' }), null);
});

test('velocity counts a day still in progress as part of a day', () => {
  const points = toPoints(parseCsv(CSV));
  // The 11-11 row was counted at 06:00, a quarter of the way through the
  // day, so the window from the end of 11-08 is 2.25 days, not 3.
  const v = velocity(points, 2, '2026-11-11T06:00:00Z');
  assert.equal(v.since, '2026-11-08');
  assert.equal(v.days, 2.25);
  assert.equal(v.agent, 4 / 2.25);

  // A time outside the newest row's day is ignored.
  assert.equal(velocity(points, 2, '2026-11-12T06:00:00Z').days, 3);
  // Too short a window to give a meaningful rate.
  const justAfterMidnight = toPoints(
    parseCsv(
      'date,open,agent_closed,human_closed\n2026-11-10,1,0,0\n2026-11-11,9,0,0'
    )
  );
  assert.equal(velocity(justAfterMidnight, 7, '2026-11-11T00:05:00Z').days, 0);
});

test('buildSnapshot uses the status time for rates', () => {
  const snapshot = buildSnapshot(CSV, 2, parseStatus(STATUS_JSON));
  assert.equal(snapshot.velocity.days, 2 + (6 * 60 + 5) / 1440);
  assert.equal(snapshot.openDelta, -1);
  assert.equal(snapshot.status?.schedule.runsPerDay, 4);
  assert.equal(buildSnapshot(CSV).status, null);
});

test('nextUpdate finds the next scheduled run', () => {
  const status = parseStatus(STATUS_JSON)!;
  const next = (now: string) =>
    nextUpdate(status, new Date(now))?.toISOString();
  assert.equal(next('2026-11-11T06:30:00Z'), '2026-11-11T12:05:00.000Z');
  assert.equal(next('2026-11-11T00:00:00Z'), '2026-11-11T00:05:00.000Z');
  assert.equal(next('2026-11-11T23:00:00Z'), '2026-11-12T00:05:00.000Z');

  status.schedule.runTimesUtc = [];
  assert.equal(nextUpdate(status), null);
});

test('loadSnapshot reads status.json when it is there', async () => {
  const both = (async (url: string) =>
    url.endsWith('.json')
      ? Response.json(STATUS_JSON)
      : new Response(CSV)) as typeof fetch;
  const snapshot = await loadSnapshot(both);
  assert.equal(snapshot.status?.updatedAt, '2026-11-11T06:05:00Z');
});
