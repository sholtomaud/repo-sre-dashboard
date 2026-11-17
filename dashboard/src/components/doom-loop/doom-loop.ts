import { BaseComponent } from '../../core/base-component.ts';
import type { DoomLoop, DoomLoopLevel } from '../../services/metrics.ts';
import type { StrictRatios } from '../../services/insights.ts';
import { formatCount, formatDate, formatDays } from '../../lib/format.ts';
import { svg } from '../../lib/svg.ts';
import template from './doom-loop.html?raw';
import style from './doom-loop.css?raw';

/** The meter's log₂ range: 1/8× to 8×. */
const MIN = -3;
const MAX = 3;
const TICKS: [number, string][] = [
  [1 / 8, '⅛×'],
  [1 / 4, '¼×'],
  [1 / 2, '½×'],
  [1, '1×'],
  [2, '2×'],
  [4, '4×'],
  [8, '8×+'],
];

const LEVELS: Record<DoomLoopLevel, { icon: string; label: string }> = {
  burning: { icon: '✓', label: 'Burning down the backlog' },
  steady: { icon: '=', label: 'Holding steady' },
  behind: { icon: '!', label: 'Falling behind' },
  doom: { icon: '✕', label: 'Bug doom loop' },
  unknown: { icon: '?', label: 'Not enough data yet' },
};

/** Position on the meter, 0–100%, of a ratio (clamped to the scale). */
function position(ratio: number): number {
  const log = Math.log2(Math.max(ratio, 2 ** MIN));
  return ((Math.min(log, MAX) - MIN) / (MAX - MIN)) * 100;
}

function formatRatio(ratio: number | null): string {
  if (ratio === null) return '—';
  if (!Number.isFinite(ratio)) return '∞';
  return ratio >= 10 ? ratio.toFixed(0) : ratio.toFixed(1);
}

/**
 * The bug doom loop: issues opened per issue closed. Above 1× the backlog
 * grows however hard people work; far above it the project is drowning.
 *
 * Set `loop` (with `open`, the current backlog, for the projection).
 */
export class DoomLoopComponent extends BaseComponent {
  static tagName = 'doom-loop';

  private value: DoomLoop | undefined;
  /** Open issues today. */
  open = 0;
  /** Days the ratio is averaged over. */
  windowDays = 0;
  private drawn = false;
  /** Shown in place of the backlog projection, e.g. for a combined view. */
  note = '';
  /** Which queue this panel is for, shown under the title. */
  queue = '';
  /** What the ratio counts, e.g. `issues opened per issue closed`. */
  caption = '';
  /** The ratio under stricter definitions of "closed", when recorded. */
  strict: StrictRatios = {};

  constructor() {
    super(template, style);
  }

  set loop(value: DoomLoop) {
    this.value = value;
    if (this.isConnected) this.draw();
  }
  get loop(): DoomLoop | undefined {
    return this.value;
  }

  init() {
    this.querySelector('[data-scale]')!.replaceChildren(
      ...TICKS.map(([ratio, text]) => {
        const tick = document.createElement('span');
        tick.style.left = `${position(ratio)}%`;
        tick.textContent = text;
        if (ratio === 1) tick.className = 'one';
        return tick;
      })
    );
    if (this.value) this.draw();
  }

  private draw() {
    const loop = this.value!;
    const ratioText = formatRatio(loop.ratio);
    const { icon, label } = LEVELS[loop.level];

    this.querySelector<HTMLElement>('[data-loop]')!.dataset.level = loop.level;
    this.querySelector('[data-ratio]')!.textContent = ratioText;
    const queue = this.querySelector<HTMLElement>('[data-queue]')!;
    queue.textContent = this.queue;
    queue.hidden = !this.queue;
    this.querySelector('[data-region]')!.setAttribute(
      'aria-label',
      this.queue ? `Bug doom loop: ${this.queue}` : 'Bug doom loop'
    );
    if (this.caption) {
      this.querySelector('[data-caption]')!.textContent = this.caption;
    }
    this.querySelector('[data-window]')!.textContent = this.windowDays
      ? `(last ${formatDays(this.windowDays)} ${this.windowDays === 1 ? 'day' : 'days'})`
      : '';
    this.querySelector('[data-icon]')!.textContent = icon;
    this.querySelector('[data-label]')!.textContent = label;
    this.querySelector('[data-projection]')!.replaceChildren(
      ...this.projection(loop)
    );

    const meter = this.querySelector<HTMLElement>('[data-meter]')!;
    meter.setAttribute(
      'aria-label',
      loop.ratio === null
        ? 'Not enough data for the opened-to-closed ratio'
        : `${ratioText} issues opened per issue closed: ${label.toLowerCase()}`
    );
    const marker = this.querySelector<HTMLElement>('[data-marker]')!;
    if (loop.ratio !== null) {
      const at = position(loop.ratio);
      marker.hidden = false;
      marker.dataset.edge = at > 88 ? 'end' : at < 12 ? 'start' : '';
      this.querySelector('[data-marker-value]')!.textContent =
        loop.ratio > 2 ** MAX ? `${ratioText}× ▸` : `${ratioText}×`;
      // Only the first drawing slides in from the middle.
      if (this.drawn) {
        marker.style.left = `${at}%`;
      } else {
        marker.style.left = '50%';
        requestAnimationFrame(() =>
          requestAnimationFrame(() => (marker.style.left = `${at}%`))
        );
      }
      this.drawn = true;
    } else {
      marker.hidden = true;
    }

    const strict = [
      ['referenced', this.strict.referenced],
      ['behavior', this.strict.behavior],
    ] as const;
    for (const [name, ratio] of strict) {
      this.querySelector<HTMLElement>(`[data-strict-${name}]`)!.hidden =
        ratio === undefined;
      this.querySelector(`[data-strict-${name}-value]`)!.textContent =
        ratio === null || ratio === undefined
          ? 'no activity'
          : `${formatRatio(ratio)}×`;
    }
    this.querySelector<HTMLElement>('[data-strict]')!.hidden = strict.every(
      ([, ratio]) => ratio === undefined
    );

    this.drawSparkline(loop);
  }

  private projection(loop: DoomLoop): (string | HTMLElement)[] {
    const strong = (text: string) => {
      const element = document.createElement('strong');
      element.textContent = text;
      return element;
    };
    if (loop.ratio === null) {
      return ['Needs at least two days of data.'];
    }
    if (this.note) return [this.note];
    if (loop.doublingDays !== null) {
      const days = Math.max(1, Math.round(loop.doublingDays));
      return [
        'At this rate the open backlog of ',
        strong(formatCount(this.open)),
        ' doubles in ',
        strong(`${days} ${days === 1 ? 'day' : 'days'}`),
        '.',
      ];
    }
    if (loop.clearDays !== null) {
      const days = Math.max(1, Math.round(loop.clearDays));
      return [
        'At this rate the backlog is cleared in ',
        strong(`${days} ${days === 1 ? 'day' : 'days'}`),
        '.',
      ];
    }
    return ['The backlog is holding steady.'];
  }

  private drawSparkline(loop: DoomLoop) {
    const plot = this.querySelector<HTMLElement>('[data-spark]')!;
    const points = loop.history.filter((h) => h.ratio !== null) as {
      date: string;
      ratio: number;
    }[];
    if (points.length === 0) {
      plot.replaceChildren();
      return;
    }
    // Log scale like the meter, but fitted to the data (not capped at 8×)
    // and always including break-even. A day with no closures is drawn
    // just above the highest finite ratio.
    const finite = points.map((p) => p.ratio).filter(Number.isFinite);
    const ceiling = Math.max(2, ...finite) * 1.5;
    const logs = points.map((p) =>
      Math.log2(Math.max(Math.min(p.ratio, ceiling), 2 ** -6))
    );
    const top = Math.max(1, ...logs) + 0.25;
    const bottom = Math.min(-1, ...logs) - 0.25;
    const y = (log: number) => ((top - log) / (top - bottom)) * 100;
    const x = (i: number) =>
      points.length === 1 ? 100 : (i / (points.length - 1)) * 100;

    const root = svg('svg', {
      viewBox: '0 0 100 100',
      preserveAspectRatio: 'none',
      'aria-hidden': 'true',
    });
    svg(
      'line',
      {
        x1: 0,
        x2: 100,
        y1: y(0),
        y2: y(0),
        stroke: 'var(--axis)',
        'stroke-width': 1,
        'vector-effect': 'non-scaling-stroke',
      },
      root
    );
    const line = logs
      .map((log, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(log)}`)
      .join(' ');
    svg(
      'path',
      {
        d: `${line} L ${x(logs.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`,
        fill: 'var(--level)',
        opacity: 0.12,
      },
      root
    );
    svg(
      'path',
      {
        d: line,
        fill: 'none',
        stroke: 'var(--level)',
        'stroke-width': 2,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
        'vector-effect': 'non-scaling-stroke',
      },
      root
    );

    const even = document.createElement('span');
    even.className = 'even-label';
    even.style.top = `${y(0)}%`;
    even.textContent = '1× break-even';
    const dot = document.createElement('span');
    dot.className = 'end-dot';
    dot.style.left = `${x(logs.length - 1)}%`;
    dot.style.top = `${y(logs[logs.length - 1])}%`;
    dot.title = `${points[points.length - 1].date}: ${formatRatio(points[points.length - 1].ratio)}×`;
    const dates = document.createElement('div');
    dates.className = 'spark-dates';
    for (const point of [points[0], points[points.length - 1]]) {
      const label = document.createElement('span');
      label.textContent = formatDate(point.date, false);
      dates.append(label);
    }
    plot.replaceChildren(root, even, dot);
    plot.after(dates);
    plot.parentElement!.querySelectorAll('.spark-dates').forEach((old) => {
      if (old !== dates) old.remove();
    });
  }
}

if (!customElements.get(DoomLoopComponent.tagName)) {
  customElements.define(DoomLoopComponent.tagName, DoomLoopComponent);
}
