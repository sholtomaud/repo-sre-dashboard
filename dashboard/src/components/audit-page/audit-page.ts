import { BaseComponent } from '../../core/base-component.ts';
import { loadConfig } from '../../lib/config.ts';
import { loadStatus } from '../../services/metrics.ts';
import {
  parseAudit,
  priorities,
  type Audit,
  type Check,
  type CheckStatus,
} from '../../services/report.ts';
import template from './audit-page.html?raw';
import style from './audit-page.css?raw';

type Filter = 'todo' | 'all' | 'pass' | 'waiting';

export const STATUS_LABEL: Record<
  CheckStatus,
  { icon: string; label: string }
> = {
  pass: { icon: '✓', label: 'Passing' },
  improve: { icon: '!', label: 'Could improve' },
  missing: { icon: '✕', label: 'Missing' },
  waiting: { icon: '…', label: 'Waiting for data' },
};

const IMPACT_LABEL = {
  high: 'High impact',
  medium: 'Medium impact',
  low: 'Low impact',
};

/** The audit: every check, grouped, with its fixes. */
export class AuditPageComponent extends BaseComponent {
  static tagName = 'audit-page';

  private audit: Audit | null = null;
  private filter: Filter = 'todo';

  constructor() {
    super(template, style);
  }

  async init() {
    this.delegate('click', '[data-filter]', (_event, button) => {
      this.filter = (button as HTMLElement).dataset.filter as Filter;
      this.querySelectorAll('[data-filter]').forEach((b) =>
        b.setAttribute('aria-pressed', String(b === button))
      );
      this.drawChecks();
    });
    this.delegate('click', '[data-copy]', (_event, button) => {
      const code = button.closest('.fix')?.querySelector('code.fix-code');
      if (!code) return;
      navigator.clipboard?.writeText(code.textContent ?? '').then(
        () => {
          button.textContent = 'Copied';
          window.setTimeout(() => (button.textContent = 'Copy'), 1600);
        },
        () => (button.textContent = 'Select and copy')
      );
    });

    const [config, status] = await Promise.all([loadConfig(), loadStatus()]);
    this.querySelector('[data-repo]')!.textContent = config.repository;
    this.audit = parseAudit(status?.raw);
    this.drawScore();
    // A link to one check shows it whatever its status.
    const target = decodeURIComponent(location.hash.slice(1));
    if (target && this.audit?.checks.some((c) => c.id === target)) {
      this.filter = 'all';
      this.querySelectorAll('[data-filter]').forEach((b) =>
        b.setAttribute(
          'aria-pressed',
          String((b as HTMLElement).dataset.filter === 'all')
        )
      );
    }
    this.drawChecks();
    if (target) {
      const card = this.querySelector(`[id="${CSS.escape(target)}"]`);
      const first = card?.querySelector<HTMLDetailsElement>('details.fix');
      if (first) first.open = true;
      card?.scrollIntoView();
    }
  }

  private drawScore() {
    const audit = this.audit;
    const set = (selector: string, text: string) => {
      this.querySelector(selector)!.textContent = text;
    };
    if (!audit) {
      set(
        '[data-score-line]',
        'The audit appears after the next run of the dashboard workflow.'
      );
      return;
    }
    set('[data-score]', audit.score === null ? '—' : String(audit.score));
    const count = (s: CheckStatus) =>
      audit.checks.filter((c) => c.status === s).length;
    const todo = priorities(audit.checks).length;
    set(
      '[data-score-line]',
      `${audit.passed} of ${audit.judged} checks pass` +
        (todo ? ` · ${todo} to do` : '') +
        (audit.waiting ? ` · ${audit.waiting} waiting for data` : '')
    );
    const order: CheckStatus[] = ['pass', 'improve', 'missing', 'waiting'];
    this.querySelector('[data-score-bar]')!.replaceChildren(
      ...order.flatMap((s) =>
        count(s)
          ? [
              Object.assign(document.createElement('span'), {
                style: `flex: ${count(s)} 0 0`,
              }),
            ].map((el) => {
              el.dataset.status = s;
              return el;
            })
          : []
      )
    );
    this.querySelector('[data-counts]')!.replaceChildren(
      ...order.map((s) => {
        const li = document.createElement('li');
        li.textContent = `${STATUS_LABEL[s].icon} ${count(s)} ${STATUS_LABEL[s].label.toLowerCase()}`;
        return li;
      })
    );
  }

  private drawChecks() {
    const checks = this.audit?.checks ?? [];
    const shown = checks.filter((c) =>
      this.filter === 'all'
        ? true
        : this.filter === 'todo'
          ? c.status === 'missing' || c.status === 'improve'
          : c.status === this.filter
    );
    const ordered = this.filter === 'todo' ? priorities(shown) : shown;
    const groups = [...new Set(ordered.map((c) => c.group))];
    this.querySelector<HTMLElement>('[data-empty]')!.hidden =
      ordered.length > 0 || !this.audit;
    this.querySelector('[data-groups]')!.replaceChildren(
      ...groups.map((group) => {
        const section = document.createElement('section');
        section.className = 'group';
        const h2 = document.createElement('h2');
        h2.textContent = group;
        const list = document.createElement('div');
        list.className = 'group-list';
        list.append(
          ...ordered.filter((c) => c.group === group).map((c) => this.card(c))
        );
        section.append(h2, list);
        return section;
      })
    );
  }

  private card(check: Check): HTMLElement {
    const el = (tag: string, cls = '', text = '') => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text) node.textContent = text;
      return node;
    };
    const card = el('article', 'card check');
    card.id = check.id;
    card.dataset.status = check.status;

    const head = el('header', 'check-head');
    const badge = el('span', 'badge');
    badge.dataset.status = check.status;
    const icon = el('span', 'badge-icon', STATUS_LABEL[check.status].icon);
    icon.setAttribute('aria-hidden', 'true');
    badge.append(icon, STATUS_LABEL[check.status].label);
    head.append(
      el('h3', '', check.title),
      badge,
      el('span', 'impact', IMPACT_LABEL[check.impact])
    );
    card.append(head, el('p', 'evidence', check.evidence));

    if (check.why) {
      const why = el('p', 'why');
      why.append(el('strong', '', 'Why it matters: '), check.why);
      card.append(why);
    }
    if (check.recommendation) {
      const todo = el('p', 'todo');
      todo.append(el('strong', '', 'What to do: '), check.recommendation);
      card.append(todo);
    }
    for (const fix of check.fixes) {
      const box = el('details', 'fix') as HTMLDetailsElement;
      const summary = el('summary', 'fix-summary');
      summary.append(
        fix.path
          ? `Show the fix: add ${fix.path}`
          : fix.language === 'shell'
            ? 'Show the command'
            : 'Show the snippet'
      );
      const bar = el('div', 'fix-head');
      const label = el('span');
      if (fix.path) {
        label.append('Add ', el('code', '', fix.path));
      } else {
        label.textContent =
          fix.language === 'shell' ? 'Run' : 'Add to the workflow';
      }
      const copy = el('button', 'copy', 'Copy');
      (copy as HTMLButtonElement).type = 'button';
      copy.dataset.copy = '';
      copy.setAttribute(
        'aria-label',
        `Copy ${fix.path || (fix.language === 'shell' ? 'the command' : 'the snippet')}`
      );
      bar.append(label, copy);
      const pre = el('pre');
      const code = el('code', 'fix-code', fix.content);
      code.dataset.language = fix.language;
      pre.append(code);
      box.append(summary, bar, pre);
      card.append(box);
    }
    if (check.docs) {
      const docs = el('p', 'docs');
      const a = el('a', '', 'Documentation') as HTMLAnchorElement;
      a.href = check.docs;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      docs.append(a);
      card.append(docs);
    }
    return card;
  }
}

if (!customElements.get(AuditPageComponent.tagName)) {
  customElements.define(AuditPageComponent.tagName, AuditPageComponent);
}
