import { test, expect, Page, Browser, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface AuditError {
  pageUrl: string;
  element: string;
  errorType: string;
  errorMessage: string;
  httpStatus?: number;
  consoleLog?: string;
  screenshot?: string;
  timestamp: string;
}

interface AuditReport {
  summary: {
    totalPagesVisited: number;
    totalInteractions: number;
    totalErrorsDetected: number;
    totalFailedNetworkCalls: number;
    criticalErrors: number;
    nonCriticalErrors: number;
  };
  errors: AuditError[];
  discoveredRoutes: string[];
  navigationCoverage: { [key: string]: boolean };
  observations: string[];
  recommendations: string[];
  generatedAt: string;
}

test.describe('Mission Control UI Audit', () => {
  let auditReport: AuditReport = {
    summary: {
      totalPagesVisited: 0,
      totalInteractions: 0,
      totalErrorsDetected: 0,
      totalFailedNetworkCalls: 0,
      criticalErrors: 0,
      nonCriticalErrors: 0,
    },
    errors: [],
    discoveredRoutes: [],
    navigationCoverage: {},
    observations: [],
    recommendations: [],
    generatedAt: new Date().toISOString(),
  };

  const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
  const REPORT_DIR = path.join(process.cwd(), 'reports');
  const SCREENSHOTS_DIR = path.join(REPORT_DIR, `screenshots-${Date.now()}`);
  const errors: AuditError[] = [];
  const networkErrors: { url: string; status: number }[] = [];
  const consoleMessages: { type: string; message: string }[] = [];
  const visitedRoutes = new Set<string>();

  test.beforeAll(async () => {
    // Create directories
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
  });

  test('Comprehensive UI Navigation & Validation', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    // Setup error listeners
    page.on('console', (msg) => {
      const logEntry = {
        type: msg.type(),
        message: msg.text(),
      };
      consoleMessages.push(logEntry);

      // Log critical console errors
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
      }
    });

    page.on('response', (response) => {
      if (response.status() >= 400) {
        networkErrors.push({
          url: response.url(),
          status: response.status(),
        });
      }
    });

    // Start audit
    console.log(`\n🚀 Starting UI Audit at ${BASE_URL}\n`);

    try {
      // Visit root
      await visitPage(page, BASE_URL, '/', errors, visitedRoutes);

      // Navigate to all discovered routes
      await navigateAllRoutes(page, BASE_URL, errors, visitedRoutes);

      // Test all interactive elements
      await testInteractiveElements(page, errors, visitedRoutes);

      console.log(`\n✓ Audit complete!`);
    } catch (error) {
      console.error('Fatal error during audit:', error);
      errors.push({
        pageUrl: page.url(),
        element: 'Page',
        errorType: 'Fatal Error',
        errorMessage: String(error),
        timestamp: new Date().toISOString(),
      });
    }

    await page.close();
    await context.close();

    // Generate report
    generateReport(
      visitedRoutes,
      errors,
      networkErrors,
      consoleMessages,
      auditReport
    );
  });

  async function visitPage(
    page: Page,
    baseUrl: string,
    route: string,
    errorList: AuditError[],
    routeSet: Set<string>
  ) {
    const url = new URL(route, baseUrl).toString();

    if (routeSet.has(url)) {
      return;
    }

    routeSet.add(url);
    auditReport.summary.totalPagesVisited++;

    try {
      console.log(`📄 Visiting: ${route}`);
      await page.goto(url, { waitUntil: 'networkidle' });

      // Wait for content to load
      await page.waitForTimeout(500);

      // Check for common errors
      const bodyText = await page.content();
      if (bodyText.includes('404') || bodyText.includes('not found')) {
        errorList.push({
          pageUrl: url,
          element: 'Page',
          errorType: 'Route Not Found',
          errorMessage: 'Page returned 404',
          timestamp: new Date().toISOString(),
          screenshot: await takeScreenshot(page, SCREENSHOTS_DIR, route),
        });
        auditReport.summary.criticalErrors++;
      }

      // Extract and test all navigation links
      const links = await page.locator('a[href^="/"]').all();
      for (const link of links) {
        const href = await link.getAttribute('href');
        if (href && !href.includes('javascript:') && !href.includes('#')) {
          if (!routeSet.has(new URL(href, baseUrl).toString())) {
            const newRoute = new URL(href, baseUrl).pathname;
            if (visitedRoutes.size < 20) {
              // Limit to 20 routes to avoid infinite loops
              await visitPage(page, baseUrl, newRoute, errorList, routeSet);
            }
          }
        }
      }
    } catch (error) {
      auditReport.summary.criticalErrors++;
      errorList.push({
        pageUrl: url,
        element: 'Navigation',
        errorType: 'Navigation Error',
        errorMessage: String(error),
        timestamp: new Date().toISOString(),
        screenshot: await takeScreenshot(page, SCREENSHOTS_DIR, route),
      });
    }

    auditReport.navigationCoverage[route] = true;
  }

  async function navigateAllRoutes(
    page: Page,
    baseUrl: string,
    errorList: AuditError[],
    routeSet: Set<string>
  ) {
    const knownRoutes = [
      '/',
      '/overview',
      '/approvals',
      '/settings/members',
      '/settings/invites',
      '/gateways',
      '/activity',
      '/agents',
      '/analytics',
      '/api-docs',
      '/bottlenecks',
      '/brain',
      '/calendar',
      '/control',
      '/workload',
    ];

    for (const route of knownRoutes) {
      await visitPage(page, baseUrl, route, errorList, routeSet);
    }
  }

  async function testInteractiveElements(
    page: Page,
    errorList: AuditError[],
    routeSet: Set<string>
  ) {
    console.log('\n🖱️  Testing interactive elements...\n');

    for (const route of Array.from(routeSet)) {
      try {
        await page.goto(route, { waitUntil: 'networkidle' });
        auditReport.summary.totalInteractions++;

        // Test buttons
        const buttons = await page.locator('button').all();
        for (const button of buttons.slice(0, 5)) {
          // Limit to 5 buttons per page
          try {
            const isVisible = await button.isVisible();
            const isEnabled = await button.isEnabled();

            if (isVisible && isEnabled) {
              const text = await button.textContent();
              console.log(`  → Clicking button: "${text?.trim()}"`);

              // Click with safety timeout
              await Promise.race([
                button.click().catch((e) => {
                  // Button might navigate or cause errors, that's ok
                }),
                new Promise((resolve) => setTimeout(resolve, 1000)),
              ]);

              auditReport.summary.totalInteractions++;
            }
          } catch (error) {
            // Continue on button error
          }
        }

        // Go back to route after testing buttons
        await page.goto(route, { waitUntil: 'networkidle' });
      } catch (error) {
        // Continue audit even if page fails
      }
    }
  }

  async function takeScreenshot(
    page: Page,
    screenshotDir: string,
    route: string
  ): Promise<string> {
    try {
      const filename = `${route.replace(/\//g, '-')}-${Date.now()}.png`;
      const filepath = path.join(screenshotDir, filename);
      await page.screenshot({ path: filepath });
      return filepath;
    } catch {
      return '';
    }
  }
});

function generateReport(
  visitedRoutes: Set<string>,
  errors: AuditError[],
  networkErrors: { url: string; status: number }[],
  consoleMessages: { type: string; message: string }[],
  auditReport: AuditReport
) {
  auditReport.discoveredRoutes = Array.from(visitedRoutes);
  auditReport.errors = errors;
  auditReport.summary.totalErrorsDetected = errors.length;
  auditReport.summary.totalFailedNetworkCalls = networkErrors.length;
  auditReport.summary.criticalErrors = errors.filter((e) =>
    ['Fatal Error', 'Route Not Found', 'Hydration Error'].includes(e.errorType)
  ).length;
  auditReport.summary.nonCriticalErrors =
    errors.length - auditReport.summary.criticalErrors;

  // Generate observations
  auditReport.observations = [
    `Total pages discovered: ${visitedRoutes.size}`,
    `Total console messages: ${consoleMessages.length}`,
    `Failed network requests: ${networkErrors.length}`,
    `Critical errors: ${auditReport.summary.criticalErrors}`,
    `Non-critical errors: ${auditReport.summary.nonCriticalErrors}`,
  ];

  // Generate recommendations
  if (auditReport.summary.criticalErrors > 0) {
    auditReport.recommendations.push(
      'Fix critical navigation and routing errors before production'
    );
  }
  if (networkErrors.length > 0) {
    auditReport.recommendations.push(
      'Investigate failed network requests - add error boundaries'
    );
  }
  if (consoleMessages.filter((m) => m.type === 'error').length > 0) {
    auditReport.recommendations.push(
      'Add error handling and logging for better debugging'
    );
  }
  auditReport.recommendations.push(
    'Implement automated E2E tests for all critical user flows'
  );
  auditReport.recommendations.push(
    'Add accessibility testing to catch missing labels and ARIA attributes'
  );

  // Write report
  const timestamp = new Date().toISOString().split('T')[0];
  const reportPath = path.join(
    process.cwd(),
    'reports',
    `mission-control-ui-audit-${timestamp}.md`
  );

  const markdown = generateMarkdownReport(auditReport);
  fs.writeFileSync(reportPath, markdown);

  console.log(`\n✅ Report generated: ${reportPath}`);
}

function generateMarkdownReport(report: AuditReport): string {
  return `# Mission Control UI Audit Report

**Generated:** ${report.generatedAt}

## Summary

| Metric | Count |
|--------|-------|
| **Total Pages Visited** | ${report.summary.totalPagesVisited} |
| **Total Interactions** | ${report.summary.totalInteractions} |
| **Total Errors Detected** | ${report.summary.totalErrorsDetected} |
| **Critical Errors** | ${report.summary.criticalErrors} |
| **Non-Critical Errors** | ${report.summary.nonCriticalErrors} |
| **Failed Network Calls** | ${report.summary.totalFailedNetworkCalls} |

## Error Report

${
  report.errors.length > 0
    ? `
| Page URL | Element/Action | Error Type | Error Message | Screenshot |
|----------|---|---|---|---|
${report.errors
  .map(
    (e) =>
      `| ${e.pageUrl} | ${e.element} | ${e.errorType} | ${e.errorMessage.substring(0, 50)} | ${e.screenshot ? '✓' : '✗'} |`
  )
  .join('\n')}
`
    : '**No errors detected!** ✓'
}

## Navigation Coverage

### Discovered Routes
\`\`\`
${report.discoveredRoutes.map((r) => `- ${r}`).join('\n')}
\`\`\`

### Coverage Map
${Object.entries(report.navigationCoverage)
  .map(([route, success]) => `- ${route}: ${success ? '✓ Tested' : '✗ Failed'}`)
  .join('\n')}

## Observations

${report.observations.map((o) => `- ${o}`).join('\n')}

## Recommendations

${report.recommendations.map((r) => `- **${r}**`).join('\n')}

---

## Detailed Error Logs

${
  report.errors.length > 0
    ? report.errors
        .map(
          (e) => `
### Error: ${e.errorType}
- **Page:** ${e.pageUrl}
- **Element:** ${e.element}
- **Message:** ${e.errorMessage}
- **Timestamp:** ${e.timestamp}
- **Screenshot:** ${e.screenshot || 'N/A'}
`
        )
        .join('\n')
    : 'No detailed errors to report.'
}

---

*End of Report*
`;
}
