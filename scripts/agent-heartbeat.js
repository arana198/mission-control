#!/usr/bin/env node
/**
 * Agent Heartbeat Script
 * 
 * Called by cron to wake individual agents
 * Usage: node scripts/agent-heartbeat.js <agent-name>
 * 
 * Example cron:
 * 0,15,30,45 * * * * node scripts/agent-heartbeat.js jarvis
 */

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

const WORKSPACE_DIR = "/Users/arana/.openclaw/workspace";

async function main() {
  const agentName = process.argv[2];
  
  if (!agentName) {
    console.error("Usage: node agent-heartbeat.js <agent-name>");
    process.exit(1);
  }
  
  const sessionKey = AGENT_SESSIONS[agentName.toLowerCase()];
  if (!sessionKey) {
    console.error(`Unknown agent: ${agentName}`);
    process.exit(1);
  }
  
  console.log(`[${new Date().toISOString()}] Sending heartbeat to ${agentName} (${sessionKey})`);
  
  const { execSync } = require('child_process');
  
  try {
    // Send heartbeat message to agent
    const message = `HEARTBEAT_CHECK — ${new Date().toLocaleTimeString()}\n\nCheck Mission Control:\n\`\`\`typescript\nimport { wakeAndCheck } from "./lib/mission-control";\nconst result = await wakeAndCheck();\nconsole.log(result);\n\`\`\`\n\nReply: HEARTBEAT_OK or task status.`;
    
    execSync(
      `cd ${WORKSPACE_DIR} && openclaw sessions_send --session-key "${sessionKey}" --message '${JSON.stringify(message)}'`,
      { encoding: 'utf-8', timeout: 30000 }
    );
    
    console.log(`✅ Heartbeat delivered to ${agentName}`);
  } catch (e) {
    console.error(`❌ Failed to send heartbeat to ${agentName}:`, e.message);
    process.exit(1);
  }
}

main();
