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
  await expect(page).toHaveTitle(/Developer Doomsday Clock/);
});

test('dashboard shows the combined clock, dials, indices and trends', async ({
  page,
}) => {
  await withFixture(page);
  await page.goto('/');

  // Agents resolved 25% of the public issues and all of their own queue:
  // at equal weight 62.5%, so 9 hours to midnight.
  const clock = page.locator('doomsday-clock');
  await expect(clock.locator('[data-hours]')).toHaveText('9.0');
  await expect(clock.locator('[data-time]')).toHaveText('Clock reads 15:00');
  await expect(clock.getByRole('img')).toHaveAttribute(
    'aria-label',
    /9\.0 hours to midnight, reading 15:00/
  );
  await expect(page.locator('[data-clock-note]')).toHaveText(
    "Weighted: public issues 50%, agents' queue 50%."
  );
  await expect(page.locator('[data-status]')).toContainText('Severe');

  // One large dial for both queues and a smaller one for each.
  const dial = (name) => page.locator(`velocity-gauge[data-dial="${name}"]`);
  // Each needle is everyone's rate: agents and humans together. Public:
  // 6 by agents and 18 by humans over 6.5 days, against 44 new issues.
  await expect(dial('public').locator('[data-readout]')).toHaveText('3.7');
  await expect(dial('public').locator('[data-gap]')).toHaveText(
    '▼ 3.1 a day behind new issues'
  );
  await expect(dial('public').locator('[data-gauge]')).toHaveAttribute(
    'aria-label',
    /3\.7 issues resolved per day: 0\.9 by AI agents and 2\.8 by humans.*averaged over 6\.5 days/i
  );
  await expect(dial('agents').locator('[data-readout]')).toHaveText('107.6');
  // The agents resolve 700 against 686 filed: just ahead.
  await expect(dial('agents').locator('[data-gap]')).toHaveText(
    '▲ 2.2 a day ahead of new issues'
  );
  await expect(dial('combined').locator('[data-readout]')).toHaveText('55.7');
  await expect(dial('combined').locator('[data-heading]')).toHaveText(
    'Both queues, weighted'
  );

  await expect(page.locator('[data-stat="share"]')).toHaveText('62.5%');
  await expect(page.locator('[data-stat="share-note"]')).toHaveText(
    "combined · public issues 25.0% · agents' queue 100.0%"
  );
  await expect(page.locator('[data-stat="open"]')).toHaveText('116');
  // Public issues get 3.3% of resolutions and hold 25.9% of the backlog.
  await expect(page.locator('[data-stat="attention"]')).toHaveText('0.13');
  // The time and schedule come from status.json, not from the page's code.
  await expect(page.locator('[data-as-of]')).toContainText(
    /Data as of Nov 8, 2026, 12:05 UTC · updated every 6 hours · next around \d\d:05 UTC/
  );
  await expect(page.locator('.foot [data-schedule]')).toHaveText(
    'Updated every 6 hours'
  );

  // Issues filed went 10 → 54 (44 opened) while 24 were closed: 1.8×.
  // The backlog grows 20 in 6.5 days, so 30 open doubles in about 10 days.
  const loop = page.locator('doom-loop[data-queue-loop="public"]');
  await expect(loop.locator('[data-ratio]')).toHaveText('1.8');
  await expect(loop.locator('[data-label]')).toHaveText('Falling behind');
  await expect(loop.locator('[data-projection]')).toHaveText(
    'At this rate the open backlog of 30 doubles in 10 days.'
  );

  // Table view lists every day, newest first.
  // The combined doom loop is the geometric mean of 1.8× and 0.98×.
  const combined = page.locator('doom-loop[data-queue-loop="combined"]');
  await expect(combined.locator('[data-ratio]')).toHaveText('1.3');
  await expect(combined.locator('[data-label]')).toHaveText('Falling behind');

  const publicTrend = page.locator('trend-chart[data-trend="public"]');
  await publicTrend.getByText('View as table').click();
  const rows = publicTrend.locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('2026-11-08');
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

test('closure evidence, issue types and stricter doom loop ratios', async ({
  page,
}) => {
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

  // 44 opened against 3 referenced fixes; 32 behaviour reports against 20.
  const loop = page.locator('doom-loop[data-queue-loop="public"]');
  await expect(loop.locator('[data-strict-referenced-value]')).toHaveText(
    '15×'
  );
  await expect(loop.locator('[data-strict-behavior-value]')).toHaveText('1.6×');
});

test('older data without closure details shows a note instead', async ({
  page,
}) => {
  await withFixture(page);
  await page.goto('/');
  await expect(page.locator('closure-evidence [data-empty]')).toBeVisible();
  await expect(
    page.locator('doom-loop[data-queue-loop="public"] [data-strict]')
  ).toBeHidden();
});

test('the two queues are shown side by side', async ({ page }) => {
  await withFixture(page);
  await page.goto('/');
  const queues = page.locator('queue-compare .queue');
  await expect(queues).toHaveCount(2);
  await expect(queues.first().locator('[data-open]')).toHaveText('86');
  await expect(queues.first().locator('[data-resolved]')).toHaveText('1,700');
  await expect(queues.last().locator('[data-open]')).toHaveText('30');
  // Each queue has its own doom loop panel, in the same form.
  const agents = page.locator('doom-loop[data-queue-loop="agents"]');
  await expect(agents.locator('[data-queue]')).toHaveText("Agents' own queue");
  // 686 filed against 700 resolved: just under break-even.
  await expect(agents.locator('[data-ratio]')).toHaveText('1.0');
  await expect(agents.locator('[data-label]')).toHaveText('Holding steady');
  await expect(agents.locator('[data-caption]')).toHaveText(
    'issues filed per issue resolved'
  );
  const publicLoop = page.locator('doom-loop[data-queue-loop="public"]');
  await expect(publicLoop.locator('[data-queue]')).toHaveText(
    'Public GitHub issues'
  );
  await expect(publicLoop.locator('[data-ratio]')).toHaveText('1.8');

  // 700 resolved in the agents' queue over 6.5 days; 6 in the public one.
  await expect(page.locator('queue-compare [data-summary]')).toHaveText(
    'Agents resolve 107.6 a day in their own queue and 0.9 a day in the public one. Humans resolve 0.0 a day and 2.8 a day.'
  );
});

test('the weighting slider moves the combined measures and is remembered', async ({
  page,
}) => {
  await withFixture(page);
  await page.goto('/');
  const hours = page.locator('doomsday-clock [data-hours]');
  const slider = page.locator('weight-slider');
  await expect(hours).toHaveText('9.0');
  await expect(
    slider.getByRole('button', { name: /Equal per queue/ })
  ).toHaveAttribute('aria-pressed', 'true');
  // The marks derived from the data: 30 of 116 open issues are public.
  await expect(
    slider.getByRole('button', { name: /By backlog size/ })
  ).toContainText('26% public');

  // Public issues only is version 1 of the clock.
  await slider.getByRole('button', { name: /Public issues only/ }).click();
  await expect(hours).toHaveText('18.0');
  await expect(page.locator('[data-status]')).toContainText('Elevated');
  await expect(
    page.locator('doom-loop[data-queue-loop="combined"] [data-ratio]')
  ).toHaveText('1.8');
  await expect(
    page.locator('velocity-gauge[data-dial="combined"] [data-readout]')
  ).toHaveText('3.7');
  // The per-queue panels do not move.
  await expect(
    page.locator('doom-loop[data-queue-loop="agents"] [data-ratio]')
  ).toHaveText('1.0');

  await slider.getByRole('button', { name: /Agents' queue only/ }).click();
  await expect(hours).toHaveText('0.0');
  await expect(slider.locator('[data-readout]')).toHaveText(
    "Public issues 0% · agents' queue 100%"
  );

  // Dragging works too, and the choice survives a reload.
  await slider.getByRole('slider').fill('75');
  await expect(hours).toHaveText('13.5');
  await page.reload();
  await expect(hours).toHaveText('13.5');
});

test('the forecast continues past today, then returns to live', async ({
  page,
}) => {
  await withFixture(page);
  await page.goto('/');
  const replay = page.locator('replay-control');
  // The GSSK simulation runs after the page has drawn.
  await expect(page.locator('[data-forecast-note]')).toContainText(
    /The forecast runs \d+ days?, to /,
    { timeout: 20000 }
  );
  await expect(replay.getByRole('button')).toHaveText(/Replay and forecast/);
  await expect(replay.locator('[data-date]')).toHaveText('Live');

  // The last position is the end of the forecast.
  const slider = replay.getByRole('slider');
  await slider.fill(await slider.getAttribute('max'));
  await expect(replay.locator('[data-date]')).toHaveText(/^Forecast · /);
  await expect(page.locator('doomsday-clock [data-time]')).toHaveText(
    /^Forecast: likely [\d.]+–[\d.]+ hours to midnight$/
  );
  await expect(
    page.locator('velocity-gauge[data-dial="agents"] [data-forecast]')
  ).toHaveText(/^Forecast: likely [\d.]+–[\d.]+ resolved a day$/);
});

test('a data-derived preset is worked out afresh for each replayed day', async ({
  page,
}) => {
  await withFixture(page);
  await page.goto('/');
  const slider = page.locator('weight-slider');
  const note = page.locator('[data-clock-note]');
  await slider.getByRole('button', { name: /By backlog size/ }).click();
  // Live: 30 of 116 open issues are public.
  await expect(note).toHaveText(
    "Weighted: public issues 26%, agents' queue 74%."
  );
  // On 1 November there were 10 public issues and 100 in the agents' queue.
  await page.locator('replay-control').getByRole('slider').fill('0');
  await expect(note).toHaveText(
    "Weighted: public issues 9%, agents' queue 91%."
  );
});

test('replay runs the dials through the record and returns to live', async ({
  page,
}) => {
  // The record alone: without the simulation kernel there is no forecast.
  await page.route('**/gssk*.wasm', (route) => route.abort());
  await withFixture(page);
  await page.goto('/');
  const replay = page.locator('replay-control');
  const date = replay.locator('[data-date]');
  const hours = page.locator('doomsday-clock [data-hours]');
  await expect(date).toHaveText('Live');
  await expect(hours).toHaveText('9.0');

  // Scrubbing to the first day shows the state as it was then: no public
  // issue had been closed, so only the agents' queue (all agents) counts.
  await replay.getByRole('slider').fill('0');
  await expect(date).toHaveText('Nov 1, 2026');
  await expect(hours).toHaveText('0.0');
  await expect(
    page.locator('velocity-gauge[data-dial="agents"] [data-readout]')
  ).toHaveText('0.0');
  await expect(replay.getByRole('button')).toHaveText(/Resume/);

  // Playing runs forward to the end and lands back on the live data.
  await replay.getByRole('button').click();
  await expect(replay.getByRole('button')).toHaveText(/Pause/);
  await expect(date).toHaveText('Live', { timeout: 15000 });
  await expect(hours).toHaveText('9.0');
  await expect(replay.getByRole('button')).toHaveText(/Replay the record/);
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
  await expect(page.locator('queue-compare [data-summary]')).toContainText(
    'not available'
  );
  await expect(
    page.locator('doom-loop[data-queue-loop="agents"] [data-label]')
  ).toHaveText('Not enough data yet');
  // With only the public issues, the clock is the version 1 reading.
  await expect(page.locator('doomsday-clock [data-hours]')).toHaveText('18.0');
  await expect(page.locator('weight-slider')).toBeHidden();
  await expect(page.locator('[data-clock-note]')).toHaveText(
    'Weighted: public issues only.'
  );
});

test('works without status.json, treating the newest day as complete', async ({
  page,
}) => {
  await withFixture(page, CSV, 200, null);
  await page.goto('/');
  await expect(page.locator('[data-as-of]')).toHaveText(
    'Data as of Nov 8, 2026 (UTC)'
  );
  await expect(
    page.locator('velocity-gauge[data-dial="public"]').locator('[data-gauge]')
  ).toHaveAttribute('aria-label', /averaged over 7 days/i);
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
  expect(manifest.name).toBe('Developer Doomsday Clock');
  for (const icon of manifest.icons) {
    expect((await request.get(new URL(icon.src, href).href)).ok()).toBe(true);
  }
});

test('a repository with only its issues gets a single-queue dashboard', async ({
  page,
}) => {
  await withFixture(page, DETAIL_CSV, 200, {
    ...DETAIL_STATUS,
    responses: {
      windowDays: 30,
      firstResponse: { count: 4, medianHours: 2.5, p90Hours: 30 },
      resolution: { count: 3, medianHours: 50, p90Hours: 100 },
      awaitingResponse: 2,
    },
    practices: [
      {
        id: 'labels',
        title: 'Issues are labelled',
        status: 'missing',
        evidence: '1% of 100 issues carry a label',
        recommendation: 'Label every issue at triage.',
        docs: 'https://docs.github.com/en/issues',
      },
      {
        id: 'schedule',
        title: 'The dashboard updates on a schedule',
        status: 'pass',
        evidence: 'Runs every 6 hours',
        recommendation: '',
        docs: 'https://docs.github.com/en/actions',
      },
    ],
  });
  await page.route('**/data/config.json', (route) =>
    route.fulfill({
      json: {
        repository: 'owner/project',
        repository_url: 'https://github.com/owner/project',
        issues_url: 'https://github.com/owner/project/issues',
        title: 'Project Clock',
        queue: null,
        why: null,
      },
    })
  );
  await page.goto('/');

  await expect(page.locator('dashboard-page h1')).toHaveText('Project Clock');
  await expect(page.locator('[data-repo-name]')).toHaveText('owner/project');
  await expect(page).toHaveTitle('Project Clock · owner/project');
  // Nothing to combine: one dial and one doom loop, no slider.
  await expect(
    page.locator('velocity-gauge[data-dial="public"]')
  ).toBeVisible();
  await expect(
    page.locator('velocity-gauge[data-dial="combined"]')
  ).toBeHidden();
  await expect(page.locator('weight-slider')).toBeHidden();
  await expect(page.locator('queue-compare')).toBeHidden();
  await expect(
    page.locator('doom-loop[data-queue-loop="public"] [data-queue]')
  ).toHaveText('Issues');
  // The clock is the issues' own: agents closed 6 of 24, a quarter.
  await expect(page.locator('doomsday-clock [data-hours]')).toHaveText('18.0');
  await expect(page.locator('[data-stat="share-note"]')).toHaveText(
    'of 24 closed issues'
  );

  // Response times.
  await expect(page.locator('[data-stat="first-response"]')).toHaveText(
    '2.5 h'
  );
  await expect(page.locator('[data-stat="first-response-note"]')).toContainText(
    '2 open with no response'
  );
  await expect(page.locator('[data-stat="resolution"]')).toHaveText('2.1 days');

  // The habits checklist: what to fix first, with a link to the docs.
  const items = page.locator('practice-list .practice');
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText('Issues are labelled');
  await expect(items.first()).toContainText('Label every issue at triage.');
  await expect(
    items.first().getByRole('link', { name: 'How to' })
  ).toHaveAttribute('href', 'https://docs.github.com/en/issues');
  await expect(page.locator('practice-list [data-score]')).toHaveText(
    '1 of 2 in place'
  );
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
