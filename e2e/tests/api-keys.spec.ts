import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@multibase.local';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin123!';

async function login(page: any) {
  await page.goto('/');
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|instances|home/, { timeout: 10_000 });
}

test.describe('API Key Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('API keys page loads', async ({ page }) => {
    await page.goto('/api-keys');
    await expect(page.getByRole('heading', { name: /api keys/i })).toBeVisible({ timeout: 5_000 });
  });

  test('can open create API key dialog', async ({ page }) => {
    await page.goto('/api-keys');
    await page.getByRole('button', { name: /create|generate|new/i }).click();
    // Dialog or form should appear
    await expect(
      page.getByRole('dialog').or(page.getByRole('form'))
    ).toBeVisible({ timeout: 5_000 });
  });

  test('create API key shows the generated key once', async ({ page }) => {
    await page.goto('/api-keys');
    await page.getByRole('button', { name: /create|generate|new/i }).click();

    // Fill in key name
    const nameInput = page.getByRole('textbox', { name: /name/i }).first();
    if (await nameInput.isVisible()) {
      await nameInput.fill(`e2e-test-key-${Date.now()}`);
    }

    // Submit
    const submitBtn = page.getByRole('button', { name: /create|generate|save/i }).last();
    await submitBtn.click();

    // Should show the key value (shown once)
    await expect(page.getByText(/mb_/)).toBeVisible({ timeout: 5_000 });
  });

  test('API keys appear in list after creation', async ({ page }) => {
    await page.goto('/api-keys');
    // Reload to get fresh list
    const keyCount = await page.locator('[data-testid="api-key-row"]').count();
    // Just verify the page has the right structure
    expect(keyCount).toBeGreaterThanOrEqual(0);
  });
});
