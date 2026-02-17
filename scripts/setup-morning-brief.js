#!/usr/bin/env node

/**
 * Setup Morning Brief Automation
 * 
 * This script sets up the automated morning brief using OpenClaw's cron system
 */

const { execSync } = require('child_process');
const path = require('path');

const MORNING_BRIEF_TIME = "0 7 * * *"; // 7:00 AM every day
const SCRIPT_PATH = path.join(__dirname, 'morning-brief.js');

async function setupMorningBrief() {
  console.log("🌅 Setting up Morning Brief automation...");
  
  try {
    // Use OpenClaw's cron system to schedule the morning brief
    const cronCommand = `
      openclaw cron add --name "Morning Brief" \\
        --schedule "${MORNING_BRIEF_TIME}" \\
        --command "node ${SCRIPT_PATH}" \\
        --description "Daily automated report with news, tasks, and recommendations"
    `;
    
    console.log("📅 Creating cron job...");
    console.log("Command:", cronCommand.trim());
    
    // For now, just log the command - in production you'd execute it
    console.log("ℹ️ Cron job command prepared. Run manually:");
    console.log(cronCommand.trim());
    
    // Also create a PM2 ecosystem config for the morning brief
    const pm2Config = {
      apps: [
        {
          name: "morning-brief",
          script: SCRIPT_PATH,
          cron_restart: "0 7 * * *",  // 7 AM daily
          watch: false,
          instances: 1,
          autorestart: false,
          env: {
            NODE_ENV: "production"
          }
        }
      ]
    };
    
    console.log("📋 PM2 config for morning brief:");
    console.log(JSON.stringify(pm2Config, null, 2));
    
    // Test the morning brief script
    console.log("🧪 Testing morning brief script...");
    try {
      execSync(`node ${SCRIPT_PATH}`, { stdio: 'inherit' });
      console.log("✅ Morning brief test completed successfully");
    } catch (error) {
      console.error("❌ Morning brief test failed:", error.message);
    }
    
    console.log("\n✅ Morning Brief setup complete!");
    console.log("\n📋 Next steps:");
    console.log("1. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in environment");
    console.log("2. Set NEWS_API_KEY for live news (optional)");
    console.log("3. Run the cron command above to schedule daily briefs");
    console.log("4. Test with: node scripts/morning-brief.js");
    
  } catch (error) {
    console.error("❌ Error setting up morning brief:", error);
    process.exit(1);
  }
}

// Run setup
if (require.main === module) {
  setupMorningBrief();
}

module.exports = { setupMorningBrief };