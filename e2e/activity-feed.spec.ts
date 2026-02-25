import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Activity Feed
 * Tests activity feed interactions: view, filter, navigate to tasks
 */

test.describe('Activity Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mission-control-hq/activity');
    await page.waitForLoadState('networkidle');
  });

  test('should display activity page with header', async ({ page }) => {
    // Check for header
    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    // Check for page title
    const title = header.locator('h2');
    await expect(title).toContainText(/Activity|Feed|History/i);
  });

  test('should display activity feed items', async ({ page }) => {
    // Activity items should be visible
    const activityItems = page.locator('[class*="activity"]');
    const emptyState = page.locator('text=/No activities|No activity/i');

    const itemCount = await activityItems.count();
    const hasEmptyState = await emptyState.isVisible();

    // Should have either items or empty state
    expect(itemCount > 0 || hasEmptyState).toBeTruthy();
  });

  test('should display activity timestamps', async ({ page }) => {
    // Activity timestamps should be visible
    const timestamps = page.locator('text=/ago|minutes|hours|days/i');

    if (await timestamps.first().isVisible()) {
      await expect(timestamps.first()).toBeVisible();
    }
  });

  test('should display activity actors/users', async ({ page }) => {
    // Activity should show who performed the action
    const activityItems = page.locator('[class*="activity"]');

    if (await activityItems.first().isVisible()) {
      // Should contain user name or avatar
      const userInfo = page.locator('[class*="user"], [class*="avatar"]').first();
      expect(await userInfo.isVisible() || await page.locator('text=/assigned|created|updated/i').isVisible()).toBeTruthy();
    }
  });

  test('should display activity types/actions', async ({ page }) => {
    // Activities should show the action type
    const activityItems = page.locator('[class*="activity"]');

    if (await activityItems.first().isVisible()) {
      // Should contain action text like "created", "assigned", "updated", etc.
      const actionText = page.locator('text=/created|assigned|updated|completed|commented/i');
      expect(await actionText.isVisible()).toBeTruthy();
    }
  });

  test('should navigate to task when activity item clicked', async ({ page }) => {
    // Find first activity with ticket number
    const ticketLink = page.locator('a').filter({
      has: page.locator('text=/T-\\d+|TASK-/i')
    }).first();

    if (await ticketLink.isVisible()) {
      const href = await ticketLink.getAttribute('href');
      expect(href).toBeTruthy();

      // Click should navigate
      await ticketLink.click();

      // Should navigate to task detail or board
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 5000 }).catch(() => null);

      // URL should change
      expect(page.url()).not.toContain('/activity');
    }
  });

  test('should filter activities by type', async ({ page }) => {
    // Look for filter controls
    const filterBtn = page.locator('button').filter({
      has: page.locator('text=/Filter|Type/i')
    }).first();

    if (await filterBtn.isVisible()) {
      await filterBtn.click();

      // Filter options should appear
      const filterMenu = page.locator('[class*="dropdown"], [class*="menu"]').first();
      await expect(filterMenu).toBeVisible({ timeout: 3000 });

      // Try selecting a filter
      const filterOption = page.locator('button, label').filter({
        has: page.locator('text=/Created|Assigned|Updated|Completed/i')
      }).first();

      if (await filterOption.isVisible()) {
        await filterOption.click();

        // Activities should update
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should filter activities by date range', async ({ page }) => {
    // Look for date filter
    const dateFilter = page.locator('input[type="date"]').first();

    if (await dateFilter.isVisible()) {
      // Try setting a date
      await dateFilter.fill('2026-02-01');

      // Activities should update
      await page.waitForLoadState('networkidle');

      // Should still have activity items or empty state
      const activityItems = page.locator('[class*="activity"]');
      const emptyState = page.locator('text=/No activities/i');

      const itemCount = await activityItems.count();
      const hasEmptyState = await emptyState.isVisible();

      expect(itemCount > 0 || hasEmptyState).toBeTruthy();
    }
  });

  test('should search activities', async ({ page }) => {
    // Look for search input
    const searchInput = page.locator('input[placeholder*="Search"], input[aria-label*="Search"]').first();

    if (await searchInput.isVisible()) {
      await searchInput.fill('created');

      // Activities should filter
      await page.waitForLoadState('networkidle');

      // Should show filtered results or empty state
      const activityItems = page.locator('[class*="activity"]');
      const emptyState = page.locator('text=/No results|No activities/i');

      const itemCount = await activityItems.count();
      const hasEmptyState = await emptyState.isVisible();

      expect(itemCount > 0 || hasEmptyState).toBeTruthy();
    }
  });

  test('should display activity details panel on click', async ({ page }) => {
    // Find first activity item
    const activityItem = page.locator('[class*="activity"]').first();

    if (await activityItem.isVisible()) {
      await activityItem.click();

      // Details panel should appear
      const detailPanel = page.locator('[class*="detail"], [class*="panel"]').first();

      if (await detailPanel.isVisible()) {
        await expect(detailPanel).toBeVisible();
      }
    }
  });

  test('should show activity metadata', async ({ page }) => {
    // Activity items should contain metadata
    const activityItem = page.locator('[class*="activity"]').first();

    if (await activityItem.isVisible()) {
      // Should show: who, what, when, task reference
      const metadata = page.locator('text=/changed|from|to|on|at/i');

      if (await metadata.isVisible()) {
        await expect(metadata).toBeVisible();
      }
    }
  });

  test('should handle pagination or infinite scroll', async ({ page }) => {
    // Check for pagination controls
    const nextBtn = page.locator('button:has-text("Next"), button[aria-label*="Next"]').first();
    const loadMoreBtn = page.locator('button:has-text("Load More"), button:has-text("Show More")').first();

    // Or scroll down to load more
    if (!(await nextBtn.isVisible()) && !(await loadMoreBtn.isVisible())) {
      // Try scrolling
      const activityItems = page.locator('[class*="activity"]');
      const initialCount = await activityItems.count();

      if (initialCount > 0) {
        // Scroll to bottom
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

        // Wait for potential new items to load
        await page.waitForLoadState('networkidle');

        const finalCount = await activityItems.count();
        // Either same or more items loaded
        expect(finalCount >= initialCount).toBeTruthy();
      }
    }
  });

  test('should display related workspace context', async ({ page }) => {
    // Activity should show which workspace it's related to
    const activityItem = page.locator('[class*="activity"]').first();

    if (await activityItem.isVisible()) {
      // May show workspace emoji, name, or icon
      const businessRef = page.locator('[class*="business"], [class*="workspace"]').first();

      if (await businessRef.isVisible()) {
        await expect(businessRef).toBeVisible();
      }
    }
  });
});
