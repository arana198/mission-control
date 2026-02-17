# Operations Guide

Running Mission Control day-to-day.

---

## Daily Workflow (Human)

### Morning Standup (18:30 GMT)

Received in Telegram:
```
📊 DAILY STANDUP — Feb 13, 2026

✅ COMPLETED TODAY
• Loki: Shopify blog post (2,100 words)
• Quill: 10 tweets drafted

🔄 IN PROGRESS
• Vision: SEO strategy (ETA: tomorrow)
• Pepper: Trial onboarding (3/5 emails)

🚫 BLOCKED
• Wanda: Waiting for brand colors

👀 NEEDS REVIEW
• Loki's draft (link)
• Pepper's sequence (link)

🤖 AGENT STATUS
▶️ Jarvis: active (coordinating)
⏸️ Shuri: idle
⏸️ Fury: idle
▶️ Vision: active (SEO strategy)
...
```

**Your actions:**
1. Review completed work (optional deep-dive)
2. Unblock agents (brand colors → Wanda)
3. Approve review items or request changes
4. Add new tasks if needed
5. Reply acknowledgment to squad

---

## Creating a Task

### Option 1: UI (Recommended)

1. Open http://localhost:3000
2. Click "Tasks" tab
3. "New Task" button
4. Fill form:
   - Title: Clear action
   - Description: Context, acceptance criteria
   - Priority: P0 (urgent) to P3 (backlog)
5. Assign to agent(s)
6. Submit

### Option 2: CLI

```bash
# Get agent IDs first
npx convex run agents:getAll | jq '.[] | "\(._id): \(.name)"'

# Create task
npx convex run tasks:create --arg '{
  "title": "Write competitor comparison page",
  "description": "Compare our pricing vs. Zendesk vs. Intercom. Use Fury's research.",
  "priority": "P1",
  "createdBy": "JARVIS_ID"
}'

# Assign
npx convex run tasks:assign --arg '{
  "taskId": "TASK_ID",
  "assigneeIds": ["LOKI_ID"],
  "assignedBy": "JARVIS_ID"
}'
```

### Option 3: Telegram to Jarvis

```
You: @Jarvis create task for Loki: Write comparison page using Fury's research. P1 priority.

Jarvis: ✅ Created TASK-123: "Write comparison page" assigned to Loki (P1)
```

---

## Monitoring Activity

### Activity Feed (UI)

Real-time stream shows:
- Who completed what
- Status changes
- Comments posted
- @mentions

**Use for:** Spot-checking work, seeing context, finding blockers early.

### Agent Cards (UI)

Shows per-agent:
- Current status (idle/active/blocked)
- What they're working on
- Last seen (heartbeat ago)
- Personality/profile

**Use for:** Finding who's available, who needs help.

### Task Board (UI)

Kanban columns:
- Inbox → needs assignment
- Assigned → needs to start
- In Progress → actively working
- Review → needs your eyes
- Done → complete with receipts
- Blocked → needs intervention

**Use for:** Project management, bottleneck detection.

---

## Communications

### Agent-to-Agent: @Mention

Agents naturally @mention in comments:

```
[Fury on research task]
"Found that 67% cite pricing as pain. @Loki this should lead the comparison page."
```

Loki gets notified within 2 seconds.

### Human-to-Agent: Direct Message

If you need something now:

```bash
openclaw sessions send \
  --session "agent:content-writer:main" \
  --message "Loki, priority change: Make the blog post about AI first, crypto second."
```

### Group Coordination: Mission Control

For multi-agent work, post in task thread:

```bash
npx convex run messages:create --arg '{
  "taskId": "comparison-page-task",
  "fromAgentId": "JARVIS_ID",
  "content": "Vision: provide keywords. Fury: pull G2 quotes. Loki: draft with both. @all coordinate.",
  "mentions": ["VISION_ID", "FURY_ID", "LOKI_ID"]
}'
```

---

## Handling Blockers

### Agent Reports Blocker

In task comment or heartbeat:
```
Loki: BLOCKED: Need pricing data for enterprise tier.
Human doesn't use that tier. @Jarvis escalate?
```

### Your Response

1. **Quick unblock:** Provide data
   ```
   You: @Wong create doc: Enterprise pricing breakdown.
   @Loki data coming in 10 min.
   ```

2. **Defer:** If not urgent
   ```
   You: @Loki deprioritize. Work on backup topic. Revisit next week.
   ```

3. **Escalate:** If systemic
   ```
   You: @Jarvis add to backlog: "Get enterprise pricing access"
   ```

---

## Reviewing Work

### In Review Status

Agent marks task `review` when done.

You:
1. Open task in UI
2. Read deliverables
3. Comment feedback
4. Approve (mark `done`) or return (mark `in_progress`)

### Quick Approval

```bash
npx convex run tasks:updateStatus --arg '{
  "taskId": "TASK_ID",
  "status": "done",
  "updatedBy": "YOUR_AGENT_ID"
}'
```

### Change Request

```bash
# Post comment
npx convex run messages:create --arg '{
  "taskId": "TASK_ID",
  "fromAgentId": "YOUR_ID",
  "content": "Great draft. Two changes: 1) Add Zendesk comparison 2) Soften claim about 'terrible UI'",
  "mentions": ["AGENT_ID"]
}'

# Return to in-progress
npx convex run tasks:updateStatus --arg '{
  "taskId": "TASK_ID",
  "status": "in_progress",
  "updatedBy": "YOUR_ID"
}'
```

---

## Maintenance

### Check Daemon Health

```bash
pm2 status
pm2 logs mission-control-daemon --lines 50
```

### Restart Daemon

```bash
pm2 restart mission-control-daemon
```

### Check Agent Crons

```bash
openclaw cron list
```

### View Convex Dashboard

```bash
# Open in browser
open https://dashboard.convex.dev

# Check data
npx convex run agents:getAll
npx convex run tasks:getByStatus --arg '{"status": "blocked"}'
```

### Backup Database

Convex auto-backs up. For manual export:

```bash
# Export all tables
for table in agents tasks messages activities documents notifications; do
  npx convex run "${table}:getAll" > "backup-${table}-$(date +%Y%m%d).json"
done
```

---

## Troubleshooting

### Agent Not Responding

```bash
# Check if session exists
openclaw sessions list | grep AGENT_NAME

# If not found, agent is "cold" - next heartbeat will wake
# If heartbeat missed (>20 min ago), check cron
openclaw cron list | grep AGENT_NAME
```

### @Mentions Not Delivering

```bash
# Check daemon running
pm2 status

# Check logs
pm2 logs

# Manual test
openclaw sessions send --session "AGENT_SESSION" --message "test"

# Check Convex for stuck notifications
npx convex run notifications:getUndelivered
```

### UI Shows Old Data

Convex subscriptions auto-update. If stuck:
1. Refresh browser
2. Check browser console for errors
3. Verify `NEXT_PUBLIC_CONVEX_URL` in `.env.local`

### Task Assignments Not Working

```bash
# Verify agent exists
npx convex run agents:getByName --arg '{"name": "Loki"}'

# Check task has valid assigneeIds
npx convex run tasks:getWithDetails --arg '{"taskId": "TASK_ID"}'
```

---

## Best Practices

### For You (Human):

- **Morning:** Read standup, unblock, review deliverables
- **Throughout day:** Glance at activity feed every few hours
- **Evening:** Quick check that nothing critical blocked
- **Weekly:** Review completed work, adjust priorities, retire old tasks

### For Squad Health:

- Keep ~10-20 active tasks (not 100s)
- Stagger P0 tasks (never multiple at once)
- Let agents own their domains (trust specialists)
- Document decisions in comments (not just DMs)
- Celebrate completions (receipts, commits, praise)

---

## Emergency Contacts

| Issue | Who to Ask | How |
|-------|-----------|-----|
| System down | Jarvis | `openclaw sessions send --session agent:main:main` |
| Database issue | Check logs | `pm2 logs`, `npx convex dev` |
| UI bug | Friday | Task in Mission Control |
| Content question | Loki | @mention in task |
| Technical architecture | Friday + Jarvis | Thread with both |

---

## Metrics to Watch

Weekly review:

| Metric | Good | Warning |
|--------|------|---------|
| Tasks completed/week | >15 | <5 |
| Blockers unresolved >24h | 0 | >2 |
| Agent idle % | <30% | >60% |
| Receipts per task | 2+ | 0 |
| Standup questions unanswered | 0 | >3 |

---

## References

- [Agent Setup](AGENT_SETUP.md)
- [Architecture](ARCHITECTURE.md)
- Mission Control UI: http://localhost:3000
- Convex Dashboard: https://dashboard.convex.dev
