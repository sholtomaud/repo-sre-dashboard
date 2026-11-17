import { BaseComponent } from '../../core/base-component.ts';
import { niceCeil, type DailyPoint } from '../../services/metrics.ts';
import { formatCount, formatDate } from '../../lib/format.ts';
import { svg } from '../../lib/svg.ts';
import template from './trend-chart.html?raw';
import style from './trend-chart.css?raw';

interface Series {
  key: 'open' | 'agentClosed' | 'humanClosed' | 'totalClosed';
  label: string;
  color: string;
}

/** Fixed order: a series keeps its colour whichever others are hidden. */
const SERIES: Series[] = [
  { key: 'open', label: 'Open issues', color: 'var(--series-1)' },
  { key: 'agentClosed', label: 'Closed by AI agent', color: 'var(--series-2)' },
  { key: 'humanClosed', label: 'Closed by human', color: 'var(--series-3)' },
  { key: 'totalClosed', label: 'Total closed', color: 'var(--series-4)' },
];

const MARGIN = { top: 12, right: 16, bottom: 32, left: 44 };
const DAY = 86_400_000;

/**
 * Cumulative issue counts over time, one line per series, with a crosshair
 * tooltip, toggleable legend and a table view.
 *
 * Set `points` to draw it.
 */
export class TrendChartComponent extends BaseComponent {
  static tagName = 'trend-chart';

  private data: DailyPoint[] = [];
  private names: Partial<Record<Series['key'], string>> = {};
  private hiddenSeries = new Set<Series['key']>();
  private resize: ResizeObserver | undefined;

  constructor() {
    super(template, style);
  }

  set points(value: DailyPoint[]) {
    this.data = value;
    if (this.isConnected) this.update();
  }
  get points(): DailyPoint[] {
    return this.data;
  }

  /** Series names, when the defaults (for public issues) do not fit. */
  set labels(value: Partial<Record<Series['key'], string>>) {
    this.names = value;
    if (this.isConnected) this.renderLegend();
  }

  private label(series: Series): string {
    return this.names[series.key] ?? series.label;
  }

  init() {
    this.renderLegend();
    this.delegate('click', '[data-series]', (_event, button) => {
      const key = button.dataset.series as Series['key'];
      if (this.hiddenSeries.has(key)) this.hiddenSeries.delete(key);
      else if (this.hiddenSeries.size < SERIES.length - 1)
        this.hiddenSeries.add(key);
      this.renderLegend();
      this.draw();
    });
    const plot = this.querySelector<HTMLElement>('[data-plot]')!;
    this.resize = new ResizeObserver(() => this.draw());
    this.resize.observe(plot);
    if (this.data.length) this.update();
  }

  disconnectedCallback() {
    this.resize?.disconnect();
  }

  private update() {
    this.draw();
    this.renderTable();
  }

  private renderLegend() {
    const legend = this.querySelector('[data-legend]')!;
    legend.replaceChildren(
      ...SERIES.map((series) => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.series = series.key;
        button.setAttribute(
          'aria-pressed',
          String(!this.hiddenSeries.has(series.key))
        );
        const key = document.createElement('span');
        key.className = 'key';
        key.style.background = series.color;
        button.append(key, this.label(series));
        li.append(button);
        return li;
      })
    );
  }

  private renderTable() {
    const headers = this.querySelectorAll('thead th');
    SERIES.forEach((series, i) => {
      headers[i + 1].textContent = this.label(series);
    });
    const body = this.querySelector('[data-rows]')!;
    body.replaceChildren(
      ...[...this.data].reverse().map((point) => {
        const row = document.createElement('tr');
        for (const value of [
          point.date,
          formatCount(point.open),
          formatCount(point.agentClosed),
          formatCount(point.humanClosed),
          formatCount(point.totalClosed),
          point.hoursToMidnight.toFixed(1),
        ]) {
          const cell = document.createElement('td');
          cell.textContent = value;
          row.append(cell);
        }
        return row;
      })
    );
  }

  private draw() {
    const plot = this.querySelector<HTMLElement>('[data-plot]');
    const tooltip = this.querySelector<HTMLElement>('[data-tooltip]');
    if (!plot || !tooltip || this.data.length === 0) return;

    const width = plot.clientWidth;
    const height = plot.clientHeight;
    if (width === 0) return;
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;
    const visible = SERIES.filter(
      (series) => !this.hiddenSeries.has(series.key)
    );

    const times = this.data.map((point) => Date.parse(point.date));
    // A single day still needs a span to draw across.
    const t0 = times[0] - (times.length === 1 ? DAY : 0);
    const t1 = times[times.length - 1] + (times.length === 1 ? DAY : 0);
    const yMax = niceCeil(
      Math.max(1, ...this.data.flatMap((p) => visible.map((s) => p[s.key])))
    );
    const x = (t: number) => MARGIN.left + ((t - t0) / (t1 - t0)) * innerW;
    const y = (v: number) => MARGIN.top + innerH - (v / yMax) * innerH;

    const root = svg('svg', {
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': `Issue counts from ${formatDate(this.data[0].date)} to ${formatDate(this.data[this.data.length - 1].date)}. The table below lists every value.`,
    });

    // Gridlines and y-axis labels.
    for (let i = 0; i <= 4; i++) {
      const value = (yMax / 4) * i;
      const yy = y(value);
      svg(
        'line',
        {
          x1: MARGIN.left,
          x2: width - MARGIN.right,
          y1: yy,
          y2: yy,
          stroke: i === 0 ? 'var(--axis)' : 'var(--grid)',
          'stroke-width': 1,
          'shape-rendering': 'crispEdges',
        },
        root
      );
      const label = svg(
        'text',
        {
          x: MARGIN.left - 10,
          y: yy,
          'text-anchor': 'end',
          'dominant-baseline': 'central',
          fill: 'var(--ink-muted)',
          'font-size': 11,
          class: 'tabular',
        },
        root
      );
      label.textContent = formatCount(value);
    }

    // X-axis date labels, thinned to fit.
    const maxLabels = Math.max(2, Math.floor(innerW / 80));
    const every = Math.max(1, Math.ceil(this.data.length / maxLabels));
    this.data.forEach((point, i) => {
      const last = i === this.data.length - 1;
      if (i % every !== 0 && !last) return;
      // Leave room for the last date, which is always labelled.
      if (!last && x(times[times.length - 1]) - x(times[i]) < 64) return;
      const label = svg(
        'text',
        {
          x: x(times[i]),
          y: height - 8,
          'text-anchor':
            this.data.length === 1
              ? 'middle'
              : i === 0
                ? 'start'
                : last
                  ? 'end'
                  : 'middle',
          fill: 'var(--ink-muted)',
          'font-size': 11,
        },
        root
      );
      label.textContent = formatDate(point.date, false);
    });

    // Lines, then end dots ringed in the surface colour.
    for (const series of visible) {
      const d = this.data
        .map((p, i) => `${i ? 'L' : 'M'} ${x(times[i])} ${y(p[series.key])}`)
        .join(' ');
      svg(
        'path',
        {
          d,
          fill: 'none',
          stroke: series.color,
          'stroke-width': 2,
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round',
        },
        root
      );
    }
    for (const series of visible) {
      const last = this.data[this.data.length - 1];
      svg(
        'circle',
        {
          cx: x(times[times.length - 1]),
          cy: y(last[series.key]),
          r: 4,
          fill: series.color,
          stroke: 'var(--surface)',
          'stroke-width': 2,
        },
        root
      );
    }

    // Hover layer: a crosshair that snaps to the nearest day.
    const crosshair = svg('g', { visibility: 'hidden' }, root);
    const line = svg(
      'line',
      {
        y1: MARGIN.top,
        y2: MARGIN.top + innerH,
        stroke: 'var(--ink-muted)',
        'stroke-width': 1,
        'shape-rendering': 'crispEdges',
      },
      crosshair
    );
    const dots = visible.map((series) =>
      svg(
        'circle',
        {
          r: 4,
          fill: series.color,
          stroke: 'var(--surface)',
          'stroke-width': 2,
        },
        crosshair
      )
    );
    const hit = svg(
      'rect',
      {
        x: MARGIN.left,
        y: MARGIN.top,
        width: innerW,
        height: innerH,
        fill: 'transparent',
        tabindex: 0,
        'aria-label': 'Chart values. Use the arrow keys to move between days.',
      },
      root
    );

    let index = this.data.length - 1;
    const show = (i: number) => {
      index = Math.max(0, Math.min(this.data.length - 1, i));
      const point = this.data[index];
      const xx = x(times[index]);
      line.setAttribute('x1', String(xx));
      line.setAttribute('x2', String(xx));
      visible.forEach((series, n) => {
        dots[n].setAttribute('cx', String(xx));
        dots[n].setAttribute('cy', String(y(point[series.key])));
      });
      crosshair.setAttribute('visibility', 'visible');
      this.fillTooltip(tooltip, point, visible);
      tooltip.hidden = false;
      const tipW = tooltip.offsetWidth;
      const left = xx + 14 + tipW > width ? xx - 14 - tipW : xx + 14;
      tooltip.style.transform = `translate(${Math.max(0, left)}px, ${MARGIN.top}px)`;
    };
    const hide = () => {
      crosshair.setAttribute('visibility', 'hidden');
      tooltip.hidden = true;
    };
    const nearest = (clientX: number) => {
      const box = root.getBoundingClientRect();
      const t = t0 + ((clientX - box.left - MARGIN.left) / innerW) * (t1 - t0);
      let best = 0;
      times.forEach((time, i) => {
        if (Math.abs(time - t) < Math.abs(times[best] - t)) best = i;
      });
      return best;
    };
    hit.addEventListener('pointermove', (event) =>
      show(nearest(event.clientX))
    );
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('focus', () => show(index));
    hit.addEventListener('blur', hide);
    hit.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') show(index - 1);
      else if (event.key === 'ArrowRight') show(index + 1);
      else if (event.key === 'Escape') hide();
      else return;
      event.preventDefault();
    });

    plot.querySelector('svg')?.remove();
    plot.prepend(root);
  }

  private fillTooltip(
    tooltip: HTMLElement,
    point: DailyPoint,
    visible: Series[]
  ) {
    const date = document.createElement('div');
    date.className = 'tip-date';
    date.textContent = formatDate(point.date);
    const rows = visible.map((series) => {
      const row = document.createElement('div');
      row.className = 'tip-row';
      const key = document.createElement('span');
      key.className = 'key';
      key.style.background = series.color;
      const value = document.createElement('strong');
      value.textContent = formatCount(point[series.key]);
      row.append(key, value, this.label(series));
      return row;
    });
    tooltip.replaceChildren(date, ...rows);
  }
}

if (!customElements.get(TrendChartComponent.tagName)) {
  customElements.define(TrendChartComponent.tagName, TrendChartComponent);
}
