import { test, expect } from '@playwright/test';

/**
 * E2E Tests: (Workspace) Selector
 * Tests workspace selection and navigation
 */

test.describe('(Workspace) Selector', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a workspace page
    await page.goto('/mission-control-hq/overview');
  });

  test('should display workspace selector with current business', async ({ page }) => {
    // Find the selector button
    const selector = page.locator('button').filter({
      has: page.locator('text=/🚀|Mission Control/i')
    }).first();

    await expect(selector).toBeVisible();
    // Should show workspace emoji or name
    await expect(selector).toContainText(/🚀|Mission Control|Select (Workspace)/i);
  });

  test('should open dropdown when clicked', async ({ page }) => {
    // Find and click selector
    const selector = page.locator('button').filter({
      has: page.locator(/Select (Workspace)|Mission Control|🚀/)
    }).first();

    await selector.click();

    // Dropdown should be visible with workspace options
    const dropdown = page.locator('div[class*="popover"]').first();
    await expect(dropdown).toBeVisible();
  });

  test('should stay on same tab when switching businesses', async ({ page }) => {
    // On overview page
    expect(page.url()).toContain('/overview');

    // Click selector
    const selector = page.locator('button').filter({
      has: page.locator(/Select (Workspace)|Mission Control/)
    }).first();
    
    await selector.click();
    
    // If multiple businesses exist, try to select another
    const other(Workspace) = page.locator('div[class*="popover"] button').nth(1);
    const isVisible = await other(Workspace).isVisible();
    
    if (isVisible) {
      await other(Workspace).click();
      
      // Should still be on same tab type (overview)
      await page.waitForURL('**/overview');
      expect(page.url()).toContain('/overview');
    }
  });

  test('should render placeholder text if workspace not loaded', async ({ page }) => {
    // Initially page may show loading or placeholder
    // After page loads, should have workspace data
    await page.waitForSelector('button', { has: page.locator('text') });
    
    const selector = page.locator('button').filter({
      has: page.locator(/Select (Workspace)|Mission Control|🚀/)
    }).first();

    await expect(selector).toBeVisible();
  });
});
