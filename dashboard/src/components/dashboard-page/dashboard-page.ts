import { BaseComponent } from '../../core/base-component.ts';
import {
  loadSnapshot,
  nextUpdate,
  threatLevel,
  type DoomLoop,
  type Snapshot,
  type Velocity,
  type ThreatLevel,
} from '../../services/metrics.ts';
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatTimeUtc,
  formatPercent,
} from '../../lib/format.ts';
import {
  DATA_CSV_PATH,
  PROJECT_URL,
  loadConfig,
  type DashboardConfig,
} from '../../lib/config.ts';
import type { DoomsdayClockComponent } from '../doomsday-clock/doomsday-clock.ts';
import type { VelocityGaugeComponent } from '../velocity-gauge/velocity-gauge.ts';
import type { TrendChartComponent } from '../trend-chart/trend-chart.ts';
import type { DoomLoopComponent } from '../doom-loop/doom-loop.ts';
import '../doomsday-clock/doomsday-clock.ts';
import '../velocity-gauge/velocity-gauge.ts';
import '../trend-chart/trend-chart.ts';
import '../doom-loop/doom-loop.ts';
import '../queue-compare/queue-compare.ts';
import '../closure-evidence/closure-evidence.ts';
import type { QueueCompareComponent } from '../queue-compare/queue-compare.ts';
import type { ClosureEvidenceComponent } from '../closure-evidence/closure-evidence.ts';
import {
  closureSummary,
  loadAgentQueue,
  strictRatios,
  type AgentQueue,
  type StrictRatios,
} from '../../services/insights.ts';
import {
  DEFAULT_PUBLIC_WEIGHT,
  attentionIndex,
  backlogShare,
  combinedAgentShare,
  combinedDoomLoop,
  combinedHoursToMidnight,
  combinedVelocity,
  effortShare,
  queueAgentShare,
  weightMarks,
  type Queue,
  type WeightMark,
} from '../../services/combined.ts';
import '../weight-slider/weight-slider.ts';
import '../practice-list/practice-list.ts';
import '../outlook-panel/outlook-panel.ts';
import type { OutlookPanelComponent } from '../outlook-panel/outlook-panel.ts';
import {
  backtest,
  buildOutlook,
  parseClassHistory,
  totalHistory,
} from '../../services/outlook.ts';
import type { PracticeListComponent } from '../practice-list/practice-list.ts';
import {
  formatDuration,
  parsePractices,
  parseResponses,
} from '../../services/health.ts';
import '../replay-control/replay-control.ts';
import type { ReplayControlComponent } from '../replay-control/replay-control.ts';
import {
  buildFrames,
  forecastFrames,
  frameAt,
  peakRate,
  type Frame,
  type FrameForecast,
} from '../../services/replay.ts';
import {
  calibrateQueue,
  horizon,
  runEnsemble,
  summarise,
  type Ensemble,
  type QueueCalibration,
  MIN_VOLATILITY,
  type QueueState,
  type WeightRule,
} from '../../services/forecast.ts';
import { loadSimulator } from '../../lib/gssk-simulator.ts';

/** Simulated runs, and days simulated before the horizon cuts them short. */
const FORECAST_RUNS = 200;
const FORECAST_DAYS = 180;
/** The forecast's second queue when the repository has only its issues. */
const EMPTY_QUEUE: QueueCalibration = {
  start: { open: 0, byAgents: 0, byHumans: 0 },
  arrivals: { count: 0, days: 0 },
  agents: { count: 0, days: 0 },
  humans: { count: 0, days: 0 },
  volatility: MIN_VOLATILITY,
};
import { WeightSliderComponent } from '../weight-slider/weight-slider.ts';
import template from './dashboard-page.html?raw';
import style from './dashboard-page.css?raw';

const NO_LOOP: DoomLoop = {
  ratio: null,
  level: 'unknown',
  history: [],
  doublingDays: null,
  clearDays: null,
};

const NO_VELOCITY: Velocity = {
  agent: 0,
  human: 0,
  arrivals: 0,
  netBacklog: 0,
  days: 0,
  since: '',
};

const STATUS: Record<ThreatLevel, { icon: string; label: string }> = {
  safe: { icon: '✓', label: 'Humans hold the line' },
  elevated: { icon: '!', label: 'Elevated: agents gaining ground' },
  severe: { icon: '!', label: 'Severe: agents resolving most issues' },
  critical: { icon: '✕', label: 'Critical: midnight is near' },
};

/**
 * The dashboard: the Developer Doomsday Clock, the velocity dials and the
 * doom loops, each combined and per queue, with the indices and trends.
 */
export class DashboardPageComponent extends BaseComponent {
  static tagName = 'dashboard-page';

  private config: DashboardConfig | null = null;

  /** The file-based queue's name, when there is one. */
  private get queueName(): string {
    return this.config?.queue?.name ?? "Agents' own queue";
  }

  /** The issues' name: "Public GitHub issues" beside a queue, else "Issues". */
  private get issuesName(): string {
    return this.config?.queue ? 'Public GitHub issues' : 'Issues';
  }

  constructor() {
    super(template, style);
  }

  async init() {
    const config = await loadConfig();
    this.config = config;
    const tracked = this.querySelector<HTMLAnchorElement>(
      '[data-tracked-link]'
    )!;
    tracked.href = config.issuesUrl || config.repositoryUrl;
    tracked.textContent = config.repository;
    this.querySelector('[data-tracked-name]')!.textContent = config.repository;
    this.querySelector('[data-repo-name]')!.textContent = config.repository;
    this.querySelector('[data-issues-name]')!.textContent = config.queue
      ? 'Public GitHub issues'
      : 'Issues';
    this.querySelector('h1')!.textContent = config.title;
    if (config.why) {
      const why = this.querySelector<HTMLElement>('[data-why]')!;
      why.hidden = false;
      const link = document.createElement('a');
      link.href = '/methodology';
      link.className = 'hero-link';
      link.textContent = 'Why this repository?';
      why.replaceChildren(link);
    }
    this.querySelector<HTMLAnchorElement>('[data-csv-link]')!.href =
      DATA_CSV_PATH;
    this.querySelector<HTMLAnchorElement>('[data-project-link]')!.href =
      PROJECT_URL;
    // With one queue there is nothing to combine: show its panels alone.
    this.dataset.queues = config.queue ? 'two' : 'one';
    if (!config.queue) {
      this.querySelector<HTMLElement>('[data-dial="public"]')!.dataset.size =
        'large';
    }

    const asOf = this.querySelector<HTMLElement>('[data-as-of]')!;
    try {
      this.render(await loadSnapshot());
    } catch (error) {
      asOf.classList.add('error');
      asOf.textContent = `Could not load the data: ${(error as Error).message}`;
    }
  }

  private render(snapshot: Snapshot) {
    const { latest, velocity } = snapshot;
    const asOf = snapshot.status?.updatedAt;

    const tracker = snapshot.status;
    const next = tracker && nextUpdate(tracker);
    this.querySelector('[data-as-of]')!.textContent = tracker
      ? `Data as of ${formatDateTime(tracker.updatedAt)} · updated ${tracker.schedule.description}` +
        (next ? ` · next around ${formatTimeUtc(next)}` : '')
      : `Data as of ${formatDate(latest.date)} (UTC)`;
    this.querySelector('[data-schedule]')!.textContent = tracker
      ? `Updated ${tracker.schedule.description}`
      : 'Updated';

    const publicQueue: Queue = {
      latest,
      velocity,
      loop: snapshot.doomLoop,
    };

    const closures = closureSummary(latest);
    const evidence =
      this.querySelector<ClosureEvidenceComponent>('closure-evidence')!;
    evidence.closures = closures;
    evidence.issues = tracker?.issues;
    evidence.update();

    this.querySelector<TrendChartComponent>('[data-trend="public"]')!.points =
      snapshot.history;
    this.querySelector('[data-content]')!.setAttribute('aria-busy', 'false');

    this.stat(
      'verified',
      closures ? formatPercent(closures.referencedShare) : '—'
    );
    this.stat(
      'verified-note',
      closures
        ? `${formatCount(closures.byEvidence.fix_referenced)} of ${formatCount(closures.total)} closures reference a fix`
        : 'available after the next tracker run'
    );
    const issues = tracker?.issues;
    const reopened = issues?.reopened;
    const everClosed = issues?.everClosed ?? 0;
    this.stat(
      'reopen',
      reopened !== undefined && everClosed > 0
        ? formatPercent(reopened / everClosed)
        : '—'
    );
    this.stat(
      'reopen-note',
      reopened !== undefined
        ? `${formatCount(reopened)} of ${formatCount(everClosed)} closed issues were reopened`
        : 'available after the next tracker run'
    );

    this.renderHealth(tracker?.raw);
    // The outlook runs after the page has drawn.
    window.setTimeout(() => this.renderOutlook(asOf), 80);

    // Everything that needs both queues waits for the agents' own queue.
    (this.config?.queue ? loadAgentQueue(asOf) : Promise.resolve(null)).then(
      (queue) => {
        // Replay: the same panels, driven by the state as of a past moment.
        const history = buildFrames(
          snapshot.history,
          queue?.points ?? [],
          7,
          asOf
        );
        const agents: Queue | null = queue && {
          latest: queue.points[queue.points.length - 1],
          velocity: queue.velocity,
          loop: queue.loop,
        };
        this.frames = history;
        this.publicStart = snapshot.history[0].date;
        this.live = {
          publicQueue,
          agents,
          strict: strictRatios(snapshot.history, 7, asOf),
        };
        this.renderAgentTrend(queue);
        this.renderQueues(publicQueue, agents);

        const slider =
          this.querySelector<WeightSliderComponent>('weight-slider')!;
        const defaultWeight =
          tracker?.defaultPublicWeight ?? DEFAULT_PUBLIC_WEIGHT;
        slider.hidden = !agents;
        if (agents) {
          const marks = weightMarks(publicQueue, agents, defaultWeight);
          slider.marks = marks;
          // A saved preset is re-applied at today's value; a custom weight as saved.
          const savedMark = WeightSliderComponent.savedMark();
          const preset = marks.find((mark) => mark.id === savedMark);
          slider.mark = preset?.id ?? null;
          slider.weight =
            preset?.weight ?? WeightSliderComponent.saved() ?? defaultWeight;
          this.weight = slider.weight;
          this.mark = slider.mark;
          slider.addEventListener('weight-change', (event) => {
            this.weight = (event as CustomEvent<number>).detail;
            this.mark = slider.mark;
            this.peaks = this.scalePeaks(history);
            this.showDials();
            // The forecast's clock depends on the weighting: work it out again,
            // once the slider settles.
            window.clearTimeout(this.reforecast);
            this.reforecast = window.setTimeout(
              () => this.refreshForecast(),
              200
            );
          });
        }

        const replay =
          this.querySelector<ReplayControlComponent>('replay-control')!;
        replay.setDays(history.map((frame) => frame.date));
        replay.addEventListener('replay-position', (event) => {
          const position = (event as CustomEvent<number | null>).detail;
          this.replaying =
            position === null ? null : frameAt(this.frames, position);
          this.showDials();
        });

        // One scale per dial, from the busiest day of the whole record, for the
        // live view, the replay and the forecast alike.
        this.peaks = this.scalePeaks(history);
        this.showDials();

        // The forecast runs after the page has drawn: it loads the GSSK kernel
        // and simulates both queues a few hundred times.
        {
          this.history = history;
          window.setTimeout(
            () =>
              this.startForecast(snapshot, queue).catch((error) => {
                console.warn('Forecast unavailable:', error);
                this.querySelector('[data-forecast-note]')!.textContent =
                  'The forecast could not be run in this browser.';
              }),
            50
          );
        }
      }
    );
  }

  /** Every frame the replay can show: the record, then the forecast. */
  private frames: Frame[] = [];
  /** The record's frames alone. */
  private history: Frame[] = [];
  private ensemble: Ensemble | null = null;
  private reforecast = 0;

  /** Calibrates and simulates both queues with GSSK. */
  private async startForecast(snapshot: Snapshot, queue: AgentQueue | null) {
    // Without a second queue, the model's other queue is empty and still.
    const agents = queue
      ? calibrateQueue(queue.points, queue.velocity)
      : EMPTY_QUEUE;
    // A record too short to measure its own drift borrows the other queue's,
    // or the default.
    const publicIssues = calibrateQueue(
      snapshot.history,
      snapshot.velocity,
      queue ? agents.volatility : undefined
    );
    const simulator = await loadSimulator({
      public: publicIssues.start,
      agents: agents.start,
    });
    try {
      // The same seed for the same data, so a reload shows the same forecast.
      const seed = Number(snapshot.latest.date.replaceAll('-', ''));
      this.ensemble = runEnsemble(
        simulator,
        { public: publicIssues, agents },
        { runs: FORECAST_RUNS, days: FORECAST_DAYS, seed }
      );
    } finally {
      simulator.dispose();
    }
    this.refreshForecast();
  }

  /** Summarises the forecast at the current weighting and adds its frames. */
  private refreshForecast() {
    if (!this.ensemble || !this.live) return;
    const single = !this.live.agents;
    const rule: WeightRule = (state) => {
      // One queue: the issues are everything.
      if (single) return 1;
      if (this.mark === 'backlog') {
        const total = state.public.open + state.agents.open;
        return total > 0 ? state.public.open / total : 0;
      }
      if (this.mark === 'effort') {
        const resolved = (s: QueueState) => s.agents + s.humans;
        const total = resolved(state.public) + resolved(state.agents);
        return total > 0 ? resolved(state.public) / total : 0;
      }
      return this.weight;
    };
    const days = summarise(this.ensemble, rule);
    const end = horizon(days);
    const last = this.history[this.history.length - 1];
    const forecast = forecastFrames(days, end.day, last.date, {
      public: this.live.publicQueue.loop.history,
      agents: this.live.agents?.loop.history ?? [],
    });
    this.frames = [...this.history, ...forecast];
    const replay =
      this.querySelector<ReplayControlComponent>('replay-control')!;
    replay.setDays(
      this.frames.map((frame) => frame.date),
      this.history.length - 1
    );
    const until = forecast[forecast.length - 1]?.date;
    this.querySelector('[data-forecast-note]')!.textContent = until
      ? `The forecast runs ${end.day} days, to ${formatDate(until)}: ` +
        (end.reason === 'limit'
          ? `it stays informative at least that far.`
          : `after that it is no better than a guess.`)
      : '';
  }

  /** The live state of both queues. */
  private live: {
    publicQueue: Queue;
    agents: Queue | null;
    strict: StrictRatios;
  } | null = null;
  /** The past state being replayed, or `null` for the live view. */
  private replaying: Frame | null = null;
  /** The public issues' weight in the combined figures, as chosen. */
  private weight = DEFAULT_PUBLIC_WEIGHT;
  /** The slider preset chosen, if any. */
  private mark: WeightMark['id'] | null = null;
  /** Each dial's fixed scale, from the busiest day of the record. */
  private peaks: Record<string, number> | null = null;

  /**
   * The weight to use for a state. A data-derived preset is a rule, so it is
   * worked out from that state's own figures; otherwise the chosen weight.
   */
  private weightFor(publicQueue: Queue, agents: Queue | null): number {
    if (!agents) return 1;
    if (this.mark === 'backlog') return backlogShare(publicQueue, agents);
    if (this.mark === 'effort') return effortShare(publicQueue, agents);
    return this.weight;
  }

  /** Each dial's largest rate over the whole record, at the current weighting. */
  private scalePeaks(frames: Frame[]): Record<string, number> {
    return {
      public: peakRate(frames, (f) => f.publicQueue?.velocity ?? null),
      agents: peakRate(frames, (f) => f.agents?.velocity ?? null),
      combined: peakRate(frames, (f) =>
        f.publicQueue
          ? combinedVelocity(
              f.publicQueue,
              f.agents,
              this.weightFor(f.publicQueue, f.agents)
            )
          : (f.agents?.velocity ?? null)
      ),
    };
  }

  /**
   * Draws the clock, the three dials and the three doom loops for the live
   * state, or for the moment being replayed.
   */
  private showDials() {
    if (!this.live) return;
    const live = this.replaying === null;
    const publicQueue = live
      ? this.live.publicQueue
      : this.replaying!.publicQueue;
    const agents = live ? this.live.agents : this.replaying!.agents;

    const forecast = live ? undefined : this.replaying!.forecast;
    for (const name of ['public', 'agents', 'combined'] as const) {
      const dial = this.dial(name);
      dial.scalePeak = this.peaks?.[name] ?? null;
      dial.range = forecast ? forecast.resolved[name] : null;
      dial.fade = forecast?.fade ?? 0;
    }

    const publicDial = this.dial('public');
    publicDial.heading = this.issuesName;
    publicDial.open = publicQueue ? publicQueue.latest.open : null;
    publicDial.velocity = publicQueue?.velocity ?? NO_VELOCITY;
    const publicLoop = this.loop('public');
    publicLoop.queue = this.issuesName;
    publicLoop.open = Math.round(publicQueue?.latest.open ?? 0);
    publicLoop.windowDays = publicQueue?.velocity.days ?? 0;
    // The stricter ratios are only worked out for the live data.
    publicLoop.strict = live ? this.live.strict : {};
    publicLoop.loop = publicQueue?.loop ?? NO_LOOP;

    const agentDial = this.dial('agents');
    agentDial.heading = this.queueName;
    agentDial.hidden = !this.live.agents;
    agentDial.open = agents ? agents.latest.open : null;
    agentDial.velocity = agents?.velocity ?? NO_VELOCITY;
    const agentLoop = this.loop('agents');
    agentLoop.queue = this.queueName;
    agentLoop.caption = 'issues filed per issue resolved';
    agentLoop.open = Math.round(agents?.latest.open ?? 0);
    agentLoop.windowDays = agents?.velocity.days ?? 0;
    agentLoop.loop = agents?.loop ?? NO_LOOP;

    // Before the public issues existed, the combined view is the agents'.
    if (publicQueue) {
      this.renderCombined(
        publicQueue,
        agents,
        this.weightFor(publicQueue, agents),
        'public issues only',
        forecast
      );
    } else if (agents) {
      // The dials and doom loop can show the agents' queue alone, but the
      // clock compares the two queues: it has no reading until both exist.
      this.renderCombined(agents, null, 1, "agents' queue only");
      const started = formatDate(this.publicStart);
      this.querySelector<DoomsdayClockComponent>('doomsday-clock')!.show({
        hours: null,
        note: `No reading yet: the public issue tracker starts on ${started}.`,
      });
      this.querySelector<HTMLElement>('[data-status]')!.hidden = true;
      this.querySelector('[data-clock-note]')!.textContent =
        'The clock compares both queues, so it starts when the public issues do.';
    }
  }

  /** The first day of the public issue record. */
  private publicStart = '';

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

  /** Response times and the habits checklist. */
  private renderHealth(raw: unknown) {
    const responses = parseResponses(raw);
    const tile = (
      name: string,
      d:
        | { count: number; medianHours: number | null; p90Hours: number | null }
        | undefined,
      what: string
    ) => {
      this.stat(name, formatDuration(d?.medianHours ?? null));
      this.stat(
        `${name}-note`,
        !responses
          ? 'available after the next tracker run'
          : d && d.count > 0
            ? `median of ${formatCount(d.count)} ${what} in ${responses.windowDays} days · 90% within ${formatDuration(d.p90Hours)}`
            : `no ${what} in the last ${responses.windowDays} days`
      );
    };
    tile('first-response', responses?.firstResponse, 'issues answered');
    tile('resolution', responses?.resolution, 'issues resolved');
    if (responses && responses.awaitingResponse > 0) {
      this.stat(
        'first-response-note',
        `${this.querySelector('[data-stat="first-response-note"]')!.textContent} · ${formatCount(responses.awaitingResponse)} open with no response`
      );
    }
    this.querySelector<PracticeListComponent>('practice-list')!.practices =
      parsePractices(raw);
  }

  /** The agents' own queue over time. */
  private renderAgentTrend(queue: AgentQueue | null) {
    const trend = this.querySelector<HTMLElement>('[data-queue-trend]')!;
    trend.hidden = !queue;
    if (queue) {
      const chart = this.querySelector<TrendChartComponent>(
        '[data-trend="agents"]'
      )!;
      chart.labels = {
        open: 'Open issues',
        agentClosed: 'Resolved by AI agents',
        humanClosed: 'Resolved by humans',
        totalClosed: 'Total resolved',
      };
      chart.points = queue.points;
    }
  }

  /** The side-by-side comparison and the figures that span both queues. */
  private renderQueues(publicQueue: Queue, agents: Queue | null) {
    const figures = (queue: Queue) => ({
      open: queue.latest.open,
      resolved: queue.latest.totalClosed,
      resolvedByAgents: queue.latest.agentClosed,
      resolvedByHumans: queue.latest.humanClosed,
      arrivals: queue.velocity.arrivals,
      agentResolved: queue.velocity.agent,
      humanResolved: queue.velocity.human,
      days: queue.velocity.days,
    });
    this.querySelector<QueueCompareComponent>('queue-compare')!.comparison = {
      agents: agents && figures(agents),
      publicIssues: figures(publicQueue),
    };

    this.stat(
      'open',
      formatCount(publicQueue.latest.open + (agents?.latest.open ?? 0))
    );
    this.stat(
      'open-note',
      agents
        ? `${formatCount(publicQueue.latest.open)} public issues · ${formatCount(agents.latest.open)} in the agents' queue`
        : 'GitHub issues'
    );

    const attention = agents ? attentionIndex(publicQueue, agents) : null;
    this.stat('attention', attention === null ? '—' : attention.toFixed(2));
    this.stat(
      'attention-note',
      agents
        ? `public issues get ${formatPercent(effortShare(publicQueue, agents))} of resolutions and hold ${formatPercent(backlogShare(publicQueue, agents))} of the backlog`
        : "needs the agents' own queue"
    );
  }

  /** The clock, large dial and top doom loop, at a weighting. */
  private renderCombined(
    publicQueue: Queue,
    agents: Queue | null,
    publicWeight: number,
    only = 'public issues only',
    forecast?: FrameForecast
  ) {
    const clock = this.querySelector<DoomsdayClockComponent>('doomsday-clock')!;
    const hours = forecast
      ? forecast.clock.mid
      : combinedHoursToMidnight(publicQueue, agents, publicWeight);
    clock.show({
      hours,
      range: forecast
        ? { low: forecast.clock.low, high: forecast.clock.high }
        : null,
      fade: forecast?.fade ?? 0,
    });
    const level = threatLevel(hours);
    const status = this.querySelector<HTMLElement>('[data-status]')!;
    status.dataset.level = level;
    this.querySelector('[data-status-icon]')!.textContent = STATUS[level].icon;
    this.querySelector('[data-status-label]')!.textContent =
      STATUS[level].label;
    status.hidden = false;

    const weights = agents
      ? `public issues ${Math.round(publicWeight * 100)}%, agents' queue ${Math.round((1 - publicWeight) * 100)}%`
      : only;
    this.querySelector('[data-clock-note]')!.textContent =
      `Weighted: ${weights}.`;

    const share = combinedAgentShare(publicQueue, agents, publicWeight);
    const percent = (queue: Queue | null) => {
      const value = queue && queueAgentShare(queue);
      return value === null ? 'n/a' : formatPercent(value);
    };
    this.stat('share', formatPercent(share));
    if (!this.config?.queue) {
      this.stat(
        'share-note',
        `of ${formatCount(publicQueue.latest.totalClosed)} closed issues`
      );
    } else
      this.stat(
        'share-note',
        `combined · public issues ${percent(publicQueue)} · agents' queue ${percent(agents)}`
      );

    const dial = this.dial('combined');
    dial.heading = agents ? 'Both queues, weighted' : `Combined: ${only}`;
    dial.open = Math.round(
      publicQueue.latest.open + (agents?.latest.open ?? 0)
    );
    dial.velocity = combinedVelocity(publicQueue, agents, publicWeight);

    const loop = this.loop('combined');
    loop.queue = agents ? 'Both queues, weighted' : `Combined: ${only}`;
    loop.caption = 'issues opened per issue resolved, weighted across queues';
    loop.note = agents
      ? `Weighted geometric mean of the two queues' ratios: ${weights}.`
      : '';
    loop.open = Math.round(publicQueue.latest.open);
    loop.windowDays = publicQueue.velocity.days;
    loop.loop = combinedDoomLoop(publicQueue, agents, publicWeight);
  }

  private dial(name: string) {
    return this.querySelector<VelocityGaugeComponent>(`[data-dial="${name}"]`)!;
  }

  private loop(name: string) {
    return this.querySelector<DoomLoopComponent>(
      `[data-queue-loop="${name}"]`
    )!;
  }

  private stat(name: string, text: string, tone = '') {
    const element = this.querySelector<HTMLElement>(`[data-stat="${name}"]`)!;
    element.textContent = text;
    element.classList.remove('good', 'bad');
    if (tone) element.classList.add(tone);
  }
}

if (!customElements.get(DashboardPageComponent.tagName)) {
  customElements.define(DashboardPageComponent.tagName, DashboardPageComponent);
}
