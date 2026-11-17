import { test, expect } from '@playwright/test';

// A fixed data set, so assertions don't depend on the live data.csv.
// Agents have closed 6 of 24 issues: 25% share, 18 hours to midnight.
const CSV = `date,open,agent_closed,human_closed
2026-11-01,10,0,0
2026-11-08,30,6,18
`;

// The tracker last ran at 12:05 on the newest day, so that day counts as
// about half a day: rates are over 6.5 days, not 7.
const STATUS = {
  updated_at: '2026-11-08T12:05:00Z',
  schedule: {
    cron: '5 */6 * * *',
    runs_per_day: 4,
    interval_hours: 6,
    description: 'every 6 hours',
    run_times_utc: ['00:05', '06:05', '12:05', '18:05'],
  },
};

// The same data with the closure and behaviour columns the tracker now
// writes, the open-issue breakdown, and the agents' own queue.
const DETAIL_CSV = `date,open,agent_closed,human_closed,closed_fix_referenced,closed_no_reference,closed_declined,closed_withdrawn,closed_duplicate,behavior_created,behavior_closed
2026-11-01,10,0,0,0,0,0,0,0,8,0
2026-11-08,30,6,18,3,12,6,2,1,40,20
`;
const DETAIL_STATUS = {
  ...STATUS,
  issues: {
    source: 'graphql',
    open: 30,
    open_labelled: 2,
    open_by_kind: { behavior: 20, feature: 4, other: 6 },
  },
};
const QUEUE_CSV = `date,open,resolved
2026-11-01,100,1000
2026-11-08,86,1700
`;

const withFixture = async (page, body = CSV, status = 200, json = STATUS) => {
  await page.route('**/data/agent_queue.csv', (route) =>
    route.fulfill({ body: QUEUE_CSV, contentType: 'text/csv' })
  );
  await page.route('**/data/data.csv', (route) =>
    route.fulfill({ status, body, contentType: 'text/csv' })
  );
  await page.route('**/data/status.json', (route) =>
    json ? route.fulfill({ json }) : route.fulfill({ status: 404 })
  );
};

// Requests made by the service worker would bypass page.route().
test.use({ serviceWorkers: 'block' });

test('has title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Repo SRE Dashboard/);
});

test('trend chart: crosshair tooltip and legend toggles', async ({ page }) => {
  await withFixture(page);
  await page.goto('/');
  const chart = page.locator('trend-chart[data-trend="public"]');
  const tooltip = chart.locator('[data-tooltip]');

  const plot = chart.locator('[data-plot] rect[tabindex]');
  await plot.focus();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Nov 8, 2026');
  await page.keyboard.press('ArrowLeft');
  await expect(tooltip).toContainText('Nov 1, 2026');
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();

  const open = chart.getByRole('button', { name: 'Open issues' });
  await open.click();
  await expect(open).toHaveAttribute('aria-pressed', 'false');
  await plot.hover();
  await expect(tooltip).not.toContainText('Open issues');
  await open.click();
  await expect(open).toHaveAttribute('aria-pressed', 'true');
});

test('closure evidence and issue types', async ({ page }) => {
  await withFixture(page, DETAIL_CSV, 200, DETAIL_STATUS);
  await page.goto('/');

  const evidence = page.locator('closure-evidence');
  await expect(evidence.locator('[data-referenced]')).toHaveText('3 of 24');
  await expect(evidence.locator('[data-evidence-legend] li')).toHaveText([
    '3Fix referenced',
    '12Closed without a referenced fix',
    '6Declined (not planned)',
    '2Withdrawn by the reporter',
    '1Duplicate',
  ]);
  await expect(evidence.locator('[data-kind-legend] li').first()).toHaveText(
    '20Bug reports'
  );
  await expect(evidence.locator('[data-labelled]')).toContainText(
    '2 of 30 open issues carry a label'
  );
});

test('older data without closure details shows a note instead', async ({
  page,
}) => {
  await withFixture(page);
  await page.goto('/');
  await expect(page.locator('closure-evidence [data-empty]')).toBeVisible();
});

test('the agents\u2019 queue has its own trend chart', async ({ page }) => {
  await withFixture(page);
  await page.goto('/');
  const chart = page.locator('trend-chart[data-trend="agents"]');
  await expect(chart.getByRole('button').first()).toHaveText('Open issues');
  await expect(chart.locator('thead th').nth(2)).toHaveText(
    'Resolved by AI agents'
  );
  await expect(chart.locator('tbody tr')).toHaveCount(2);
});

test('the page still works when the agent queue is missing', async ({
  page,
}) => {
  await withFixture(page);
  await page.route('**/data/agent_queue.csv', (route) =>
    route.fulfill({ status: 404 })
  );
  await page.goto('/');
  await expect(page.locator('[data-queue-trend]')).toBeHidden();
  await expect(page.locator('[data-kpi="Open issues"]')).toContainText('30');
});

test('works without status.json, treating the newest day as complete', async ({
  page,
}) => {
  await withFixture(page, CSV, 200, null);
  await page.goto('/');
  await expect(page.locator('[data-as-of]')).toHaveText(
    'Data as of Nov 8, 2026 (UTC)'
  );
  // Without status.json, the panels built from it stay hidden.
  await expect(page.locator('delivery-panel')).toBeHidden();
  await expect(page.locator('[data-kpi="Open issues"]')).toContainText('30');
});

test('methodology shows the schedule from status.json', async ({ page }) => {
  await withFixture(page);
  await page.goto('/methodology');
  await expect(page.locator('methodology-page [data-schedule]')).toHaveText(
    'every 6 hours (00:05, 06:05, 12:05, 18:05 UTC)'
  );
  await expect(
    page.getByRole('heading', { name: 'Why this repository?' })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Why a referenced fix is the test' })
  ).toBeVisible();
  for (const name of ['Delivery', 'CI health', 'Codebase', 'The audit']) {
    await expect(
      page.getByRole('heading', { name, exact: true })
    ).toBeVisible();
  }
  await expect(page.locator('methodology-page')).not.toContainText(
    /doom|clock/i
  );
});

test('shows an error when data.csv cannot be loaded', async ({ page }) => {
  await withFixture(page, '', 500);
  await page.goto('/');
  await expect(page.locator('[data-as-of]')).toContainText('HTTP 500');
});

test('nav links navigate without reloading and mark the current page', async ({
  page,
}) => {
  await withFixture(page);
  await page.goto('/');
  await page.evaluate(() => (window.stillSamePage = true));

  const nav = page.locator('app-nav [data-nav]');
  await nav.getByRole('link', { name: 'Methodology' }).click();
  await expect(page).toHaveURL('/methodology');
  await expect(page.locator('methodology-page h1')).toHaveText(
    'How the numbers are calculated'
  );
  await expect(nav.getByRole('link', { name: 'Methodology' })).toHaveAttribute(
    'aria-current',
    'page'
  );

  await nav.getByRole('link', { name: 'Audit' }).click();
  await expect(page).toHaveURL('/audit');
  await expect(page.locator('audit-page h1')).toHaveText('Audit');

  await nav.getByRole('link', { name: 'Methodology' }).click();
  await page.getByRole('link', { name: '← Back to the dashboard' }).click();
  await expect(page.locator('dashboard-page')).toBeVisible();
  expect(await page.evaluate(() => window.stillSamePage)).toBe(true);
});

test('unknown routes show the not-found page', async ({ page }) => {
  await withFixture(page);
  await page.goto('/no/such/page');
  await expect(page.locator('not-found-page')).toContainText('Page Not Found');
  await page.getByRole('link', { name: 'Go back home' }).click();
  await expect(page.locator('dashboard-page')).toBeVisible();
});

test('is installable: manifest and icons resolve', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const href = await page
    .locator('link[rel="manifest"]')
    .evaluate((l) => l.href);
  const manifest = await (await request.get(href)).json();
  expect(manifest.name).toBe('Repo SRE Dashboard');
  for (const icon of manifest.icons) {
    expect((await request.get(new URL(icon.src, href).href)).ok()).toBe(true);
  }
});

test('deep links work with a trailing slash, as GitHub Pages serves them', async ({
  page,
}) => {
  await withFixture(page);
  await page.goto('/methodology/');
  await expect(page.locator('methodology-page h1')).toHaveText(
    'How the numbers are calculated'
  );
});

/** A data.csv with the per-class columns the tracker writes. */
function classCsv(days, perDay, backlog = {}) {
  const classes = ['security', 'bug', 'other'];
  const header = [
    'date',
    'open',
    'agent_closed',
    'human_closed',
    ...classes.flatMap((c) => [
      `${c}_opened_by_agents`,
      `${c}_opened_by_humans`,
      `${c}_closed_by_agents`,
      `${c}_closed_by_humans`,
    ]),
  ];
  const lines = [header.join(',')];
  for (let d = 0; d < days; d++) {
    const date = new Date(Date.UTC(2026, 9, 1 + d)).toISOString().slice(0, 10);
    const cells = classes.flatMap((c) =>
      perDay[c].map((x, i) => x * (d + 1) + (i === 1 ? (backlog[c] ?? 0) : 0))
    );
    const opened = classes.reduce(
      (s, c, k) => s + cells[k * 4] + cells[k * 4 + 1],
      0
    );
    const agents = classes.reduce((s, c, k) => s + cells[k * 4 + 2], 0);
    const humans = classes.reduce((s, c, k) => s + cells[k * 4 + 3], 0);
    lines.push(
      [date, opened - agents - humans, agents, humans, ...cells].join(',')
    );
  }
  return lines.join('\n');
}

test('the project outlook shows a repository that has lost control', async ({
  page,
}) => {
  // Security issues are filed and never resolved: past the 7-day limit.
  const body = classCsv(21, {
    security: [0, 1, 0, 0],
    bug: [0, 2, 1, 1],
    other: [0, 1, 0, 1],
  });
  await withFixture(page, body, 200, STATUS);
  await page.goto('/');
  const outlook = page.locator('outlook-panel');
  await expect(outlook.locator('[data-index]')).toHaveText('0%', {
    timeout: 20000,
  });
  await expect(outlook.locator('[data-state-label]')).toHaveText(
    'Control already lost'
  );
  await expect(outlook.locator('[data-doom-all]')).toHaveText('Now');
  const security = outlook.locator('tr[data-class="security"]');
  await expect(security.locator('td').last()).toHaveText('✕ Over limit');
  await expect(security.locator('td').nth(4)).toHaveText('7 days');
  await expect(outlook.locator('tr[data-class="bug"] td').last()).toHaveText(
    '✓ Within limit'
  );
  await expect(outlook.locator('[data-cost]')).toContainText(
    'set the agent-cost-per-issue'
  );
});

test('the outlook waits for data with issue classes', async ({ page }) => {
  await withFixture(page);
  await page.goto('/');
  await expect(page.locator('outlook-panel [data-pending]')).toHaveText(
    'The outlook appears after the next tracker run, which records each class of issue.'
  );
});

test('pull requests are shown by who wrote them', async ({ page }) => {
  await withFixture(page, CSV, 200, {
    ...STATUS,
    pulls: {
      window_days: 30,
      total: 10,
      by_origin: {
        agent: {
          opened: 4,
          merged: 2,
          closed_unmerged: 1,
          still_open: 1,
          merge_rate: 0.667,
          median_hours_to_merge: 5,
        },
        assisted: {
          opened: 2,
          merged: 2,
          closed_unmerged: 0,
          still_open: 0,
          merge_rate: 1,
          median_hours_to_merge: 20,
        },
        human: {
          opened: 4,
          merged: 4,
          closed_unmerged: 0,
          still_open: 0,
          merge_rate: 1,
          median_hours_to_merge: 30,
        },
      },
      agents: { Copilot: 4, Claude: 2 },
    },
  });
  await page.goto('/');
  const panel = page.locator('pull-panel');
  await expect(panel).toBeVisible();
  // 2 by agents and 2 assisted, of 8 merged.
  await expect(panel.locator('[data-share]')).toHaveText('50.0%');
  await expect(panel.locator('tr[data-origin="agent"] td').nth(4)).toHaveText(
    '66.7%'
  );
  await expect(
    panel.locator('tr[data-origin="assisted"] td').nth(5)
  ).toHaveText('20 h');
  await expect(panel.locator('[data-agents]')).toHaveText(
    'Agents seen: Copilot 4 · Claude 2.'
  );
});

test('the pull request panel is hidden without pull request data', async ({
  page,
}) => {
  await withFixture(page);
  await page.goto('/');
  await expect(page.locator('pull-panel')).toBeHidden();
});

/** status.json with every block the tracker writes for the overview. */
const fix = (id, status, impact, group = 'Supply chain and security') => ({
  id,
  group,
  title: `Check ${id}`,
  kind: 'setup',
  impact,
  status,
  evidence: `Evidence for ${id}`,
  why: `Why ${id} matters`,
  recommendation: status === 'pass' ? '' : `Do ${id}`,
  fixes:
    status === 'pass'
      ? []
      : [
          {
            path: `.github/${id}.yml`,
            language: 'yaml',
            content: `name: ${id}\n`,
          },
        ],
  docs: 'https://docs.github.com/en',
});
const REPORT = {
  ...DETAIL_STATUS,
  responses: {
    windowDays: 30,
    firstResponse: { count: 5, medianHours: 3, p90Hours: 20 },
    resolution: { count: 24, medianHours: 50, p90Hours: 200 },
    awaitingResponse: 4,
  },
  classes: {
    security: {
      total: 3,
      open: 2,
      over_limit: 1,
      limit_days: 7,
      oldest_open_days: 12,
      window_days: 30,
      opened_recent: 3,
      closed_recent: 1,
      closed_recent_by_agents: 1,
      closed_recent_with_fix: 1,
      resolved_recent: 1,
      resolved_within_limit: 1,
      median_days_to_resolve: 2,
    },
    bug: {
      total: 20,
      open: 20,
      over_limit: 0,
      limit_days: 30,
      window_days: 30,
    },
    other: {
      total: 8,
      open: 8,
      over_limit: 0,
      limit_days: 180,
      window_days: 30,
    },
  },
  ci: {
    window_days: 30,
    runs: 20,
    failed: 2,
    success_rate: 0.9,
    median_minutes: 12,
    median_hours_to_green: 3,
    failing_now: ['Lint'],
  },
  delivery: {
    window_days: 30,
    source: 'releases',
    deployment_frequency: {
      value: 0.2,
      band: 'high',
      count: 6,
      basis: 'releases',
    },
    lead_time_hours: {
      value: 30,
      band: 'high',
      count: 9,
      basis: 'pull request opened to the next release',
    },
    change_failure_rate: {
      value: 0.04,
      band: 'elite',
      count: 25,
      basis: 'merged changes that are reverts or hotfixes',
    },
    time_to_restore_hours: {
      value: null,
      band: null,
      count: 0,
      basis: 'no issues are labelled as incidents',
    },
  },
  repo: {
    description: 'A test project.',
    default_branch: 'main',
    visibility: 'public',
    stars: 5,
    forks: 1,
    license: 'MIT',
    languages: [
      { name: 'TypeScript', share: 0.8 },
      { name: 'Shell', share: 0.2 },
    ],
    files: 120,
    test_files: 30,
    ecosystems: ['npm'],
    workflows: [{ name: 'CI', on_pull_request: true, runs_tests: true }],
    branch: { protected: false },
  },
  audit: {
    score: 55,
    passed: 1,
    judged: 3,
    waiting: 1,
    checks: [
      fix('dependency-updates', 'missing', 'high'),
      fix('pinned-actions', 'improve', 'medium'),
      fix('tests', 'pass', 'high', 'Code and CI'),
      fix('labels', 'waiting', 'medium', 'Issues and triage'),
    ],
  },
};

test('the overview gives key figures and what needs attention', async ({
  page,
}) => {
  await withFixture(page, DETAIL_CSV, 200, REPORT);
  await page.goto('/');
  await expect(page.locator('[data-lede]')).toHaveText('A test project.');
  const kpi = (name) => page.locator(`[data-kpi="${name}"]`);
  await expect(kpi('Open issues')).toContainText('30');
  await expect(kpi('Time to resolve')).toContainText('2.1 days');
  await expect(kpi('Time to resolve')).toContainText('1 open past its limit');
  await expect(kpi('Time to first response')).toContainText(
    '4 open with no reply'
  );
  await expect(kpi('Resolved by AI agents')).toContainText('25.0%');
  await expect(kpi('Closures with a linked fix')).toContainText('12.5%');
  await expect(kpi('Deployment frequency')).toContainText('1.4 a week');
  await expect(kpi('Deployment frequency')).toContainText('DORA high');
  await expect(kpi('Best-practice audit')).toContainText('55/100');

  const findings = page.locator('[data-findings] li');
  await expect(findings.nth(0)).toHaveText(
    '✕1 open security issue is older than the 7-day limit.'
  );
  await expect(findings.nth(1)).toContainText(
    'CI is failing on the default branch: Lint'
  );
  await expect(
    findings.filter({ hasText: 'Do dependency-updates' })
  ).toHaveAttribute('data-tone', 'bad');
  await findings
    .filter({ hasText: 'Do dependency-updates' })
    .getByRole('link')
    .click();
  await expect(page).toHaveURL('/audit#dependency-updates');
  await expect(
    page.locator('audit-page #dependency-updates details')
  ).toHaveAttribute('open', '');
});

test('issues by class, delivery and the codebase', async ({ page }) => {
  await withFixture(page, DETAIL_CSV, 200, REPORT);
  await page.goto('/');
  const security = page.locator('class-table tr[data-class="security"]');
  await expect(security.locator('th')).toContainText('7-day limit');
  await expect(security.locator('td').nth(1)).toHaveText('1');
  await expect(security.locator('td').nth(1)).toHaveAttribute(
    'data-tone',
    'bad'
  );

  const delivery = page.locator('delivery-panel');
  await expect(delivery).toBeVisible();
  await expect(delivery).toContainText('Deliveries are releases.');
  const lead = delivery.locator('[data-metric="Lead time for changes"]');
  await expect(lead.locator('.metric-value')).toHaveText('30 h');
  await expect(lead.locator('[aria-current="true"]')).toHaveText('High');
  await expect(
    delivery.locator('[data-metric="Time to restore service"]')
  ).toContainText('Label incidents to measure it');
  await expect(delivery.locator('[data-ci]')).toContainText('90.0%');
  await expect(delivery.locator('[data-ci]')).toContainText('Lint');

  const profile = page.locator('repo-profile');
  await expect(profile.locator('[data-languages]')).toHaveAttribute(
    'aria-label',
    'Languages: TypeScript 80%, Shell 20%'
  );
  await expect(profile.locator('[data-facts]')).toContainText('25% of files');
  await expect(profile.locator('[data-facts]')).toContainText('not protected');
});

test('the audit filters checks and copies fixes', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await withFixture(page, DETAIL_CSV, 200, REPORT);
  await page.goto('/audit');
  const audit = page.locator('audit-page');
  await expect(audit.locator('[data-score]')).toHaveText('55');
  await expect(audit.locator('[data-score-line]')).toHaveText(
    '1 of 3 checks pass · 2 to do · 1 waiting for data'
  );
  // To do: most valuable first.
  await expect(audit.locator('.check h3')).toHaveText([
    'Check dependency-updates',
    'Check pinned-actions',
  ]);
  const card = audit.locator('#dependency-updates');
  await expect(card.locator('.badge')).toHaveText('✕Missing');
  await expect(card).toContainText(
    'Why it matters: Why dependency-updates matters'
  );
  const details = card.locator('details.fix');
  await expect(details).not.toHaveAttribute('open', '');
  await details.locator('summary').click();
  await card
    .getByRole('button', { name: 'Copy .github/dependency-updates.yml' })
    .click();
  await expect(card.getByRole('button', { name: /Copy/ })).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'name: dependency-updates\n'
  );

  await audit.getByRole('button', { name: 'Passing' }).click();
  await expect(audit.locator('.check h3')).toHaveText(['Check tests']);
  await expect(audit.locator('#tests details')).toHaveCount(0);
  await audit.getByRole('button', { name: 'Waiting for data' }).click();
  await expect(audit.locator('.check h3')).toHaveText(['Check labels']);
  await audit.getByRole('button', { name: 'All' }).click();
  await expect(audit.locator('.check')).toHaveCount(4);
});

test('the audit says when there is no audit yet', async ({ page }) => {
  await withFixture(page);
  await page.goto('/audit');
  await expect(page.locator('audit-page [data-score-line]')).toHaveText(
    'The audit appears after the next run of the dashboard workflow.'
  );
});

test('fits a phone screen without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await withFixture(page, DETAIL_CSV, 200, REPORT);
  for (const path of ['/', '/audit', '/methodology']) {
    await page.goto(path);
    await expect(page.locator('#router-outlet > *')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(390);
  }
});
