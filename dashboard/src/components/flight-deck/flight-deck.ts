import { BaseComponent } from '../../core/base-component.ts';
import { dial, velocityDial, type DialBand } from '../../lib/dial.ts';
import { svg } from '../../lib/svg.ts';
import {
  formatCount,
  formatPercent,
  formatRate,
  formatSigned,
} from '../../lib/format.ts';
import type { Snapshot } from '../../services/metrics.ts';
import {
  agentMergedShare,
  formatDuration,
  type Pulls,
} from '../../services/health.ts';
import type { closureSummary } from '../../services/insights.ts';
import type { parseResponses } from '../../services/health.ts';
import {
  CLASSES,
  ZONES,
  readiness,
  type Audit,
  type CiHealth,
  type ClassFacts,
  type Delivery,
  type IssueClass,
  type Tone,
} from '../../services/report.ts';
import {
  RATIO_TICKS,
  annunciators,
  niceCeiling,
  ratioScale,
  type Annunciator,
} from '../../services/instruments.ts';
import template from './flight-deck.html?raw';
import style from './flight-deck.css?raw';

export interface DeckData {
  snapshot: Snapshot;
  classes: Record<IssueClass, ClassFacts> | null;
  ci: CiHealth | null;
  delivery: Delivery | null;
  audit: Audit | null;
  pulls: Pulls | null;
  responses: ReturnType<typeof parseResponses>;
  closures: ReturnType<typeof closureSummary>;
}

const ICONS: Record<Tone, string> = {
  good: '✓',
  warn: '!',
  bad: '✕',
  neutral: '·',
};

/** Zones for a share where more is better: red, amber, green. */
const shareBands = (amber: number, green: number): DialBand[] => [
  { from: 0, to: amber, colour: 'var(--critical)' },
  { from: amber, to: green, colour: 'var(--warning)' },
  { from: green, to: 100, colour: 'var(--good)' },
];

interface DialCard {
  kpi: string;
  title: string;
  sub: string;
  href: string;
  /** 0–100 on the dial; `null` without data. */
  value: number | null;
  display: string;
  bands: DialBand[];
  target?: number | null;
  verdict: { tone: Tone; text: string } | null;
  note: string;
}

const RATIO_LABELS = ['⅛×', '¼×', '½×', '1×', '2×', '4×', '8×+'];

/**
 * The overview as an instrument panel: an annunciator panel, the flow of
 * issues in and out, the backlog ratio, dials for bounded figures, and the
 * split of work between agents and people. Each kind of figure has the
 * instrument that reads best for it (see services/instruments.ts).
 */
export class FlightDeckComponent extends BaseComponent {
  static tagName = 'flight-deck';

  private data: DeckData | null = null;

  constructor() {
    super(template, style);
  }

  show(data: DeckData) {
    this.data = data;
    if (this.isConnected) this.draw();
  }

  init() {
    this.draw();
  }

  private draw() {
    const data = this.data;
    if (!data) return;
    this.drawAnnunciators(data);
    this.drawVelocity(data);
    this.drawRatio(data);
    this.drawDials(data);
    this.drawCrew(data);
  }

  private drawAnnunciators(data: DeckData) {
    const d = data.delivery;
    const tiles = annunciators({
      classes: data.classes,
      ci: data.ci && data.ci.runs > 0 ? data.ci : null,
      flowRatio: data.snapshot.doomLoop.ratio,
      awaitingReply: data.responses?.awaitingResponse ?? null,
      linkedFixShare: data.closures?.referencedShare ?? null,
      readinessZone: readiness(data.audit)?.zone.id ?? null,
      doraBands: d
        ? [
            d.frequency.band,
            d.leadTimeHours.band,
            d.failureRate.band,
            d.restoreHours.band,
          ]
        : [],
    });
    this.querySelector('[data-tiles]')!.replaceChildren(
      ...tiles.map((t) => this.tile(t))
    );
    const lit = tiles.filter((t) => t.state !== 'off');
    const master = this.querySelector<HTMLAnchorElement>('[data-master]')!;
    master.dataset.state = lit.some((t) => t.state === 'warning')
      ? 'warning'
      : lit.length
        ? 'caution'
        : 'off';
    master.textContent = lit.length
      ? `Master caution · ${lit.length}`
      : 'All clear';
    master.href = lit[0]?.href ?? '#overview';
  }

  private tile(t: Annunciator): HTMLElement {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'tile';
    a.href = t.href;
    a.dataset.annunciator = t.id;
    a.dataset.state = t.state;
    const label = document.createElement('strong');
    label.textContent = t.label;
    if (t.state !== 'off') {
      const icon = document.createElement('span');
      icon.className = 'tile-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = t.state === 'warning' ? '✕' : '!';
      label.prepend(icon);
    }
    const detail = document.createElement('span');
    detail.textContent = t.detail;
    const state = document.createElement('span');
    state.className = 'sr-only';
    state.textContent = t.state === 'off' ? ' (normal)' : ` (${t.state}, lit)`;
    a.append(label, detail, state);
    li.append(a);
    return li;
  }

  private drawVelocity(data: DeckData) {
    const { velocity: v, latest, openDelta } = data.snapshot;
    const resolved = v.agent + v.human;
    const wrap = this.querySelector('[data-velocity-dial]')!;
    wrap.querySelector('svg')?.remove();
    const { max, step } = niceCeiling(Math.max(resolved, v.arrivals));
    wrap.prepend(
      velocityDial({
        agents: v.agent,
        humans: v.human,
        arrivals: v.arrivals,
        max,
        step,
        label:
          `${formatRate(resolved)} issues resolved a day: ${formatRate(v.agent)} by agents, ` +
          `${formatRate(v.human)} by people, against ${formatRate(v.arrivals)} new issues a day.`,
      })
    );
    this.querySelector('[data-velocity]')!.textContent = formatRate(resolved);
    const verdict = this.querySelector<HTMLElement>('[data-velocity-verdict]')!;
    const gap = resolved - v.arrivals;
    if (v.days === 0) {
      verdict.dataset.tone = 'neutral';
      verdict.textContent = 'No activity recorded yet';
    } else {
      verdict.dataset.tone = gap >= 0 ? 'good' : 'bad';
      verdict.textContent =
        gap >= 0
          ? `▲ ${formatRate(gap)} a day ahead of new issues`
          : `▼ ${formatRate(-gap)} a day behind new issues`;
    }
    this.querySelector('[data-velocity-legend]')!.replaceChildren(
      legend('agent', `${formatRate(v.agent)} agents`),
      legend('human', `${formatRate(v.human)} people`),
      legend('arrivals', `${formatRate(v.arrivals)} new a day`)
    );
    this.querySelector('[data-open]')!.textContent = formatCount(latest.open);
    this.querySelector('[data-open-delta]')!.textContent =
      v.days > 0
        ? `${formatSigned(openDelta)} in ${Math.round(v.days)} days`
        : '';
  }

  private drawRatio(data: DeckData) {
    const { doomLoop, velocity, latest } = data.snapshot;
    const ratio = doomLoop.ratio;
    const set = (selector: string, text: string) => {
      this.querySelector(selector)!.textContent = text;
    };
    const shown =
      ratio === null
        ? '—'
        : ratio === Infinity
          ? '∞'
          : ratio >= 10
            ? String(Math.round(ratio))
            : ratio.toFixed(1);
    set('[data-ratio]', shown);
    if (velocity.days > 0) {
      set(
        '[data-ratio-window]',
        `Issues opened for each one closed, last ${Math.round(velocity.days)} days.`
      );
    }
    const chip = this.querySelector<HTMLElement>('[data-ratio-chip]')!;
    const chips: Record<string, [Tone, string]> = {
      burning: ['good', 'Burning down the backlog'],
      steady: ['good', 'Keeping pace'],
      behind: ['warn', 'Falling behind'],
      doom: ['bad', 'Bug doom loop'],
      unknown: ['neutral', 'No activity in the last week'],
    };
    const [tone, text] = chips[doomLoop.level];
    chip.dataset.tone = tone;
    chip.replaceChildren(icon(tone), text);

    // Zones on the log scale, from ⅛× to 8×.
    const at = (r: number) => ratioScale(r).position * 100;
    const edges = [0, at(0.9), at(1.1), at(2), 100];
    this.querySelectorAll<HTMLElement>('.ratio-zones span').forEach(
      (span, i) => (span.style.flex = `${edges[i + 1] - edges[i]} 0 0`)
    );
    this.querySelector('[data-ratio-ticks]')!.replaceChildren(
      ...RATIO_TICKS.map((r, i) => {
        const li = document.createElement('li');
        li.style.left = `${at(r)}%`;
        li.textContent = RATIO_LABELS[i];
        return li;
      })
    );
    const tag = this.querySelector<HTMLElement>('[data-ratio-tag]')!;
    tag.hidden = ratio === null;
    if (ratio !== null) {
      const place = ratioScale(ratio);
      tag.style.left = `${place.position * 100}%`;
      // At the ends the tag hangs inward, so it stays inside the card.
      tag.dataset.edge =
        place.position > 0.9 ? 'end' : place.position < 0.1 ? 'start' : '';
      tag.textContent = `${shown}×${place.clipped && ratio > 1 ? ' ▸' : ''}`;
    }
    set(
      '[data-ratio-text]',
      ratio !== null && ratio > 1.1 && doomLoop.doublingDays !== null
        ? `At this rate the open backlog of ${formatCount(latest.open)} doubles in ${Math.round(doomLoop.doublingDays)} days.`
        : ratio !== null && ratio < 0.9 && doomLoop.clearDays !== null
          ? `At this rate the backlog is cleared in ${Math.round(doomLoop.clearDays)} days.`
          : ''
    );
    this.querySelector('[data-ratio-history]')!.replaceChildren(
      ...ratioHistory(doomLoop.history)
    );
  }

  private drawDials(data: DeckData) {
    const { classes, ci, audit, responses, closures, snapshot } = data;
    const cards: DialCard[] = [];

    const sum = (f: (c: ClassFacts) => number) =>
      classes ? CLASSES.reduce((s, c) => s + f(classes[c]), 0) : 0;
    const resolvedRecent = sum((c) => c.resolvedRecent);
    const within = resolvedRecent
      ? sum((c) => c.resolvedWithinLimit) / resolvedRecent
      : null;
    const over = sum((c) => c.overLimit);
    const resolution = responses?.resolution;
    cards.push({
      kpi: 'Time to resolve',
      title: 'Resolved within limit',
      sub: 'Issues resolved inside their class time limit',
      href: '#issues',
      value: within === null ? null : within * 100,
      display: within === null ? '—' : formatPercent(within),
      bands: shareBands(50, 80),
      verdict: classes
        ? over > 0
          ? {
              tone: 'bad',
              text: `${formatCount(over)} open past ${over === 1 ? 'its' : 'their'} limit`,
            }
          : { tone: 'good', text: 'All open issues within limits' }
        : null,
      note: resolution?.count
        ? `median ${formatDuration(resolution.medianHours)} to resolve`
        : 'No issues resolved recently',
    });

    const open = snapshot.latest.open;
    const awaiting = responses?.awaitingResponse ?? 0;
    const answered = responses && open > 0 ? 1 - awaiting / open : null;
    const first = responses?.firstResponse;
    cards.push({
      kpi: 'Time to first response',
      title: 'Answered',
      sub: 'Open issues with a reply',
      href: '#issues',
      value: answered === null ? null : answered * 100,
      display: answered === null ? '—' : formatPercent(answered),
      bands: shareBands(50, 80),
      verdict: responses
        ? awaiting > 0
          ? {
              tone: 'warn',
              text: `${formatCount(awaiting)} open with no reply`,
            }
          : { tone: 'good', text: 'Every open issue has a reply' }
        : null,
      note: first?.count
        ? `median first reply ${formatDuration(first.medianHours)}`
        : 'No replies recorded recently',
    });

    const fixed =
      closures && closures.total > 0 ? closures.referencedShare : null;
    cards.push({
      kpi: 'Closures with a linked fix',
      title: 'Closures with a linked fix',
      sub: 'Closed issues that point to a commit, pull request or release',
      href: '#issues',
      value: fixed === null ? null : fixed * 100,
      display: fixed === null ? '—' : formatPercent(fixed),
      bands: shareBands(50, 80),
      verdict:
        fixed === null
          ? null
          : fixed >= 0.8
            ? { tone: 'good', text: 'Closures can be verified' }
            : fixed >= 0.5
              ? { tone: 'warn', text: 'Many closures unverified' }
              : { tone: 'bad', text: 'Most closures unverified' },
      note: closures
        ? `${formatCount(closures.byEvidence.fix_referenced)} of ${formatCount(closures.total)} closures`
        : 'No data yet',
    });

    const rate = ci && ci.runs > 0 ? ci.successRate : null;
    cards.push({
      kpi: 'CI runs passing',
      title: 'CI runs passing',
      sub: 'Default branch',
      href: '#delivery',
      value: rate === null ? null : rate * 100,
      display: rate === null ? '—' : formatPercent(rate),
      bands: shareBands(75, 90),
      verdict:
        rate === null
          ? null
          : ci!.failingNow.length
            ? { tone: 'bad', text: `Failing: ${ci!.failingNow.join(', ')}` }
            : rate >= 0.9
              ? { tone: 'good', text: 'Green' }
              : { tone: 'warn', text: 'Often red' },
      note: ci?.runs
        ? `${formatCount(ci.runs)} runs in ${ci.windowDays} days`
        : 'No CI runs recorded',
    });

    const ready = readiness(audit);
    cards.push({
      kpi: 'Agent readiness',
      title: 'Agent readiness',
      sub: 'Distance from the ideal set-up, from the audit',
      href: '/audit',
      value: ready?.score ?? null,
      display: ready ? `${ready.score}/100` : '—',
      bands: ZONES.map((z, i) => ({
        from: z.from,
        to: ZONES[i + 1]?.from ?? 100,
        colour: ['var(--critical)', 'var(--warning)', 'var(--good)'][i],
      })),
      target: ready?.projected ?? null,
      verdict: ready
        ? {
            tone:
              ready.zone.id === 'ready'
                ? 'good'
                : ready.zone.id === 'supervised'
                  ? 'warn'
                  : 'bad',
            text: ready.zone.label,
          }
        : null,
      note: ready ? `${ready.distance} points from ideal` : 'No audit yet',
    });

    this.querySelector('[data-dials]')!.replaceChildren(
      ...cards.map((c) => this.dialCard(c))
    );
  }

  private dialCard(c: DialCard): HTMLElement {
    const card = document.createElement('a');
    card.className = 'card instrument dial-card';
    card.href = c.href;
    card.dataset.kpi = c.kpi;
    const head = document.createElement('header');
    head.className = 'instrument-head';
    const h3 = document.createElement('h3');
    h3.textContent = c.title;
    const better = document.createElement('span');
    better.className = 'better';
    better.textContent = '↑ better';
    const sub = document.createElement('p');
    sub.textContent = c.sub;
    head.append(h3, better, sub);

    const wrap = document.createElement('div');
    wrap.className = 'dial-wrap';
    wrap.append(
      dial({
        value: c.value,
        bands: c.bands,
        target: c.target ?? null,
        ticks: [0, 50, 100],
        label:
          `${c.title}: ${c.display}` + (c.verdict ? `. ${c.verdict.text}` : ''),
      })
    );
    const figure = document.createElement('div');
    figure.className = 'dial-figure';
    const readout = document.createElement('p');
    readout.className = 'readout boxed tabular';
    readout.textContent = c.display;
    figure.append(readout);
    wrap.append(figure);

    card.append(head, wrap);
    if (c.verdict) {
      const verdict = document.createElement('p');
      verdict.className = 'verdict';
      verdict.dataset.tone = c.verdict.tone;
      verdict.append(icon(c.verdict.tone), c.verdict.text);
      card.append(verdict);
    }
    const note = document.createElement('p');
    note.className = 'deck-note';
    note.textContent = c.note;
    card.append(note);
    return card;
  }

  private drawCrew(data: DeckData) {
    const { velocity: v, latest } = data.snapshot;
    const pulls = data.pulls;
    const rows: HTMLElement[] = [
      crewRow('Issues resolved a day', v.agent, v.human, 0, formatRate),
      crewRow(
        'Issues resolved, all time',
        latest.agentClosed,
        latest.totalClosed - latest.agentClosed,
        0,
        formatCount
      ),
    ];
    if (pulls) {
      const o = pulls.byOrigin;
      rows.push(
        crewRow(
          `Pull requests merged, ${pulls.windowDays} days`,
          o.agent.merged,
          o.human.merged,
          o.assisted.merged,
          formatCount
        )
      );
    }
    this.querySelector('[data-crew-rows]')!.replaceChildren(...rows);

    const share = latest.totalClosed
      ? latest.agentClosed / latest.totalClosed
      : null;
    const stats: [string, string][] = [
      ['Resolved by AI agents', share === null ? '—' : formatPercent(share)],
    ];
    if (pulls) {
      const merged = agentMergedShare(pulls);
      const o = pulls.byOrigin;
      const rate = (r: number | null) => (r === null ? '—' : formatPercent(r));
      stats.push(
        [
          "Merged with an agent's hand",
          merged === null ? '—' : formatPercent(merged),
        ],
        [
          'Merge rate, agent / person',
          `${rate(o.agent.mergeRate)} / ${rate(o.human.mergeRate)}`,
        ],
        [
          'Time to merge, agent / person',
          `${formatDuration(o.agent.medianHoursToMerge)} / ${formatDuration(o.human.medianHoursToMerge)}`,
        ]
      );
    }
    this.querySelector('[data-crew-stats]')!.replaceChildren(
      ...stats.map(([label, value]) => {
        const box = document.createElement('div');
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.className = 'tabular';
        dd.textContent = value;
        box.append(dt, dd);
        return box;
      })
    );
    this.querySelector('[data-crew-note]')!.textContent = pulls
      ? 'Hatched: a person working with an agent. Agents working through a person’s account without a trailer count as people, so agent figures are a lower bound.'
      : 'Pull request figures appear after the next tracker run.';
  }
}

function icon(tone: Tone): HTMLElement {
  const span = document.createElement('span');
  span.className = 'tone-icon';
  span.dataset.tone = tone;
  span.setAttribute('aria-hidden', 'true');
  span.textContent = ICONS[tone];
  return span;
}

function legend(kind: 'agent' | 'human' | 'arrivals', text: string) {
  const li = document.createElement('li');
  const glyph = document.createElement('span');
  glyph.className = `glyph ${kind}`;
  glyph.setAttribute('aria-hidden', 'true');
  li.append(glyph, text);
  return li;
}

/** One row of the crew split: agents (and assisted, hatched) against people. */
function crewRow(
  label: string,
  agents: number,
  people: number,
  assisted: number,
  format: (n: number) => string
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'crew-row';
  const name = document.createElement('span');
  name.className = 'crew-label';
  name.textContent = label;
  const bar = document.createElement('div');
  bar.className = 'crew-bar';
  const total = agents + assisted + people;
  bar.setAttribute('role', 'img');
  bar.setAttribute(
    'aria-label',
    `${label}: ${format(agents)} by agents` +
      (assisted ? `, ${format(assisted)} by people with agents` : '') +
      `, ${format(people)} by people`
  );
  for (const [value, cls] of [
    [agents, 'agent'],
    [assisted, 'assisted'],
    [people, 'human'],
  ] as const) {
    if (value <= 0) continue;
    const seg = document.createElement('span');
    seg.className = cls;
    seg.style.flex = `${value} 0 0`;
    bar.append(seg);
  }
  if (total === 0) bar.classList.add('empty');
  const numbers = document.createElement('span');
  numbers.className = 'crew-numbers tabular';
  numbers.textContent = `${format(agents + assisted)} · ${format(people)}`;
  row.append(name, bar, numbers);
  return row;
}

/** The ratio by day on the same log scale, with the break-even line. */
function ratioHistory(
  history: { date: string; ratio: number | null }[]
): Element[] {
  const points = history
    .slice(-30)
    .filter((h): h is { date: string; ratio: number } => h.ratio !== null);
  if (points.length < 2) return [];
  const root = svg('svg', {
    viewBox: '0 0 300 60',
    preserveAspectRatio: 'none',
    class: 'ratio-spark',
    'aria-hidden': 'true',
  });
  const x = (i: number) => (i / (points.length - 1)) * 300;
  const y = (r: number) => 56 - ratioScale(r).position * 52;
  const line = points.map((p, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(p.ratio)}`);
  const last = points[points.length - 1].ratio;
  const tone = last > 1.1 ? 'bad' : 'good';
  svg(
    'path',
    {
      d: `${line.join(' ')} L 300 60 L 0 60 Z`,
      class: 'spark-area',
      'data-tone': tone,
    },
    root
  );
  svg(
    'line',
    { x1: 0, x2: 300, y1: y(1), y2: y(1), class: 'spark-even' },
    root
  );
  svg(
    'path',
    { d: line.join(' '), class: 'spark-line', 'data-tone': tone },
    root
  );
  const caption = document.createElement('p');
  caption.className = 'deck-note spark-caption';
  caption.textContent = `Ratio by day, last ${points.length} days · dashed: 1× break-even`;
  return [root, caption];
}

if (!customElements.get(FlightDeckComponent.tagName)) {
  customElements.define(FlightDeckComponent.tagName, FlightDeckComponent);
}
