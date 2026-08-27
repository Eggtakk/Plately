import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = ['/en/explore', '/en/start', '/en/insight', '/en/insight/compare', '/en/insight/rankings', '/en/insight/about', '/ar/explore', '/ko/insight'];

for (const route of routes) {
  test(`${route} has no serious/critical axe violations`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page })
      .disableRules(['region'])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
  });
}
