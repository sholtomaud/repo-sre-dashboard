import { BaseComponent } from '../../core/base-component.ts';
import {
  ORIGINS,
  agentMergedShare,
  formatDuration,
  type Origin,
  type Pulls,
} from '../../services/health.ts';
import { formatCount, formatPercent } from '../../lib/format.ts';
import template from './pull-panel.html?raw';
import style from './pull-panel.css?raw';

const ORIGIN_STYLE: Record<Origin, { label: string; color: string }> = {
  agent: { label: 'AI agent', color: 'var(--agents)' },
  assisted: { label: 'Person with an agent', color: 'var(--agents)' },
  human: { label: 'Person', color: 'var(--humans)' },
};

/**
 * Pull requests by who wrote them: an agent, a person with an agent, or a
 * person alone. Hidden when the data has no pull request summary.
 */
export class PullPanelComponent extends BaseComponent {
  static tagName = 'pull-panel';

  private value: Pulls | null = null;

  constructor() {
    super(template, style);
  }

  set pulls(value: Pulls | null) {
    this.value = value;
    if (this.isConnected) this.draw();
  }
  get pulls(): Pulls | null {
    return this.value;
  }

  init() {
    this.draw();
  }

  private draw() {
    const pulls = this.value;
    this.hidden = !pulls;
    if (!pulls) return;
    const set = (selector: string, text: string) => {
      this.querySelector(selector)!.textContent = text;
    };
    set('[data-window]', String(pulls.windowDays));
    const share = agentMergedShare(pulls);
    set('[data-share]', share === null ? '—' : formatPercent(share));
    set(
      '[data-share-text]',
      share === null
        ? `no pull requests merged in the last ${pulls.windowDays} days`
        : "of merged pull requests had an agent's hand in them"
    );

    const merged = ORIGINS.map((o) => ({ o, value: pulls.byOrigin[o].merged }));
    const bar = this.querySelector<HTMLElement>('[data-bar]')!;
    bar.setAttribute(
      'aria-label',
      'Merged pull requests by who wrote them: ' +
        merged
          .map(({ o, value }) => `${ORIGIN_STYLE[o].label} ${value}`)
          .join(', ')
    );
    bar.replaceChildren(
      ...merged
        .filter(({ value }) => value > 0)
        .map(({ o, value }) => {
          const segment = document.createElement('span');
          segment.className = 'segment';
          segment.dataset.origin = o;
          segment.style.flex = `${value} 0 0`;
          segment.style.background = ORIGIN_STYLE[o].color;
          segment.title = `${ORIGIN_STYLE[o].label}: ${value} merged`;
          return segment;
        })
    );
    this.querySelector('[data-legend]')!.replaceChildren(
      ...merged.map(({ o, value }) => {
        const item = document.createElement('li');
        const swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.dataset.origin = o;
        swatch.style.background = ORIGIN_STYLE[o].color;
        const strong = document.createElement('strong');
        strong.className = 'tabular';
        strong.textContent = formatCount(value);
        item.append(swatch, strong, `${ORIGIN_STYLE[o].label}`);
        return item;
      })
    );

    this.querySelector('[data-rows]')!.replaceChildren(
      ...ORIGINS.map((o) => {
        const s = pulls.byOrigin[o];
        const row = document.createElement('tr');
        row.dataset.origin = o;
        for (const text of [
          ORIGIN_STYLE[o].label,
          formatCount(s.opened),
          formatCount(s.merged),
          formatCount(s.closedUnmerged),
          s.mergeRate === null ? '—' : formatPercent(s.mergeRate),
          formatDuration(s.medianHoursToMerge),
        ]) {
          const cell = document.createElement('td');
          cell.textContent = text;
          row.append(cell);
        }
        return row;
      })
    );

    const named = Object.entries(pulls.agents).sort((a, b) => b[1] - a[1]);
    set(
      '[data-agents]',
      named.length
        ? `Agents seen: ${named.map(([name, n]) => `${name} ${n}`).join(' · ')}.`
        : `No agent named in the last ${pulls.windowDays} days.`
    );
  }
}

if (!customElements.get(PullPanelComponent.tagName)) {
  customElements.define(PullPanelComponent.tagName, PullPanelComponent);
}
