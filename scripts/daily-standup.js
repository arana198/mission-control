#!/usr/bin/env node
/**
 * Mission Control Daily Standup
 * 
 * Compiles daily activity summary and sends to Boss
 * Run: node scripts/daily-standup.js
 * Or add to cron: 0 18 * * * (6 PM UTC = 11:30 PM IST)
 */

const MISSION_CONTROL_DIR = "/Users/arana/dev/arana198/mission-control";
const WORKSPACE_DIR = "/Users/arana/.openclaw/workspace";

async function queryConvex(query, args = {}) {
  const { execSync } = require('child_process');
  try {
    const result = execSync(
      `cd ${MISSION_CONTROL_DIR} && npx convex run ${query} '${JSON.stringify(args)}' 2>/dev/null`,
      { encoding: 'utf-8', timeout: 30000 }
    );
    return JSON.parse(result);
  } catch (e) {
    console.error(`Query failed: ${query}`, e.message);
    return null;
  }
}

async function generateStandup() {
  const now = new Date();
  const today = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  
  // Get last 24h of activities
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const activities = await queryConvex("activities:getRecent", { limit: 200 }) || [];
  const recentActivities = activities.filter(a => a.createdAt >= oneDayAgo);
  
  // Get all tasks
  const tasks = await queryConvex("tasks:getAll") || [];
  const agents = await queryConvex("agents:getAll") || [];
  
  // Categorize activities
  const completed = [];
  const inProgress = [];
  const blocked = [];
  const needsReview = [];
  const keyDecisions = [];
  
  for (const activity of recentActivities) {
    if (activity.type === "task_completed") {
      completed.push(activity);
    } else if (activity.type === "task_updated" && activity.newValue === "in_progress") {
      inProgress.push(activity);
    } else if (activity.type === "task_blocked") {
      blocked.push(activity);
    } else if (activity.type === "task_updated" && activity.newValue === "review") {
      needsReview.push(activity);
    }
  }
  
  // Find needs review tasks (status == review)
  const reviewTasks = tasks.filter(t => t.status === "review");
  
  // Find blocked tasks
  const blockedTasks = tasks.filter(t => t.status === "blocked");
  
  // Find in-progress tasks with recent activity
  const activeTaskIds = new Set(
    recentActivities
      .filter(a => a.taskId)
      .map(a => a.taskId)
  );
  
  // Build standup markdown
  let standup = `📊 **DAILY STANDUP** — ${today}\n\n`;
  
  // ✅ COMPLETED
  standup += `✅ **COMPLETED TODAY**\n`;
  if (completed.length === 0) {
    standup += `_No tasks completed today_\n`;
  } else {
    for (const item of completed) {
      standup += `• ${item.agentName}: ${item.taskTitle}\n`;
    }
  }
  standup += `\n`;
  
  // 🔄 IN PROGRESS
  standup += `🔄 **IN PROGRESS**\n`;
  const inProgressTasks = tasks.filter(t => t.status === "in_progress");
  if (inProgressTasks.length === 0) {
    standup += `_No active work_\n`;
  } else {
    for (const task of inProgressTasks) {
      const assigneeNames = task.assigneeIds?.map(id => {
        const agent = agents.find(a => a._id === id);
        return agent ? agent.name : 'Unknown';
      }).join(', ') || 'Unassigned';
      
      standup += `• ${assigneeNames}: ${task.title}\n`;
    }
  }
  standup += `\n`;
  
  // 🚫 BLOCKED
  standup += `🚫 **BLOCKED**\n`;
  if (blockedTasks.length === 0) {
    standup += `_No blockers_\n`;
  } else {
    for (const task of blockedTasks) {
      standup += `• ${task.title}\n`;
    }
  }
  standup += `\n`;
  
  // 👀 NEEDS REVIEW
  standup += `👀 **NEEDS REVIEW**\n`;
  if (reviewTasks.length === 0) {
    standup += `_Nothing waiting for review_\n`;
  } else {
    for (const task of reviewTasks) {
      const assigneeNames = task.assigneeIds?.map(id => {
        const agent = agents.find(a => a._id === id);
        return agent ? agent.name : 'Unknown';
      }).join(', ') || 'Unassigned';
      
      standup += `• ${assigneeNames}: ${task.title}\n`;
    }
  }
  standup += `\n`;
  
  // 📊 STATS
  standup += `📊 **SQUAD STATS**\n`;
  standup += `• Total tasks: ${tasks.length}\n`;
  standup += `• Completed today: ${completed.length}\n`;
  standup += `• In progress: ${inProgressTasks.length}\n`;
  standup += `• Blocked: ${blockedTasks.length}\n`;
  standup += `• Needs review: ${reviewTasks.length}\n`;
  standup += `• Active agents: ${agents.filter(a => a.status === "active").length}/${agents.length}\n\n`;
  
  // Agent activity summary
  standup += `🎯 **AGENT ACTIVITY**\n`;
  for (const agent of agents) {
    const agentActivity = recentActivities.filter(a => a.agentId === agent._id);
    if (agentActivity.length > 0) {
      const completes = agentActivity.filter(a => a.type === "task_completed").length;
      standup += `• ${agent.name}: ${agentActivity.length} updates`;
      if (completes > 0) standup += ` (${completes} completed)`;
      standup += `\n`;
    }
  }
  
  return standup;
}

async function sendToBoss(message) {
  const { execSync } = require('child_process');
  try {
    // Send via OpenClaw messaging to user's main session
    execSync(
      `cd ${WORKSPACE_DIR} && openclaw message send --target "8374049928" --message '${JSON.stringify(message)}'`,
      { encoding: 'utf-8', timeout: 10000 }
    );
    return true;
  } catch (e) {
    // Fallback: write to file
    console.log("Direct message failed, writing to file...");
    const fs = require('fs');
    const standupPath = `${WORKSPACE_DIR}/memory/standup-${new Date().toISOString().split('T')[0]}.md`;
    fs.writeFileSync(standupPath, message);
    return false;
  }
}

async function main() {
  console.log("Generating daily standup...");
  console.log("Querying Mission Control...");
  
  const standup = await generateStandup();
  
  console.log("\n═══════════════════════════════");
  console.log(standup);
  console.log("═══════════════════════════════\n");
  
  // Send to Boss
  const sent = await sendToBoss(standup);
  
  if (sent) {
    console.log("✅ Standup delivered to Boss");
  } else {
    const date = new Date().toISOString().split('T')[0];
    console.log(`✅ Standup saved to memory/standup-${date}.md`);
  }
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
