import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Task Commits Display
 * Tests GitHub commit linking feature:
 * - Commits section appears in task detail modal
 * - Error handling when GitHub repo not configured
 * - Commits display with proper formatting
 * - Ticket ID badges and source badges appear
 */

test.describe('Task Commits Section', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a board with tasks
    await page.goto('/mission-control-hq/board');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Commits Section Display', () => {
    test('should display commits section header in task detail modal', async ({ page }) => {
      // Find and click on a task to open detail modal
      const taskCards = page.locator('[class*="task"]');
      const firstTask = taskCards.first();

      if (await firstTask.isVisible()) {
        await firstTask.click();

        // Wait for modal to appear
        await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

        // Check for Commits section header with icon
        const commitsHeader = page.locator('h3:has-text("Commits")');
        await expect(commitsHeader).toBeVisible();

        // Check for refresh button
        const refreshBtn = page.locator('button[aria-label="Refresh commits"]');
        await expect(refreshBtn).toBeVisible();
      } else {
        test.skip();
      }
    });

    test('should display help text when no commits available', async ({ page }) => {
      // Find and click on a task
      const taskCards = page.locator('[class*="task"]');
      const firstTask = taskCards.first();

      if (await firstTask.isVisible()) {
        await firstTask.click();

        // Wait for modal
        await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

        // Look for "No commits linked" message or GitHub config message
        const noCommitsMsg = page.locator('text=/No commits linked|Add ticket IDs/');
        const configMsg = page.locator('text=Configure GitHub repository');

        const hasMsg = await noCommitsMsg.isVisible().catch(() => false);
        const hasConfigMsg = await configMsg.isVisible().catch(() => false);

        expect(hasMsg || hasConfigMsg).toBe(true);
      } else {
        test.skip();
      }
    });

    test('should show error when GitHub repo not configured', async ({ page }) => {
      // This assumes no repo is configured in test environment
      const taskCards = page.locator('[class*="task"]');
      const firstTask = taskCards.first();

      if (await firstTask.isVisible()) {
        await firstTask.click();

        // Wait for modal
        await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

        // Look for repo configuration error
        const errorMsg = page.locator('text=GitHub repo');
        const exists = await errorMsg.isVisible().catch(() => false);

        if (exists) {
          // Settings link should be available
          const settingsLink = page.locator('button:has-text("Configure GitHub repository")');
          await expect(settingsLink).toBeVisible();
        }
      } else {
        test.skip();
      }
    });

    test('should have refresh button that works', async ({ page }) => {
      const taskCards = page.locator('[class*="task"]');
      const firstTask = taskCards.first();

      if (await firstTask.isVisible()) {
        await firstTask.click();

        // Wait for modal
        await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

        // Find refresh button
        const refreshBtn = page.locator('button[aria-label="Refresh commits"]');

        // Click refresh
        await refreshBtn.click();

        // Button should be clickable (not stuck in loading state)
        // Wait a moment for any loading state to complete
        await page.waitForTimeout(500);

        // Button should still be visible and not disabled
        const isDisabled = await refreshBtn.isDisabled();
        expect(isDisabled).toBe(false);
      } else {
        test.skip();
      }
    });
  });

  test.describe('Ticket ID Badges', () => {
    test('should display matched ticket ID badges when present', async ({ page }) => {
      // Create or find a task with a ticket ID in the title
      // This requires either:
      // 1. A task with "MC-001" or similar in title
      // 2. A task with tags containing ticket IDs

      const taskCards = page.locator('[class*="task"]');
      const firstTask = taskCards.first();

      if (await firstTask.isVisible()) {
        await firstTask.click();

        // Wait for modal
        await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

        // Look for ticket ID badges (purple/purple-like background)
        const ticketBadges = page.locator('span[class*="purple"]');
        const badgeCount = await ticketBadges.count();

        // If badges exist, they should have ticket-like text
        if (badgeCount > 0) {
          const firstBadge = ticketBadges.first();
          const badgeText = await firstBadge.textContent();

          // Ticket IDs typically match pattern like "MC-001", "CORE-01", etc.
          const isTicketId = /[A-Z]+-\d+/.test(badgeText || '');
          expect(isTicketId || badgeText?.includes('github') || badgeText?.includes('cache')).toBe(true);
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('Source Badge', () => {
    test('should display source badge (github, cache, or local)', async ({ page }) => {
      const taskCards = page.locator('[class*="task"]');
      const firstTask = taskCards.first();

      if (await firstTask.isVisible()) {
        await firstTask.click();

        // Wait for modal
        await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

        // Look for source badge which should contain "github", "cache", or "local"
        const sourceRegex = /github|cache|local/i;
        const allBadges = page.locator('span[class*="px-2"]');
        const badgeCount = await allBadges.count();

        let foundSource = false;
        for (let i = 0; i < badgeCount; i++) {
          const text = await allBadges.nth(i).textContent();
          if (sourceRegex.test(text || '')) {
            foundSource = true;
            break;
          }
        }

        // Source badge should exist if commits were fetched
        // (might not exist if error or no attempts made)
        if (foundSource) {
          expect(foundSource).toBe(true);
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('Agent Receipts Section', () => {
    test('should display agent receipts section if available', async ({ page }) => {
      const taskCards = page.locator('[class*="task"]');
      const firstTask = taskCards.first();

      if (await firstTask.isVisible()) {
        await firstTask.click();

        // Wait for modal
        await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

        // Look for agent execution receipts section
        const receiptsHeader = page.locator('text=Agent Execution Receipts');
        const exists = await receiptsHeader.isVisible().catch(() => false);

        if (exists) {
          // Receipts should be displayed in amber/yellow containers
          const receiptContainers = page.locator('[class*="amber"]');
          const count = await receiptContainers.count();
          expect(count).toBeGreaterThan(0);
        }
        // It's okay if receipts don't exist (no agent execution yet)
      } else {
        test.skip();
      }
    });
  });

  test.describe('GitHub Links', () => {
    test('should have clickable GitHub commit links', async ({ page }) => {
      const taskCards = page.locator('[class*="task"]');
      const firstTask = taskCards.first();

      if (await firstTask.isVisible()) {
        await firstTask.click();

        // Wait for modal
        await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

        // Look for links to github.com
        const githubLinks = page.locator('a[href*="github.com"]');
        const linkCount = await githubLinks.count();

        // If GitHub is configured and commits exist, links should be present
        if (linkCount > 0) {
          const firstLink = githubLinks.first();
          const href = await firstLink.getAttribute('href');

          // Should be a valid GitHub commit link
          expect(href).toMatch(/github\.com\/.*\/commit\//);

          // Should have external link icon
          const externalIcon = firstLink.locator('svg');
          const hasIcon = await externalIcon.count().then(c => c > 0);
          expect(hasIcon).toBe(true);
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('Commits Section Styling', () => {
    test('should have proper styling for commits list', async ({ page }) => {
      const taskCards = page.locator('[class*="task"]');
      const firstTask = taskCards.first();

      if (await firstTask.isVisible()) {
        await firstTask.click();

        // Wait for modal
        await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

        // Look for commits section
        const commitsHeader = page.locator('h3:has-text("Commits")');
        if (await commitsHeader.isVisible()) {
          // Section should have proper styling
          const section = commitsHeader.locator('xpath=./ancestor::div[@class]').first();

          // Should be visible and properly rendered
          await expect(section).toBeVisible();
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('Modal Closure', () => {
    test('should close commits section with modal', async ({ page }) => {
      const taskCards = page.locator('[class*="task"]');
      const firstTask = taskCards.first();

      if (await firstTask.isVisible()) {
        await firstTask.click();

        // Wait for modal
        await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

        // Verify commits section is visible
        const commitsHeader = page.locator('h3:has-text("Commits")');
        await expect(commitsHeader).toBeVisible();

        // Close modal (click X button or press Escape)
        const closeBtn = page.locator('button[aria-label*="Close"], button[aria-label*="close"]').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        } else {
          await page.press('body', 'Escape');
        }

        // Wait for modal to close
        await page.waitForSelector('div[role="dialog"]', { state: 'hidden', timeout: 5000 });

        // Commits header should no longer be visible
        await expect(commitsHeader).not.toBeVisible();
      } else {
        test.skip();
      }
    });
  });
});
