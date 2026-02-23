/**
 * Mission Control UI Audit Script
 * Comprehensive end-to-end navigation and validation
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const BASE_URL = 'http://localhost:3000';
const REPORT_DIR = path.join(__dirname, 'reports');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const REPORT_FILE = path.join(REPORT_DIR, `mission-control-ui-audit-${TIMESTAMP}.md`);

// Ensure reports directory exists
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

// Routes to test
const ROUTES = [
  { path: '/', name: 'Home/Landing' },
  { path: '/global/overview', name: 'Global Overview' },
  { path: '/global/agents', name: 'Global Agents' },
  { path: '/global/workload', name: 'Global Workload' },
  { path: '/global/activity', name: 'Global Activity' },
  { path: '/global/analytics', name: 'Global Analytics' },
  { path: '/global/bottlenecks', name: 'Global Bottlenecks' },
  { path: '/global/brain', name: 'Global Brain' },
  { path: '/global/calendar', name: 'Global Calendar' },
  { path: '/global/settings', name: 'Global Settings' },
  { path: '/global/api-docs', name: 'Global API Docs' },
  { path: '/herline-services/overview', name: 'Business Overview' },
  { path: '/herline-services/board', name: 'Business Board' },
  { path: '/herline-services/epics', name: 'Business Epics' },
  { path: '/herline-services/wiki', name: 'Business Wiki' },
  { path: '/herline-services/settings', name: 'Business Settings' },
  { path: '/agent/keys', name: 'Agent Keys' },
  { path: '/api-docs', name: 'API Docs' },
];

// Results storage
const results = {
  summary: {
    totalPages: 0,
    totalInteractions: 0,
    totalErrors: 0,
    failedNetworkCalls: 0,
    criticalErrors: 0,
    nonCriticalErrors: 0,
  },
  errors: [],
  navigation: [],
  observations: [],
};

let browser;
let page;
let screenshotCounter = 0;

async function takeScreenshot(name) {
  screenshotCounter++;
  const screenshotName = `screenshot-${screenshotCounter}-${name.replace(/[^a-z0-9]/gi, '-')}.png`;
  const screenshotPath = path.join(REPORT_DIR, screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

async function setupBrowser() {
  console.log('Launching browser...');
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  
  // Collect console messages
  page.on('console', async msg => {
    if (msg.type() === 'error') {
      results.errors.push({
        page: page.url(),
        element: 'Console Error',
        errorType: 'Console Error',
        message: msg.text(),
        httpStatus: 'N/A',
        stackTrace: msg.location().url || 'N/A',
        screenshot: await takeScreenshot('console-error')
      });
      results.summary.totalErrors++;
      results.summary.criticalErrors++;
    }
  });

  // Collect failed network requests
  page.on('response', response => {
    const status = response.status();
    if (status >= 400) {
      results.errors.push({
        page: page.url(),
        element: 'Network Request',
        errorType: `HTTP ${status}`,
        message: `${response.request().url()} - ${status} ${response.statusText()}`,
        httpStatus: status,
        stackTrace: 'N/A',
        screenshot: null
      });
      results.summary.failedNetworkCalls++;
      results.summary.totalErrors++;
      if (status >= 500) results.summary.criticalErrors++;
    }
  });

  // Detect page crashes
  page.on('pageerror', async error => {
    results.errors.push({
      page: page.url(),
      element: 'Page Crash',
      errorType: 'Uncaught Exception',
      message: error.message,
      httpStatus: 'N/A',
      stackTrace: error.stack || 'N/A',
      screenshot: await takeScreenshot('page-crash')
    });
    results.summary.totalErrors++;
    results.summary.criticalErrors++;
  });
}

async function testRoute(route) {
  const url = `${BASE_URL}${route.path}`;
  console.log(`Testing: ${route.name} (${url})`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for hydration
    await page.waitForTimeout(2000);
    
    // Check if page is blank or has critical content
    const content = await page.content();
    const bodyText = await page.evaluate(() => document.body.innerText);
    
    let status = 'success';
    let notes = [];
    
    if (!content || content.length < 100) {
      status = 'error';
      notes.push('Blank or minimal page content');
    }
    
    if (bodyText && bodyText.length < 10) {
      notes.push('Minimal text content');
    }
    
    // Check for Next.js error pages
    if (content.includes('Application error') || content.includes('Not Found')) {
      status = 'error';
      results.summary.criticalErrors++;
    }
    
    // Discover and interact with elements
    const interactions = await discoverAndInteract();
    results.summary.totalInteractions += interactions;
    
    results.navigation.push({
      path: route.path,
      name: route.name,
      status,
      notes: notes.join(', ')
    });
    
    results.summary.totalPages++;
    
  } catch (error) {
    console.error(`Error testing ${route.name}:`, error.message);
    results.navigation.push({
      path: route.path,
      name: route.name,
      status: 'failed',
      notes: error.message
    });
    results.errors.push({
      page: url,
      element: 'Page Load',
      errorType: 'Navigation Error',
      message: error.message,
      httpStatus: 'N/A',
      stackTrace: error.stack,
      screenshot: await takeScreenshot(`error-${route.name}`)
    });
    results.summary.totalErrors++;
    results.summary.criticalErrors++;
  }
}

async function discoverAndInteract() {
  let interactionCount = 0;
  
  try {
    // Click all links
    const links = await page.$$('a');
    for (const link of links.slice(0, 20)) { // Limit to first 20
      try {
        await link.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(500);
        interactionCount++;
      } catch (e) {}
    }
    
    // Click all buttons
    const buttons = await page.$$('button');
    for (const button of buttons.slice(0, 15)) {
      try {
        await button.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(500);
        interactionCount++;
      } catch (e) {}
    }
    
    // Test form inputs
    const inputs = await page.$$('input');
    for (const input of inputs.slice(0, 10)) {
      try {
        await input.fill('test').catch(() => {});
        interactionCount++;
      } catch (e) {}
    }
    
    // Test dropdowns
    const selects = await page.$$('select');
    for (const select of selects.slice(0, 5)) {
      try {
        await select.selectOption({ index: 0 }).catch(() => {});
        interactionCount++;
      } catch (e) {}
    }
    
    // Test checkboxes
    const checkboxes = await page.$$('input[type="checkbox"]');
    for (const checkbox of checkboxes.slice(0, 5)) {
      try {
        await checkbox.check().catch(() => {});
        interactionCount++;
      } catch (e) {}
    }
    
  } catch (e) {
    console.log('Interaction error:', e.message);
  }
  
  return interactionCount;
}

async function generateReport() {
  let report = `# Mission Control UI Audit Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Base URL:** ${BASE_URL}\n\n`;
  
  // Summary
  report += `## Summary\n\n`;
  report += `| Metric | Count |\n`;
  report += `|--------|-------|\n`;
  report += `| Total Pages Visited | ${results.summary.totalPages} |\n`;
  report += `| Total Interactions | ${results.summary.totalInteractions} |\n`;
  report += `| Total Errors | ${results.summary.totalErrors} |\n`;
  report += `| Failed Network Calls | ${results.summary.failedNetworkCalls} |\n`;
  report += `| Critical Errors | ${results.summary.criticalErrors} |\n`;
  report += `| Non-Critical Errors | ${results.summary.nonCriticalErrors} |\n\n`;
  
  // Error Report
  report += `## Error Report\n\n`;
  report += `| Page URL | Element/Action | Error Type | Error Message | HTTP Status | Screenshot |\n`;
  report += `|----------|----------------|------------|---------------|-------------|------------|\n`;
  
  for (const error of results.errors) {
    const screenshot = error.screenshot ? path.basename(error.screenshot) : 'N/A';
    const message = error.message.substring(0, 50).replace(/\|/g, '-');
    report += `| ${error.page.substring(0, 40)} | ${error.element.substring(0, 15)} | ${error.errorType} | ${message}... | ${error.httpStatus} | ${screenshot} |\n`;
  }
  
  if (results.errors.length === 0) {
    report += `*No errors detected*\n\n`;
  }
  
  // Navigation Coverage
  report += `## Navigation Coverage Map\n\n`;
  report += `| Path | Name | Status | Notes |\n`;
  report += `|------|------|--------|-------|\n`;
  
  for (const nav of results.navigation) {
    const statusIcon = nav.status === 'success' ? '✅' : nav.status === 'warning' ? '⚠️' : '❌';
    report += `| ${nav.path} | ${nav.name} | ${statusIcon} ${nav.status} | ${nav.notes || '-'} |\n`;
  }
  
  // Observations
  report += `\n## Observations\n\n`;
  
  const criticalCount = results.errors.filter(e => e.errorType.includes('500') || e.errorType === 'Page Crash').length;
  const networkFailures = results.summary.failedNetworkCalls;
  
  if (criticalCount > 0) {
    results.observations.push(`- ${criticalCount} critical errors detected (page crashes or server errors)`);
  }
  if (networkFailures > 0) {
    results.observations.push(`- ${networkFailures} network requests failed (4xx/5xx errors)`);
  }
  if (results.summary.totalPages < ROUTES.length) {
    results.observations.push(`- Only ${results.summary.totalPages} of ${ROUTES.length} routes were successfully tested`);
  }
  
  for (const obs of results.observations) {
    report += `${obs}\n`;
  }
  
  if (results.observations.length === 0) {
    report += `- No significant issues observed during testing\n`;
  }
  
  // Recommendations
  report += `\n## Recommendations\n\n`;
  
  if (results.summary.criticalErrors > 0) {
    report += `### Critical Fixes\n`;
    report += `- Investigate and fix critical page errors\n`;
    report += `- Add error boundaries to prevent page crashes\n\n`;
  }
  
  report += `### Stability Improvements\n`;
  report += `- Add loading states for async operations\n`;
  report += `- Implement retry logic for failed network requests\n`;
  report += `- Add graceful error handling for API failures\n\n`;
  
  report += `### Test Coverage\n`;
  report += `- Add integration tests for critical user flows\n`;
  report += `- Add E2E tests for navigation between pages\n`;
  report += `- Add visual regression tests for key pages\n`;
  
  // Write report
  fs.writeFileSync(REPORT_FILE, report);
  console.log(`\n✅ Report saved to: ${REPORT_FILE}`);
  
  return report;
}

async function main() {
  try {
    await setupBrowser();
    
    console.log(`Testing ${ROUTES.length} routes...\n`);
    
    for (const route of ROUTES) {
      await testRoute(route);
    }
    
    await generateReport();
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();
