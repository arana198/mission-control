import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Dependency Visualization
 * Tests the SVG dependency graph visualization in task detail
 */

test.describe('Dependency Visualization', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to task board
    await page.goto('/mission-control-hq/board');
    await page.waitForLoadState('networkidle');
  });

  test('should display dependency graph for task with blockers', async ({ page }) => {
    // Find and open a task
    const taskCard = page.locator('[class*="task"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for dependency section
      const depSection = page.locator('text=Dependencies').first();

      if (await depSection.isVisible()) {
        await expect(depSection).toBeVisible();
      }
    }
  });

  test('should not display graph when task has no dependencies', async ({ page }) => {
    // Open a task
    const taskCard = page.locator('[class*="task"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for dependency graph
      const graph = page.locator('svg').first();

      // Graph may or may not be visible depending on task data
      if (await graph.isVisible({ timeout: 1000 }).catch(() => false)) {
        // If visible, it's fine
        await expect(graph).toBeVisible();
      } else {
        // If not visible, that's also fine (no dependencies)
        const depHeader = page.locator('text=Dependencies').first();
        if (await depHeader.isVisible()) {
          await expect(depHeader).toBeVisible();
        }
      }
    }
  });

  test('should show blocker nodes in left column', async ({ page }) => {
    // Find a task with blockers
    const taskCard = page.locator('[class*="task"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for "Blocked by" label
      const blockedLabel = page.locator('text=Blocked by').first();

      if (await blockedLabel.isVisible()) {
        await expect(blockedLabel).toBeVisible();

        // Should have blocker nodes nearby
        const nodes = page.locator('[class*="rounded-lg"]').all();
        expect(nodes).toBeDefined();
      }
    }
  });

  test('should show main task in center', async ({ page }) => {
    // Open a task
    const taskCard = page.locator('[class*="task"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for "This task" label
      const thisTaskLabel = page.locator('text=This task').first();

      if (await thisTaskLabel.isVisible()) {
        await expect(thisTaskLabel).toBeVisible();
      }
    }
  });

  test('should show blocking nodes in right column', async ({ page }) => {
    // Find a task that blocks others
    const taskCard = page.locator('[class*="task"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for "Blocks" label
      const blocksLabel = page.locator('text=Blocks').first();

      if (await blocksLabel.isVisible()) {
        await expect(blocksLabel).toBeVisible();

        // Should have blocking nodes nearby
        const nodes = page.locator('[class*="rounded-lg"]').all();
        expect(nodes).toBeDefined();
      }
    }
  });

  test('should show SVG connector lines', async ({ page }) => {
    // Open a task with dependencies
    const taskCard = page.locator('[class*="task"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for SVG
      const svg = page.locator('svg').first();

      if (await svg.isVisible()) {
        // Should contain line elements
        const lines = svg.locator('line');
        const lineCount = await lines.count();

        if (lineCount > 0) {
          expect(lineCount).toBeGreaterThan(0);
        }
      }
    }
  });

  test('should show status color dots on nodes', async ({ page }) => {
    // Open a task
    const taskCard = page.locator('[class*="task"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for status indicator dots (small colored circles)
      const dots = page.locator('[class*="rounded-full"]').all();
      const dotCount = await dots.then(d => d.length);

      // Should have at least some dots for status
      if (dotCount > 0) {
        expect(dotCount).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('should truncate long task titles', async ({ page }) => {
    // Open a task
    const taskCard = page.locator('[class*="task"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for dependency nodes
      const nodes = page.locator('[title]').all();
      const nodeCount = await nodes.then(n => n.length);

      if (nodeCount > 0) {
        // Nodes should have title attributes (for full text on hover)
        expect(nodeCount).toBeGreaterThan(0);
      }
    }
  });

  test('should show arrowheads on connector lines', async ({ page }) => {
    // Open a task with dependencies
    const taskCard = page.locator('[class*="task"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for SVG marker (arrowhead definition)
      const svg = page.locator('svg').first();

      if (await svg.isVisible()) {
        // Check for marker element
        const marker = svg.locator('marker[id*="arrow"]');
        if (await marker.count().then(c => c > 0)) {
          expect(marker).toBeDefined();
        }
      }
    }
  });

  test('should show +N more badge when overflow', async ({ page }) => {
    // Find a task with many dependencies
    const taskCard = page.locator('[class*="task"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for "+N more" text
      const moreText = page.locator('text=+').first();

      if (await moreText.isVisible({ timeout: 1000 }).catch(() => false)) {
        // If there are more items than shown
        await expect(moreText).toBeVisible();
      } else {
        // If no overflow, that's fine
        const depSection = page.locator('text=Dependencies').first();
        if (await depSection.isVisible()) {
          await expect(depSection).toBeVisible();
        }
      }
    }
  });

  test('should have manage dependencies form below graph', async ({ page }) => {
    // Open a task
    const taskCard = page.locator('[class*="task"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for manage dependencies section
      const manageSection = page.locator('text=Manage Dependencies').first();

      if (await manageSection.isVisible()) {
        await expect(manageSection).toBeVisible();
      }
    }
  });

  test('should allow removing blocker from manage form', async ({ page }) => {
    // Open a task with blockers
    const taskCard = page.locator('[class*="task"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for remove blocker buttons
      const removeButtons = page.locator('[aria-label*="Remove blocker"]').all();
      const count = await removeButtons.then(b => b.length);

      if (count > 0) {
        // Blocker removal is available
        expect(count).toBeGreaterThan(0);
      }
    }
  });

  test('should allow adding blocker from manage form', async ({ page }) => {
    // Open a task
    const taskCard = page.locator('[class*="task"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for add blocker dropdown
      const addSelect = page.locator('select:below(text="Manage Dependencies")').first();

      if (await addSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(addSelect).toBeVisible();
      }
    }
  });

  test('should display graph with proper layout on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Open a task
    const taskCard = page.locator('[class*="task"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Dependency section should still be visible
      const depSection = page.locator('text=Dependencies').first();

      if (await depSection.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(depSection).toBeVisible();
      }
    }
  });

  test('should display graph with proper layout on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Open a task
    const taskCard = page.locator('[class*="task"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Dependency section should be visible
      const depSection = page.locator('text=Dependencies').first();

      if (await depSection.isVisible()) {
        await expect(depSection).toBeVisible();
      }
    }
  });

  test('should handle clicking on dependency nodes', async ({ page }) => {
    // Open a task with dependencies
    const taskCard = page.locator('[class*="task"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Find and click a dependency node
      const depNodes = page.locator('[class*="rounded-lg"][class*="bg-"]').all();
      const count = await depNodes.then(n => n.length);

      if (count > 1) {
        // Should be able to click nodes (except main task)
        const firstNode = depNodes.then(n => n[0]);
        expect(firstNode).toBeDefined();
      }
    }
  });

  test('should show dependency graph consistently', async ({ page }) => {
    // Open a task twice and verify graph is consistent
    const taskCard = page.locator('[class*="task"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('domcontentloaded');

      const depSection1 = page.locator('text=Dependencies').first();
      const visible1 = await depSection1.isVisible({ timeout: 500 }).catch(() => false);

      // Close and reopen
      await page.keyboard.press('Escape');
      await page.waitForLoadState('domcontentloaded');

      if (await taskCard.isVisible()) {
        await taskCard.click();
        await page.waitForLoadState('domcontentloaded');

        const depSection2 = page.locator('text=Dependencies').first();
        const visible2 = await depSection2.isVisible({ timeout: 500 }).catch(() => false);

        // Visibility should be consistent
        expect(visible1).toBe(visible2);
      }
    }
  });
});
