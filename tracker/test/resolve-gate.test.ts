import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  claimedIssues,
  evaluateResolveGate,
  type GateIssue,
  type GatePr,
} from '../src/resolve-gate.ts';
import { readWorkflow } from '../src/repo.ts';

const mkIssue = (
  number: number,
  labels: string[],
  overrides: Partial<GateIssue> = {}
): GateIssue => ({
  number,
  title: `Issue #${number}`,
  labels,
  createdAt: `2026-11-${String(10 + number).padStart(2, '0')}T00:00:00Z`,
  ...overrides,
});

const mkPr = (
  number: number,
  body: string,
  isAgent = true,
  title = `PR #${number}`
): GatePr => ({
  number,
  title,
  body,
  isAgent,
});

test('claimedIssues finds issue numbers linked by closing keywords in open PRs', () => {
  const claimed = claimedIssues([
    mkPr(10, 'Fixes #44 and closes #45'),
    mkPr(11, 'Related to #99', false, 'fix: resolve #29'),
    mkPr(12, 'Resolves #30.'),
  ]);
  assert.deepEqual(
    [...claimed].sort((a, b) => a - b),
    [29, 30, 44, 45]
  );
});

test('evaluateResolveGate trips circuit breakers for open agent PR cap and agentic budget', () => {
  const issues = [mkIssue(1, ['agent-ready', 'bug'])];

  // Open agent PR cap (default 2).
  const capped = evaluateResolveGate({
    issues,
    openPrs: [mkPr(100, 'Fixes #80', true), mkPr(101, 'Fixes #81', true)],
    ciFailingNow: [],
    agenticMonthlySpend: 10,
    agenticMonthlyBudget: 50,
    requestedIssue: null,
  });
  assert.equal(capped.proceed, false);
  assert.equal(capped.reason, 'open-agent-pr-cap');

  // Human-only open PRs do not trip the agent PR cap.
  const humanPrsOnly = evaluateResolveGate({
    issues,
    openPrs: [
      mkPr(100, 'Fixes #80', false),
      mkPr(101, 'Fixes #81', false),
      mkPr(102, 'Fixes #82', false),
    ],
    ciFailingNow: [],
    agenticMonthlySpend: 10,
    agenticMonthlyBudget: 50,
    requestedIssue: null,
  });
  assert.equal(humanPrsOnly.proceed, true);
  assert.equal(humanPrsOnly.issue?.number, 1);

  // Financial circuit breaker: spend exceeds monthly agentic budget.
  const overBudget = evaluateResolveGate({
    issues,
    openPrs: [],
    ciFailingNow: [],
    agenticMonthlySpend: 55,
    agenticMonthlyBudget: 50,
    requestedIssue: null,
  });
  assert.equal(overBudget.proceed, false);
  assert.equal(overBudget.reason, 'agentic-budget-exceeded');
});

test('evaluateResolveGate blocks unrelated work while CI is red but permits CI/incident recovery', () => {
  const feature = mkIssue(2, ['agent-ready', 'enhancement'], {
    title: 'Add dark mode toggle',
  });
  const ciAudit = mkIssue(3, ['repo-sre-audit'], {
    title: 'Audit: CI on the default branch stays green',
  });

  const blocked = evaluateResolveGate({
    issues: [feature],
    openPrs: [],
    ciFailingNow: ['CI'],
    agenticMonthlySpend: 5,
    agenticMonthlyBudget: 50,
    requestedIssue: null,
  });
  assert.equal(blocked.proceed, false);
  assert.equal(blocked.reason, 'ci-failing-on-main');

  const recovers = evaluateResolveGate({
    issues: [feature, ciAudit],
    openPrs: [],
    ciFailingNow: ['CI'],
    agenticMonthlySpend: 5,
    agenticMonthlyBudget: 50,
    requestedIssue: null,
  });
  assert.equal(recovers.proceed, true);
  assert.equal(recovers.issue?.number, 3);
});

test('evaluateResolveGate skips claimed issues, prioritises by severity, and honours requestedIssue', () => {
  const security = mkIssue(5, ['agent-ready', 'security']);
  const auditIssue = mkIssue(4, ['repo-sre-audit']);
  const bug = mkIssue(3, ['agent-ready', 'bug']);
  const enhancement = mkIssue(2, ['agent-ready', 'enhancement']);
  const unapproved = mkIssue(1, ['bug']);

  // Priority: security/incident > repo-sre-audit > bug > other agent-ready; unapproved ignored.
  const first = evaluateResolveGate({
    issues: [unapproved, enhancement, bug, auditIssue, security],
    openPrs: [],
    ciFailingNow: [],
    agenticMonthlySpend: null,
    agenticMonthlyBudget: null,
    requestedIssue: null,
  });
  assert.equal(first.proceed, true);
  assert.equal(first.issue?.number, 5);

  // Claiming #5 with an open PR moves on to #4 (repo-sre-audit).
  const second = evaluateResolveGate({
    issues: [unapproved, enhancement, bug, auditIssue, security],
    openPrs: [mkPr(200, 'Fixes #5', true)],
    ciFailingNow: [],
    agenticMonthlySpend: null,
    agenticMonthlyBudget: null,
    requestedIssue: null,
  });
  assert.equal(second.proceed, true);
  assert.equal(second.issue?.number, 4);

  // Explicitly requesting an already-claimed issue stops cleanly.
  const duplicate = evaluateResolveGate({
    issues: [security],
    openPrs: [mkPr(200, 'Fixes #5', true)],
    ciFailingNow: [],
    agenticMonthlySpend: null,
    agenticMonthlyBudget: null,
    requestedIssue: 5,
  });
  assert.equal(duplicate.proceed, false);
  assert.equal(duplicate.reason, 'already-has-pr');

  // Empty eligible queue stops cleanly.
  const empty = evaluateResolveGate({
    issues: [unapproved],
    openPrs: [],
    ciFailingNow: [],
    agenticMonthlySpend: null,
    agenticMonthlyBudget: null,
    requestedIssue: null,
  });
  assert.equal(empty.proceed, false);
  assert.equal(empty.reason, 'no-eligible-issues');
});

test('agent-resolve workflow is trusted-only, serialized, pinned, and paired with labels and budgets', () => {
  const root = path.join(import.meta.dirname, '../..');
  const resolveText = fs.readFileSync(
    path.join(root, '.github/workflows/agent-resolve.yml'),
    'utf8'
  );
  const parsed = readWorkflow(
    '.github/workflows/agent-resolve.yml',
    resolveText
  );
  assert.equal(parsed.permissions, true);
  assert.equal(parsed.unpinned, 0);
  // Never trigger autonomous code-writing runs on untrusted issues: [opened].
  assert.doesNotMatch(resolveText, /types:\s*\[[^\]]*\bopened\b/);
  assert.match(resolveText, /concurrency:/);
  assert.match(resolveText, /resolve-gate\.ts/);

  const labelsText = fs.readFileSync(
    path.join(root, '.github/workflows/labels.yml'),
    'utf8'
  );
  assert.match(labelsText, /label agent-ready\b/);

  const dashboardText = fs.readFileSync(
    path.join(root, '.github/workflows/dashboard.yml'),
    'utf8'
  );
  assert.match(dashboardText, /monthly-human-budget:/);
  assert.match(dashboardText, /monthly-agentic-budget:/);
});
