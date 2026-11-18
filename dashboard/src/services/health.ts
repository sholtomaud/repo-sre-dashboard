/**
 * Response times and pull requests by origin, from status.json.
 * DOM-free; unit-tested with `node --test`.
 */

export interface Durations {
  count: number;
  medianHours: number | null;
  p90Hours: number | null;
}

export interface Responses {
  windowDays: number;
  firstResponse: Durations;
  resolution: Durations;
  /** Open issues nobody but the reporter has responded to. */
  awaitingResponse: number;
}

function durations(value: unknown): Durations {
  const raw = (value ?? {}) as Record<string, unknown>;
  const hours = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  return {
    count: Number(raw.count) || 0,
    medianHours: hours(raw.medianHours),
    p90Hours: hours(raw.p90Hours),
  };
}

/** The `responses` block of status.json, or `null` if absent. */
export function parseResponses(status: unknown): Responses | null {
  const raw = (status as { responses?: Record<string, unknown> } | null)
    ?.responses;
  if (!raw) return null;
  return {
    windowDays: Number(raw.windowDays) || 30,
    firstResponse: durations(raw.firstResponse),
    resolution: durations(raw.resolution),
    awaitingResponse: Number(raw.awaitingResponse) || 0,
  };
}

/** `45 min`, `6.5 h` or `3.2 days`. */
export function formatDuration(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48)
    return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`;
  const days = hours / 24;
  return `${days < 10 ? days.toFixed(1) : Math.round(days)} days`;
}

export const ORIGINS = ['agent', 'assisted', 'human'] as const;
export type Origin = (typeof ORIGINS)[number];

export interface OriginStats {
  opened: number;
  merged: number;
  closedUnmerged: number;
  stillOpen: number;
  mergeRate: number | null;
  medianHoursToMerge: number | null;
}

export interface Pulls {
  windowDays: number;
  total: number;
  byOrigin: Record<Origin, OriginStats>;
  /** Pull requests per named agent in the window. */
  agents: Record<string, number>;
}

/** The `pulls` block of status.json, or `null` if absent. */
export function parsePulls(status: unknown): Pulls | null {
  const raw = (status as { pulls?: Record<string, unknown> } | null)?.pulls;
  const by = raw?.by_origin as
    Record<string, Record<string, unknown>> | undefined;
  if (!raw || !by) return null;
  const num = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const agents: Record<string, number> = {};
  for (const [name, count] of Object.entries(
    (raw.agents ?? {}) as Record<string, unknown>
  )) {
    if (typeof count === 'number') agents[name] = count;
  }
  return {
    windowDays: Number(raw.window_days) || 30,
    total: Number(raw.total) || 0,
    byOrigin: Object.fromEntries(
      ORIGINS.map((o) => {
        const s = by[o] ?? {};
        return [
          o,
          {
            opened: num(s.opened) ?? 0,
            merged: num(s.merged) ?? 0,
            closedUnmerged: num(s.closed_unmerged) ?? 0,
            stillOpen: num(s.still_open) ?? 0,
            mergeRate: num(s.merge_rate),
            medianHoursToMerge: num(s.median_hours_to_merge),
          },
        ];
      })
    ) as Record<Origin, OriginStats>,
    agents,
  };
}

/** Share of merged pull requests an agent wrote or helped write. */
export function agentMergedShare(pulls: Pulls): number | null {
  const merged = ORIGINS.reduce((s, o) => s + pulls.byOrigin[o].merged, 0);
  if (merged === 0) return null;
  return (
    (pulls.byOrigin.agent.merged + pulls.byOrigin.assisted.merged) / merged
  );
}
