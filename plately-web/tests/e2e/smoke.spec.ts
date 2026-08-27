import { test, expect } from '@playwright/test';

test('onboarding choice persists across reload', async ({ page }) => {
  await page.goto('/en/start');
  await page.getByRole('button', { name: 'Muslim' }).click();
  await expect(page.getByRole('switch', { name: /alcohol/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Muslim' })).toHaveAttribute('aria-pressed', 'true');
});
