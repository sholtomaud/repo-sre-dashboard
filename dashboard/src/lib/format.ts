/** Formatting shared by the dashboard's components. */

const integer = new Intl.NumberFormat('en-US');

export function formatCount(value: number): string {
  return integer.format(Math.round(value));
}

/** One decimal place, e.g. `4.2`. */
export function formatRate(value: number): string {
  return value.toFixed(1);
}

export function formatPercent(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

/** `+12`, `−3` or `±0`. */
export function formatSigned(value: number, digits = 0): string {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return `±${text}`;
  return value > 0 ? `+${text}` : `−${text}`;
}

/** `Nov 16, 2026` from `2026-11-16` (read as UTC). */
export function formatDate(date: string, withYear = true): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

/** A span of days: `7` when whole, otherwise one decimal (`5.3`). */
export function formatDays(days: number): string {
  const rounded = Math.round(days * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** A duration in days, or hours when under a day: `11 hours`, `1 day`, `7 days`. */
export function formatSpan(days: number): string {
  if (days < 1) {
    const hours = Math.max(1, Math.round(days * 24));
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  const rounded = Math.round(days);
  return `${rounded} ${rounded === 1 ? 'day' : 'days'}`;
}

/** `Nov 16, 2026, 12:05 UTC` from an ISO time. */
export function formatDateTime(iso: string): string {
  const text = new Date(iso).toLocaleString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return `${text} UTC`;
}

/** `18:05 UTC` from a Date. */
export function formatTimeUtc(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
}
