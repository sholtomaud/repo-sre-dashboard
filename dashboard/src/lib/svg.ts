const NS = 'http://www.w3.org/2000/svg';

/** Creates an SVG element with attributes set. */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number> = {},
  parent?: Element
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  parent?.append(element);
  return element;
}

/** A point on a circle, with 0° at 12 o'clock and angles running clockwise. */
export function polar(cx: number, cy: number, r: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return { x: cx + r * Math.sin(radians), y: cy - r * Math.cos(radians) };
}

/** Path data for an arc between two clockwise angles. */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  from: number,
  to: number
): string {
  const start = polar(cx, cy, r, from);
  const end = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

/** True when the reader has asked for less motion. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
