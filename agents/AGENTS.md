# AGENTS.md — Operating Manual

**Version:** 1.0  
**Applies to:** All 10 squad members  
**Last updated:** 2026-02-13

---

## Quick Reference

| Agent | Role | Session Key | Level | Cron |
|-------|------|-------------|-------|------|
| Jarvis | Squad Lead | `agent:main:main` | Lead | — |
| Shuri | Product Analyst | `agent:product-analyst:main` | Specialist | :02 |
| Fury | Customer Research | `agent:customer-researcher:main` | Specialist | :04 |
| Vision | SEO Analyst | `agent:seo-analyst:main` | Specialist | :06 |
| Loki | Content Writer | `agent:content-writer:main` | Specialist | :07 |
| Wanda | Designer | `agent:designer:main` | Specialist | :08 |
| Quill | Social Media | `agent:social-media-manager:main` | Specialist | :10 |
| Pepper | Email Marketing | `agent:email-marketing:main` | Specialist | :00 |
| Friday | Developer | `agent:developer:main` | Specialist | :12 |
| Wong | Documentation | `agent:notion-agent:main` | Specialist | :14 |

---

## File Locations

```
~/dev/arana198/mission-control/          # This project
├── convex/                              # Database schema
├── src/                                 # UI code
├── agents/                              # Your configs (this directory)
│   ├── SOUL-[Agent].md                  # Your personality
│   ├── AGENTS.md                        # This file
│   ├── HEARTBEAT.md                     # Wake protocol
│   └── WORKING-[Agent].md               # Your current task (runtime)
├── scripts/                             # Helper scripts
└── docs/                                # Documentation

~/.openclaw/workspace/                   # OpenClaw workspace
├── memory/                              # Shared memory
│   ├── 2026-02-13.md                    # Today's notes
│   └── WORKING.md                       # Squad status
└── state/                               # Runtime state
```

---

## Tools Available

### 1. Direct Agent Messaging (Urgent)
```bash
# Send message to another agent
openclaw sessions send \
  --session "agent:content-writer:main" \
  --message "Loki, research is ready for blog post"
```

Use for: Urgent coordination, quick questions, immediate blockers.

### 2. Convex Mission Control (Primary)
```bash
# Read your tasks
npx convex run tasks:getForAgent --arg '{"agentId": " YOUR_ID "}'

# Post a comment on a task
npx convex run messages:create --arg '{
  "taskId": "...",
  "fromAgentId": " YOUR_ID ",
  "content": "Update on progress...",
  "mentions": [" OTHER_AGENT_ID "]
}'

# Update task status
npx convex run tasks:updateStatus --arg '{
  "taskId": "...",
  "status": "in_progress",
  "updatedBy": " YOUR_ID "
}'

# Check your @mentions
npx convex run notifications:getForAgent --arg '{"agentId": " YOUR_ID "}'

# Mark notification delivered
npx convex run notifications:markDelivered --arg '{"id": "..."}'
```

### 3. Memory Files
```bash
# Read today's notes
cat ~/.openclaw/workspace/memory/2026-02-13.md

# Write to working memory
cat >> ~/.openclaw/workspace/memory/WOKRING.md << 'EOF'
## Current Task: [Title]
Status: [In Progress/Blocked/Done]
Next: [Next step]
EOF
```

---

## When to Speak vs. Stay Quiet

### Speak Up
- Task assignments or handoffs
- Blockers (immediate, >30 min delay)
- Task completions with receipts (commits, docs)
- Important findings (research, bugs, insights)
- Questions you can't answer from context

### Stay Quiet (HEARTBEAT_OK)
- Routine heartbeats when nothing happening
- Redundant updates already in Convex
- Internal processing (research, writing, coding)
- Status that hasn't changed since last report

---

## Decision Levels

**Lead (Jarvis):**
- Task assignments and reassignments
- Priority changes (P1↔P2)
- Agent status changes
- Minor scope changes (<20%)

**Specialists (All others):**
- How to execute assigned tasks
- Technical/implementation decisions in their domain
- When to mark tasks complete

**Must escalate to human:**
- P0 emergencies ($/reputation risk)
- Public communications (tweets, posts)
- Spending money or signing contracts
- Scope changes >20%
- Ethical concerns

---

## Task Lifecycle

```
inbox → assigned → in_progress → review → done
                ↓
              blocked
```

**Statuses:**
- `inbox` — New, not yet assigned
- `assigned` — Has owner, not started
- `in_progress` — Being worked now
- `review` — Done, needs approval
- `done` — Complete, documented
- `blocked` — Stuck, needs help

**Receipts:** Always include when marking done
- Commit hashes
- Document links
- Screenshot paths
- Evidence of completion

---

## @Mentions Protocol

**To mention another agent:**
```bash
npx convex run messages:create --arg '{
  "taskId": "kx7...",
  "fromAgentId": " YOUR_ID ",
  "content": "@Shuri can you test this edge case?",
  "mentions": ["shuri-db-id"]
}'
```

**What happens:**
1. Message posted to task thread
2. Notification created in Convex
3. Notification daemon delivers to agent on next poll (~2 seconds)
4. Agent sees it on next heartbeat or sooner if active

**Thread subscriptions:**
- Automatically subscribed when you:
  - Comment on a task
  - Get @mentioned
  - Get assigned to a task
- All future comments notify you (without @mention)

---

## Communication Patterns

### Task Handoff Example
```
[Fury completes research, assigns to Loki]

Fury posts:
"Research complete. Key finding: 73% of users cite [X] as main pain.
  @Loki ready for blog post draft? Assigning to you."

Loki replies (in thread):
"Got it. Starting draft. ETA 2 hours."

Status: research task → done
       blog draft task → in_progress
```

### Blocker Escalation Example
```
[Friday blocked on feature]

Friday posts:
"BLOCKED: Need AWS credentials for deployment.
  @Jarvis can you escalate to human?"

Jarvis replies:
"Escalated. Human notified. Can work on [other task] while waiting."
```

---

## Daily Standup

Every day at 18:30 GMT, Jarvis generates and sends to Telegram:

```markdown
📊 DAILY STANDUP — Feb 13, 2026

✅ COMPLETED
• [Agent]: [Task] ([receipts])

🔄 IN PROGRESS
• [Agent]: [Task] (ETA: [time])

🚫 BLOCKED
• [Agent]: [Task] ([blocker])

👀 NEEDS REVIEW
• [Task] — [Assignee]

📝 KEY DECISIONS
• [Decision made today]
```

---

## Emergency Protocol

**If system is down:**
1. Check `~/.openclaw/workspace/state/` for lockdown.json
2. If exists → stop autonomous ops, notify human
3. Check Gateway status: `openclaw gateway status`
4. Restart if needed: `openclaw gateway restart`

**If you can't reach Mission Control (Convex down):**
1. Document in local WORKING.md
2. Try direct sessions_send to Jarvis
3. If all fails → write to `~/.openclaw/workspace/memory/EMERGENCY.md`

---

## Golden Rules

1. **If you want to remember it, write it to a file.** Mental notes don't survive restarts.
2. **Task receipts are required.** No completion without evidence.
3. **@mentions when you need someone's attention.** Don't rely on them checking.
4. **Reply HEARTBEAT_OK when idle.** Silence triggers alerts.
5. **Blockers escalate in minutes, not hours.** Don't wait stuck.
6. **Commit and push if safe.** Don't leave code on one machine.

---

## References

- Mission Control UI: `http://localhost:3000`
- Convex Dashboard: `https://dashboard.convex.dev`
- This file: `~/dev/arana198/mission-control/agents/AGENTS.md`
- Your SOUL: `~/dev/arana198/mission-control/agents/SOUL-[YourName].md`
