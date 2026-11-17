import { test, expect } from '@playwright/test';

// Covers MIME-type and module-load failures, CSP violations and uncaught
// errors, against the real data.csv copied in by scripts/sync-data.ts.
for (const path of ['/', '/methodology']) {
  test(`no console or page errors on ${path}`, async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(path, { waitUntil: 'networkidle' });

    expect(errors).toEqual([]);
  });
}

test('the real data.csv loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-as-of]')).toContainText('Data as of');
  await expect(page.locator('doomsday-clock [data-hours]')).toHaveText(
    /^\d+\.\d$/
  );
});
