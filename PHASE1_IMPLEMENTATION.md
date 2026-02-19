# Phase 1 Implementation: Agent Autonomy Foundation

**Scope:** 3 critical features to enable multi-agent coordination
**Timeline:** 1-2 sprints
**Impact:** Unlock 80% of missing autonomy capabilities

---

## Feature 1: Agent-to-Agent Messaging System

### Problem Statement

Currently, when Agent A blocks Agent B:
- No direct communication channel
- Agent B doesn't know why it's blocked
- Agent A can't provide context or status updates
- Humans must manually diagnose issues
- Multi-agent workflows require human choreography

**Example Failure:**
```
Agent A: Assigned task "Deploy to prod"
Agent B: Assigned task "Run E2E tests on new build"
  ↓
Agent A's task blocks Agent B's task (needs build artifacts)
  ↓
Agent B checks for work, finds task but it's "blocked"
  ↓
No notification, no message, Agent B just sits idle
  ↓
Human has to manually check: "Why is this blocked?"
```

### Solution Design

#### 1.1 Data Model

**New `agentMessages` table:**

```typescript
agentMessages: defineTable({
  // Identity
  businessId: convexVal.id("businesses"),
  fromAgentId: convexVal.id("agents"),
  toAgentId: convexVal.id("agents"),
  fromAgentName: convexVal.string(),
  toAgentName: convexVal.string(),

  // Message content
  type: convexVal.union(
    convexVal.literal("task_update"),      // Status update on related task
    convexVal.literal("help_request"),     // Need assistance
    convexVal.literal("blocker_resolved"), // Dependency cleared
    convexVal.literal("status_query"),     // What's your status?
    convexVal.literal("coordination"),     // General coordination
    convexVal.literal("handoff"),          // Task handoff
    convexVal.literal("alert")             // Something urgent
  ),

  subject: convexVal.string(),
  body: convexVal.string(),
  priority: convexVal.union(
    convexVal.literal("low"),
    convexVal.literal("normal"),
    convexVal.literal("high"),
    convexVal.literal("critical")
  ),

  // Context
  taskId: convexVal.optional(convexVal.id("tasks")),
  relatedTaskIds: convexVal.optional(convexVal.array(convexVal.id("tasks"))),

  // Message metadata
  data: convexVal.optional(convexVal.object({
    reason: convexVal.optional(convexVal.string()),
    expectedResolution: convexVal.optional(convexVal.string()),
    attachments: convexVal.optional(convexVal.array(convexVal.object({
      type: convexVal.string(),  // "analysis", "recommendation", "data"
      content: convexVal.string(),
      format: convexVal.string()  // "json", "text", "markdown"
    }))),
    metadata: convexVal.optional(convexVal.object({}))
  })),

  // Lifecycle
  read: convexVal.boolean(),
  readAt: convexVal.optional(convexVal.number()),
  acknowledged: convexVal.boolean(),
  acknowledgedAt: convexVal.optional(convexVal.number()),
  responseId: convexVal.optional(convexVal.id("agentMessages")),

  // Timestamps
  createdAt: convexVal.number(),
  expiresAt: convexVal.optional(convexVal.number()),  // Auto-cleanup old messages

  // Escalation
  escalatedIfNotAcknowledgedBy: convexVal.optional(convexVal.number()),
  escalationAction: convexVal.optional(convexVal.string())
})
  .index("by_recipient", ["toAgentId", "read"])
  .index("by_sender", ["fromAgentId", "createdAt"])
  .index("by_task", ["taskId"])
  .index("by_business", ["businessId"])
  .index("by_type", ["type", "priority"])
```

**New `agentMessageTemplates` table** (pre-defined message patterns):

```typescript
agentMessageTemplates: defineTable({
  businessId: convexVal.id("businesses"),
  name: convexVal.string(),  // "blocker_resolved", "help_needed"
  type: convexVal.string(),

  subjectTemplate: convexVal.string(),
  bodyTemplate: convexVal.string(),

  // Variables that can be interpolated: {taskTitle}, {agentName}, {reason}, etc.
  requiredVars: convexVal.array(convexVal.string()),
  optionalVars: convexVal.array(convexVal.string()),

  createdAt: convexVal.number(),
})
  .index("by_business", ["businessId"])
  .index("by_type", ["type"])
```

#### 1.2 Convex Module: `convex/agentMessages.ts`

```typescript
/**
 * Agent-to-Agent Messaging System
 * Enables direct communication between agents for coordination
 */

import { mutation, query, action } from "./_generated/server";
import { v as convexVal } from "convex/values";
import { api } from "./_generated/api";

/**
 * SEND MESSAGE - Agent A sends message to Agent B
 */
export const send = mutation({
  args: {
    businessId: convexVal.id("businesses"),
    fromAgentId: convexVal.id("agents"),
    toAgentId: convexVal.id("agents"),
    type: convexVal.string(),
    subject: convexVal.string(),
    body: convexVal.string(),
    priority: convexVal.optional(convexVal.string()),
    taskId: convexVal.optional(convexVal.id("tasks")),
    relatedTaskIds: convexVal.optional(convexVal.array(convexVal.id("tasks"))),
    data: convexVal.optional(convexVal.object({})),
    escalateIfNotAcknowledgedBy: convexVal.optional(convexVal.number()),
    escalationAction: convexVal.optional(convexVal.string()),
  },
  handler: async (ctx, args) => {
    const fromAgent = await ctx.db.get(args.fromAgentId);
    const toAgent = await ctx.db.get(args.toAgentId);

    if (!fromAgent || !toAgent) {
      throw new Error("Agent not found");
    }

    const messageId = await ctx.db.insert("agentMessages", {
      businessId: args.businessId,
      fromAgentId: args.fromAgentId,
      toAgentId: args.toAgentId,
      fromAgentName: fromAgent.name,
      toAgentName: toAgent.name,
      type: args.type,
      subject: args.subject,
      body: args.body,
      priority: args.priority || "normal",
      taskId: args.taskId,
      relatedTaskIds: args.relatedTaskIds,
      data: args.data,
      read: false,
      acknowledged: false,
      escalateIfNotAcknowledgedBy: args.escalateIfNotAcknowledgedBy,
      escalationAction: args.escalationAction,
      createdAt: Date.now(),
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Activity log
    await ctx.db.insert("activities", {
      businessId: args.businessId,
      type: "agent_message_sent",
      agentId: args.fromAgentId,
      agentName: fromAgent.name,
      message: `${fromAgent.name} sent message to ${toAgent.name}: "${args.subject}"`,
      metadata: {
        messageId,
        messageType: args.type,
        priority: args.priority,
      },
      createdAt: Date.now(),
    });

    return messageId;
  },
});

/**
 * GET INBOX - Agent queries their unread messages
 */
export const getInbox = query({
  args: {
    agentId: convexVal.id("agents"),
    filter: convexVal.optional(convexVal.object({
      unread: convexVal.optional(convexVal.boolean()),
      unacknowledged: convexVal.optional(convexVal.boolean()),
      type: convexVal.optional(convexVal.string()),
      priority: convexVal.optional(convexVal.string()),
      limit: convexVal.optional(convexVal.number()),
    })),
  },
  handler: async (ctx, args) => {
    let messages = await ctx.db
      .query("agentMessages")
      .withIndex("by_recipient", (q) => q.eq("toAgentId", args.agentId))
      .order("desc")
      .take(100);

    // Apply filters
    if (args.filter?.unread) {
      messages = messages.filter(m => !m.read);
    }
    if (args.filter?.unacknowledged) {
      messages = messages.filter(m => !m.acknowledged);
    }
    if (args.filter?.type) {
      messages = messages.filter(m => m.type === args.filter!.type);
    }
    if (args.filter?.priority) {
      messages = messages.filter(m => m.priority === args.filter!.priority);
    }

    const limit = args.filter?.limit || 20;
    return messages.slice(0, limit);
  },
});

/**
 * MARK AS READ
 */
export const markAsRead = mutation({
  args: {
    messageId: convexVal.id("agentMessages"),
    agentId: convexVal.id("agents"),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || message.toAgentId !== args.agentId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.messageId, {
      read: true,
      readAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * ACKNOWLEDGE - Agent acknowledges receipt and understanding
 */
export const acknowledge = mutation({
  args: {
    messageId: convexVal.id("agentMessages"),
    agentId: convexVal.id("agents"),
    response: convexVal.optional(convexVal.string()),
    actionTaken: convexVal.optional(convexVal.string()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || message.toAgentId !== args.agentId) {
      throw new Error("Unauthorized");
    }

    // If there's a response, create a reply message
    let replyId;
    if (args.response) {
      replyId = await ctx.db.insert("agentMessages", {
        businessId: message.businessId,
        fromAgentId: args.agentId,
        toAgentId: message.fromAgentId,
        fromAgentName: message.toAgentName,
        toAgentName: message.fromAgentName,
        type: "coordination",
        subject: `RE: ${message.subject}`,
        body: args.response,
        priority: "normal",
        responseId: args.messageId,
        read: false,
        acknowledged: false,
        createdAt: Date.now(),
      });
    }

    await ctx.db.patch(args.messageId, {
      acknowledged: true,
      acknowledgedAt: Date.now(),
      data: {
        ...message.data,
        actionTaken: args.actionTaken,
      },
    });

    return { success: true, replyId };
  },
});

/**
 * AUTO-ESCALATE - System escalates unacknowledged messages
 */
export const autoEscalate = action({
  args: {},
  handler: async (ctx) => {
    // Find messages that should be escalated
    const now = Date.now();
    const allMessages = await ctx.db
      .query("agentMessages")
      .filter(q =>
        q.and(
          q.not(q.field("acknowledged")),
          q.neq(q.field("escalateIfNotAcknowledgedBy"), null),
          q.lte(q.field("escalateIfNotAcknowledgedBy"), now)
        )
      )
      .collect();

    let escalatedCount = 0;
    for (const message of allMessages) {
      const task = message.taskId ? await ctx.db.get(message.taskId) : null;
      if (!task) continue;

      // Escalate the task
      await ctx.runMutation(api.tasks.escalate, {
        taskId: message.taskId,
        reason: message.escalationAction || `Message from ${message.fromAgentName} not acknowledged: ${message.subject}`,
        decidedBy: "system",
        businessId: message.businessId,
      });

      // Mark message as escalated
      await ctx.db.patch(message._id, {
        data: {
          ...message.data,
          escalated: true,
          escalatedAt: now,
        },
      });

      escalatedCount++;
    }

    return { escalatedCount, processedAt: now };
  },
});

/**
 * SEARCH MESSAGES
 */
export const search = query({
  args: {
    agentId: convexVal.id("agents"),
    query: convexVal.string(),
    limit: convexVal.optional(convexVal.number()),
  },
  handler: async (ctx, args) => {
    const allMessages = await ctx.db
      .query("agentMessages")
      .withIndex("by_recipient", (q) => q.eq("toAgentId", args.agentId))
      .collect();

    const searchTerm = args.query.toLowerCase();
    const results = allMessages.filter(m =>
      m.subject.toLowerCase().includes(searchTerm) ||
      m.body.toLowerCase().includes(searchTerm) ||
      m.fromAgentName.toLowerCase().includes(searchTerm)
    );

    return results.slice(0, args.limit || 20);
  },
});

/**
 * BATCH MARK AS READ
 */
export const markMultipleAsRead = mutation({
  args: {
    messageIds: convexVal.array(convexVal.id("agentMessages")),
    agentId: convexVal.id("agents"),
  },
  handler: async (ctx, args) => {
    let marked = 0;
    for (const messageId of args.messageIds) {
      const message = await ctx.db.get(messageId);
      if (message && message.toAgentId === args.agentId && !message.read) {
        await ctx.db.patch(messageId, {
          read: true,
          readAt: Date.now(),
        });
        marked++;
      }
    }
    return { marked };
  },
});

/**
 * GET MESSAGE STATISTICS
 */
export const getStats = query({
  args: {
    agentId: convexVal.id("agents"),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("agentMessages")
      .withIndex("by_recipient", (q) => q.eq("toAgentId", args.agentId))
      .collect();

    const unread = messages.filter(m => !m.read).length;
    const unacknowledged = messages.filter(m => !m.acknowledged).length;
    const byType = {};
    const byPriority = {};

    for (const msg of messages) {
      byType[msg.type] = (byType[msg.type] || 0) + 1;
      byPriority[msg.priority] = (byPriority[msg.priority] || 0) + 1;
    }

    return {
      total: messages.length,
      unread,
      unacknowledged,
      byType,
      byPriority,
      avgAcknowledgmentTime: calculateAvgAckTime(messages),
    };
  },
});

function calculateAvgAckTime(messages: any[]): number {
  const acknowledged = messages.filter(m => m.acknowledged && m.acknowledgedAt);
  if (acknowledged.length === 0) return 0;
  const totalTime = acknowledged.reduce((sum, m) => sum + (m.acknowledgedAt - m.createdAt), 0);
  return Math.round(totalTime / acknowledged.length / 1000); // in seconds
}
```

#### 1.3 API Routes

**`src/app/api/agents/{agentId}/messages/route.ts`:**

```typescript
/**
 * GET /api/agents/{agentId}/messages
 * Agent queries their inbox
 */
export async function GET(request: NextRequest, { params }: { params: { agentId: string } }) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const unread = searchParams.get("unread") === "true";
    const unacknowledged = searchParams.get("unacknowledged") === "true";
    const type = searchParams.get("type");
    const priority = searchParams.get("priority");
    const limit = parseInt(searchParams.get("limit") || "20");

    const agentId = params.agentId as Id<"agents">;

    const messages = await convex.query(api.agentMessages.getInbox, {
      agentId,
      filter: {
        unread: unread || undefined,
        unacknowledged: unacknowledged || undefined,
        type: type || undefined,
        priority: priority || undefined,
        limit,
      },
    });

    return NextResponse.json({
      success: true,
      messages,
      count: messages.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/{agentId}/messages
 * Agent sends message to another agent
 */
export async function POST(request: NextRequest, { params }: { params: { agentId: string } }) {
  try {
    const body = await request.json();
    const { businessId, toAgentId, type, subject, body: messageBody, priority, taskId, data } = body;

    const messageId = await convex.mutation(api.agentMessages.send, {
      businessId,
      fromAgentId: params.agentId as Id<"agents">,
      toAgentId,
      type,
      subject,
      body: messageBody,
      priority,
      taskId,
      data,
    });

    return NextResponse.json({
      success: true,
      messageId,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to send message" },
      { status: 500 }
    );
  }
}
```

**`src/app/api/agents/{agentId}/messages/{messageId}/acknowledge/route.ts`:**

```typescript
/**
 * POST /api/agents/{agentId}/messages/{messageId}/acknowledge
 * Agent acknowledges receipt of message
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string; messageId: string } }
) {
  try {
    const body = await request.json();
    const { response, actionTaken } = body;

    const result = await convex.mutation(api.agentMessages.acknowledge, {
      messageId: params.messageId as Id<"agentMessages">,
      agentId: params.agentId as Id<"agents">,
      response,
      actionTaken,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to acknowledge" },
      { status: 500 }
    );
  }
}
```

#### 1.4 Practical Usage Examples

**Example 1: Blocker Resolution Notification**

```typescript
// Agent A resolves a blocker and notifies Agent B
const blockingTask = await client.tasks.get("task_123");
const dependentAgent = "agent_b_id";

await client.agents.sendMessage(dependentAgent, {
  type: "blocker_resolved",
  subject: `Blocker resolved: "${blockingTask.title}"`,
  body: `The blocking task has been completed. Your dependent task "Run E2E tests" is now unblocked and ready to claim.`,
  priority: "high",
  taskId: blockingTask.id,
  data: {
    reason: "blocking_task_completed",
    expectedResolution: "Your task should now be in 'ready' status"
  }
});
```

**Example 2: Help Request**

```typescript
// Agent A stuck on task, requests help from specialist
await client.agents.sendMessage("specialist_agent_id", {
  type: "help_request",
  subject: "Need expertise on Kubernetes deployment",
  body: "I'm stuck on task #567 (Deploy app to K8s). Getting CrashLoopBackOff errors. Can you review my approach?",
  priority: "high",
  taskId: "task_567",
  data: {
    reason: "expertise_needed",
    errorLogs: "...",
    attachments: [{
      type: "analysis",
      content: JSON.stringify({ errors: [...] }),
      format: "json"
    }]
  }
});
```

**Example 3: Status Query**

```typescript
// Agent B queries Agent A about task status
await client.agents.sendMessage("agent_a_id", {
  type: "status_query",
  subject: "Status check on deployment task",
  body: "How's the deployment going? Any blockers I should know about?",
  priority: "normal",
  taskId: "task_456"
});
```

**Example 4: Automatic Escalation on No Response**

```typescript
// Send critical message with auto-escalation
const now = Date.now();
await client.agents.sendMessage("agent_x_id", {
  type: "alert",
  subject: "CRITICAL: Database connection pool exhausted",
  body: "Critical issue detected in production. Need immediate action.",
  priority: "critical",
  escalateIfNotAcknowledgedBy: now + (5 * 60 * 1000),  // 5 minutes
  escalationAction: "auto_escalate_to_lead"
});
```

**Example 5: Agent Inbox Check**

```typescript
// Agent wakes up, first thing: check messages
const inbox = await client.agents.getMessages(agentId, {
  unread: true,
  limit: 10
});

console.log(`${inbox.unread} unread messages`);
for (const msg of inbox.messages) {
  if (msg.priority === 'critical') {
    console.log(`⚠️  CRITICAL: ${msg.subject} from ${msg.fromAgentName}`);
    // Handle immediately
  }
}

// Mark as read
await client.agents.markMessagesAsRead(inbox.messages.map(m => m.id));
```

---

## Feature 2: SLO & Capacity Tracking System

### Problem Statement

Currently, when assigning work to an agent:
- No way to know if agent is overloaded
- No SLA/deadline visibility
- Can't make intelligent assignment decisions
- May violate SLOs by assigning overdue work

**Example Failure:**
```
Agent A: 2 tasks in progress (5 hours each = 10 hours of work)
  ↓
Human assigns Agent A another 5-hour task without checking capacity
  ↓
Agent A starts task but realizes it can't complete before SLO
  ↓
Task violates SLO, escalated, wasted effort
```

### Solution Design

#### 2.1 Data Model Extensions

**Extend `tasks` table:**

```typescript
tasks: defineTable({
  // ... existing fields ...

  // === NEW: SLO & Time Tracking ===
  slaTier: convexVal.optional(convexVal.union(
    convexVal.literal("critical"),    // 1 hour
    convexVal.literal("urgent"),      // 4 hours
    convexVal.literal("normal"),      // 24 hours
    convexVal.literal("backlog")      // no deadline
  )),

  sloMs: convexVal.optional(convexVal.number()),  // SLO in milliseconds
  sloBreachAt: convexVal.optional(convexVal.number()),  // timestamp when SLO breaks

  timeEstimate: convexVal.optional(convexVal.union(
    convexVal.literal("XS"),   // 0.5 hours
    convexVal.literal("S"),    // 2 hours
    convexVal.literal("M"),    // 4 hours
    convexVal.literal("L"),    // 8 hours
    convexVal.literal("XL")    // 16+ hours
  )),
  estimatedMinutes: convexVal.optional(convexVal.number()),

  // Track actual time
  actualMinutes: convexVal.optional(convexVal.number()),

  // Resource requirements
  resourceRequirements: convexVal.optional(convexVal.object({
    minMemoryMB: convexVal.optional(convexVal.number()),
    requiresGPU: convexVal.optional(convexVal.boolean()),
    requiresInternetAccess: convexVal.optional(convexVal.boolean()),
    requiredCapabilities: convexVal.optional(convexVal.array(convexVal.string())),
    maxConcurrentPerAgent: convexVal.optional(convexVal.number()),
  })),
})
```

**Extend `agents` table:**

```typescript
agents: defineTable({
  // ... existing fields ...

  // === NEW: Capacity & Constraints ===
  capacity: convexVal.optional(convexVal.object({
    maxConcurrentTasks: convexVal.number(),        // e.g., 3
    maxConcurrentMinutesPerDay: convexVal.number(), // e.g., 480 (8 hours)
    specializations: convexVal.array(convexVal.string()), // ["deployment", "testing"]
    constraints: convexVal.object({
      requiresInternetAccess: convexVal.boolean(),
      canRunGPUWorkloads: convexVal.boolean(),
      maxMemoryMB: convexVal.number(),
      preferAsync: convexVal.boolean(),  // avoid real-time interrupts
    }),
  })),

  // Track current utilization
  metrics: convexVal.optional(convexVal.object({
    currentActiveTasks: convexVal.number(),
    estimatedMinutesRemaining: convexVal.number(),
    utilizationPercent: convexVal.number(),  // 0-100
    lastUpdated: convexVal.number(),
  })),
})
```

**New `agentCapacitySchedule` table:**

```typescript
agentCapacitySchedule: defineTable({
  businessId: convexVal.id("businesses"),
  agentId: convexVal.id("agents"),

  // Daily schedule
  date: convexVal.string(),  // "2026-02-19" ISO format

  // Hourly breakdown
  hourlyCapacity: convexVal.array(convexVal.object({  // 24 slots
    hour: convexVal.number(),  // 0-23
    availableMinutes: convexVal.number(),
    reservedMinutes: convexVal.number(),
    taskIds: convexVal.array(convexVal.id("tasks")),
  })),

  totalAvailableMinutes: convexVal.number(),
  totalReservedMinutes: convexVal.number(),
  utilizationPercent: convexVal.number(),

  createdAt: convexVal.number(),
  updatedAt: convexVal.number(),
})
  .index("by_agent_date", ["agentId", "date"])
  .index("by_business", ["businessId"])
```

**New `sloBreaches` table** (audit trail):

```typescript
sloBreaches: defineTable({
  businessId: convexVal.id("businesses"),
  taskId: convexVal.id("tasks"),
  agentId: convexVal.optional(convexVal.id("agents")),

  sloTier: convexVal.string(),
  sloMs: convexVal.number(),

  breachType: convexVal.union(
    convexVal.literal("deadline_missed"),    // Task completed after SLO
    convexVal.literal("in_progress_timeout"), // Task stuck in progress
    convexVal.literal("blocked_too_long")    // Task blocked longer than SLO allows
  ),

  breachAt: convexVal.number(),  // When SLO was violated
  detectedAt: convexVal.number(), // When we detected it
  escalatedAt: convexVal.optional(convexVal.number()),
  escalatedTo: convexVal.optional(convexVal.string()),

  rootCause: convexVal.optional(convexVal.string()),
  preventionActions: convexVal.optional(convexVal.array(convexVal.string())),

  createdAt: convexVal.number(),
})
  .index("by_business", ["businessId"])
  .index("by_task", ["taskId"])
  .index("by_agent", ["agentId"])
  .index("by_breach_type", ["breachType"])
```

#### 2.2 Convex Module: `convex/capacity.ts`

```typescript
/**
 * Agent Capacity Management
 * Track capacity, SLOs, and intelligent assignment
 */

import { mutation, query, action } from "./_generated/server";
import { v as convexVal } from "convex/values";
import { api } from "./_generated/api";

/**
 * GET AGENT CAPACITY - Real-time capacity snapshot
 */
export const getAgentCapacity = query({
  args: {
    agentId: convexVal.id("agents"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");

    // Get all active tasks assigned to agent
    const activeTasks = await ctx.db
      .query("tasks")
      .withIndex("by_assignee", (q) => q.eq("assigneeIds", [args.agentId]))
      .filter(q => q.neq(q.field("status"), "done"))
      .collect();

    const inProgressTasks = activeTasks.filter(t => t.status === "in_progress");
    const readyTasks = activeTasks.filter(t => t.status === "ready");
    const blockedTasks = activeTasks.filter(t => t.status === "blocked");

    // Calculate utilization
    const capacity = agent.capacity || { maxConcurrentTasks: 3, maxConcurrentMinutesPerDay: 480 };
    const estimatedMinutesRemaining = inProgressTasks.reduce(
      (sum, t) => sum + (t.estimatedMinutes || 240),
      0
    );

    const utilizationPercent = Math.round(
      (estimatedMinutesRemaining / capacity.maxConcurrentMinutesPerDay) * 100
    );

    return {
      agentId: args.agentId,
      agentName: agent.name,

      // Capacity
      maxConcurrentTasks: capacity.maxConcurrentTasks,
      maxMinutesPerDay: capacity.maxConcurrentMinutesPerDay,

      // Current state
      currentActiveTasks: inProgressTasks.length,
      readyTasks: readyTasks.length,
      blockedTasks: blockedTasks.length,

      // Metrics
      estimatedMinutesRemaining,
      availableCapacityMinutes: Math.max(
        0,
        capacity.maxConcurrentMinutesPerDay - estimatedMinutesRemaining
      ),
      utilizationPercent,
      isOverloaded: inProgressTasks.length >= capacity.maxConcurrentTasks,
      canAcceptWork: utilizationPercent < 80 && inProgressTasks.length < capacity.maxConcurrentTasks,

      // Tasks
      inProgressTasks: inProgressTasks.map(t => ({
        id: t._id,
        title: t.title,
        estimatedMinutes: t.estimatedMinutes,
        priority: t.priority,
      })),
      readyTasks: readyTasks.map(t => ({
        id: t._id,
        title: t.title,
        priority: t.priority,
      })),

      // Constraints
      specializations: capacity.specializations || [],
      constraints: capacity.constraints,
    };
  },
});

/**
 * GET TASK SLO - Check if task meets SLO requirements
 */
export const getTaskSlo = query({
  args: {
    taskId: convexVal.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const now = Date.now();
    const createdAt = task.createdAt;
    const ageMs = now - createdAt;

    // Determine SLO based on tier
    const sloTiers = {
      critical: 3600000,     // 1 hour
      urgent: 14400000,      // 4 hours
      normal: 86400000,      // 24 hours
      backlog: null          // no deadline
    };

    const slaTier = task.slaTier || "normal";
    const sloMs = task.sloMs || sloTiers[slaTier as keyof typeof sloTiers];

    if (!sloMs) {
      return {
        taskId: args.taskId,
        title: task.title,
        slaTier,
        hasDeadline: false,
      };
    }

    const sloBreachAt = createdAt + sloMs;
    const timeUntilBreach = sloBreachAt - now;
    const breachPercentThreshold = 0.75; // Breach if > 75% time used

    return {
      taskId: args.taskId,
      title: task.title,
      slaTier,

      // SLO info
      sloMs,
      sloDeadline: sloBreachAt,
      createdAt,
      ageMs,

      // Status
      hasDeadline: true,
      isBreached: timeUntilBreach <= 0,
      isApproachingBreach: timeUntilBreach < (sloMs * (1 - breachPercentThreshold)),
      percentTimeUsed: Math.round((ageMs / sloMs) * 100),
      minutesUntilBreach: Math.round(timeUntilBreach / 60000),

      // Human-readable
      status: timeUntilBreach <= 0
        ? "BREACHED"
        : timeUntilBreach < 600000
          ? "CRITICAL"
          : "OK",
    };
  },
});

/**
 * FIND SUITABLE AGENTS - Intelligent assignment based on capacity & skills
 */
export const findSuitableAgents = query({
  args: {
    businessId: convexVal.id("businesses"),
    taskId: convexVal.id("tasks"),
    strategy: convexVal.optional(convexVal.union(
      convexVal.literal("fastest"),      // Least loaded agent
      convexVal.literal("best_fit"),     // Best skill match
      convexVal.literal("balanced")      // Balanced capacity & skills
    )),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    // Get all agents for business
    const allAgents = await ctx.db.query("agents").collect();

    const candidates = [];

    for (const agent of allAgents) {
      // Skip if agent doesn't meet constraints
      if (task.resourceRequirements) {
        const reqs = task.resourceRequirements;
        const constraints = agent.capacity?.constraints;

        if (reqs.requiresGPU && !constraints?.canRunGPUWorkloads) continue;
        if (reqs.requiresInternetAccess && !constraints?.requiresInternetAccess === false) continue;
        if (reqs.minMemoryMB && (constraints?.maxMemoryMB || 0) < reqs.minMemoryMB) continue;
      }

      // Get agent capacity
      const activeTasks = await ctx.db
        .query("tasks")
        .withIndex("by_assignee", (q) => q.eq("assigneeIds", [agent._id]))
        .filter(q => q.neq(q.field("status"), "done"))
        .collect();

      const capacity = agent.capacity || { maxConcurrentTasks: 3 };
      const utilizationPercent = (activeTasks.length / capacity.maxConcurrentTasks) * 100;

      // Calculate skill match score
      let skillScore = 100;
      if (task.resourceRequirements?.requiredCapabilities) {
        const agentCapabilities = agent.capacity?.specializations || [];
        const matchedSkills = task.resourceRequirements.requiredCapabilities.filter(
          req => agentCapabilities.includes(req)
        ).length;
        skillScore = (matchedSkills / task.resourceRequirements.requiredCapabilities.length) * 100;
      }

      candidates.push({
        agentId: agent._id,
        agentName: agent.name,
        role: agent.role,
        level: agent.level,

        // Capacity metrics
        currentTaskCount: activeTasks.length,
        maxConcurrent: capacity.maxConcurrentTasks,
        utilizationPercent: Math.round(utilizationPercent),
        canAcceptWork: activeTasks.length < capacity.maxConcurrentTasks,

        // Skill match
        skillScore: Math.round(skillScore),
        specializations: agent.capacity?.specializations || [],

        // Combined score (strategy-dependent)
        score: 0,
      });
    }

    // Apply strategy
    const strategy = args.strategy || "balanced";
    for (const candidate of candidates) {
      if (strategy === "fastest") {
        candidate.score = 100 - candidate.utilizationPercent;
      } else if (strategy === "best_fit") {
        candidate.score = candidate.skillScore;
      } else { // balanced
        candidate.score = (candidate.skillScore * 0.6) + ((100 - candidate.utilizationPercent) * 0.4);
      }
    }

    // Sort by score, filter by availability
    return candidates
      .filter(c => c.canAcceptWork)
      .sort((a, b) => b.score - a.score)
      .map((c, idx) => ({ ...c, rank: idx + 1 }))
      .slice(0, 5); // Top 5 candidates
  },
});

/**
 * CHECK SLO BREACH - Detect and escalate breaches
 */
export const checkAndEscalateSloBreaches = action({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find all non-done tasks
    const allTasks = await ctx.db
      .query("tasks")
      .filter(q => q.neq(q.field("status"), "done"))
      .collect();

    let breachCount = 0;
    const breaches = [];

    for (const task of allTasks) {
      if (!task.slaTier || !task.sloMs) continue;

      const sloBreachAt = task.createdAt + task.sloMs;

      // Check if breached
      if (now > sloBreachAt) {
        const existingBreach = await ctx.db
          .query("sloBreaches")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .first();

        if (!existingBreach) {
          // Record breach
          const breachId = await ctx.db.insert("sloBreaches", {
            businessId: task.businessId,
            taskId: task._id,
            agentId: task.assigneeIds?.[0],
            slaTier: task.slaTier,
            sloMs: task.sloMs,
            breachType: task.status === "blocked" ? "blocked_too_long" : "deadline_missed",
            breachAt: sloBreachAt,
            detectedAt: now,
            createdAt: now,
          });

          // Escalate task
          await ctx.runMutation(api.tasks.escalate, {
            taskId: task._id,
            reason: `SLO breach: ${task.slaTier} deadline exceeded`,
            decidedBy: "system_slo_monitor",
            businessId: task.businessId,
          });

          breaches.push({
            taskId: task._id,
            breachId,
            slaTier: task.slaTier,
          });

          breachCount++;
        }
      }
    }

    return { breachCount, breaches };
  },
});

/**
 * UPDATE AGENT CAPACITY (agent declares their capacity)
 */
export const setAgentCapacity = mutation({
  args: {
    agentId: convexVal.id("agents"),
    maxConcurrentTasks: convexVal.number(),
    maxMinutesPerDay: convexVal.number(),
    specializations: convexVal.optional(convexVal.array(convexVal.string())),
    constraints: convexVal.optional(convexVal.object({})),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");

    await ctx.db.patch(args.agentId, {
      capacity: {
        maxConcurrentTasks: args.maxConcurrentTasks,
        maxConcurrentMinutesPerDay: args.maxMinutesPerDay,
        specializations: args.specializations || [],
        constraints: args.constraints || {
          requiresInternetAccess: true,
          canRunGPUWorkloads: false,
          maxMemoryMB: 4096,
          preferAsync: true,
        },
      },
    });

    return { success: true };
  },
});

/**
 * RECOMMEND AGENT - Simple recommendation for a task
 */
export const recommendAgent = query({
  args: {
    businessId: convexVal.id("businesses"),
    taskId: convexVal.id("tasks"),
  },
  handler: async (ctx, args) => {
    const candidates = await ctx.runQuery(api.capacity.findSuitableAgents, {
      businessId: args.businessId,
      taskId: args.taskId,
      strategy: "balanced",
    });

    if (candidates.length === 0) {
      return {
        recommended: false,
        reason: "No agents available that meet task requirements",
      };
    }

    const top = candidates[0];
    return {
      recommended: true,
      agentId: top.agentId,
      agentName: top.agentName,
      reason: `${top.agentName} (${top.utilizationPercent}% utilized, ${top.skillScore}% skill match)`,
      allCandidates: candidates,
    };
  },
});
```

#### 2.3 API Routes

**`src/app/api/agents/{agentId}/capacity/route.ts`:**

```typescript
export async function GET(request: NextRequest, { params }: { params: { agentId: string } }) {
  try {
    const capacity = await convex.query(api.capacity.getAgentCapacity, {
      agentId: params.agentId as Id<"agents">,
    });

    return NextResponse.json({
      success: true,
      data: capacity,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get capacity" },
      { status: 500 }
    );
  }
}
```

**`src/app/api/tasks/{taskId}/slo/route.ts`:**

```typescript
export async function GET(request: NextRequest, { params }: { params: { taskId: string } }) {
  try {
    const slo = await convex.query(api.capacity.getTaskSlo, {
      taskId: params.taskId as Id<"tasks">,
    });

    return NextResponse.json({
      success: true,
      data: slo,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get SLO" },
      { status: 500 }
    );
  }
}
```

**`src/app/api/tasks/{taskId}/suitable-agents/route.ts`:**

```typescript
export async function GET(request: NextRequest, { params }: { params: { taskId: string } }) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const businessId = searchParams.get("businessId") as Id<"businesses">;
    const strategy = searchParams.get("strategy") as any;

    const agents = await convex.query(api.capacity.findSuitableAgents, {
      businessId,
      taskId: params.taskId as Id<"tasks">,
      strategy,
    });

    return NextResponse.json({
      success: true,
      candidates: agents,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to find agents" },
      { status: 500 }
    );
  }
}
```

#### 2.4 Usage Examples

**Example 1: Agent Checking Capacity Before Claiming Task**

```typescript
// Agent queries own capacity
const capacity = await client.agents.getCapacity(agentId);

if (capacity.canAcceptWork) {
  // Check if task fits
  const task = await client.tasks.get(taskId);
  const slo = await client.tasks.getSlo(taskId);

  if (capacity.availableCapacityMinutes > task.estimatedMinutes) {
    // Safe to claim
    await client.tasks.assign(taskId, { agentId });
  } else {
    // Would exceed capacity, escalate instead
    await client.messages.send(supervisorId, {
      type: "help_request",
      subject: "Cannot claim task - insufficient capacity",
      body: `Task would require ${task.estimatedMinutes}m but only have ${capacity.availableCapacityMinutes}m available`
    });
  }
}
```

**Example 2: Human Finding Best Agent for Task**

```typescript
// Find best agent before assigning
const candidates = await client.tasks.findSuitableAgents(taskId, {
  businessId,
  strategy: "balanced"  // Consider both capacity and skills
});

if (candidates.length > 0) {
  const best = candidates[0];
  console.log(`Assigning to ${best.agentName} (${best.utilizationPercent}% utilized, ${best.skillScore}% skill match)`);

  await client.tasks.assign(taskId, {
    agentIds: [best.agentId],
    reason: "Best fit based on capacity and specialization"
  });
}
```

**Example 3: System Monitoring SLO Breaches**

```typescript
// Scheduled job (every 5 minutes)
setInterval(async () => {
  const result = await client.admin.checkSloBreaches();

  if (result.breachCount > 0) {
    console.log(`${result.breachCount} SLO breaches detected and escalated`);

    // Notify humans
    await client.notifications.broadcast({
      type: "slo_breach",
      severity: "critical",
      count: result.breachCount
    });
  }
}, 5 * 60 * 1000);
```

**Example 4: Task with Resource Requirements**

```typescript
// Create GPU-intensive task
await client.tasks.create({
  title: "Train ML model",
  resourceRequirements: {
    requiresGPU: true,
    minMemoryMB: 8192,
    requiredCapabilities: ["machine_learning", "python", "pytorch"]
  },
  slaTier: "normal",
  estimatedHours: 12
});

// System will only assign to agents with:
// - GPU capability
// - 8GB+ memory
// - ML specialization
const suitable = await client.tasks.findSuitableAgents(taskId);
// Returns only specialized agents that can handle this
```

---

## Feature 3: Explicit Escalation Triggers & Rules

### Problem Statement

Currently, agent escalation is manual:
- Agent must decide when to escalate
- No clear criteria
- Tasks can get stuck without escalation
- No automation for common patterns

**Example Failure:**
```
Agent: Task stuck for 2 hours, no progress
  ↓
Agent doesn't know if it should escalate
  ↓
Waits 4 more hours, now SLO violated
  ↓
Finally escalates, but too late
```

### Solution Design

#### 3.1 Data Model

**New `escalationRules` table:**

```typescript
escalationRules: defineTable({
  businessId: convexVal.id("businesses"),
  name: convexVal.string(),
  description: convexVal.optional(convexVal.string()),

  // When to trigger
  triggers: convexVal.array(convexVal.object({
    type: convexVal.union(
      convexVal.literal("time_in_status"),     // Task in status too long
      convexVal.literal("attempts_exceeded"),  // Too many retries
      convexVal.literal("error_pattern"),      // Specific error repeating
      convexVal.literal("slo_approaching"),    // SLO 75% consumed
      convexVal.literal("blocker_duration"),   // Blocked for too long
      convexVal.literal("custom_condition")    // Custom logic
    ),

    // Trigger parameters
    status: convexVal.optional(convexVal.string()),       // For time_in_status
    durationMs: convexVal.optional(convexVal.number()),  // How long
    attempts: convexVal.optional(convexVal.number()),     // For attempts_exceeded
    errorType: convexVal.optional(convexVal.string()),   // For error_pattern
    errorThreshold: convexVal.optional(convexVal.number()), // How many errors
    condition: convexVal.optional(convexVal.string()),    // For custom
  })),

  // What to do when triggered
  actions: convexVal.array(convexVal.object({
    type: convexVal.union(
      convexVal.literal("escalate"),
      convexVal.literal("send_message"),
      convexVal.literal("reassign"),
      convexVal.literal("create_subtask"),
      convexVal.literal("execute_remediation"),
      convexVal.literal("notify_human")
    ),

    // Action parameters
    escalateTo: convexVal.optional(convexVal.string()),        // agent role or "lead"
    escalationReason: convexVal.optional(convexVal.string()),
    message: convexVal.optional(convexVal.string()),
    toAgentId: convexVal.optional(convexVal.id("agents")),
    subtaskTemplate: convexVal.optional(convexVal.object({})),
    remediationScript: convexVal.optional(convexVal.string()),
    notificationChannel: convexVal.optional(convexVal.string()), // "slack", "pagerduty", etc
  })),

  // Configuration
  enabled: convexVal.boolean(),
  priority: convexVal.number(),  // 0-100, higher = execute first
  cooldown: convexVal.optional(convexVal.number()),  // Min ms between triggers

  // Matching
  applicableToTaskTypes: convexVal.optional(convexVal.array(convexVal.string())),  // Match by tag
  applicableToStatuses: convexVal.optional(convexVal.array(convexVal.string())),
  applicableToPriorities: convexVal.optional(convexVal.array(convexVal.string())),

  createdAt: convexVal.number(),
  updatedAt: convexVal.number(),
})
  .index("by_business", ["businessId"])
  .index("by_enabled", ["enabled"])
  .index("by_priority", ["priority"])
```

**New `escalationHistory` table** (audit trail):

```typescript
escalationHistory: defineTable({
  businessId: convexVal.id("businesses"),
  taskId: convexVal.id("tasks"),
  ruleId: convexVal.id("escalationRules"),

  trigger: convexVal.object({
    type: convexVal.string(),
    reason: convexVal.string(),
    metadata: convexVal.optional(convexVal.object({})),
  }),

  actionsExecuted: convexVal.array(convexVal.object({
    type: convexVal.string(),
    status: convexVal.string(),  // "executed", "failed", "skipped"
    result: convexVal.optional(convexVal.string()),
    error: convexVal.optional(convexVal.string()),
  })),

  triggeredAt: convexVal.number(),
  createdAt: convexVal.number(),
})
  .index("by_business", ["businessId"])
  .index("by_task", ["taskId"])
  .index("by_rule", ["ruleId"])
```

#### 3.2 Convex Module: `convex/escalationRules.ts`

```typescript
/**
 * Escalation Rules System
 * Automatic escalation triggers based on task state
 */

import { mutation, query, action } from "./_generated/server";
import { v as convexVal } from "convex/values";
import { api } from "./_generated/api";

/**
 * CREATE RULE
 */
export const create = mutation({
  args: {
    businessId: convexVal.id("businesses"),
    name: convexVal.string(),
    triggers: convexVal.array(convexVal.object({})),
    actions: convexVal.array(convexVal.object({})),
    priority: convexVal.optional(convexVal.number()),
    enabled: convexVal.optional(convexVal.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("escalationRules", {
      businessId: args.businessId,
      name: args.name,
      triggers: args.triggers,
      actions: args.actions,
      priority: args.priority || 50,
      enabled: args.enabled !== false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * EVALUATE RULES FOR TASK - Check if any rules should trigger
 */
export const evaluateForTask = action({
  args: {
    taskId: convexVal.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    // Get all enabled rules for this business
    const rules = await ctx.db
      .query("escalationRules")
      .withIndex("by_business", (q) => q.eq("businessId", task.businessId))
      .filter(q => q.eq(q.field("enabled"), true))
      .collect();

    const triggeredRules = [];

    for (const rule of rules) {
      // Check if rule applies to this task
      if (rule.applicableToTaskTypes && !rule.applicableToTaskTypes.includes(task.tags?.[0] || "")) {
        continue;
      }
      if (rule.applicableToStatuses && !rule.applicableToStatuses.includes(task.status)) {
        continue;
      }
      if (rule.applicableToPriorities && !rule.applicableToPriorities.includes(task.priority)) {
        continue;
      }

      // Check triggers
      const triggered = checkTriggers(task, rule.triggers);

      if (triggered.match) {
        triggeredRules.push({
          rule,
          trigger: triggered,
        });
      }
    }

    // Sort by priority
    triggeredRules.sort((a, b) => (b.rule.priority || 0) - (a.rule.priority || 0));

    // Execute top rule
    if (triggeredRules.length > 0) {
      const match = triggeredRules[0];
      const result = await executeEscalation(ctx, task, match.rule, match.trigger);
      return result;
    }

    return { triggered: false };
  },
});

/**
 * AUTOMATED CHECK - Background job
 * Runs periodically to check all tasks for escalation
 */
export const runAutomatedCheck = action({
  args: {
    businessId: convexVal.id("businesses"),
  },
  handler: async (ctx, args) => {
    // Get all non-done tasks
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .filter(q => q.neq(q.field("status"), "done"))
      .collect();

    let escalatedCount = 0;
    const results = [];

    for (const task of tasks) {
      const result = await ctx.runAction(api.escalationRules.evaluateForTask, {
        taskId: task._id,
      });

      if (result.triggered) {
        escalatedCount++;
        results.push({
          taskId: task._id,
          rule: result.ruleName,
          action: result.action,
        });
      }
    }

    return { escalatedCount, results };
  },
});

/**
 * GET RULES
 */
export const getByBusiness = query({
  args: {
    businessId: convexVal.id("businesses"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("escalationRules")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();
  },
});

/**
 * UPDATE RULE
 */
export const update = mutation({
  args: {
    ruleId: convexVal.id("escalationRules"),
    updates: convexVal.object({}),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ruleId, {
      ...args.updates,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * DELETE RULE
 */
export const remove = mutation({
  args: {
    ruleId: convexVal.id("escalationRules"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.ruleId);
    return { success: true };
  },
});

// ============ INTERNAL HELPERS ============

function checkTriggers(task: any, triggers: any[]): { match: boolean; reason: string } {
  const now = Date.now();

  for (const trigger of triggers) {
    switch (trigger.type) {
      case "time_in_status": {
        if (task.status !== trigger.status) continue;
        const timeInStatus = now - (task.updatedAt || task.createdAt);
        if (timeInStatus > (trigger.durationMs || 3600000)) {
          return {
            match: true,
            reason: `Task in "${task.status}" for ${Math.round(timeInStatus / 60000)} minutes`,
          };
        }
        break;
      }

      case "blocker_duration": {
        if (task.status !== "blocked") continue;
        const timeBlocked = now - (task.updatedAt || task.createdAt);
        if (timeBlocked > (trigger.durationMs || 1800000)) {
          return {
            match: true,
            reason: `Task blocked for ${Math.round(timeBlocked / 60000)} minutes`,
          };
        }
        break;
      }

      case "slo_approaching": {
        if (!task.sloMs) continue;
        const sloBreachAt = task.createdAt + task.sloMs;
        const timeUntilBreach = sloBreachAt - now;
        const breachPercentThreshold = 0.25; // Trigger if 75% consumed

        if (timeUntilBreach < (task.sloMs * breachPercentThreshold)) {
          return {
            match: true,
            reason: `SLO approaching - ${Math.round(timeUntilBreach / 60000)}m remaining`,
          };
        }
        break;
      }

      // Add more trigger types as needed...
    }
  }

  return { match: false, reason: "" };
}

async function executeEscalation(ctx: any, task: any, rule: any, trigger: any) {
  const escalationId = await ctx.db.insert("escalationHistory", {
    businessId: task.businessId,
    taskId: task._id,
    ruleId: rule._id,
    trigger: {
      type: trigger.type,
      reason: trigger.reason,
    },
    actionsExecuted: [],
    triggeredAt: Date.now(),
    createdAt: Date.now(),
  });

  const results = [];

  for (const action of rule.actions) {
    try {
      let result;

      if (action.type === "escalate") {
        result = await ctx.runMutation(api.tasks.escalate, {
          taskId: task._id,
          reason: action.escalationReason || rule.name,
          decidedBy: "escalation_rule",
          businessId: task.businessId,
        });
      } else if (action.type === "send_message") {
        // Send message to agent
        const agent = task.assigneeIds?.[0];
        if (agent) {
          result = await ctx.runMutation(api.agentMessages.send, {
            businessId: task.businessId,
            fromAgentId: "system",
            toAgentId: agent,
            type: "alert",
            subject: rule.name,
            body: action.message || `Escalation rule triggered: ${rule.name}`,
            priority: "high",
            taskId: task._id,
          });
        }
      }

      results.push({
        actionType: action.type,
        status: "executed",
        result,
      });
    } catch (error) {
      results.push({
        actionType: action.type,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Update escalation history
  await ctx.db.patch(escalationId, {
    actionsExecuted: results,
  });

  return {
    triggered: true,
    ruleName: rule.name,
    escalationId,
    actionsExecuted: results.length,
  };
}
```

#### 3.3 Pre-defined Rule Templates

```typescript
/**
 * Default escalation rules to seed
 */
const DEFAULT_ESCALATION_RULES = [
  {
    name: "Task stuck in progress",
    description: "Escalate if task in progress for >2 hours",
    triggers: [
      {
        type: "time_in_status",
        status: "in_progress",
        durationMs: 7200000,  // 2 hours
      },
    ],
    actions: [
      {
        type: "send_message",
        message: "Task has been in progress for 2+ hours. Do you need help or should this be escalated?",
      },
      {
        type: "escalate",
        escalationReason: "Task in progress for > 2 hours",
      },
    ],
    priority: 80,
    enabled: true,
  },

  {
    name: "Task blocked too long",
    description: "Escalate if task blocked for >30 minutes",
    triggers: [
      {
        type: "blocker_duration",
        durationMs: 1800000,  // 30 minutes
      },
    ],
    actions: [
      {
        type: "send_message",
        message: "Your task has been blocked for 30+ minutes. Let's resolve the dependency.",
      },
      {
        type: "escalate",
        escalationReason: "Blocker unresolved for 30+ minutes",
      },
    ],
    priority: 85,
    enabled: true,
  },

  {
    name: "SLO approaching",
    description: "Alert when SLO 75% consumed",
    triggers: [
      {
        type: "slo_approaching",
      },
    ],
    actions: [
      {
        type: "send_message",
        message: "⚠️  SLO approaching! You have limited time to complete this task.",
      },
    ],
    priority: 90,
    enabled: true,
  },

  {
    name: "P0 task in review for too long",
    description: "Escalate P0 tasks in review > 1 hour",
    triggers: [
      {
        type: "time_in_status",
        status: "review",
        durationMs: 3600000,  // 1 hour
      },
    ],
    applicableToPriorities: ["P0"],
    actions: [
      {
        type: "escalate",
        escalationReason: "Critical task stuck in review",
      },
    ],
    priority: 95,
    enabled: true,
  },
];
```

#### 3.4 Usage Examples

**Example 1: Set up escalation rule**

```typescript
// Create rule: escalate if task stuck in progress > 90 minutes
await client.escalation.createRule({
  businessId,
  name: "Long-running tasks",
  triggers: [
    {
      type: "time_in_status",
      status: "in_progress",
      durationMs: 5400000,  // 90 minutes
    },
  ],
  actions: [
    {
      type: "send_message",
      message: "Task has been in progress for 90 minutes. Need assistance or should escalate?"
    },
    {
      type: "escalate",
      escalationReason: "Task exceeded 90 minute threshold"
    }
  ],
  priority: 80,
  enabled: true
});
```

**Example 2: System background job**

```typescript
// Every 5 minutes, check all tasks
setInterval(async () => {
  const result = await client.escalation.runAutomatedCheck(businessId);
  console.log(`Escalation check: ${result.escalatedCount} tasks triggered rules`);
}, 5 * 60 * 1000);
```

**Example 3: Manual evaluation**

```typescript
// After task change, check if escalation needed
const result = await client.escalation.evaluateForTask(taskId);
if (result.triggered) {
  console.log(`Rule "${result.ruleName}" triggered, action taken: ${result.action}`);
}
```

---

## Summary: Phase 1 Implementation

| Feature | Complexity | Effort | Impact | Dependencies |
|---------|-----------|--------|--------|---|
| **Agent Messaging** | Medium | 2 sprints | High | None |
| **SLO & Capacity** | High | 2-3 sprints | High | Task updates |
| **Escalation Rules** | Medium | 1-2 sprints | High | Messaging, Capacity |

**Total Effort:** ~6-7 sprints (2-3 months)
**Team:** 2-3 engineers

**Once Complete:**
- Multi-agent workflows become possible
- Work stops getting stuck
- Agents can coordinate autonomously
- System prevents SLO violations
- Foundation for Phase 2 (learning/optimization)

---

## Next Steps

1. **Create detailed tests** for each feature (TDD)
2. **Prototype Agent Messaging** first (no dependencies)
3. **Add SLO tracking** to tasks table
4. **Wire escalation rules** into task lifecycle
5. **Integrate into agent wake workflow**
6. **Load test** with multi-agent simulation
7. **Deploy with monitoring**

