import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, parseResponses } from './health.ts';

test('response times are read from status.json', () => {
  const r = parseResponses({
    responses: {
      windowDays: 30,
      firstResponse: { count: 4, medianHours: 2.5, p90Hours: 30 },
      resolution: { count: 2, medianHours: null, p90Hours: null },
      awaitingResponse: 3,
    },
  })!;
  assert.equal(r.firstResponse.medianHours, 2.5);
  assert.equal(r.resolution.medianHours, null);
  assert.equal(r.awaitingResponse, 3);
  assert.equal(parseResponses({}), null);
});

test('durations read naturally', () => {
  assert.equal(formatDuration(null), '—');
  assert.equal(formatDuration(0.25), '15 min');
  assert.equal(formatDuration(6.54), '6.5 h');
  assert.equal(formatDuration(30), '30 h');
  assert.equal(formatDuration(80), '3.3 days');
  assert.equal(formatDuration(24 * 40), '40 days');
});

test('pull requests by origin are read from status.json', async () => {
  const { parsePulls, agentMergedShare } = await import('./health.ts');
  const pulls = parsePulls({
    pulls: {
      window_days: 30,
      total: 9,
      by_origin: {
        agent: {
          opened: 4,
          merged: 2,
          closed_unmerged: 1,
          still_open: 1,
          merge_rate: 0.67,
          median_hours_to_merge: 5,
        },
        assisted: {
          opened: 2,
          merged: 2,
          closed_unmerged: 0,
          still_open: 0,
          merge_rate: 1,
          median_hours_to_merge: 20,
        },
        human: {
          opened: 3,
          merged: 4,
          closed_unmerged: 0,
          still_open: 0,
          merge_rate: 1,
          median_hours_to_merge: null,
        },
      },
      agents: { Copilot: 4, Claude: 2, bad: 'x' },
    },
  })!;
  assert.equal(pulls.byOrigin.agent.merged, 2);
  assert.equal(pulls.byOrigin.human.medianHoursToMerge, null);
  assert.deepEqual(pulls.agents, { Copilot: 4, Claude: 2 });
  assert.equal(agentMergedShare(pulls), 0.5);
  assert.equal(parsePulls({}), null);
});
