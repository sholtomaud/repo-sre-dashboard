import { BaseComponent } from '../../core/base-component.ts';
import { formatDuration } from '../../services/health.ts';
import type {
  Band,
  CiHealth,
  Delivery,
  DeliveryMetric,
} from '../../services/report.ts';
import { formatCount, formatPercent } from '../../lib/format.ts';
import { doraScale, type DoraName } from '../../services/instruments.ts';
import template from './delivery-panel.html?raw';
import style from './delivery-panel.css?raw';

const BANDS: Band[] = ['low', 'medium', 'high', 'elite'];
const BAND_NAMES: Record<Band, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  elite: 'Elite',
};

/** Deliveries a day, in words: `3.2 a day`, `2 a week`, `1 a month`. */
export function formatFrequency(perDay: number): string {
  if (perDay <= 0) return 'None';
  if (perDay >= 1) return `${perDay.toFixed(perDay < 10 ? 1 : 0)} a day`;
  if (perDay * 7 >= 1) return `${(perDay * 7).toFixed(1)} a week`;
  return `${(perDay * 30).toFixed(1)} a month`;
}

/** The DORA metrics and CI health. Hidden when the data has neither. */
export class DeliveryPanelComponent extends BaseComponent {
  static tagName = 'delivery-panel';

  private data: { delivery: Delivery | null; ci: CiHealth | null } = {
    delivery: null,
    ci: null,
  };

  constructor() {
    super(template, style);
  }

  show(delivery: Delivery | null, ci: CiHealth | null) {
    this.data = { delivery, ci };
    if (this.isConnected) this.draw();
  }

  init() {
    this.draw();
  }

  private draw() {
    const { delivery, ci } = this.data;
    this.hidden = !delivery && !ci;
    if (!delivery && !ci) return;
    if (delivery) {
      this.querySelector('[data-window]')!.textContent = String(
        delivery.windowDays
      );
      this.querySelector('[data-source]')!.textContent =
        delivery.source === 'merges'
          ? 'With no releases or deployments recorded, a merge to the default branch counts as a delivery.'
          : `Deliveries are ${delivery.source}.`;
      const m = delivery;
      this.querySelector('[data-dora]')!.replaceChildren(
        this.metric(
          'Deployment frequency',
          formatFrequency(m.frequency.value ?? 0),
          m.frequency,
          'frequency',
          `${formatCount(m.frequency.count)} ${m.frequency.basis}`
        ),
        this.metric(
          'Lead time for changes',
          formatDuration(m.leadTimeHours.value),
          m.leadTimeHours,
          'leadTimeHours',
          `median, ${m.leadTimeHours.basis}, over ${formatCount(m.leadTimeHours.count)} changes`
        ),
        this.metric(
          'Change failure rate',
          m.failureRate.value === null
            ? '—'
            : formatPercent(m.failureRate.value),
          m.failureRate,
          'failureRate',
          `${m.failureRate.basis}, of ${formatCount(m.failureRate.count)}`
        ),
        this.metric(
          'Time to restore service',
          formatDuration(m.restoreHours.value),
          m.restoreHours,
          'restoreHours',
          m.restoreHours.count
            ? `median over ${formatCount(m.restoreHours.count)} ${m.restoreHours.basis}`
            : `Not measured: ${m.restoreHours.basis}. Label incidents to measure it.`
        )
      );
    }

    const list = this.querySelector('[data-ci]')!;
    const note = this.querySelector('[data-ci-note]')!;
    if (!ci || ci.runs === 0) {
      list.replaceChildren();
      note.textContent = ci
        ? `No CI runs on the default branch in the last ${ci.windowDays} days, or the dashboard workflow lacks actions: read.`
        : 'CI health appears after the next tracker run.';
      return;
    }
    const item = (label: string, value: string, tone = '') => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      if (tone) dd.dataset.tone = tone;
      const box = document.createElement('div');
      box.append(dt, dd);
      return [box];
    };
    const rate = ci.successRate ?? 0;
    list.replaceChildren(
      ...item(
        'Runs passing',
        formatPercent(rate),
        rate >= 0.9 ? 'good' : rate < 0.75 ? 'bad' : ''
      ),
      ...item('Runs', formatCount(ci.runs)),
      ...item(
        'Median run time',
        ci.medianMinutes === null ? '—' : `${Math.round(ci.medianMinutes)} min`
      ),
      ...item('Time back to green', formatDuration(ci.medianHoursToGreen)),
      ...item(
        'Failing now',
        ci.failingNow.length ? ci.failingNow.join(', ') : 'Nothing',
        ci.failingNow.length ? 'bad' : 'good'
      )
    );
    note.textContent = `Pushes to the default branch in the last ${ci.windowDays} days. Time back to green runs from a workflow's first failure to its next success.`;
  }

  private metric(
    label: string,
    value: string,
    metric: DeliveryMetric,
    name: DoraName,
    note: string
  ): HTMLElement {
    const box = document.createElement('section');
    box.className = 'metric';
    box.dataset.metric = label;
    const p = (cls: string, text: string) => {
      const el = document.createElement('p');
      el.className = cls;
      el.textContent = text;
      return el;
    };
    const scale = document.createElement('ol');
    scale.className = 'scale';
    scale.setAttribute(
      'aria-label',
      metric.band ? `DORA band: ${BAND_NAMES[metric.band]}` : 'Not banded yet'
    );
    for (const band of BANDS) {
      const li = document.createElement('li');
      li.textContent = BAND_NAMES[band];
      li.setAttribute('aria-current', String(band === metric.band));
      scale.append(li);
    }
    box.append(
      p('metric-label', label),
      p('metric-value tabular', value),
      bullet(label, value, metric, name),
      scale,
      p('metric-note', note)
    );
    return box;
  }
}

/**
 * A bullet bar: the four DORA bands as greys, darker for worse, low on the
 * left; a bar runs from the left edge to the value.
 */
function bullet(
  label: string,
  value: string,
  metric: DeliveryMetric,
  name: DoraName
): HTMLElement {
  const scale = doraScale(name, metric.value);
  const box = document.createElement('div');
  box.className = 'bullet';
  box.dataset.bullet = '';
  box.setAttribute('role', 'img');
  box.setAttribute(
    'aria-label',
    scale.position === null
      ? `${label}: not measured`
      : `${label} ${value}` + (metric.band ? `: DORA ${metric.band}` : '')
  );
  for (const band of scale.bands) {
    const span = document.createElement('span');
    span.className = 'bullet-band';
    span.dataset.band = band.band;
    box.append(span);
  }
  if (scale.position !== null) {
    const bar = document.createElement('span');
    bar.className = 'bullet-bar';
    bar.style.width = `${Math.max(scale.position * 100, 1.5)}%`;
    box.append(bar);
  }
  return box;
}

if (!customElements.get(DeliveryPanelComponent.tagName)) {
  customElements.define(DeliveryPanelComponent.tagName, DeliveryPanelComponent);
}
