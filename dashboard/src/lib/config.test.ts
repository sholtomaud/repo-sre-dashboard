import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig } from './config.ts';

const prices = {
  currency: 'USD',
  agent_per_issue: 1.5,
  human_hourly_rate: 95,
  human_hours_per_issue: 2,
};

test('people and agents have separate monthly budgets', () => {
  const cost = parseConfig({
    cost: {
      ...prices,
      monthly_human_budget: 5000,
      monthly_agentic_budget: 50,
    },
  }).cost!;
  assert.equal(cost.monthlyHumanBudget, 5000);
  assert.equal(cost.monthlyAgenticBudget, 50);
});

test('a config.json from before the split reads its budget as the human one', () => {
  const cost = parseConfig({ cost: { ...prices, monthly_budget: 5000 } }).cost!;
  assert.equal(cost.monthlyHumanBudget, 5000);
  assert.equal(cost.monthlyAgenticBudget, null);
  assert.equal(parseConfig({ cost: prices }).cost!.monthlyHumanBudget, null);
});
