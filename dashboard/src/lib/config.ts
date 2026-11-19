/**
 * What the dashboard shows, from data/config.json, written by the Action's
 * tracker for the repository it runs in.
 */
import {
  DEFAULT_LIMITS,
  type CostConfig,
  type IssueClass,
  type Limits,
} from '../services/outlook.ts';

export interface QueueConfig {
  /** e.g. "Agents' own queue". */
  name: string;
  repository: string;
  openDir: string;
  resolvedDir: string;
}

export interface DashboardConfig {
  /** owner/name */
  repository: string;
  repositoryUrl: string;
  issuesUrl: string;
  title: string;
  /** A file-based queue alongside the issues, if the Action is given one. */
  queue: QueueConfig | null;
  /** An optional note on why this repository is tracked. */
  why: { text: string; url: string } | null;
  /** How long a new issue may wait, in days, by class. */
  limits: Limits;
  /** Prices for the cost figures, or `null` until the user sets them. */
  cost: CostConfig | null;
}

/** The Action itself, linked from the methodology page. */
export const PROJECT_URL = 'https://github.com/sholtomaud/repo-sre-dashboard';
/** The data files, relative to the dashboard's base URL. */
export const DATA_CSV_PATH = 'data/data.csv';

export const DEFAULT_CONFIG: DashboardConfig = {
  repository: 'this repository',
  repositoryUrl: '',
  issuesUrl: '',
  title: 'Repository health',
  queue: null,
  why: null,
  limits: DEFAULT_LIMITS,
  cost: null,
};

/** Reads config.json, filling in anything missing. */
export function parseConfig(value: unknown): DashboardConfig {
  const raw = (value ?? {}) as Record<string, unknown>;
  const text = (key: string) =>
    typeof raw[key] === 'string' && raw[key] ? (raw[key] as string) : '';
  const queue = raw.queue as Record<string, unknown> | null | undefined;
  const why = raw.why as Record<string, unknown> | null | undefined;
  const limits = (raw.limits_days ?? {}) as Record<string, unknown>;
  const limit = (key: IssueClass) =>
    typeof limits[key] === 'number' && (limits[key] as number) > 0
      ? (limits[key] as number)
      : DEFAULT_LIMITS[key];
  const cost = raw.cost as Record<string, unknown> | null | undefined;
  const budget = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
  const number = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;
  return {
    repository: text('repository') || DEFAULT_CONFIG.repository,
    repositoryUrl: text('repository_url'),
    issuesUrl: text('issues_url'),
    title: text('title') || DEFAULT_CONFIG.title,
    queue:
      queue && typeof queue.open_dir === 'string'
        ? {
            name: String(queue.name || "Agents' own queue"),
            repository: String(queue.repository ?? ''),
            openDir: String(queue.open_dir),
            resolvedDir: String(queue.resolved_dir ?? ''),
          }
        : null,
    why:
      why && typeof why.text === 'string' && why.text
        ? { text: why.text, url: typeof why.url === 'string' ? why.url : '' }
        : null,
    limits: {
      security: limit('security'),
      bug: limit('bug'),
      other: limit('other'),
    },
    cost: cost
      ? {
          currency: typeof cost.currency === 'string' ? cost.currency : 'USD',
          agentPerIssue: number(cost.agent_per_issue, 0),
          humanHourlyRate: number(cost.human_hourly_rate, 0),
          humanHoursPerIssue: number(cost.human_hours_per_issue, 2),
          // monthly_budget: written by versions before the split.
          monthlyHumanBudget: budget(
            cost.monthly_human_budget ?? cost.monthly_budget
          ),
          monthlyAgenticBudget: budget(cost.monthly_agentic_budget),
        }
      : null,
  };
}

let loading: Promise<DashboardConfig> | null = null;

/** config.json, loaded once per page; the defaults if it is missing. */
export function loadConfig(
  fetchImpl: typeof fetch = fetch,
  url = 'data/config.json'
): Promise<DashboardConfig> {
  loading ??= fetchImpl(url, { cache: 'no-cache' })
    .then((response) => (response.ok ? response.json() : null))
    .then(parseConfig)
    .catch(() => DEFAULT_CONFIG);
  return loading;
}
