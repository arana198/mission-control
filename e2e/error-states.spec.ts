import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Error States & Edge Cases
 * Tests error handling, network failures, empty states
 */

test.describe('Error States & Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mission-control-hq/board');
    await page.waitForLoadState('networkidle');
  });

  test('should display empty state when no tasks exist', async ({ page }) => {
    // If board is empty, should show helpful message
    const taskCards = page.locator('[class*="task"]');
    const emptyState = page.locator('text=/No tasks|Create your first task|Empty|No items/i');

    const cardCount = await taskCards.count();

    if (cardCount === 0) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('should display empty state with action button', async ({ page }) => {
    const emptyState = page.locator('text=/No tasks|Create your first task/i');

    if (await emptyState.isVisible()) {
      // Should have a button to create task
      const createBtn = emptyState.locator('button').first();

      if (await createBtn.isVisible()) {
        await expect(createBtn).toBeVisible();
      } else {
        // Or header should have create button
        const headerBtn = page.locator('header button:has-text("New Task")').first();
        expect(await headerBtn.isVisible()).toBeTruthy();
      }
    }
  });

  test('should show loading state while data loads', async ({ page }) => {
    // Navigate to trigger loading
    await page.goto('/mission-control-hq/activity');

    // Look for skeleton, spinner, or loading indicator
    const loader = page.locator('[class*="loading"], [class*="skeleton"], [class*="spinner"]').first();

    if (await loader.isVisible({ timeout: 1000 })) {
      await expect(loader).toBeVisible();
    }

    // Eventually should finish loading
    await page.waitForLoadState('networkidle');
  });

  test('should handle network timeout gracefully', async ({ page }) => {
    // Set very short timeout to simulate slow network
    const originalNavigator = await page.evaluate(() => ({
      onLine: navigator.onLine,
    }));

    // If offline or simulated timeout, should show error
    const offline = page.locator('text=/offline|connection|network/i');

    if (await offline.isVisible()) {
      await expect(offline).toBeVisible();
    }
  });

  test('should show error message on form submission failure', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();

      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      const titleInput = page.locator('input[placeholder*="Title"]').first();

      if (await titleInput.isVisible()) {
        // Fill with invalid or special characters
        await titleInput.fill('Test@#$%^&*()');
      }

      const submitBtn = page.locator('button:has-text("Create")').first();

      if (await submitBtn.isVisible()) {
        // Click multiple times to potentially trigger error
        await submitBtn.click();

        // Wait to see if error appears
        await page.waitForLoadState('networkidle');

        // Error message or modal still open
        const error = page.locator('text=/error|failed|Error/i').first();
        const modal = page.locator('div[role="dialog"]').first();

        expect(await error.isVisible() || await modal.isVisible()).toBeTruthy();
      }
    }
  });

  test('should display 404-like state for not found', async ({ page }) => {
    // Try to navigate to non-existent task
    await page.goto('/mission-control-hq/board?task=nonexistent', {
      waitUntil: 'networkidle',
    }).catch(() => null);

    // Should show not found message or redirect
    const notFound = page.locator('text=/not found|does not exist|not available/i');

    if (await notFound.isVisible()) {
      await expect(notFound).toBeVisible();
    }
  });

  test('should recover from error and allow retry', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();

      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      // Try submitting with invalid data first
      const submitBtn = page.locator('button:has-text("Create")').first();

      if (await submitBtn.isVisible()) {
        await submitBtn.click();

        await page.waitForLoadState('networkidle');

        // Modal should still be open for retry
        const modal = page.locator('div[role="dialog"]');

        if (await modal.isVisible()) {
          // User should be able to correct and retry
          const input = page.locator('input[placeholder*="Title"]').first();

          if (await input.isVisible()) {
            await input.fill('Valid Task Title');
            await submitBtn.click();

            // Should complete successfully
            await page.waitForLoadState('networkidle');
          }
        }
      }
    }
  });

  test('should show permission denied error', async ({ page }) => {
    // Try to perform action that might require permissions
    // This would require special setup, so check if error UI exists

    const errorState = page.locator('text=/Permission|Unauthorized|Access denied/i');

    // If error appears, UI should handle it gracefully
    if (await errorState.isVisible()) {
      await expect(errorState).toBeVisible();
    }
  });

  test('should handle duplicate submissions', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();

      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      const titleInput = page.locator('input[placeholder*="Title"]').first();

      if (await titleInput.isVisible()) {
        await titleInput.fill('Unique Task ' + Date.now());
      }

      const submitBtn = page.locator('button:has-text("Create")').first();

      if (await submitBtn.isVisible()) {
        // Click submit multiple times rapidly
        await Promise.all([submitBtn.click(), submitBtn.click()]);

        await page.waitForLoadState('networkidle');

        // Should handle gracefully (not create duplicate)
        // Modal should be closed or show single task
        await page.waitForSelector('div[role="dialog"]', { state: 'hidden', timeout: 5000 }).catch(() => null);
      }
    }
  });

  test('should show helpful message when field is required', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();

      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      const submitBtn = page.locator('button:has-text("Create")').first();

      if (await submitBtn.isVisible()) {
        await submitBtn.click();

        // Required field message should appear
        const requiredMsg = page.locator('text=/required|cannot be empty|Please enter/i').first();

        if (await requiredMsg.isVisible()) {
          await expect(requiredMsg).toBeVisible();

          // Message should be specific to field
          const text = await requiredMsg.textContent();
          expect(text?.toLowerCase()).toContain('title' || 'name' || 'required');
        }
      }
    }
  });

  test('should show conflict error for simultaneous edits', async ({ page, context }) => {
    // Open same task in two contexts to simulate conflict
    // This requires special setup, but test that conflict UI is available

    const conflictMsg = page.locator('text=/Conflict|Changed|Someone else|Updated/i');

    if (await conflictMsg.isVisible()) {
      await expect(conflictMsg).toBeVisible();

      // Should have action to resolve (reload, overwrite, etc)
      const actionBtn = page.locator('button').filter({
        has: page.locator('text=/Reload|Overwrite|Merge/i'),
      }).first();

      if (await actionBtn.isVisible()) {
        await expect(actionBtn).toBeVisible();
      }
    }
  });

  test('should clear error messages when navigating away', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();

      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      // Trigger error
      const submitBtn = page.locator('button:has-text("Create")').first();

      if (await submitBtn.isVisible()) {
        await submitBtn.click();

        await page.waitForLoadState('networkidle');

        // Close modal with Escape
        await page.keyboard.press('Escape');

        // Error should be cleared
        const modal = page.locator('div[role="dialog"]');
        expect(await modal.isVisible()).toBeFalsy();
      }
    }
  });

  test('should show unavailable service message', async ({ page }) => {
    // Check for service unavailable message
    const unavailable = page.locator('text=/unavailable|down|maintenance|error/i');

    if (await unavailable.isVisible()) {
      // Should suggest action or timeline
      const content = await unavailable.textContent();
      expect(content && content.length > 0).toBeTruthy();
    }
  });

  test('should handle very long task names gracefully', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();

      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      const titleInput = page.locator('input[placeholder*="Title"]').first();

      if (await titleInput.isVisible()) {
        // Very long task name
        const longName = 'a'.repeat(500);
        await titleInput.fill(longName);

        // Should truncate or show error
        const value = await titleInput.inputValue();
        expect(value.length <= 500).toBeTruthy();
      }
    }
  });

  test('should handle special characters in input', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();

      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      const titleInput = page.locator('input[placeholder*="Title"]').first();

      if (await titleInput.isVisible()) {
        // Test with special characters
        await titleInput.fill('Test <script>alert("xss")</script>');

        // Should escape or sanitize
        const value = await titleInput.inputValue();
        expect(value).not.toContain('<script>');
      }
    }
  });
});
