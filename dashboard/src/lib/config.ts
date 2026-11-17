/**
 * What the dashboard shows, from data/config.json, written by the Action's
 * tracker for the repository it runs in.
 */

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
}

/** The Action itself, linked from the methodology page. */
export const PROJECT_URL = 'https://github.com/sholtomaud/repo-sre-dashboard';
/** The data files, relative to the dashboard's base URL. */
export const DATA_CSV_PATH = 'data/data.csv';

export const DEFAULT_CONFIG: DashboardConfig = {
  repository: 'this repository',
  repositoryUrl: '',
  issuesUrl: '',
  title: 'Developer Doomsday Clock',
  queue: null,
  why: null,
};

/** Reads config.json, filling in anything missing. */
export function parseConfig(value: unknown): DashboardConfig {
  const raw = (value ?? {}) as Record<string, unknown>;
  const text = (key: string) =>
    typeof raw[key] === 'string' && raw[key] ? (raw[key] as string) : '';
  const queue = raw.queue as Record<string, unknown> | null | undefined;
  const why = raw.why as Record<string, unknown> | null | undefined;
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
