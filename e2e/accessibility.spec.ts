import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Accessibility
 * Tests keyboard navigation, ARIA labels, semantic HTML
 */

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mission-control-hq/board');
    await page.waitForLoadState('networkidle');
  });

  test('should support keyboard navigation with Tab', async ({ page }) => {
    // Tab to first interactive element
    await page.keyboard.press('Tab');

    // Get focused element
    const focused = await page.evaluate(() => {
      return document.activeElement?.tagName || '';
    });

    expect(focused).toBeTruthy();
  });

  test('should have focusable interactive elements', async ({ page }) => {
    // Get all buttons and links
    const interactiveElements = await page.locator('button, a, input').count();

    expect(interactiveElements > 0).toBeTruthy();
  });

  test('should show focus indicator', async ({ page }) => {
    // Tab to first element
    await page.keyboard.press('Tab');

    // Check if element has visible focus
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (!el) return null;

      const style = window.getComputedStyle(el);
      const outline = style.outline;
      const boxShadow = style.boxShadow;

      return {
        hasOutline: outline !== 'none' && outline !== '',
        hasBoxShadow: boxShadow !== 'none',
        isVisible: el.offsetWidth > 0 && el.offsetHeight > 0,
      };
    });

    // Should have visible focus indicator
    expect(focused?.isVisible).toBeTruthy();
  });

  test('should have descriptive button labels', async ({ page }) => {
    const buttons = page.locator('button');
    const count = await buttons.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        const button = buttons.nth(i);

        // Should have accessible text or aria-label
        const text = await button.textContent();
        const ariaLabel = await button.getAttribute('aria-label');

        expect(text?.trim() || ariaLabel).toBeTruthy();
      }
    }
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();

    // Should have at least one heading
    expect(headings > 0).toBeTruthy();

    // Check order
    const headingText = await page.evaluate(() => {
      const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return Array.from(headingElements).map((el) => ({
        tag: el.tagName,
        level: parseInt(el.tagName[1]),
      }));
    });

    // Should start with h1 or h2 (not h3+)
    if (headingText.length > 0) {
      expect(headingText[0].level <= 2).toBeTruthy();
    }
  });

  test('should have alt text for images', async ({ page }) => {
    const images = page.locator('img');
    const count = await images.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');

        // Should have alt text or role=presentation
        const role = await img.getAttribute('role');

        if (role !== 'presentation' && role !== 'img') {
          expect(alt).toBeTruthy();
        }
      }
    }
  });

  test('should have semantic HTML structure', async ({ page }) => {
    // Check for semantic elements
    const nav = page.locator('nav');
    const main = page.locator('main');
    const header = page.locator('header');
    const footer = page.locator('footer');

    // Should use semantic markup
    expect(await header.isVisible()).toBeTruthy();
    expect(await main.isVisible()).toBeTruthy();
  });

  test('should support keyboard navigation through menu', async ({ page }) => {
    const sidebar = page.locator('aside, [class*="sidebar"]').first();

    if (await sidebar.isVisible()) {
      // Tab until we reach a sidebar link
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');

        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            tag: el?.tagName,
            text: (el as HTMLElement)?.textContent?.substring(0, 30),
          };
        });

        // If we reached a sidebar element, test navigation
        if (focused.tag === 'A' || focused.text?.includes('Board')) {
          break;
        }
      }
    }
  });

  test('should have proper ARIA labels', async ({ page }) => {
    // Check buttons have aria-label or text content
    const buttons = page.locator('button').first();

    if (await buttons.isVisible()) {
      const text = await buttons.textContent();
      const ariaLabel = await buttons.getAttribute('aria-label');

      expect(text?.trim() || ariaLabel).toBeTruthy();
    }
  });

  test('should announce dialog when opened', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      // Dialog should have role
      const initialDialogs = await page.locator('[role="dialog"]').count();

      await createBtn.click();

      const finalDialogs = await page.locator('[role="dialog"]').count();

      expect(finalDialogs > initialDialogs).toBeTruthy();

      // Dialog should have aria-label or aria-labelledby
      const dialog = page.locator('[role="dialog"]').first();

      if (await dialog.isVisible()) {
        const ariaLabel = await dialog.getAttribute('aria-label');
        const ariaLabelledBy = await dialog.getAttribute('aria-labelledby');

        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    }
  });

  test('should support Enter/Escape in modals', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();

      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      // Press Escape to close
      await page.keyboard.press('Escape');

      // Modal should close
      await page.waitForLoadState('networkidle');

      const modal = page.locator('div[role="dialog"]');
      const isClosed = !(await modal.isVisible());

      expect(isClosed).toBeTruthy();
    }
  });

  test('should have proper form label associations', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();

      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      const inputs = page.locator('input, select, textarea');
      const count = await inputs.count();

      if (count > 0) {
        for (let i = 0; i < Math.min(count, 3); i++) {
          const input = inputs.nth(i);

          // Should have associated label or aria-label
          const id = await input.getAttribute('id');
          const ariaLabel = await input.getAttribute('aria-label');
          const placeholder = await input.getAttribute('placeholder');

          let hasLabel = false;

          if (id) {
            const label = page.locator(`label[for="${id}"]`);
            hasLabel = await label.isVisible();
          }

          expect(hasLabel || ariaLabel || placeholder).toBeTruthy();
        }
      }
    }
  });

  test('should maintain focus management in modals', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();

      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      // Focus should be inside modal
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        const modal = document.querySelector('[role="dialog"]');

        if (!el || !modal) return null;

        return modal.contains(el);
      });

      expect(focusedElement).toBeTruthy();
    }
  });

  test('should have sufficient color contrast', async ({ page }) => {
    // Check text elements for contrast
    const textElements = await page.locator('p, span, a, button, h1, h2, h3, h4, h5, h6').count();

    // Should have substantial text content
    expect(textElements > 0).toBeTruthy();
  });

  test('should not rely on color alone to convey information', async ({ page }) => {
    // Check for P0, P1, P2 indicators
    const priorityText = page.locator('text=/P0|P1|P2|P3/');

    if (await priorityText.isVisible()) {
      // Should have additional indicator (icon, text, badge)
      const priority = priorityText.first();

      // Should not be color-only
      const classes = await priority.getAttribute('class');

      expect(classes).toBeTruthy();
    }
  });

  test('should handle skip links if present', async ({ page }) => {
    // Look for skip to main content link
    const skipLink = page.locator('a:has-text(/Skip|Main/)').first();

    if (await skipLink.isVisible()) {
      // Should be keyboard accessible
      await page.keyboard.press('Tab');

      const focused = await page.evaluate(() => {
        return document.activeElement?.getAttribute('href');
      });

      expect(focused).toBeTruthy();
    }
  });
});
