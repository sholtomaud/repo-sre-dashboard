import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot } from './metrics.ts';
import { buildAgentQueue } from './insights.ts';
import {
  attentionIndex,
  backlogShare,
  combineRatios,
  combinedAgentShare,
  combinedDoomLoop,
  combinedHoursToMidnight,
  combinedVelocity,
  effortShare,
  weightMarks,
  type Queue,
} from './combined.ts';

// Public: 30 open; 24 closed in the week, none by agents; 44 opened.
const snapshot = buildSnapshot(
  'date,open,agent_closed,human_closed\n2026-11-01,10,0,0\n2026-11-08,30,0,24\n'
);
const publicQueue: Queue = {
  latest: snapshot.latest,
  velocity: snapshot.velocity,
  loop: snapshot.doomLoop,
};
// Agents' queue: 90 open; 700 resolved in the week, 70 of them by people.
const agents: Queue = (() => {
  const queue = buildAgentQueue(
    'date,open,resolved,resolved_by_human\n2026-11-01,160,1000,0\n2026-11-08,90,1700,70\n'
  )!;
  return {
    latest: queue.points[queue.points.length - 1],
    velocity: queue.velocity,
    loop: queue.loop,
  };
})();

test('the agents\u2019 queue separates resolutions by agents and by people', () => {
  assert.equal(agents.latest.humanClosed, 70);
  assert.equal(agents.latest.agentClosed, 1630);
  assert.equal(agents.velocity.human, 10);
  assert.equal(agents.velocity.agent, 90);
});

test('combinedAgentShare weights the two queues', () => {
  const share = agents.latest.agentShare; // 1630 / 1700
  assert.equal(combinedAgentShare(publicQueue, agents, 0.5), share / 2);
  assert.equal(combinedAgentShare(publicQueue, agents, 1), 0);
  assert.equal(combinedAgentShare(publicQueue, agents, 0), share);
  // Version 1: with no agents' queue, the public issues alone.
  assert.equal(combinedAgentShare(publicQueue, null, 0.5), 0);
  assert.equal(combinedHoursToMidnight(publicQueue, null, 0.5), 24);
  assert.equal(
    combinedHoursToMidnight(publicQueue, agents, 0.5),
    (1 - share / 2) * 24
  );
});

test('combinedVelocity averages the queues\u2019 rates', () => {
  const v = combinedVelocity(publicQueue, agents, 0.5);
  assert.equal(v.agent, 45);
  assert.equal(v.human, (24 / 7 + 10) / 2);
  assert.equal(combinedVelocity(publicQueue, null, 0.5), publicQueue.velocity);
});

test('combineRatios is a weighted geometric mean', () => {
  assert.equal(combineRatios(2, 0.5, 0.5), 1);
  assert.ok(Math.abs(combineRatios(8, 1, 1 / 3)! - 2) < 1e-9);
  assert.equal(combineRatios(4, 0.5, 1), 4);
  assert.equal(combineRatios(4, 0.5, 0), 0.5);
  assert.equal(combineRatios(null, 0.5, 0.5), 0.5);
  assert.equal(combineRatios(4, null, 0.5), 4);
  assert.equal(combineRatios(Infinity, 0.5, 0.5), Infinity);
  assert.equal(combineRatios(Infinity, 0.5, 0), 0.5);
});

test('combinedDoomLoop combines ratio, level and history', () => {
  const loop = combinedDoomLoop(publicQueue, agents, 0.5);
  const expected = Math.sqrt(publicQueue.loop.ratio! * agents.loop.ratio!);
  assert.ok(Math.abs(loop.ratio! - expected) < 1e-9);
  assert.equal(loop.level, 'behind');
  assert.equal(loop.history.length, 1);
  assert.equal(loop.doublingDays, null);
  assert.equal(combinedDoomLoop(publicQueue, null, 0.5), publicQueue.loop);
});

test('backlog share, effort share and the attention index', () => {
  assert.equal(backlogShare(publicQueue, agents), 30 / 120);
  // 24 of 724 resolutions in the week went to public issues.
  assert.ok(Math.abs(effortShare(publicQueue, agents) - 24 / 724) < 1e-9);
  assert.ok(
    Math.abs(attentionIndex(publicQueue, agents)! - 24 / 724 / 0.25) < 1e-9
  );
});

test('weightMarks places the data-derived marks on the slider', () => {
  const marks = weightMarks(publicQueue, agents);
  assert.deepEqual(
    marks.map((mark) => mark.id),
    ['agents', 'effort', 'backlog', 'equal', 'public']
  );
  assert.equal(marks[2].weight, 0.25);
  assert.equal(marks[3].weight, 0.5);
});
