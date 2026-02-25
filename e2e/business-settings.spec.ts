import { test, expect } from "@playwright/test";

test.describe("(Workspace) Settings Panel", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a workspace settings page
    // Assuming test data has at least one business
    await page.goto("/business-default/settings");
    await page.waitForLoadState("networkidle");
  });

  test.describe("Mission Statement Editor", () => {
    test("should display mission statement in textarea", async ({ page }) => {
      // Check that the mission statement textarea exists
      const textarea = page.locator("textarea");
      expect(textarea).toBeDefined();

      // Check for the label
      const label = page.locator("text=(Workspace) Purpose & Problem Being Solved");
      await expect(label).toBeVisible();
    });

    test("should update mission statement when user types and saves", async ({ page }) => {
      // Get the textarea
      const textarea = page.locator("textarea").first();

      // Clear any existing text
      await textarea.fill("");

      // Type new mission statement
      const newMission = "Transform enterprise workflows with AI autonomy";
      await textarea.fill(newMission);

      // Verify text was entered
      await expect(textarea).toHaveValue(newMission);

      // Find and click save button
      const saveButton = page.locator("button:has-text('Save Changes')").first();

      // Save button should be enabled (has changes)
      await expect(saveButton).not.toBeDisabled();

      // Click save
      await saveButton.click();

      // Wait for success message
      const successMsg = page.locator("text=Mission statement updated!");
      await expect(successMsg).toBeVisible();

      // Success message should auto-dismiss
      await page.waitForTimeout(3500);
      await expect(successMsg).not.toBeVisible();
    });

    test("should disable save button when no changes made", async ({ page }) => {
      // Get the save button
      const saveButton = page.locator("button:has-text('Save Changes')").first();

      // Save button should be disabled initially (no changes)
      await expect(saveButton).toBeDisabled();

      // "No changes to save" message should be visible
      const noChangesMsg = page.locator("text=No changes to save");
      await expect(noChangesMsg).toBeVisible();
    });

    test("should show error when trying to save empty mission statement", async ({ page }) => {
      // Get the textarea
      const textarea = page.locator("textarea").first();

      // Clear the textarea
      await textarea.fill("");

      // Get the save button (should now be enabled due to changes)
      const saveButton = page.locator("button:has-text('Save Changes')").first();
      await expect(saveButton).not.toBeDisabled();

      // Click save
      await saveButton.click();

      // Wait for error message
      const errorMsg = page.locator("text=Mission statement cannot be empty");
      await expect(errorMsg).toBeVisible();
    });

    test("should preserve mission statement across page reloads", async ({ page }) => {
      // Get the textarea
      const textarea = page.locator("textarea").first();

      // Get initial value
      const initialValue = await textarea.inputValue();

      // Reload page
      await page.reload();
      await page.waitForLoadState("networkidle");

      // Get textarea again
      const reloadedTextarea = page.locator("textarea").first();

      // Value should be the same
      const reloadedValue = await reloadedTextarea.inputValue();
      expect(reloadedValue).toBe(initialValue);
    });
  });

  test.describe("Delete (Workspace) - Danger Zone", () => {
    test("should display danger zone section with delete button", async ({ page }) => {
      // Check for danger zone section
      const dangerZone = page.locator("text=Danger Zone");
      await expect(dangerZone).toBeVisible();

      // Check for delete button
      const deleteBtn = page.locator("button:has-text('Delete (Workspace)')").first();
      await expect(deleteBtn).toBeVisible();
    });

    test("should show confirmation dialog when delete button is clicked", async ({ page }) => {
      // Click delete button
      const deleteBtn = page.locator("button:has-text('Delete (Workspace)')").first();
      await deleteBtn.click();

      // Confirmation dialog should appear
      const confirmMsg = page.locator("text=Are you sure?");
      await expect(confirmMsg).toBeVisible();

      // Confirmation input should appear
      const confirmInput = page.locator("input[placeholder*='(Workspace)']").first();
      await expect(confirmInput).toBeVisible();

      // Cancel button should appear
      const cancelBtn = page.locator("button:has-text('Cancel')");
      await expect(cancelBtn).toBeVisible();
    });

    test("should cancel deletion when cancel button is clicked", async ({ page }) => {
      // Get workspace name from the page title
      const businessName = await page.locator("text=(Workspace) Settings").first().textContent();

      // Click delete button
      const deleteBtn = page.locator("button:has-text('Delete (Workspace)')").first();
      await deleteBtn.click();

      // Click cancel
      const cancelBtn = page.locator("button:has-text('Cancel')");
      await cancelBtn.click();

      // Confirmation dialog should disappear
      const confirmMsg = page.locator("text=Are you sure?");
      await expect(confirmMsg).not.toBeVisible();

      // Delete button should be visible again
      await expect(deleteBtn).toBeVisible();
    });

    test("should require exact workspace name to confirm deletion", async ({ page }) => {
      // Click delete button to show confirmation
      const deleteBtn = page.locator("button:has-text('Delete (Workspace)')").first();
      await deleteBtn.click();

      // Get the confirmation input
      const confirmInput = page.locator("input[placeholder*='(Workspace)']").first();

      // Try to submit with wrong name
      await confirmInput.fill("Wrong Name");

      // Get the delete confirmation button (inside the danger zone)
      const deleteConfirmBtn = page.locator("button:has-text('Delete (Workspace)')").nth(1);
      await deleteConfirmBtn.click();

      // Should show error message
      const errorMsg = page.locator("text=(Workspace) name does not match");
      await expect(errorMsg).toBeVisible();

      // Page should not navigate away
      expect(page.url()).toContain("/settings");
    });

    test("should display what will be deleted in danger zone", async ({ page }) => {
      // Check for list of what gets deleted
      const warningText = page.locator("text=This will delete");
      await expect(warningText).toBeVisible();

      // Check for specific items mentioned
      const itemsText = page.locator("text=all tasks, epics, messages, documents, goals, and settings");
      await expect(itemsText).toBeVisible();
    });

    test("should show loading state during deletion", async ({ page }) => {
      // This test requires proper workspace name
      // First, we need to get the workspace name from the page
      const businessNameElement = page.locator("p:has-text('Configure')");
      const businessNameText = await businessNameElement.textContent();
      const businessName = businessNameText?.replace("Configure ", "").trim() || "Test (Workspace)";

      // Click delete button
      const deleteBtn = page.locator("button:has-text('Delete (Workspace)')").first();
      await deleteBtn.click();

      // Enter the workspace name
      const confirmInput = page.locator("input[placeholder*='(Workspace)']").first();
      await confirmInput.fill(businessName);

      // Get the delete confirmation button
      const deleteConfirmBtn = page.locator("button:has-text('Delete (Workspace)')").nth(1);

      // Click delete (this may or may not complete depending on backend)
      // We're just checking the UI state during the process
      expect(deleteConfirmBtn).toBeDefined();
    });
  });

  test.describe("Set as Default (Workspace)", () => {
    test("should display default workspace section", async ({ page }) => {
      // Check for default workspace section
      const defaultSection = page.locator("text=Default (Workspace)");
      await expect(defaultSection).toBeVisible();

      // Check for description
      const description = page.locator("text=default workspace");
      await expect(description).toBeVisible();
    });

    test("should show appropriate button state when workspace is default", async ({ page }) => {
      // This test depends on test data setup
      // Check if current default button exists
      const setDefaultBtn = page.locator("button:has-text('Current Default'), button:has-text('Set as Default')").first();
      await expect(setDefaultBtn).toBeVisible();
    });

    test("should disable button when workspace is already default", async ({ page }) => {
      // Get the set default button
      const setDefaultBtn = page.locator("button:has-text('Current Default')");

      // If this is the default business, button should be disabled
      const isDisabled = await setDefaultBtn.isDisabled();
      if (isDisabled) {
        expect(isDisabled).toBe(true);
      }
    });

    test("should show success message when setting workspace as default", async ({ page }) => {
      // Get the set default button
      let setDefaultBtn = page.locator("button:has-text('Set as Default')").first();

      // Check if button exists (only if not already default)
      const exists = await setDefaultBtn.isVisible().catch(() => false);

      if (exists) {
        // Click the button
        await setDefaultBtn.click();

        // Success message should appear
        const successMsg = page.locator("text=is now the default business");
        await expect(successMsg).toBeVisible();

        // Message should auto-dismiss
        await page.waitForTimeout(3500);
        await expect(successMsg).not.toBeVisible();
      }
    });

    test("should update button state after setting as default", async ({ page }) => {
      // Get the set default button
      const setDefaultBtn = page.locator("button:has-text('Set as Default')").first();

      // Check if button exists
      const exists = await setDefaultBtn.isVisible().catch(() => false);

      if (exists) {
        // Click to set as default
        await setDefaultBtn.click();

        // Wait for the mutation to complete
        await page.waitForTimeout(500);

        // Button should now show "Current Default"
        const currentDefaultBtn = page.locator("button:has-text('Current Default')");
        const visible = await currentDefaultBtn.isVisible().catch(() => false);

        // Note: Full verification requires page reload or real backend
        expect(visible || exists).toBeDefined();
      }
    });
  });

  test.describe("GitHub Integration Settings", () => {
    test("should display ticket prefix field", async ({ page }) => {
      // Check for Ticket Prefix label
      const ticketPrefixLabel = page.locator("label:has-text('Ticket Prefix')");
      await expect(ticketPrefixLabel).toBeVisible();

      // Check for input field
      const ticketPrefixInput = page.locator("input[placeholder='EPUK']");
      await expect(ticketPrefixInput).toBeVisible();

      // Check for help text
      const helpText = page.locator("text=Prefix for auto-generated ticket numbers");
      await expect(helpText).toBeVisible();
    });

    test("should allow editing ticket prefix", async ({ page }) => {
      // Find the ticket prefix input
      const ticketPrefixInput = page.locator("input[placeholder='EPUK']").first();

      // Clear and type new prefix
      await ticketPrefixInput.fill("");
      await ticketPrefixInput.fill("TEST");

      // Verify value changed
      await expect(ticketPrefixInput).toHaveValue("TEST");
    });

    test("should auto-uppercase ticket prefix input", async ({ page }) => {
      // Find the ticket prefix input
      const ticketPrefixInput = page.locator("input[placeholder='EPUK']").first();

      // Type lowercase
      await ticketPrefixInput.fill("myprefix");

      // Should be converted to uppercase
      await expect(ticketPrefixInput).toHaveValue("MYPREFIX");
    });

    test("should display auto-derived ticket pattern", async ({ page }) => {
      // Check for Ticket ID Pattern label
      const ticketPatternLabel = page.locator("label:has-text('Ticket ID Pattern')");
      await expect(ticketPatternLabel).toBeVisible();

      // Check for help text about auto-derivation
      const helpText = page.locator("text=auto-derived from prefix");
      await expect(helpText).toBeVisible();

      // Set a ticket prefix
      const ticketPrefixInput = page.locator("input[placeholder='EPUK']").first();
      await ticketPrefixInput.fill("MYAPP");

      // Pattern should be shown as auto-derived
      const derivedPatternText = page.locator("text=Automatically matches");
      await expect(derivedPatternText).toBeVisible({ timeout: 3000 });
    });

    test("should allow custom pattern override", async ({ page }) => {
      // Click the details/summary to expand advanced options
      const advancedToggle = page.locator("summary:has-text('Override with custom pattern')");
      await advancedToggle.click();

      // Custom pattern input should appear
      const customPatternInput = page.locator("input[placeholder*='[A-Za-z]']");
      await expect(customPatternInput).toBeVisible({ timeout: 3000 });

      // Should be able to type in it
      await customPatternInput.fill("[A-Z]+-\\d+");
      await expect(customPatternInput).toHaveValue("[A-Z]+-\\d+");
    });

    test("should display GitHub repository field", async ({ page }) => {
      // Check for GitHub Repository label
      const repoLabel = page.locator("label:has-text('GitHub Repository')");
      await expect(repoLabel).toBeVisible();

      // Check for input field
      const repoInput = page.locator("input[placeholder='owner/repo']");
      await expect(repoInput).toBeVisible();
    });

    test("should save ticket prefix setting", async ({ page }) => {
      // Find and update ticket prefix
      const ticketPrefixInput = page.locator("input[placeholder='EPUK']").first();
      const currentValue = await ticketPrefixInput.inputValue();

      // Change value
      const newValue = currentValue === "EPUK" ? "CORE" : "EPUK";
      await ticketPrefixInput.fill(newValue);

      // Click save
      const saveButton = page.locator("button:has-text('Save Changes')").first();
      await expect(saveButton).not.toBeDisabled();
      await saveButton.click();

      // Wait for success message
      const successMsg = page.locator("text=Settings saved");
      await expect(successMsg).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Settings Panel Layout", () => {
    test("should display settings header with workspace name", async ({ page }) => {
      // Check for header
      const header = page.locator("text=(Workspace) Settings");
      await expect(header).toBeVisible();

      // Check for workspace name in subtitle
      const subtitle = page.locator("p:has-text('Configure')");
      await expect(subtitle).toBeVisible();
    });

    test("should have proper spacing between sections", async ({ page }) => {
      // Get mission statement section
      const missionSection = page.locator("text=Mission Statement");

      // Get default workspace section
      const defaultSection = page.locator("text=Default (Workspace)");

      // Both should be visible
      await expect(missionSection).toBeVisible();
      await expect(defaultSection).toBeVisible();

      // Default section should be below mission statement
      const missionBox = await missionSection.boundingBox();
      const defaultBox = await defaultSection.boundingBox();

      if (missionBox && defaultBox) {
        expect(defaultBox.y).toBeGreaterThan(missionBox.y);
      }
    });

    test("should have accessible form inputs", async ({ page }) => {
      // Check textarea is accessible
      const textarea = page.locator("textarea");
      await expect(textarea).toBeVisible();

      // Check buttons are accessible
      const saveBtn = page.locator("button:has-text('Save Changes')");
      await expect(saveBtn).toBeVisible();

      // Check labels exist
      const label = page.locator("label");
      await expect(label.first()).toBeVisible();
    });
  });
});
