/**
 * The project outlook: whether the repository stays manageable, and when it
 * would stop being so, forecast with the GSSK kernel and Bayesian rates.
 *
 * - Manageable means every class of issue (security, bug, other) is dealt
 *   with inside its limit: by Little's law, a new issue's expected wait is
 *   the open issues in its class divided by the class's resolutions per day.
 * - The doom date is the first day the chance of having lost control
 *   reaches 50%: for agents and humans together, for humans alone, and for
 *   cost, once prices are set.
 * - The completion date is when the open backlog could reach zero.
 * - The manageability index is the chance of staying in control up to the
 *   forecast horizon, where the forecast stops being better than a guess.
 * - The agents' effect compares the forecast with a counterfactual in which
 *   agents neither file nor resolve issues.
 * - Reliability back-tests the model on the record.
 *
 * DOM-free; unit-tested with `node --test`.
 */
import { toPoints, velocity, type DailyPoint } from './metrics.ts';
import {
  FIELDS,
  ensembleValue,
  measureVolatility,
  DEFAULT_VOLATILITY,
  MIN_VOLATILITY,
  MAX_VOLATILITY,
  runEnsemble,
  type Ensemble,
  type QueueCalibration,
} from './forecast.ts';
import type { Simulator, QueueStart } from '../lib/gssk-simulator.ts';

export const CLASSES = ['security', 'bug', 'other'] as const;
export type IssueClass = (typeof CLASSES)[number];
export type Limits = Record<IssueClass, number>;
export const DEFAULT_LIMITS: Limits = { security: 7, bug: 30, other: 180 };

/** One class's history, with who filed each issue. */
export interface ClassHistory {
  points: DailyPoint[];
  /** Running total of issues filed by agents, row by row. */
  agentOpened: number[];
}

/**
 * The per-class columns of data.csv; `null` when the file predates them
 * (the tracker adds them from version 2 of the outlook).
 */
export function parseClassHistory(
  csv: string
): Record<IssueClass, ClassHistory> | null {
  const [header = '', ...lines] = csv.trim().split(/\r?\n/);
  const names = header.split(',').map((n) => n.trim());
  const col = (name: string) => names.indexOf(name);
  if (col('security_opened_by_agents') === -1) return null;
  const rows = lines
    .map((line) => line.split(',').map((c) => c.trim()))
    .filter((cells) => /^\d{4}-\d{2}-\d{2}$/.test(cells[col('date')] ?? ''))
    .sort((a, b) => a[col('date')].localeCompare(b[col('date')]));
  const out = {} as Record<IssueClass, ClassHistory>;
  for (const c of CLASSES) {
    const n = (cells: string[], field: string) =>
      Number(cells[col(`${c}_${field}`)]) || 0;
    const agentOpened = rows.map((cells) => n(cells, 'opened_by_agents'));
    const points = toPoints(
      rows.map((cells) => {
        const opened =
          n(cells, 'opened_by_agents') + n(cells, 'opened_by_humans');
        const agentClosed = n(cells, 'closed_by_agents');
        const humanClosed = n(cells, 'closed_by_humans');
        return {
          date: cells[col('date')],
          open: opened - agentClosed - humanClosed,
          agentClosed,
          humanClosed,
        };
      })
    );
    out[c] = { points, agentOpened };
  }
  return out;
}

/** The sum of the classes, as one history. */
export function totalHistory(
  classes: Record<IssueClass, ClassHistory>
): DailyPoint[] {
  const first = classes[CLASSES[0]].points;
  return toPoints(
    first.map((p, i) => ({
      date: p.date,
      open: CLASSES.reduce((s, c) => s + classes[c].points[i].open, 0),
      agentClosed: CLASSES.reduce(
        (s, c) => s + classes[c].points[i].agentClosed,
        0
      ),
      humanClosed: CLASSES.reduce(
        (s, c) => s + classes[c].points[i].humanClosed,
        0
      ),
    }))
  );
}

/** Open-issue-days over the last `days` rows: the exposure for resolutions. */
function exposure(points: DailyPoint[], days: number): number {
  const recent = points.slice(-Math.max(1, Math.round(days) + 1));
  const meanOpen =
    recent.reduce((s, p) => s + Math.max(0, p.open), 0) / recent.length;
  return meanOpen * days;
}

/** How much a class's own record must outweigh the pooled prior: one event. */
const PRIOR_EVENTS = 1;

/**
 * Each class's evidence for the forecast, from the last week.
 *
 * Resolution rates are per open issue and partially pooled: each class
 * starts from the repository's overall rate as a prior worth one
 * resolution, and its own record takes over as it builds up. A class with
 * no history (no security issues yet, say) is then expected to be handled
 * like the rest of the repository, rather than never.
 */
export function calibrateClasses(
  classes: Record<IssueClass, ClassHistory>,
  asOf?: string,
  windowDays = 7
): Record<IssueClass, QueueCalibration> {
  const total = totalHistory(classes);
  const tv = velocity(total, windowDays, asOf);
  const totalExposure = exposure(total, tv.days);
  // The pooled rates per open issue per day, with a floor for a repository
  // that has resolved nothing yet.
  const pooledAgents =
    totalExposure > 0 ? (tv.agent * tv.days) / totalExposure : 0;
  const pooledHumans =
    totalExposure > 0 ? (tv.human * tv.days) / totalExposure : 0;
  const pooled = Math.max(pooledAgents + pooledHumans, 1e-3);
  const agentMix =
    pooledAgents + pooledHumans > 0
      ? pooledAgents / (pooledAgents + pooledHumans)
      : 0;
  const volatility = Math.min(
    MAX_VOLATILITY,
    Math.max(
      MIN_VOLATILITY,
      measureVolatility(totalHistory(classes)) ?? DEFAULT_VOLATILITY
    )
  );
  const out = {} as Record<IssueClass, QueueCalibration>;
  for (const c of CLASSES) {
    const { points, agentOpened } = classes[c];
    const latest = points[points.length - 1];
    const v = velocity(points, windowDays, asOf);
    const days = v.days;
    const from = points.findIndex((p) => p.date === v.since);
    const agentFiled =
      from === -1
        ? 0
        : Math.max(0, agentOpened[agentOpened.length - 1] - agentOpened[from]);
    const filed = Math.max(0, v.arrivals * days);
    const own = exposure(points, days);
    const prior = (share: number) => ({
      count: PRIOR_EVENTS * share,
      days: (PRIOR_EVENTS * share) / Math.max(pooled * share, 1e-9),
    });
    const agentsPrior = prior(agentMix);
    const humansPrior = prior(1 - agentMix);
    out[c] = {
      start: {
        open: latest.open,
        byAgents: latest.agentClosed,
        byHumans: latest.humanClosed,
      },
      arrivals: { count: Math.max(0, filed - agentFiled), days },
      agentArrivals: { count: agentFiled, days },
      agents: { count: Math.max(0, v.agent * days), days },
      humans: { count: Math.max(0, v.human * days), days },
      agentsPerOpen: {
        count: Math.max(0, v.agent * days) + agentsPrior.count,
        days: own + agentsPrior.days,
      },
      humansPerOpen: {
        count: Math.max(0, v.human * days) + humansPrior.count,
        days: own + humansPrior.days,
      },
      volatility,
    };
  }
  return out;
}

/** Expected wait for a new issue, in days, by Little's law. */
export function expectedWait(open: number, resolvedPerDay: number): number {
  if (open < 0.5) return 0;
  return resolvedPerDay > 1e-6
    ? open / resolvedPerDay
    : Number.POSITIVE_INFINITY;
}

/**
 * Classes with at least one issue on record. A class with none (no
 * security issues yet, say) is not judged: its handling is unknown, and
 * the dashboard says so rather than guess.
 */
export function assessedClasses(
  classes: Record<IssueClass, ClassHistory>
): IssueClass[] {
  return CLASSES.filter((c) => {
    const last = classes[c].points[classes[c].points.length - 1];
    return last && last.created > 0;
  });
}

/** Each class now: open issues, resolutions per day, expected wait. */
export function classesNow(
  classes: Record<IssueClass, ClassHistory>,
  limits: Limits,
  asOf?: string
) {
  return Object.fromEntries(
    CLASSES.map((c) => {
      const { points } = classes[c];
      const v = velocity(points, 7, asOf);
      const open = points[points.length - 1].open;
      const wait = expectedWait(open, v.agent + v.human);
      const humanWait = expectedWait(open, v.human);
      return [
        c,
        {
          open,
          resolvedPerDay: v.agent + v.human,
          waitDays: wait,
          humanWaitDays: humanWait,
          limitDays: limits[c],
          over: wait > limits[c],
          humanOver: humanWait > limits[c],
        },
      ];
    })
  ) as Record<
    IssueClass,
    {
      open: number;
      resolvedPerDay: number;
      waitDays: number;
      humanWaitDays: number;
      limitDays: number;
      over: boolean;
      humanOver: boolean;
    }
  >;
}

export interface CostConfig {
  currency: string;
  agentPerIssue: number;
  humanHourlyRate: number;
  humanHoursPerIssue: number;
  monthlyBudget: number | null;
}

/** When control is lost, by one measure. */
export interface Doom {
  /** Days from today; 0 if already lost; `null` if not within the horizon. */
  day: number | null;
  /** Chance of having lost control by the horizon, 0–1. */
  byHorizon: number;
  /** The chance by each day, from day 1 to the horizon. */
  curve: number[];
  /** Each class's chance of being the one past its limit by the horizon. */
  byClass?: Record<IssueClass, number>;
}

export interface Outlook {
  /** The classes judged: those with at least one issue on record. */
  judged: IssueClass[];
  /** Each class now. */
  now: ReturnType<typeof classesNow>;
  horizonDay: number;
  horizonReason: 'rates' | 'limit';
  /** Chance of staying manageable up to the horizon, 0–1. */
  index: number;
  doom: { all: Doom; humans: Doom; cost: Doom | null };
  completion:
    | { state: 'diverging' }
    | { state: 'beyond'; days: number }
    | { state: 'forecast'; p50: number; p85: number | null };
  agents: {
    verdict: 'benefit' | 'burden' | 'neutral' | 'none';
    /** Chance of losing control by the horizon, with and without agents. */
    withAgents: number;
    withoutAgents: number;
    /** Median open issues at the horizon, with and without agents. */
    openWith: number;
    openWithout: number;
  };
  cost: {
    monthlySpendNow: number;
    monthlyToKeepPace: number;
    currency: string;
  } | null;
}

const F = Object.fromEntries(FIELDS.map((f, i) => [f, i])) as Record<
  (typeof FIELDS)[number],
  number
>;

/** A rolling 7-day mean of a run's daily flow. */
function rolling(
  e: Ensemble,
  run: number,
  day: number,
  q: number,
  field: number
): number {
  let total = 0;
  let n = 0;
  for (let d = Math.max(1, day - 6); d <= day; d++) {
    total += ensembleValue(e, run, d, q, field);
    n++;
  }
  return total / n;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

/** The first day the forecast is anyone's guess: rates uncertain by 10×. */
export function outlookHorizon(e: Ensemble): {
  day: number;
  reason: 'rates' | 'limit';
} {
  for (let day = 1; day <= e.days; day++) {
    const totals: number[] = [];
    for (let run = 0; run < e.runs; run++) {
      let t = 0;
      for (let q = 0; q < e.names.length; q++) {
        t +=
          ensembleValue(e, run, day, q, F.agents) +
          ensembleValue(e, run, day, q, F.humans);
      }
      totals.push(t);
    }
    if ((percentile(totals, 0.95) + 1) / (percentile(totals, 0.05) + 1) >= 10) {
      return { day, reason: 'rates' };
    }
  }
  return { day: e.days, reason: 'limit' };
}

/**
 * When control is lost: the first day the chance of any class being past
 * its limit reaches 50%. `humansOnly` counts people's resolutions alone.
 */
export function doomDate(
  e: Ensemble,
  limits: Limits,
  horizonDay: number,
  {
    humansOnly = false,
    alreadyLost = false,
    judged = CLASSES as readonly IssueClass[],
  } = {}
): Doom {
  const lost = Array.from<boolean>({ length: e.runs }).fill(alreadyLost);
  const lostClass = CLASSES.map(() =>
    Array.from<boolean>({ length: e.runs }).fill(false)
  );
  const curve: number[] = [];
  let day: number | null = alreadyLost ? 0 : null;
  for (let d = 1; d <= horizonDay; d++) {
    for (let run = 0; run < e.runs; run++) {
      CLASSES.forEach((c, i) => {
        if (!judged.includes(c)) return;
        const q = e.names.indexOf(c);
        const open = ensembleValue(e, run, d, q, F.open);
        const rate =
          rolling(e, run, d, q, F.humans) +
          (humansOnly ? 0 : rolling(e, run, d, q, F.agents));
        if (expectedWait(open, rate) > limits[c]) {
          lost[run] = true;
          lostClass[i][run] = true;
        }
      });
    }
    const p = lost.filter(Boolean).length / e.runs;
    curve.push(p);
    if (day === null && p >= 0.5) day = d;
  }
  return {
    day,
    byHorizon: curve.length ? curve[curve.length - 1] : alreadyLost ? 1 : 0,
    curve,
    byClass: Object.fromEntries(
      CLASSES.map((c, i) => [c, lostClass[i].filter(Boolean).length / e.runs])
    ) as Record<IssueClass, number>,
  };
}

/** Monthly cost to resolve issues as fast as they arrive, at a state. */
export function costToKeepPace(
  cost: CostConfig,
  arrivalsPerDay: number,
  agentShare: number
): number {
  const human = cost.humanHourlyRate * cost.humanHoursPerIssue;
  return (
    30 *
    arrivalsPerDay *
    (agentShare * cost.agentPerIssue + (1 - agentShare) * human)
  );
}

/** When keeping pace with new issues would exceed the monthly budget. */
export function costDoom(
  e: Ensemble,
  cost: CostConfig,
  horizonDay: number
): Doom | null {
  if (cost.monthlyBudget === null) return null;
  const over = Array.from<boolean>({ length: e.runs }).fill(false);
  const curve: number[] = [];
  let day: number | null = null;
  for (let d = 1; d <= horizonDay; d++) {
    for (let run = 0; run < e.runs; run++) {
      let arrivals = 0;
      let agents = 0;
      let all = 0;
      for (let q = 0; q < e.names.length; q++) {
        arrivals += rolling(e, run, d, q, F.arrivals);
        agents += rolling(e, run, d, q, F.agents);
        all +=
          rolling(e, run, d, q, F.agents) + rolling(e, run, d, q, F.humans);
      }
      const share = all > 0 ? agents / all : 0;
      if (costToKeepPace(cost, arrivals, share) > cost.monthlyBudget) {
        over[run] = true;
      }
    }
    const p = over.filter(Boolean).length / e.runs;
    curve.push(p);
    if (day === null && p >= 0.5) day = d;
  }
  return { day, byHorizon: curve.at(-1) ?? 0, curve };
}

/** When the open backlog could reach zero, or that it is diverging. */
export function completion(
  e: Ensemble,
  diverging: boolean
): Outlook['completion'] {
  if (diverging) return { state: 'diverging' };
  const doneDay = Array.from<number | null>({ length: e.runs }).fill(null);
  for (let run = 0; run < e.runs; run++) {
    for (let d = 1; d <= e.days; d++) {
      let open = 0;
      for (let q = 0; q < e.names.length; q++) {
        open += ensembleValue(e, run, d, q, F.open);
      }
      if (open < 0.5) {
        doneDay[run] = d;
        break;
      }
    }
  }
  const finished = doneDay
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);
  const at = (p: number) =>
    finished.length >= Math.ceil(p * e.runs)
      ? finished[Math.ceil(p * e.runs) - 1]
      : null;
  const p50 = at(0.5);
  if (p50 === null) return { state: 'beyond', days: e.days };
  return { state: 'forecast', p50, p85: at(0.85) };
}

/** Median open issues, summed over the classes, on a day. */
function medianOpen(e: Ensemble, day: number): number {
  const totals: number[] = [];
  for (let run = 0; run < e.runs; run++) {
    let t = 0;
    for (let q = 0; q < e.names.length; q++)
      t += ensembleValue(e, run, day, q, F.open);
    totals.push(t);
  }
  return percentile(totals, 0.5);
}

/**
 * The agents' effect, comparing the forecast with the counterfactual
 * without them. Benefit if agents lower the chance of losing control by 5
 * points or more; burden if they raise it as much. When the chance hardly
 * moves (both near certain, say), the median backlog at the horizon
 * decides, at a 10% difference.
 */
export function agentsVerdict(
  withAgents: Doom,
  withoutAgents: Doom,
  openWith: number,
  openWithout: number,
  agentsActive: boolean
): Outlook['agents']['verdict'] {
  if (!agentsActive) return 'none';
  const dp = withAgents.byHorizon - withoutAgents.byHorizon;
  if (dp <= -0.05) return 'benefit';
  if (dp >= 0.05) return 'burden';
  const scale = Math.max(openWith, openWithout, 1);
  if ((openWithout - openWith) / scale >= 0.1) return 'benefit';
  if ((openWith - openWithout) / scale >= 0.1) return 'burden';
  return 'neutral';
}

export interface OutlookOptions {
  limits?: Limits;
  cost?: CostConfig | null;
  asOf?: string;
  runs?: number;
  days?: number;
  seed?: number;
}

/** The whole outlook, from the class history, on the GSSK kernel. */
export async function buildOutlook(
  classes: Record<IssueClass, ClassHistory>,
  loadSimulator: (
    start: Record<string, QueueStart>,
    names: readonly string[]
  ) => Promise<Simulator>,
  {
    limits = DEFAULT_LIMITS,
    cost = null,
    asOf,
    runs = 150,
    days = 180,
    seed = 1,
  }: OutlookOptions = {}
): Promise<Outlook> {
  const calibration = calibrateClasses(classes, asOf);
  const start = Object.fromEntries(
    CLASSES.map((c) => [c, calibration[c].start])
  );
  const simulate = async (withoutAgents: boolean) => {
    const sim = await loadSimulator(start, CLASSES);
    try {
      return runEnsemble(sim, calibration, {
        runs,
        days,
        seed,
        names: CLASSES,
        withoutAgents,
      });
    } finally {
      sim.dispose();
    }
  };
  const withAgents = await simulate(false);
  const withoutAgents = await simulate(true);

  const now = classesNow(classes, limits, asOf);
  const judged = assessedClasses(classes);
  const { day: horizonDay, reason: horizonReason } = outlookHorizon(withAgents);
  const all = doomDate(withAgents, limits, horizonDay, {
    judged,
    alreadyLost: judged.some((c) => now[c].over),
  });
  const humans = doomDate(withAgents, limits, horizonDay, {
    judged,
    humansOnly: true,
    alreadyLost: judged.some((c) => now[c].humanOver),
  });
  const counterfactual = doomDate(withoutAgents, limits, horizonDay, {
    judged,
    humansOnly: true,
    alreadyLost: judged.some((c) => now[c].humanOver),
  });

  const total = totalHistory(classes);
  const v = velocity(total, 7, asOf);
  const agentsActive =
    v.agent > 0 ||
    CLASSES.some((c) => (calibration[c].agentArrivals?.count ?? 0) > 0);
  const openWith = medianOpen(withAgents, horizonDay);
  const openWithout = medianOpen(withoutAgents, horizonDay);

  let costNow: Outlook['cost'] = null;
  if (cost) {
    const share = v.agent + v.human > 0 ? v.agent / (v.agent + v.human) : 0;
    costNow = {
      currency: cost.currency,
      monthlySpendNow:
        30 *
        (v.agent * cost.agentPerIssue +
          v.human * cost.humanHourlyRate * cost.humanHoursPerIssue),
      monthlyToKeepPace: costToKeepPace(cost, v.arrivals, share),
    };
  }

  return {
    judged,
    now,
    horizonDay,
    horizonReason,
    index: 1 - all.byHorizon,
    doom: {
      all,
      humans,
      cost: cost ? costDoom(withAgents, cost, horizonDay) : null,
    },
    completion: completion(withAgents, v.arrivals >= v.agent + v.human),
    agents: {
      verdict: agentsVerdict(
        all,
        counterfactual,
        openWith,
        openWithout,
        agentsActive
      ),
      withAgents: all.byHorizon,
      withoutAgents: counterfactual.byHorizon,
      openWith,
      openWithout,
    },
    cost: costNow,
  };
}

/**
 * How often past 7-day forecasts of the open backlog landed inside their
 * 90% range, re-running the model from each day of the record. `null`
 * with fewer than three past forecasts to check.
 */
export async function backtest(
  total: DailyPoint[],
  loadSimulator: (
    start: Record<string, QueueStart>,
    names: readonly string[]
  ) => Promise<Simulator>,
  { ahead = 7, runs = 40, seed = 1 } = {}
): Promise<{ checked: number; inside: number } | null> {
  let checked = 0;
  let inside = 0;
  for (let cut = 7; cut + ahead < total.length; cut++) {
    const history = total.slice(0, cut + 1);
    const v = velocity(history, 7);
    if (v.days <= 0) continue;
    const latest = history[history.length - 1];
    const calibration: QueueCalibration = {
      start: {
        open: latest.open,
        byAgents: latest.agentClosed,
        byHumans: latest.humanClosed,
      },
      arrivals: { count: Math.max(0, v.arrivals * v.days), days: v.days },
      agents: { count: Math.max(0, v.agent * v.days), days: v.days },
      humans: { count: Math.max(0, v.human * v.days), days: v.days },
      volatility: Math.min(
        MAX_VOLATILITY,
        Math.max(
          MIN_VOLATILITY,
          measureVolatility(history) ?? DEFAULT_VOLATILITY
        )
      ),
    };
    const sim = await loadSimulator({ total: calibration.start }, ['total']);
    let e: Ensemble;
    try {
      e = runEnsemble(
        sim,
        { total: calibration },
        { runs, days: ahead, seed: seed + cut, names: ['total'] }
      );
    } finally {
      sim.dispose();
    }
    const opens: number[] = [];
    for (let run = 0; run < runs; run++)
      opens.push(ensembleValue(e, run, ahead, 0, F.open));
    const actual = total[cut + ahead].open;
    checked++;
    if (
      actual >= percentile(opens, 0.05) - 0.5 &&
      actual <= percentile(opens, 0.95) + 0.5
    )
      inside++;
  }
  return checked >= 3 ? { checked, inside } : null;
}
