# Agent Setup Guide

How to configure and deploy your 10-agent squad.

---

## Prerequisites

- OpenClaw installed and running
- Convex project initialized
- Telegram (or other channel) configured
- Node.js 18+ installed

---

## Step 1: Install Mission Control

```bash
# Navigate to project
cd ~/dev/arana198/mission-control

# Install dependencies
npm install

# Initialize Convex
npx convex dev
```

---

## Step 2: Seed the Database

```bash
# Populate agents table
npm run seed

# Verify
npx convex run agents:getAll
```

Expected output: All 10 agents with session keys.

---

## Step 3: Configure OpenClaw Agents

Edit `~/.openclaw/openclaw.json`:

```json
{
  "agents": {
    "list": [
      { "id": "main", "default": true, "name": "Jarvis", "sessionKey": "agent:main:main" },
      { "id": "product-analyst", "name": "Shuri", "sessionKey": "agent:product-analyst:main" },
      { "id": "customer-researcher", "name": "Fury", "sessionKey": "agent:customer-researcher:main" },
      { "id": "seo-analyst", "name": "Vision", "sessionKey": "agent:seo-analyst:main" },
      { "id": "content-writer", "name": "Loki", "sessionKey": "agent:content-writer:main" },
      { "id": "social-media", "name": "Quill", "sessionKey": "agent:social-media-manager:main" },
      { "id": "designer", "name": "Wanda", "sessionKey": "agent:designer:main" },
      { "id": "email-marketing", "name": "Pepper", "sessionKey": "agent:email-marketing:main" },
      { "id": "developer", "name": "Friday", "sessionKey": "agent:developer:main" },
      { "id": "notion-agent", "name": "Wong", "sessionKey": "agent:notion-agent:main" }
    ]
  }
}
```

---

## Step 4: Deploy Agent Configs

Copy personality files to workspace:

```bash
# Create agent directories in OpenClaw workspace
mkdir -p ~/.openclaw/workspace/agents/{jarvis,shuri,fury,vision,loki,wanda,quill,pepper,friday,wong}

# Copy SOUL files
for agent in jarvis shuri fury vision loki wanda quill pepper friday wong; do
  cp ~/dev/arana198/mission-control/agents/SOUL-$(echo $agent | sed 's/.*/\u&/').md \
    ~/.openclaw/workspace/agents/$agent/SOUL.md
done

# Copy shared files
cp ~/dev/arana198/mission-control/agents/AGENTS.md ~/.openclaw/workspace/
cp ~/dev/arana198/mission-control/agents/HEARTBEAT.md ~/.openclaw/workspace/
```

---

## Step 5: Setup Heartbeat Crons

```bash
cd ~/dev/arana198/mission-control
npm run heartbeat:setup
```

This creates 9 cron jobs (agents wake every 15 min, staggered).

---

## Step 6: Start Notification Daemon

```bash
# Install PM2 globally if needed
npm install -g pm2

# Start daemon
npm run daemon:start

# Check status
pm2 status

# View logs
pm2 logs mission-control-daemon
```

---

## Step 7: Test the System

### Manual Heartbeat Test

```bash
# Wake Pepper manually
openclaw sessions send \
  --session "agent:email-marketing:main" \
  --message "🫀 HEARTBEAT TEST: Please reply HEARTBEAT_OK"
```

### Test @Mention

```bash
# Post comment mentioning Loki
npx convex run messages:create --arg '{
  "taskId": "YOUR_TASK_ID",
  "fromAgentId": "JARVIS_AGENT_ID",
  "content": "@Loki please review this draft",
  "mentions": ["LOKI_AGENT_ID"]
}'
```

Check if Loki receives notification within 2 seconds.

### Test Task Assignment

```bash
# Create a task
npx convex run tasks:create --arg '{
  "title": "Test Task",
  "description": "Test the Mission Control system",
  "priority": "P2",
  "createdBy": "JARVIS_AGENT_ID"
}'

# Assign to Pepper
npx convex run tasks:assign --arg '{
  "taskId": "TASK_ID",
  "assigneeIds": ["PEPPER_AGENT_ID"],
  "assignedBy": "JARVIS_AGENT_ID"
}'
```

---

## Step 8: Start the UI

```bash
npm run dev
```

Open http://localhost:3000 to see Mission Control dashboard.

---

## Daily Standup Setup

Add cron for daily standup:

```bash
# 18:30 GMT daily
openclaw cron add \
  --name "daily-standup" \
  --cron "30 18 * * *" \
  --session "agent:main:main" \
  --message "Generate and send daily standup"
```

Or run manually:
```bash
node scripts/daily-standup.js
```

---

## Troubleshooting

### Agent not receiving heartbeats

```bash
# Check if session exists
openclaw sessions list | grep pepper

# If not, agent hasn't been active yet - this is normal
# Agents are "stateless" until first heartbeat wakes them
```

### Notifications not delivering

```bash
# Check daemon status
pm2 status mission-control-daemon
pm2 logs mission-control-daemon

# Restart if needed
pm2 restart mission-control-daemon
```

### Convex connection errors

```bash
# Verify convex dev is running
npx convex dev

# Check environment
env | grep CONVEX
```

---

## Agent Quick Reference

| Agent | Wake Time | Best For |
|-------|-----------|----------|
| Pepper | :00 | Email sequences, lifecycle marketing |
| Shuri | :02 | Testing, edge cases, UX issues |
| Fury | :04 | Research, evidence, competitive intel |
| Vision | :06 | SEO, keywords, content optimization |
| Loki | :07 | Blog posts, copy, editorial |
| Wanda | :08 | Visuals, infographics, mockups |
| Quill | :10 | Social threads, hooks, engagement |
| Friday | :12 | Code, scripts, integrations |
| Wong | :14 | Documentation, organization |
| Jarvis | On-demand | Coordination, decisions, escalation |

---

## Next Steps

- [Read Operations Guide](OPERATIONS.md) — Daily workflows
- [Read Architecture](ARCHITECTURE.md) — System design
- Spawn your first task in the UI
- Watch the activity feed populate
