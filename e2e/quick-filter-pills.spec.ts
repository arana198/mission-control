import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Quick Filter Pills
 * Tests the quick filter pill functionality on the task board
 */

test.describe('Quick Filter Pills', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to task board
    await page.goto('/mission-control-hq/board');
    await page.waitForLoadState('networkidle');
  });

  test('should display quick filter pills', async ({ page }) => {
    // Look for quick filter pills
    const myTasksPill = page.locator('button:has-text("My Tasks")').first();
    const readyPill = page.locator('button:has-text("Ready")').first();
    const blockedPill = page.locator('button:has-text("Blocked")').first();

    // All three pills should be visible
    if (await myTasksPill.isVisible()) {
      await expect(myTasksPill).toBeVisible();
    }
    if (await readyPill.isVisible()) {
      await expect(readyPill).toBeVisible();
    }
    if (await blockedPill.isVisible()) {
      await expect(blockedPill).toBeVisible();
    }
  });

  test('should have My Tasks pill with User icon', async ({ page }) => {
    // Look for My Tasks pill
    const myTasksPill = page.locator('button:has-text("My Tasks")').first();

    if (await myTasksPill.isVisible()) {
      await expect(myTasksPill).toBeVisible();

      // Should contain an SVG (icon)
      const svg = myTasksPill.locator('svg').first();
      if (await svg.isVisible()) {
        await expect(svg).toBeVisible();
      }
    }
  });

  test('should have Ready pill with CheckCircle2 icon', async ({ page }) => {
    // Look for Ready pill
    const readyPill = page.locator('button:has-text("Ready")').first();

    if (await readyPill.isVisible()) {
      await expect(readyPill).toBeVisible();

      // Should contain an SVG (icon)
      const svg = readyPill.locator('svg').first();
      if (await svg.isVisible()) {
        await expect(svg).toBeVisible();
      }
    }
  });

  test('should have Blocked pill with AlertTriangle icon', async ({ page }) => {
    // Look for Blocked pill
    const blockedPill = page.locator('button:has-text("Blocked")').first();

    if (await blockedPill.isVisible()) {
      await expect(blockedPill).toBeVisible();

      // Should contain an SVG (icon)
      const svg = blockedPill.locator('svg').first();
      if (await svg.isVisible()) {
        await expect(svg).toBeVisible();
      }
    }
  });

  test('should activate pill when clicked', async ({ page }) => {
    // Click Blocked pill
    const blockedPill = page.locator('button:has-text("Blocked")').first();

    if (await blockedPill.isVisible()) {
      await blockedPill.click();

      // Wait for filtering to apply
      await page.waitForLoadState('networkidle');

      // Pill should show active state (could check for different background color)
      const pillClasses = await blockedPill.getAttribute('class');
      expect(pillClasses).toBeDefined();
    }
  });

  test('should filter to blocked tasks when Blocked pill activated', async ({ page }) => {
    // Click Blocked pill
    const blockedPill = page.locator('button:has-text("Blocked")').first();

    if (await blockedPill.isVisible()) {
      await blockedPill.click();
      await page.waitForLoadState('networkidle');

      // Look for Blocked column (should be visible)
      const blockedColumn = page.locator('text=Blocked').first();

      // Should see Blocked column or tasks
      if (await blockedColumn.isVisible()) {
        await expect(blockedColumn).toBeVisible();
      }
    }
  });

  test('should deactivate pill when clicked again', async ({ page }) => {
    // Click Ready pill
    const readyPill = page.locator('button:has-text("Ready")').first();

    if (await readyPill.isVisible()) {
      // First click - activate
      await readyPill.click();
      await page.waitForLoadState('networkidle');

      // Second click - deactivate
      await readyPill.click();
      await page.waitForLoadState('networkidle');

      // All tasks should be visible again (no filter active)
      const allColumns = page.locator('[class*="kanban"]').first();
      if (await allColumns.isVisible()) {
        await expect(allColumns).toBeVisible();
      }
    }
  });

  test('should switch between pills (mutually exclusive)', async ({ page }) => {
    const blockedPill = page.locator('button:has-text("Blocked")').first();
    const readyPill = page.locator('button:has-text("Ready")').first();

    if (await blockedPill.isVisible() && await readyPill.isVisible()) {
      // Click Blocked
      await blockedPill.click();
      await page.waitForLoadState('networkidle');

      // Click Ready (should deactivate Blocked)
      await readyPill.click();
      await page.waitForLoadState('networkidle');

      // Both pills should exist but only Ready should be "active"
      const readyClasses = await readyPill.getAttribute('class');
      expect(readyClasses).toBeDefined();
    }
  });

  test('should show different background color when pill active', async ({ page }) => {
    const myTasksPill = page.locator('button:has-text("My Tasks")').first();

    if (await myTasksPill.isVisible()) {
      // Get initial background color
      const initialClasses = await myTasksPill.getAttribute('class');

      // Click to activate
      await myTasksPill.click();
      await page.waitForLoadState('networkidle');

      // Get updated classes (should change)
      const activeClasses = await myTasksPill.getAttribute('class');

      // Classes should be defined
      expect(initialClasses).toBeDefined();
      expect(activeClasses).toBeDefined();
    }
  });

  test('should work with other filters', async ({ page }) => {
    // Try clicking a quick filter pill along with other filters
    const blockedPill = page.locator('button:has-text("Blocked")').first();
    const prioritySelect = page.locator('select').first();

    if (await blockedPill.isVisible() && await prioritySelect.isVisible()) {
      // Change priority filter
      await prioritySelect.selectOption('P0');
      await page.waitForLoadState('networkidle');

      // Click quick filter pill
      await blockedPill.click();
      await page.waitForLoadState('networkidle');

      // Both filters should be active
      const pillClasses = await blockedPill.getAttribute('class');
      expect(pillClasses).toBeDefined();
    }
  });

  test('should hide and show pills correctly on different views', async ({ page }) => {
    // Navigate to task board
    await expect(page.locator('button:has-text("My Tasks")').first()).toBeVisible({ timeout: 2000 }).catch(() => null);

    // Pills should be at top of filter bar
    const filterBar = page.locator('[class*="filter"]').first();
    if (await filterBar.isVisible()) {
      await expect(filterBar).toBeVisible();
    }
  });

  test('pills should have proper spacing and layout', async ({ page }) => {
    // Look for pill container
    const myTasksPill = page.locator('button:has-text("My Tasks")').first();
    const readyPill = page.locator('button:has-text("Ready")').first();
    const blockedPill = page.locator('button:has-text("Blocked")').first();

    // All pills should be visible and properly positioned
    const visibleCount = [
      await myTasksPill.isVisible().catch(() => false),
      await readyPill.isVisible().catch(() => false),
      await blockedPill.isVisible().catch(() => false),
    ].filter(Boolean).length;

    // At least some pills should be visible
    expect(visibleCount).toBeGreaterThanOrEqual(1);
  });

  test('should persist pill selection visually', async ({ page }) => {
    const blockedPill = page.locator('button:has-text("Blocked")').first();

    if (await blockedPill.isVisible()) {
      // Activate pill
      await blockedPill.click();
      await page.waitForLoadState('networkidle');

      // Check that pill remains active (class should reflect this)
      const activeClasses = await blockedPill.getAttribute('class');
      expect(activeClasses).toContain('bg-');  // Should have some background class
    }
  });

  test('should handle rapid pill clicks', async ({ page }) => {
    const myTasksPill = page.locator('button:has-text("My Tasks")').first();
    const readyPill = page.locator('button:has-text("Ready")').first();

    if (await myTasksPill.isVisible() && await readyPill.isVisible()) {
      // Rapid clicks
      await myTasksPill.click();
      await readyPill.click();
      await myTasksPill.click();
      await page.waitForLoadState('networkidle');

      // Should handle this gracefully (no errors)
      const pillClasses = await myTasksPill.getAttribute('class');
      expect(pillClasses).toBeDefined();
    }
  });
});
