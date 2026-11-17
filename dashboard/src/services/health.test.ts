import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, parsePractices, parseResponses } from './health.ts';

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

test('practices are read safely', () => {
  const practices = parsePractices({
    practices: [
      {
        id: 'labels',
        title: 'Labels',
        status: 'improve',
        evidence: '20%',
        recommendation: 'Label',
        docs: 'https://docs.github.com/x',
      },
      { id: 'odd', title: 'Odd', status: 'weird', docs: 'javascript:alert(1)' },
      { nope: true },
    ],
  });
  assert.equal(practices.length, 2);
  assert.equal(practices[1].status, 'unknown');
  assert.equal(practices[1].docs, '');
  assert.deepEqual(parsePractices(null), []);
});

test('durations read naturally', () => {
  assert.equal(formatDuration(null), '—');
  assert.equal(formatDuration(0.25), '15 min');
  assert.equal(formatDuration(6.54), '6.5 h');
  assert.equal(formatDuration(30), '30 h');
  assert.equal(formatDuration(80), '3.3 days');
  assert.equal(formatDuration(24 * 40), '40 days');
});
