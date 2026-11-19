import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, formatSpan } from './format.ts';

test('formatSpan uses hours under a day and singular/plural days otherwise', () => {
  assert.equal(formatSpan(1 / 24), '1 hour');
  assert.equal(formatSpan(11 / 24), '11 hours');
  assert.equal(formatSpan(0.01), '1 hour');
  assert.equal(formatSpan(1), '1 day');
  assert.equal(formatSpan(1.4), '1 day');
  assert.equal(formatSpan(6.5), '7 days');
});

test('formatMoney formats currencies cleanly and falls back on unknown codes', () => {
  assert.equal(formatMoney(1250, 'USD'), '$1,250');
  assert.equal(formatMoney(49.6, 'USD'), '$50');
  assert.equal(formatMoney(100, 'NOT_A_CODE'), '100 NOT_A_CODE');
});
