import { test, expect, Page, Browser, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface AuditError {
  pageUrl: string;
  element: string;
  errorType: string;
  errorMessage: string;
  httpStatus?: number;
  consoleStackTrace?: string;
  screenshotPath?: string;
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
    consoleErrors: number;
  };
  errors: AuditError[];
  discoveredRoutes: string[];
  navigationCoverage: { [key: string]: boolean };
  networkFailures: Array<{ url: string; status: number; timestamp: string }>;
  consoleIssues: Array<{ type: string; message: string; timestamp: string }>;
  observations: string[];
  recommendations: string[];
  generatedAt: string;
  executionDuration: number;
}

test.describe('Mission Control Comprehensive UI Audit', () => {
  let auditReport: AuditReport = {
    summary: {
      totalPagesVisited: 0,
      totalInteractions: 0,
      totalErrorsDetected: 0,
      totalFailedNetworkCalls: 0,
      criticalErrors: 0,
      nonCriticalErrors: 0,
      consoleErrors: 0,
    },
    errors: [],
    discoveredRoutes: [],
    navigationCoverage: {},
    networkFailures: [],
    consoleIssues: [],
    observations: [],
    recommendations: [],
    generatedAt: new Date().toISOString(),
    executionDuration: 0,
  };

  const BASE_URL = 'http://localhost:3000';
  const REPORT_DIR = path.join(process.cwd(), 'reports');
  const SCREENSHOTS_DIR = path.join(REPORT_DIR, `screenshots-${Date.now()}`);

  const errors: AuditError[] = [];
  const networkFailures: Array<{ url: string; status: number; timestamp: string }> = [];
  const consoleIssues: Array<{ type: string; message: string; timestamp: string }> = [];
  const visitedRoutes = new Set<string>();
  const testedElements = new Map<string, number>();

  let startTime: number;

  test.beforeAll(async () => {
    startTime = Date.now();
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
  });

  test('Complete Application Navigation & Interactive Element Testing', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    // Setup comprehensive error tracking
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        const issue = {
          type: msg.type(),
          message: msg.text(),
          timestamp: new Date().toISOString(),
        };
        consoleIssues.push(issue);

        if (msg.type() === 'error') {
          auditReport.summary.consoleErrors++;
          console.error(`[CONSOLE ERROR] ${msg.text()}`);
        }
      }
    });

    page.on('response', (response) => {
      if (response.status() >= 400) {
        const failure = {
          url: response.url(),
          status: response.status(),
          timestamp: new Date().toISOString(),
        };
        networkFailures.push(failure);
        auditReport.summary.totalFailedNetworkCalls++;
        console.warn(`[Network ${response.status()}] ${response.url()}`);
      }
    });

    page.on('pageerror', (error) => {
      errors.push({
        pageUrl: page.url(),
        element: 'Page',
        errorType: 'Unhandled Promise Rejection',
        errorMessage: error.message,
        consoleStackTrace: error.stack,
        timestamp: new Date().toISOString(),
      });
      auditReport.summary.criticalErrors++;
    });

    console.log(`\n🚀 Starting Comprehensive UI Audit at ${BASE_URL}\n`);

    try {
      // Phase 1: Discover and navigate all routes
      console.log('📍 Phase 1: Route Discovery and Navigation');
      await visitPage(page, BASE_URL, '/', errors, visitedRoutes);
      await discoverAndNavigateRoutes(page, BASE_URL, errors, visitedRoutes);

      // Phase 2: Test interactive elements
      console.log('\n🖱️  Phase 2: Interactive Element Testing');
      await testAllInteractiveElements(page, errors, visitedRoutes);

      // Phase 3: Test UI modals and side panels
      console.log('\n🎯 Phase 3: Modal & Panel Testing');
      await testModalsAndPanels(page, errors, visitedRoutes);

      // Phase 4: Test navigation flows
      console.log('\n🗺️  Phase 4: Navigation Flow Testing');
      await testNavigationFlows(page, errors, visitedRoutes);

      console.log(`\n✓ Audit complete!\n`);
    } catch (error) {
      console.error('Fatal error during audit:', error);
      errors.push({
        pageUrl: page.url(),
        element: 'Page',
        errorType: 'Fatal Error',
        errorMessage: String(error),
        timestamp: new Date().toISOString(),
      });
      auditReport.summary.criticalErrors++;
    }

    await page.close();
    await context.close();

    // Generate comprehensive report
    auditReport.executionDuration = Date.now() - startTime;
    generateComprehensiveReport(
      visitedRoutes,
      errors,
      networkFailures,
      consoleIssues,
      testedElements,
      auditReport
    );
  });

  async function visitPage(
    page: Page,
    baseUrl: string,
    route: string,
    errorList: AuditError[],
    routeSet: Set<string>
  ): Promise<boolean> {
    const url = new URL(route, baseUrl).toString();

    if (routeSet.has(url)) {
      return true;
    }

    routeSet.add(url);
    auditReport.summary.totalPagesVisited++;

    try {
      console.log(`  📄 ${route}`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
      await page.waitForTimeout(300);

      // Check for error states
      const content = await page.content();
      if (content.includes('500') || content.includes('Internal Server Error')) {
        errorList.push({
          pageUrl: url,
          element: 'Page',
          errorType: 'Server Error',
          errorMessage: 'Page returned 500 error',
          timestamp: new Date().toISOString(),
          screenshotPath: await takeScreenshot(page, SCREENSHOTS_DIR, route),
        });
        auditReport.summary.criticalErrors++;
      }

      // Extract all navigation links and recursively visit
      const links = await page.locator('a[href]').all();
      const newRoutes: string[] = [];

      for (const link of links) {
        try {
          const href = await link.getAttribute('href');
          if (href && !href.startsWith('javascript:') && !href.startsWith('http') && !href.startsWith('mailto:')) {
            const fullUrl = new URL(href, baseUrl).toString();
            if (!routeSet.has(fullUrl) && visitedRoutes.size < 30) {
              const pathname = new URL(href, baseUrl).pathname;
              if (!newRoutes.includes(pathname)) {
                newRoutes.push(pathname);
              }
            }
          }
        } catch {
          // Skip invalid links
        }
      }

      // Visit discovered routes
      for (const newRoute of newRoutes) {
        await visitPage(page, baseUrl, newRoute, errorList, routeSet);
      }

      auditReport.navigationCoverage[route] = true;
      return true;
    } catch (error) {
      errorList.push({
        pageUrl: url,
        element: 'Navigation',
        errorType: 'Navigation Error',
        errorMessage: String(error),
        timestamp: new Date().toISOString(),
        screenshotPath: await takeScreenshot(page, SCREENSHOTS_DIR, route),
      });
      auditReport.summary.criticalErrors++;
      auditReport.navigationCoverage[route] = false;
      return false;
    }
  }

  async function discoverAndNavigateRoutes(
    page: Page,
    baseUrl: string,
    errorList: AuditError[],
    routeSet: Set<string>
  ): Promise<void> {
    const knownRoutes = [
      '/',
      '/board',
      '/epics',
      '/wiki',
      '/workload',
      '/analytics',
      '/api-docs',
      '/control',
      '/agents',
    ];

    for (const route of knownRoutes) {
      if (visitedRoutes.size < 30) {
        await visitPage(page, baseUrl, route, errorList, routeSet);
      }
    }
  }

  async function testAllInteractiveElements(
    page: Page,
    errorList: AuditError[],
    routeSet: Set<string>
  ): Promise<void> {
    const routes = Array.from(routeSet).slice(0, 10); // Test first 10 routes

    for (const route of routes) {
      try {
        await page.goto(route, { waitUntil: 'networkidle', timeout: 10000 });
        await page.waitForTimeout(200);

        // Test all buttons
        const buttons = await page.locator('button:visible').all();
        for (let i = 0; i < Math.min(buttons.length, 10); i++) {
          try {
            const button = buttons[i];
            const isEnabled = await button.isEnabled();
            const text = await button.textContent();

            if (isEnabled && text?.trim()) {
              console.log(`    🔘 Button: "${text.trim().substring(0, 40)}"`);
              testedElements.set('button', (testedElements.get('button') || 0) + 1);
              auditReport.summary.totalInteractions++;

              // Click safely
              await Promise.race([
                button.click().catch(() => {}),
                new Promise((resolve) => setTimeout(resolve, 800)),
              ]);
            }
          } catch {
            // Continue testing other buttons
          }
        }

        // Test all input fields
        const inputs = await page.locator('input:visible').all();
        for (let i = 0; i < Math.min(inputs.length, 5); i++) {
          try {
            const input = inputs[i];
            const placeholder = await input.getAttribute('placeholder');
            const type = await input.getAttribute('type');

            if (type !== 'hidden') {
              console.log(`    📝 Input: ${placeholder || type || 'text'}`);
              testedElements.set('input', (testedElements.get('input') || 0) + 1);
              auditReport.summary.totalInteractions++;

              await input.click();
              await input.fill('test-value');
            }
          } catch {
            // Continue
          }
        }

        // Test all select/dropdown elements
        const selects = await page.locator('select:visible, [role="combobox"]:visible').all();
        for (let i = 0; i < Math.min(selects.length, 3); i++) {
          try {
            const select = selects[i];
            console.log(`    🔽 Dropdown`);
            testedElements.set('select', (testedElements.get('select') || 0) + 1);
            auditReport.summary.totalInteractions++;

            await select.click();
            await page.waitForTimeout(200);
          } catch {
            // Continue
          }
        }

        // Return to route after testing
        try {
          await page.goto(route, { waitUntil: 'networkidle', timeout: 10000 });
        } catch {
          // Ignore navigation errors
        }
      } catch (error) {
        // Continue audit even if route fails
      }
    }
  }

  async function testModalsAndPanels(
    page: Page,
    errorList: AuditError[],
    routeSet: Set<string>
  ): Promise<void> {
    const routes = Array.from(routeSet).slice(0, 5);

    for (const route of routes) {
      try {
        await page.goto(route, { waitUntil: 'networkidle', timeout: 10000 });
        await page.waitForTimeout(200);

        // Look for modal triggers
        const modalTriggers = await page.locator('[data-testid*="modal"], [role="dialog"]').all();

        for (let i = 0; i < Math.min(modalTriggers.length, 2); i++) {
          try {
            console.log(`    🎨 Modal/Panel detected`);
            testedElements.set('modal', (testedElements.get('modal') || 0) + 1);

            // Try to close modal if it exists
            const closeButton = page.locator('button[aria-label="Close"], [data-testid="close-modal"]').first();
            if (await closeButton.isVisible()) {
              await closeButton.click();
              await page.waitForTimeout(200);
            }
          } catch {
            // Continue
          }
        }
      } catch {
        // Continue
      }
    }
  }

  async function testNavigationFlows(
    page: Page,
    errorList: AuditError[],
    routeSet: Set<string>
  ): Promise<void> {
    const routes = Array.from(routeSet).slice(0, 5);

    for (const route of routes) {
      try {
        await page.goto(route, { waitUntil: 'networkidle', timeout: 10000 });
        await page.waitForTimeout(200);

        // Test navigation sidebar
        const navLinks = await page.locator('nav a:visible, [role="navigation"] a:visible').all();

        for (let i = 0; i < Math.min(navLinks.length, 3); i++) {
          try {
            const link = navLinks[i];
            const href = await link.getAttribute('href');
            const text = await link.textContent();

            if (href && !href.startsWith('javascript:')) {
              console.log(`    🔗 Nav: "${text?.trim().substring(0, 30)}"`);
              testedElements.set('nav-link', (testedElements.get('nav-link') || 0) + 1);
              auditReport.summary.totalInteractions++;

              await link.click();
              await page.waitForTimeout(500);

              // Verify page changed or modal opened
              const newUrl = page.url();
              if (newUrl !== route) {
                console.log(`       ✓ Navigated to ${newUrl.replace(BASE_URL, '')}`);
              }
            }
          } catch {
            // Continue
          }
        }
      } catch {
        // Continue
      }
    }
  }

  async function takeScreenshot(
    page: Page,
    screenshotDir: string,
    route: string
  ): Promise<string> {
    try {
      const sanitized = route.replace(/\//g, '-').replace(/^-/, '');
      const filename = `${sanitized || 'root'}-${Date.now()}.png`;
      const filepath = path.join(screenshotDir, filename);
      await page.screenshot({ path: filepath, fullPage: true });
      return filepath;
    } catch {
      return '';
    }
  }
});

function generateComprehensiveReport(
  visitedRoutes: Set<string>,
  errors: AuditError[],
  networkFailures: Array<{ url: string; status: number; timestamp: string }>,
  consoleIssues: Array<{ type: string; message: string; timestamp: string }>,
  testedElements: Map<string, number>,
  auditReport: AuditReport
): void {
  auditReport.discoveredRoutes = Array.from(visitedRoutes);
  auditReport.errors = errors;
  auditReport.networkFailures = networkFailures;
  auditReport.consoleIssues = consoleIssues;
  auditReport.summary.totalErrorsDetected = errors.length;

  // Generate observations
  auditReport.observations = [
    `✓ Total pages discovered and visited: ${visitedRoutes.size}`,
    `✓ Total interactive elements tested: ${auditReport.summary.totalInteractions}`,
    `✓ Button tests: ${testedElements.get('button') || 0}`,
    `✓ Input tests: ${testedElements.get('input') || 0}`,
    `✓ Dropdown tests: ${testedElements.get('select') || 0}`,
    `✓ Modal/Panel tests: ${testedElements.get('modal') || 0}`,
    `✓ Navigation link tests: ${testedElements.get('nav-link') || 0}`,
    `⚠ Console errors: ${auditReport.summary.consoleErrors}`,
    `⚠ Failed network requests: ${networkFailures.length}`,
    `⚠ Critical errors: ${auditReport.summary.criticalErrors}`,
    `✓ Execution duration: ${(auditReport.executionDuration / 1000).toFixed(2)}s`,
  ];

  // Generate recommendations
  if (auditReport.summary.criticalErrors > 0) {
    auditReport.recommendations.push(
      '🔴 **CRITICAL:** Fix routing errors and navigation issues before production'
    );
  }
  if (networkFailures.length > 10) {
    auditReport.recommendations.push(
      '🟠 **High Priority:** Investigate failed network requests (>10 failures)'
    );
  }
  if (auditReport.summary.consoleErrors > 5) {
    auditReport.recommendations.push(
      '🟡 **Medium Priority:** Reduce console errors - add error boundaries and validation'
    );
  }
  if (errors.length === 0 && networkFailures.length === 0) {
    auditReport.recommendations.push(
      '✅ **All Clear:** No critical issues detected in UI audit'
    );
  }
  auditReport.recommendations.push(
    '📋 Implement continuous E2E testing for all new features'
  );
  auditReport.recommendations.push(
    '🔍 Add accessibility audit to catch WCAG 2.1 violations'
  );

  // Write markdown report
  const timestamp = new Date().toISOString().split('T')[0];
  const reportPath = path.join(process.cwd(), 'reports', `mission-control-ui-audit-${timestamp}.md`);
  const markdown = generateMarkdownReport(auditReport);
  fs.writeFileSync(reportPath, markdown);

  // Write JSON report for programmatic access
  const jsonPath = path.join(process.cwd(), 'reports', `mission-control-ui-audit-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(auditReport, null, 2));

  console.log(`\n✅ Markdown Report: ${reportPath}`);
  console.log(`✅ JSON Report: ${jsonPath}`);
}

function generateMarkdownReport(report: AuditReport): string {
  const errorTable =
    report.errors.length > 0
      ? `| Page URL | Element | Error Type | Message | Screenshot |
|----------|---------|-----------|---------|------------|
${report.errors
  .map(
    (e) => `| \`${e.pageUrl.replace('http://localhost:3000', '')}\` | ${e.element} | ${e.errorType} | ${e.errorMessage.substring(0, 50)}... | ${e.screenshotPath ? '📸' : '—'} |`
  )
  .join('\n')}`
      : '✅ **No errors detected!**';

  const networkTable =
    report.networkFailures.length > 0
      ? `| URL | Status | Time |
|-----|--------|------|
${report.networkFailures
  .slice(0, 20)
  .map((f) => `| \`${f.url.substring(0, 60)}\` | ${f.status} | ${new Date(f.timestamp).toLocaleTimeString()} |`)
  .join('\n')}`
      : '✅ **All network requests succeeded!**';

  return `# Mission Control Comprehensive UI Audit Report

**🔍 Generated:** ${report.generatedAt}
**⏱️ Duration:** ${(report.executionDuration / 1000).toFixed(2)}s

---

## 📊 Executive Summary

| Metric | Value |
|--------|-------|
| **Pages Visited** | ${report.summary.totalPagesVisited} |
| **Interactive Elements Tested** | ${report.summary.totalInteractions} |
| **Errors Detected** | ${report.summary.totalErrorsDetected} |
| **Critical Errors** | ${report.summary.criticalErrors} |
| **Non-Critical Errors** | ${report.summary.nonCriticalErrors} |
| **Console Errors** | ${report.summary.consoleErrors} |
| **Failed Network Calls** | ${report.summary.totalFailedNetworkCalls} |

---

## 🗺️ Navigation Coverage Map

### Discovered Routes (${report.discoveredRoutes.length})

\`\`\`
${report.discoveredRoutes.map((r) => `✓ ${r}`).join('\n')}
\`\`\`

### Route Testing Results

${Object.entries(report.navigationCoverage)
  .map(([route, success]) => `- \`${route}\`: ${success ? '✅ Passed' : '❌ Failed'}`)
  .join('\n')}

---

## 🐛 Error Report

${errorTable}

${report.errors.length > 0 ? `
### Detailed Error Logs

${report.errors
  .map(
    (e, i) => `
#### Error ${i + 1}: ${e.errorType}
- **Page:** \`${e.pageUrl}\`
- **Element:** ${e.element}
- **Message:** ${e.errorMessage}
- **Time:** ${e.timestamp}
- **Screenshot:** ${e.screenshotPath || 'Not captured'}
${e.consoleStackTrace ? `- **Stack Trace:**\n\`\`\`\n${e.consoleStackTrace.substring(0, 500)}\n\`\`\`` : ''}
`
  )
  .join('\n')}
` : ''}

---

## 🌐 Network Analysis

${networkTable}

${report.consoleIssues.length > 0 ? `
### Console Issues (${report.consoleIssues.length})

${report.consoleIssues
  .slice(0, 10)
  .map((c) => `- **${c.type.toUpperCase()}:** ${c.message}`)
  .join('\n')}
` : ''}

---

## 📈 Observations

${report.observations.map((o) => `- ${o}`).join('\n')}

---

## 🎯 Recommendations

${report.recommendations.map((r) => `- ${r}`).join('\n')}

---

## 🧪 Test Coverage Details

- ✅ Route Discovery: Automated navigation crawler
- ✅ Interactive Elements: Button, input, select, modal testing
- ✅ Network Monitoring: Real-time failure detection
- ✅ Console Monitoring: Error and warning tracking
- ✅ Navigation Flows: Link and sidebar navigation testing
- ✅ Screenshot Capture: Error state documentation

---

*Generated by Mission Control Comprehensive UI Audit | ${new Date().toLocaleString()}*
`;
}
