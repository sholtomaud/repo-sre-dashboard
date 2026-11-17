/**
 * The four DORA delivery metrics, from what the repository records:
 *
 * - Deployment frequency: GitHub deployments (other than Pages), else
 *   published releases, else pull requests merged into the default branch.
 * - Lead time for changes: from a pull request being opened to the first
 *   delivery that includes its merge (to the merge itself when merges are
 *   the deliveries).
 * - Change failure rate: failed deployments, when deployments record their
 *   outcome; otherwise the share of merged changes that are reverts or
 *   hotfixes.
 * - Time to restore service: how long issues labelled as incidents stay
 *   open. Without incident labels it is unknown.
 *
 * Each metric is banded as in the DORA research: elite, high, medium, low.
 */
import type { Issue } from './issues.ts';
import type { PullRequest } from './pulls.ts';
import { median, type Profile } from './repo.ts';

const MS_PER_DAY = 86_400_000;
const HOURS = 3_600_000;

export type Band = 'elite' | 'high' | 'medium' | 'low';
export type DeliverySource = 'deployments' | 'releases' | 'merges';

/** Deliveries per day → band. */
export function frequencyBand(perDay: number): Band {
  if (perDay >= 1) return 'elite';
  if (perDay >= 1 / 7) return 'high';
  if (perDay >= 1 / 30) return 'medium';
  return 'low';
}

/** Hours → band, for lead time. */
export function leadTimeBand(hours: number): Band {
  if (hours < 24) return 'elite';
  if (hours < 24 * 7) return 'high';
  if (hours < 24 * 30) return 'medium';
  return 'low';
}

/** Share → band, for change failure rate. */
export function failureBand(rate: number): Band {
  if (rate <= 0.05) return 'elite';
  if (rate <= 0.1) return 'high';
  if (rate <= 0.15) return 'medium';
  return 'low';
}

/** Hours → band, for time to restore. */
export function restoreBand(hours: number): Band {
  if (hours < 1) return 'elite';
  if (hours < 24) return 'high';
  if (hours < 24 * 7) return 'medium';
  return 'low';
}

export interface Metric {
  value: number | null;
  band: Band | null;
  /** How many events the figure rests on. */
  count: number;
  /** Where it comes from, in words. */
  basis: string;
}

export function deliveryMetrics(
  profile: Profile,
  pulls: PullRequest[],
  issues: Issue[],
  now: Date,
  windowDays = 30
) {
  const since = now.getTime() - windowDays * MS_PER_DAY;
  const inWindow = (t: string) => Date.parse(t) >= since;
  const merged = pulls.filter(
    (p) =>
      p.mergedAt &&
      (!p.base || p.base === profile.defaultBranch) &&
      inWindow(p.mergedAt)
  );

  // The deliveries, in time order.
  let source: DeliverySource;
  let deliveries: string[];
  if (profile.deployments.length) {
    source = 'deployments';
    deliveries = profile.deployments.map((d) => d.createdAt);
  } else if (profile.releases.length) {
    source = 'releases';
    deliveries = profile.releases.map((r) => r.publishedAt);
  } else {
    source = 'merges';
    deliveries = pulls
      .filter(
        (p) => p.mergedAt && (!p.base || p.base === profile.defaultBranch)
      )
      .map((p) => p.mergedAt!);
  }
  deliveries.sort();
  const recent = deliveries.filter(inWindow);

  const frequency = recent.length / windowDays;
  const sourceName = {
    deployments: 'deployments',
    releases: 'releases',
    merges: 'pull requests merged to the default branch',
  }[source];

  // Lead time: opened → the first delivery at or after the merge.
  const leads: number[] = [];
  for (const p of merged) {
    const delivered =
      source === 'merges'
        ? p.mergedAt!
        : deliveries.find((d) => d >= p.mergedAt!);
    if (delivered) {
      leads.push((Date.parse(delivered) - Date.parse(p.createdAt)) / HOURS);
    }
  }
  const lead = median(leads);

  // Change failure rate.
  const judgedDeploys = profile.deployments.filter(
    (d) => inWindow(d.createdAt) && d.state && d.state !== 'inactive'
  );
  let failure: Metric;
  if (source === 'deployments' && judgedDeploys.length) {
    const failed = judgedDeploys.filter(
      (d) => d.state === 'failure' || d.state === 'error'
    ).length;
    const rate = failed / judgedDeploys.length;
    failure = {
      value: rate,
      band: failureBand(rate),
      count: judgedDeploys.length,
      basis: 'deployments that failed',
    };
  } else {
    const repairs = merged.filter((p) => p.repair).length;
    const rate = merged.length ? repairs / merged.length : null;
    failure = {
      value: rate,
      band: rate === null ? null : failureBand(rate),
      count: merged.length,
      basis: 'merged changes that are reverts or hotfixes',
    };
  }

  // Time to restore: incidents closed in the window.
  const incidents = issues.filter(
    (i) => i.incident && i.closedAt && inWindow(i.closedAt)
  );
  const restore = median(
    incidents.map(
      (i) => (Date.parse(i.closedAt!) - Date.parse(i.createdAt)) / HOURS
    )
  );
  const labelledIncidents = issues.filter((i) => i.incident).length;

  return {
    window_days: windowDays,
    source,
    deployment_frequency: {
      value: frequency,
      band: recent.length ? frequencyBand(frequency) : 'low',
      count: recent.length,
      basis: sourceName,
    } satisfies Metric,
    lead_time_hours: {
      value: lead,
      band: lead === null ? null : leadTimeBand(lead),
      count: leads.length,
      basis:
        source === 'merges'
          ? 'pull request opened to merged'
          : `pull request opened to the next ${source === 'deployments' ? 'deployment' : 'release'}`,
    } satisfies Metric,
    change_failure_rate: failure,
    time_to_restore_hours: {
      value: restore,
      band: restore === null ? null : restoreBand(restore),
      count: incidents.length,
      basis: labelledIncidents
        ? 'issues labelled as incidents, opened to closed'
        : 'no issues are labelled as incidents',
    } satisfies Metric,
    incidents_labelled: labelledIncidents,
  };
}
