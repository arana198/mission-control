#!/usr/bin/env node
/**
 * Creates feature tickets in Mission Control
 * Run after: npx convex dev && npx convex deploy
 * 
 * Usage: node scripts/create-tickets.js
 */

const { ConvexClient } = require("convex/browser");

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ Missing CONVEX_URL. Set NEXT_PUBLIC_CONVEX_URL in .env.local");
  process.exit(1);
}

const client = new ConvexClient(CONVEX_URL);

const tickets = [
  {
    title: "TICKET-03: Intelligent Task Routing & Load Balancing",
    description: `## Problem
Manual task assignment doesn't scale. At 50 agents, humans become traffic controllers.

## Solution
- Agent capacity scoring (skills, load, velocity)
- Smart assignment UI with match %
- Auto-rebalancing when agents go offline

## Schema
- agents.maxConcurrentTasks
- agents.skills[]
- agents.taskVelocity (7-day rolling)

## Acceptance
- Average "ready" → "in_progress" time: 45min → 5min
- <2% tasks sit unassigned >2 hours

[Full spec in TICKET-03-INTELLIGENT-ROUTING.md]`,
    priority: "P1",
    status: "backlog",
    assigneeIds: [],
    createdBy: "user",
  },
  {
    title: "TICKET-04: Bulk Task Operations",
    description: `## Problem
Dragging 12 tasks to "done" one-by-one is tedious. 36 clicks for a 5-second job.

## Solution
- Cmd/Ctrl + Click multi-select
- Shift + Click range select
- Floating action bar: [Move] [Reassign] [Set Priority] [Delete]
- Bulk status changes in one action

## Acceptance
- 12 tasks: 36 clicks → 3 clicks
- Time savings: ~80%

[Full spec in TICKET-04-BULK-OPERATIONS.md]`,
    priority: "P2",
    status: "backlog",
    assigneeIds: [],
    createdBy: "user",
  },
  {
    title: "TICKET-05: Performance Analytics Dashboard",
    description: `## Problem
No visibility into velocity, bottlenecks, agent performance.

## Solution
New "Analytics" tab with:
- Velocity trend chart (30-day)
- Agent leaderboard (throughput, cycle time)
- Blockage rate pie chart
- Cycle time histogram

## Metrics
- Cycle time: doneAt - startedAt
- Lead time: doneAt - createdAt
- Blockage rate: % tasks hitting "blocked"
- Velocity trend: 7-day vs previous 7-day

## Lib
npm install recharts

## Acceptance
- Answer "Who's fastest agent?" in <5 seconds
- Spot velocity drops within 24h

[Full spec in TICKET-05-PERFORMANCE-ANALYTICS.md]`,
    priority: "P2",
    status: "backlog",
    assigneeIds: [],
    createdBy: "user",
  },
  {
    title: "TICKET-06: Auto-Escalation & SLA Monitoring",
    description: `## Problem
Tasks die in queues. P0 sits blocked 3 days. No one notices.

## Solution
Configurable SLA rules:
- P0 blocked >2h → Wake squad lead + reassign
- P1 blocked >24h → Notify channel
- Ready >72h → Auto-assign via intelligent routing

## Cron
Every 15 mins: checkSLAViolations()

## UI
- Breach badges on task cards
- Escalation rules config panel
- Override/extend SLA buttons

## Acceptance
- 0% P0 tasks age >24h without escalation
- MTTR for blocked tickets: ↓60%

[Full spec in TICKET-06-ESCALATION-RULES.md]`,
    priority: "P1",
    status: "backlog",
    assigneeIds: [],
    createdBy: "user",
  },
  {
    title: "TICKET-07: Task Dependencies & Blocker Tracking",
    description: `## Problem
"Landing Page" depends on "Copy" depends on "Strategy". Tracked mentally → fake progress.

## Solution
- dependencies[] field on tasks
- Dependency chain visualization
- Block auto-status if deps incomplete
- Cascade completion notifications
- Blocker classification (waiting_on_dependency, waiting_on_review, etc)

## Schema
- tasks.dependencies: taskId[]
- tasks.dependentTasks: taskId[] (inverse)
- tasks.blockedReason: enum

## Blocking
Try move to "in_progress" with incomplete deps → Error + suggestion

## Acceptance
- 0% "in_progress" tasks actually blocked
- Dependencies explicit, visible to all

[Full spec in TICKET-07-TASK-DEPENDENCIES.md]`,
    priority: "P1",
    status: "backlog",
    assigneeIds: [],
    createdBy: "user",
  },
];

async function createTickets() {
  console.log("🎫 Creating tickets in Mission Control...\n");
  
  for (const ticket of tickets) {
    try {
      await client.mutation("tasks:createWithAssignees", ticket);
      console.log(`✅ Created: ${ticket.title}`);
    } catch (err) {
      console.error(`❌ Failed: ${ticket.title}`);
      console.error(`   ${err.message}`);
    }
  }
  
  console.log("\n🚀 Done! View in Mission Control Task Board.");
  process.exit(0);
}

createTickets().catch((err) => {
  console.error("\n❌ Fatal error:", err.message);
  console.log("\n💡 Make sure:");
  console.log("   1. npx convex dev is running");
  console.log("   2. NEXT_PUBLIC_CONVEX_URL is set in .env.local");
  process.exit(1);
});
