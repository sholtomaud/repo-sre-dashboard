/**
 * Response times and the repository habits checklist, from status.json.
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

export type PracticeStatus = 'pass' | 'improve' | 'missing' | 'unknown';

export interface Practice {
  id: string;
  title: string;
  status: PracticeStatus;
  evidence: string;
  recommendation: string;
  docs: string;
}

const STATUSES: PracticeStatus[] = ['pass', 'improve', 'missing', 'unknown'];

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

/** The `practices` block of status.json; empty if absent. */
export function parsePractices(status: unknown): Practice[] {
  const raw = (status as { practices?: unknown } | null)?.practices;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p && typeof p.id === 'string' && typeof p.title === 'string')
    .map((p) => ({
      id: p.id,
      title: p.title,
      status: STATUSES.includes(p.status) ? p.status : 'unknown',
      evidence: String(p.evidence ?? ''),
      recommendation: String(p.recommendation ?? ''),
      docs:
        typeof p.docs === 'string' && p.docs.startsWith('https://')
          ? p.docs
          : '',
    }));
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
