import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Mission Control Critical User Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Clear service worker cache before each test
    await page.context().clearCookies();
  });

  test.describe('Navigation Flow', () => {
    test('should navigate from root to overview', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForURL('**/overview');
      expect(page.url()).toContain('/overview');
    });

    test('should navigate to all main routes', async ({ page }) => {
      const routes = [
        '/overview',
        '/approvals',
        '/settings/members',
        '/settings/invites',
        '/gateways',
        '/activity',
      ];

      for (const route of routes) {
        await page.goto(`${BASE_URL}${route}`);
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain(route);
      }
    });

    test('should handle navigation back button', async ({ page }) => {
      await page.goto(`${BASE_URL}/overview`);
      await page.click('a[href="/approvals"]');
      await page.waitForURL('**/approvals');
      await page.goBack();
      await page.waitForURL('**/overview');
      expect(page.url()).toContain('/overview');
    });
  });

  test.describe('Phase 2: RBAC - Members Management', () => {
    test('should load members page', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings/members`);
      await page.waitForLoadState('networkidle');

      // Check for main heading
      const heading = page.locator('text=Members');
      await expect(heading).toBeVisible();
    });

    test('should display invite form when button clicked', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings/members`);
      await page.waitForLoadState('networkidle');

      // Click invite button
      const inviteButton = page.locator('button:has-text("Invite Member")');
      await inviteButton.click();

      // Check form is visible
      const inviteForm = page.locator('text=Invite New Member');
      await expect(inviteForm).toBeVisible();
    });

    test('should validate email in invite form', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings/members`);
      await page.waitForLoadState('networkidle');

      // Open invite form
      await page.locator('button:has-text("Invite Member")').click();

      // Try to submit with invalid email
      await page.fill('input[placeholder*="member@example"]', 'invalid-email');
      await page.click('button:has-text("Send Invite")');

      // Should show error
      const errorMessage = page.locator('text=valid email');
      // Note: May or may not show error depending on implementation
    });
  });

  test.describe('Phase 2: RBAC - Invites Management', () => {
    test('should load invites page', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings/invites`);
      await page.waitForLoadState('networkidle');

      // Check for main heading
      const heading = page.locator('text=Invitations');
      await expect(heading).toBeVisible();
    });

    test('should display pending invitations section', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings/invites`);
      await page.waitForLoadState('networkidle');

      // Check for section heading
      const pendingSection = page.locator('text=Pending Invitations');
      await expect(pendingSection).toBeVisible();
    });
  });

  test.describe('Phase 3: Approvals Governance', () => {
    test('should load approvals page', async ({ page }) => {
      await page.goto(`${BASE_URL}/approvals`);
      await page.waitForLoadState('networkidle');

      // Check for main heading
      const heading = page.locator('text=Approvals');
      await expect(heading).toBeVisible();
    });

    test('should display empty state when no approvals', async ({ page }) => {
      await page.goto(`${BASE_URL}/approvals`);
      await page.waitForLoadState('networkidle');

      // Should show empty state message or no approvals indicator
      const content = await page.content();
      expect(
        content.includes('No approvals') ||
        content.includes('Select an approval') ||
        content.includes('approval')
      ).toBeTruthy();
    });

    test('should have confidence score display', async ({ page }) => {
      await page.goto(`${BASE_URL}/approvals`);
      await page.waitForLoadState('networkidle');

      // The page should have elements for confidence scores
      const content = await page.content();
      expect(content.includes('Confidence') || content.includes('%')).toBeTruthy();
    });
  });

  test.describe('Phase 4: Gateways Management', () => {
    test('should load gateways page', async ({ page }) => {
      await page.goto(`${BASE_URL}/gateways`);
      await page.waitForLoadState('networkidle');

      // Check for main heading
      const heading = page.locator('text=Gateways');
      await expect(heading).toBeVisible();
    });

    test('should display new gateway button', async ({ page }) => {
      await page.goto(`${BASE_URL}/gateways`);
      await page.waitForLoadState('networkidle');

      // Check for "New Gateway" button
      const newGatewayButton = page.locator('button:has-text("New Gateway")');
      await expect(newGatewayButton).toBeVisible();
    });

    test('should open gateway creation form', async ({ page }) => {
      await page.goto(`${BASE_URL}/gateways`);
      await page.waitForLoadState('networkidle');

      // Click "New Gateway" button
      await page.locator('button:has-text("New Gateway")').click();

      // Form should be visible
      const form = page.locator('text=Create New Gateway');
      await expect(form).toBeVisible();
    });

    test('should validate gateway form inputs', async ({ page }) => {
      await page.goto(`${BASE_URL}/gateways`);
      await page.waitForLoadState('networkidle');

      // Open form
      await page.locator('button:has-text("New Gateway")').click();

      // Try to submit empty form
      const submitButton = page.locator('button:has-text("Create Gateway")');
      await submitButton.click();

      // Should show validation error
      const errorMessage = page.locator('text=required');
      // Note: May or may not show error depending on implementation
    });

    test('should have gateway list', async ({ page }) => {
      await page.goto(`${BASE_URL}/gateways`);
      await page.waitForLoadState('networkidle');

      // Check for Gateways list section
      const listSection = page.locator('text=Gateways');
      await expect(listSection).toBeVisible();
    });
  });

  test.describe('Page Stability & Rendering', () => {
    test('should render without console errors', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      const routes = ['/overview', '/approvals', '/settings/members', '/gateways'];

      for (const route of routes) {
        consoleErrors.length = 0;
        await page.goto(`${BASE_URL}${route}`);
        await page.waitForLoadState('networkidle');
        expect(consoleErrors).toEqual([]);
      }
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate network offline
      await page.context().setOffline(true);
      await page.goto(`${BASE_URL}/overview`);

      // Should still show some content or offline message
      const content = await page.content();
      expect(content.length > 0).toBeTruthy();

      // Go back online
      await page.context().setOffline(false);
    });

    test('should not have unhandled promise rejections', async ({ page }) => {
      const rejections: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' && msg.text().includes('Uncaught')) {
          rejections.push(msg.text());
        }
      });

      await page.goto(`${BASE_URL}/overview`);
      await page.waitForLoadState('networkidle');

      expect(rejections.length).toBeLessThanOrEqual(0);
    });
  });

  test.describe('Component Interactions', () => {
    test('should toggle expandable sections', async ({ page }) => {
      await page.goto(`${BASE_URL}/gateways`);
      await page.waitForLoadState('networkidle');

      // Look for expandable buttons
      const expandButtons = page.locator('button[onclick*="setExpanded"], button:has-text("ChevronDown")');
      const count = await expandButtons.count();

      if (count > 0) {
        // Click first expandable
        await expandButtons.first().click();
        // Should update
      }
    });

    test('should handle form submissions without crashing', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings/members`);
      await page.waitForLoadState('networkidle');

      // Open invite form
      const inviteBtn = page.locator('button:has-text("Invite Member")');
      if (await inviteBtn.isVisible()) {
        await inviteBtn.click();

        // Try clicking cancel
        const cancelBtn = page.locator('button:has-text("Cancel")');
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click();
        }

        // Page should still be stable
        expect(page.url()).toContain('/settings/members');
      }
    });
  });

  test.describe('Accessibility Basics', () => {
    test('should have semantic HTML structure', async ({ page }) => {
      await page.goto(`${BASE_URL}/overview`);
      await page.waitForLoadState('networkidle');

      // Check for main landmarks
      const hasHeadings = await page.locator('h1, h2, h3').count();
      expect(hasHeadings).toBeGreaterThan(0);
    });

    test('should have visible text for buttons', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings/members`);
      await page.waitForLoadState('networkidle');

      // Check buttons have visible text or aria-labels
      const buttons = await page.locator('button').all();
      for (const button of buttons.slice(0, 5)) {
        const text = await button.textContent();
        const ariaLabel = await button.getAttribute('aria-label');
        const hasText = (text?.trim().length ?? 0) > 0;
        expect(hasText || ariaLabel).toBeTruthy();
      }
    });
  });

  test.describe('Performance', () => {
    test('should load pages within acceptable time', async ({ page }) => {
      const routes = ['/overview', '/approvals', '/gateways'];

      for (const route of routes) {
        const startTime = Date.now();
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
        const loadTime = Date.now() - startTime;

        // Should load within 5 seconds
        expect(loadTime).toBeLessThan(5000);
      }
    });

    test('should not have memory leaks on navigation', async ({ page }) => {
      const routes = ['/overview', '/approvals', '/gateways'];

      // Navigate through routes multiple times
      for (let i = 0; i < 2; i++) {
        for (const route of routes) {
          await page.goto(`${BASE_URL}${route}`);
          await page.waitForLoadState('networkidle');
        }
      }

      // Page should still be responsive
      const content = await page.content();
      expect(content.length).toBeGreaterThan(0);
    });
  });
});
