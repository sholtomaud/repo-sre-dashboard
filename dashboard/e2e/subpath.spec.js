// Runs against a build made with `--base /sub/path/` and served from there,
// as on GitHub Pages project sites. URLs here are relative to that base.
import { test, expect } from '@playwright/test';

test('the dashboard works when served from a sub-path', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('./');
  // data/data.csv resolves from the base, not the domain root.
  await expect(page.locator('[data-as-of]')).toContainText('Data as of');

  // In-app links are written without the base; the router adds it.
  await page
    .locator('app-nav')
    .getByRole('link', { name: 'Methodology' })
    .click();
  await expect(page).toHaveURL(/\/sub\/path\/methodology$/);

  expect(errors).toEqual([]);
});

test('deep links load under a sub-path', async ({ page }) => {
  await page.goto('./methodology', { waitUntil: 'networkidle' });
  await expect(page.locator('methodology-page')).toBeVisible();
  await page.goto('./no/such/page');
  await expect(page.locator('not-found-page')).toBeVisible();
});
