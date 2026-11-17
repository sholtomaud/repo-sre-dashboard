/**
 * What the dashboard says beyond the headline counts: how issues were
 * closed, the doom loop under stricter definitions, and the agents' own
 * queue. DOM-free; unit-tested with `node --test`.
 */
import {
  doomLoop,
  doomLoopRatio,
  parseCsv,
  toPoints,
  velocity,
  type Closures,
  type DailyPoint,
  type DoomLoop,
  type Velocity,
} from './metrics.ts';

/** A summary of every closure so far. */
export interface ClosureSummary {
  total: number;
  byEvidence: Closures;
  /** Share of closures that reference a fix, 0–1. */
  referencedShare: number;
}

export function closureSummary(latest: DailyPoint): ClosureSummary | null {
  if (!latest.closures) return null;
  const total = Object.values(latest.closures).reduce((a, b) => a + b, 0);
  return {
    total,
    byEvidence: latest.closures,
    referencedShare: total > 0 ? latest.closures.fix_referenced / total : 0,
  };
}

/**
 * The history re-counted so that only some issues and some closures count:
 * `created` and `closed` pick the running totals to use.
 */
function recount(
  points: DailyPoint[],
  pick: (point: DailyPoint) => { created: number; closed: number } | null
): DailyPoint[] | null {
  const rows = [];
  for (const point of points) {
    const totals = pick(point);
    if (!totals) return null;
    rows.push({
      date: point.date,
      open: totals.created - totals.closed,
      agentClosed: 0,
      humanClosed: totals.closed,
    });
  }
  return toPoints(rows);
}

/** The doom loop ratio under stricter definitions of "closed". */
export interface StrictRatios {
  /**
   * Issues opened per closure that references a fix. `undefined` when the
   * data does not record closure evidence yet.
   */
  referenced?: number | null;
  /** Behaviour reports opened per behaviour report closed. */
  behavior?: number | null;
}

export function strictRatios(
  points: DailyPoint[],
  windowDays = 7,
  asOf?: string
): StrictRatios {
  const ratio = (recounted: DailyPoint[] | null) =>
    recounted
      ? doomLoopRatio(velocity(recounted, windowDays, asOf))
      : undefined;
  return {
    referenced: ratio(
      recount(points, (p) =>
        p.closures
          ? { created: p.created, closed: p.closures.fix_referenced }
          : null
      )
    ),
    behavior: ratio(recount(points, (p) => p.behavior ?? null)),
  };
}

/**
 * The agents' own queue: problems IssueFinderAgent files as documents in the
 * repository, which agents resolve. `agent_queue.csv`
 * holds, per day, the files still open and the files resolved.
 */
export interface AgentQueue {
  date: string;
  open: number;
  resolved: number;
  /** The daily history, in the same form as the public issues'. */
  points: DailyPoint[];
  /** `agent` is resolutions per day, `arrivals` new problems filed per day. */
  velocity: Velocity;
  /** Problems filed per problem resolved. */
  ratio: number | null;
  /** The same doom loop measures as the public issues get. */
  loop: DoomLoop;
}

export function buildAgentQueue(
  csv: string,
  windowDays = 7,
  asOf?: string
): AgentQueue | null {
  const [header = '', ...rest] = csv.trim().split(/\r?\n/);
  const names = header.split(',').map((name) => name.trim());
  const column = (name: string) => names.indexOf(name);
  const [date, open, resolved] = ['date', 'open', 'resolved'].map(column);
  // Added later: resolutions made by people. Without it, all are agents'.
  const byHuman = column('resolved_by_human');
  if (date === -1 || open === -1 || resolved === -1 || rest.length === 0) {
    return null;
  }
  // The same shape as data.csv, so every measure works on both queues.
  const lines = rest.map((line) => {
    const cells = line.split(',').map((cell) => cell.trim());
    const human = byHuman === -1 ? 0 : Number(cells[byHuman]) || 0;
    const agents = Number(cells[resolved]) - human;
    return `${cells[date]},${cells[open]},${agents},${human}`;
  });
  const points = toPoints(
    parseCsv(['date,open,agent_closed,human_closed', ...lines].join('\n'))
  );
  const latest = points[points.length - 1];
  const rates = velocity(points, windowDays, asOf);
  return {
    date: latest.date,
    open: latest.open,
    resolved: latest.totalClosed,
    points,
    velocity: rates,
    ratio: doomLoopRatio(rates),
    loop: doomLoop(points, windowDays, asOf),
  };
}

/** Loads agent_queue.csv; `null` if it is missing or empty. */
export async function loadAgentQueue(
  asOf?: string,
  fetchImpl: typeof fetch = fetch,
  url = 'data/agent_queue.csv'
): Promise<AgentQueue | null> {
  try {
    const response = await fetchImpl(url, { cache: 'no-cache' });
    return response.ok ? buildAgentQueue(await response.text(), 7, asOf) : null;
  } catch {
    return null;
  }
}
