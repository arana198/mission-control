const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const REPORT_DIR = path.join(__dirname, 'reports');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const REPORT_FILE = path.join(REPORT_DIR, `mission-control-ui-audit-${TIMESTAMP}.md`);

// Ensure reports directory exists
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

const ROUTES = [
  { path: '/', name: 'Home' },
  { path: '/global/overview', name: 'Global Overview' },
  { path: '/global/agents', name: 'Global Agents' },
  { path: '/global/workload', name: 'Global Workload' },
  { path: '/global/activity', name: 'Global Activity' },
  { path: '/global/analytics', name: 'Global Analytics' },
  { path: '/global/bottlenecks', name: 'Global Bottlenecks' },
  { path: '/global/brain', name: 'Global Brain' },
  { path: '/global/calendar', name: 'Global Calendar' },
  { path: '/global/settings', name: 'Global Settings' },
  { path: '/herline-services/overview', name: 'Business Overview' },
  { path: '/herline-services/board', name: 'Business Board' },
  { path: '/herline-services/epics', name: 'Business Epics' },
  { path: '/herline-services/wiki', name: 'Business Wiki' },
  { path: '/agent/keys', name: 'Agent Keys' },
];

const results = {
  summary: { pages: 0, errors: 0, critical: 0, interactions: 0 },
  errors: [],
  navigation: []
};

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      results.errors.push({ page: page.url(), type: 'Console', msg: msg.text().substring(0, 100) });
      results.summary.errors++;
    }
  });
  
  page.on('pageerror', err => {
    results.errors.push({ page: page.url(), type: 'Crash', msg: err.message.substring(0, 100) });
    results.summary.errors++;
    results.summary.critical++;
  });

  for (const route of ROUTES) {
    const url = BASE_URL + route.path;
    console.log(`Testing: ${route.name}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1000);
      
      // Basic interactions
      const buttons = await page.$$('button');
      const links = await page.$$('a');
      const inputs = await page.$$('input');
      
      results.summary.interactions += buttons.length + links.length + inputs.length;
      results.navigation.push({ ...route, status: '✅', code: 200 });
      results.summary.pages++;
    } catch (e) {
      results.navigation.push({ ...route, status: '❌', code: e.message });
      results.summary.errors++;
    }
  }
  
  await browser.close();
  
  // Generate report
  let report = `# Mission Control UI Audit - ${TIMESTAMP}\n\n`;
  report += `## Summary\n`;
  report += `- Pages: ${results.summary.pages}/${ROUTES.length}\n`;
  report += `- Errors: ${results.summary.errors}\n`;
  report += `- Interactions: ${results.summary.interactions}\n\n`;
  
  report += `## Navigation\n| Path | Status | Code |\n|------|--------|------|\n`;
  for (const n of results.navigation) {
    report += `| ${n.path} | ${n.status} | ${n.code} |\n`;
  }
  
  if (results.errors.length > 0) {
    report += `\n## Errors\n`;
    for (const e of results.errors) {
      report += `- ${e.type} on ${e.page}: ${e.msg}\n`;
    }
  }
  
  fs.writeFileSync(REPORT_FILE, report);
  console.log(`\n✅ Report: ${REPORT_FILE}`);
  console.log(`Pages: ${results.summary.pages}, Errors: ${results.summary.errors}, Interactions: ${results.summary.interactions}`);
}

run().catch(console.error);
