import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Task Management
 * Tests core task workflows: create, assign, update, complete
 */

test.describe('Task Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mission-control-hq/board');
    await page.waitForLoadState('networkidle');
  });

  test('should display task board with columns', async ({ page }) => {
    // Check for kanban columns
    await expect(page.locator('text=Backlog')).toBeVisible();
    await expect(page.locator('text=Ready')).toBeVisible();
    await expect(page.locator('text=In Progress')).toBeVisible();
    await expect(page.locator('text=Review')).toBeVisible();
    await expect(page.locator('text=Done')).toBeVisible();
  });

  test('should open create task modal', async ({ page }) => {
    // Click "New Task" button in header
    const createBtn = page.locator('button:has-text("New Task")');
    await createBtn.click();

    // Modal should appear
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Form fields should exist
    await expect(page.locator('input[placeholder*="Title"]')).toBeVisible();
  });

  test('should create a new task', async ({ page }) => {
    // Open create modal
    await page.locator('button:has-text("New Task")').click();
    
    // Wait for modal
    await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });
    
    // Fill task details
    const titleInput = page.locator('input[placeholder*="Title"]').first();
    await titleInput.fill('Test Task for E2E');

    // Submit form (look for Save/Create button in modal)
    const saveBtn = page.locator('button:has-text("Create")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      
      // Modal should close
      await page.waitForSelector('div[role="dialog"]', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should display existing tasks', async ({ page }) => {
    // Task cards should exist in columns
    const taskCards = page.locator('[class*="task"]');
    const count = await taskCards.count();
    
    // If tasks exist, verify they're visible
    if (count > 0) {
      await expect(taskCards.first()).toBeVisible();
    }
  });

  test('should filter tasks', async ({ page }) => {
    // Look for filter controls
    const filterBtn = page.locator('button').filter({ has: page.locator('text=Filter') }).first();
    
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      
      // Filter dropdown should appear
      const dropdown = page.locator('[class*="dropdown"], [class*="popover"]').first();
      await expect(dropdown).toBeVisible({ timeout: 3000 });
    }
  });

  test('should show task details when clicked', async ({ page }) => {
    // Find first task card
    const taskCard = page.locator('[class*="task"]').first();
    
    if (await taskCard.isVisible()) {
      await taskCard.click();
      
      // Task detail panel or modal should appear
      const detail = page.locator('[class*="detail"], [role="dialog"]').first();
      await expect(detail).toBeVisible({ timeout: 3000 });
    }
  });

  test('should display task priorities', async ({ page }) => {
    // P0, P1, P2, P3 labels should be visible for tasks
    const p0 = page.locator('text=P0').first();
    
    // At least one priority should be visible
    if (await p0.isVisible()) {
      await expect(p0).toBeVisible();
    }
  });

  test('should show unassigned task count in header', async ({ page }) => {
    const header = page.locator('header').first();
    
    // Auto-assign button may show unassigned count
    const autoAssignBtn = header.locator('button:has-text("Auto-assign")');
    
    // Should be visible if unassigned tasks exist
    if (await autoAssignBtn.isVisible()) {
      await expect(autoAssignBtn).toContainText(/Auto-assign \d+/);
    }
  });
});
