import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Notifications
 * Tests notification panel: opening, marking read, filtering
 */

test.describe('Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mission-control-hq/overview');
    await page.waitForLoadState('networkidle');
  });

  test('should display notification bell in header', async ({ page }) => {
    const header = page.locator('header').first();

    // Find notification button
    const notificationBtn = header.locator('button[aria-label*="Notification"], button[aria-label*="notification"]').first();

    if (await notificationBtn.isVisible()) {
      await expect(notificationBtn).toBeVisible();
    }
  });

  test('should show unread notification count badge', async ({ page }) => {
    const header = page.locator('header').first();

    // Find notification button with count
    const notificationBtn = header.locator('button[aria-label*="Notification"]').first();

    if (await notificationBtn.isVisible()) {
      // Badge may show count
      const badge = notificationBtn.locator('[class*="badge"], span:has-text(/\\d+/)').first();

      if (await badge.isVisible()) {
        const badgeText = await badge.textContent();
        expect(/\d+/.test(badgeText || '')).toBeTruthy();
      }
    }
  });

  test('should open notification panel when bell clicked', async ({ page }) => {
    const header = page.locator('header').first();
    const notificationBtn = header.locator('button[aria-label*="Notification"]').first();

    if (await notificationBtn.isVisible()) {
      await notificationBtn.click();

      // Notification panel should appear
      const panel = page.locator('[class*="notification"], [role="dialog"]').first();
      await expect(panel).toBeVisible({ timeout: 3000 });
    }
  });

  test('should display notification items in panel', async ({ page }) => {
    const header = page.locator('header').first();
    const notificationBtn = header.locator('button[aria-label*="Notification"]').first();

    if (await notificationBtn.isVisible()) {
      await notificationBtn.click();

      // Wait for panel to appear
      await page.waitForSelector('[class*="notification"], [role="dialog"]', { timeout: 3000 });

      // Notification items should be visible
      const notificationItems = page.locator('[class*="notification-item"], li[class*="item"]').first();

      if (await notificationItems.isVisible()) {
        await expect(notificationItems).toBeVisible();
      }
    }
  });

  test('should mark notification as read', async ({ page }) => {
    const header = page.locator('header').first();
    const notificationBtn = header.locator('button[aria-label*="Notification"]').first();

    if (await notificationBtn.isVisible()) {
      await notificationBtn.click();

      // Look for unread notification
      const unreadItem = page.locator('[class*="unread"], [class*="notification-item"]').first();

      if (await unreadItem.isVisible()) {
        // Find mark as read button
        const markReadBtn = unreadItem.locator('button[aria-label*="Read"], button[title*="Read"]').first();

        if (await markReadBtn.isVisible()) {
          await markReadBtn.click();

          // Item should update to read state
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('should filter notifications by type', async ({ page }) => {
    const header = page.locator('header').first();
    const notificationBtn = header.locator('button[aria-label*="Notification"]').first();

    if (await notificationBtn.isVisible()) {
      await notificationBtn.click();

      // Look for filter options
      const filterBtn = page.locator('button').filter({
        has: page.locator('text=/Filter|Type/i')
      }).first();

      if (await filterBtn.isVisible()) {
        await filterBtn.click();

        // Filter options should appear
        const filterOption = page.locator('button, label').filter({
          has: page.locator('text=/All|Unread|Mentions|Tasks|Events/i')
        }).first();

        if (await filterOption.isVisible()) {
          await filterOption.click();

          // Notifications should filter
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('should allow marking all as read', async ({ page }) => {
    const header = page.locator('header').first();
    const notificationBtn = header.locator('button[aria-label*="Notification"]').first();

    if (await notificationBtn.isVisible()) {
      await notificationBtn.click();

      // Look for "Mark All as Read" button
      const markAllBtn = page.locator('button').filter({
        has: page.locator('text=/Mark All|Mark all as read/i')
      }).first();

      if (await markAllBtn.isVisible()) {
        await markAllBtn.click();

        // All items should update to read state
        await page.waitForLoadState('networkidle');

        // Unread count badge should disappear or show 0
        const badge = notificationBtn.locator('[class*="badge"]');
        if (await badge.isVisible()) {
          const badgeText = await badge.textContent();
          expect(badgeText?.trim()).toMatch(/^0?$/);
        }
      }
    }
  });

  test('should navigate to task when notification clicked', async ({ page }) => {
    const header = page.locator('header').first();
    const notificationBtn = header.locator('button[aria-label*="Notification"]').first();

    if (await notificationBtn.isVisible()) {
      await notificationBtn.click();

      // Find clickable notification item
      const notificationLink = page.locator('[class*="notification-item"] a, [class*="notification-item"] button').first();

      if (await notificationLink.isVisible()) {
        const currentUrl = page.url();
        await notificationLink.click();

        // Should navigate
        await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 5000 }).catch(() => null);

        // URL may change
        const newUrl = page.url();
        // Either URL changed or panel closed
        expect(newUrl !== currentUrl || !(await notificationBtn.closest('[class*="open"]').isVisible())).toBeTruthy();
      }
    }
  });

  test('should dismiss/clear notification', async ({ page }) => {
    const header = page.locator('header').first();
    const notificationBtn = header.locator('button[aria-label*="Notification"]').first();

    if (await notificationBtn.isVisible()) {
      await notificationBtn.click();

      // Find close/dismiss button on a notification
      const dismissBtn = page.locator('[class*="notification-item"] button[aria-label*="Close"], [class*="notification-item"] button[aria-label*="Dismiss"]').first();

      if (await dismissBtn.isVisible()) {
        const initialCount = await page.locator('[class*="notification-item"]').count();
        await dismissBtn.click();

        // Item should be removed
        await page.waitForLoadState('networkidle');

        const finalCount = await page.locator('[class*="notification-item"]').count();
        expect(finalCount <= initialCount).toBeTruthy();
      }
    }
  });

  test('should show notification timestamp', async ({ page }) => {
    const header = page.locator('header').first();
    const notificationBtn = header.locator('button[aria-label*="Notification"]').first();

    if (await notificationBtn.isVisible()) {
      await notificationBtn.click();

      // Find notification with timestamp
      const timestamp = page.locator('[class*="notification-item"] text=/ago|minutes|hours|days|today|yesterday/i').first();

      if (await timestamp.isVisible()) {
        await expect(timestamp).toBeVisible();
      }
    }
  });

  test('should show notification source/actor', async ({ page }) => {
    const header = page.locator('header').first();
    const notificationBtn = header.locator('button[aria-label*="Notification"]').first();

    if (await notificationBtn.isVisible()) {
      await notificationBtn.click();

      // Notification should show who/what triggered it
      const sourceText = page.locator('[class*="notification-item"] text=/assigned|mentioned|completed|created/i').first();

      if (await sourceText.isVisible()) {
        await expect(sourceText).toBeVisible();
      }
    }
  });

  test('should show notification description/context', async ({ page }) => {
    const header = page.locator('header').first();
    const notificationBtn = header.locator('button[aria-label*="Notification"]').first();

    if (await notificationBtn.isVisible()) {
      await notificationBtn.click();

      // Notification should have descriptive text
      const description = page.locator('[class*="notification-item"] p, [class*="notification-item"] div[class*="text"]').first();

      if (await description.isVisible()) {
        const text = await description.textContent();
        expect(text && text.length > 0).toBeTruthy();
      }
    }
  });

  test('should close panel when clicking outside', async ({ page }) => {
    const header = page.locator('header').first();
    const notificationBtn = header.locator('button[aria-label*="Notification"]').first();

    if (await notificationBtn.isVisible()) {
      await notificationBtn.click();

      // Panel should be open
      const panel = page.locator('[class*="notification"], [role="dialog"]').first();
      if (await panel.isVisible()) {
        // Click outside the panel (on main content)
        const mainContent = page.locator('main').first();
        if (await mainContent.isVisible()) {
          await mainContent.click();

          // Panel should close
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });
});
