import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@multibase.local';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin123!';

// Helper to log in before each test
async function login(page: any) {
  await page.goto('/');
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|instances|home/, { timeout: 10_000 });
}

test.describe('Instance Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('instances page loads and shows list or empty state', async ({ page }) => {
    await page.goto('/instances');
    // Either shows instance cards or an empty state message
    const hasInstances = await page.locator('[data-testid="instance-card"]').count();
    const hasEmpty = await page
      .getByText(/no instances|create your first|get started/i)
      .isVisible()
      .catch(() => false);
    expect(hasInstances > 0 || hasEmpty).toBeTruthy();
  });

  test('create instance button is visible for admin', async ({ page }) => {
    await page.goto('/instances');
    await expect(
      page.getByRole('button', { name: /create|new instance/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  test('instance detail page loads when clicking an instance', async ({ page }) => {
    await page.goto('/instances');
    const firstInstance = page.locator('[data-testid="instance-card"]').first();
    if (await firstInstance.isVisible()) {
      await firstInstance.click();
      // Should navigate to instance detail
      await expect(page).toHaveURL(/\/instances\/.+/, { timeout: 5_000 });
      // Detail page should show some stats or info
      await expect(page.getByText(/status|services|database/i)).toBeVisible({ timeout: 5_000 });
    } else {
      test.skip(true, 'No instances available to click');
    }
  });
});
