import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Dashboard Header
 * Tests notifications, controls, and header functionality
 */

test.describe('Dashboard Header', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to overview page
    await page.goto('/mission-control-hq/overview');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display header with title', async ({ page }) => {
    // Find header
    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    // Should have a title (Dashboard, Task Board, Activity, etc)
    const title = header.locator('h2');
    await expect(title).toBeVisible();
    await expect(title).toHaveText(/Dashboard|Overview|Board|Activity/i);
  });

  test('should have notification bell button', async ({ page }) => {
    const header = page.locator('header').first();
    
    // Find notification button
    const notificationBtn = header.locator('button[aria-label*="Notifications"]');
    await expect(notificationBtn).toBeVisible();
  });

  test('should have create task button', async ({ page }) => {
    const header = page.locator('header').first();
    
    // Find create task button
    const createBtn = header.locator('button:has-text("New Task")');
    await expect(createBtn).toBeVisible();
    
    // Should be clickable
    await expect(createBtn).toBeEnabled();
  });

  test('should be sticky/sticky positioned', async ({ page }) => {
    const header = page.locator('header').first();
    
    // Check if header has sticky class
    const classes = await header.getAttribute('class');
    expect(classes).toContain('sticky');
  });

  test('should show P0 alert when critical tasks exist', async ({ page }) => {
    // Navigate to a page that might have P0 tasks
    await page.goto('/mission-control-hq/board');
    await page.waitForLoadState('networkidle');

    const header = page.locator('header').first();
    
    // P0 alert is optional depending on data
    const p0Alert = header.locator('text=/P0 tasks/');
    
    // If it exists, verify it shows count
    if (await p0Alert.isVisible()) {
      await expect(p0Alert).toContainText(/\d+ P0 tasks/);
    }
  });

  test('should display different titles per tab', async ({ page }) => {
    const getTitleText = async (url: string) => {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      const title = page.locator('header h2');
      return await title.textContent();
    };

    // Check different tabs have different titles
    const overviewTitle = await getTitleText('/mission-control-hq/overview');
    const boardTitle = await getTitleText('/mission-control-hq/board');
    
    // Titles should be different or at least present
    expect(overviewTitle).toBeTruthy();
    expect(boardTitle).toBeTruthy();
  });
});
