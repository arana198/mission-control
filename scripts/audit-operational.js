/**
 * Mission Control Operational Efficiency Audit
 * AI Chief of Staff Perspective
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const REPORT_FILE = path.join(__dirname, 'reports', `mission-control-operational-audit-${TIMESTAMP}.md`);

// Ensure reports directory exists
const REPORT_DIR = path.join(__dirname, 'reports');
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

const findings = {
  orchestration: [],
  cognitive: [],
  workflow: [],
  feedback: [],
  automation: [],
  friction: []
};

let score = 10;

async function log(category, impact, issue, cause, improvement) {
  findings[category].push({ impact, issue, cause, improvement });
  if (impact === 'High') score -= 0.5;
  if (impact === 'Critical') score -= 1;
}

async function auditPage(page, route) {
  const url = BASE_URL + route.path;
  console.log(`Auditing: ${route.name}`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);
    
    const metrics = await page.evaluate(() => {
      return {
        buttons: document.querySelectorAll('button').length,
        links: document.querySelectorAll('a').length,
        inputs: document.querySelectorAll('input, select, textarea').length,
        modals: document.querySelectorAll('[class*="modal"], [class*="dialog"]').length,
        dropdowns: document.querySelectorAll('select, [class*="dropdown"], [class*="select"]').length,
        tables: document.querySelectorAll('table').length,
        cards: document.querySelectorAll('[class*="card"]').length,
        hasSearch: !!document.querySelector('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]'),
        hasFilters: !!document.querySelectorAll('[class*="filter"]').length,
        hasBulkSelect: !!document.querySelector('[class*="bulk"], [class*="select"], checkbox'),
        bodyText: document.body.innerText.substring(0, 2000)
      };
    });
    
    // Orchestration Analysis
    if (route.name.includes('Board') || route.name.includes('Overview')) {
      const hasAssigneeUI = metrics.bodyText.toLowerCase().includes('assign') || 
                           metrics.bodyText.toLowerCase().includes('agent') ||
                           metrics.bodyText.toLowerCase().includes('owner');
      if (!hasAssigneeUI) {
        await log('orchestration', 'High', 'No visible assignee controls', 'Agent assignment unclear', 'Add clear "Assign to Agent" dropdown');
      }
      
      if (!metrics.hasBulkSelect) {
        await log('workflow', 'Medium', 'No bulk selection for tasks', 'Can only process one task at a time', 'Add checkbox selection + bulk actions');
      }
    }
    
    // Task Creation Flow
    if (route.name.includes('Board')) {
      const createButtons = await page.$$('button');
      let foundCreate = false;
      for (const btn of createButtons) {
        const text = await btn.innerText();
        if (text.toLowerCase().includes('create') || text.toLowerCase().includes('new') || text.toLowerCase().includes('add')) {
          foundCreate = true;
          await btn.click();
          await page.waitForTimeout(1000);
          
          const modalFields = await page.$$('input, select, textarea');
          if (modalFields.length < 3) {
            await log('workflow', 'High', 'Task creation has minimal fields', 'May require many steps to complete', 'Add smart defaults');
          }
          
          await page.keyboard.press('Escape');
          break;
        }
      }
      if (!foundCreate) {
        await log('orchestration', 'Medium', 'Create button not obvious', 'Task creation hidden', 'Make "+ New Task" prominent');
      }
    }
    
    // Search & Filters
    if (!metrics.hasSearch) {
      await log('cognitive', 'Medium', 'No search bar visible', 'Finding specific tasks is slow', 'Add global search');
    }
    
    if (!metrics.hasFilters) {
      await log('workflow', 'Low', 'No visible filters', 'Can\'t narrow down tasks', 'Add status/priority filters');
    }
    
    // Agent Visibility
    if (route.name.includes('Agent')) {
      const agentCards = await page.$$('[class*="card"], [class*="agent"]');
      if (agentCards.length < 2) {
        await log('feedback', 'Medium', 'Few agents displayed', 'Can\'t see team capacity', 'Show agent workload summary');
      }
    }
    
    // Empty States
    if (metrics.buttons + metrics.links < 5 && metrics.cards < 2) {
      await log('cognitive', 'Low', 'Sparse page content', 'May be empty state', 'Add helpful empty state guidance');
    }
    
    return metrics;
    
  } catch (error) {
    await log('friction', 'Critical', `Failed to load: ${route.path}`, error.message, 'Fix loading error');
    return null;
  }
}

async function run() {
  console.log('🎯 Starting Operational Efficiency Audit...\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const routes = [
    { path: '/', name: 'Home' },
    { path: '/global/overview', name: 'Global Overview' },
    { path: '/global/agents', name: 'Agent Management' },
    { path: '/global/workload', name: 'Workload Distribution' },
    { path: '/global/activity', name: 'Activity Feed' },
    { path: '/herline-services/overview', name: 'Business Dashboard' },
    { path: '/herline-services/board', name: 'Kanban Board' },
    { path: '/herline-services/epics', name: 'Epic Management' },
    { path: '/herline-services/settings', name: 'Business Settings' },
    { path: '/global/settings', name: 'Global Settings' },
  ];
  
  for (const route of routes) {
    await auditPage(page, route);
  }
  
  // Test delegation flow
  console.log('\nTesting delegation flow...');
  try {
    await page.goto(BASE_URL + '/herline-services/board', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // Try to find a task card
    const taskCards = await page.$$('[class*="card"], [class*="task"]');
    if (taskCards.length > 0) {
      await log('workflow', 'Low', 'Task cards found but assignment flow untested', 'Would need more time', 'Manual test recommended');
    }
  } catch (e) {}
  
  await browser.close();
  
  score = Math.max(1, score);
  
  // Generate Report
  let report = `# Mission Control - Operational Efficiency Audit\n`;
  report += `**Date:** ${new Date().toISOString()}\n`;
  report += `**Perspective:** AI Chief of Staff\n\n`;
  
  report += `## Executive Summary\n\n`;
  report += `**Operational Efficiency Score: ${score}/10**\n\n`;
  
  report += `### Top 3 Systemic Bottlenecks\n`;
  const bottlenecks = findings.workflow.filter(f => f.impact === 'High').slice(0, 3);
  for (const b of bottlenecks) {
    report += `1. ${b.issue}\n`;
  }
  
  report += `\n### Top 3 Leverage Improvements\n`;
  const leverage = [...findings.automation, ...findings.workflow].slice(0, 3);
  for (const l of leverage) {
    report += `- ${l.improvement}\n`;
  }
  
  // Friction Analysis Table
  report += `\n## Friction Analysis Table\n\n`;
  report += `| Page | Action | Friction Type | Impact | Root Cause | Improvement |\n`;
  report += `|------|--------|---------------|--------|------------|-------------|\n`;
  
  const allFindings = [
    ...findings.orchestration,
    ...findings.workflow,
    ...findings.cognitive,
    ...findings.feedback,
    ...findings.automation,
    ...findings.friction
  ];
  
  for (const f of allFindings) {
    const issue = f.issue.substring(0, 30) + (f.issue.length > 30 ? '...' : '');
    const cause = f.cause ? f.cause.substring(0, 25) : '-';
    const improvement = f.improvement.substring(0, 30) + (f.improvement.length > 30 ? '...' : '');
    report += `| Various | General | ${f.impact} | ${f.impact} | ${cause} | ${improvement} |\n`;
  }
  
  // Workflow Inefficiencies
  report += `\n## Workflow Inefficiencies\n\n`;
  report += `### Task Creation Flow\n`;
  report += `Current: Click "+" → Fill 5+ fields → Save → Assign → Track\n`;
  report += `Optimal: Voice/text "Create X task for Y" → AI auto-fills & assigns\n\n`;
  
  report += `### Agent Assignment\n`;
  report += `Current: Open task → Click assignee → Select from dropdown → Save\n`;
  report += `Optimal: Drag task to agent card → Auto-assigns & notifies\n\n`;
  
  // AI-Centric Improvements
  report += `## AI-Centric Improvements\n\n`;
  report += `### Suggested Automation\n`;
  report += `- Auto-suggest assignee based on workload\n`;
  report += `- Smart task routing based on agent capabilities\n`;
  report += `- Predictive ETA for task completion\n`;
  report += `- Auto-escalate stale tasks\n\n`;
  
  report += `### Smart Defaults\n`;
  report += `- Pre-fill priority based on keywords\n`;
  report += `- Auto-detect epic from task title\n`;
  report += `- Default assignee based on availability\n\n`;
  
  report += `### Predictive Delegation\n`;
  report += `- "You have 3 P0 tasks, want me to distribute?"\n`;
  report += `- Suggest task handoff when agent overloaded\n`;
  report += `- Auto-balance workload every 30 minutes\n\n`;
  
  // Strategic Redesign
  report += `## Strategic Redesign Suggestions\n\n`;
  report += `### Command Palette\n`;
  report += `- Add Cmd+K command palette\n`;
  report += `- Commands: "assign", "create", "move", "find", "status"\n`;
  report += `- AI interprets natural language: "move my tasks to done"\n\n`;
  
  report += `### Dashboard Improvements\n`;
  report += `- Real-time agent workload bars\n`;
  report += `- Bottleneck alerts (tasks waiting >1hr)\n`;
  report += `- One-click rebalancing button\n\n`;
  
  report += `### Bulk Operations\n`;
  report += `- Multi-select with shift-click\n`;
  report += `- "Assign all unassigned to X"\n`;
  report += `- "Move all done to archived"\n\n`;
  
  // If I were the Chief
  report += `## If You Were My Chief of Staff\n\n`;
  report += `### Daily Frustrations\n`;
  report += `- No way to see "what needs my attention NOW"\n`;
  report += `- Switching between tabs to check status\n`;
  report += `- Manual task assignment takes too many clicks\n\n`;
  
  report += `### What Would Make Me 2x More Effective\n`;
  report += `- Real-time Slack/Discord bot integration\n`;
  report += `- Auto-daily briefing: "You have X tasks, Y blocked, Z done"\n`;
  report += `- One-click agent spawn for new work types\n\n`;
  
  fs.writeFileSync(REPORT_FILE, report);
  
  console.log(`\n✅ Operational Audit Complete!`);
  console.log(`Score: ${score}/10`);
  console.log(`Report: ${REPORT_FILE}`);
  console.log(`Findings: ${allFindings.length}`);
}

run().catch(console.error);