import { BaseComponent } from '../../core/base-component.ts';
import { formatCount, formatDays, formatRate } from '../../lib/format.ts';
import template from './queue-compare.html?raw';
import style from './queue-compare.css?raw';

/** One queue's totals and daily rates. */
export interface QueueFigures {
  open: number;
  resolved: number;
  /** New items per day. */
  arrivals: number;
  /** Items resolved by AI agents per day. */
  agentResolved: number;
  /** Items resolved by people per day. */
  humanResolved: number;
  /** Running totals of resolutions by agents and by people. */
  resolvedByAgents: number;
  resolvedByHumans: number;
  /** Days the two rates are averaged over. */
  days: number;
}

export interface QueueComparison {
  /** The agents' own queue; `null` when it could not be read. */
  agents: QueueFigures | null;
  publicIssues: QueueFigures;
}

/**
 * The agents' own in-repository queue beside the public GitHub issues, with
 * the same two rates for each on a shared scale.
 *
 * Set `comparison` to draw it.
 */
export class QueueCompareComponent extends BaseComponent {
  static tagName = 'queue-compare';

  private value: QueueComparison | undefined;

  constructor() {
    super(template, style);
  }

  set comparison(value: QueueComparison) {
    this.value = value;
    if (this.isConnected) this.draw();
  }
  get comparison(): QueueComparison | undefined {
    return this.value;
  }

  init() {
    if (this.value) this.draw();
  }

  private draw() {
    const { agents, publicIssues } = this.value!;
    const scale = Math.max(
      1,
      publicIssues.arrivals,
      publicIssues.agentResolved,
      agents?.arrivals ?? 0,
      agents?.agentResolved ?? 0,
      publicIssues.humanResolved,
      agents?.humanResolved ?? 0
    );
    const sections = [
      this.queue(
        "Agents' own queue",
        agents
          ? 'Files in the repository'
          : 'Could not be read on the last update',
        'Resolved',
        agents,
        scale
      ),
      this.queue(
        'Public GitHub issues',
        'Reported on GitHub',
        'Closed',
        publicIssues,
        scale
      ),
    ];
    this.querySelector('[data-grid]')!.replaceChildren(...sections);

    const summary = this.querySelector('[data-summary]')!;
    const strong = (text: string) => {
      const element = document.createElement('strong');
      element.textContent = text;
      return element;
    };
    summary.replaceChildren(
      ...(agents
        ? [
            'Agents resolve ',
            strong(`${formatRate(agents.agentResolved)} a day`),
            ' in their own queue and ',
            strong(`${formatRate(publicIssues.agentResolved)} a day`),
            ' in the public one. Humans resolve ',
            strong(`${formatRate(agents.humanResolved)} a day`),
            ' and ',
            strong(`${formatRate(publicIssues.humanResolved)} a day`),
            '.',
          ]
        : ["The agents' own queue was not available on the last update."])
    );
    // Bars start at zero width and grow to their value.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        this.querySelectorAll<HTMLElement>('.bar').forEach((bar) => {
          bar.style.width = bar.dataset.width!;
        })
      )
    );
  }

  private queue(
    name: string,
    source: string,
    resolvedLabel: string,
    figures: QueueFigures | null,
    scale: number
  ): Element {
    const fragment = this.querySelector<HTMLTemplateElement>(
      '[data-queue-template]'
    )!.content.cloneNode(true) as DocumentFragment;
    const section = fragment.firstElementChild!;
    const set = (selector: string, text: string) => {
      section.querySelector(selector)!.textContent = text;
    };
    set('[data-name]', name);
    set(
      '[data-source]',
      figures?.days
        ? `${source} · rates over the last ${formatDays(figures.days)} days`
        : source
    );
    set('[data-resolved-label]', resolvedLabel);
    set('[data-open]', figures ? formatCount(figures.open) : '—');
    set('[data-resolved]', figures ? formatCount(figures.resolved) : '—');
    if (figures) {
      section
        .querySelector('[data-bars]')!
        .append(
          this.bar('New per day', figures.arrivals, scale, 'var(--series-1)'),
          this.bar(
            'Resolved by agents per day',
            figures.agentResolved,
            scale,
            'var(--series-2)'
          ),
          this.bar(
            'Resolved by humans per day',
            figures.humanResolved,
            scale,
            'var(--series-3)'
          )
        );
      set(
        '[data-split]',
        `${formatCount(figures.resolvedByAgents)} by agents · ${formatCount(figures.resolvedByHumans)} by humans`
      );
    }
    return section;
  }

  private bar(label: string, value: number, scale: number, color: string) {
    const row = document.createElement('div');
    row.className = 'bar-row';
    const name = document.createElement('span');
    name.textContent = label;
    const track = document.createElement('div');
    track.className = 'bar-track';
    const bar = document.createElement('span');
    bar.className = 'bar';
    bar.style.background = color;
    bar.style.width = '0';
    // Leave room for the value label at the tip.
    bar.dataset.width = `${(Math.max(0, value) / scale) * 82}%`;
    const text = document.createElement('span');
    text.className = 'bar-value tabular';
    text.textContent = formatRate(value);
    track.append(bar, text);
    row.append(name, track);
    return row;
  }
}

if (!customElements.get(QueueCompareComponent.tagName)) {
  customElements.define(QueueCompareComponent.tagName, QueueCompareComponent);
}
