#!/usr/bin/env node
/**
 * Manual trigger for Auto-Claim system
 * Run this to immediately check for tasks and notify agents
 * 
 * Usage: node scripts/trigger-auto-claim.js
 */

const { ConvexClient } = require("convex/browser");

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ Missing CONVEX_URL. Set in .env.local");
  process.exit(1);
}

const client = new ConvexClient(CONVEX_URL);

async function triggerAutoClaim() {
  console.log("🤖 Triggering Auto-Claim system...\n");
  
  try {
    const result = await client.action("tasks:autoClaim", {});
    
    console.log(`✅ Auto-claim complete!`);
    console.log(`   Agents notified: ${result.notified}`);
    console.log(`   Tasks processed: ${result.tasks.length}`);
    
    if (result.tasks.length > 0) {
      console.log("\n📋 Details:");
      result.tasks.forEach((t, i) => {
        console.log(`   ${i + 1}. ${t.taskTitle} → ${t.agentName} (${t.status})`);
      });
    } else {
      console.log("\n💤 No ready tasks with assignees found.");
    }
    
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Auto-claim failed:", err.message);
    console.log("\n💡 Make sure:");
    console.log("   1. npx convex dev is running");
    console.log("   2. NEXT_PUBLIC_CONVEX_URL is set");
    process.exit(1);
  }
}

triggerAutoClaim();
