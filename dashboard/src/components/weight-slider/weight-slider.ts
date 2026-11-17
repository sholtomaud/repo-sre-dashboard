import { BaseComponent } from '../../core/base-component.ts';
import type { WeightMark } from '../../services/combined.ts';
import template from './weight-slider.html?raw';
import style from './weight-slider.css?raw';

const STORAGE_KEY = 'public-weight';
const MARK_KEY = 'public-weight-mark';

/**
 * Chooses the weight of the public issues in the combined measures, with
 * marked presets. Dispatches `weight-change` (detail: the weight, 0–1) when
 * it moves, and remembers the choice in this browser.
 *
 * Set `marks`, then `weight`.
 */
export class WeightSliderComponent extends BaseComponent {
  static tagName = 'weight-slider';

  private value = 0.5;
  private presets: WeightMark[] = [];
  private chosenMark: WeightMark['id'] | null = null;

  constructor() {
    super(template, style);
  }

  /** The weight saved in this browser, if any. */
  static saved(): number | null {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const weight = stored === null ? Number.NaN : Number(stored);
      return weight >= 0 && weight <= 1 ? weight : null;
    } catch {
      return null; // Storage can be unavailable; the default is used.
    }
  }

  /** The preset last chosen in this browser, if any. */
  static savedMark(): WeightMark['id'] | null {
    try {
      return (
        (window.localStorage.getItem(MARK_KEY) as WeightMark['id']) || null
      );
    } catch {
      return null;
    }
  }

  /**
   * The preset chosen, or `null` after dragging to a custom weight. A
   * preset derived from the data (by backlog, by effort) means "this rule",
   * so a replay can work its weight out afresh for each day.
   */
  set mark(value: WeightMark['id'] | null) {
    this.chosenMark = value;
    if (this.isConnected) this.render();
  }
  get mark(): WeightMark['id'] | null {
    return this.chosenMark;
  }

  set marks(value: WeightMark[]) {
    this.presets = value;
    if (this.isConnected) this.render();
  }
  get marks(): WeightMark[] {
    return this.presets;
  }

  set weight(value: number) {
    this.value = Math.min(1, Math.max(0, value));
    if (this.isConnected) this.render();
  }
  get weight(): number {
    return this.value;
  }

  init() {
    const range = this.querySelector<HTMLInputElement>('[data-range]')!;
    range.addEventListener('input', () =>
      this.choose(Number(range.value) / 100, null)
    );
    this.delegate('click', '[data-mark]', (_event, button) =>
      this.choose(
        Number(button.dataset.weight),
        button.dataset.mark as WeightMark['id']
      )
    );
    this.render();
  }

  private choose(weight: number, mark: WeightMark['id'] | null) {
    this.chosenMark = mark;
    this.weight = weight;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(this.value));
      window.localStorage.setItem(MARK_KEY, mark ?? '');
    } catch {
      // Not remembered; the slider still works.
    }
    this.dispatchEvent(
      new CustomEvent('weight-change', { detail: this.value, bubbles: true })
    );
  }

  private render() {
    const percent = Math.round(this.value * 100);
    this.querySelector<HTMLInputElement>('[data-range]')!.value =
      String(percent);
    this.querySelector('[data-readout]')!.textContent =
      `Public issues ${percent}% · agents' queue ${100 - percent}%`;

    this.querySelector('[data-ticks]')!.replaceChildren(
      ...this.presets.map((mark) => {
        const tick = document.createElement('span');
        tick.style.left = `${mark.weight * 100}%`;
        return tick;
      })
    );
    this.querySelector('[data-marks]')!.replaceChildren(
      ...this.presets.map((mark) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.mark = mark.id;
        button.dataset.weight = String(mark.weight);
        button.setAttribute(
          'aria-pressed',
          String(
            this.chosenMark
              ? mark.id === this.chosenMark
              : Math.round(mark.weight * 100) === percent
          )
        );
        const value = document.createElement('span');
        value.className = 'mark-value tabular';
        value.textContent = `${formatWeight(mark.weight)} public`;
        button.append(mark.label, value);
        return button;
      })
    );
  }
}

/** A weight as a percentage, with a decimal only when it is under 1%. */
function formatWeight(weight: number): string {
  const percent = weight * 100;
  return percent > 0 && percent < 1
    ? `${percent.toFixed(1)}%`
    : `${Math.round(percent)}%`;
}

if (!customElements.get(WeightSliderComponent.tagName)) {
  customElements.define(WeightSliderComponent.tagName, WeightSliderComponent);
}
