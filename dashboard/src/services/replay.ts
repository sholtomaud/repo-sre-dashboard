/**
 * Replaying the record: the state of both queues as of each day, and a
 * smooth state for any moment in between.
 *
 * DOM-free; unit-tested with `node --test`.
 */
import {
  doomLoop,
  doomLoopLevel,
  velocity,
  type DailyPoint,
  type DoomLoop,
  type Velocity,
} from './metrics.ts';
import type { Queue } from './combined.ts';
import type { Band, ForecastDay } from './forecast.ts';

/** A 90% range: the 5th and 95th percentiles, and the median. */
export interface Range {
  low: number;
  mid: number;
  high: number;
}

/** What a forecast day adds to a frame. */
export interface FrameForecast {
  /** Days after the last recorded day; fractional between days. */
  day: number;
  /** 0 today, 1 at the forecast horizon: how far the hands have faded. */
  fade: number;
  /** Hours to midnight on the Developer Doomsday Clock. */
  clock: Range;
  /** Issues resolved per day on each dial. */
  resolved: Record<'public' | 'agents' | 'combined', Range>;
}

/** Both queues as they stood at the end of one day, or are forecast to. */
export interface Frame {
  date: string;
  /** `null` before the queue's first day of data. */
  publicQueue: Queue | null;
  agents: Queue | null;
  /** Present on forecast days only. */
  forecast?: FrameForecast;
}

const MS_PER_DAY = 86_400_000;

function queueAsOf(
  points: DailyPoint[],
  date: string,
  windowDays: number,
  asOf?: string
): Queue | null {
  const upTo = points.filter((point) => point.date <= date);
  if (upTo.length === 0) return null;
  // Only the newest row of the whole record can be a day in progress.
  const partial = upTo.length === points.length ? asOf : undefined;
  return {
    latest: upTo[upTo.length - 1],
    velocity: velocity(upTo, windowDays, partial),
    loop: doomLoop(upTo, windowDays, partial),
  };
}

/** One frame per day, from the first day either queue has data to the last. */
export function buildFrames(
  publicPoints: DailyPoint[],
  agentPoints: DailyPoint[],
  windowDays = 7,
  asOf?: string
): Frame[] {
  const dates = [...publicPoints, ...agentPoints].map((point) => point.date);
  if (dates.length === 0) return [];
  const first = dates.reduce((a, b) => (a < b ? a : b));
  const last = dates.reduce((a, b) => (a > b ? a : b));

  const frames: Frame[] = [];
  for (
    let time = Date.parse(first);
    time <= Date.parse(last);
    time += MS_PER_DAY
  ) {
    const date = new Date(time).toISOString().slice(0, 10);
    frames.push({
      date,
      publicQueue: queueAsOf(publicPoints, date, windowDays, asOf),
      agents: queueAsOf(agentPoints, date, windowDays, asOf),
    });
  }
  return frames;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Ratios move on a log scale, so halving and doubling take equal time. */
function lerpRatio(
  a: number | null,
  b: number | null,
  t: number
): number | null {
  const usable = (r: number | null): r is number =>
    r !== null && Number.isFinite(r) && r > 0;
  if (usable(a) && usable(b)) {
    return Math.exp(lerp(Math.log(a), Math.log(b), t));
  }
  return t < 0.5 ? a : b;
}

function lerpVelocity(a: Velocity, b: Velocity, t: number): Velocity {
  return {
    agent: lerp(a.agent, b.agent, t),
    human: lerp(a.human, b.human, t),
    arrivals: lerp(a.arrivals, b.arrivals, t),
    netBacklog: lerp(a.netBacklog, b.netBacklog, t),
    days: lerp(a.days, b.days, t),
    since: t < 0.5 ? a.since : b.since,
  };
}

function lerpPoint(a: DailyPoint, b: DailyPoint, t: number): DailyPoint {
  const agentClosed = lerp(a.agentClosed, b.agentClosed, t);
  const humanClosed = lerp(a.humanClosed, b.humanClosed, t);
  const totalClosed = agentClosed + humanClosed;
  const open = lerp(a.open, b.open, t);
  const agentShare = totalClosed > 0 ? agentClosed / totalClosed : 0;
  return {
    date: t < 1 ? a.date : b.date,
    open,
    agentClosed,
    humanClosed,
    totalClosed,
    created: open + totalClosed,
    agentShare,
    hoursToMidnight: lerp(a.hoursToMidnight, b.hoursToMidnight, t),
  };
}

function lerpLoop(a: DoomLoop, b: DoomLoop, t: number): DoomLoop {
  const ratio = lerpRatio(a.ratio, b.ratio, t);
  const nearest = t < 0.5 ? a : b;
  return {
    ratio,
    level: doomLoopLevel(ratio),
    // The sparkline grows a day at a time.
    history: a.history,
    doublingDays: nearest.doublingDays,
    clearDays: nearest.clearDays,
  };
}

function lerpQueue(a: Queue | null, b: Queue | null, t: number): Queue | null {
  // A queue appears on its first day; there is nothing to blend from.
  if (!a || !b) return t < 1 ? a : b;
  return {
    latest: lerpPoint(a.latest, b.latest, t),
    velocity: lerpVelocity(a.velocity, b.velocity, t),
    loop: lerpLoop(a.loop, b.loop, t),
  };
}

/**
 * The state at a position in the record. `position` counts days from the
 * first frame and may be fractional: 2.5 is half-way from day 2 to day 3.
 */
export function frameAt(frames: Frame[], position: number): Frame {
  const clamped = Math.min(Math.max(position, 0), frames.length - 1);
  const index = Math.floor(clamped);
  const from = frames[index];
  const to = frames[Math.min(index + 1, frames.length - 1)];
  const t = clamped - index;
  if (t === 0 || from === to) return from;
  return {
    date: from.date,
    publicQueue: lerpQueue(from.publicQueue, to.publicQueue, t),
    agents: lerpQueue(from.agents, to.agents, t),
    ...(to.forecast
      ? { forecast: lerpForecast(from.forecast, to.forecast, t) }
      : {}),
  };
}

function lerpRange(a: Range, b: Range, t: number): Range {
  return {
    low: lerp(a.low, b.low, t),
    mid: lerp(a.mid, b.mid, t),
    high: lerp(a.high, b.high, t),
  };
}

/** From today (no range) the range opens out of the median. */
function lerpForecast(
  a: FrameForecast | undefined,
  b: FrameForecast,
  t: number
): FrameForecast {
  const point = (r: Range): Range => ({ low: r.mid, mid: r.mid, high: r.mid });
  const from = a ?? {
    day: 0,
    fade: 0,
    clock: point(b.clock),
    resolved: {
      public: point(b.resolved.public),
      agents: point(b.resolved.agents),
      combined: point(b.resolved.combined),
    },
  };
  return {
    day: lerp(from.day, b.day, t),
    fade: lerp(from.fade, b.fade, t),
    clock: lerpRange(from.clock, b.clock, t),
    resolved: {
      public: lerpRange(from.resolved.public, b.resolved.public, t),
      agents: lerpRange(from.resolved.agents, b.resolved.agents, t),
      combined: lerpRange(from.resolved.combined, b.resolved.combined, t),
    },
  };
}

const range = (b: Band): Range => ({ low: b.p5, mid: b.p50, high: b.p95 });

/** A queue's medians, in the form the panels draw. */
function medianQueue(
  date: string,
  q: ForecastDay['queues']['public'],
  history: DoomLoop['history']
): Queue {
  const open = q.open.p50;
  const agentClosed = q.byAgents.p50;
  const humanClosed = q.byHumans.p50;
  const totalClosed = agentClosed + humanClosed;
  const agentShare = totalClosed > 0 ? agentClosed / totalClosed : 0;
  const arrivals = q.arrivals.p50;
  const resolved = q.agents.p50 + q.humans.p50;
  const net = arrivals - resolved;
  const ratio =
    resolved > 0 ? arrivals / resolved : arrivals > 0 ? Infinity : null;
  return {
    latest: {
      date,
      open,
      agentClosed,
      humanClosed,
      totalClosed,
      created: open + totalClosed,
      agentShare,
      hoursToMidnight: (1 - agentShare) * 24,
    },
    velocity: {
      agent: q.agents.p50,
      human: q.humans.p50,
      arrivals,
      netBacklog: net,
      days: 1,
      since: '',
    },
    loop: {
      ratio,
      level: doomLoopLevel(ratio),
      history,
      doublingDays: net > 0 && open > 0 ? open / net : null,
      clearDays: net < 0 ? open / -net : null,
    },
  };
}

/**
 * One frame per forecast day up to the horizon, after the last recorded
 * date. The panels draw the medians; the ranges go with them.
 */
export function forecastFrames(
  days: ForecastDay[],
  horizonDay: number,
  lastDate: string,
  histories: { public: DoomLoop['history']; agents: DoomLoop['history'] }
): Frame[] {
  const start = Date.parse(lastDate);
  return days.slice(0, horizonDay).map((d) => {
    const date = new Date(start + d.day * MS_PER_DAY)
      .toISOString()
      .slice(0, 10);
    return {
      date,
      publicQueue: medianQueue(date, d.queues.public, histories.public),
      agents: medianQueue(date, d.queues.agents, histories.agents),
      forecast: {
        day: d.day,
        fade: d.day / horizonDay,
        clock: range(d.clockHours),
        resolved: {
          public: range(d.resolved.public),
          agents: range(d.resolved.agents),
          combined: range(d.combined.resolved),
        },
      },
    };
  });
}

/** The largest daily rate anywhere in the record, to fix a dial's scale. */
export function peakRate(
  frames: Frame[],
  rates: (frame: Frame) => Velocity | null
): number {
  let peak = 0;
  for (const frame of frames) {
    const v = rates(frame);
    if (v) peak = Math.max(peak, v.agent, v.human, v.arrivals);
  }
  return peak;
}
