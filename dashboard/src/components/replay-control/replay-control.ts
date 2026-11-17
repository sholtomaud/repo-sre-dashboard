import { BaseComponent } from '../../core/base-component.ts';
import { formatDate } from '../../lib/format.ts';
import template from './replay-control.html?raw';
import style from './replay-control.css?raw';

/** Seconds of playback for each day of the record and the forecast. */
const SECONDS_PER_DAY = 0.45;

/**
 * Plays the record back and on into the forecast: a play/pause button, a
 * scrubber with today marked, and the date being shown. Dispatches
 * `replay-position` whenever the position changes; the detail is the
 * position in days from the first date (fractional while playing), or
 * `null` when the view is back on today's live data.
 *
 * Set `dates` (one per day, oldest first, forecast days last) and `today`
 * (the index of the last recorded day).
 */
export class ReplayControlComponent extends BaseComponent {
  static tagName = 'replay-control';

  private days: string[] = [];
  private todayIndex = 0;
  private position = 0;
  private playing = false;
  private frame = 0;
  private lastTick = 0;

  constructor() {
    super(template, style);
  }

  /** Sets the days and today's place among them, keeping the view live. */
  setDays(dates: string[], today = dates.length - 1) {
    const live = this.isLive;
    this.days = dates;
    this.todayIndex = Math.min(
      Math.max(today, 0),
      Math.max(0, dates.length - 1)
    );
    if (live || this.position > this.end) this.position = this.todayIndex;
    if (this.isConnected) this.render();
  }

  set dates(value: string[]) {
    this.setDays(value);
  }
  get dates(): string[] {
    return this.days;
  }

  private get end(): number {
    return Math.max(0, this.days.length - 1);
  }

  private get isLive(): boolean {
    return !this.playing && this.position === this.todayIndex;
  }

  init() {
    this.position = this.todayIndex;
    this.delegate('click', '[data-play]', () => this.toggle());
    const scrubber = this.querySelector<HTMLInputElement>('[data-scrubber]')!;
    scrubber.addEventListener('input', () => {
      // Read the value first: pausing re-renders the scrubber.
      const chosen = Number(scrubber.value);
      this.pause();
      this.moveTo(chosen);
    });
    this.render();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.frame);
  }

  private toggle() {
    if (this.playing) {
      this.pause();
      return;
    }
    // From the live view or the end, play from the beginning.
    if (this.isLive || this.position >= this.end) this.position = 0;
    this.playing = true;
    this.lastTick = performance.now();
    this.frame = requestAnimationFrame((now) => this.tick(now));
    this.moveTo(this.position);
  }

  private pause() {
    this.playing = false;
    cancelAnimationFrame(this.frame);
    this.render();
  }

  private tick(now: number) {
    if (!this.playing) return;
    const elapsed = (now - this.lastTick) / 1000;
    this.lastTick = now;
    const next = this.position + elapsed / SECONDS_PER_DAY;
    if (next >= this.end) {
      // The end of the forecast: back to today.
      this.playing = false;
      this.moveTo(this.todayIndex);
      return;
    }
    this.moveTo(next);
    this.frame = requestAnimationFrame((time) => this.tick(time));
  }

  private moveTo(position: number) {
    this.position = Math.min(Math.max(position, 0), this.end);
    this.render();
    this.dispatchEvent(
      new CustomEvent<number | null>('replay-position', {
        detail: this.isLive ? null : this.position,
        bubbles: true,
      })
    );
  }

  private render() {
    const root = this.querySelector<HTMLElement>('[data-replay]')!;
    // A replay needs at least two days.
    root.hidden = this.days.length < 2;
    if (root.hidden) return;

    const live = this.isLive;
    const forecast = this.position > this.todayIndex;
    root.dataset.state = live ? 'live' : forecast ? 'forecast' : 'replaying';
    const scrubber = this.querySelector<HTMLInputElement>('[data-scrubber]')!;
    scrubber.max = String(this.end);
    scrubber.value = String(this.position);
    const date = this.days[Math.min(Math.round(this.position), this.end)];
    const label = live
      ? 'Live'
      : forecast
        ? `Forecast · ${formatDate(date)}`
        : formatDate(date);
    scrubber.setAttribute('aria-valuetext', label);
    this.querySelector('[data-date]')!.textContent = label;

    // Today's place on the scrubber, and the forecast beyond it.
    const today = this.querySelector<HTMLElement>('[data-today]')!;
    const share = this.end > 0 ? this.todayIndex / this.end : 1;
    today.hidden = this.todayIndex >= this.end;
    root.style.setProperty('--today', String(share));

    this.querySelector('[data-icon]')!.textContent = this.playing ? '❚❚' : '▶';
    this.querySelector('[data-play-label]')!.textContent = this.playing
      ? 'Pause'
      : live
        ? this.todayIndex < this.end
          ? 'Replay and forecast'
          : 'Replay the record'
        : 'Resume';
  }
}

if (!customElements.get(ReplayControlComponent.tagName)) {
  customElements.define(ReplayControlComponent.tagName, ReplayControlComponent);
}
