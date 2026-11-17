import { BaseComponent } from '../../core/base-component.ts';
import type { ClosureSummary } from '../../services/insights.ts';
import {
  EVIDENCE,
  KINDS,
  type Evidence,
  type Kind,
  type Status,
} from '../../services/metrics.ts';
import { formatCount } from '../../lib/format.ts';
import template from './closure-evidence.html?raw';
import style from './closure-evidence.css?raw';

/** Fixed order and colour: a category keeps its colour when others are 0. */
const EVIDENCE_STYLE: Record<Evidence, { label: string; color: string }> = {
  fix_referenced: { label: 'Fix referenced', color: 'var(--series-1)' },
  no_reference: {
    label: 'Closed without a referenced fix',
    color: 'var(--series-2)',
  },
  declined: { label: 'Declined (not planned)', color: 'var(--series-3)' },
  withdrawn: { label: 'Withdrawn by the reporter', color: 'var(--series-4)' },
  duplicate: { label: 'Duplicate', color: 'var(--series-5)' },
};
const KIND_STYLE: Record<Kind, { label: string; color: string }> = {
  behavior: { label: 'Bug reports', color: 'var(--series-1)' },
  feature: { label: 'Feature request', color: 'var(--series-2)' },
  other: { label: 'Other', color: 'var(--series-3)' },
};

interface Part {
  label: string;
  color: string;
  value: number;
}

/**
 * How closed issues were closed (with or without a referenced fix), and
 * what kinds of issue are open. Shows a note instead while the data has no
 * closure details yet.
 *
 * Set `closures` and `issues`, then call `update()`.
 */
export class ClosureEvidenceComponent extends BaseComponent {
  static tagName = 'closure-evidence';

  closures: ClosureSummary | null = null;
  issues: Status['issues'] | undefined;

  constructor() {
    super(template, style);
  }

  update() {
    if (!this.isConnected) return;
    const show = (selector: string, visible: boolean) => {
      this.querySelector<HTMLElement>(selector)!.hidden = !visible;
    };
    show('[data-empty]', !this.closures && !this.issues);
    show('[data-closures]', !!this.closures);
    show('[data-kinds]', !!this.issues);

    if (this.closures) {
      const { total, byEvidence } = this.closures;
      this.querySelector('[data-referenced]')!.textContent =
        `${formatCount(byEvidence.fix_referenced)} of ${formatCount(total)}`;
      this.querySelector('[data-referenced-text]')!.textContent =
        `${total === 1 ? 'closure references' : 'closures reference'} a fix`;
      this.segments(
        'evidence',
        'Closed issues by how they were closed',
        EVIDENCE.map((name) => ({
          ...EVIDENCE_STYLE[name],
          value: byEvidence[name],
        }))
      );
    }
    if (this.issues) {
      const { open, openLabelled, openByKind } = this.issues;
      this.segments(
        'kind',
        'Open issues by type',
        KINDS.map((name) => ({ ...KIND_STYLE[name], value: openByKind[name] }))
      );
      this.querySelector('[data-labelled]')!.textContent =
        `${formatCount(openLabelled)} of ${formatCount(open)} open issues carry a label. ` +
        'Type is read from the issue form each was filed with.';
    }
  }

  init() {
    this.update();
  }

  /** A segmented bar with a legend; every value is also in the legend. */
  private segments(name: string, title: string, parts: Part[]) {
    const total = parts.reduce((sum, part) => sum + part.value, 0);
    const bar = this.querySelector<HTMLElement>(`[data-${name}-bar]`)!;
    bar.setAttribute(
      'aria-label',
      `${title}: ` +
        parts.map((part) => `${part.label} ${part.value}`).join(', ')
    );
    bar.replaceChildren(
      ...parts
        .filter((part) => part.value > 0)
        .map((part) => {
          const segment = document.createElement('span');
          segment.className = 'segment';
          segment.style.flex = `${part.value} 0 0`;
          segment.style.background = part.color;
          segment.title = `${part.label}: ${formatCount(part.value)}`;
          return segment;
        })
    );
    if (total === 0) bar.style.background = 'var(--grid)';

    this.querySelector(`[data-${name}-legend]`)!.replaceChildren(
      ...parts.map((part) => {
        const item = document.createElement('li');
        const swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.style.background = part.color;
        const value = document.createElement('strong');
        value.className = 'tabular';
        value.textContent = formatCount(part.value);
        item.append(swatch, value, part.label);
        return item;
      })
    );
  }
}

if (!customElements.get(ClosureEvidenceComponent.tagName)) {
  customElements.define(
    ClosureEvidenceComponent.tagName,
    ClosureEvidenceComponent
  );
}
