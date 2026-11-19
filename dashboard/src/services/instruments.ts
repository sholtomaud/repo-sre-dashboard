/**
 * The overview's instruments, worked out from the data. Each kind of figure
 * gets the instrument that reads best for it:
 *
 * - abnormal states → an annunciator panel, dark when all is well;
 * - bounded shares with known limits → dials with coloured zones;
 * - flow in against flow out → a velocity dial with the arrival rate marked;
 * - a ratio around break-even → a logarithmic bar centred on 1×;
 * - unbounded durations and rates graded by research → bullet bars.
 *
 * DOM-free; unit-tested with `node --test`.
 */
import { doomLoopLevel, type DoomLoopLevel } from './metrics.ts';
import type { Band, ClassFacts, IssueClass, Zone } from './report.ts';

export type AnnunciatorState = 'off' | 'caution' | 'warning';

export interface Annunciator {
  id: string;
  label: string;
  state: AnnunciatorState;
  detail: string;
  href: string;
}

export interface AnnunciatorInputs {
  classes: Record<IssueClass, ClassFacts> | null;
  ci: { failingNow: string[]; successRate: number | null } | null;
  flowRatio: number | null;
  awaitingReply: number | null;
  linkedFixShare: number | null;
  readinessZone: Zone['id'] | null;
  doraBands: (Band | null)[];
}

const NO_DATA = 'No data yet';
const pct = (share: number) => `${Math.round(share * 100)}%`;
const times = (ratio: number) => `${ratio.toFixed(1)}×`;

/**
 * The annunciator panel: one tile per thing that can go wrong, lit amber
 * (caution) or red (warning) only while it is abnormal. Nothing lit means
 * nothing to do.
 */
export function annunciators(input: AnnunciatorInputs): Annunciator[] {
  const tile = (
    id: string,
    label: string,
    href: string,
    state: AnnunciatorState,
    detail: string
  ): Annunciator => ({ id, label, href, state, detail });
  const off = (id: string, label: string, href: string) =>
    tile(id, label, href, 'off', NO_DATA);
  const { classes, ci, flowRatio, awaitingReply, linkedFixShare } = input;
  const tiles: Annunciator[] = [];

  if (classes) {
    const s = classes.security;
    tiles.push(
      tile(
        'security',
        'Security',
        '#issues',
        s.overLimit > 0 ? 'warning' : 'off',
        s.overLimit > 0
          ? `${s.overLimit} past the ${s.limitDays}-day limit`
          : `None past the ${s.limitDays}-day limit`
      )
    );
    const others = classes.bug.overLimit + classes.other.overLimit;
    tiles.push(
      tile(
        'past-limit',
        'Past limit',
        '#issues',
        others > 0 ? 'caution' : 'off',
        others > 0
          ? `${others} bugs and others past limit`
          : 'All within limits'
      )
    );
  } else {
    tiles.push(off('security', 'Security', '#issues'));
    tiles.push(off('past-limit', 'Past limit', '#issues'));
  }

  if (ci) {
    const rate = ci.successRate;
    tiles.push(
      ci.failingNow.length
        ? tile(
            'ci',
            'CI',
            '#delivery',
            'warning',
            `Failing: ${ci.failingNow.join(', ')}`
          )
        : tile(
            'ci',
            'CI',
            '#delivery',
            rate !== null && rate < 0.8 ? 'caution' : 'off',
            rate === null ? 'Green' : `${pct(rate)} of runs pass`
          )
    );
  } else {
    tiles.push(off('ci', 'CI', '#delivery'));
  }

  if (flowRatio === null) {
    tiles.push(off('backlog', 'Backlog', '#outlook'));
  } else {
    tiles.push(
      tile(
        'backlog',
        'Backlog',
        '#outlook',
        flowRatio > 1.5 ? 'warning' : flowRatio > 1.1 ? 'caution' : 'off',
        flowRatio === Infinity
          ? 'Issues arrive, none close'
          : `${times(flowRatio)} opened per closed`
      )
    );
  }

  tiles.push(
    awaitingReply === null
      ? off('replies', 'Replies', '#issues')
      : tile(
          'replies',
          'Replies',
          '#issues',
          awaitingReply > 0 ? 'caution' : 'off',
          awaitingReply > 0
            ? `${awaitingReply} open with no reply`
            : 'Every issue answered'
        )
  );

  tiles.push(
    linkedFixShare === null
      ? off('closures', 'Closures', '#issues')
      : tile(
          'closures',
          'Closures',
          '#issues',
          linkedFixShare < 0.8 ? 'caution' : 'off',
          `${pct(linkedFixShare)} reference a fix`
        )
  );

  const zone = input.readinessZone;
  tiles.push(
    zone === null
      ? off('readiness', 'Readiness', '/audit')
      : tile(
          'readiness',
          'Readiness',
          '/audit',
          zone === 'not-ready' ? 'caution' : 'off',
          zone === 'not-ready'
            ? 'Not ready for agents'
            : zone === 'supervised'
              ? 'Supervised agents'
              : 'Ready for agents'
        )
  );

  const banded = input.doraBands.filter((b): b is Band => b !== null);
  const low = banded.filter((b) => b === 'low').length;
  tiles.push(
    banded.length === 0
      ? off('delivery', 'Delivery', '#delivery')
      : tile(
          'delivery',
          'Delivery',
          '#delivery',
          low > 0 ? 'caution' : 'off',
          low > 0
            ? `${low} DORA ${low === 1 ? 'metric' : 'metrics'} low`
            : 'No DORA metric low'
        )
  );
  return tiles;
}

/**
 * A round top for a dial's scale, with headroom over `value`: three to five
 * steps of 1, 2, 2.5 or 5 × 10ⁿ, the smallest top that fits.
 */
export function niceCeiling(value: number): { max: number; step: number } {
  const target = value > 0 ? value * 1.25 : 10;
  const exponent = Math.floor(Math.log10(target / 5));
  const tidy = (n: number) => Number(n.toPrecision(12));
  let best: { max: number; step: number } | null = null;
  for (const e of [exponent, exponent + 1]) {
    for (const m of [1, 2, 2.5, 5]) {
      const step = tidy(m * 10 ** e);
      const n = Math.ceil(tidy(target / step));
      if (n < 3 || n > 5) continue;
      const max = tidy(n * step);
      if (!best || max < best.max || (max === best.max && step > best.step)) {
        best = { max, step };
      }
    }
  }
  return best ?? { max: tidy(Math.ceil(target)), step: tidy(target / 4) };
}

/** Ticks on the ratio scale, from ⅛× to 8×. */
export const RATIO_TICKS = [1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8];

/**
 * Where an opened-to-closed ratio sits on a logarithmic scale from ⅛× to
 * 8×, with break-even (1×) in the middle, and its zone.
 */
export function ratioScale(ratio: number): {
  position: number;
  clipped: boolean;
  zone: DoomLoopLevel;
} {
  const raw = ratio <= 0 ? -Infinity : (Math.log2(ratio) + 3) / 6;
  const position = Math.min(1, Math.max(0, raw));
  return {
    position,
    clipped: raw > 1 || raw < 0,
    zone: doomLoopLevel(ratio),
  };
}

export type DoraName =
  'frequency' | 'leadTimeHours' | 'failureRate' | 'restoreHours';

/**
 * Band edges, left (low) to right (elite), as the tracker bands them. Times
 * and frequencies span orders of magnitude, so they are read on a log scale.
 */
const DORA_EDGES: Record<DoraName, { edges: number[]; log: boolean }> = {
  // Deliveries a day: a quarter apart, monthly, weekly, daily, ten a day.
  frequency: { edges: [1 / 90, 1 / 30, 1 / 7, 1, 10], log: true },
  // Hours: three months, a month, a week, a day, an hour.
  leadTimeHours: { edges: [2160, 720, 168, 24, 1], log: true },
  failureRate: { edges: [0.5, 0.15, 0.1, 0.05, 0], log: false },
  // Hours: a month, a week, a day, an hour, six minutes.
  restoreHours: { edges: [720, 168, 24, 1, 0.1], log: true },
};

const BAND_ORDER: Band[] = ['low', 'medium', 'high', 'elite'];

/**
 * A DORA metric on a bullet bar: four equal bands, low on the left and
 * elite on the right, and where the value falls among them (0–1).
 */
export function doraScale(
  name: DoraName,
  value: number | null
): {
  position: number | null;
  bands: { band: Band; from: number; to: number }[];
} {
  const { edges, log } = DORA_EDGES[name];
  const bands = BAND_ORDER.map((band, i) => ({
    band,
    from: i / 4,
    to: (i + 1) / 4,
  }));
  if (value === null || !Number.isFinite(value)) {
    return { position: null, bands };
  }
  const t = (v: number) => (log ? Math.log(Math.max(v, 1e-9)) : v);
  const rising = edges[4] > edges[0];
  const before = (a: number, b: number) => (rising ? a <= b : a >= b);
  if (before(value, edges[0])) return { position: 0, bands };
  if (before(edges[4], value)) return { position: 1, bands };
  for (let i = 0; i < 4; i++) {
    if (before(value, edges[i + 1])) {
      const f = (t(value) - t(edges[i])) / (t(edges[i + 1]) - t(edges[i]));
      return { position: (i + f) / 4, bands };
    }
  }
  return { position: 1, bands };
}
