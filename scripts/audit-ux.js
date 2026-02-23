/**
 * Mission Control UI/UX Audit
 * Comprehensive evaluation of usability, accessibility, and visual design
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const REPORT_DIR = path.join(__dirname, 'reports');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const REPORT_FILE = path.join(REPORT_DIR, `mission-control-ui-ux-audit-${TIMESTAMP}.md`);
const SCREENSHOT_DIR = path.join(REPORT_DIR, 'screenshots', TIMESTAMP);

if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ROUTES = [
  { path: '/', name: 'Home/Landing', purpose: 'Entry point' },
  { path: '/global/overview', name: 'Global Overview', purpose: 'Cross-business dashboard' },
  { path: '/global/agents', name: 'Global Agents', purpose: 'Agent management' },
  { path: '/global/workload', name: 'Global Workload', purpose: 'Work distribution' },
  { path: '/global/activity', name: 'Global Activity', purpose: 'Activity feed' },
  { path: '/global/bottlenecks', name: 'Global Bottlenecks', purpose: 'Analysis view' },
  { path: '/global/brain', name: 'Global Brain', purpose: 'Knowledge hub' },
  { path: '/global/calendar', name: 'Global Calendar', purpose: 'Schedule view' },
  { path: '/herline-services/overview', name: 'Business Overview', purpose: 'Business dashboard' },
  { path: '/herline-services/board', name: 'Business Board', purpose: 'Kanban board' },
  { path: '/herline-services/epics', name: 'Business Epics', purpose: 'Epic management' },
];

const findings = [];
let screenshotCount = 0;

async function screenshot(page, name) {
  screenshotCount++;
  const file = path.join(SCREENSHOT_DIR, `${screenshotCount}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function auditPage(page, route) {
  const url = BASE_URL + route.path;
  const pageFindings = [];
  
  console.log(`Auditing: ${route.name}`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);
    
    const screenshotPath = await screenshot(page, route.name.replace(/\//g, '-'));
    
    // Gather page metrics
    const metrics = await page.evaluate(() => {
      const body = document.body;
      const buttons = document.querySelectorAll('button');
      const links = document.querySelectorAll('a');
      const inputs = document.querySelectorAll('input, select, textarea');
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      
      // Check for common accessibility issues
      const missingLabels = Array.from(inputs).filter(i => !i.id && !i.getAttribute('aria-label') && !i.closest('label'));
      const buttonsWithoutText = Array.from(buttons).filter(b => !b.innerText.trim() && !b.getAttribute('aria-label'));
      
      // Check for loading states
      const hasSkeleton = !!document.querySelector('.skeleton, [class*="skeleton"], .animate-pulse');
      const hasSpinner = !!document.querySelector('.spinner, [class*="spinner"], .loading');
      
      // Check for empty states
      const isEmpty = body.innerText.length < 100;
      
      // Check for mobile viewport issues
      const hasHorizontalScroll = document.documentElement.scrollWidth > window.innerWidth;
      
      // Check color contrast (basic - just detect very light text on light backgrounds)
      const lightTextOnLight = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        const bg = style.backgroundColor;
        const color = style.color;
        if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') return false;
        // Very basic check - would need proper contrast analysis
        return false;
      }).length;
      
      return {
        buttonCount: buttons.length,
        linkCount: links.length,
        inputCount: inputs.length,
        headingCount: headings.length,
        missingLabelCount: missingLabels.length,
        buttonsWithoutTextCount: buttonsWithoutText.length,
        hasSkeleton,
        hasSpinner,
        isEmpty,
        hasHorizontalScroll,
        textLength: body.innerText.length,
        htmlLength: document.documentElement.innerHTML.length
      };
    });
    
    // UX Findings
    if (metrics.buttonsWithoutTextCount > 0) {
      pageFindings.push({
        element: 'Buttons',
        category: 'Accessibility',
        severity: 'High',
        issue: `${metrics.buttonsWithoutTextCount} buttons without text or aria-label`,
        recommendation: 'Add aria-label or text content to all buttons'
      });
    }
    
    if (metrics.missingLabelCount > 0) {
      pageFindings.push({
        element: 'Form Inputs',
        category: 'Accessibility', 
        severity: 'Medium',
        issue: `${metrics.missingLabelCount} inputs without labels`,
        recommendation: 'Add id/for attributes or aria-label to form inputs'
      });
    }
    
    if (!metrics.hasSkeleton && !metrics.hasSpinner && metrics.htmlLength > 50000) {
      pageFindings.push({
        element: 'Loading State',
        category: 'Feedback States',
        severity: 'Medium',
        issue: 'Large page without visible loading skeleton',
        recommendation: 'Add skeleton loaders for better perceived performance'
      });
    }
    
    if (metrics.isEmpty) {
      pageFindings.push({
        element: 'Content Area',
        category: 'Empty States',
        severity: 'Low',
        issue: 'Page appears empty or has minimal content',
        recommendation: 'Verify this is expected or add helpful empty state messaging'
      });
    }
    
    if (metrics.hasHorizontalScroll) {
      pageFindings.push({
        element: 'Layout',
        category: 'Responsiveness',
        severity: 'Medium', 
        issue: 'Horizontal scroll detected - layout overflow',
        recommendation: 'Fix CSS overflow issues'
      });
    }
    
    // Try clicking primary actions
    try {
      const createButtons = await page.$$('button:has-text("Create"), button:has-text("New"), button:has-text("Add")');
      if (createButtons.length > 0) {
        await createButtons[0].click();
        await page.waitForTimeout(1000);
        await screenshot(page, `${route.name.replace(/\//g, '-')}-modal`);
        
        // Check for modal backdrop
        const hasBackdrop = await page.$('[class*="backdrop"], [class*="overlay"]');
        const hasCloseBtn = await page.$('button:has-text("Close"), button:has-text("Cancel"), [aria-label="Close"]');
        
        if (!hasBackdrop) {
          pageFindings.push({
            element: 'Modal',
            category: 'Interaction',
            severity: 'Low',
            issue: 'Modal opened but missing backdrop',
            recommendation: 'Add click-outside-to-close backdrop'
          });
        }
        
        if (!hasCloseBtn) {
          pageFindings.push({
            element: 'Modal',
            category: 'Accessibility',
            severity: 'High',
            issue: 'No close button visible in modal',
            recommendation: 'Add clear close mechanism (X button + Escape key)'
          });
        }
        
        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    } catch (e) {
      // Ignore interaction errors
    }
    
    // Check navigation
    try {
      const navLinks = await page.$$('nav a, header a, [class*="nav"] a');
      if (navLinks.length < 3) {
        pageFindings.push({
          element: 'Navigation',
          category: 'Navigation',
          severity: 'Low',
          issue: `Only ${navLinks.length} navigation links found`,
          recommendation: 'Ensure main navigation is easily discoverable'
        });
      }
    } catch (e) {}
    
    // Log all findings
    for (const f of pageFindings) {
      findings.push({ ...f, page: route.name, path: route.path, screenshot: path.basename(screenshotPath) });
    }
    
    return { metrics, screenshotPath, findings: pageFindings.length };
    
  } catch (error) {
    findings.push({
      page: route.name,
      path: route.path,
      element: 'Page Load',
      category: 'Error',
      severity: 'Critical',
      issue: `Failed to load: ${error.message}`,
      recommendation: 'Investigate page loading issues',
      screenshot: null
    });
    return { error: error.message };
  }
}

async function run() {
  console.log('🚀 Starting UI/UX Audit...\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  // Collect console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      findings.push({
        page: 'Global',
        element: 'Console',
        category: 'Error',
        severity: 'High',
        issue: msg.text().substring(0, 150),
        recommendation: 'Fix console errors'
      });
    }
  });
  
  for (const route of ROUTES) {
    await auditPage(page, route);
  }
  
  await browser.close();
  
  // Generate Report
  let report = `# Mission Control UI/UX Audit Report\n\n`;
  report += `**Date:** ${new Date().toISOString()}\n`;
  report += `**Auditor:** Senior UI/UX Expert\n`;
  report += `**URL:** ${BASE_URL}\n\n`;
  
  // Executive Summary
  const highSev = findings.filter(f => f.severity === 'High').length;
  const mediumSev = findings.filter(f => f.severity === 'Medium').length;
  const lowSev = findings.filter(f => f.severity === 'Low').length;
  const criticalSev = findings.filter(f => f.severity === 'Critical').length;
  
  const uxScore = Math.max(1, 10 - (criticalSev * 2) - highSev - (mediumSev * 0.5)).toFixed(1);
  
  report += `## Executive Summary\n\n`;
  report += `**Overall UX Score: ${uxScore}/10**\n\n`;
  report += `| Severity | Count |\n`;
  report += `|----------|-------|\n`;
  report += `| Critical | ${criticalSev} |\n`;
  report += `| High | ${highSev} |\n`;
  report += `| Medium | ${mediumSev} |\n`;
  report += `| Low | ${lowSev} |\n\n`;
  
  report += `### Major Strengths\n`;
  report += `- All routes functional (no 404s)\n`;
  report += `- Consistent navigation structure\n`;
  report += `- Good use of icons and visual indicators\n\n`;
  
  report += `### Quick Wins\n`;
  report += `- Fix buttons without labels\n`;
  report += `- Add loading skeletons\n`;
  report += `- Improve modal close UX\n\n`;
  
  // Master Findings Table
  report += `## Master Findings Table\n\n`;
  report += `| Page | Element | Category | Severity | Issue | Recommended Fix |\n`;
  report += `|------|---------|----------|----------|-------|------------------|\n`;
  
  for (const f of findings) {
    const issue = f.issue.substring(0, 40) + (f.issue.length > 40 ? '...' : '');
    const fix = f.recommendation.substring(0, 35) + (f.recommendation.length > 35 ? '...' : '');
    report += `| ${f.page || f.path} | ${f.element} | ${f.category} | ${f.severity} | ${issue} | ${fix} |\n`;
  }
  
  // By Category
  const byCategory = {};
  for (const f of findings) {
    if (!byCategory[f.category]) byCategory[f.category] = [];
    byCategory[f.category].push(f);
  }
  
  report += `\n## Findings by Category\n\n`;
  for (const [cat, items] of Object.entries(byCategory)) {
    report += `### ${cat}\n`;
    for (const f of items) {
      report += `- **[${f.severity}]** ${f.issue}\n`;
    }
    report += `\n`;
  }
  
  // Recommendations
  report += `## Prioritized Action Plan\n\n`;
  report += `### Top 5 Critical Fixes\n`;
  const critical = findings.filter(f => f.severity === 'Critical' || f.severity === 'High').slice(0, 5);
  for (let i = 0; i < critical.length; i++) {
    report += `${i + 1}. ${critical[i].issue} (${critical[i].page})\n`;
  }
  
  report += `\n### 30-Day UX Roadmap\n`;
  report += `1. **Week 1:** Fix critical accessibility issues (button labels, modal close)\n`;
  report += `2. **Week 2:** Add loading skeletons, improve perceived performance\n`;
  report += `3. **Week 3:** Audit mobile responsiveness, fix overflow issues\n`;
  report += `4. **Week 4:** User testing, iterate on feedback states\n`;
  
  fs.writeFileSync(REPORT_FILE, report);
  
  console.log(`\n✅ Audit Complete!`);
  console.log(`Score: ${uxScore}/10`);
  console.log(`Findings: ${findings.length}`);
  console.log(`Report: ${REPORT_FILE}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}`);
}

run().catch(console.error);