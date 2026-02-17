# HEARTBEAT.md — Wake Protocol

**Interval:** Every 15 minutes  
**Applies to:** All 10 squad members  
**Cron pattern:** Staggered (:00, :02, :04, :06, :07, :08, :10, :12, :14)

---

## Wake Checklist

On every heartbeat, check in order:

### 1. Load Context (Always)
```bash
# Read your working memory
cat ~/.openclaw/workspace/memory/WORKING-[YourName].md

# Read today's squad notes  
cat ~/.openclaw/workspace/memory/2026-$(date +%m-%d).md
```

### 2. Check @Mentions (Priority: CRITICAL)
```bash
# Check Convex for notifications
npx convex run notifications:getForAgent \
  --arg '{"agentId": " YOUR_ID "}'
```

**If mentions found:**
- Read the message
- Take action or reply
- Mark delivered: `npx convex run notifications:markDelivered --arg '{"id": "..."}'`

### 3. Check Assigned Tasks (Priority: HIGH)
```bash
# Get your tasks from Mission Control
npx convex run tasks:getForAgent \
  --arg '{"agentId": " YOUR_ID "}'
```

**If tasks in "assigned" status:**
- Start work
- Update status to `in_progress`
- Update WORKING.md

**If tasks in "in_progress":**
- Continue work
- Post progress update if significant

### 4. Check Blockers (Priority: HIGH)
- Are you blocked >30 min?
- Does a task need another agent's input?
- @Mention them or escalate to Jarvis

### 5. Scan Activity Feed (Priority: MEDIUM)
```bash
# Check what squad is doing
npx convex run activities:getRecent --arg '{"limit": 10}'
```

**Look for:**
- Tasks assigned to you that you missed
- Comments on your work
- New tasks in your domain

### 6. Reply or Act

**If all clear:** Reply exactly `HEARTBEAT_OK`

**If working:** Brief status update
```
In progress: [Task name]
% complete: ~[X]%
ETA: [time]
No blockers.
```

**If blocked:** Clear blocker message
```
BLOCKED: [Task name]
Reason: [What's blocking]
Need: [What you need]
```

**If done:** Completion with receipts
```
✅ COMPLETE: [Task name]
Receipts:
- Commit: [hash]
- Doc: [link]
- Files: [paths]
```

---

## Agent-Specific Cron Schedule

| Agent | Minute | Cron Expression |
|-------|--------|-----------------|
| Pepper | :00 | `0,15,30,45 * * * *` |
| Shuri | :02 | `2,17,32,47 * * * *` |
| Fury | :04 | `4,19,34,49 * * * *` |
| Vision | :06 | `6,21,36,51 * * * *` |
| Loki | :07 | `7,22,37,52 * * * *` |
| Wanda | :08 | `8,23,38,53 * * * *` |
| Quill | :10 | `10,25,40,55 * * * *` |
| Friday | :12 | `12,27,42,57 * * * *` |
| Wong | :14 | `14,29,44,59 * * * *` |
| Jarvis | On-demand | (Squad lead, manual triggers) |

---

## Staggered Wake Rationale

- **Every 5 min:** Too expensive (agents wake with nothing to do)
- **Every 30 min:** Too slow (work sits waiting)
- **Every 15 min:** Optimal balance
- **2-min stagger:** Prevents all 10 agents hitting Convex simultaneously

---

## Heartbeat Message Format

**Standard wake message for crons:**
```
HEARTBEAT: Check Mission Control for tasks.

Steps:
1. Read your WORKING.md
2. npx convex run notifications:getForAgent --arg '{"agentId": "[YOUR_ID]"}'
3. npx convex run tasks:getForAgent --arg '{"agentId": "[YOUR_ID]"}'
4. Take action or reply HEARTBEAT_OK
```

Each agent has their ID and session key in their SOUL.md file.

---

## Offline Recovery

**If you miss heartbeats (system down):**

1. On wake, check how long you were offline
2. Read all activity since last heartbeat:
   ```bash
   npx convex run activities:getRecent --arg '{"since": [last_heartbeat_timestamp]}'
   ```
3. Check for urgent @mentions
4. Resume highest priority work
5. Report catch-up status

---

## HEARTBEAT_OK Conditions

Reply exactly `HEARTBEAT_OK` only when ALL true:
- [ ] No @mentions requiring response
- [ ] No tasks in "assigned" waiting to start  
- [ ] Not currently working on in-progress task
- [ ] No blockers needing escalation
- [ ] No urgent activity feed items

**If ANY checkbox false:** Provide brief status instead of HEARTBEAT_OK.

---

## References

- Your agent ID: See SOUL-[YourName].md
- Mission Control: `http://localhost:3000`
- Convex CLI: `npx convex --help`
- This file: `~/dev/arana198/mission-control/agents/HEARTBEAT.md`
