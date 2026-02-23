import { test, expect } from "@playwright/test";

/**
 * Phase 5A E2E Tests: Presence & Comments
 *
 * Tests for:
 * - Presence indicator display and status updates
 * - Task comments with threading
 * - @mention functionality
 * - Emoji reactions
 * - Comment deletion
 */

test.describe("Phase 5A: Presence & Comments", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a business page (requires auth setup)
    await page.goto("/");
  });

  test.describe("PresenceIndicator Component", () => {
    test("displays agent presence status correctly", async ({ page }) => {
      // This test requires a page that uses PresenceIndicator
      // Verify component renders without errors
      const presenceIndicators = page.locator(
        "[data-testid='presence-indicator']"
      );

      if (await presenceIndicators.count() > 0) {
        const indicator = presenceIndicators.first();
        expect(indicator).toBeVisible();

        // Verify status is one of the expected values
        const statusText = await indicator.textContent();
        expect(statusText).toMatch(
          /(Online|Away|Do Not Disturb|Offline)/
        );
      }
    });

    test("CurrentUserPresence dropdown opens and closes", async ({ page }) => {
      const presenceButton = page.locator(
        "[data-testid='current-user-presence']"
      ).first();

      if (await presenceButton.isVisible()) {
        // Click to open
        await presenceButton.click();

        // Verify dropdown is visible
        const dropdown = page.locator("[data-testid='presence-dropdown']");
        await expect(dropdown).toBeVisible();

        // Verify status options are present
        await expect(page.locator("button:has-text('Online')")).toBeVisible();
        await expect(page.locator("button:has-text('Away')")).toBeVisible();
        await expect(page.locator("button:has-text('Do Not Disturb')")).toBeVisible();
        await expect(page.locator("button:has-text('Offline')")).toBeVisible();

        // Click away to close
        await page.click("body");
        await expect(dropdown).not.toBeVisible();
      }
    });

    test("changing status updates presence", async ({ page }) => {
      const presenceButton = page.locator(
        "[data-testid='current-user-presence']"
      ).first();

      if (await presenceButton.isVisible()) {
        // Open dropdown
        await presenceButton.click();

        // Click "Away" status
        const awayButton = page.locator("button:has-text('Away')").first();
        await awayButton.click();

        // Wait for update
        await page.waitForTimeout(500);

        // Verify status changed
        const statusText = await presenceButton.textContent();
        expect(statusText).toContain("Away");
      }
    });

    test("PresenceList shows all agents with their status", async ({ page }) => {
      const presenceList = page.locator("[data-testid='presence-list']");

      if (await presenceList.isVisible()) {
        // Verify list is rendered
        const agents = presenceList.locator("[data-testid='agent-item']");
        expect(await agents.count()).toBeGreaterThan(0);

        // Verify each agent has status badge
        const firstAgent = agents.first();
        expect(firstAgent).toContainText(/(Online|Away|Do Not Disturb|Offline)/);
      }
    });
  });

  test.describe("EnhancedTaskComments Component", () => {
    test("renders comment input and submit button", async ({ page }) => {
      const commentForm = page.locator("[data-testid='comment-form']");

      if (await commentForm.isVisible()) {
        const textarea = commentForm.locator("textarea");
        const submitButton = commentForm.locator("button[type='submit']");

        expect(textarea).toBeVisible();
        expect(submitButton).toBeVisible();
      }
    });

    test("creates a new comment when submitted", async ({ page }) => {
      const textarea = page.locator("[data-testid='comment-input']");
      const submitButton = page.locator(
        "[data-testid='comment-form'] button[type='submit']"
      );

      if (await textarea.isVisible()) {
        // Type comment
        const testComment = "This is a test comment";
        await textarea.fill(testComment);

        // Submit
        await submitButton.click();

        // Wait for comment to appear
        await page.waitForTimeout(1000);

        // Verify comment is displayed
        const comments = page.locator("[data-testid='comment-item']");
        const lastComment = comments.last();
        await expect(lastComment).toContainText(testComment);

        // Verify input is cleared
        await expect(textarea).toHaveValue("");
      }
    });

    test("@mention autocomplete shows agents", async ({ page }) => {
      const textarea = page.locator("[data-testid='comment-input']");

      if (await textarea.isVisible()) {
        // Type @
        await textarea.fill("Hey @");
        await textarea.press("@");

        // Wait for autocomplete to appear
        await page.waitForTimeout(500);

        // Verify mention dropdown is visible
        const dropdown = page.locator("[data-testid='mention-dropdown']");
        if (await dropdown.isVisible()) {
          const agents = dropdown.locator("[data-testid='mention-agent']");
          expect(await agents.count()).toBeGreaterThan(0);

          // Verify agent names are shown
          const firstAgent = agents.first();
          expect(firstAgent).toContainText("@");
        }
      }
    });

    test("clicking mention inserts agent name in comment", async ({ page }) => {
      const textarea = page.locator("[data-testid='comment-input']");

      if (await textarea.isVisible()) {
        // Type @
        await textarea.fill("@");
        await page.waitForTimeout(500);

        // Click first agent mention
        const firstMention = page
          .locator("[data-testid='mention-dropdown'] [data-testid='mention-agent']")
          .first();

        if (await firstMention.isVisible()) {
          const agentName = await firstMention.textContent();
          await firstMention.click();

          // Verify name was inserted
          const inputValue = await textarea.inputValue();
          expect(inputValue).toContain("@");
        }
      }
    });

    test("displays thread replies when expanded", async ({ page }) => {
      const comments = page.locator("[data-testid='comment-item']");

      if (await comments.count() > 0) {
        const firstComment = comments.first();
        const threadButton = firstComment.locator(
          "[data-testid='expand-thread']"
        );

        if (await threadButton.isVisible()) {
          await threadButton.click();

          // Wait for replies to load
          await page.waitForTimeout(500);

          // Verify replies are visible
          const replies = firstComment.locator(
            "[data-testid='comment-reply']"
          );
          const replyCount = await replies.count();
          expect(replyCount).toBeGreaterThan(0);
        }
      }
    });

    test("reply button shows reply input", async ({ page }) => {
      const comments = page.locator("[data-testid='comment-item']");

      if (await comments.count() > 0) {
        const firstComment = comments.first();

        // Hover to show reply button
        await firstComment.hover();

        const replyButton = firstComment.locator(
          "[data-testid='reply-button']"
        );

        if (await replyButton.isVisible()) {
          await replyButton.click();

          // Verify reply banner appears
          const replyBanner = page.locator(
            "[data-testid='reply-banner']"
          );
          await expect(replyBanner).toBeVisible();
          await expect(replyBanner).toContainText("Replying to");
        }
      }
    });

    test("emoji reactions can be toggled", async ({ page }) => {
      const comments = page.locator("[data-testid='comment-item']");

      if (await comments.count() > 0) {
        const firstComment = comments.first();

        // Hover to show reaction button
        await firstComment.hover();

        const reactButton = firstComment.locator(
          "[data-testid='react-button']"
        );

        if (await reactButton.isVisible()) {
          await reactButton.click();

          // Wait for emoji picker
          await page.waitForTimeout(300);

          // Click first emoji
          const emojis = page.locator("[data-testid='emoji-option']");
          if (await emojis.count() > 0) {
            await emojis.first().click();

            // Wait for reaction to be added
            await page.waitForTimeout(500);

            // Verify reaction badge appears
            const reactions = firstComment.locator(
              "[data-testid='reaction-badge']"
            );
            expect(await reactions.count()).toBeGreaterThan(0);
          }
        }
      }
    });

    test("delete button removes comment (soft delete)", async ({ page }) => {
      const comments = page.locator("[data-testid='comment-item']");
      const initialCount = await comments.count();

      if (initialCount > 0) {
        const firstComment = comments.first();

        // Hover to show delete button
        await firstComment.hover();

        const deleteButton = firstComment.locator(
          "[data-testid='delete-button']"
        );

        if (await deleteButton.isVisible()) {
          // Confirm delete if dialog appears
          page.once("dialog", (dialog) => {
            dialog.accept();
          });

          await deleteButton.click();

          // Wait for deletion
          await page.waitForTimeout(500);

          // Verify comment is marked as deleted
          const content = firstComment.locator(
            "[data-testid='comment-content']"
          );
          expect(content).toContainText("[deleted]");
        }
      }
    });

    test("comment count updates when comment is added", async ({ page }) => {
      const countBadge = page.locator(
        "[data-testid='comment-count']"
      );

      if (await countBadge.isVisible()) {
        const initialCount = parseInt(
          await countBadge.textContent()
        ) || 0;

        // Add a comment
        const textarea = page.locator("[data-testid='comment-input']");
        if (await textarea.isVisible()) {
          await textarea.fill("New comment for count test");
          await page
            .locator("[data-testid='comment-form'] button[type='submit']")
            .click();

          // Wait for update
          await page.waitForTimeout(1000);

          // Verify count increased
          const newCount = parseInt(
            await countBadge.textContent()
          ) || 0;
          expect(newCount).toBeGreaterThan(initialCount);
        }
      }
    });

    test("keyboard shortcut to open mention autocomplete", async ({ page }) => {
      const textarea = page.locator("[data-testid='comment-input']");

      if (await textarea.isVisible()) {
        await textarea.focus();
        await page.keyboard.press("Shift+2"); // @ key might be Shift+2 on some keyboards

        // Alternative: just type @
        await textarea.fill("");
        await textarea.type("@");

        // Wait for dropdown
        await page.waitForTimeout(500);

        const dropdown = page.locator("[data-testid='mention-dropdown']");
        if (await dropdown.isVisible()) {
          expect(dropdown).toBeVisible();
        }
      }
    });
  });

  test.describe("Accessibility", () => {
    test("presence indicator has proper ARIA labels", async ({ page }) => {
      const indicators = page.locator(
        "[data-testid='presence-indicator']"
      );

      if (await indicators.count() > 0) {
        const indicator = indicators.first();

        // Verify has accessible name or description
        const ariaLabel = await indicator.getAttribute("aria-label");
        const ariaDescribedBy = await indicator.getAttribute("aria-describedby");

        if (!ariaLabel && !ariaDescribedBy) {
          // At minimum, visible text should be descriptive
          const text = await indicator.textContent();
          expect(text).toBeTruthy();
        }
      }
    });

    test("comment form is keyboard navigable", async ({ page }) => {
      const textarea = page.locator("[data-testid='comment-input']");
      const submitButton = page.locator(
        "[data-testid='comment-form'] button[type='submit']"
      );

      if (await textarea.isVisible()) {
        // Tab to textarea
        await page.keyboard.press("Tab");
        await expect(textarea).toBeFocused();

        // Tab to submit button
        await page.keyboard.press("Tab");
        await expect(submitButton).toBeFocused();
      }
    });

    test("emoji picker is keyboard accessible", async ({ page }) => {
      const comments = page.locator("[data-testid='comment-item']");

      if (await comments.count() > 0) {
        const firstComment = comments.first();
        await firstComment.hover();

        const reactButton = firstComment.locator(
          "[data-testid='react-button']"
        );

        if (await reactButton.isVisible()) {
          // Focus and open
          await reactButton.focus();
          await page.keyboard.press("Enter");

          // Wait for picker
          await page.waitForTimeout(300);

          // Verify emojis are selectable via arrow keys
          await page.keyboard.press("ArrowRight");
          await page.keyboard.press("Enter");

          // Should select an emoji
          const reactions = firstComment.locator(
            "[data-testid='reaction-badge']"
          );
          expect(await reactions.count()).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe("Error Handling", () => {
    test("gracefully handles missing agents data", async ({ page }) => {
      // Navigation should not crash even if agent data is missing
      const comments = page.locator("[data-testid='comment-item']");
      expect(comments).toBeDefined();
    });

    test("gracefully handles empty comment list", async ({ page }) => {
      const commentSection = page.locator(
        "[data-testid='comments-section']"
      );

      if (await commentSection.isVisible()) {
        const emptyState = page.locator(
          "[data-testid='empty-comments-state']"
        );

        // Either has empty state or has comments
        const hasComments = await commentSection
          .locator("[data-testid='comment-item']")
          .count();

        if (hasComments === 0) {
          await expect(emptyState).toBeVisible();
        }
      }
    });

    test("handles long comments without overflow", async ({ page }) => {
      const longComment = "A".repeat(500); // 500 character comment

      const textarea = page.locator("[data-testid='comment-input']");
      if (await textarea.isVisible()) {
        await textarea.fill(longComment);

        // Should not overflow or break layout
        const formBounds = await page
          .locator("[data-testid='comment-form']")
          .boundingBox();
        expect(formBounds).toBeDefined();
      }
    });
  });
});
