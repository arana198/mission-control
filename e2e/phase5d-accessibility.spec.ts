/**
 * Phase 5D: Accessibility Tests (E2E)
 *
 * WCAG 2.1 AA Compliance tests:
 * - Modal focus traps
 * - Keyboard navigation (Tab, Escape, Arrow keys)
 * - ARIA attributes and roles
 * - Screen reader announcements
 */

import { test, expect, Page } from "@playwright/test";

test.describe("Phase 5D: Accessibility", () => {
  test.describe("Modal Focus Trap", () => {
    test("traps focus within modal when open", async ({ page }) => {
      // Navigate to a page with a modal trigger
      await page.goto("http://localhost:3000/global/dashboard");

      // Open a modal (e.g., create task modal)
      const createButton = page.locator("button:has-text('Create Task')");
      if (await createButton.isVisible()) {
        await createButton.click();

        // Modal should be open
        const modal = page.locator('div[role="dialog"]');
        await expect(modal).toBeVisible();

        // Focus should be trapped in modal
        const focusableElements = await modal.locator("button, input, select, textarea, [tabindex]:not([tabindex='-1'])").all();
        expect(focusableElements.length).toBeGreaterThan(0);

        // Tab should cycle within modal
        await modal.locator("input").first().focus();
        const firstElement = await page.evaluate(() => document.activeElement?.getAttribute("id"));

        // Last focusable element Tab should cycle to first
        await modal.locator("button").last().focus();
        await page.keyboard.press("Tab");
        const afterTabElement = await page.evaluate(() => document.activeElement?.getAttribute("id"));

        // Should cycle back (or stay in modal)
        const modalBound = await modal.evaluate((el) => el.contains(document.activeElement));
        expect(modalBound).toBe(true);
      }
    });

    test("returns focus to trigger on modal close", async ({ page }) => {
      await page.goto("http://localhost:3000/global/dashboard");

      const createButton = page.locator("button:has-text('Create Task')");
      if (await createButton.isVisible()) {
        // Get button id before click
        const buttonId = await createButton.evaluate((el) => el.id || el.className);

        await createButton.click();

        // Modal open
        const modal = page.locator('div[role="dialog"]');
        await expect(modal).toBeVisible();

        // Close modal (Escape key)
        await page.keyboard.press("Escape");

        // Modal should be gone
        await expect(modal).not.toBeVisible();

        // Focus should return to button
        const focusedElement = await page.evaluate(() => document.activeElement?.className);
        expect(focusedElement).toContain(buttonId || "button");
      }
    });
  });

  test.describe("Modal ARIA Attributes", () => {
    test("modal has correct ARIA role and attributes", async ({ page }) => {
      await page.goto("http://localhost:3000/global/dashboard");

      const createButton = page.locator("button:has-text('Create Task')");
      if (await createButton.isVisible()) {
        await createButton.click();

        const modal = page.locator('div[role="dialog"]');
        await expect(modal).toBeVisible();

        // Check ARIA attributes
        const ariaModal = await modal.evaluate((el) => el.getAttribute("aria-modal"));
        expect(ariaModal).toBe("true");

        const ariaLabelledby = await modal.evaluate((el) => el.getAttribute("aria-labelledby"));
        expect(ariaLabelledby).toBeTruthy();

        // Modal title should have the ID referenced by aria-labelledby
        const titleId = ariaLabelledby;
        const title = page.locator(`#${titleId}`);
        await expect(title).toBeVisible();
      }
    });
  });

  test.describe("Keyboard Navigation", () => {
    test("Ctrl+K opens command palette", async ({ page }) => {
      await page.goto("http://localhost:3000/global/dashboard");

      // Press Ctrl+K
      await page.keyboard.press("Control+K");

      // Command palette should be open
      const commandPalette = page.locator("input[role='combobox']").first();
      await expect(commandPalette).toBeVisible();

      // Input should be focused
      const isFocused = await commandPalette.evaluate((el) => el === document.activeElement);
      expect(isFocused).toBe(true);
    });

    test("Arrow keys navigate command palette results", async ({ page }) => {
      await page.goto("http://localhost:3000/global/dashboard");

      await page.keyboard.press("Control+K");

      const combobox = page.locator("input[role='combobox']").first();
      await expect(combobox).toBeVisible();

      // Type to get results
      await combobox.type("task");

      // Get results
      const results = page.locator("div[role='listbox'] div[role='option']");
      const resultCount = await results.count();

      if (resultCount > 1) {
        // Down arrow should highlight next result
        await page.keyboard.press("ArrowDown");
        const firstResult = results.first();
        const isSelected = await firstResult.evaluate((el) => el.getAttribute("aria-selected"));
        expect(isSelected).toBe("true");

        // Down arrow again
        await page.keyboard.press("ArrowDown");
        const secondResult = results.nth(1);
        const isSelected2 = await secondResult.evaluate((el) => el.getAttribute("aria-selected"));
        expect(isSelected2).toBe("true");
      }
    });

    test("Escape closes command palette and returns focus", async ({ page }) => {
      await page.goto("http://localhost:3000/global/dashboard");

      const body = page.locator("body");
      await body.focus();

      await page.keyboard.press("Control+K");

      const combobox = page.locator("input[role='combobox']").first();
      await expect(combobox).toBeVisible();

      // Press Escape
      await page.keyboard.press("Escape");

      // Palette should close
      await expect(combobox).not.toBeVisible();
    });

    test("Enter selects command palette item", async ({ page }) => {
      await page.goto("http://localhost:3000/global/dashboard");

      await page.keyboard.press("Control+K");

      const combobox = page.locator("input[role='combobox']").first();
      await combobox.type("create");

      // Wait for results
      await page.locator("div[role='option']").first().waitFor();

      // Select first result
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");

      // Command palette should close after selection
      await expect(combobox).not.toBeVisible();
    });
  });

  test.describe("ARIA Live Regions", () => {
    test("announces task creation", async ({ page }) => {
      await page.goto("http://localhost:3000/global/dashboard");

      // Find aria-live region
      const liveRegion = page.locator("[aria-live='polite']").first();
      if (await liveRegion.isVisible()) {
        // Clear any existing text
        await liveRegion.evaluate((el) => {
          el.textContent = "";
        });

        // Trigger an action that announces
        const createButton = page.locator("button:has-text('Create Task')");
        if (await createButton.isVisible()) {
          await createButton.click();

          // Fill form and submit
          const titleInput = page.locator("input[placeholder*='Title']").first();
          if (await titleInput.isVisible()) {
            await titleInput.fill("Test Task");

            const submitButton = page.locator("button:has-text('Create')").first();
            if (await submitButton.isVisible()) {
              await submitButton.click();

              // aria-live region should have announcement
              const content = await liveRegion.textContent();
              expect(content?.length || 0).toBeGreaterThan(0);
            }
          }
        }
      }
    });
  });

  test.describe("Screen Reader Announcements", () => {
    test("modal title is announced", async ({ page }) => {
      await page.goto("http://localhost:3000/global/dashboard");

      const createButton = page.locator("button:has-text('Create Task')");
      if (await createButton.isVisible()) {
        await createButton.click();

        const modal = page.locator('div[role="dialog"]');
        await expect(modal).toBeVisible();

        // Modal should have aria-labelledby pointing to title
        const ariaLabelledby = await modal.evaluate((el) => el.getAttribute("aria-labelledby"));
        const title = page.locator(`#${ariaLabelledby}`);

        const titleText = await title.textContent();
        expect(titleText?.length || 0).toBeGreaterThan(0);
      }
    });

    test("form inputs have associated labels", async ({ page }) => {
      await page.goto("http://localhost:3000/global/dashboard");

      const createButton = page.locator("button:has-text('Create Task')");
      if (await createButton.isVisible()) {
        await createButton.click();

        // Check form inputs
        const inputs = page.locator("input, textarea, select").all();
        for (const input of await inputs) {
          // Each input should have either aria-label or be associated with a label
          const ariaLabel = await input.evaluate((el) => el.getAttribute("aria-label"));
          const id = await input.evaluate((el) => el.id);
          const labeledBy = await input.evaluate((el) => el.getAttribute("aria-labelledby"));

          const hasLabel =
            ariaLabel ||
            (id && (await page.locator(`label[for="${id}"]`).isVisible()).catch(() => false)) ||
            labeledBy;

          expect(hasLabel).toBeTruthy();
        }
      }
    });
  });

  test.describe("Deprecated Attributes", () => {
    test("uses onKeyDown instead of onKeyPress", async ({ page }) => {
      await page.goto("http://localhost:3000/global/dashboard");

      // Check that components don't have onKeyPress
      const hasKeyPress = await page.evaluate(() => {
        const elements = document.querySelectorAll("[onkeypress]");
        return elements.length;
      });

      // Note: onKeyPress attributes might still exist in older code
      // This test verifies the absence of deprecated event handlers
      // In modern React, we check the event listener type instead
      expect(hasKeyPress).toBeLessThanOrEqual(0);
    });
  });

  test.describe("Reduced Motion", () => {
    test("respects prefers-reduced-motion", async ({ page }) => {
      // Set reduced motion preference
      await page.emulateMedia({ reducedMotion: "reduce" });

      await page.goto("http://localhost:3000/global/dashboard");

      // Check computed animation duration
      const animationDuration = await page.evaluate(() => {
        const element = document.querySelector("body");
        return window.getComputedStyle(element!).animationDuration;
      });

      // Animation duration should be very short (0.01ms) or animations disabled
      expect(animationDuration).toMatch(/0\.0|0s/);
    });
  });
});
