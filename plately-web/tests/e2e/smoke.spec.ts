import { test, expect } from '@playwright/test';

const locales = ['en', 'ko', 'ar', 'hi'] as const;
const paths = [
  '/login',
  '/onboarding/language',
  '/onboarding/profile',
  '/explore',
  '/insight',
  '/insight/rankings',
  '/insight/compare',
  '/insight/about',
];

const IGNORE = /openfreemap|tiles|gstatic|fonts\.googleapis|favicon|maplibre|WebGL|Failed to load resource/i;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('plately.session', JSON.stringify({ email: null, signedInAt: '2026-01-01T00:00:00Z' }));
      localStorage.setItem('plately.prefs', JSON.stringify({ profile: 'muslim', tier: 'pork-alcohol-free', restrictions: { pork: true, alcohol: true, porkDerived: true }, onboarded: true }));
    } catch {}
  });
});

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

test('loosening a restriction chip widens the result count', async ({ page }) => {
  await page.goto('/en/explore');
  const count = page.getByText(/\d+ place/);
  await expect(count).toBeVisible();
  const before = Number((await count.textContent())!.match(/\d+/)![0]);
  await page.getByRole('button', { name: 'Pork', exact: true }).click(); // chip is aria-pressed=true (from seeded prefs); clicking loosens it
  await expect(page.getByRole('button', { name: 'Pork', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => Number((await count.textContent())!.match(/\d+/)![0])).toBeGreaterThanOrEqual(before);
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
