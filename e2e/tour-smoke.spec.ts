import { expect, test } from '@playwright/test';

const tourRoutes = [
  ['Dashboard', '/dashboard', 'Currently clocked out'],
  ['Sessions', '/sessions', 'Track and review your logged work sessions.'],
  ['Projects', '/projects', 'Milestone-based pricing with optional session attachments and Mercury sync.'],
  ['Invoices', '/invoices', 'Create and manage client invoices.'],
  ['Settings', '/settings', 'Manage your account details, integrations, billing access, and local backup tools.'],
] as const;

test('runs the hosted tour through the primary workspace routes and resets its seed data', async ({ page }) => {
  await page.goto('/');
  const tourButton = page.getByText('Tour the App', { exact: true }).locator('..');
  await expect(tourButton).toBeVisible();

  await tourButton.click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('Tour mode active. Sign in to save data to your hosted account.')).toBeVisible();

  for (const [label, path, pageMarker] of tourRoutes) {
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByText(pageMarker, { exact: true })).toBeVisible();
  }

  const resetTour = page
    .locator('div[tabindex="0"]:visible')
    .filter({ hasText: /^Reset Tour$/ });
  await resetTour.click();
  await expect(resetTour).toBeVisible();
  await page.getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.locator('select:visible').nth(1)).toHaveValue('tour_project_001');
});
