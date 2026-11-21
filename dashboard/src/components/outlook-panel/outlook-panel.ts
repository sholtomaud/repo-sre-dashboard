import { BaseComponent } from '../../core/base-component.ts';
import type { Budget, IssueClass, Outlook } from '../../services/outlook.ts';
import { CLASSES } from '../../services/outlook.ts';
import {
  formatCount,
  formatDate,
  formatMoney,
  formatRate,
} from '../../lib/format.ts';
import { svg } from '../../lib/svg.ts';
import template from './outlook-panel.html?raw';
import style from './outlook-panel.css?raw';

const CLASS_NAMES: Record<IssueClass, string> = {
  security: 'Security',
  bug: 'Bugs',
  other: 'Features and other',
};

const STATES = {
  secure: { icon: '✓', label: 'In control' },
  holding: { icon: '!', label: 'Holding, with risk' },
  risk: { icon: '!', label: 'Likely to lose control' },
  lost: { icon: '✕', label: 'Control already lost' },
} as const;

const percent = (p: number) => `${Math.round(p * 100)}%`;
const days = (d: number) =>
  !Number.isFinite(d)
    ? 'never'
    : d < 1
      ? `${Math.round(d * 24)} h`
      : `${Number.isInteger(d) ? d : formatRate(d)} ${d === 1 ? 'day' : 'days'}`;

/** Where the reliability back-test comes from. */
export interface Reliability {
  checked: number;
  inside: number;
}

/**
 * The project outlook: the manageability index, when control would be
 * lost (with agents and humans, and with humans alone), when the backlog
 * could be cleared, the agents' effect, each class against its limit, cost
 * and how reliable past forecasts were.
 *
 * Call `show()` with the outlook and the date it starts from.
 */
export class OutlookPanelComponent extends BaseComponent {
  static tagName = 'outlook-panel';

  constructor() {
    super(template, style);
  }

  /** Shown instead of the outlook, with why (e.g. older data). */
  unavailable(message: string) {
    if (!this.isConnected) return;
    this.querySelector('[data-pending]')!.textContent = message;
  }

  show(
    outlook: Outlook,
    startDate: string,
    reliability: Reliability | null | 'pending'
  ) {
    if (!this.isConnected) return;
    const date = (day: number) =>
      formatDate(
        new Date(Date.parse(startDate) + day * 86_400_000)
          .toISOString()
          .slice(0, 10)
      );
    const set = (selector: string, text: string) => {
      this.querySelector(selector)!.textContent = text;
    };
    this.querySelector<HTMLElement>('[data-pending]')!.hidden = true;
    this.querySelector<HTMLElement>('[data-body]')!.hidden = false;

    const horizon = date(outlook.horizonDay);
    set('[data-index]', percent(outlook.index));
    set(
      '[data-index-text]',
      `chance of staying manageable to ${horizon}, where the forecast stops being better than a guess`
    );
    const state =
      outlook.doom.all.day === 0
        ? 'lost'
        : outlook.index >= 0.9
          ? 'secure'
          : outlook.index >= 0.5
            ? 'holding'
            : 'risk';
    this.querySelector<HTMLElement>('[data-state]')!.dataset.state = state;
    set('[data-state-icon]', STATES[state].icon);
    set('[data-state-label]', STATES[state].label);

    const doom = (name: 'all' | 'humans', who: string) => {
      const d = outlook.doom[name];
      set(
        `[data-doom-${name}]`,
        d.day === 0 ? 'Now' : d.day === null ? `Not by ${horizon}` : date(d.day)
      );
      set(
        `[data-doom-${name}-note]`,
        d.day === 0
          ? `a class is already past its limit ${who}`
          : d.day === null
            ? `${percent(d.byHorizon)} chance by then ${who}`
            : `50% chance by then ${who}; ${percent(d.byHorizon)} by ${horizon}`
      );
      // Already lost: the chance is 1 throughout, so no chart.
      this.curve(`[data-curve-${name}]`, d.day === 0 ? [] : d.curve);
    };
    doom('all', 'with agents and humans');
    doom('humans', 'with people alone');

    const c = outlook.completion;
    set(
      '[data-completion]',
      c.state === 'clear'
        ? 'Clear'
        : c.state === 'diverging'
          ? 'Diverging'
          : c.state === 'beyond'
            ? `Not within ${c.days} days`
            : date(c.p50)
    );
    set(
      '[data-completion-note]',
      c.state === 'clear'
        ? 'no open issues right now'
        : c.state === 'diverging'
          ? 'issues arrive at least as fast as they are resolved, so there is no completion date'
          : c.state === 'beyond'
            ? 'fewer than half the simulations clear it'
            : c.p85 === null
              ? '50% chance by then'
              : `50% chance by then; 85% by ${date(c.p85)}`
    );

    const a = outlook.agents;
    set(
      '[data-agents]',
      {
        benefit: 'A benefit',
        burden: 'A burden',
        neutral: 'No clear effect',
        none: 'No agent activity',
      }[a.verdict]
    );
    set(
      '[data-agents-note]',
      a.verdict === 'none'
        ? 'no issues filed or resolved by agents in the last week'
        : `chance of losing control by ${horizon}: ${percent(a.withAgents)} with agents, ${percent(a.withoutAgents)} without; median backlog ${formatCount(a.openWith)} with, ${formatCount(a.openWithout)} without`
    );

    this.querySelector('[data-classes]')!.replaceChildren(
      ...CLASSES.map((cls) => {
        const now = outlook.now[cls];
        const judged = outlook.judged.includes(cls);
        const row = document.createElement('tr');
        const status = !judged ? 'unjudged' : now.over ? 'over' : 'within';
        const cells = [
          CLASS_NAMES[cls],
          formatCount(Math.max(0, now.open)),
          formatRate(now.resolvedPerDay),
          judged ? days(now.waitDays) : '—',
          days(now.limitDays),
          status === 'unjudged'
            ? 'No issues yet'
            : status === 'over'
              ? '✕ Over limit'
              : '✓ Within limit',
        ];
        cells.forEach((text, i) => {
          const cell = document.createElement('td');
          cell.textContent = text;
          if (i === cells.length - 1) {
            cell.className = 'class-status';
            cell.dataset.status = status;
          }
          row.append(cell);
        });
        row.dataset.class = cls;
        return row;
      })
    );

    const cost = outlook.cost;
    set(
      '[data-cost]',
      cost
        ? `Cost: about ${formatMoney(cost.monthlySpendNow, cost.currency)} a month at today's resolution rate; keeping pace with new issues would take ${formatMoney(cost.monthlyToKeepPace, cost.currency)} a month.` +
            budgetText(outlook, 'human', horizon, date) +
            budgetText(outlook, 'agentic', horizon, date)
        : 'Cost: set the agent-cost-per-issue and human-hourly-rate inputs to see what resolving issues costs, and when it would outrun a budget.'
    );
    set(
      '[data-reliability]',
      reliability === 'pending'
        ? 'Reliability: checking past forecasts…'
        : reliability
          ? `Reliability: ${reliability.inside} of ${reliability.checked} past 7-day forecasts of the backlog landed inside their 90% range (${percent(reliability.inside / reliability.checked)}).`
          : 'Reliability: needs at least two weeks of history to check past forecasts.'
    );
  }

  /** A tiny chart of the chance of having lost control, day by day. */
  private curve(selector: string, values: number[]) {
    const holder = this.querySelector(selector)!;
    if (values.length < 2) {
      holder.replaceChildren();
      return;
    }
    const root = svg('svg', {
      viewBox: '0 0 100 28',
      preserveAspectRatio: 'none',
      'aria-hidden': 'true',
    });
    const x = (i: number) => (i / (values.length - 1)) * 100;
    const y = (p: number) => 26 - p * 24;
    svg(
      'line',
      {
        x1: 0,
        x2: 100,
        y1: y(0.5),
        y2: y(0.5),
        stroke: 'var(--axis)',
        'stroke-width': 1,
        'vector-effect': 'non-scaling-stroke',
        'stroke-dasharray': '2 2',
      },
      root
    );
    svg(
      'path',
      {
        d: values.map((p, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(p)}`).join(' '),
        fill: 'none',
        stroke: 'var(--critical)',
        'stroke-width': 2,
        'vector-effect': 'non-scaling-stroke',
      },
      root
    );
    holder.replaceChildren(root);
  }
}

/** What the forecast says about one monthly budget. */
function budgetText(
  outlook: Outlook,
  budget: Budget,
  horizon: string,
  date: (day: number) => string
): string {
  const whose = budget === 'human' ? "People's" : "Agents'";
  const input =
    budget === 'human' ? 'monthly-human-budget' : 'monthly-agentic-budget';
  const doom = outlook.doom.cost?.[budget] ?? null;
  if (!doom)
    return ` Set ${input} to forecast when ${whose.toLowerCase()} budget would be exceeded.`;
  return doom.day === null
    ? ` ${whose} budget holds to ${horizon} (${percent(doom.byHorizon)} chance of exceeding it).`
    : ` Keeping pace is likely to exceed ${whose.toLowerCase()} budget by ${date(doom.day)}.`;
}

if (!customElements.get(OutlookPanelComponent.tagName)) {
  customElements.define(OutlookPanelComponent.tagName, OutlookPanelComponent);
}
