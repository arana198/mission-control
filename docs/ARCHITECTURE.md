# Architecture

How Mission Control coordinates 10 AI agents.

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    USER LAYER                           │
│  ┌──────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │ Telegram/    │  │ Mission    │  │ Terminal/      │  │
│  │ Slack/       │  │ Control    │  │ CLI            │  │
│  │ iMessage     │  │ Dashboard  │  │                │  │
│  └──────┬───────┘  └─────┬──────┘  └────────┬───────┘  │
└─────────┼────────────────┼──────────────────┼──────────┘
          │                │                  │
          ▼                ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                  OPENCLAW GATEWAY                       │
│     Session routing • Message delivery • Cron jobs      │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Jarvis     │ │    Loki      │ │   Pepper     │
│  (Squad Lead)│ │   (Writer)   │ │  (Marketing) │
└──────────────┘ └──────────────┘ └──────────────┘
       │                │                │
       └────────────────┴────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  CONVEX DATABASE                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ agents   │ │ tasks    │ │ messages │ │activities│   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │documents │ │notifications│subscriptions│            │
│  └──────────┘ └──────────┘ └──────────┘                │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              NOTIFICATION DAEMON                        │
│     Polls every 2s → delivers @mentions via CLI         │
└─────────────────────────────────────────────────────────┘
```

---

## Data Flow: Task Lifecycle

```
1. USER creates task in UI
         ↓
   tasks table: {status: "inbox"}
         ↓
2. Jarvis assigns to Shuri
         ↓
   tasks: {status: "assigned", assigneeIds: ["shuri"]}
   threadSubscriptions: {agentId: "shuri", taskId: "task1"}
         ↓
3. Shuri heartbeat wakes, checks tasks
         ↓
   npx convex run tasks:getForAgent → sees assignment
         ↓
4. Shuri updates to "in_progress"
         ↓
   activities: {type: "task_status_changed", ...}
   Shuri's WORKING.md updated
         ↓
5. Shuri completes, posts findings
         ↓
   messages: {fromAgentId: "shuri", mentions: ["loki"], ...}
   notifications: {mentionedAgentId: "loki", ...}
         ↓
6. Daemon delivers notification
         ↓
   openclaw sessions send → loki
         ↓
7. Loki wakes or sees notification
         ↓
   Starts writing content
```

---

## Data Flow: @Mention

```
Fury posts comment with @Loki
         ↓
   messages: {mentions: ["loki_id"], ...} saved
         ↓
   notifications: {mentionedAgentId: "loki_id", delivered: false}
         ↓
2s pass
         ↓
   Daemon polls notifications:getUndelivered
         ↓
   Finds undelivered @Loki
         ↓
   Gets Loki's sessionKey from agents table
         ↓
   openclaw sessions send --session agent:content-writer:main
         ↓
   "🔔 @Loki: @Fury mentioned you..."
         ↓
   Daemon marks notification delivered
```

---

## Tables

### agents

Core entity table. Each row is one squad member.

```typescript
{
  _id: Id<"agents">,
  name: string,                    // "Jarvis"
  role: string,                    // "Squad Lead"
  status: "idle" | "active" | "blocked",
  currentTaskId?: Id<"tasks">,
  sessionKey: string,              // "agent:main:main"
  lastHeartbeat: number,
  level: "lead" | "specialist" | "intern",
  personality?: string
}
```

Indexes: by_name, by_status, by_session_key

### tasks

Work queue with kanban status.

```typescript
{
  _id: Id<"tasks">,
  title: string,
  description: string,
  status: "inbox" | "assigned" | "in_progress" | "review" | "done" | "blocked",
  priority: "P0" | "P1" | "P2" | "P3",
  assigneeIds: Id<"agents">[],
  createdBy: Id<"agents">,
  createdAt: number,
  updatedAt: number,
  completedAt?: number,
  tags?: string[],
  receipts?: string[]
}
```

Indexes: by_status, by_assignee, by_created_at

### messages

Threaded comments with @mentions.

```typescript
{
  _id: Id<"messages">,
  taskId: Id<"tasks">,
  fromAgentId: Id<"agents">,
  content: string,
  mentions: Id<"agents">[],
  attachments?: Id<"documents">[],
  createdAt: number,
  editedAt?: number
}
```

Indexes: by_task, by_from_agent, by_created_at

### activities

The feed. Denormalized for fast reads.

```typescript
{
  _id: Id<"activities">,
  type: "task_created" | "task_assigned" | "task_status_changed" | 
        "task_completed" | "message_sent" | "document_created" | 
        "document_updated" | "agent_status_changed" | "agent_heartbeat" | "mention",
  agentId: Id<"agents">,
  message: string,
  metadata?: {
    taskId?: Id<"tasks">,
    documentId?: Id<"documents">,
    oldStatus?: string,
    newStatus?: string
  },
  createdAt: number
}
```

Indexes: by_created_at, by_agent, by_type

### notifications

@Mention queue for daemon delivery.

```typescript
{
  _id: Id<"notifications">,
  mentionedAgentId: Id<"agents">,
  content: string,
  taskId?: Id<"tasks">,
  fromAgentId: Id<"agents">,
  messageId: Id<"messages">,
  delivered: boolean,
  deliveredAt?: number,
  createdAt: number
}
```

Indexes: by_mentioned_agent, by_delivered, by_created_at

### threadSubscriptions

Auto-subscribe users who interact with tasks.

```typescript
{
  _id: Id<"threadSubscriptions">,
  agentId: Id<"agents">,
  taskId: Id<"tasks">,
  createdAt: number
}
```

Indexes: by_agent_task (compound), by_task

---

## Real-Time Updates

Convex subscriptions provide real-time UI updates:

```typescript
// React component
const activities = useQuery(api.activities.getRecent, { limit: 50 });

// When new activity inserted in Convex → UI auto-updates
// No polling needed
```

This works for:
- Activity feed
- Task board (status changes appear instantly)
- Agent cards (status updates)
- Notification count badges

---

## Heartbeat System

Agents are "offline by default." They wake via cron:

```
┌─────────┐    ┌─────────┐    ┌─────────┐
│  Pepper │    │  Shuri  │    │  Fury   │
│   :00   │    │   :02   │    │   :04   │
└────┬────┘    └────┬────┘    └────┬────┘
     │              │              │
     └──────────────┼──────────────┘
                    │
                    ▼
            ┌───────────────┐
            │  Convex Read  │
            │ @mentions?    │
            │ tasks?        │
            └───────┬───────┘
                    │
           ┌────────┴────────┐
           ▼                 ▼
        Work              HEARTBEAT_OK
        found?            (nothing to do)
```

This design:
- **Reduces cost:** Agents only run when needed
- **Prevents noise:** No idle chatter
- **Maintains responsiveness:** 15-min max latency
- **Scales:** 100 agents = 100 staggered crons

---

## Notification Daemon

Critical for real-time @mentions:

```javascript
// 2-second poll loop
while (true) {
  undelivered = query Convex for notifications
  for (notification of undelivered) {
    if (agent online) {
      deliver via openclaw sessions send
      mark delivered
    } else {
      leave queued for next poll
    }
  }
  sleep(2000ms)
}
```

Why not webhook?
- **Reliability:** OpenClaw agents use session keys, not URLs
- **Simplicity:** No ingress configuration
- **Fallback:** Queued if agent offline

---

## Why These Technologies

| Component | Choice | Why |
|-----------|--------|-----|
| **Database** | Convex | Real-time subscriptions, serverless, generous free tier |
| **Gateway** | OpenClaw | Multi-agent sessions, Telegram integration, tool access |
| **UI** | Next.js + React | Fast, familiar, good for real-time apps |
| **Styling** | Tailwind | Rapid iteration, consistent design |
| **Daemon** | Node.js + PM2 | Reliable, well-understood, easy to monitor |

---

## Security Considerations

1. **No secrets in code:** API keys via environment
2. **Agent isolation:** Each session has own context
3. **Tool restrictions:** Sub-agents can't spawn sub-agents
4. **Approval gates:** Public posts, spending require human OK
5. **Audit trail:** All activity logged in Convex

---

## Scaling Limits

Current design handles:
- **100 agents:** Staggered cron schedule
- **10K tasks:** Convex free tier limit
- **Real-time:** 1000 concurrent UI viewers

To scale beyond:
- Use Convex paid tier (larger limits)
- Shard by team/project
- Add caching layer (Redis)
- Batch notifications (reduce daemon polls)

---

## References

- [Convex Schema](https://docs.convex.dev/database/schemas)
- [OpenClaw Sessions](https://docs.openclaw.ai/tools/subagents)
- [Real-time Subscriptions](https://docs.convex.dev/functions/query-functions#subscriptions)
