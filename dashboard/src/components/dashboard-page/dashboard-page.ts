import { BaseComponent } from '../../core/base-component.ts';
import { loadSnapshot, type Snapshot } from '../../services/metrics.ts';
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatPercent,
  formatRate,
  formatSigned,
  formatTimeUtc,
} from '../../lib/format.ts';
import { nextUpdate } from '../../services/metrics.ts';
import {
  DATA_CSV_PATH,
  PROJECT_URL,
  loadConfig,
  type DashboardConfig,
} from '../../lib/config.ts';
import { svg } from '../../lib/svg.ts';
import { closureSummary, loadAgentQueue } from '../../services/insights.ts';
import {
  agentMergedShare,
  formatDuration,
  parsePulls,
  parseResponses,
} from '../../services/health.ts';
import {
  CLASSES,
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
import { formatFrequency } from '../delivery-panel/delivery-panel.ts';
import type { TrendChartComponent } from '../trend-chart/trend-chart.ts';
import type { ClosureEvidenceComponent } from '../closure-evidence/closure-evidence.ts';
import type { PullPanelComponent } from '../pull-panel/pull-panel.ts';
import type { OutlookPanelComponent } from '../outlook-panel/outlook-panel.ts';
import type { ClassTableComponent } from '../class-table/class-table.ts';
import type { DeliveryPanelComponent } from '../delivery-panel/delivery-panel.ts';
import type { RepoProfileComponent } from '../repo-profile/repo-profile.ts';
import '../trend-chart/trend-chart.ts';
import '../closure-evidence/closure-evidence.ts';
import '../pull-panel/pull-panel.ts';
import '../outlook-panel/outlook-panel.ts';
import '../class-table/class-table.ts';
import '../delivery-panel/delivery-panel.ts';
import '../repo-profile/repo-profile.ts';
import template from './dashboard-page.html?raw';
import style from './dashboard-page.css?raw';

const ICONS: Record<Tone, string> = {
  good: '✓',
  warn: '!',
  bad: '✕',
  neutral: '·',
};

interface Kpi {
  label: string;
  value: string;
  verdict?: { tone: Tone; text: string };
  note: string;
  /** A small trend line, oldest first. */
  spark?: number[];
  href?: string;
}

/**
 * The dashboard: key figures and what needs attention, then the outlook,
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

    this.renderKpis(snapshot, {
      classes,
      delivery,
      audit,
      pulls,
      responses,
      closures,
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

  private renderKpis(
    snapshot: Snapshot,
    data: {
      classes: ReturnType<typeof parseClasses>;
      delivery: ReturnType<typeof parseDelivery>;
      audit: ReturnType<typeof parseAudit>;
      pulls: ReturnType<typeof parsePulls>;
      responses: ReturnType<typeof parseResponses>;
      closures: ReturnType<typeof closureSummary>;
    }
  ) {
    const { latest, velocity, history } = snapshot;
    const recent = history.slice(-90);
    const kpis: Kpi[] = [];

    const ratio = snapshot.doomLoop.ratio;
    kpis.push({
      label: 'Open issues',
      value: formatCount(latest.open),
      verdict:
        velocity.days > 0
          ? {
              tone:
                snapshot.openDelta > 0
                  ? 'warn'
                  : snapshot.openDelta < 0
                    ? 'good'
                    : 'neutral',
              text:
                snapshot.openDelta === 0
                  ? `No change in ${Math.round(velocity.days)} days`
                  : `${formatSigned(snapshot.openDelta)} in ${Math.round(velocity.days)} days`,
            }
          : undefined,
      note: `${formatCount(latest.totalClosed)} resolved of ${formatCount(latest.created)} ever opened`,
      spark: recent.map((p) => p.open),
      href: '#issues',
    });

    kpis.push({
      label: 'Opened per issue closed',
      value: ratio === null ? '—' : ratio === Infinity ? '∞' : ratio.toFixed(2),
      verdict:
        ratio === null
          ? { tone: 'neutral', text: 'No activity in the last week' }
          : ratio === Infinity
            ? { tone: 'bad', text: 'Issues arrive, none are closed' }
            : ratio <= 0.9
              ? { tone: 'good', text: 'Backlog shrinking' }
              : ratio <= 1.1
                ? { tone: 'good', text: 'Keeping pace' }
                : ratio <= 1.5
                  ? { tone: 'warn', text: 'Falling behind' }
                  : { tone: 'bad', text: 'Falling well behind' },
      note: `${formatRate(velocity.arrivals)} opened and ${formatRate(velocity.agent + velocity.human)} closed a day, last ${Math.round(velocity.days) || 7} days`,
      spark: snapshot.doomLoop.history
        .slice(-90)
        .map((h) =>
          h.ratio === null ? 1 : Math.min(h.ratio === Infinity ? 3 : h.ratio, 3)
        ),
      href: '#outlook',
    });

    const over = data.classes
      ? CLASSES.reduce((s, c) => s + data.classes![c].overLimit, 0)
      : null;
    const resolution = data.responses?.resolution;
    kpis.push({
      label: 'Time to resolve',
      value: formatDuration(resolution?.medianHours ?? null),
      verdict:
        over === null
          ? undefined
          : over > 0
            ? {
                tone: 'bad',
                text: `${formatCount(over)} open past ${over === 1 ? 'its' : 'their'} limit`,
              }
            : { tone: 'good', text: 'All open issues within limits' },
      note: resolution?.count
        ? `median of ${formatCount(resolution.count)} in ${data.responses!.windowDays} days · 90% within ${formatDuration(resolution.p90Hours)}`
        : 'no issues resolved recently',
      href: '#issues',
    });

    const first = data.responses?.firstResponse;
    const awaiting = data.responses?.awaitingResponse ?? 0;
    kpis.push({
      label: 'Time to first response',
      value: formatDuration(first?.medianHours ?? null),
      verdict: data.responses
        ? awaiting > 0
          ? {
              tone: 'warn',
              text: `${formatCount(awaiting)} open with no reply`,
            }
          : { tone: 'good', text: 'Every open issue has a reply' }
        : undefined,
      note: first?.count
        ? `median of ${formatCount(first.count)} issues answered in ${data.responses!.windowDays} days`
        : 'no replies recorded recently',
      href: '#issues',
    });

    const share = latest.totalClosed
      ? latest.agentClosed / latest.totalClosed
      : null;
    const merged = data.pulls ? agentMergedShare(data.pulls) : null;
    kpis.push({
      label: 'Resolved by AI agents',
      value: share === null ? '—' : formatPercent(share),
      note:
        `${formatCount(latest.agentClosed)} of ${formatCount(latest.totalClosed)} closed issues` +
        (merged === null
          ? ''
          : ` · ${formatPercent(merged)} of merged pull requests had an agent's hand`),
      spark: recent.map((p) =>
        p.totalClosed ? p.agentClosed / p.totalClosed : 0
      ),
      href: '#agents',
    });

    const verified = data.closures?.referencedShare ?? null;
    kpis.push({
      label: 'Closures with a linked fix',
      value: verified === null ? '—' : formatPercent(verified),
      verdict:
        verified === null
          ? undefined
          : verified >= 0.8
            ? { tone: 'good', text: 'Closures can be verified' }
            : verified >= 0.5
              ? { tone: 'warn', text: 'Many closures unverified' }
              : { tone: 'bad', text: 'Most closures unverified' },
      note: data.closures
        ? `${formatCount(data.closures.byEvidence.fix_referenced)} of ${formatCount(data.closures.total)} closures reference a commit, pull request or release`
        : 'available after the next tracker run',
      href: '#issues',
    });

    const d = data.delivery;
    const bandTone: Record<string, Tone> = {
      elite: 'good',
      high: 'good',
      medium: 'warn',
      low: 'bad',
    };
    if (d) {
      kpis.push({
        label: 'Deployment frequency',
        value: formatFrequency(d.frequency.value ?? 0),
        verdict: d.frequency.band
          ? {
              tone: bandTone[d.frequency.band],
              text: `DORA ${d.frequency.band}`,
            }
          : undefined,
        note: `${formatCount(d.frequency.count)} ${d.frequency.basis} in ${d.windowDays} days · lead time ${formatDuration(d.leadTimeHours.value)}`,
        href: '#delivery',
      });
    }

    const a = data.audit;
    if (a) {
      kpis.push({
        label: 'Best-practice audit',
        value: a.score === null ? '—' : `${a.score}/100`,
        verdict:
          a.score === null
            ? undefined
            : {
                tone: a.score >= 80 ? 'good' : a.score >= 50 ? 'warn' : 'bad',
                text: `${a.passed} of ${a.judged} checks pass`,
              },
        note:
          a.waiting > 0
            ? `${a.waiting} more checks judged once there is history`
            : 'every check judged',
        href: '/audit',
      });
    }

    this.querySelector('[data-kpis]')!.replaceChildren(
      ...kpis.map((k) => this.kpi(k))
    );
  }

  private kpi(k: Kpi): HTMLElement {
    const box = document.createElement(k.href ? 'a' : 'div');
    box.className = 'card kpi';
    if (k.href) (box as HTMLAnchorElement).href = k.href;
    box.dataset.kpi = k.label;
    const p = (cls: string, text: string) => {
      const el = document.createElement('p');
      el.className = cls;
      el.textContent = text;
      return el;
    };
    box.append(p('kpi-label', k.label), p('kpi-value tabular', k.value));
    if (k.verdict) {
      const verdict = p('kpi-verdict', '');
      verdict.dataset.tone = k.verdict.tone;
      const icon = document.createElement('span');
      icon.className = 'tone-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = ICONS[k.verdict.tone];
      verdict.append(icon, k.verdict.text);
      box.append(verdict);
    }
    box.append(p('kpi-note', k.note));
    if (k.spark && k.spark.length > 2) box.append(sparkline(k.spark));
    return box;
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

/** A small line over the values, scaled to their own range. */
function sparkline(values: number[]): HTMLElement {
  const holder = document.createElement('div');
  holder.className = 'kpi-spark';
  const root = svg('svg', {
    viewBox: '0 0 100 28',
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
  });
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * 100;
  const y = (v: number) => 25 - ((v - min) / span) * 22;
  svg(
    'path',
    {
      d: values.map((v, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(v)}`).join(' '),
      fill: 'none',
      stroke: 'var(--series-1)',
      'stroke-width': 2,
      'vector-effect': 'non-scaling-stroke',
      'stroke-linejoin': 'round',
    },
    root
  );
  holder.append(root);
  return holder;
}

if (!customElements.get(DashboardPageComponent.tagName)) {
  customElements.define(DashboardPageComponent.tagName, DashboardPageComponent);
}
