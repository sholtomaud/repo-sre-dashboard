/**
 * Forecasting both queues with the GSSK kernel, and deciding how far ahead
 * the forecast still says something.
 *
 * 1. Calibrate: each rate (new issues, resolved by agents, resolved by
 *    humans) is a count over the last week. Its uncertainty is the Bayesian
 *    posterior of a Poisson rate given that count (Jeffreys prior), so a
 *    rate never seen yet, like agents closing public issues, is small but
 *    not ruled out.
 * 2. Simulate: each run draws its starting rates from those posteriors,
 *    then lets them drift day by day as a random walk whose size is how
 *    much the 7-day rates have moved historically. GSSK integrates each
 *    day: new issues flow into the open backlog, and agents and humans each
 *    resolve a share of it.
 * 3. Summarise: percentiles across runs for every day.
 * 4. Stop: the forecast ends on the first day it is essentially random:
 *    when either queue's resolution rate is uncertain by a factor of ten or
 *    more, or the clock's likely range covers half the dial.
 *
 * DOM-free; unit-tested with `node --test` on the real kernel.
 */
import { HOURS_ON_CLOCK, type DailyPoint, type Velocity } from './metrics.ts';
import {
  QUEUES,
  type QueueName,
  type QueueStart,
  type Simulator,
} from '../lib/gssk-simulator.ts';

/** A count of events over a span of days: a Poisson rate's evidence. */
export interface RateEvidence {
  count: number;
  days: number;
}

export interface QueueCalibration {
  start: QueueStart;
  arrivals: RateEvidence;
  agents: RateEvidence;
  humans: RateEvidence;
  /** Daily log-scale drift of the rates. */
  volatility: number;
}

/** Bounds for the drift, per day on a log scale. */
export const MIN_VOLATILITY = 0.03;
export const MAX_VOLATILITY = 0.3;
/** Used when a queue's record is too short to measure its own drift. */
export const DEFAULT_VOLATILITY = 0.15;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/**
 * How much the 7-day average rates have moved from one day to the next, as
 * a standard deviation on a log scale. `null` if fewer than two weeks of
 * complete days are recorded. The newest row is left out, since it can be
 * a day in progress.
 */
export function measureVolatility(points: DailyPoint[]): number | null {
  const complete = points.slice(0, -1);
  const daily = (pick: (p: DailyPoint) => number) =>
    complete.slice(1).map((p, i) => Math.max(0, pick(p) - pick(complete[i])));
  const rolling = (values: number[]) =>
    values
      .map((_, i) => (i < 6 ? null : values.slice(i - 6, i + 1)))
      .filter((week): week is number[] => week !== null)
      .map((week) => week.reduce((a, b) => a + b, 0) / week.length);
  const changes = (values: number[]) =>
    values.slice(1).map((v, i) => Math.log((v + 1) / (values[i] + 1)));
  const sd = (values: number[]) => {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(
      values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
    );
  };
  const resolved = changes(rolling(daily((p) => p.totalClosed)));
  const arrivals = changes(rolling(daily((p) => p.created)));
  if (resolved.length < 7 || arrivals.length < 7) return null;
  return (sd(resolved) + sd(arrivals)) / 2;
}

/** The evidence for one queue, from its record and recent rates. */
export function calibrateQueue(
  points: DailyPoint[],
  velocity: Velocity,
  fallbackVolatility = DEFAULT_VOLATILITY
): QueueCalibration {
  const latest = points[points.length - 1];
  const days = velocity.days;
  const count = (rate: number) => Math.max(0, rate * days);
  return {
    start: {
      open: latest.open,
      byAgents: latest.agentClosed,
      byHumans: latest.humanClosed,
    },
    arrivals: { count: count(velocity.arrivals), days },
    agents: { count: count(velocity.agent), days },
    humans: { count: count(velocity.human), days },
    volatility: clamp(
      measureVolatility(points) ?? fallbackVolatility,
      MIN_VOLATILITY,
      MAX_VOLATILITY
    ),
  };
}

/** A small, fast, seedable random number generator (mulberry32). */
export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rand: () => number): number {
  const u = Math.max(rand(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** A Gamma(shape, 1) draw (Marsaglia and Tsang). */
export function gamma(shape: number, rand: () => number): number {
  if (shape < 1) {
    return gamma(shape + 1, rand) * Math.pow(rand(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = normal(rand);
    const v = (1 + c * x) ** 3;
    if (v <= 0) continue;
    const u = rand();
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
  }
}

/** A draw of a Poisson rate per day, given its evidence (Jeffreys prior). */
export function drawRate(evidence: RateEvidence, rand: () => number): number {
  if (evidence.days <= 0) return 0;
  return gamma(evidence.count + 0.5, rand) / evidence.days;
}

/** Values recorded per queue per day, in this order. */
export const FIELDS = [
  'open',
  'byAgents',
  'byHumans',
  'arrivals',
  'agents',
  'humans',
] as const;
export type Field = (typeof FIELDS)[number];
export type QueueState = Record<Field, number>;

/** Every run's path: [run][day][queue][field], days counted from 1. */
export interface Ensemble {
  runs: number;
  days: number;
  data: Float32Array;
}

export function ensembleValue(
  ensemble: Ensemble,
  run: number,
  day: number,
  queue: number,
  field: number
): number {
  return ensemble.data[
    ((run * ensemble.days + (day - 1)) * QUEUES.length + queue) *
      FIELDS.length +
      field
  ];
}

export interface EnsembleOptions {
  runs?: number;
  days?: number;
  seed?: number;
}

/** Runs the model many times, each with its own drawn and drifting rates. */
export function runEnsemble(
  simulator: Simulator,
  calibration: Record<QueueName, QueueCalibration>,
  { runs = 200, days = 365, seed = 1 }: EnsembleOptions = {}
): Ensemble {
  const rand = random(seed);
  const data = new Float32Array(runs * days * QUEUES.length * FIELDS.length);
  let i = 0;
  for (let run = 0; run < runs; run++) {
    simulator.reset();
    // Each queue's rates on a log scale: new issues per day, and the share
    // of the open backlog agents and humans resolve per day.
    const logs = QUEUES.map((queue) => {
      const c = calibration[queue];
      const open = Math.max(c.start.open, 1);
      return [
        Math.log(drawRate(c.arrivals, rand) + 1e-9),
        Math.log(drawRate(c.agents, rand) / open + 1e-12),
        Math.log(drawRate(c.humans, rand) / open + 1e-12),
      ];
    });
    let previous = QUEUES.map((queue) => ({
      ...calibration[queue].start,
    }));
    for (let day = 1; day <= days; day++) {
      QUEUES.forEach((queue, q) => {
        const sigma = calibration[queue].volatility;
        // A drift with no bias up or down in the rate's mean.
        for (let r = 0; r < 3; r++) {
          logs[q][r] += sigma * normal(rand) - (sigma * sigma) / 2;
        }
        simulator.setRate(queue, 'arrive', Math.exp(logs[q][0]));
        simulator.setRate(queue, 'agents', Math.exp(logs[q][1]));
        simulator.setRate(queue, 'humans', Math.exp(logs[q][2]));
      });
      simulator.step(1);
      previous = QUEUES.map((queue, q) => {
        const now = {
          open: simulator.value(queue, 'open'),
          byAgents: simulator.value(queue, 'byAgents'),
          byHumans: simulator.value(queue, 'byHumans'),
        };
        data[i++] = now.open;
        data[i++] = now.byAgents;
        data[i++] = now.byHumans;
        data[i++] = Math.exp(logs[q][0]);
        data[i++] = now.byAgents - previous[q].byAgents;
        data[i++] = now.byHumans - previous[q].byHumans;
        return now;
      });
    }
  }
  return { runs, days, data };
}

/** Percentiles across runs. */
export interface Band {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

function band(values: Float64Array): Band {
  values.sort();
  const at = (p: number) => {
    const position = p * (values.length - 1);
    const low = Math.floor(position);
    const high = Math.min(low + 1, values.length - 1);
    return values[low] + (values[high] - values[low]) * (position - low);
  };
  return {
    p5: at(0.05),
    p25: at(0.25),
    p50: at(0.5),
    p75: at(0.75),
    p95: at(0.95),
  };
}

/** One forecast day, summarised across runs. */
export interface ForecastDay {
  /** Days after the last recorded day. */
  day: number;
  queues: Record<QueueName, Record<Field, Band>>;
  /** Each queue's resolutions per day by everyone. */
  resolved: Record<QueueName, Band>;
  /** The Developer Doomsday Clock, at the weighting given. */
  clockHours: Band;
  /** The combined dial's rates, at the weighting given. */
  combined: { arrivals: Band; agents: Band; humans: Band; resolved: Band };
}

/** The public issues' weight for a state of both queues. */
export type WeightRule = (state: Record<QueueName, QueueState>) => number;

const share = (s: QueueState) => {
  const total = s.byAgents + s.byHumans;
  return total > 0 ? s.byAgents / total : null;
};

/** Percentile bands for each day, with the clock at a weighting. */
export function summarise(
  ensemble: Ensemble,
  weightFor: WeightRule
): ForecastDay[] {
  const { runs } = ensemble;
  const days: ForecastDay[] = [];
  const column = () => new Float64Array(runs);
  for (let day = 1; day <= ensemble.days; day++) {
    const fields = QUEUES.map(() => FIELDS.map(column));
    const resolved = QUEUES.map(column);
    const clock = column();
    const combined = { arrivals: column(), agents: column(), humans: column() };
    for (let run = 0; run < runs; run++) {
      const state = {} as Record<QueueName, QueueState>;
      QUEUES.forEach((queue, q) => {
        const s = {} as QueueState;
        FIELDS.forEach((field, f) => {
          s[field] = ensembleValue(ensemble, run, day, q, f);
          fields[q][f][run] = s[field];
        });
        resolved[q][run] = s.agents + s.humans;
        state[queue] = s;
      });
      const w = weightFor(state);
      const p = share(state.public);
      const a = share(state.agents);
      const agentShare =
        p === null ? (a ?? 0) : a === null ? p : w * p + (1 - w) * a;
      clock[run] = (1 - agentShare) * HOURS_ON_CLOCK;
      combined.arrivals[run] =
        w * state.public.arrivals + (1 - w) * state.agents.arrivals;
      combined.agents[run] =
        w * state.public.agents + (1 - w) * state.agents.agents;
      combined.humans[run] =
        w * state.public.humans + (1 - w) * state.agents.humans;
    }
    const resolvedCombined = column();
    for (let run = 0; run < runs; run++) {
      resolvedCombined[run] = combined.agents[run] + combined.humans[run];
    }
    days.push({
      day,
      queues: Object.fromEntries(
        QUEUES.map((queue, q) => [
          queue,
          Object.fromEntries(
            FIELDS.map((field, f) => [field, band(fields[q][f])])
          ),
        ])
      ) as ForecastDay['queues'],
      resolved: Object.fromEntries(
        QUEUES.map((queue, q) => [queue, band(resolved[q])])
      ) as Record<QueueName, Band>,
      clockHours: band(clock),
      combined: {
        arrivals: band(combined.arrivals),
        agents: band(combined.agents),
        humans: band(combined.humans),
        resolved: band(resolvedCombined),
      },
    });
  }
  return days;
}

/** A 90% range wider than this factor means a rate is anyone's guess. */
export const RATE_SPREAD_LIMIT = 10;
/** A 90% range of the clock wider than this many hours: half the dial. */
export const CLOCK_SPREAD_LIMIT = HOURS_ON_CLOCK / 2;

export interface Horizon {
  /** The last day worth showing. */
  day: number;
  /** Why the forecast stops there. */
  reason: 'rates' | 'clock' | 'limit';
}

/** The first day the forecast is essentially random. */
export function horizon(days: ForecastDay[]): Horizon {
  for (const d of days) {
    const spread = (b: Band) => (b.p95 + 1) / (b.p5 + 1);
    if (
      QUEUES.some((queue) => spread(d.resolved[queue]) >= RATE_SPREAD_LIMIT)
    ) {
      return { day: d.day, reason: 'rates' };
    }
    if (d.clockHours.p95 - d.clockHours.p5 >= CLOCK_SPREAD_LIMIT) {
      return { day: d.day, reason: 'clock' };
    }
  }
  return { day: days.length, reason: 'limit' };
}
