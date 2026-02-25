const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';
const REPORT_DIR = path.join(process.cwd(), 'reports');
const REPORT_FILE = path.join(REPORT_DIR, `mission-control-ui-audit-${new Date().toISOString().split('T')[0]}.md`);

async function runAudit() {
  console.log('🚀 Starting Mission Control UI Audit\n');

  const errors = [];
  const visitedRoutes = new Set();
  const networkErrors = [];
  const consoleErrors = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Setup listeners
  page.on('response', (response) => {
    if (response.status() >= 400) {
      networkErrors.push({
        url: response.url(),
        status: response.status(),
      });
    }
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push({
        type: msg.type(),
        message: msg.text(),
      });
    }
  });

  const routes = [
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

  for (const route of routes) {
    let lastResponse = null;

    page.on('response', (response) => {
      if (response.request().resourceType() === 'document') {
        lastResponse = response;
      }
    });

    try {
      console.log(`📄 Visiting: ${route}`);
      const url = new URL(route, BASE_URL).toString();
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });

      visitedRoutes.add(route);
      await page.waitForTimeout(500);

      // Check HTTP status
      if (response && response.status() >= 400) {
        errors.push({
          pageUrl: route,
          element: 'Page',
          errorType: `HTTP ${response.status()}`,
          errorMessage: `Page returned ${response.status()} status`,
        });
      } else {
        // Page loaded successfully
        console.log(`  ✓ Loaded (HTTP ${response?.status() || 'unknown'})`);
      }
    } catch (error) {
      errors.push({
        pageUrl: route,
        element: 'Navigation',
        errorType: 'Navigation Error',
        errorMessage: error.message,
      });
    }
  }

  console.log(`\n✓ Audit complete!\n`);
  console.log(`  Pages visited: ${visitedRoutes.size}`);
  console.log(`  Errors found: ${errors.length}`);
  console.log(`  Network errors: ${networkErrors.length}`);
  console.log(`  Console errors: ${consoleErrors.length}\n`);

  await browser.close();

  // Generate report
  const report = generateReport(
    visitedRoutes,
    errors,
    networkErrors,
    consoleErrors
  );

  fs.writeFileSync(REPORT_FILE, report);
  console.log(`✅ Report saved: ${REPORT_FILE}\n`);

  return { errors, networkErrors, consoleErrors, visitedRoutes };
}

function generateReport(visitedRoutes, errors, networkErrors, consoleErrors) {
  const timestamp = new Date().toISOString();
  const criticalErrors = errors.filter((e) =>
    ['Route Not Found', 'Navigation Error'].includes(e.errorType)
  ).length;

  return `# Mission Control UI Audit Report

**Generated:** ${timestamp}

## Summary

| Metric | Count |
|--------|-------|
| **Pages Visited** | ${visitedRoutes.size} |
| **Total Errors** | ${errors.length} |
| **Critical Errors** | ${criticalErrors} |
| **Network Errors** | ${networkErrors.length} |
| **Console Errors/Warnings** | ${consoleErrors.length} |

## ✓ Test Results

**Status:** ${errors.length === 0 && networkErrors.length === 0 ? '✅ PASSED' : '⚠️ ISSUES FOUND'}

## Pages Visited

${Array.from(visitedRoutes)
  .map((route) => `- \`${route}\` ✓`)
  .join('\n')}

## Error Report

${
  errors.length > 0
    ? `### Errors (${errors.length})

| Route | Error Type | Message |
|-------|-----------|---------|
${errors.map((e) => `| \`${e.pageUrl}\` | ${e.errorType} | ${e.errorMessage.substring(0, 60)} |`).join('\n')}
`
    : '### No Errors Found ✅'
}

${
  networkErrors.length > 0
    ? `### Network Errors (${networkErrors.length})

| URL | Status |
|-----|--------|
${networkErrors.map((e) => `| ${e.url.substring(0, 80)} | **${e.status}** |`).join('\n')}
`
    : '### No Network Errors ✅'
}

${
  consoleErrors.length > 0
    ? `### Console Errors/Warnings (${consoleErrors.length})

\`\`\`
${consoleErrors.map((e) => `[${e.type.toUpperCase()}] ${e.message}`).join('\n')}
\`\`\`
`
    : '### No Console Errors ✅'
}

## Recommendations

${generateRecommendations(errors, networkErrors, consoleErrors)}

---

*Audit completed at ${timestamp}*
`;
}

function generateRecommendations(errors, networkErrors, consoleErrors) {
  const recommendations = [];

  if (errors.length === 0 && networkErrors.length === 0 && consoleErrors.length === 0) {
    recommendations.push('✅ **All systems nominal!** No issues detected.');
    recommendations.push('- Continue monitoring with automated E2E tests');
    recommendations.push('- Implement test coverage for critical user flows');
  } else {
    if (errors.some((e) => e.errorType === 'Route Not Found')) {
      recommendations.push('⚠️ **Fix broken routes** - Some pages are returning 404');
    }
    if (networkErrors.length > 0) {
      recommendations.push(
        '⚠️ **Investigate network failures** - Add error handling for failed requests'
      );
    }
    if (consoleErrors.length > 0) {
      recommendations.push(
        '⚠️ **Fix console errors** - Add error boundaries and logging'
      );
    }
  }

  recommendations.push('- Set up automated E2E tests for continuous validation');
  recommendations.push('- Monitor error tracking in production (Sentry, etc.)');

  return recommendations.map((r) => `- ${r}`).join('\n');
}

runAudit().catch(console.error);
