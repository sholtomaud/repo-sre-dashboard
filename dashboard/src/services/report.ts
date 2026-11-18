/**
 * The repository's profile, CI health, delivery metrics, issues by class
 * and the best-practice audit, read from status.json; and the next steps
 * the overview suggests. DOM-free; unit-tested with `node --test`.
 */

export type CheckStatus = 'pass' | 'improve' | 'missing' | 'waiting';
export type Impact = 'high' | 'medium' | 'low';
const STATUSES: CheckStatus[] = ['pass', 'improve', 'missing', 'waiting'];
const IMPACTS: Impact[] = ['high', 'medium', 'low'];

export interface Fix {
  path: string;
  language: string;
  content: string;
}

export interface Check {
  id: string;
  group: string;
  title: string;
  kind: 'setup' | 'habit';
  impact: Impact;
  status: CheckStatus;
  evidence: string;
  why: string;
  recommendation: string;
  fixes: Fix[];
  docs: string;
}

export interface Audit {
  score: number | null;
  passed: number;
  judged: number;
  waiting: number;
  checks: Check[];
}

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : null;
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const https = (v: unknown) => (str(v).startsWith('https://') ? str(v) : '');

/** The `audit` block of status.json, or `null` if absent. */
export function parseAudit(status: unknown): Audit | null {
  const raw = obj(obj(status)?.audit);
  if (!raw || !Array.isArray(raw.checks)) return null;
  const checks: Check[] = raw.checks
    .map(obj)
    .filter((c): c is Raw => !!c && !!str(c.id) && !!str(c.title))
    .map((c) => ({
      id: str(c.id),
      group: str(c.group) || 'Other',
      title: str(c.title),
      kind: c.kind === 'habit' ? 'habit' : 'setup',
      impact: IMPACTS.includes(c.impact as Impact)
        ? (c.impact as Impact)
        : 'low',
      status: STATUSES.includes(c.status as CheckStatus)
        ? (c.status as CheckStatus)
        : 'waiting',
      evidence: str(c.evidence),
      why: str(c.why),
      recommendation: str(c.recommendation),
      fixes: (Array.isArray(c.fixes) ? c.fixes : [])
        .map(obj)
        .filter((f): f is Raw => !!f && !!str(f.content))
        .map((f) => ({
          path: str(f.path),
          language: str(f.language) || 'text',
          content: str(f.content),
        })),
      docs: https(c.docs),
    }));
  return {
    score: num(raw.score),
    passed: num(raw.passed) ?? checks.filter((c) => c.status === 'pass').length,
    judged:
      num(raw.judged) ?? checks.filter((c) => c.status !== 'waiting').length,
    waiting:
      num(raw.waiting) ?? checks.filter((c) => c.status === 'waiting').length,
    checks,
  };
}

const IMPACT_ORDER: Record<Impact, number> = { high: 0, medium: 1, low: 2 };
const STATUS_ORDER: Record<CheckStatus, number> = {
  missing: 0,
  improve: 1,
  waiting: 2,
  pass: 3,
};

/** Checks to act on, most valuable first: impact, then how far off. */
export function priorities(checks: Check[]): Check[] {
  return checks
    .filter((c) => c.status === 'missing' || c.status === 'improve')
    .sort(
      (a, b) =>
        IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact] ||
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    );
}

export interface RepoProfile {
  description: string;
  defaultBranch: string;
  createdAt: string | null;
  pushedAt: string | null;
  visibility: string;
  stars: number;
  forks: number;
  license: string | null;
  languages: { name: string; share: number }[];
  files: number;
  testFiles: number;
  truncated: boolean;
  ecosystems: string[];
  workflows: { name: string; onPullRequest: boolean; runsTests: boolean }[];
  protected: boolean | null;
}

export function parseRepo(status: unknown): RepoProfile | null {
  const raw = obj(obj(status)?.repo);
  if (!raw) return null;
  const branch = obj(raw.branch);
  return {
    description: str(raw.description),
    defaultBranch: str(raw.default_branch) || 'main',
    createdAt: str(raw.created_at) || null,
    pushedAt: str(raw.pushed_at) || null,
    visibility: str(raw.visibility),
    stars: num(raw.stars) ?? 0,
    forks: num(raw.forks) ?? 0,
    license: str(raw.license) || null,
    languages: (Array.isArray(raw.languages) ? raw.languages : [])
      .map(obj)
      .filter((l): l is Raw => !!l && !!str(l.name))
      .map((l) => ({ name: str(l.name), share: num(l.share) ?? 0 })),
    files: num(raw.files) ?? 0,
    testFiles: num(raw.test_files) ?? 0,
    truncated: raw.files_truncated === true,
    ecosystems: (Array.isArray(raw.ecosystems) ? raw.ecosystems : []).map(
      String
    ),
    workflows: (Array.isArray(raw.workflows) ? raw.workflows : [])
      .map(obj)
      .filter((w): w is Raw => !!w)
      .map((w) => ({
        name: str(w.name) || str(w.path),
        onPullRequest: w.on_pull_request === true,
        runsTests: w.runs_tests === true,
      })),
    protected: typeof branch?.protected === 'boolean' ? branch.protected : null,
  };
}

export interface CiHealth {
  windowDays: number;
  runs: number;
  failed: number;
  successRate: number | null;
  medianMinutes: number | null;
  medianHoursToGreen: number | null;
  failingNow: string[];
}

export function parseCi(status: unknown): CiHealth | null {
  const raw = obj(obj(status)?.ci);
  if (!raw) return null;
  return {
    windowDays: num(raw.window_days) ?? 30,
    runs: num(raw.runs) ?? 0,
    failed: num(raw.failed) ?? 0,
    successRate: num(raw.success_rate),
    medianMinutes: num(raw.median_minutes),
    medianHoursToGreen: num(raw.median_hours_to_green),
    failingNow: (Array.isArray(raw.failing_now) ? raw.failing_now : []).map(
      String
    ),
  };
}

export type Band = 'elite' | 'high' | 'medium' | 'low';
const BANDS: Band[] = ['elite', 'high', 'medium', 'low'];

export interface DeliveryMetric {
  value: number | null;
  band: Band | null;
  count: number;
  basis: string;
}

export interface Delivery {
  windowDays: number;
  source: 'deployments' | 'releases' | 'merges';
  frequency: DeliveryMetric;
  leadTimeHours: DeliveryMetric;
  failureRate: DeliveryMetric;
  restoreHours: DeliveryMetric;
}

function metric(value: unknown): DeliveryMetric {
  const raw = obj(value) ?? {};
  return {
    value: num(raw.value),
    band: BANDS.includes(raw.band as Band) ? (raw.band as Band) : null,
    count: num(raw.count) ?? 0,
    basis: str(raw.basis),
  };
}

export function parseDelivery(status: unknown): Delivery | null {
  const raw = obj(obj(status)?.delivery);
  if (!raw) return null;
  const source = str(raw.source);
  return {
    windowDays: num(raw.window_days) ?? 30,
    source:
      source === 'deployments' || source === 'releases' ? source : 'merges',
    frequency: metric(raw.deployment_frequency),
    leadTimeHours: metric(raw.lead_time_hours),
    failureRate: metric(raw.change_failure_rate),
    restoreHours: metric(raw.time_to_restore_hours),
  };
}

export const CLASSES = ['security', 'bug', 'other'] as const;
export type IssueClass = (typeof CLASSES)[number];

export interface ClassFacts {
  total: number;
  open: number;
  overLimit: number;
  limitDays: number;
  oldestOpenDays: number | null;
  medianOpenAgeDays: number | null;
  windowDays: number;
  openedRecent: number;
  closedRecent: number;
  closedRecentByAgents: number;
  closedRecentWithFix: number;
  resolvedRecent: number;
  resolvedWithinLimit: number;
  medianDaysToResolve: number | null;
}

export function parseClasses(
  status: unknown
): Record<IssueClass, ClassFacts> | null {
  const raw = obj(obj(status)?.classes);
  if (!raw) return null;
  const facts = (value: unknown): ClassFacts => {
    const c = obj(value) ?? {};
    return {
      total: num(c.total) ?? num(c.open) ?? 0,
      open: num(c.open) ?? 0,
      overLimit: num(c.over_limit) ?? 0,
      limitDays: num(c.limit_days) ?? 0,
      oldestOpenDays: num(c.oldest_open_days),
      medianOpenAgeDays: num(c.median_open_age_days),
      windowDays: num(c.window_days) ?? 30,
      openedRecent: num(c.opened_recent) ?? 0,
      closedRecent: num(c.closed_recent) ?? 0,
      closedRecentByAgents: num(c.closed_recent_by_agents) ?? 0,
      closedRecentWithFix: num(c.closed_recent_with_fix) ?? 0,
      resolvedRecent: num(c.resolved_recent) ?? 0,
      resolvedWithinLimit: num(c.resolved_within_limit) ?? 0,
      medianDaysToResolve: num(c.median_days_to_resolve),
    };
  };
  return Object.fromEntries(CLASSES.map((c) => [c, facts(raw[c])])) as Record<
    IssueClass,
    ClassFacts
  >;
}

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

export interface Finding {
  tone: Tone;
  text: string;
  /** Where to read more: an anchor on the page or the audit. */
  href: string;
}

/**
 * The few facts that most need attention, in plain words: issues past
 * their limits, a red default branch, a backlog outgrowing the team, and
 * the audit's top fixes.
 */
export function findings(input: {
  classes: Record<IssueClass, ClassFacts> | null;
  ci: CiHealth | null;
  flowRatio: number | null;
  audit: Audit | null;
  limit?: number;
}): Finding[] {
  const out: Finding[] = [];
  const { classes, ci, flowRatio, audit } = input;
  const names: Record<IssueClass, string> = {
    security: 'security issue',
    bug: 'bug',
    other: 'feature request or other issue',
  };
  for (const c of CLASSES) {
    const f = classes?.[c];
    if (f && f.overLimit > 0) {
      out.push({
        tone: c === 'other' ? 'warn' : 'bad',
        text: `${f.overLimit} open ${names[c]}${f.overLimit === 1 ? ' is' : 's are'} older than the ${formatLimit(f.limitDays)} limit.`,
        href: '#issues',
      });
    }
  }
  if (ci && ci.failingNow.length) {
    out.push({
      tone: 'bad',
      text: `CI is failing on the default branch: ${ci.failingNow.join(', ')}.`,
      href: '#delivery',
    });
  }
  if (flowRatio !== null && flowRatio > 1.2) {
    out.push({
      tone: 'warn',
      text: `Issues are arriving ${flowRatio === Infinity ? 'with none being closed' : `${flowRatio.toFixed(1)}× faster than they are closed`}: the backlog is growing.`,
      href: '#outlook',
    });
  }
  for (const check of priorities(audit?.checks ?? []).slice(0, 3)) {
    out.push({
      tone: check.status === 'missing' ? 'bad' : 'warn',
      text: check.recommendation || `${check.title}: ${check.evidence}`,
      href: `/audit#${check.id}`,
    });
  }
  return out.slice(0, input.limit ?? 5);
}

/** `7 days`, `12 hours`. */
export function formatLimit(days: number): string {
  if (days < 1) return `${Math.round(days * 24)}-hour`;
  return `${Number.isInteger(days) ? days : days.toFixed(1)}-day`;
}
