import { test, expect } from '@playwright/test';

/**
 * Docker Smoke Tests
 * Validates that the application starts correctly in a Docker container
 * and responds to basic health checks
 */

test.describe('Docker containerization', () => {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

  test('app loads and displays no error page', async ({ page }) => {
    await page.goto(BASE_URL);

    // Should not have error page indicators
    await expect(page).not.toHaveURL(/error|500/);

    // Should load some content (at least the title or favicon indicates page loaded)
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('health endpoint returns 200 with healthy status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body.status).toBe('healthy');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('uptime');
  });

  test('health endpoint returns JSON content-type', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test('app does not have unhandled errors in console', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Allow some console errors but not critical ones
    const criticalErrors = errors.filter(
      (e) =>
        e.includes('Uncaught') ||
        e.includes('Unhandled') ||
        e.includes('Failed to fetch')
    );

    expect(criticalErrors.length).toBe(0);
  });
});
