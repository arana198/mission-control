#!/usr/bin/env node
/**
 * Mission Control Notification Daemon
 * 
 * Polls Convex for undelivered notifications every 2 seconds
 * and pushes them to agent sessions via OpenClaw sessions_send
 * 
 * Run: node scripts/notification-daemon.js
 * Or: pm2 start scripts/notification-daemon.js --name "mc-notify"
 */

// Load environment
const MISSION_CONTROL_DIR = "/Users/arana/dev/arana198/mission-control";
const WORKSPACE_DIR = "/Users/arana/.openclaw/workspace";

// Agent session key mapping (matches Bhanu's spec)
const AGENT_SESSIONS = {
  "jarvis": "agent:main:main",
  "shuri": "agent:product-analyst:main",
  "fury": "agent:customer-researcher:main",
  "vision": "agent:seo-analyst:main",
  "loki": "agent:content-writer:main",
  "quill": "agent:social-media-manager:main",
  "wanda": "agent:designer:main",
  "pepper": "agent:email-marketing:main",
  "friday": "agent:developer:main",
  "wong": "agent:notion-agent:main",
};

// Agent ID lookup (populated on startup)
let agentIdMap = {};

async function queryConvex(query, args = {}) {
  const { execSync } = require('child_process');
  try {
    const result = execSync(
      `cd ${MISSION_CONTROL_DIR} && npx convex run ${query} '${JSON.stringify(args)}' 2>/dev/null`,
      { encoding: 'utf-8', timeout: 10000 }
    );
    return JSON.parse(result);
  } catch (e) {
    return null;
  }
}

async function mutationConvex(mutation, args = {}) {
  const { execSync } = require('child_process');
  try {
    const result = execSync(
      `cd ${MISSION_CONTROL_DIR} && npx convex run ${mutation} '${JSON.stringify(args)}' 2>/dev/null`,
      { encoding: 'utf-8', timeout: 10000 }
    );
    return JSON.parse(result);
  } catch (e) {
    return null;
  }
}

async function sendToAgent(sessionKey, message) {
  const { execSync } = require('child_process');
  try {
    execSync(
      `cd ${WORKSPACE_DIR} && openclaw sessions_send --session-key "${sessionKey}" --message '${JSON.stringify(message)}'`,
      { encoding: 'utf-8', timeout: 10000 }
    );
    return true;
  } catch (e) {
    return false;
  }
}

async function getAgentIdByName(name) {
  if (agentIdMap[name]) return agentIdMap[name];
  
  const agents = await queryConvex("agents:getAll");
  if (agents) {
    for (const agent of agents) {
      agentIdMap[agent.name.toLowerCase()] = agent._id;
    }
  }
  return agentIdMap[name];
}

async function pollAndDeliver() {
  // Get all undelivered notifications
  const notifications = await queryConvex("notifications:getUndelivered");
  
  if (!notifications || notifications.length === 0) {
    return { delivered: 0, failed: 0 };
  }

  console.log(`[${new Date().toISOString()}] Processing ${notifications.length} notifications...`);

  let delivered = 0;
  let failed = 0;

  for (const notif of notifications) {
    // Get agent name from ID
    const agents = await queryConvex("agents:getAll");
    const agent = agents?.find(a => a._id === notif.recipientId);
    
    if (!agent) {
      console.log(`  ⚠️ Agent not found for notification ${notif._id}`);
      failed++;
      continue;
    }

    const sessionKey = AGENT_SESSIONS[agent.name.toLowerCase()];
    if (!sessionKey) {
      console.log(`  ⚠️ No session key for agent ${agent.name}`);
      failed++;
      continue;
    }

    // Format message
    const message = formatNotification(notif, agent.name);
    
    // Send to agent session
    const success = await sendToAgent(sessionKey, message);
    
    if (success) {
      // Mark as delivered (read)
      await mutationConvex("notifications:markRead", { id: notif._id });
      console.log(`  ✓ Delivered to ${agent.name}: ${notif.type}`);
      delivered++;
    } else {
      console.log(`  ✗ Failed to deliver to ${agent.name} (agent may be asleep)`);
      failed++;
      // Notification stays queued (not marked read)
    }
  }

  return { delivered, failed };
}

function formatNotification(notif, agentName) {
  const emoji = {
    mention: "👋",
    assignment: "📋",
    status_change: "🔄",
    block: "🚫",
    dependency_unblocked: "✅"
  }[notif.type] || "🔔";

  let text = `${emoji} **${notif.type.toUpperCase()}** from ${notif.fromName}\n\n`;
  text += `${notif.content}\n\n`;
  
  if (notif.taskTitle) {
    text += `**Task:** ${notif.taskTitle}\n`;
  }
  
  text += `\n_Reply with CLAIM to accept task or ACK to dismiss._`;
  
  return text;
}

// Main daemon loop
async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  Mission Control Notification Daemon");
  console.log("═══════════════════════════════════════");
  console.log("Poll interval: 2 seconds");
  console.log("Agents: 10 configured");
  console.log("");

  // Initialize agent map
  await getAgentIdByName("jarvis");
  
  // Main loop
  while (true) {
    try {
      const result = await pollAndDeliver();
      if (result.delivered > 0 || result.failed > 0) {
        console.log(`[${new Date().toISOString()}] Delivered: ${result.delivered}, Failed: ${result.failed}`);
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error:`, err.message);
    }
    
    // Sleep 2 seconds (Bhanu's spec)
    await new Promise(r => setTimeout(r, 2000));
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log("\n\nShutting down notification daemon...");
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log("\n\nShutting down notification daemon...");
  process.exit(0);
});

// Start
main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
