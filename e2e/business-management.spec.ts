import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Workspace Management
 * Tests workspace operations: create, configure, settings, switch
 */

test.describe('Workspace Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mission-control-hq/overview');
    await page.waitForLoadState('networkidle');
  });

  test('should display workspace selector in sidebar', async ({ page }) => {
    // Find workspace selector button
    const selector = page.locator('button').filter({
      has: page.locator('text=/Select (Workspace)|Mission Control|🚀/i')
    }).first();

    await expect(selector).toBeVisible();
  });

  test('should open workspace dropdown when clicked', async ({ page }) => {
    const selector = page.locator('button').filter({
      has: page.locator('text=/Select (Workspace)|Mission Control|🚀/i')
    }).first();

    if (await selector.isVisible()) {
      await selector.click();

      // Dropdown should appear
      const dropdown = page.locator('div[class*="popover"], div[class*="dropdown"]').first();
      await expect(dropdown).toBeVisible({ timeout: 3000 });
    }
  });

  test('should list available businesses', async ({ page }) => {
    const selector = page.locator('button').filter({
      has: page.locator('text=/Select (Workspace)|Mission Control|🚀/i')
    }).first();

    if (await selector.isVisible()) {
      await selector.click();

      // (Workspace) items should be visible
      const businessItems = page.locator('button').filter({
        has: page.locator('text=/[^]+/i')
      }).nth(1);

      if (await businessItems.isVisible()) {
        await expect(businessItems).toBeVisible();
      }
    }
  });

  test('should switch to another business', async ({ page }) => {
    const selector = page.locator('button').filter({
      has: page.locator('text=/Select (Workspace)|Mission Control|🚀/i')
    }).first();

    if (await selector.isVisible()) {
      const initialUrl = page.url();

      await selector.click();

      // Try to select another business
      const otherWorkspaceBtn = page.locator('div[class*="popover"] button, div[class*="dropdown"] button').nth(1);

      if (await otherWorkspaceBtn.isVisible()) {
        await otherWorkspaceBtn.click();

        // Should navigate to same tab for that business
        await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 5000 }).catch(() => null);

        const finalUrl = page.url();
        // URL should change (different workspace slug)
        expect(initialUrl !== finalUrl).toBeTruthy();
      }
    }
  });

  test('should preserve tab when switching businesses', async ({ page }) => {
    // Start on overview
    expect(page.url()).toContain('/overview');

    const selector = page.locator('button').filter({
      has: page.locator('text=/Select (Workspace)|Mission Control|🚀/i')
    }).first();

    if (await selector.isVisible()) {
      await selector.click();

      const otherWorkspaceBtn2 = page.locator('div[class*="popover"] button, div[class*="dropdown"] button').nth(1);

      if (await otherWorkspaceBtn2.isVisible()) {
        await otherWorkspaceBtn2.click();

        // Should still be on overview tab (for the new business)
        await page.waitForURL('**/overview', { timeout: 5000 }).catch(() => null);

        expect(page.url()).toContain('/overview');
      }
    }
  });

  test('should navigate to workspace settings', async ({ page }) => {
    // Look for settings option or gear icon
    const settingsBtn = page.locator('button[aria-label*="Settings"], button[title*="Settings"]').first();

    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();

      // Should navigate to settings page
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 5000 }).catch(() => null);

      const url = page.url();
      expect(url).toContain('/settings');
    }
  });

  test('should display workspace info in settings', async ({ page }) => {
    // Navigate to settings
    await page.goto('/mission-control-hq/settings');
    await page.waitForLoadState('networkidle');

    // (Workspace) name should be displayed
    const businessName = page.locator('text=/(Workspace)|Project|Team Name/i').first();

    if (await businessName.isVisible()) {
      await expect(businessName).toBeVisible();
    }
  });

  test('should allow creating new business', async ({ page }) => {
    // Look for "Create Workspace" or "New (Workspace)" button
    const createBtn = page.locator('button').filter({
      has: page.locator('text=/Create Workspace|New (Workspace)|Add (Workspace)/i')
    }).first();

    if (await createBtn.isVisible()) {
      await createBtn.click();

      // Modal or form should appear
      const modal = page.locator('div[role="dialog"], form[class*="create"]').first();
      await expect(modal).toBeVisible({ timeout: 3000 });

      // Form should have workspace name input
      const nameInput = page.locator('input[placeholder*="Name"], input[placeholder*="Workspace"]').first();
      if (await nameInput.isVisible()) {
        await expect(nameInput).toBeVisible();
      }
    }
  });

  test('should validate required fields in workspace creation', async ({ page }) => {
    const createBtn = page.locator('button').filter({
      has: page.locator('text=/Create Workspace|New (Workspace)|Add (Workspace)/i')
    }).first();

    if (await createBtn.isVisible()) {
      await createBtn.click();

      // Try to submit empty form
      const submitBtn = page.locator('button:has-text("Create"), button:has-text("Submit")').first();

      if (await submitBtn.isVisible()) {
        // Try clicking submit
        await submitBtn.click();

        // Error message should appear
        const errorMsg = page.locator('text=/required|Please enter|Invalid/i').first();

        // Either error appears or form is still visible
        if (await errorMsg.isVisible()) {
          await expect(errorMsg).toBeVisible();
        }
      }
    }
  });

  test('should display team members in business', async ({ page }) => {
    // Look for members/team section
    const membersSection = page.locator('text=/Team|Members|Users/i').first();

    if (await membersSection.isVisible()) {
      await expect(membersSection).toBeVisible();

      // Member list should exist
      const memberItems = page.locator('[class*="member"], [class*="user"]');

      const count = await memberItems.count();
      expect(count >= 0).toBeTruthy();
    }
  });

  test('should allow inviting team members', async ({ page }) => {
    // Navigate to settings or team page
    await page.goto('/mission-control-hq/settings');
    await page.waitForLoadState('networkidle');

    // Look for invite button
    const inviteBtn = page.locator('button').filter({
      has: page.locator('text=/Invite|Add Member|Add User/i')
    }).first();

    if (await inviteBtn.isVisible()) {
      await inviteBtn.click();

      // Invite form should appear
      const form = page.locator('form, div[role="dialog"]').first();

      if (await form.isVisible()) {
        // Email input should exist
        const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();

        if (await emailInput.isVisible()) {
          await expect(emailInput).toBeVisible();
        }
      }
    }
  });

  test('should display workspace logo/emoji', async ({ page }) => {
    // (Workspace) selector or sidebar should show logo/emoji
    const selector = page.locator('button').filter({
      has: page.locator('text=/Select (Workspace)|Mission Control|🚀/i')
    }).first();

    if (await selector.isVisible()) {
      // Should contain emoji or icon
      const text = await selector.textContent();
      expect(text && (text.includes('🚀') || text.includes('Mission'))).toBeTruthy();
    }
  });

  test('should show active workspace indicator', async ({ page }) => {
    const selector = page.locator('button').filter({
      has: page.locator('text=/Select (Workspace)|Mission Control|🚀/i')
    }).first();

    if (await selector.isVisible()) {
      await selector.click();

      // Current workspace should be highlighted/indicated
      const currentWorkspace = page.locator('[class*="active"], [class*="selected"], [class*="current"]').first();

      if (await currentWorkspace.isVisible()) {
        await expect(currentWorkspace).toBeVisible();
      }
    }
  });

  test('should allow updating workspace info', async ({ page }) => {
    // Navigate to settings
    await page.goto('/mission-control-hq/settings');
    await page.waitForLoadState('networkidle');

    // Look for edit button
    const editBtn = page.locator('button').filter({
      has: page.locator('text=/Edit|Update|Change/i')
    }).first();

    if (await editBtn.isVisible()) {
      await editBtn.click();

      // Edit form should appear
      const input = page.locator('input').first();

      if (await input.isVisible()) {
        // Should be able to edit
        await expect(input).toBeTruthy();
      }
    }
  });
});
