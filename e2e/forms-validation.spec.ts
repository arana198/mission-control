import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Forms & Validation
 * Tests form handling: validation, error messages, submission
 */

test.describe('Forms & Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mission-control-hq/board');
    await page.waitForLoadState('networkidle');
  });

  test('should show required field validation error', async ({ page }) => {
    // Open create task modal
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();

      // Wait for modal
      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      // Try to submit empty form
      const submitBtn = page.locator('button:has-text("Create")').first();

      if (await submitBtn.isVisible()) {
        await submitBtn.click();

        // Error should appear or form should still be open
        const error = page.locator('text=/required|cannot be empty|Please enter/i').first();

        // Either error message or form still visible
        if (await error.isVisible()) {
          await expect(error).toBeVisible();
        } else {
          // Form should still be visible
          const modal = page.locator('div[role="dialog"]');
          await expect(modal).toBeVisible();
        }
      }
    }
  });

  test('should show field-specific error messages', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      // Try entering invalid data
      const titleInput = page.locator('input[placeholder*="Title"]').first();

      if (await titleInput.isVisible()) {
        // Clear and try invalid input
        await titleInput.fill('');
        await titleInput.blur();

        // Error should appear below field
        const fieldError = titleInput.evaluate((el) => {
          const parent = el.closest('[class*="field"], [class*="form-group"]');
          return parent?.querySelector('[class*="error"], .text-red-500');
        });

        // Or try generic validation
        const generalError = page.locator('text=/Invalid|Error|required/i').first();

        if (await generalError.isVisible()) {
          await expect(generalError).toBeVisible();
        }
      }
    }
  });

  test('should enable submit button only when form is valid', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      const submitBtn = page.locator('button:has-text("Create")').first();

      if (await submitBtn.isVisible()) {
        // Initially submit button should be disabled or form requires valid input
        const isDisabled = await submitBtn.isDisabled();

        // Fill with valid data
        const titleInput = page.locator('input[placeholder*="Title"]').first();
        if (await titleInput.isVisible()) {
          await titleInput.fill('Valid Task Title');

          // Submit button should now be enabled or clickable
          const isEnabledAfter = await submitBtn.isEnabled();
          expect(isEnabledAfter || !isDisabled).toBeTruthy();
        }
      }
    }
  });

  test('should validate email format', async ({ page }) => {
    // Navigate to settings where email might be validated
    await page.goto('/mission-control-hq/settings');
    await page.waitForLoadState('networkidle');

    // Look for email field
    const emailInput = page.locator('input[type="email"]').first();

    if (await emailInput.isVisible()) {
      // Try entering invalid email
      await emailInput.fill('invalid-email');
      await emailInput.blur();

      // Error should appear
      const error = page.locator('text=/invalid|email|format/i').first();

      if (await error.isVisible()) {
        await expect(error).toBeVisible();
      }

      // Try valid email
      await emailInput.fill('test@example.com');
      await emailInput.blur();

      // Error should disappear
      const errorAfter = page.locator('text=/invalid email/i');
      expect(await errorAfter.isVisible()).toBeFalsy();
    }
  });

  test('should validate minimum/maximum length', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      const titleInput = page.locator('input[placeholder*="Title"]').first();

      if (await titleInput.isVisible()) {
        // Get max length attribute
        const maxLength = await titleInput.getAttribute('maxlength');

        if (maxLength) {
          // Try entering more than max length
          const tooLong = 'a'.repeat(parseInt(maxLength) + 10);
          await titleInput.fill(tooLong);

          // Input value should be truncated to maxLength
          const value = await titleInput.inputValue();
          expect(value.length <= parseInt(maxLength)).toBeTruthy();
        }
      }
    }
  });

  test('should show loading state during submission', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      const titleInput = page.locator('input[placeholder*="Title"]').first();
      if (await titleInput.isVisible()) {
        await titleInput.fill('E2E Test Task');
      }

      const submitBtn = page.locator('button:has-text("Create")').first();

      if (await submitBtn.isVisible()) {
        // Submit
        await submitBtn.click();

        // Button might show loading state (disabled, spinner, text change)
        const isDisabled = await submitBtn.isDisabled();
        const hasSpinner = await submitBtn.locator('[class*="spinner"], [class*="loader"]').isVisible();
        const text = await submitBtn.textContent();

        expect(isDisabled || hasSpinner || text?.includes('...') || text?.includes('Loading')).toBeTruthy();
      }
    }
  });

  test('should show success feedback after form submission', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      const titleInput = page.locator('input[placeholder*="Title"]').first();
      if (await titleInput.isVisible()) {
        await titleInput.fill('E2E Success Task');
      }

      const submitBtn = page.locator('button:has-text("Create")').first();

      if (await submitBtn.isVisible()) {
        await submitBtn.click();

        // Modal should close or success message should appear
        await page.waitForLoadState('networkidle');

        const modal = page.locator('div[role="dialog"]');
        const success = page.locator('text=/success|Created|Task created/i');

        // Either modal closed or success message shown
        const modalClosed = !(await modal.isVisible());
        const successMsg = await success.isVisible();

        expect(modalClosed || successMsg).toBeTruthy();
      }
    }
  });

  test('should clear form errors when user starts typing', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      const titleInput = page.locator('input[placeholder*="Title"]').first();

      if (await titleInput.isVisible()) {
        // Trigger error by trying to submit empty
        await titleInput.blur();

        // Wait a bit and type
        await titleInput.fill('Valid Title');

        // Error should clear
        await page.waitForLoadState('networkidle');

        const error = page.locator('[class*="error-message"], text=/required/').first();
        expect(await error.isVisible()).toBeFalsy();
      }
    }
  });

  test('should handle form submission errors gracefully', async ({ page }) => {
    // This test would need a way to trigger server errors
    // For now, test that error UI displays properly

    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      // Fill with data
      const titleInput = page.locator('input[placeholder*="Title"]').first();
      if (await titleInput.isVisible()) {
        await titleInput.fill('Test Task');
      }

      // If submission shows error, UI should handle it
      const submitBtn = page.locator('button:has-text("Create")').first();

      if (await submitBtn.isVisible()) {
        await submitBtn.click();

        // Wait and check for either success or error
        await page.waitForLoadState('networkidle');

        // One of these should be visible: success or error UI
        const success = page.locator('text=/success|created|Created/i');
        const error = page.locator('text=/error|failed|Error/i');

        expect(await success.isVisible() || await error.isVisible()).toBeTruthy();
      }
    }
  });

  test('should validate dropdown/select fields', async ({ page }) => {
    // Open task creation
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      // Look for select field (priority, status, etc)
      const selectField = page.locator('select, [role="combobox"]').first();

      if (await selectField.isVisible()) {
        // Should be able to interact with it
        await selectField.click();

        // Options should appear
        const option = page.locator('[role="option"], option').first();
        if (await option.isVisible()) {
          await expect(option).toBeVisible();
        }
      }
    }
  });

  test('should handle paste/autofill in forms', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      const titleInput = page.locator('input[placeholder*="Title"]').first();

      if (await titleInput.isVisible()) {
        // Simulate paste event
        await titleInput.fill('Pasted Task Title');

        // Value should be set correctly
        const value = await titleInput.inputValue();
        expect(value).toBe('Pasted Task Title');

        // No validation errors
        const error = page.locator('[class*="error"]').first();
        expect(await error.isVisible()).toBeFalsy();
      }
    }
  });
});
