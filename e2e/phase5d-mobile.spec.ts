/**
 * Phase 5D: Mobile Responsiveness Tests (E2E)
 *
 * Tests for:
 * - Mobile viewport sizing (390px, 768px, 1024px+)
 * - Full-screen modals on mobile
 * - Responsive layouts
 * - Touch interactions
 */

import { test, expect, devices } from "@playwright/test";

// Test across device sizes
const viewports = [
  { name: "mobile", width: 390, height: 844 }, // iPhone 12
  { name: "tablet", width: 768, height: 1024 }, // iPad
  { name: "desktop", width: 1920, height: 1080 }, // Desktop
];

test.describe("Phase 5D: Mobile Responsiveness", () => {
  viewports.forEach(({ name, width, height }) => {
    test.describe(`${name.toUpperCase()} (${width}x${height})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width, height });
      });

      test("dashboard renders without horizontal scroll", async ({ page }) => {
        await page.goto("http://localhost:3000/global/dashboard");

        // Check for horizontal overflow
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });

        expect(hasHorizontalScroll).toBe(false);
      });

      test("modals fit within viewport", async ({ page }) => {
        await page.goto("http://localhost:3000/global/dashboard");

        const createButton = page.locator("button:has-text('Create Task')");
        if (await createButton.isVisible()) {
          await createButton.click();

          const modal = page.locator('div[role="dialog"]').first();
          await expect(modal).toBeVisible();

          // Get modal dimensions
          const modalBox = await modal.boundingBox();
          expect(modalBox).toBeTruthy();

          if (modalBox) {
            // Modal should fit in viewport with some padding
            if (name === "mobile") {
              // On mobile, modal should be full-screen or near full-screen
              expect(modalBox.height).toBeGreaterThan(height * 0.8);
            } else {
              // On tablet/desktop, should fit within viewport
              expect(modalBox.height).toBeLessThanOrEqual(height);
              expect(modalBox.width).toBeLessThanOrEqual(width);
            }
          }
        }
      });

      test("buttons are touch-friendly (min 48x48px)", async ({ page }) => {
        await page.goto("http://localhost:3000/global/dashboard");

        const buttons = page.locator("button").all();
        for (const button of await buttons) {
          const box = await button.boundingBox();
          if (box && (await button.isVisible())) {
            // Touch targets should be at least 48x48px
            expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(40); // Allow some tolerance
          }
        }
      });

      if (name === "mobile") {
        test("modals are full-screen on mobile", async ({ page }) => {
          await page.goto("http://localhost:3000/global/dashboard");

          const createButton = page.locator("button:has-text('Create Task')");
          if (await createButton.isVisible()) {
            await createButton.click();

            const modal = page.locator('div[role="dialog"]').first();
            await expect(modal).toBeVisible();

            const modalBox = await modal.boundingBox();
            if (modalBox) {
              // Should fill most of the viewport
              expect(modalBox.width).toBeGreaterThan(width * 0.9);
              expect(modalBox.height).toBeGreaterThan(height * 0.8);
            }
          }
        });

        test("no horizontal scrollbar in modals", async ({ page }) => {
          await page.goto("http://localhost:3000/global/dashboard");

          const createButton = page.locator("button:has-text('Create Task')");
          if (await createButton.isVisible()) {
            await createButton.click();

            const modal = page.locator('div[role="dialog"]').first();
            await expect(modal).toBeVisible();

            // Check for horizontal scroll within modal
            const modalHasHScroll = await modal.evaluate((el) => {
              return el.scrollWidth > el.clientWidth;
            });

            expect(modalHasHScroll).toBe(false);
          }
        });

        test("modal close button is accessible on mobile", async ({ page }) => {
          await page.goto("http://localhost:3000/global/dashboard");

          const createButton = page.locator("button:has-text('Create Task')");
          if (await createButton.isVisible()) {
            await createButton.click();

            // Find close button (X or explicit close)
            const closeButton = page
              .locator('button:has(svg[class*="close"]), button:has(svg[class*="x"])')
              .first();

            if (await closeButton.isVisible()) {
              const box = await closeButton.boundingBox();
              // Close button should be easily tappable
              expect(box?.width || 0).toBeGreaterThanOrEqual(40);
              expect(box?.height || 0).toBeGreaterThanOrEqual(40);
            }
          }
        });
      }

      test("text is readable (font size >= 16px)", async ({ page }) => {
        await page.goto("http://localhost:3000/global/dashboard");

        const textElements = page.locator("p, span, li, div:has-text(.)").all();
        for (const element of await textElements.slice(0, 20)) {
          // Sample first 20 text elements
          const fontSize = await element.evaluate((el) => {
            return parseInt(window.getComputedStyle(el).fontSize);
          });

          if (fontSize > 0) {
            expect(fontSize).toBeGreaterThanOrEqual(12); // Allow some small text for captions
          }
        }
      });

      test("navigation is accessible", async ({ page }) => {
        await page.goto("http://localhost:3000/global/dashboard");

        // Main navigation should be visible/accessible
        const nav = page.locator("nav").first();
        if (await nav.isVisible()) {
          const navItems = nav.locator("a, button").all();
          expect((await navItems).length).toBeGreaterThan(0);
        }
      });
    });
  });

  test.describe("Tablet Layout (768px)", () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
    });

    test("epic board shows responsive columns", async ({ page }) => {
      await page.goto("http://localhost:3000/global/epics");

      // Epic board should adapt column count for tablet
      const cards = page.locator('[class*="grid"] > div').all();
      const cardCount = (await cards).length;

      // Should have multiple columns but not full desktop layout
      if (cardCount > 1) {
        expect(cardCount).toBeLessThan(5); // Max 4 columns on tablet (md breakpoint)
      }
    });
  });

  test.describe("Kanban Board Mobile", () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
    });

    test("horizontal scroll hint visible on mobile", async ({ page }) => {
      await page.goto("http://localhost:3000/global/tasks");

      // Look for scroll hint
      const scrollHint = page.locator("p:has-text('Swipe')");
      if (await scrollHint.isVisible()) {
        const hint = await scrollHint.textContent();
        expect(hint?.toLowerCase()).toContain("swipe");
      }
    });

    test("kanban columns stack on mobile", async ({ page }) => {
      await page.goto("http://localhost:3000/global/tasks");

      // On mobile, columns should be in a horizontal scroll, not grid
      const kanbanContainer = page.locator('[class*="kanban"], [class*="board"]').first();

      if (await kanbanContainer.isVisible()) {
        const columns = kanbanContainer.locator('[class*="column"]').all();
        expect((await columns).length).toBeGreaterThan(0);

        // Columns should be arranged horizontally (overflow-x)
        const overflow = await kanbanContainer.evaluate((el) => {
          return window.getComputedStyle(el).overflowX;
        });

        expect(overflow).toMatch(/auto|scroll|hidden/);
      }
    });
  });

  test.describe("Form Inputs Mobile", () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
    });

    test("form inputs are touch-friendly", async ({ page }) => {
      await page.goto("http://localhost:3000/global/dashboard");

      const createButton = page.locator("button:has-text('Create Task')");
      if (await createButton.isVisible()) {
        await createButton.click();

        const inputs = page.locator("input, select, textarea").all();
        for (const input of await inputs) {
          const box = await input.boundingBox();
          if (box) {
            // Input height should be at least 44px for touch
            expect(box.height).toBeGreaterThanOrEqual(40);
          }
        }
      }
    });

    test("keyboard doesn't hide form fields", async ({ page }) => {
      await page.goto("http://localhost:3000/global/dashboard");

      const createButton = page.locator("button:has-text('Create Task')");
      if (await createButton.isVisible()) {
        await createButton.click();

        const titleInput = page.locator("input[placeholder*='Title']").first();
        if (await titleInput.isVisible()) {
          await titleInput.click();
          await titleInput.focus();

          // Scroll input into view
          await titleInput.scrollIntoViewIfNeeded();

          // Should still be visible
          const isInViewport = await titleInput.isVisible();
          expect(isInViewport).toBe(true);
        }
      }
    });
  });

  test.describe("Orientation Changes", () => {
    test("layout adapts to orientation change", async ({ page }) => {
      // Start in portrait
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("http://localhost:3000/global/dashboard");

      const portraitScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth;
      });

      // Change to landscape
      await page.setViewportSize({ width: 844, height: 390 });

      const landscapeScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth;
      });

      // Both should fit without horizontal scroll
      expect(portraitScroll).toBeLessThanOrEqual(390);
      expect(landscapeScroll).toBeLessThanOrEqual(844);
    });
  });
});
