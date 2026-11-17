import { BaseComponent } from '../../core/base-component.ts';
import { DATA_CSV_PATH, PROJECT_URL, loadConfig } from '../../lib/config.ts';
import { loadStatus } from '../../services/metrics.ts';
import template from './methodology-page.html?raw';
import style from './methodology-page.css?raw';

/** How each number on the dashboard is worked out. */
export class MethodologyPageComponent extends BaseComponent {
  static tagName = 'methodology-page';

  constructor() {
    super(template, style);
  }

  init() {
    this.querySelector<HTMLAnchorElement>('[data-csv-link]')!.href =
      DATA_CSV_PATH;
    this.querySelector<HTMLAnchorElement>('[data-project-link]')!.href =
      PROJECT_URL;

    loadConfig().then((config) => {
      const tracked = this.querySelector<HTMLAnchorElement>(
        '[data-tracked-link]'
      )!;
      tracked.href = config.issuesUrl || config.repositoryUrl;
      tracked.textContent = config.repository;

      // Sections about a second, file-based queue only when there is one.
      this.querySelectorAll<HTMLElement>('[data-queue-only]').forEach(
        (section) => (section.hidden = !config.queue)
      );
      if (config.queue) {
        const set = (selector: string, text: string) => {
          this.querySelector(selector)!.textContent = text;
        };
        set('[data-queue-repository]', config.queue.repository);
        set('[data-queue-open]', config.queue.openDir);
        set('[data-queue-resolved]', config.queue.resolvedDir);
      }

      const why = this.querySelector<HTMLElement>('[data-why]')!;
      why.hidden = !config.why;
      if (config.why) {
        this.querySelector('[data-why-text]')!.textContent = config.why.text;
        const source = this.querySelector<HTMLElement>('[data-why-source]')!;
        source.hidden = !config.why.url;
        this.querySelector<HTMLAnchorElement>('[data-why-link]')!.href =
          config.why.url;
      }
    });

    // The schedule is set in the workflow's cron line and reaches the page
    // through status.json.
    loadStatus().then((status) => {
      if (!status) return;
      const { description, runTimesUtc } = status.schedule;
      this.querySelector('[data-schedule]')!.textContent = runTimesUtc.length
        ? `${description} (${runTimesUtc.join(', ')} UTC)`
        : description;
    });
  }
}

if (!customElements.get(MethodologyPageComponent.tagName)) {
  customElements.define(
    MethodologyPageComponent.tagName,
    MethodologyPageComponent
  );
}
