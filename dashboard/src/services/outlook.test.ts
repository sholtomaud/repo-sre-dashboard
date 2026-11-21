import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSimulator } from '../lib/gssk-simulator.ts';
import {
  CLASSES,
  DEFAULT_LIMITS,
  agentsVerdict,
  backtest,
  buildOutlook,
  calibrateClasses,
  classesNow,
  costToKeepPace,
  costsToKeepPace,
  expectedWait,
  parseClassHistory,
  totalHistory,
  type Doom,
} from './outlook.ts';

/**
 * A data.csv with per-class columns. Each class gets a daily pattern:
 * [agent filed, human filed, agent closed, human closed] per day.
 */
function csv(
  days: number,
  perDay: Record<string, [number, number, number, number]>,
  backlog: Partial<Record<string, number>> = {}
) {
  const header = [
    'date',
    'open',
    'agent_closed',
    'human_closed',
    ...CLASSES.flatMap((c) => [
      `${c}_opened_by_agents`,
      `${c}_opened_by_humans`,
      `${c}_closed_by_agents`,
      `${c}_closed_by_humans`,
    ]),
  ];
  const lines = [header.join(',')];
  for (let d = 0; d < days; d++) {
    const date = new Date(Date.UTC(2026, 9, 1 + d)).toISOString().slice(0, 10);
    // A starting backlog is filed by humans before the first day.
    const cells = CLASSES.flatMap((c) =>
      perDay[c].map((x, i) => x * (d + 1) + (i === 1 ? (backlog[c] ?? 0) : 0))
    );
    lines.push([date, 0, 0, 0, ...cells].join(','));
  }
  return lines.join('\n');
}

test('the class history is read from data.csv, or null for older files', () => {
  const history = parseClassHistory(
    csv(3, { security: [0, 1, 0, 1], bug: [1, 4, 1, 1], other: [0, 2, 0, 0] })
  )!;
  assert.equal(history.bug.points[2].open, 9);
  assert.equal(history.bug.agentOpened[2], 3);
  assert.equal(history.security.points[2].open, 0);
  assert.equal(totalHistory(history)[2].open, 9 + 6);
  assert.equal(
    parseClassHistory('date,open,agent_closed,human_closed\n2026-10-01,1,0,0'),
    null
  );
});

test('a class with no history borrows the repository\u2019s resolution rate', () => {
  const c = calibrateClasses(
    parseClassHistory(
      csv(
        10,
        { security: [0, 0, 0, 0], bug: [0, 4, 0, 2], other: [0, 0, 0, 0] },
        { bug: 20 }
      )
    )!
  );
  // Security has no record: its prior is the pooled rate.
  const security = c.security.humansPerOpen!;
  const bug = c.bug.humansPerOpen!;
  assert.ok(
    Math.abs(security.count / security.days - bug.count / bug.days) /
      (bug.count / bug.days) <
      0.5
  );
  assert.ok(security.count <= 1);
});

test('calibration splits new issues by who filed them', () => {
  const c = calibrateClasses(
    parseClassHistory(
      csv(10, {
        security: [0, 1, 0, 1],
        bug: [1, 4, 1, 1],
        other: [0, 2, 0, 0],
      })
    )!
  );
  assert.equal(c.bug.agentArrivals?.count, 7);
  assert.equal(c.bug.arrivals.count, 28);
  assert.equal(c.bug.agents.count, 7);
  assert.equal(c.bug.start.open, 30);
});

test('expected wait follows Little’s law', () => {
  assert.equal(expectedWait(30, 3), 10);
  assert.equal(expectedWait(0, 0), 0);
  assert.equal(expectedWait(5, 0), Infinity);
});

test('classes past their limit now', () => {
  const now = classesNow(
    parseClassHistory(
      csv(10, {
        security: [0, 1, 0, 0],
        bug: [0, 2, 1, 1],
        other: [0, 1, 0, 1],
      })
    )!,
    DEFAULT_LIMITS
  );
  // Security: 10 open, nothing resolved: an infinite wait.
  assert.equal(now.security.over, true);
  // Bugs: none open; other: none open.
  assert.equal(now.bug.over, false);
  assert.equal(now.other.waitDays, 0);
});

test('the cost of keeping pace mixes agent and human cost', () => {
  const cost = {
    currency: 'USD',
    agentPerIssue: 2,
    humanHourlyRate: 100,
    humanHoursPerIssue: 2,
    monthlyHumanBudget: 1000,
    monthlyAgenticBudget: 50,
  };
  assert.equal(costToKeepPace(cost, 10, 1), 600);
  assert.equal(costToKeepPace(cost, 10, 0), 60000);
  // Each side's share, for its own budget.
  assert.deepEqual(costsToKeepPace(cost, 10, 0.5), {
    human: 30000,
    agentic: 300,
  });
});

test('the agents verdict compares with and without them', () => {
  const doom = (p: number): Doom => ({ day: null, byHorizon: p, curve: [p] });
  assert.equal(agentsVerdict(doom(0.2), doom(0.6), 100, 100, true), 'benefit');
  assert.equal(agentsVerdict(doom(0.6), doom(0.2), 100, 100, true), 'burden');
  assert.equal(agentsVerdict(doom(1), doom(1), 50, 100, true), 'benefit');
  assert.equal(agentsVerdict(doom(1), doom(1), 100, 98, true), 'neutral');
  assert.equal(agentsVerdict(doom(1), doom(0), 0, 0, false), 'none');
});

test('a calm repository stays manageable and can finish', async () => {
  // A backlog of bugs, resolved faster than new ones arrive, mostly by
  // agents; no security issues yet.
  const history = parseClassHistory(
    csv(
      21,
      { security: [0, 0, 0, 0], bug: [0.5, 0.5, 2, 0.5], other: [0, 1, 0, 1] },
      { bug: 60 }
    )
  )!;
  const outlook = await buildOutlook(history, loadSimulator, {
    runs: 60,
    days: 120,
    seed: 4,
  });
  assert.ok(outlook.index > 0.5, `index ${outlook.index}`);
  assert.equal(outlook.doom.all.day, null);
  assert.notEqual(outlook.completion.state, 'diverging');
  assert.equal(outlook.agents.verdict, 'benefit');
  assert.equal(outlook.cost, null);
  // No security issues on record: not judged.
  assert.deepEqual(outlook.judged, ['bug', 'other']);
});

test('a flooded repository has lost control already, and agents add to it', async () => {
  // Agents file many bugs and resolve few; humans resolve a trickle.
  const history = parseClassHistory(
    csv(21, { security: [0, 1, 0, 0], bug: [10, 1, 1, 1], other: [0, 1, 0, 0] })
  )!;
  const outlook = await buildOutlook(history, loadSimulator, {
    runs: 60,
    days: 120,
    seed: 4,
    cost: {
      currency: 'USD',
      agentPerIssue: 2,
      humanHourlyRate: 100,
      humanHoursPerIssue: 2,
      monthlyHumanBudget: 500,
      monthlyAgenticBudget: 10,
    },
  });
  assert.equal(outlook.doom.all.day, 0);
  assert.equal(outlook.index, 0);
  assert.equal(outlook.completion.state, 'diverging');
  assert.equal(outlook.agents.verdict, 'burden');
  assert.ok(outlook.cost!.monthlyToKeepPace > outlook.cost!.monthlySpendNow);
  // Each budget is forecast on its own.
  assert.ok(outlook.doom.cost!.human !== null);
  assert.ok(outlook.doom.cost!.agentic !== null);
});

test('the back-test checks past forecasts against what happened', async () => {
  const history = parseClassHistory(
    csv(30, { security: [0, 0, 0, 0], bug: [1, 3, 1, 2], other: [0, 1, 0, 1] })
  )!;
  const result = await backtest(totalHistory(history), loadSimulator, {
    runs: 30,
  });
  assert.ok(result && result.checked >= 3);
  // Perfectly steady rates are well inside the range.
  assert.ok(result!.inside / result!.checked > 0.8, JSON.stringify(result));
  assert.equal(
    await backtest(totalHistory(history).slice(0, 10), loadSimulator),
    null
  );
});

test('a repository that resolves issues the same day stays manageable with a clear backlog', async () => {
  // Issues arrive and are closed on the same UTC day, so every midnight
  // snapshot has open === 0 (zero end-of-day exposure, like a fast-clearing
  // repository). The model must not fall back to the 1e-3/day floor or call
  // an already-empty backlog diverging.
  const header = [
    'date',
    'open',
    'agent_closed',
    'human_closed',
    ...CLASSES.flatMap((c) => [
      `${c}_opened_by_agents`,
      `${c}_opened_by_humans`,
      `${c}_closed_by_agents`,
      `${c}_closed_by_humans`,
    ]),
  ];
  const lines = [header.join(',')];
  for (let d = 0; d < 21; d++) {
    const date = new Date(Date.UTC(2026, 9, 1 + d)).toISOString().slice(0, 10);
    // 24 historical issues closed earlier, plus 1 opened and closed on day 18.
    const count = d >= 18 ? 25 : 24;
    const cells = [
      0,
      0,
      0,
      0, // security
      0,
      0,
      0,
      0, // bug
      0,
      count,
      0,
      count, // other: all closed the same day they opened
    ];
    lines.push([date, 0, 0, count, ...cells].join(','));
  }
  const history = parseClassHistory(lines.join('\n'))!;
  const cal = calibrateClasses(history);
  const rate = cal.other.humansPerOpen!.count / cal.other.humansPerOpen!.days;
  assert.ok(rate >= 1, `expected fast resolution rate >= 1/day, got ${rate}`);

  const outlook = await buildOutlook(history, loadSimulator, {
    runs: 60,
    days: 120,
    seed: 4,
  });
  assert.ok(outlook.index > 0.8, `expected high index, got ${outlook.index}`);
  assert.equal(outlook.doom.all.day, null);
  assert.deepEqual(outlook.completion, { state: 'clear' });
});

test('same-day resolutions by agents keep agent share in the pooled prior', () => {
  const history = parseClassHistory(
    csv(14, { security: [0, 0, 0, 0], bug: [0, 1, 1, 0], other: [0, 0, 0, 0] })
  )!;
  const cal = calibrateClasses(history);
  const agentRate = cal.bug.agentsPerOpen!.count / cal.bug.agentsPerOpen!.days;
  const humanRate = cal.bug.humansPerOpen!.count / cal.bug.humansPerOpen!.days;
  assert.ok(
    agentRate >= 1 && agentRate > humanRate,
    `expected agent rate (${agentRate}) >= 1 and > human rate (${humanRate})`
  );
  // A class with no own history borrows the pooled agent share, not 0.
  assert.ok(
    cal.security.agentsPerOpen!.count > 0.5,
    `expected security agent prior > 0.5, got ${cal.security.agentsPerOpen!.count}`
  );
});
