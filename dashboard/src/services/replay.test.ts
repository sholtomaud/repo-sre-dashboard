import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toPoints } from './metrics.ts';
import { buildAgentQueue } from './insights.ts';
import { buildFrames, forecastFrames, frameAt, peakRate } from './replay.ts';
import type { Band, ForecastDay } from './forecast.ts';

// The agents' queue starts two days before the public issues do.
const agentPoints = buildAgentQueue(
  `date,open,resolved,resolved_by_human
2026-11-01,100,0,0
2026-11-02,120,100,0
2026-11-03,110,300,0
2026-11-04,100,500,100
`
)!.points;
const publicPoints = toPoints(
  parseCsv(`date,open,agent_closed,human_closed
2026-11-03,10,0,0
2026-11-04,16,2,2
`)
);
const frames = buildFrames(publicPoints, agentPoints);

test('buildFrames has one frame per day across both queues', () => {
  assert.deepEqual(
    frames.map((frame) => frame.date),
    ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']
  );
  // The public queue does not exist until its first day.
  assert.equal(frames[0].publicQueue, null);
  assert.equal(frames[1].publicQueue, null);
  assert.equal(frames[2].publicQueue?.latest.open, 10);
  // Each frame only knows what was known that day.
  assert.equal(frames[1].agents?.latest.agentClosed, 100);
  assert.equal(frames[1].agents?.velocity.agent, 100);
  assert.equal(frames[3].agents?.latest.humanClosed, 100);
});

test('buildFrames copes with one queue or none', () => {
  assert.equal(buildFrames([], []).length, 0);
  const only = buildFrames(publicPoints, []);
  assert.equal(only.length, 2);
  assert.equal(only[0].agents, null);
});

test('frameAt returns whole days exactly and blends between them', () => {
  assert.equal(frameAt(frames, 2), frames[2]);
  assert.equal(frameAt(frames, -1), frames[0]);
  assert.equal(frameAt(frames, 99), frames[3]);

  const half = frameAt(frames, 1.5);
  assert.equal(half.agents?.latest.agentClosed, 200);
  assert.equal(half.agents?.latest.open, 115);
  // Rates blend too: 100 a day after one day, 150 a day after two.
  assert.equal(half.agents?.velocity.agent, 125);

  // Half-way into the day people first resolve something.
  const mixed = frameAt(frames, 2.5).agents!.latest;
  assert.equal(mixed.humanClosed, 50);
  assert.equal(mixed.agentClosed, 350);
  assert.equal(mixed.agentShare, 350 / 400);
});

test('frameAt blends ratios on a log scale', () => {
  const a = frames[1].agents!.loop.ratio!; // 120 filed / 100 resolved
  const b = frames[2].agents!.loop.ratio!;
  const mid = frameAt(frames, 1.5).agents!.loop.ratio!;
  assert.ok(Math.abs(mid - Math.sqrt(a * b)) < 1e-9);
});

test('a queue appears on its first day, not before', () => {
  assert.equal(frameAt(frames, 1.9).publicQueue, null);
  assert.equal(frameAt(frames, 2).publicQueue?.latest.open, 10);
});

test('peakRate finds the largest rate in the record', () => {
  assert.equal(
    peakRate(frames, (frame) => frame.agents?.velocity ?? null),
    Math.max(
      ...frames.flatMap((f) =>
        f.agents ? [f.agents.velocity.agent, f.agents.velocity.arrivals] : []
      )
    )
  );
  assert.equal(
    peakRate([], () => null),
    0
  );
});

const flat = (v: number): Band => ({ p5: v, p25: v, p50: v, p75: v, p95: v });
const spread = (low: number, mid: number, high: number): Band => ({
  p5: low,
  p25: (low + mid) / 2,
  p50: mid,
  p75: (mid + high) / 2,
  p95: high,
});
const forecastDay = (day: number): ForecastDay => {
  const queue = {
    open: flat(100),
    byAgents: flat(500 + day * 10),
    byHumans: flat(100),
    arrivals: flat(12),
    agents: flat(10),
    humans: flat(0),
  };
  return {
    day,
    queues: { public: queue, agents: queue },
    resolved: { public: spread(5, 10, 20), agents: spread(5, 10, 20) },
    clockHours: spread(10 - day, 12, 12),
    combined: {
      arrivals: flat(12),
      agents: flat(10),
      humans: flat(0),
      resolved: spread(5, 10, 20 + day),
    },
  };
};

test('forecastFrames follow the last recorded day up to the horizon', () => {
  const days = [1, 2, 3, 4].map(forecastDay);
  const fc = forecastFrames(days, 3, '2026-11-04', { public: [], agents: [] });
  assert.deepEqual(
    fc.map((frame) => frame.date),
    ['2026-11-05', '2026-11-06', '2026-11-07']
  );
  // The panels draw the medians; the fade reaches 1 at the horizon.
  assert.equal(fc[0].agents?.velocity.agent, 10);
  assert.equal(fc[0].agents?.loop.ratio, 1.2);
  assert.equal(fc[0].agents?.loop.level, 'behind');
  assert.equal(fc[2].forecast?.fade, 1);
  assert.deepEqual(fc[1].forecast?.clock, { low: 8, mid: 12, high: 12 });
});

test('the range opens out of the median between today and the first forecast day', () => {
  const fc = forecastFrames([forecastDay(1)], 1, '2026-11-04', {
    public: [],
    agents: [],
  });
  const all = [...frames, ...fc];
  const half = frameAt(all, frames.length - 0.5).forecast!;
  // Half-way from today (no range) to day 1 (9 to 12 hours).
  assert.equal(half.clock.mid, 12);
  assert.equal(half.clock.low, 10.5);
  assert.equal(half.fade, 0.5);
  assert.equal(frameAt(all, frames.length - 1).forecast, undefined);
});
