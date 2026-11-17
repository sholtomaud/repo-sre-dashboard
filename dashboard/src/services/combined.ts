/**
 * Version 2 of the dashboard's headline measures: the public GitHub issues
 * and the agents' own queue combined under a weighting. `publicWeight` is
 * the public issues' weight, 0–1; the agents' queue gets the rest.
 *
 * DOM-free; unit-tested with `node --test`.
 */
import {
  HOURS_ON_CLOCK,
  doomLoopLevel,
  type DailyPoint,
  type DoomLoop,
  type Velocity,
} from './metrics.ts';

/** One queue, in the form every measure needs. */
export interface Queue {
  latest: DailyPoint;
  velocity: Velocity;
  loop: DoomLoop;
}

/** Used when status.json does not say; matches the tracker's default. */
export const DEFAULT_PUBLIC_WEIGHT = 0.5;

/** Share of a queue's resolutions done by agents; `null` if none yet. */
export function queueAgentShare(queue: Queue): number | null {
  return queue.latest.totalClosed > 0 ? queue.latest.agentShare : null;
}

const mix = (a: number, b: number, w: number) => w * a + (1 - w) * b;

/**
 * The combined agent resolution share. A queue with no resolutions yet is
 * left out; with none in either, agents have resolved nothing.
 */
export function combinedAgentShare(
  publicQueue: Queue,
  agents: Queue | null,
  publicWeight: number
): number {
  const p = queueAgentShare(publicQueue);
  const a = agents ? queueAgentShare(agents) : null;
  if (p === null) return a ?? 0;
  if (a === null) return p;
  return mix(p, a, publicWeight);
}

/** Hours to midnight on the Developer Doomsday Clock, version 2. */
export function combinedHoursToMidnight(
  publicQueue: Queue,
  agents: Queue | null,
  publicWeight: number
): number {
  return (
    (1 - combinedAgentShare(publicQueue, agents, publicWeight)) * HOURS_ON_CLOCK
  );
}

/** Daily rates as the weighted average of the two queues' rates. */
export function combinedVelocity(
  publicQueue: Queue,
  agents: Queue | null,
  publicWeight: number
): Velocity {
  if (!agents) return publicQueue.velocity;
  const p = publicQueue.velocity;
  const a = agents.velocity;
  return {
    agent: mix(p.agent, a.agent, publicWeight),
    human: mix(p.human, a.human, publicWeight),
    arrivals: mix(p.arrivals, a.arrivals, publicWeight),
    netBacklog: mix(p.netBacklog, a.netBacklog, publicWeight),
    days: Math.max(p.days, a.days),
    since: p.since < a.since ? p.since : a.since,
  };
}

/**
 * Two ratios combined as a weighted geometric mean, so that 2× in one queue
 * and ½× in the other average to break-even. A queue with no activity is
 * left out; a queue with no closures at all makes the result infinite.
 */
export function combineRatios(
  publicRatio: number | null,
  agentRatio: number | null,
  publicWeight: number
): number | null {
  if (publicRatio === null || publicWeight === 0) {
    return publicWeight === 1 ? publicRatio : agentRatio;
  }
  if (agentRatio === null || publicWeight === 1) return publicRatio;
  if (!Number.isFinite(publicRatio) || !Number.isFinite(agentRatio)) {
    return Number.POSITIVE_INFINITY;
  }
  if (publicRatio <= 0 || agentRatio <= 0) return 0;
  return Math.exp(
    mix(Math.log(publicRatio), Math.log(agentRatio), publicWeight)
  );
}

/** The doom loop across both queues. It has no single backlog to project. */
export function combinedDoomLoop(
  publicQueue: Queue,
  agents: Queue | null,
  publicWeight: number
): DoomLoop {
  if (!agents) return publicQueue.loop;
  const ratio = combineRatios(
    publicQueue.loop.ratio,
    agents.loop.ratio,
    publicWeight
  );
  const agentHistory = new Map(
    agents.loop.history.map((entry) => [entry.date, entry.ratio])
  );
  return {
    ratio,
    level: doomLoopLevel(ratio),
    history: publicQueue.loop.history
      .filter((entry) => agentHistory.has(entry.date))
      .map((entry) => ({
        date: entry.date,
        ratio: combineRatios(
          entry.ratio,
          agentHistory.get(entry.date)!,
          publicWeight
        ),
      })),
    doublingDays: null,
    clearDays: null,
  };
}

/** A named position on the weighting slider. */
export interface WeightMark {
  id: 'public' | 'equal' | 'backlog' | 'effort' | 'agents';
  label: string;
  /** The public issues' weight at this mark, 0–1. */
  weight: number;
}

/** Resolutions per day by anyone, agents or people. */
const resolutions = (queue: Queue) =>
  queue.velocity.agent + queue.velocity.human;

/** The public issues' share of all open items. */
export function backlogShare(publicQueue: Queue, agents: Queue): number {
  const total = publicQueue.latest.open + agents.latest.open;
  return total > 0 ? publicQueue.latest.open / total : 0;
}

/** The public issues' share of all resolutions per day: revealed priority. */
export function effortShare(publicQueue: Queue, agents: Queue): number {
  const total = resolutions(publicQueue) + resolutions(agents);
  return total > 0 ? resolutions(publicQueue) / total : 0;
}

/**
 * How much attention the public issues get for their size: their share of
 * resolutions divided by their share of the open backlog. 1 is attention in
 * proportion; below 1, the public issues get less than their share.
 */
export function attentionIndex(
  publicQueue: Queue,
  agents: Queue
): number | null {
  const backlog = backlogShare(publicQueue, agents);
  return backlog > 0 ? effortShare(publicQueue, agents) / backlog : null;
}

/** The slider's marked positions, from the data. */
export function weightMarks(
  publicQueue: Queue,
  agents: Queue,
  defaultWeight = DEFAULT_PUBLIC_WEIGHT
): WeightMark[] {
  return [
    { id: 'agents', label: "Agents' queue only", weight: 0 },
    {
      id: 'effort',
      label: 'By actual effort',
      weight: effortShare(publicQueue, agents),
    },
    {
      id: 'backlog',
      label: 'By backlog size',
      weight: backlogShare(publicQueue, agents),
    },
    { id: 'equal', label: 'Equal per queue (default)', weight: defaultWeight },
    { id: 'public', label: 'Public issues only (v1)', weight: 1 },
  ];
}
