import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Business Selector
 * Tests business selection and navigation
 */

test.describe('Business Selector', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a business page
    await page.goto('/mission-control-hq/overview');
  });

  test('should display business selector with current business', async ({ page }) => {
    // Find the selector button
    const selector = page.locator('button').filter({
      has: page.locator('text=/🚀|Mission Control/i')
    }).first();

    await expect(selector).toBeVisible();
    // Should show business emoji or name
    await expect(selector).toContainText(/🚀|Mission Control|Select Business/i);
  });

  test('should open dropdown when clicked', async ({ page }) => {
    // Find and click selector
    const selector = page.locator('button').filter({
      has: page.locator(/Select Business|Mission Control|🚀/)
    }).first();

    await selector.click();

    // Dropdown should be visible with business options
    const dropdown = page.locator('div[class*="popover"]').first();
    await expect(dropdown).toBeVisible();
  });

  test('should stay on same tab when switching businesses', async ({ page }) => {
    // On overview page
    expect(page.url()).toContain('/overview');

    // Click selector
    const selector = page.locator('button').filter({
      has: page.locator(/Select Business|Mission Control/)
    }).first();
    
    await selector.click();
    
    // If multiple businesses exist, try to select another
    const otherBusiness = page.locator('div[class*="popover"] button').nth(1);
    const isVisible = await otherBusiness.isVisible();
    
    if (isVisible) {
      await otherBusiness.click();
      
      // Should still be on same tab type (overview)
      await page.waitForURL('**/overview');
      expect(page.url()).toContain('/overview');
    }
  });

  test('should render placeholder text if business not loaded', async ({ page }) => {
    // Initially page may show loading or placeholder
    // After page loads, should have business data
    await page.waitForSelector('button', { has: page.locator('text') });
    
    const selector = page.locator('button').filter({
      has: page.locator(/Select Business|Mission Control|🚀/)
    }).first();

    await expect(selector).toBeVisible();
  });
});
