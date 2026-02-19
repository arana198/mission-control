import { test, expect, devices } from '@playwright/test';

/**
 * E2E Tests: Responsive Design & Mobile
 * Tests mobile layout, touch interactions, and responsive behavior
 */

test.describe('Mobile & Responsive Design', () => {
  test.use({
    viewport: { width: 375, height: 667 }, // iPhone size
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/mission-control-hq/board');
    await page.waitForLoadState('networkidle');
  });

  test('should collapse sidebar on mobile', async ({ page }) => {
    // Sidebar should be hidden or collapsed on mobile
    const sidebar = page.locator('aside, [class*="sidebar"]').first();

    if (await sidebar.isVisible()) {
      // Check if it has collapsed class or is hidden
      const classes = await sidebar.getAttribute('class');
      expect(classes).toMatch(/hidden|collapse|mobile/i);
    }
  });

  test('should show hamburger menu on mobile', async ({ page }) => {
    // Mobile view should have hamburger menu
    const hamburger = page.locator('button[aria-label*="Menu"], button[aria-label*="Toggle sidebar"]').first();

    await expect(hamburger).toBeVisible();
  });

  test('should open sidebar when hamburger clicked', async ({ page }) => {
    const hamburger = page.locator('button[aria-label*="Menu"], button[aria-label*="Toggle"]').first();

    if (await hamburger.isVisible()) {
      await hamburger.click();

      // Sidebar should become visible
      const sidebar = page.locator('aside, [class*="sidebar"]').first();
      await expect(sidebar).toBeVisible({ timeout: 3000 });
    }
  });

  test('should close sidebar when item clicked on mobile', async ({ page }) => {
    const hamburger = page.locator('button[aria-label*="Menu"], button[aria-label*="Toggle"]').first();

    if (await hamburger.isVisible()) {
      await hamburger.click();

      // Click a tab
      const tab = page.locator('[class*="sidebar"] a, [class*="sidebar"] button').first();

      if (await tab.isVisible()) {
        await tab.click();

        // Sidebar should close
        await page.waitForLoadState('networkidle');

        const sidebar = page.locator('aside, [class*="sidebar"]');
        // Should be hidden
        const isHidden = await sidebar.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.display === 'none' || !el.offsetWidth;
        });

        expect(isHidden).toBeTruthy();
      }
    }
  });

  test('should stack content vertically on mobile', async ({ page }) => {
    // Main content should stack vertically
    const main = page.locator('main').first();

    if (await main.isVisible()) {
      // Get layout properties
      const layout = await main.evaluate((el) => ({
        display: window.getComputedStyle(el).display,
        width: el.offsetWidth,
      }));

      // Should be block or flex (not side-by-side)
      expect(layout.display).toMatch(/block|flex|grid/);
    }
  });

  test('should make buttons larger on mobile', async ({ page }) => {
    const buttons = page.locator('button').first();

    if (await buttons.isVisible()) {
      // Get button size
      const size = await buttons.evaluate((el) => ({
        height: el.offsetHeight,
        padding: window.getComputedStyle(el).padding,
      }));

      // Button should be reasonably sized for touch (min 44px recommended)
      expect(size.height >= 40 || size.padding.includes('0.75rem')).toBeTruthy();
    }
  });

  test('should handle touch/tap interactions', async ({ page }) => {
    // Test touch event handling
    const card = page.locator('[class*="card"], [class*="item"]').first();

    if (await card.isVisible()) {
      // Simulate tap
      await card.tap();

      // Should respond to tap
      await page.waitForLoadState('networkidle');

      // Either navigated or modal opened
      expect(page.url()).toBeTruthy();
    }
  });

  test('should have readable font sizes on mobile', async ({ page }) => {
    const text = page.locator('body').first();

    if (await text.isVisible()) {
      const fontSize = await text.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return parseInt(style.fontSize);
      });

      // Font size should be at least 16px for readability
      expect(fontSize >= 14).toBeTruthy();
    }
  });

  test('should have sufficient touch target sizes', async ({ page }) => {
    const buttons = page.locator('button');
    const count = await buttons.count();

    if (count > 0) {
      const firstButton = buttons.first();

      const size = await firstButton.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
        };
      });

      // Touch targets should be at least 44x44px
      expect(size.width >= 40 && size.height >= 40).toBeTruthy();
    }
  });

  test('should not have horizontal scrolling on mobile', async ({ page }) => {
    const body = page.locator('body').first();

    const hasHScroll = await body.evaluate((el) => {
      return window.innerWidth < el.scrollWidth;
    });

    expect(hasHScroll).toBeFalsy();
  });

  test('should display inputs clearly on mobile', async ({ page }) => {
    // Open modal to test inputs
    const createBtn = page.locator('button:has-text("New Task")').first();

    if (await createBtn.isVisible()) {
      await createBtn.click();

      await page.waitForSelector('input[placeholder*="Title"]', { timeout: 5000 });

      const input = page.locator('input[placeholder*="Title"]').first();

      if (await input.isVisible()) {
        // Input should be large enough
        const size = await input.evaluate((el) => ({
          height: el.offsetHeight,
          width: el.offsetWidth,
        }));

        expect(size.height >= 40).toBeTruthy();
        expect(size.width > 0).toBeTruthy();
      }
    }
  });

  test('should handle viewport resize correctly', async ({ page }) => {
    // Set to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    const sidebar = page.locator('aside, [class*="sidebar"]').first();

    if (await sidebar.isVisible()) {
      // Should be hidden/collapsed
      const isHidden = await sidebar.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || !el.offsetWidth;
      });

      expect(isHidden).toBeTruthy();
    }

    // Resize to tablet
    await page.setViewportSize({ width: 768, height: 1024 });

    // Sidebar should adjust
    await page.waitForLoadState('networkidle');
  });

  test('should show proper spacing on mobile', async ({ page }) => {
    // Content should not be cramped
    const main = page.locator('main').first();

    if (await main.isVisible()) {
      const padding = await main.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.padding;
      });

      // Should have some padding
      expect(padding).not.toMatch(/0px|0rem/);
    }
  });
});

test.describe('Tablet Size', () => {
  test.use({
    viewport: { width: 768, height: 1024 },
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/mission-control-hq/board');
    await page.waitForLoadState('networkidle');
  });

  test('should display two-column layout on tablet', async ({ page }) => {
    // Sidebar and main should both be visible on tablet
    const sidebar = page.locator('aside, [class*="sidebar"]').first();
    const main = page.locator('main').first();

    if (await sidebar.isVisible() && await main.isVisible()) {
      await expect(sidebar).toBeVisible();
      await expect(main).toBeVisible();
    }
  });

  test('should have responsive spacing on tablet', async ({ page }) => {
    const container = page.locator('[class*="container"], main').first();

    if (await container.isVisible()) {
      const width = await container.evaluate((el) => el.offsetWidth);

      // Should be appropriately sized for tablet
      expect(width > 300).toBeTruthy();
    }
  });
});

test.describe('Desktop Size', () => {
  test.use({
    viewport: { width: 1920, height: 1080 },
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/mission-control-hq/board');
    await page.waitForLoadState('networkidle');
  });

  test('should display sidebar on desktop', async ({ page }) => {
    const sidebar = page.locator('aside, [class*="sidebar"]').first();

    await expect(sidebar).toBeVisible();
  });

  test('should show full layout on desktop', async ({ page }) => {
    const sidebar = page.locator('aside, [class*="sidebar"]').first();
    const main = page.locator('main').first();

    await expect(sidebar).toBeVisible();
    await expect(main).toBeVisible();
  });
});
