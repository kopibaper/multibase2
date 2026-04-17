import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@multibase.local';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin123!';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh – clear localStorage
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('shows login form on unauthenticated access', async ({ page }) => {
    await page.goto('/');
    // Should redirect to login or show login form
    await expect(page.getByRole('heading', { name: /sign in|login|welcome/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|login/i })).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Expect an error message
    await expect(
      page.getByText(/invalid|incorrect|credentials|error/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test('redirects to dashboard after successful login', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    // Should reach dashboard
    await expect(page).toHaveURL(/dashboard|instances|home/, { timeout: 10_000 });
  });

  test('logout redirects back to login', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard|instances|home/, { timeout: 10_000 });

    // Logout
    const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      // Try user menu
      await page.click('[data-testid="user-menu"], [aria-label="User menu"]');
      await page.getByRole('menuitem', { name: /logout|sign out/i }).click();
    }

    // Should be back on login page
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible({ timeout: 5_000 });
  });
});
