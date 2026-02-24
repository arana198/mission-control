#!/usr/bin/env node
/**
 * OpenClaw Sync - Agent Registry & Execution Logging
 * Phase 1: Control Plane
 * 
 * Usage: node scripts/sync-openclaw.js [--executions]
 */

const { execSync } = require('child_process');

const CONVEX_DIR = '/Users/arana/dev/ankit/mission-control';

function runConvex(cmd) {
  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      timeout: 30000,
      cwd: CONVEX_DIR,
      env: { ...process.env, PATH: '/Users/arana/.local/n/versions/node/22.22.0/bin:/usr/local/bin:/usr/bin:/bin' }
    });
    const lines = output.split('\n').filter(l => !l.startsWith('Warning:'));
    return JSON.parse(lines.join('\n'));
  } catch (e) {
    try {
      const match = e.message.match(/\[[\s\S]*\]/);
      if (match) return JSON.parse(match[0]);
    } catch {}
    return null;
  }
}

function getOpenClawAgents() {
  try {
    let output = execSync('openclaw agents list --json 2>/dev/null', { encoding: 'utf8', timeout: 30000 });
    const jsonStart = output.indexOf('[');
    const jsonEnd = output.lastIndexOf(']') + 1;
    return JSON.parse(jsonStart >= 0 ? output.substring(jsonStart, jsonEnd) : '[]');
  } catch (e) { return []; }
}

function getOpenClawSessions(agentName) {
  try {
    let output = execSync(`openclaw sessions --agent "${agentName}" --json 2>/dev/null`, { encoding: 'utf8', timeout: 30000 });
    const jsonStart = output.indexOf('[');
    const jsonEnd = output.lastIndexOf(']') + 1;
    return JSON.parse(jsonStart >= 0 ? output.substring(jsonStart, jsonEnd) : '[]');
  } catch (e) { return []; }
}

async function registerAgent(agent) {
  const apiKey = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const cmd = `npx convex run agents:register '{"name":"${agent.name}","role":"agent","level":"specialist","sessionKey":"agent:${agent.id}:main","workspacePath":"${agent.workspace || agent.agentDir || ''}","generatedApiKey":"${apiKey}"}' 2>/dev/null`;
  return runConvex(cmd);
}

async function logExecution(execution) {
  const cmd = `npx convex run executionLog:logExecution '${JSON.stringify(execution)}' 2>/dev/null`;
  return runConvex(cmd);
}

async function main() {
  const doExecutions = process.argv.includes('--executions');
  
  console.log('🔄 Phase 1: Agent Control + Execution Logging\n');
  
  // Get OpenClaw agents
  const openclawAgents = getOpenClawAgents();
  const convexAgents = runConvex('npx convex run agents:getAllAgents 2>/dev/null') || [];
  
  console.log(`📋 OpenClaw: ${openclawAgents.length} agents`);
  console.log(`📊 Convex: ${convexAgents.length} agents\n`);
  
  // 1. Register missing agents
  for (const agent of openclawAgents) {
    const existing = convexAgents.find(a => a.name.toLowerCase() === agent.name.toLowerCase());
    if (!existing) {
      console.log(`  ➕ Registering: ${agent.name}`);
      await registerAgent(agent);
    }
  }
  
  // Refresh and get agent ID mapping
  const allAgents = runConvex('npx convex run agents:getAllAgents 2>/dev/null') || [];
  console.log(`  ✅ ${allAgents.length} agents registered\n`);
  
  // 2. Sync executions (if --executions flag)
  if (doExecutions) {
    console.log('📊 Syncing executions...');
    let totalSynced = 0;
    
    for (const ocAgent of openclawAgents) {
      const cxAgent = allAgents.find(a => a.name.toLowerCase() === ocAgent.name.toLowerCase());
      if (!cxAgent) continue;
      
      const sessions = getOpenClawSessions(ocAgent.name);
      
      for (const session of sessions.slice(0, 20)) {
        let triggerType = 'manual';
        if (session.key?.includes(':cron:')) triggerType = 'cron';
        else if (session.key?.includes(':autonomous:')) triggerType = 'autonomous';
        
        const execution = {
          agentId: cxAgent._id,
          agentName: cxAgent.name,
          taskTitle: session.key,
          triggerType,
          status: session.abortedLastRun ? 'aborted' : 'success',
          startTime: session.updatedAt - (session.ageMs || 0),
          endTime: session.updatedAt,
          inputTokens: session.inputTokens || 0,
          outputTokens: session.outputTokens || 0,
          totalTokens: session.totalTokens || 0,
          model: session.model || '',
          modelProvider: session.modelProvider || ''
        };
        
        await logExecution(execution);
        totalSynced++;
      }
    }
    console.log(`  ✅ Synced ${totalSynced} executions\n`);
  }
  
  // Dashboard Summary
  const summary = runConvex('npx convex run dashboard:getDashboardSummary 2>/dev/null');
  console.log('📈 Dashboard:');
  console.log(`   Agents: ${summary?.totalAgents || 0} | Active: ${summary?.activeAgents || 0}`);
  console.log(`   Today: ${(summary?.todayTokens || 0).toLocaleString()} tokens | ${summary?.successRate || 0}% success`);
  
  console.log('\n✅ Phase 1 Ready!');
}

main().catch(console.error);
