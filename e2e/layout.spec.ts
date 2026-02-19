import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Dashboard Layout
 * Tests the sidebar, navigation, and main layout components
 */

test.describe('Dashboard Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page that uses the layout
    await page.goto('/mission-control-hq/overview');
  });

  test('should render sidebar with business selector', async ({ page }) => {
    // Check sidebar exists
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // Check business selector is present
    const selector = page.locator('button').filter({ 
      has: page.locator('text=/Select Business|🚀/') 
    }).first();
    await expect(selector).toBeVisible();
  });

  test('should display business and workspace tabs', async ({ page }) => {
    // Check BUSINESS section exists
    await expect(page.locator('text=BUSINESS')).toBeVisible();

    // Check WORKSPACE section exists
    await expect(page.locator('text=WORKSPACE')).toBeVisible();

    // Check key tabs exist
    await expect(page.locator('text=Overview')).toBeVisible();
    await expect(page.locator('text=Task Board')).toBeVisible();
    await expect(page.locator('text=Activity')).toBeVisible();
  });

  test('should render dashboard header with controls', async ({ page }) => {
    // Check header is present
    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    // Check for notification button
    const notificationBtn = page.locator('button[aria-label*="Notifications"]');
    await expect(notificationBtn).toBeVisible();

    // Check for create task button
    const createBtn = page.locator('button:has-text("New Task")');
    await expect(createBtn).toBeVisible();
  });

  test('should navigate between tabs', async ({ page }) => {
    // Click on Activity tab
    await page.locator('text=Activity').click();
    
    // Check URL changed to global activity
    await page.waitForURL('**/global/activity');
    expect(page.url()).toContain('/global/activity');

    // Click on Task Board tab
    await page.locator('text=Task Board').click();
    
    // Should navigate to business-scoped board
    await page.waitForURL('**/board');
    expect(page.url()).toContain('/board');
  });

  test('should display main content area', async ({ page }) => {
    // Check main content exists and is visible
    const main = page.locator('main');
    await expect(main).toBeVisible();
    await expect(main).toHaveClass(/flex-1/);
  });
});
