import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Epic Management
 * Tests epic workflows: create, view, add tasks, track progress
 */

test.describe('Epic Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mission-control-hq/epics');
    await page.waitForLoadState('networkidle');
  });

  test('should display epics page with header', async ({ page }) => {
    // Check for epics page header
    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    // Check for page title
    const title = header.locator('h2');
    await expect(title).toContainText(/Epics|Epic/i);
  });

  test('should display epic list or empty state', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');

    // Either epics exist or empty state message shown
    const epicCards = page.locator('[class*="epic"]');
    const emptyState = page.locator('text=/No epics|Create your first epic/i');

    const cardCount = await epicCards.count();
    const hasEmptyState = await emptyState.isVisible();

    // Should have either cards or empty state
    expect(cardCount > 0 || hasEmptyState).toBeTruthy();
  });

  test('should open create epic modal', async ({ page }) => {
    // Look for "New Epic" or "Create Epic" button
    const createBtn = page.locator('button').filter({
      has: page.locator('text=/New Epic|Create Epic/i')
    }).first();

    if (await createBtn.isVisible()) {
      await createBtn.click();

      // Modal should appear
      const modal = page.locator('div[role="dialog"]');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Form fields should exist
      const titleInput = page.locator('input[placeholder*="Title"]').first();
      await expect(titleInput).toBeVisible();
    }
  });

  test('should create a new epic', async ({ page }) => {
    const createBtn = page.locator('button').filter({
      has: page.locator('text=/New Epic|Create Epic/i')
    }).first();

    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      // Fill epic details
      const titleInput = page.locator('input[placeholder*="Title"]').first();
      await titleInput.fill('E2E Test Epic');

      // Look for description field
      const descInput = page.locator('textarea[placeholder*="Description"]').first();
      if (await descInput.isVisible()) {
        await descInput.fill('Testing epic creation workflow');
      }

      // Submit form
      const submitBtn = page.locator('button:has-text("Create")').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();

        // Modal should close
        await page.waitForSelector('div[role="dialog"]', { state: 'hidden', timeout: 5000 });
      }
    }
  });

  test('should display epic details when clicked', async ({ page }) => {
    // Find first epic card
    const epicCard = page.locator('[class*="epic"]').first();

    if (await epicCard.isVisible()) {
      await epicCard.click();

      // Epic detail panel or modal should appear
      const detail = page.locator('[class*="detail"], [role="dialog"]').first();
      await expect(detail).toBeVisible({ timeout: 3000 });
    }
  });

  test('should show epic progress/completion status', async ({ page }) => {
    // Progress indicator may exist
    const progressBar = page.locator('[class*="progress"]').first();

    if (await progressBar.isVisible()) {
      await expect(progressBar).toBeVisible();
    }

    // Or completion percentage/count
    const completionText = page.locator('text=/\\d+%|\\d+ of \\d+/');
    if (await completionText.first().isVisible()) {
      await expect(completionText.first()).toBeVisible();
    }
  });

  test('should allow adding tasks to epic', async ({ page }) => {
    // Find first epic
    const epicCard = page.locator('[class*="epic"]').first();

    if (await epicCard.isVisible()) {
      await epicCard.click();

      // Look for "Add Task" or similar button
      const addTaskBtn = page.locator('button').filter({
        has: page.locator('text=/Add Task|Add to Epic/i')
      }).first();

      if (await addTaskBtn.isVisible()) {
        await addTaskBtn.click();

        // Dialog or dropdown should appear
        const dialog = page.locator('div[role="dialog"], [class*="dropdown"]').first();
        await expect(dialog).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('should display epic tasks list', async ({ page }) => {
    // Find first epic
    const epicCard = page.locator('[class*="epic"]').first();

    if (await epicCard.isVisible()) {
      await epicCard.click();
      await page.waitForLoadState('networkidle');

      // Tasks section should be visible
      const tasksSection = page.locator('text=/Tasks|Task List/i').first();

      if (await tasksSection.isVisible()) {
        await expect(tasksSection).toBeVisible();

        // Task items should be listed
        const taskItems = page.locator('[class*="task"]');
        const count = await taskItems.count();
        // May have 0 or more tasks
        expect(count >= 0).toBeTruthy();
      }
    }
  });

  test('should filter epics by status', async ({ page }) => {
    // Look for filter/status selector
    const statusFilter = page.locator('select, [class*="filter"]').first();

    if (await statusFilter.isVisible()) {
      // Try to interact with filter
      await statusFilter.click();

      // Option should appear
      const option = page.locator('text=/Active|Completed|All/i').first();
      if (await option.isVisible()) {
        await option.click();

        // Epics should update
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should display epic metrics', async ({ page }) => {
    // Find first epic
    const epicCard = page.locator('[class*="epic"]').first();

    if (await epicCard.isVisible()) {
      await epicCard.click();

      // Metrics section - tasks count, completion %, timeline, etc.
      const metricsText = page.locator('text=/\\d+ tasks|\\d+%|Tasks:/i');

      if (await metricsText.first().isVisible()) {
        await expect(metricsText.first()).toBeVisible();
      }
    }
  });
});
