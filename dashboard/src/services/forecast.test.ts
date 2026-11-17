import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toPoints, velocity } from './metrics.ts';
import { loadSimulator, modelJson } from '../lib/gssk-simulator.ts';
import {
  CLOCK_SPREAD_LIMIT,
  DEFAULT_VOLATILITY,
  MAX_VOLATILITY,
  calibrateQueue,
  drawRate,
  ensembleValue,
  gamma,
  horizon,
  measureVolatility,
  random,
  runEnsemble,
  summarise,
  type QueueCalibration,
} from './forecast.ts';

const steady = (open: number, byAgents: number, byHumans: number) =>
  ({
    start: { open, byAgents, byHumans },
    arrivals: { count: 700, days: 7 },
    agents: { count: 0, days: 7 },
    humans: { count: 70, days: 7 },
    volatility: 0.03,
  }) satisfies QueueCalibration;

test('the model is valid GSSK JSON with two queues', () => {
  const model = JSON.parse(
    modelJson({
      public: { open: 1, byAgents: 2, byHumans: 3 },
      agents: { open: 4, byAgents: 5, byHumans: 6 },
    })
  );
  assert.equal(model.nodes.length, 10);
  assert.equal(model.edges.length, 8);
  assert.equal(model.config.method, 'rk4');
});

test('the kernel integrates the queues', async () => {
  const sim = await loadSimulator({
    public: { open: 100, byAgents: 0, byHumans: 0 },
    agents: { open: 1000, byAgents: 500, byHumans: 0 },
  });
  sim.setRate('public', 'arrive', 10);
  sim.setRate('agents', 'agents', 0.1);
  sim.step(1);
  assert.ok(Math.abs(sim.value('public', 'open') - 110) < 1e-9);
  // Exponential drain over one day: 1000 · e^-0.1.
  assert.ok(
    Math.abs(sim.value('agents', 'open') - 1000 * Math.exp(-0.1)) < 1e-3
  );
  assert.ok(
    Math.abs(sim.value('agents', 'byAgents') - (1500 - 1000 * Math.exp(-0.1))) <
      1e-3
  );
  sim.reset();
  assert.equal(sim.value('public', 'open'), 100);
  sim.dispose();
});

test('random numbers are seeded and gamma draws have the right mean', () => {
  assert.equal(random(7)(), random(7)());
  const rand = random(42);
  let total = 0;
  for (let i = 0; i < 20000; i++) total += gamma(2.5, rand);
  assert.ok(Math.abs(total / 20000 - 2.5) < 0.05);
  // A rate never seen is small but not zero.
  const draws = Array.from({ length: 2000 }, () =>
    drawRate({ count: 0, days: 7 }, rand)
  );
  assert.ok(draws.every((d) => d >= 0));
  assert.ok(Math.abs(draws.reduce((a, b) => a + b) / 2000 - 0.5 / 7) < 0.01);
});

test('calibration reads counts over the window and the drift', () => {
  const points = toPoints(
    parseCsv(
      'date,open,agent_closed,human_closed\n' +
        Array.from(
          { length: 20 },
          (_, d) =>
            `2026-11-${String(d + 1).padStart(2, '0')},${100 + d},${10 * d},${d}`
        ).join('\n')
    )
  );
  const c = calibrateQueue(points, velocity(points));
  assert.equal(c.start.open, 119);
  assert.equal(c.start.byAgents, 190);
  assert.equal(c.agents.count, 70);
  assert.equal(c.humans.count, 7);
  assert.equal(c.arrivals.count, 84);
  // Perfectly steady rates have almost no drift: the floor applies.
  assert.equal(measureVolatility(points), 0);
  assert.equal(c.volatility, 0.03);
  // Too short a record to measure: the default.
  const short = toPoints(
    parseCsv(
      'date,open,agent_closed,human_closed\n2026-11-01,1,0,0\n2026-11-02,2,1,0'
    )
  );
  assert.equal(measureVolatility(short), null);
  assert.equal(
    calibrateQueue(short, velocity(short)).volatility,
    DEFAULT_VOLATILITY
  );
});

test('a steady forecast stays near its starting rates', async () => {
  const calibration = {
    public: steady(1000, 0, 100),
    agents: {
      ...steady(1000, 900, 0),
      agents: { count: 700, days: 7 },
      humans: { count: 0, days: 7 },
    },
  };
  const sim = await loadSimulator({
    public: calibration.public.start,
    agents: calibration.agents.start,
  });
  const ensemble = runEnsemble(sim, calibration, {
    runs: 60,
    days: 10,
    seed: 3,
  });
  sim.dispose();
  // Day 1, run 0: about 100 new public issues and 10 resolved by humans.
  assert.ok(Math.abs(ensembleValue(ensemble, 0, 1, 0, 3) - 100) < 15);
  const days = summarise(ensemble, () => 0.5);
  // Public: nobody resolves... humans do, about 10 a day.
  assert.ok(Math.abs(days[0].resolved.public.p50 - 10) < 2);
  // Agents resolve all of their queue and none of the public one: noon.
  assert.ok(Math.abs(days[0].clockHours.p50 - 12) < 0.1);
  assert.ok(days[9].combined.resolved.p50 > 50);
});

test('the horizon is the first day the forecast is anyone’s guess', async () => {
  const wild = {
    public: { ...steady(1000, 0, 100), volatility: MAX_VOLATILITY },
    agents: { ...steady(1000, 900, 0), volatility: MAX_VOLATILITY },
  };
  const sim = await loadSimulator({
    public: wild.public.start,
    agents: wild.agents.start,
  });
  const ensemble = runEnsemble(sim, wild, { runs: 100, days: 120, seed: 5 });
  sim.dispose();
  const days = summarise(ensemble, () => 0.5);
  const h = horizon(days);
  assert.ok(h.day > 1 && h.day < 120, `horizon ${h.day}`);
  assert.notEqual(h.reason, 'limit');
  // Uncertainty grows with time.
  const width = (d: number) =>
    days[d].resolved.agents.p95 / days[d].resolved.agents.p5;
  assert.ok(width(h.day - 1) > width(0));
  assert.equal(horizon(days.slice(0, 1)).reason, 'limit');
  assert.ok(CLOCK_SPREAD_LIMIT === 12);
});
