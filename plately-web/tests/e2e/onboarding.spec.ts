import { test, expect } from '@playwright/test';

test('unauthenticated visit is gated: login → onboarding → explore, then persists', async ({ page }) => {
  await page.goto('/en/explore');
  await expect(page).toHaveURL(/\/en\/login/);

  await page.getByRole('button', { name: 'Continue as guest' }).click();
  await expect(page).toHaveURL(/\/en\/onboarding\/language/);

  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/onboarding\/profile/);

  await page.getByRole('button', { name: /Muslim/ }).click();
  await expect(page).toHaveURL(/\/en\/onboarding\/details/);

  // default tier for muslim is "Pork & alcohol free" — its switches are preset + disabled
  await expect(page.getByRole('radio', { name: 'Pork & alcohol free' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('switch', { name: 'Gelatin' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Custom' }).click();
  await expect(page.getByRole('switch', { name: 'Gelatin' })).toBeEnabled();
  await page.getByRole('radio', { name: 'Halal-certified only' }).click();
  await expect(page.getByRole('switch', { name: 'Gelatin' })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: 'Start exploring' }).click();
  await expect(page).toHaveURL(/\/en\/explore/);
  await expect(page.getByText(/\d+ place/)).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/en\/explore/);
});

test('ar login is RTL', async ({ page }) => {
  await page.goto('/ar/login');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('a pre-onboarded session skips straight to explore', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('plately.session', JSON.stringify({ email: null, signedInAt: '2026-01-01T00:00:00Z' }));
    localStorage.setItem('plately.prefs', JSON.stringify({ profile: 'hindu', tier: 'vegetarian', restrictions: { beef: true, pork: true, chicken: true, fish: true, seafood: true }, onboarded: true }));
  });
  await page.goto('/en/explore');
  await expect(page).toHaveURL(/\/en\/explore/);
  await expect(page.getByText(/\d+ place/)).toBeVisible();
});

test('guest session but incomplete profile is sent to the wizard', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('plately.session', JSON.stringify({ email: null, signedInAt: '2026-01-01T00:00:00Z' }));
  });
  await page.goto('/en/insight');
  await expect(page).toHaveURL(/\/en\/onboarding\/profile/);
});
