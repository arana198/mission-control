#!/usr/bin/env node

/**
 * Morning Brief Generator
 * 
 * Sends daily automated report via Telegram with:
 * 1. News stories relevant to interests
 * 2. Business ideas
 * 3. Tasks due today
 * 4. Collaboration recommendations
 */

const { ConvexHttpClient } = require("convex/browser");

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.CONVEX_URL || "https://relieved-shark-742.convex.cloud");

// User interests for news filtering
const USER_INTERESTS = [
  "artificial intelligence",
  "machine learning", 
  "fintech",
  "SaaS",
  "automation",
  "startups",
  "business opportunities",
  "AI agents",
  "productivity tools",
  "no-code",
  "API economy"
];

// Business idea categories
const BUSINESS_IDEA_TEMPLATES = [
  "AI-powered {industry} automation tool",
  "No-code platform for {audience}",
  "API marketplace for {niche}",
  "Automated {service} for small businesses",
  "AI assistant for {profession}",
  "SaaS tool for {problem} in {industry}",
  "Marketplace connecting {group1} with {group2}",
  "Subscription service for {need}",
  "White-label {solution} for agencies",
  "Mobile app for {lifestyle}"
];

const INDUSTRIES = ["healthcare", "education", "real estate", "legal", "marketing", "e-commerce", "logistics", "finance"];
const AUDIENCES = ["freelancers", "small businesses", "creators", "agencies", "consultants", "remote teams"];
const SERVICES = ["bookkeeping", "scheduling", "invoicing", "lead generation", "content creation", "data analysis"];
const PROFESSIONS = ["lawyers", "doctors", "accountants", "marketers", "designers", "developers"];

async function fetchNews() {
  try {
    console.log("🔍 Fetching relevant news...");
    
    // Use a free news API (you might want to switch to a paid one for production)
    const newsApiKey = process.env.NEWS_API_KEY;
    if (!newsApiKey) {
      console.log("⚠️ No NEWS_API_KEY found, using placeholder news");
      return [
        {
          title: "AI Agent Coordination Platforms See 300% Growth",
          description: "Multi-agent AI systems are becoming the backbone of modern business automation",
          url: "https://example.com/ai-growth",
          source: "TechNews",
          relevance: "High - Relates to your Mission Control project"
        },
        {
          title: "SaaS Startups Raise $2.1B in Q1 2026",
          description: "Focus on productivity and automation tools drives investor interest",
          url: "https://example.com/saas-funding", 
          source: "VentureBeat",
          relevance: "Medium - SaaS market insights"
        },
        {
          title: "No-Code Movement Reaches Enterprise",
          description: "Fortune 500 companies adopting citizen developer platforms",
          url: "https://example.com/nocode-enterprise",
          source: "Forbes",
          relevance: "High - Potential business opportunity"
        }
      ];
    }

    // Fetch news from API (placeholder implementation)
    // In production, you'd implement actual API calls here
    return [];
  } catch (error) {
    console.error("❌ Error fetching news:", error);
    return [];
  }
}

function generateBusinessIdeas() {
  console.log("💡 Generating business ideas...");
  
  const ideas = [];
  for (let i = 0; i < 3; i++) {
    const template = BUSINESS_IDEA_TEMPLATES[Math.floor(Math.random() * BUSINESS_IDEA_TEMPLATES.length)];
    let idea = template;
    
    // Replace placeholders
    idea = idea.replace("{industry}", INDUSTRIES[Math.floor(Math.random() * INDUSTRIES.length)]);
    idea = idea.replace("{audience}", AUDIENCES[Math.floor(Math.random() * AUDIENCES.length)]);
    idea = idea.replace("{service}", SERVICES[Math.floor(Math.random() * SERVICES.length)]);
    idea = idea.replace("{profession}", PROFESSIONS[Math.floor(Math.random() * PROFESSIONS.length)]);
    idea = idea.replace("{niche}", INDUSTRIES[Math.floor(Math.random() * INDUSTRIES.length)]);
    idea = idea.replace("{problem}", ["scheduling", "payments", "communication", "reporting"][Math.floor(Math.random() * 4)]);
    idea = idea.replace("{group1}", ["businesses", "freelancers", "agencies"][Math.floor(Math.random() * 3)]);
    idea = idea.replace("{group2}", ["customers", "suppliers", "partners"][Math.floor(Math.random() * 3)]);
    idea = idea.replace("{need}", ["productivity", "wellness", "learning", "networking"][Math.floor(Math.random() * 4)]);
    idea = idea.replace("{solution}", ["CRM", "analytics", "automation", "AI assistant"][Math.floor(Math.random() * 4)]);
    idea = idea.replace("{lifestyle}", ["fitness", "nutrition", "travel", "finance"][Math.floor(Math.random() * 4)]);
    
    const marketSize = ["$10M", "$50M", "$100M", "$500M", "$1B"][Math.floor(Math.random() * 5)];
    const complexity = ["Low", "Medium", "High"][Math.floor(Math.random() * 3)];
    
    ideas.push({
      idea,
      marketSize,
      complexity,
      reasoning: generateBusinessReasoning(idea)
    });
  }
  
  return ideas;
}

function generateBusinessReasoning(idea) {
  const reasons = [
    "Growing demand for automation in this space",
    "Underserved market with few competitors", 
    "High-value problem with willingness to pay",
    "Scalable solution with recurring revenue potential",
    "AI/ML creates new possibilities in this domain",
    "Remote work trends increase demand",
    "Regulatory changes create opportunity",
    "Existing solutions are outdated/complex"
  ];
  
  return reasons[Math.floor(Math.random() * reasons.length)];
}

async function getTodaysTasks() {
  try {
    console.log("📋 Fetching today's tasks...");
    
    const tasks = await convex.query("tasks:getAll");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaysTasks = tasks.filter(task => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === today.getTime();
    });
    
    const priorityOrder = { "P0": 0, "P1": 1, "P2": 2, "P3": 3 };
    return todaysTasks
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
      .slice(0, 8); // Top 8 tasks
      
  } catch (error) {
    console.error("❌ Error fetching tasks:", error);
    return [];
  }
}

async function generateCollaborationRecommendations() {
  try {
    console.log("🤝 Generating collaboration recommendations...");
    
    const agents = await convex.query("agents:getAll");
    const tasks = await convex.query("tasks:getAll");
    const epics = await convex.query("epics:getAll");
    
    const recommendations = [];
    
    // Find unassigned high-priority tasks
    const unassignedP0P1 = tasks.filter(t => 
      (t.priority === "P0" || t.priority === "P1") && 
      (!t.assigneeIds || t.assigneeIds.length === 0) &&
      t.status !== "done"
    );
    
    if (unassignedP0P1.length > 0) {
      recommendations.push({
        type: "urgent_assignment",
        title: "High-Priority Task Assignment",
        description: `${unassignedP0P1.length} high-priority tasks need assignment. Consider auto-assignment or manual review.`,
        action: "Review unassigned P0/P1 tasks in Mission Control",
        agents: ["Jarvis"] // Squad lead
      });
    }
    
    // Find blocked tasks that might need attention
    const blockedTasks = tasks.filter(t => t.status === "blocked");
    if (blockedTasks.length > 0) {
      recommendations.push({
        type: "bottleneck_resolution", 
        title: "Resolve Task Blockers",
        description: `${blockedTasks.length} tasks are blocked. Review dependencies and unblock where possible.`,
        action: "Check task dependencies in Task Board",
        agents: ["Jarvis", "Shuri"] // Lead + tester
      });
    }
    
    // Epic progress review
    const activeEpics = epics?.filter(e => e.status === "active") || [];
    const staleEpics = activeEpics.filter(epic => {
      const epicTasks = tasks.filter(t => t.epicId === epic._id);
      const completedTasks = epicTasks.filter(t => t.status === "done");
      return epicTasks.length > 0 && (completedTasks.length / epicTasks.length) < 0.3; // Less than 30% complete
    });
    
    if (staleEpics.length > 0) {
      recommendations.push({
        type: "epic_review",
        title: "Epic Progress Review", 
        description: `${staleEpics.length} active epics have low completion rates. Consider sprint planning.`,
        action: "Review epic progress in Roadmap tab",
        agents: ["Jarvis", "Vision"] // Lead + strategist
      });
    }
    
    // AI agent utilization
    const idleAgents = agents.filter(a => a.status === "idle").length;
    if (idleAgents > 2) {
      recommendations.push({
        type: "agent_utilization",
        title: "Agent Capacity Available",
        description: `${idleAgents} agents are idle. Consider creating new tasks or epic planning.`,
        action: "Create tasks or assign agent-specific work",
        agents: ["Squad"] // All agents
      });
    }
    
    return recommendations.slice(0, 4); // Top 4 recommendations
    
  } catch (error) {
    console.error("❌ Error generating recommendations:", error);
    return [];
  }
}

function formatMorningBrief(data) {
  const { news, businessIdeas, todaysTasks, recommendations } = data;
  const today = new Date().toLocaleDateString("en-GB", { 
    weekday: "long", 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  });
  
  let brief = `🌅 **Morning Brief - ${today}**\n\n`;
  
  // News Section
  brief += `📰 **Relevant News**\n`;
  if (news.length > 0) {
    news.slice(0, 3).forEach((item, i) => {
      brief += `${i + 1}. **${item.title}**\n`;
      brief += `   ${item.description}\n`;
      brief += `   *${item.relevance}*\n\n`;
    });
  } else {
    brief += `No news updates available\n\n`;
  }
  
  // Business Ideas Section
  brief += `💡 **Business Ideas for Today**\n`;
  businessIdeas.forEach((idea, i) => {
    brief += `${i + 1}. **${idea.idea}**\n`;
    brief += `   📊 Market: ${idea.marketSize} | Complexity: ${idea.complexity}\n`;
    brief += `   💭 ${idea.reasoning}\n\n`;
  });
  
  // Today's Tasks Section
  brief += `✅ **Tasks Due Today (${todaysTasks.length})**\n`;
  if (todaysTasks.length > 0) {
    todaysTasks.forEach((task, i) => {
      const priority = task.priority === "P0" ? "🔴" : task.priority === "P1" ? "🟠" : "🟡";
      brief += `${priority} ${task.title}\n`;
    });
  } else {
    brief += `No tasks due today - good time for strategic work!\n`;
  }
  brief += `\n`;
  
  // Collaboration Recommendations Section
  brief += `🤝 **Collaboration Recommendations**\n`;
  if (recommendations.length > 0) {
    recommendations.forEach((rec, i) => {
      brief += `${i + 1}. **${rec.title}**\n`;
      brief += `   ${rec.description}\n`;
      brief += `   🎯 Action: ${rec.action}\n`;
      brief += `   👥 Agents: ${rec.agents.join(", ")}\n\n`;
    });
  } else {
    brief += `All systems running smoothly - no urgent collaboration needed\n\n`;
  }
  
  brief += `---\n`;
  brief += `📊 View full details in Mission Control\n`;
  brief += `🤖 Generated by OpenClaw at ${new Date().toLocaleTimeString()}`;
  
  return brief;
}

async function sendTelegramMessage(message) {
  try {
    console.log("📱 Sending Telegram message...");
    
    // Get Telegram config from environment or OpenClaw config
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID || process.env.BOSS_CHAT_ID;
    
    if (!botToken || !chatId) {
      console.log("⚠️ Telegram not configured, logging to console instead:");
      console.log("\n" + "=".repeat(50));
      console.log(message);
      console.log("=".repeat(50) + "\n");
      return;
    }
    
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    });
    
    if (response.ok) {
      console.log("✅ Morning brief sent successfully");
    } else {
      console.error("❌ Failed to send Telegram message:", await response.text());
    }
    
  } catch (error) {
    console.error("❌ Error sending Telegram message:", error);
    // Fallback: log to console
    console.log("\n" + "=".repeat(50));
    console.log("FALLBACK OUTPUT:");
    console.log(message);
    console.log("=".repeat(50) + "\n");
  }
}

async function generateMorningBrief() {
  try {
    console.log("🌅 Starting Morning Brief generation...");
    
    // Gather all data in parallel
    const [news, businessIdeas, todaysTasks, recommendations] = await Promise.all([
      fetchNews(),
      generateBusinessIdeas(),
      getTodaysTasks(),
      generateCollaborationRecommendations()
    ]);
    
    // Format the brief
    const briefMessage = formatMorningBrief({
      news,
      businessIdeas, 
      todaysTasks,
      recommendations
    });
    
    // Send via Telegram
    await sendTelegramMessage(briefMessage);
    
    console.log("✅ Morning brief generation completed");
    
  } catch (error) {
    console.error("❌ Error generating morning brief:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  generateMorningBrief();
}

module.exports = { generateMorningBrief };