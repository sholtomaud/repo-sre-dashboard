import { BaseComponent } from '../../core/base-component.ts';
import { loadSnapshot, type Snapshot } from '../../services/metrics.ts';
import { formatDate, formatDateTime, formatTimeUtc } from '../../lib/format.ts';
import { nextUpdate } from '../../services/metrics.ts';
import {
  DATA_CSV_PATH,
  PROJECT_URL,
  loadConfig,
  type DashboardConfig,
} from '../../lib/config.ts';
import { closureSummary, loadAgentQueue } from '../../services/insights.ts';
import { parsePulls, parseResponses } from '../../services/health.ts';
import {
  findings,
  parseAudit,
  parseCi,
  parseClasses,
  parseDelivery,
  parseRepo,
  type Tone,
} from '../../services/report.ts';
import {
  backtest,
  buildOutlook,
  parseClassHistory,
  totalHistory,
} from '../../services/outlook.ts';
import { loadSimulator } from '../../lib/gssk-simulator.ts';
import type { TrendChartComponent } from '../trend-chart/trend-chart.ts';
import type { ClosureEvidenceComponent } from '../closure-evidence/closure-evidence.ts';
import type { PullPanelComponent } from '../pull-panel/pull-panel.ts';
import type { OutlookPanelComponent } from '../outlook-panel/outlook-panel.ts';
import type { ClassTableComponent } from '../class-table/class-table.ts';
import type { DeliveryPanelComponent } from '../delivery-panel/delivery-panel.ts';
import type { RepoProfileComponent } from '../repo-profile/repo-profile.ts';
import type { FlightDeckComponent } from '../flight-deck/flight-deck.ts';
import '../trend-chart/trend-chart.ts';
import '../closure-evidence/closure-evidence.ts';
import '../pull-panel/pull-panel.ts';
import '../outlook-panel/outlook-panel.ts';
import '../class-table/class-table.ts';
import '../delivery-panel/delivery-panel.ts';
import '../repo-profile/repo-profile.ts';
import '../flight-deck/flight-deck.ts';
import template from './dashboard-page.html?raw';
import style from './dashboard-page.css?raw';

const ICONS: Record<Tone, string> = {
  good: '✓',
  warn: '!',
  bad: '✕',
  neutral: '·',
};

/**
 * The dashboard: the instrument panel and what needs attention, then the outlook,
 * issues, pull requests and agents, delivery and the codebase.
 */
export class DashboardPageComponent extends BaseComponent {
  static tagName = 'dashboard-page';

  private config: DashboardConfig | null = null;

  constructor() {
    super(template, style);
  }

  async init() {
    const config = await loadConfig();
    this.config = config;
    const tracked = this.querySelector<HTMLAnchorElement>(
      '[data-tracked-link]'
    )!;
    tracked.href = config.repositoryUrl || config.issuesUrl;
    tracked.textContent = config.repository;
    this.querySelector('[data-title]')!.textContent = config.title;
    this.querySelector<HTMLAnchorElement>('[data-csv-link]')!.href =
      DATA_CSV_PATH;
    this.querySelector<HTMLAnchorElement>('[data-project-link]')!.href =
      PROJECT_URL;

    const asOf = this.querySelector<HTMLElement>('[data-as-of]')!;
    try {
      this.render(await loadSnapshot());
    } catch (error) {
      asOf.classList.add('error');
      asOf.textContent = `Could not load the data: ${(error as Error).message}`;
    }
  }

  private render(snapshot: Snapshot) {
    const tracker = snapshot.status;
    const raw = tracker?.raw;
    const next = tracker && nextUpdate(tracker);
    this.querySelector('[data-as-of]')!.textContent = tracker
      ? `Data as of ${formatDateTime(tracker.updatedAt)} · updated ${tracker.schedule.description}` +
        (next ? ` · next around ${formatTimeUtc(next)}` : '')
      : `Data as of ${formatDate(snapshot.latest.date)} (UTC)`;

    const repo = parseRepo(raw);
    if (repo?.description) {
      this.querySelector('[data-lede]')!.textContent = repo.description;
    }
    const classes = parseClasses(raw);
    const ci = parseCi(raw);
    const delivery = parseDelivery(raw);
    const audit = parseAudit(raw);
    const pulls = parsePulls(raw);
    const responses = parseResponses(raw);
    const closures = closureSummary(snapshot.latest);

    this.querySelector<FlightDeckComponent>('flight-deck')!.show({
      snapshot,
      classes,
      ci,
      delivery,
      audit,
      pulls,
      responses,
      closures,
      cost: this.config?.cost ?? null,
    });
    this.renderFindings(
      findings({ classes, ci, flowRatio: snapshot.doomLoop.ratio, audit })
    );
    const score = this.querySelector('[data-audit-score]')!;
    score.textContent = audit?.score != null ? ` · ${audit.score}/100` : '';

    this.querySelector<TrendChartComponent>('[data-trend="public"]')!.points =
      snapshot.history;
    this.querySelector<ClassTableComponent>('class-table')!.classes = classes;
    const evidence =
      this.querySelector<ClosureEvidenceComponent>('closure-evidence')!;
    evidence.closures = closures;
    evidence.issues = tracker?.issues;
    evidence.update();
    this.querySelector<PullPanelComponent>('pull-panel')!.pulls = pulls;
    this.querySelector<DeliveryPanelComponent>('delivery-panel')!.show(
      delivery,
      ci
    );
    this.querySelector<RepoProfileComponent>('repo-profile')!.profile = repo;
    this.querySelector('[data-content]')!.setAttribute('aria-busy', 'false');

    this.renderAgentQueue(tracker?.updatedAt);
    // The outlook simulates a few hundred runs: after the page has drawn.
    window.setTimeout(() => this.renderOutlook(tracker?.updatedAt), 80);
  }

  private renderFindings(list: ReturnType<typeof findings>) {
    const items = list.length
      ? list.map((f) => {
          const li = document.createElement('li');
          li.className = 'finding';
          li.dataset.tone = f.tone;
          const icon = document.createElement('span');
          icon.className = 'tone-icon';
          icon.setAttribute('aria-hidden', 'true');
          icon.textContent = ICONS[f.tone];
          const a = document.createElement('a');
          a.href = f.href;
          a.textContent = f.text;
          li.append(icon, a);
          return li;
        })
      : [
          Object.assign(document.createElement('li'), {
            className: 'finding',
            textContent:
              'Nothing urgent: no issues past their limits, CI is green, and the audit has no open items.',
          }),
        ];
    this.querySelector('[data-findings]')!.replaceChildren(...items);
  }

  /** The agents' file-based queue, when the Action is given one. */
  private async renderAgentQueue(asOf: string | undefined) {
    const panel = this.querySelector<HTMLElement>('[data-queue-trend]')!;
    if (!this.config?.queue) return;
    const queue = await loadAgentQueue(asOf);
    panel.hidden = !queue;
    if (!queue) return;
    this.querySelector('[data-queue-title]')!.textContent =
      this.config.queue.name;
    const chart = this.querySelector<TrendChartComponent>(
      '[data-trend="agents"]'
    )!;
    chart.labels = {
      open: 'Open issues',
      agentClosed: 'Resolved by AI agents',
      humanClosed: 'Resolved by people',
      totalClosed: 'Total resolved',
    };
    chart.points = queue.points;
  }

  /** The project outlook, simulated with GSSK, then the back-test. */
  private async renderOutlook(asOf: string | undefined) {
    const panel = this.querySelector<OutlookPanelComponent>('outlook-panel')!;
    try {
      const response = await fetch(DATA_CSV_PATH, { cache: 'no-cache' });
      const classes = response.ok
        ? parseClassHistory(await response.text())
        : null;
      if (!classes) {
        panel.unavailable(
          'The outlook appears after the next tracker run, which records each class of issue.'
        );
        return;
      }
      const points = classes.bug.points;
      const start = points[points.length - 1].date;
      const outlook = await buildOutlook(classes, loadSimulator, {
        limits: this.config?.limits,
        cost: this.config?.cost ?? null,
        asOf,
        seed: Number(start.replaceAll('-', '')),
      });
      panel.show(outlook, start, 'pending');
      const reliability = await backtest(totalHistory(classes), loadSimulator);
      panel.show(outlook, start, reliability);
    } catch (error) {
      console.warn('Outlook unavailable:', error);
      panel.unavailable('The outlook could not be run in this browser.');
    }
  }
}

if (!customElements.get(DashboardPageComponent.tagName)) {
  customElements.define(DashboardPageComponent.tagName, DashboardPageComponent);
}
