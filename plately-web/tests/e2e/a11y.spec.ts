import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import restaurants from '../../public/data/restaurants.json';

const routes = [
  '/en/login',
  '/en/onboarding/profile',
  '/en/explore',
  `/en/explore/${restaurants[0].id}`,
  '/en/insight',
  '/en/insight/compare',
  '/en/insight/rankings',
  '/en/insight/about',
  '/ar/explore',
  '/ko/insight',
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('plately.session', JSON.stringify({ email: null, signedInAt: '2026-01-01T00:00:00Z' }));
      localStorage.setItem('plately.prefs', JSON.stringify({ profile: 'muslim', tier: 'pork-alcohol-free', restrictions: { pork: true, alcohol: true, porkDerived: true }, onboarded: true }));
    } catch {}
  });
});

async function axeSerious(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).disableRules(['region']).analyze();
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

for (const route of routes) {
  test(`${route} has no serious/critical axe violations`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    const serious = await axeSerious(page);
    expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
  });
}

test('/en/onboarding/details has no serious/critical axe violations', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('plately.prefs', JSON.stringify({ profile: 'muslim', tier: 'pork-alcohol-free', restrictions: { pork: true, alcohol: true, porkDerived: true }, onboarded: false }));
  });
  await page.goto('/en/onboarding/details');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  const serious = await axeSerious(page);
  expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
});
