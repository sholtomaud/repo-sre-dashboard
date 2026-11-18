import { BaseComponent } from '../../core/base-component.ts';
import {
  CLASSES,
  formatLimit,
  type ClassFacts,
  type IssueClass,
} from '../../services/report.ts';
import { formatCount, formatDays } from '../../lib/format.ts';
import template from './class-table.html?raw';
import style from './class-table.css?raw';

const NAMES: Record<IssueClass, string> = {
  security: 'Security',
  bug: 'Bugs',
  other: 'Features and other',
};

const days = (d: number | null) =>
  d === null ? '—' : `${formatDays(d < 10 ? d : Math.round(d))} d`;
const share = (part: number, whole: number) =>
  whole ? `${Math.round((part / whole) * 100)}%` : '—';

/** The facts of each class of issue: open, past limit, closed, how fast. */
export class ClassTableComponent extends BaseComponent {
  static tagName = 'class-table';

  private value: Record<IssueClass, ClassFacts> | null = null;

  constructor() {
    super(template, style);
  }

  set classes(value: Record<IssueClass, ClassFacts> | null) {
    this.value = value;
    if (this.isConnected) this.draw();
  }

  init() {
    this.draw();
  }

  private draw() {
    const classes = this.value;
    this.hidden = !classes;
    if (!classes) return;
    this.querySelector('[data-window]')!.textContent = String(
      classes.bug.windowDays
    );
    this.querySelector('[data-rows]')!.replaceChildren(
      ...CLASSES.map((c) => {
        const f = classes[c];
        const row = document.createElement('tr');
        row.dataset.class = c;
        const head = document.createElement('th');
        head.scope = 'row';
        head.textContent = NAMES[c];
        const limit = document.createElement('span');
        limit.className = 'limit';
        limit.textContent = `${formatLimit(f.limitDays)} limit`;
        head.append(limit);
        row.append(head);
        const cells: [string, string?][] = [
          [formatCount(f.open)],
          [
            formatCount(f.overLimit),
            f.overLimit ? 'bad' : f.open ? 'good' : '',
          ],
          [days(f.oldestOpenDays)],
          [formatCount(f.openedRecent)],
          [formatCount(f.closedRecent)],
          [formatCount(f.closedRecentByAgents)],
          [share(f.closedRecentWithFix, f.closedRecent)],
          [days(f.medianDaysToResolve)],
          [
            share(f.resolvedWithinLimit, f.resolvedRecent),
            f.resolvedRecent
              ? f.resolvedWithinLimit / f.resolvedRecent >= 0.9
                ? 'good'
                : f.resolvedWithinLimit / f.resolvedRecent < 0.5
                  ? 'bad'
                  : ''
              : '',
          ],
        ];
        for (const [text, tone] of cells) {
          const cell = document.createElement('td');
          cell.textContent = text;
          if (tone) cell.dataset.tone = tone;
          row.append(cell);
        }
        return row;
      })
    );
  }
}

if (!customElements.get(ClassTableComponent.tagName)) {
  customElements.define(ClassTableComponent.tagName, ClassTableComponent);
}
