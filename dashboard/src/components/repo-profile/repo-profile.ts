import { BaseComponent } from '../../core/base-component.ts';
import type { RepoProfile } from '../../services/report.ts';
import { formatCount, formatDate } from '../../lib/format.ts';
import template from './repo-profile.html?raw';
import style from './repo-profile.css?raw';

/** Language colours: the chart series in order, then grey for the rest. */
const COLOURS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
];

/** What the repository is made of: languages, files, tests, workflows. */
export class RepoProfileComponent extends BaseComponent {
  static tagName = 'repo-profile';

  private value: RepoProfile | null = null;

  constructor() {
    super(template, style);
  }

  set profile(value: RepoProfile | null) {
    this.value = value;
    if (this.isConnected) this.draw();
  }

  init() {
    this.draw();
  }

  private draw() {
    const p = this.value;
    this.hidden = !p;
    if (!p) return;
    if (p.description) {
      this.querySelector('[data-description]')!.textContent = p.description;
    }

    const top = p.languages.slice(0, COLOURS.length);
    const rest = p.languages
      .slice(COLOURS.length)
      .reduce((s, l) => s + l.share, 0);
    const parts = [
      ...top.map((l, i) => ({ ...l, colour: COLOURS[i] })),
      ...(rest > 0
        ? [{ name: 'Other', share: rest, colour: 'var(--axis)' }]
        : []),
    ];
    const pct = (share: number) =>
      share >= 0.1
        ? `${Math.round(share * 100)}%`
        : `${(share * 100).toFixed(1)}%`;
    const bar = this.querySelector<HTMLElement>('[data-languages]')!;
    bar.setAttribute(
      'aria-label',
      parts.length
        ? `Languages: ${parts.map((l) => `${l.name} ${pct(l.share)}`).join(', ')}`
        : 'No languages detected'
    );
    bar.replaceChildren(
      ...parts.map((l) => {
        const span = document.createElement('span');
        span.style.flex = `${l.share} 0 0`;
        span.style.background = l.colour;
        span.title = `${l.name} ${pct(l.share)}`;
        return span;
      })
    );
    this.querySelector('[data-legend]')!.replaceChildren(
      ...parts.map((l) => {
        const li = document.createElement('li');
        const sw = document.createElement('span');
        sw.className = 'swatch';
        sw.style.background = l.colour;
        li.append(sw, `${l.name} ${pct(l.share)}`);
        return li;
      })
    );

    const facts: [string, string, string?][] = [
      [
        'Files',
        formatCount(p.files) + (p.truncated ? '+' : ''),
        'excluding vendored and built code',
      ],
      [
        'Test files',
        formatCount(p.testFiles),
        p.files
          ? `${Math.round((p.testFiles / p.files) * 100)}% of files`
          : undefined,
      ],
      [
        'Workflows',
        formatCount(p.workflows.length),
        p.workflows.length
          ? `${p.workflows.filter((w) => w.onPullRequest).length} on pull requests · ${p.workflows.filter((w) => w.runsTests).length} run tests`
          : 'no GitHub Actions',
      ],
      [
        'Ecosystems',
        p.ecosystems.length ? p.ecosystems.join(', ') : 'None found',
      ],
      [
        'Default branch',
        p.defaultBranch,
        p.protected === null
          ? 'protection unknown'
          : p.protected
            ? 'protected'
            : 'not protected',
      ],
      ['Licence', p.license ?? 'None'],
      [
        'Created',
        p.createdAt ? formatDate(p.createdAt.slice(0, 10)) : '—',
        p.pushedAt
          ? `last push ${formatDate(p.pushedAt.slice(0, 10))}`
          : undefined,
      ],
      [
        'Visibility',
        p.visibility
          ? p.visibility[0].toUpperCase() + p.visibility.slice(1)
          : '—',
        `${formatCount(p.stars)} stars · ${formatCount(p.forks)} forks`,
      ],
    ];
    this.querySelector('[data-facts]')!.replaceChildren(
      ...facts.flatMap(([label, value, note]) => {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        if (note) {
          const small = document.createElement('small');
          small.textContent = note;
          dd.append(small);
        }
        const box = document.createElement('div');
        box.append(dt, dd);
        return [box];
      })
    );
    this.querySelector('[data-note]')!.textContent = p.truncated
      ? 'The repository is larger than the API lists in one go, so file counts are a lower bound.'
      : '';
  }
}

if (!customElements.get(RepoProfileComponent.tagName)) {
  customElements.define(RepoProfileComponent.tagName, RepoProfileComponent);
}
