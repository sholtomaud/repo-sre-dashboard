import { BaseComponent } from '../../core/base-component.ts';
import { niceCeil, type Velocity } from '../../services/metrics.ts';
import { formatDays, formatRate } from '../../lib/format.ts';
import { arcPath, polar, prefersReducedMotion, svg } from '../../lib/svg.ts';
import template from './velocity-gauge.html?raw';
import style from './velocity-gauge.css?raw';

const CX = 160;
const CY = 150;
const R = 118;
/** The dial sweeps 240°, from −120° (zero) to +120° (full scale). */
const START = -120;
const SWEEP = 240;
/** Rates closer than this count as level with new issues. */
const EVEN = 0.05;

/** Whether resolution is keeping up with new issues. */
export type Pace = 'ahead' | 'behind' | 'even';

export function pace(v: Velocity): Pace {
  const resolved = v.agent + v.human;
  if (Math.abs(resolved - v.arrivals) < EVEN) return 'even';
  return resolved > v.arrivals ? 'ahead' : 'behind';
}

/**
 * A speedometer for how fast issues are resolved, in issues per day.
 *
 * - The needle is everyone's rate: agents and humans together.
 * - The inner arc splits that rate: AI agents (orange), then humans
 *   (purple), so the proportions show at a glance.
 * - The blue mark is the rate new issues arrive.
 * - The outer arc is the gap between the two: green and solid when
 *   resolution is ahead of new issues, red and dashed when behind. The
 *   caption says the same in words, for readers who cannot tell the colours
 *   apart.
 *
 * Set `velocity` to draw it.
 */
export class VelocityGaugeComponent extends BaseComponent {
  static tagName = 'velocity-gauge';

  private value: Velocity | undefined;
  private drawn = false;
  /**
   * Keeps the scale wide enough for this rate, so the dial keeps one scale
   * across the replay and the live view. `null` fits the scale to the
   * current values.
   */
  scalePeak: number | null = null;
  /** Which queue the dial is for, shown above it. */
  heading = '';
  /** Open issues, shown on the odometer under the dial; `null` hides it. */
  open: number | null = null;
  /** A forecast's likely range of issues resolved per day. */
  range: { low: number; high: number } | null = null;
  /** 0 to 1: how far the needle has faded, reaching 1 at the forecast's end. */
  fade = 0;

  constructor() {
    super(template, style);
  }

  set velocity(value: Velocity) {
    this.value = value;
    if (this.isConnected) this.draw();
  }
  get velocity(): Velocity | undefined {
    return this.value;
  }

  init() {
    if (this.value) this.draw();
  }

  private draw() {
    const v = this.value!;
    const resolved = v.agent + v.human;
    const max = niceCeil(
      Math.max(this.scalePeak ?? 0, resolved, v.arrivals, 4) * 1.08
    );
    const angle = (rate: number) =>
      START + (Math.min(Math.max(rate, 0), max) / max) * SWEEP;
    const state = pace(v);
    const gap = Math.abs(resolved - v.arrivals);

    const frame = this.querySelector<HTMLElement>('[data-gauge]')!;
    frame.setAttribute(
      'aria-label',
      `${formatRate(resolved)} issues resolved per day: ` +
        `${formatRate(v.agent)} by AI agents and ${formatRate(v.human)} by humans. ` +
        `${formatRate(v.arrivals)} new issues arrive per day, so resolution is ` +
        (state === 'even'
          ? 'level with them'
          : `${formatRate(gap)} a day ${state}`) +
        `. Averaged over ${formatDays(v.days)} days.`
    );

    const root = svg('svg', { viewBox: '0 0 320 236', 'aria-hidden': 'true' });

    // Track.
    svg(
      'path',
      {
        d: arcPath(CX, CY, R, START, START + SWEEP),
        fill: 'none',
        stroke: 'var(--grid)',
        'stroke-width': 16,
        'stroke-linecap': 'round',
      },
      root
    );

    // The resolution rate, split: agents first, then humans. A 1° gap in
    // the surface colour separates the two.
    const arcs = svg('g', { class: 'value-arcs' }, root);
    const segment = (from: number, to: number, color: string) => {
      if (to - from < 0.3) return;
      svg(
        'path',
        {
          d: arcPath(CX, CY, R, from, to),
          fill: 'none',
          stroke: color,
          'stroke-width': 16,
        },
        arcs
      );
    };
    const agentsEnd = angle(v.agent);
    const humansEnd = angle(resolved);
    segment(START, agentsEnd, 'var(--agents)');
    segment(agentsEnd + (v.agent > 0 ? 1 : 0), humansEnd, 'var(--humans)');

    // The gap between resolution and new issues, outside the track.
    if (state !== 'even') {
      const from = Math.min(angle(resolved), angle(v.arrivals));
      const to = Math.max(angle(resolved), angle(v.arrivals));
      if (to - from >= 0.3) {
        svg(
          'path',
          {
            d: arcPath(CX, CY, R + 15, from, to),
            fill: 'none',
            stroke: state === 'ahead' ? 'var(--good)' : 'var(--critical)',
            'stroke-width': 5,
            'stroke-linecap': 'butt',
            ...(state === 'behind' ? { 'stroke-dasharray': '7 4' } : {}),
            class: `gap gap-${state}`,
          },
          root
        );
      }
    }

    // Scale: five labelled steps with minor ticks between.
    const steps = 5;
    for (let i = 0; i <= steps * 4; i++) {
      const major = i % 4 === 0;
      const a = START + (i / (steps * 4)) * SWEEP;
      const outer = polar(CX, CY, R - 13, a);
      const inner = polar(CX, CY, R - (major ? 24 : 18), a);
      svg(
        'line',
        {
          x1: inner.x,
          y1: inner.y,
          x2: outer.x,
          y2: outer.y,
          stroke: major ? 'var(--ink-2)' : 'var(--axis)',
          'stroke-width': major ? 2 : 1,
          'stroke-linecap': 'round',
        },
        root
      );
      if (major) {
        const at = polar(CX, CY, R - 38, a);
        const label = svg(
          'text',
          {
            x: at.x,
            y: at.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'central',
            fill: 'var(--ink-muted)',
            'font-size': 11,
            class: 'tabular',
          },
          root
        );
        const tick = (max / steps) * (i / 4);
        label.textContent = Number.isInteger(tick)
          ? String(tick)
          : tick.toFixed(1);
      }
    }

    // New issues: a blue mark across the track and a pointer outside it.
    const arrivals = angle(v.arrivals);
    const markIn = polar(CX, CY, R - 9, arrivals);
    const markOut = polar(CX, CY, R + 19, arrivals);
    for (const [stroke, width] of [
      ['var(--surface)', 7],
      ['var(--arrivals)', 3],
    ] as const) {
      svg(
        'line',
        {
          x1: markIn.x,
          y1: markIn.y,
          x2: markOut.x,
          y2: markOut.y,
          stroke,
          'stroke-width': width,
          'stroke-linecap': 'round',
        },
        root
      );
    }
    const tip = polar(CX, CY, R + 21, arrivals);
    const left = polar(CX, CY, R + 29, arrivals - 3.2);
    const right = polar(CX, CY, R + 29, arrivals + 3.2);
    svg(
      'path',
      {
        d: `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`,
        fill: 'var(--arrivals)',
      },
      root
    );

    // A forecast: the likely range as a fan around the needle.
    if (this.range) {
      const from = angle(this.range.low);
      const to = Math.max(angle(this.range.high), from + 0.5);
      svg(
        'path',
        {
          d: `${arcPath(CX, CY, R + 8, from, to)} L ${CX} ${CY} Z`,
          fill: 'var(--ink)',
          opacity: 0.14 * (1 - this.fade) + 0.04,
          class: 'forecast-range',
        },
        root
      );
    }

    // Needle: everyone's resolution rate.
    const needle = svg('g', { class: 'needle' }, root);
    needle.style.opacity = String(1 - this.fade);
    svg(
      'path',
      {
        d: `M ${CX - 4} ${CY + 14} L ${CX} ${CY - R + 50} L ${CX + 4} ${CY + 14} Z`,
        fill: 'var(--ink)',
      },
      needle
    );
    svg('circle', { cx: CX, cy: CY, r: 10, fill: 'var(--ink)' }, root);
    svg('circle', { cx: CX, cy: CY, r: 4, fill: 'var(--agents)' }, root);

    const readout = svg(
      'text',
      {
        x: CX,
        y: CY + 54,
        'text-anchor': 'middle',
        fill: 'var(--ink)',
        'font-size': 34,
        'font-weight': 700,
        'letter-spacing': '-0.02em',
        'data-readout': '',
      },
      root
    );
    readout.textContent = formatRate(resolved);
    const unit = svg(
      'text',
      {
        x: CX,
        y: CY + 76,
        'text-anchor': 'middle',
        fill: 'var(--ink-muted)',
        'font-size': 11,
        'font-weight': 600,
        'letter-spacing': '0.08em',
      },
      root
    );
    unit.textContent = 'ISSUES RESOLVED / DAY';

    frame.replaceChildren(root);

    const settle = () => {
      needle.style.transform = `rotate(${angle(resolved)}deg)`;
    };
    needle.style.transform = `rotate(${START}deg)`;
    // Only the first drawing sweeps up from zero.
    if (this.drawn || prefersReducedMotion()) settle();
    else requestAnimationFrame(() => requestAnimationFrame(settle));
    this.drawn = true;

    this.renderCaption(v, state, gap);
  }

  private renderCaption(v: Velocity, state: Pace, gap: number) {
    const heading = this.querySelector<HTMLElement>('[data-heading]')!;
    heading.textContent = this.heading;
    heading.hidden = !this.heading;

    const caption = this.querySelector<HTMLElement>('[data-gap]')!;
    caption.dataset.state = state;
    caption.textContent =
      state === 'even'
        ? '= Level with new issues'
        : state === 'ahead'
          ? `▲ ${formatRate(gap)} a day ahead of new issues`
          : `▼ ${formatRate(gap)} a day behind new issues`;
    const forecast = this.querySelector<HTMLElement>('[data-forecast]')!;
    forecast.hidden = !this.range;
    if (this.range) {
      forecast.textContent = `Forecast: likely ${formatRate(this.range.low)}–${formatRate(this.range.high)} resolved a day`;
    }

    const odometer = this.querySelector<HTMLElement>('[data-odometer]')!;
    odometer.hidden = this.open === null;
    if (this.open !== null) {
      const digits = String(Math.max(0, Math.round(this.open))).padStart(
        6,
        '0'
      );
      const wheels = this.querySelector('[data-wheels]')!;
      wheels.replaceChildren(
        ...[...digits].map((digit, i) => {
          const wheel = document.createElement('span');
          wheel.className = 'wheel';
          // Leading zeros are dimmed, as on a mechanical counter.
          if (i < digits.length - String(Math.round(this.open!)).length) {
            wheel.classList.add('lead');
          }
          wheel.textContent = digit;
          return wheel;
        })
      );
      odometer.setAttribute(
        'aria-label',
        `${Math.round(this.open)} open issues`
      );
    }

    const item = (
      kind: string,
      color: string,
      label: string,
      value: number
    ) => {
      const li = document.createElement('li');
      const key = document.createElement('span');
      key.className = `key key-${kind}`;
      key.style.background = color;
      const text = document.createElement('span');
      const strong = document.createElement('strong');
      strong.className = 'tabular';
      strong.textContent = formatRate(value);
      text.append(strong, ` ${label}`);
      li.append(key, text);
      return li;
    };
    this.querySelector('[data-legend]')!.replaceChildren(
      item('arc', 'var(--agents)', 'AI agents', v.agent),
      item('arc', 'var(--humans)', 'humans', v.human),
      item('tick', 'var(--arrivals)', 'new issues a day', v.arrivals)
    );
  }
}

if (!customElements.get(VelocityGaugeComponent.tagName)) {
  customElements.define(VelocityGaugeComponent.tagName, VelocityGaugeComponent);
}
