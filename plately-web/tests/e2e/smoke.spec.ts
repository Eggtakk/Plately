import { test, expect } from '@playwright/test';

const locales = ['en', 'ko', 'ar', 'hi'] as const;
const paths = ['/explore', '/start', '/insight', '/insight/rankings', '/insight/compare', '/insight/about'];

const IGNORE = /openfreemap|tiles|gstatic|fonts\.googleapis|favicon|maplibre|WebGL|Failed to load resource/i;

for (const locale of locales) {
  for (const path of paths) {
    test(`${locale}${path} renders without app console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));
      const res = await page.goto(`/${locale}${path}`);
      expect(res?.status(), `HTTP status for ${locale}${path}`).toBeLessThan(400);
      await expect(page.locator('header, main, article, h1').first()).toBeVisible();
      const real = errors.filter((e) => !IGNORE.test(e));
      expect(real, real.join('\n')).toEqual([]);
    });
  }
}

test('ar sets dir=rtl on <html>', async ({ page }) => {
  await page.goto('/ar/explore');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('en sets dir=ltr on <html>', async ({ page }) => {
  await page.goto('/en/explore');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('language picker switches locale', async ({ page }) => {
  await page.goto('/en/explore');
  await page.locator('select').first().selectOption('ko');
  await expect(page).toHaveURL(/\/ko\/explore/);
});

test('filter chip toggles pressed state and changes the count', async ({ page }) => {
  await page.goto('/en/explore');
  const count = page.getByText(/\d+ places/);
  await expect(count).toBeVisible();
  const before = Number((await count.textContent())!.match(/\d+/)![0]);
  const chip = page.getByRole('button', { name: 'Beef-free' });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => Number((await count.textContent())!.match(/\d+/)![0])).toBeLessThanOrEqual(before);
});

test('onboarding choice persists across reload', async ({ page }) => {
  await page.goto('/en/start');
  await page.getByRole('button', { name: 'Muslim' }).click();
  await expect(page.getByRole('switch', { name: /alcohol/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Muslim' })).toHaveAttribute('aria-pressed', 'true');
});

test('insight region list opens the region panel', async ({ page }) => {
  await page.goto('/en/insight');
  const list = page.locator('ul[aria-label="Regions by gap index"]');
  await expect(list).toBeVisible();
  await list.getByRole('button').first().click();
  await expect(page.getByRole('complementary')).toBeVisible();
});

test('insight sub-nav navigates to rankings', async ({ page }) => {
  await page.goto('/en/insight');
  await page.getByRole('link', { name: /rankings/i }).first().click();
  await expect(page).toHaveURL(/\/en\/insight\/rankings/);
  await expect(page.locator('table')).toBeVisible();
});
