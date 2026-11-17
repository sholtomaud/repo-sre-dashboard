import { BaseComponent } from '../../core/base-component.ts';
import type { Practice, PracticeStatus } from '../../services/health.ts';
import template from './practice-list.html?raw';
import style from './practice-list.css?raw';

/** An icon and a word for each status, so colour is never the only cue. */
const STATUS: Record<PracticeStatus, { icon: string; label: string }> = {
  pass: { icon: '✓', label: 'In place' },
  improve: { icon: '!', label: 'Could improve' },
  missing: { icon: '✕', label: 'Missing' },
  unknown: { icon: '?', label: 'Not enough data yet' },
};

/** The order shown: what to fix first. */
const ORDER: PracticeStatus[] = ['missing', 'improve', 'unknown', 'pass'];

/**
 * The repository habits checklist, with a recommendation and a link to
 * GitHub's documentation for each check that does not pass.
 *
 * Set `practices` to draw it; hidden when there are none.
 */
export class PracticeListComponent extends BaseComponent {
  static tagName = 'practice-list';

  private items: Practice[] = [];

  constructor() {
    super(template, style);
  }

  set practices(value: Practice[]) {
    this.items = value;
    if (this.isConnected) this.draw();
  }
  get practices(): Practice[] {
    return this.items;
  }

  init() {
    this.draw();
  }

  private draw() {
    this.hidden = this.items.length === 0;
    const done = this.items.filter((p) => p.status === 'pass').length;
    this.querySelector('[data-score]')!.textContent =
      `${done} of ${this.items.length} in place`;
    const sorted = [...this.items].sort(
      (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)
    );
    const tpl = this.querySelector<HTMLTemplateElement>(
      '[data-item-template]'
    )!;
    this.querySelector('[data-items]')!.replaceChildren(
      ...sorted.map((practice) => {
        const item = (tpl.content.cloneNode(true) as DocumentFragment)
          .firstElementChild as HTMLElement;
        item.dataset.status = practice.status;
        item.dataset.id = practice.id;
        const set = (selector: string, text: string) => {
          item.querySelector(selector)!.textContent = text;
        };
        set('[data-icon]', STATUS[practice.status].icon);
        set('[data-title]', practice.title);
        set('[data-status-label]', STATUS[practice.status].label);
        set('[data-evidence]', practice.evidence);
        const advice = item.querySelector<HTMLElement>('[data-advice]')!;
        advice.hidden = !practice.recommendation;
        set('[data-recommendation]', practice.recommendation);
        const docs = item.querySelector<HTMLAnchorElement>('[data-docs]')!;
        docs.hidden = !practice.docs;
        docs.href = practice.docs;
        return item;
      })
    );
  }
}

if (!customElements.get(PracticeListComponent.tagName)) {
  customElements.define(PracticeListComponent.tagName, PracticeListComponent);
}
