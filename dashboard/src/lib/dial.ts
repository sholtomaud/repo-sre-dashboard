import { arcPath, polar, svg } from './svg.ts';

/** The dial sweeps 240°, from 0 at lower left to 100 at lower right. */
const START = -120;
const SWEEP = 240;
const angle = (value: number) =>
  START + (Math.min(100, Math.max(0, value)) / 100) * SWEEP;

export interface DialBand {
  from: number;
  to: number;
  /** A CSS colour, normally a status token. */
  colour: string;
}

export interface DialOptions {
  /** The needle, 0–100; `null` draws an empty dial. */
  value: number | null;
  bands: DialBand[];
  /** A magenta mark outside the ring: a target, as on an aircraft dial. */
  target?: number | null;
  /** Tick values with labels; small dials leave them out. */
  ticks?: number[];
  label: string;
}

/**
 * A 0–100 dial in the style of an instrument panel: coloured zones, a
 * needle for now, and an optional target mark. The figure itself is left to
 * the page, so it can be read by assistive technology as text.
 */
export function dial({
  value,
  bands,
  target = null,
  ticks = [],
  label,
}: DialOptions): SVGSVGElement {
  const cx = 100;
  const cy = 100;
  const r = 78;
  const root = svg('svg', {
    viewBox: '0 0 200 190',
    class: 'dial',
    role: 'img',
    'aria-label': label,
  });
  svg(
    'path',
    { d: arcPath(cx, cy, r, START, START + SWEEP), class: 'dial-track' },
    root
  );
  for (const band of bands) {
    const path = svg(
      'path',
      {
        d: arcPath(cx, cy, r, angle(band.from), angle(band.to)),
        class: 'dial-band',
      },
      root
    );
    path.style.stroke = band.colour;
    if (value === null) path.style.opacity = '0.25';
  }
  for (const tick of ticks) {
    const a = angle(tick);
    const inner = polar(cx, cy, r - 14, a);
    const outer = polar(cx, cy, r - 6, a);
    svg(
      'line',
      {
        x1: inner.x,
        y1: inner.y,
        x2: outer.x,
        y2: outer.y,
        class: 'dial-tick',
      },
      root
    );
    const at = polar(cx, cy, r - 26, a);
    const text = svg(
      'text',
      { x: at.x, y: at.y + 4, class: 'dial-tick-label' },
      root
    );
    text.textContent = String(tick);
  }
  if (target !== null && value !== null && target > value) {
    const a = angle(target);
    const tip = polar(cx, cy, r + 7, a);
    const left = polar(cx, cy, r + 17, a - 4);
    const right = polar(cx, cy, r + 17, a + 4);
    svg(
      'path',
      {
        d: `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`,
        class: 'dial-target',
      },
      root
    );
  }
  if (value !== null) {
    const a = angle(value);
    const tip = polar(cx, cy, r - 10, a);
    const tail = polar(cx, cy, 12, a + 180);
    svg(
      'line',
      {
        x1: tail.x,
        y1: tail.y,
        x2: tip.x,
        y2: tip.y,
        class: 'dial-needle',
      },
      root
    );
    svg('circle', { cx, cy, r: 6, class: 'dial-hub' }, root);
  }
  return root;
}
