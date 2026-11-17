/**
 * The update schedule, read from the cron line of the workflow that runs the
 * Action, so it is set in one place: the user's workflow file.
 */

export interface Schedule {
  cron: string;
  runsPerDay: number;
  /** Hours between runs when evenly spaced, else `null`. */
  intervalHours: number | null;
  /** e.g. `every 6 hours`. */
  description: string;
  /** Each run's time of day, `HH:MM` UTC. */
  runTimesUtc: string[];
}

/** Expands one cron field (e.g. `*\/6`, `0,12`, `8-18/2`). */
export function cronField(field: string, low: number, high: number): number[] {
  const values = new Set<number>();
  for (const part of field.split(',')) {
    const [range, step] = part.split('/');
    let start: number;
    let end: number;
    if (range === '*') {
      [start, end] = [low, high];
    } else if (range.includes('-')) {
      [start, end] = range.split('-').map(Number);
    } else {
      start = Number(range);
      end = step ? high : start;
    }
    for (let v = start; v <= end; v += step ? Number(step) : 1) {
      if (v >= low && v <= high) values.add(v);
    }
  }
  return [...values].sort((a, b) => a - b);
}

/** The first `cron:` line of a workflow file, or `null`. */
export function findCron(workflow: string): string | null {
  const match = /^\s*-\s*cron:\s*['"]([^'"]+)['"]/m.exec(workflow);
  return match ? match[1].trim() : null;
}

export function describeCron(cron: string): Schedule {
  const [minute, hour, day, month, weekday] = cron.split(/\s+/);
  const schedule: Schedule = {
    cron,
    runsPerDay: 0,
    intervalHours: null,
    description: `on the schedule "${cron}" (UTC)`,
    runTimesUtc: [],
  };
  if (day !== '*' || month !== '*' || weekday !== '*') return schedule;

  const times = cronField(hour, 0, 23)
    .flatMap((h) => cronField(minute, 0, 59).map((m) => h * 60 + m))
    .sort((a, b) => a - b);
  if (times.length === 0) return schedule;
  const gaps = new Set(
    times.map((t, i) => {
      const next = times[(i + 1) % times.length];
      return (next - t + 1440) % 1440 || 1440;
    })
  );
  schedule.runsPerDay = times.length;
  schedule.runTimesUtc = times.map(
    (t) =>
      `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  );
  if (times.length === 1) {
    schedule.intervalHours = 24;
    schedule.description = 'daily';
  } else if (gaps.size === 1) {
    const gap = [...gaps][0];
    schedule.intervalHours = gap / 60;
    schedule.description =
      gap === 60
        ? 'every hour'
        : gap % 60 === 0
          ? `every ${gap / 60} hours`
          : `every ${gap} minutes`;
  } else {
    schedule.description = `${times.length} times a day`;
  }
  return schedule;
}

/** When the workflow has no schedule (run by hand or on push). */
export const UNSCHEDULED: Schedule = {
  cron: '',
  runsPerDay: 0,
  intervalHours: null,
  description: 'when the workflow runs',
  runTimesUtc: [],
};
