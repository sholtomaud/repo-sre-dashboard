/**
 * The dashboard's numbers, worked out from `data.csv` (written daily by
 * `track_issues.py`). Every column in the CSV is a running total as of that
 * day, so rates come from the difference between two days.
 *
 * Nothing here touches the DOM, so it is unit-tested with `node --test`.
 */

/** One row of `data.csv`: cumulative counts at the end of a UTC day. */
export interface DailyRow {
  /** `YYYY-MM-DD` (UTC). */
  date: string;
  open: number;
  agentClosed: number;
  humanClosed: number;
  /**
   * Closed issues by how they were closed. Absent in data written before
   * the tracker recorded it.
   */
  closures?: Closures;
  /** Behaviour reports (bug-style issues) filed and closed so far. */
  behavior?: { created: number; closed: number };
}

/** How a closed issue was closed, judged from what GitHub records. */
export const EVIDENCE = [
  'fix_referenced',
  'no_reference',
  'declined',
  'withdrawn',
  'duplicate',
] as const;
export type Evidence = (typeof EVIDENCE)[number];
export type Closures = Record<Evidence, number>;

/** What an issue is, read from the issue form it was filed with. */
export const KINDS = ['behavior', 'feature', 'other'] as const;
export type Kind = (typeof KINDS)[number];

/** A daily row with the derived totals the charts plot. */
export interface DailyPoint extends DailyRow {
  totalClosed: number;
  /** Every issue filed so far: open plus closed. */
  created: number;
  /** Share of closed issues that an AI agent closed, 0–1. */
  agentShare: number;
  /** Hours left on the 24-hour Developer Doomsday Clock. */
  hoursToMidnight: number;
}

/** Tickets per day over a trailing window. */
export interface Velocity {
  /** Issues closed by AI agents per day. */
  agent: number;
  /** Issues closed by humans per day. */
  human: number;
  /** New issues filed per day (the arrival rate). */
  arrivals: number;
  /** Change in the open backlog per day; negative means it is shrinking. */
  netBacklog: number;
  /**
   * Days the window actually spans: shorter than asked when data is new,
   * and fractional when the newest row is a day still in progress.
   */
  days: number;
  /** Date of the row the window starts from; `''` when there is none. */
  since: string;
}

/**
 * `status.json`, written by `track_issues.py` on every run. The schedule is
 * read from the cron line of the tracker workflow, the one place it is set.
 */
export interface Status {
  /** When the data was last fetched, ISO 8601 UTC. */
  updatedAt: string;
  schedule: {
    cron: string;
    runsPerDay: number;
    /** Hours between runs when they are evenly spaced, else `null`. */
    intervalHours: number | null;
    /** E.g. `every 6 hours`. */
    description: string;
    /** Each run's time of day, `HH:MM` UTC, in order. */
    runTimesUtc: string[];
  };
  /** Today's breakdown of open issues; absent in older files. */
  issues?: {
    open: number;
    /** Open issues carrying at least one label. */
    openLabelled: number;
    openByKind: Record<Kind, number>;
    /** Issues closed at least once. */
    everClosed?: number;
    /** Of those, how many were reopened; absent when not recorded. */
    reopened?: number;
  };
  /**
   * The public issues' weight in the combined (version 2) figures, set in
   * the tracker; the agents' queue gets the rest.
   */
  defaultPublicWeight?: number;
  /** status.json as read, for blocks parsed elsewhere. */
  raw?: unknown;
}

export interface Snapshot {
  latest: DailyPoint;
  history: DailyPoint[];
  /** Last-updated time and schedule; `null` if status.json is missing. */
  status: Status | null;
  velocity: Velocity;
  /** Days for agents alone to clear today's backlog; `Infinity` if never. */
  daysToClearByAgents: number;
  /** Open backlog `windowDays` ago, for the stat tile's delta. */
  openDelta: number;
  doomLoop: DoomLoop;
}

/** How far the issue tracker is from (or deep into) a bug doom loop. */
export type DoomLoopLevel =
  'burning' | 'steady' | 'behind' | 'doom' | 'unknown';

export interface DoomLoop {
  /**
   * Issues opened per issue closed over the window. `Infinity` when issues
   * were opened but none closed; `null` when nothing happened.
   */
  ratio: number | null;
  level: DoomLoopLevel;
  /** The ratio as of each day, each over its own trailing window. */
  history: { date: string; ratio: number | null }[];
  /** Days until the open backlog doubles at the current net rate. */
  doublingDays: number | null;
  /** Days until the backlog is empty at the current net rate. */
  clearDays: number | null;
}

/** The clock runs over one day: 0% agent share is 00:00, 100% is 24:00. */
export const HOURS_ON_CLOCK = 24;
const MS_PER_DAY = 86_400_000;

/**
 * The Developer Doomsday Clock, as documented in the repository README:
 * `(1 − agent resolution share) × 24` hours to midnight. 24 hours (00:00,
 * the start of the day) means agents have closed nothing; 0 (24:00, the
 * end of the day) means agents close every issue.
 */
export function hoursToMidnight(agentClosed: number, humanClosed: number) {
  const closed = agentClosed + humanClosed;
  const share = closed > 0 ? agentClosed / closed : 0;
  return (1 - share) * HOURS_ON_CLOCK;
}

/**
 * The time the clock reads, as `HH:MM` on a 24-hour clock: how far through
 * the day it is. `24:00` is midnight at the end of the day.
 */
export function clockTime(hoursLeft: number): string {
  const minutes = Math.round((HOURS_ON_CLOCK - hoursLeft) * 60);
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Parses `data.csv`. Columns are found by header name, in any order. */
export function parseCsv(text: string): DailyRow[] {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const header = lines[0].split(',').map((name) => name.trim());
  const column = (name: string) => {
    const index = header.indexOf(name);
    if (index === -1) throw new Error(`data.csv has no "${name}" column`);
    return index;
  };
  const date = column('date');
  const open = column('open');
  const agent = column('agent_closed');
  const human = column('human_closed');
  // Added later; older files do not have them.
  const optional = (name: string) => header.indexOf(name);
  const evidence = EVIDENCE.map((name) => optional(`closed_${name}`));
  const behaviorCreated = optional('behavior_created');
  const behaviorClosed = optional('behavior_closed');

  const rows = lines.slice(1).map((line, i) => {
    const cells = line.split(',').map((cell) => cell.trim());
    const number = (index: number) => {
      const value = Number(cells[index]);
      if (!Number.isFinite(value)) {
        throw new Error(
          `data.csv line ${i + 2}: "${cells[index]}" is not a number`
        );
      }
      return value;
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cells[date] ?? '')) {
      throw new Error(`data.csv line ${i + 2}: bad date "${cells[date]}"`);
    }
    const row: DailyRow = {
      date: cells[date],
      open: number(open),
      agentClosed: number(agent),
      humanClosed: number(human),
    };
    if (evidence.every((index) => index !== -1)) {
      row.closures = Object.fromEntries(
        EVIDENCE.map((name, n) => [name, number(evidence[n])])
      ) as Closures;
    }
    if (behaviorCreated !== -1 && behaviorClosed !== -1) {
      row.behavior = {
        created: number(behaviorCreated),
        closed: number(behaviorClosed),
      };
    }
    return row;
  });
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/** Adds the derived totals to each row. */
export function toPoints(rows: DailyRow[]): DailyPoint[] {
  return rows.map((row) => {
    const totalClosed = row.agentClosed + row.humanClosed;
    return {
      ...row,
      totalClosed,
      created: row.open + totalClosed,
      agentShare: totalClosed > 0 ? row.agentClosed / totalClosed : 0,
      hoursToMidnight: hoursToMidnight(row.agentClosed, row.humanClosed),
    };
  });
}

/** Whole days between two `YYYY-MM-DD` dates. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY);
}

/**
 * The moment a row's totals were counted. A row holds the totals at the end
 * of its UTC day, except the newest one while that day is still in progress
 * (the tracker runs several times a day): it was counted at `asOf`.
 */
function countedAt(point: DailyRow, asOf?: string): number {
  const endOfDay = Date.parse(point.date) + MS_PER_DAY;
  const at = asOf ? Date.parse(asOf) : Number.NaN;
  return at >= Date.parse(point.date) && at < endOfDay ? at : endOfDay;
}

/** Shortest window, in days, a rate is worked out over (6 hours). */
const MIN_WINDOW_DAYS = 0.25;

/**
 * Average tickets per day over the last `windowDays` days of history. The
 * window starts at the newest row at least `windowDays` old, or the first
 * row when the history is shorter than that.
 *
 * @param asOf When the newest row was counted (ISO time). Without it the
 *   newest row is taken as a complete day.
 */
export function velocity(
  points: DailyPoint[],
  windowDays = 7,
  asOf?: string
): Velocity {
  const zero = {
    agent: 0,
    human: 0,
    arrivals: 0,
    netBacklog: 0,
    days: 0,
    since: '',
  };
  if (points.length < 2) return zero;

  const last = points[points.length - 1];
  const end = countedAt(last, asOf);
  const age = (point: DailyPoint) => (end - countedAt(point)) / MS_PER_DAY;
  let first = points[0];
  for (const point of points.slice(0, -1)) {
    if (age(point) >= windowDays) first = point;
  }
  const days = age(first);
  if (days < MIN_WINDOW_DAYS) return zero;

  const rate = (key: 'agentClosed' | 'humanClosed' | 'created' | 'open') =>
    (last[key] - first[key]) / days;
  return {
    agent: rate('agentClosed'),
    human: rate('humanClosed'),
    arrivals: rate('created'),
    netBacklog: rate('open'),
    days,
    since: first.date,
  };
}

/** Everything the dashboard shows, from the CSV text and status.json. */
export function buildSnapshot(
  csv: string,
  windowDays = 7,
  status: Status | null = null
): Snapshot {
  const history = toPoints(parseCsv(csv));
  if (history.length === 0) throw new Error('data.csv has no rows yet');

  const latest = history[history.length - 1];
  const asOf = status?.updatedAt;
  const rates = velocity(history, windowDays, asOf);
  const start = history.find((point) => point.date === rates.since) ?? latest;
  return {
    latest,
    history,
    status,
    velocity: rates,
    daysToClearByAgents:
      rates.agent > 0 ? latest.open / rates.agent : Number.POSITIVE_INFINITY,
    openDelta: latest.open - start.open,
    doomLoop: doomLoop(history, windowDays, asOf),
  };
}

/**
 * When the tracker is next due to run after `now`, from the schedule's run
 * times. GitHub may start scheduled runs late, so treat it as approximate.
 */
export function nextUpdate(status: Status, now = new Date()): Date | null {
  const runs = status.schedule.runTimesUtc
    .map((time) => /^(\d{1,2}):(\d{2})$/.exec(time))
    .filter((match) => match !== null)
    .map((match) => Number(match[1]) * 60 + Number(match[2]))
    .sort((a, b) => a - b);
  if (runs.length === 0) return null;

  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const minutesNow = (now.getTime() - midnight) / 60_000;
  const next = runs.find((run) => run > minutesNow);
  // Past today's last run: the first one tomorrow.
  return new Date(midnight + (next ?? runs[0] + 24 * 60) * 60_000);
}

/** Issues opened per issue closed, from a {@link Velocity}. */
export function doomLoopRatio(v: Velocity): number | null {
  const closed = v.agent + v.human;
  if (v.days === 0 || (closed === 0 && v.arrivals === 0)) return null;
  if (closed === 0) return Number.POSITIVE_INFINITY;
  return v.arrivals / closed;
}

/**
 * Bands of the opened-to-closed ratio: below 0.9× the backlog burns down,
 * 0.9–1.1× holds steady, up to 2× falls behind, past 2× is a doom loop.
 */
export function doomLoopLevel(ratio: number | null): DoomLoopLevel {
  if (ratio === null) return 'unknown';
  if (ratio < 0.9) return 'burning';
  if (ratio <= 1.1) return 'steady';
  if (ratio <= 2) return 'behind';
  return 'doom';
}

export function doomLoop(
  points: DailyPoint[],
  windowDays = 7,
  asOf?: string
): DoomLoop {
  const v = velocity(points, windowDays, asOf);
  const ratio = doomLoopRatio(v);
  const open = points.length ? points[points.length - 1].open : 0;
  return {
    ratio,
    level: doomLoopLevel(ratio),
    history: points.slice(1).map((point, i) => ({
      date: point.date,
      // Only the newest row can be a day still in progress.
      ratio: doomLoopRatio(
        velocity(
          points.slice(0, i + 2),
          windowDays,
          i + 2 === points.length ? asOf : undefined
        )
      ),
    })),
    doublingDays: v.netBacklog > 0 && open > 0 ? open / v.netBacklog : null,
    clearDays: v.netBacklog < 0 ? open / -v.netBacklog : null,
  };
}

/**
 * A round upper bound for a scale: the smallest of 1, 2, 2.5, 5 × 10ⁿ that
 * is at least `value`.
 */
export function niceCeil(value: number): number {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * magnitude >= value - 1e-9) return step * magnitude;
  }
  return 10 * magnitude;
}

/** Status band of the clock, from calm to doom. */
export type ThreatLevel = 'safe' | 'elevated' | 'severe' | 'critical';

/** Bands by hours to midnight: under 25%, 50% and 83⅓% agent share. */
export function threatLevel(hours: number): ThreatLevel {
  if (hours > 18) return 'safe';
  if (hours >= 12) return 'elevated';
  if (hours > 4) return 'severe';
  return 'critical';
}

/** Reads status.json; `null` if it is missing or not in the expected shape. */
export function parseStatus(value: unknown): Status | null {
  const raw = value as {
    updated_at?: unknown;
    schedule?: Record<string, unknown>;
  } | null;
  const schedule = raw?.schedule;
  if (
    typeof raw?.updated_at !== 'string' ||
    Number.isNaN(Date.parse(raw.updated_at)) ||
    !schedule ||
    typeof schedule.description !== 'string' ||
    !Array.isArray(schedule.run_times_utc)
  ) {
    return null;
  }
  const issues = (raw as { issues?: Record<string, unknown> }).issues;
  const weighting = (raw as { weighting?: Record<string, unknown> }).weighting;
  const byKind = issues?.open_by_kind as Record<string, unknown> | undefined;
  return {
    ...(issues && byKind
      ? {
          issues: {
            open: Number(issues.open) || 0,
            openLabelled: Number(issues.open_labelled) || 0,
            openByKind: Object.fromEntries(
              KINDS.map((kind) => [kind, Number(byKind[kind]) || 0])
            ) as Record<Kind, number>,
            ...(typeof issues.ever_closed === 'number'
              ? { everClosed: issues.ever_closed }
              : {}),
            ...(typeof issues.reopened === 'number'
              ? { reopened: issues.reopened }
              : {}),
          },
        }
      : {}),
    ...(typeof weighting?.default_public_weight === 'number'
      ? { defaultPublicWeight: weighting.default_public_weight }
      : {}),
    raw: value,
    updatedAt: raw.updated_at,
    schedule: {
      cron: String(schedule.cron ?? ''),
      runsPerDay: Number(schedule.runs_per_day) || 0,
      intervalHours:
        typeof schedule.interval_hours === 'number'
          ? schedule.interval_hours
          : null,
      description: schedule.description,
      runTimesUtc: schedule.run_times_utc.map(String),
    },
  };
}

/** Loads status.json; `null` if it is missing or cannot be read. */
export async function loadStatus(
  fetchImpl: typeof fetch = fetch,
  url = 'data/status.json'
): Promise<Status | null> {
  try {
    const response = await fetchImpl(url, { cache: 'no-cache' });
    return response.ok ? parseStatus(await response.json()) : null;
  } catch {
    return null;
  }
}

/**
 * Loads and summarises the data, relative to the app's base URL. The page
 * still works without status.json; it only loses the time and schedule.
 */
export async function loadSnapshot(
  fetchImpl: typeof fetch = fetch,
  url = 'data/data.csv',
  statusUrl = 'data/status.json'
): Promise<Snapshot> {
  const [response, status] = await Promise.all([
    fetchImpl(url, { cache: 'no-cache' }),
    loadStatus(fetchImpl, statusUrl),
  ]);
  if (!response.ok) {
    throw new Error(`Could not load ${url} (HTTP ${response.status})`);
  }
  return buildSnapshot(await response.text(), 7, status);
}
