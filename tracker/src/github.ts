/**
 * A small GitHub API client for the tracker: REST and GraphQL over fetch,
 * with the token the workflow provides. Retries once on rate limits and
 * server errors.
 */

export interface GitHubClient {
  /** A REST GET; the path starts with `/`. `null` on 404. */
  rest<T>(path: string): Promise<T | null>;
  /** Every page of a REST list (per_page=100), up to `limit` items. */
  restAll<T>(path: string, limit?: number): Promise<T[]>;
  graphql<T>(query: string, variables: Record<string, unknown>): Promise<T>;
  /** A REST write (POST, PATCH); throws on any HTTP error. */
  send<T>(method: string, path: string, body: unknown): Promise<T>;
}

export interface ClientOptions {
  token: string;
  /** e.g. https://api.github.com, or a GitHub Enterprise Server API URL. */
  apiUrl?: string;
  fetchImpl?: typeof fetch;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createClient({
  token,
  apiUrl = 'https://api.github.com',
  fetchImpl = fetch,
}: ClientOptions): GitHubClient {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'repo-sre-dashboard',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  async function request(
    url: string,
    init: RequestInit = {}
  ): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const response = await fetchImpl(url, {
        ...init,
        headers: { ...headers, ...init.headers },
      });
      const retryable =
        response.status >= 500 ||
        response.status === 429 ||
        (response.status === 403 &&
          response.headers.get('x-ratelimit-remaining') === '0');
      if (!retryable || attempt >= 1) return response;
      const reset = Number(response.headers.get('retry-after') ?? 5);
      await sleep(Math.min(Math.max(reset, 1), 60) * 1000);
    }
  }

  async function rest<T>(path: string): Promise<T | null> {
    const response = await request(`${apiUrl}${path}`);
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`GitHub API ${path}: HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async function restAll<T>(path: string, limit = 10_000): Promise<T[]> {
    const items: T[] = [];
    const join = path.includes('?') ? '&' : '?';
    for (let page = 1; items.length < limit; page++) {
      const batch = await rest<T[]>(`${path}${join}per_page=100&page=${page}`);
      if (!batch || batch.length === 0) break;
      items.push(...batch);
      if (batch.length < 100) break;
    }
    return items.slice(0, limit);
  }

  async function graphql<T>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<T> {
    const response = await request(`${apiUrl.replace(/\/v3$/, '')}/graphql`, {
      method: 'POST',
      body: JSON.stringify({ query, variables }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok)
      throw new Error(`GitHub GraphQL: HTTP ${response.status}`);
    const payload = (await response.json()) as {
      data?: T;
      errors?: { message: string }[];
    };
    if (payload.errors?.length) {
      throw new Error(
        `GitHub GraphQL: ${payload.errors.map((e) => e.message).join('; ')}`
      );
    }
    return payload.data as T;
  }

  async function send<T>(
    method: string,
    path: string,
    body: unknown
  ): Promise<T> {
    const response = await request(`${apiUrl}${path}`, {
      method,
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`GitHub API ${method} ${path}: HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }

  return { rest, restAll, graphql, send };
}
