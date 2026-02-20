import { defineSchema, defineTable } from "convex/server";
import { v as convexVal } from "convex/values";

/**
 * Mission Control Schema - Production Architecture
 * Real-time agent orchestration with full audit trail
 */

export default defineSchema({
  /**
   * BUSINESSES - Multi-tenant Support
   * 2-5 businesses sharing a single Mission Control instance
   */
  businesses: defineTable({
    name: convexVal.string(),
    slug: convexVal.string(),                      // URL-safe unique identifier
    color: convexVal.optional(convexVal.string()), // Hex color for UI
    emoji: convexVal.optional(convexVal.string()), // Business emoji/icon
    description: convexVal.optional(convexVal.string()),
    missionStatement: convexVal.optional(convexVal.string()), // Business purpose/problem being solved
    isDefault: convexVal.boolean(),                // Exactly one default at all times
    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_default", ["isDefault"]),

  /**
   * AGENTS - The Squad
   * 10 specialized agents with distinct roles (shared across all businesses)
   */
  agents: defineTable({
    name: convexVal.string(),              // "Jarvis"
    role: convexVal.string(),              // "Squad Lead"
    status: convexVal.union(
      convexVal.literal("idle"),
      convexVal.literal("active"),
      convexVal.literal("blocked")
    ),
    currentTaskId: convexVal.optional(convexVal.id("tasks")),
    sessionKey: convexVal.string(),        // "agent:main:main"
    lastHeartbeat: convexVal.number(),
    apiKey: convexVal.optional(convexVal.string()),     // API key for HTTP auth layer
    level: convexVal.union(
      convexVal.literal("lead"),
      convexVal.literal("specialist"),
      convexVal.literal("intern")
    ),
    personality: convexVal.optional(convexVal.string()),
    capabilities: convexVal.optional(convexVal.array(convexVal.string())),
    model: convexVal.optional(convexVal.string()),
    workspacePath: convexVal.string(),  // Agent's workspace directory path (required)
    metadata: convexVal.optional(convexVal.object({
      totalTasksCompleted: convexVal.optional(convexVal.number()),
      avgTaskDuration: convexVal.optional(convexVal.number()),
      lastActiveAt: convexVal.optional(convexVal.number()),
    })),
    // API Key Rotation tracking
    lastKeyRotationAt: convexVal.optional(convexVal.number()),   // Timestamp of last rotation
    keyRotationCount: convexVal.optional(convexVal.number()),    // Total rotations (for audit)
    previousApiKey: convexVal.optional(convexVal.string()),      // Old key during grace period
    previousKeyExpiresAt: convexVal.optional(convexVal.number()), // When old key becomes invalid
  })
    .index("by_name", ["name"])
    .index("by_status", ["status"])
    .index("by_session_key", ["sessionKey"])
    .index("by_current_task", ["currentTaskId"])
    .index("by_api_key", ["apiKey"]),

  /**
   * EPICS - Large Initiatives
   * Group tasks into strategic objectives (business-scoped)
   */
  epics: defineTable({
    // === BUSINESS SCOPING ===
    businessId: convexVal.id("businesses"),  // REQUIRED: which business this epic belongs to

    title: convexVal.string(),
    description: convexVal.string(),
    status: convexVal.union(
      convexVal.literal("planning"),
      convexVal.literal("active"),
      convexVal.literal("completed")
    ),
    taskIds: convexVal.array(convexVal.id("tasks")),
    ownerId: convexVal.optional(convexVal.id("agents")),
    progress: convexVal.number(),          // 0-100 calculated
    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),
    completedAt: convexVal.optional(convexVal.number()),
  })
    .index("by_business", ["businessId"])
    .index("by_status", ["status"])
    .index("by_owner", ["ownerId"])
    .index("by_created_at", ["createdAt"]),

  /**
   * TASKS - The Work Queue
   * Kanban-style task management with hierarchy (business-scoped)
   */
  tasks: defineTable({
    // === BUSINESS SCOPING ===
    businessId: convexVal.id("businesses"),  // REQUIRED: which business this task belongs to

    title: convexVal.string(),
    description: convexVal.string(),
    status: convexVal.union(
      convexVal.literal("backlog"),
      convexVal.literal("ready"),
      convexVal.literal("in_progress"),
      convexVal.literal("review"),
      convexVal.literal("blocked"),
      convexVal.literal("done")
    ),
    priority: convexVal.union(
      convexVal.literal("P0"),
      convexVal.literal("P1"),
      convexVal.literal("P2"),
      convexVal.literal("P3")
    ),

    // Hierarchy
    epicId: convexVal.id("epics"),  // REQUIRED: all tasks must belong to an epic
    parentId: convexVal.optional(convexVal.id("tasks")),
    subtaskIds: convexVal.array(convexVal.id("tasks")),
    
    // Assignment
    ownerId: convexVal.string(),           // agent ID or "user"
    assigneeIds: convexVal.array(convexVal.id("agents")),
    
    // Estimation
    estimatedHours: convexVal.optional(convexVal.number()),
    actualHours: convexVal.optional(convexVal.number()),
    timeEstimate: convexVal.optional(convexVal.union(
      convexVal.literal("XS"),
      convexVal.literal("S"),
      convexVal.literal("M"),
      convexVal.literal("L"),
      convexVal.literal("XL")
    )),
    dueDate: convexVal.optional(convexVal.number()),
    
    // Dependencies
    blockedBy: convexVal.array(convexVal.id("tasks")),
    blocks: convexVal.array(convexVal.id("tasks")),
    
    // Tracking
    createdBy: convexVal.string(),         // agent ID or "user"
    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),
    startedAt: convexVal.optional(convexVal.number()),
    completedAt: convexVal.optional(convexVal.number()),
    
    // Metadata
    tags: convexVal.array(convexVal.string()),
    receipts: convexVal.array(convexVal.string()), // commit hashes, file paths
    
    // === NEW: Goal Integration ===
    goalIds: convexVal.optional(convexVal.array(convexVal.id("goals"))),
    impact: convexVal.optional(convexVal.union(
      convexVal.literal("P0"),
      convexVal.literal("P1"),
      convexVal.literal("P2"),
      convexVal.literal("P3")
    )),
    
    // === NEW: AI Generation Metadata ===
    generatedBy: convexVal.optional(convexVal.string()),  // Agent that created task
    generationReason: convexVal.optional(convexVal.string()), // Why this task was created
    relatedMemoryKeys: convexVal.optional(convexVal.array(convexVal.string())), // MEMORY.md sections
    
    // === NEW: Execution Tracking ===
    timeTracked: convexVal.optional(convexVal.number()),  // Actual hours spent
    completionNotes: convexVal.optional(convexVal.string()),

    // === NEW: Ticket Number ===
    ticketNumber: convexVal.optional(convexVal.string()),  // e.g. "MC-001" — human-readable ID for API

    // === NEW: Definition of Done Checklist ===
    doneChecklist: convexVal.optional(convexVal.array(convexVal.object({
      id: convexVal.string(),                             // UUID for item
      text: convexVal.string(),                           // Checklist item description
      completed: convexVal.boolean(),                     // Is item done?
      completedAt: convexVal.optional(convexVal.number()), // Timestamp when completed
      completedBy: convexVal.optional(convexVal.string()), // Agent/user who completed it
    }))),
  })
    .index("by_business", ["businessId"])
    .index("by_business_status", ["businessId", "status"])
    .index("by_status", ["status"])
    .index("by_epic", ["epicId"])
    .index("by_parent", ["parentId"])
    .index("by_assignee", ["assigneeIds"])
    .index("by_owner", ["ownerId"])
    .index("by_created_at", ["createdAt"])
    .index("by_priority", ["priority"])
    .index("by_due_date", ["dueDate"])
    .index("by_updated_at", ["updatedAt"]),

  /**
   * MESSAGES - Threaded Discussions
   * Comments on tasks with @mentions and threading (business-scoped via taskId)
   */
  messages: defineTable({
    // === BUSINESS SCOPING ===
    businessId: convexVal.id("businesses"),  // REQUIRED: scoped via taskId's business

    taskId: convexVal.id("tasks"),
    fromId: convexVal.string(),            // agent ID or "user"
    fromName: convexVal.string(),          // display name (denormalized)
    fromRole: convexVal.optional(convexVal.string()), // agent role
    content: convexVal.string(),

    // Threading
    parentId: convexVal.optional(convexVal.id("messages")),
    replyIds: convexVal.array(convexVal.id("messages")),

    // @mentions
    mentions: convexVal.array(convexVal.id("agents")),

    // Attachments
    attachments: convexVal.optional(convexVal.array(convexVal.id("documents"))),

    // System messages
    isSystem: convexVal.optional(convexVal.boolean()),
    systemType: convexVal.optional(convexVal.union(
      convexVal.literal("status_change"),
      convexVal.literal("assignment"),
      convexVal.literal("dependency_added"),
      convexVal.literal("blocker_added"),
      convexVal.literal("help_request")
    )),

    createdAt: convexVal.number(),
    editedAt: convexVal.optional(convexVal.number()),
  })
    .index("by_business", ["businessId"])
    .index("by_task", ["taskId"])
    .index("by_parent", ["parentId"])
    .index("by_from", ["fromId"])
    .index("by_created_at", ["createdAt"]),

  /**
   * ACTIVITIES - The Feed (Audit Log)
   * Real-time stream with full denormalization (business-scoped but globally viewable)
   */
  activities: defineTable({
    // === BUSINESS SCOPING ===
    businessId: convexVal.id("businesses"),  // REQUIRED: which business this activity belongs to

    type: convexVal.union(
      convexVal.literal("task_created"),
      convexVal.literal("task_updated"),
      convexVal.literal("task_completed"),
      convexVal.literal("task_blocked"),
      convexVal.literal("task_assigned"),
      convexVal.literal("agent_claimed"),
      convexVal.literal("agent_status_changed"),
      convexVal.literal("comment_added"),
      convexVal.literal("mention"),
      convexVal.literal("epic_created"),
      convexVal.literal("epic_completed"),
      convexVal.literal("dependency_added"),
      convexVal.literal("dependency_removed"),
      convexVal.literal("tags_updated"),
      convexVal.literal("tasks_queried")
    ),

    // Actor (denormalized for speed)
    agentId: convexVal.string(),
    agentName: convexVal.string(),
    agentRole: convexVal.optional(convexVal.string()),

    // Target
    taskId: convexVal.optional(convexVal.id("tasks")),
    taskTitle: convexVal.optional(convexVal.string()),
    ticketNumber: convexVal.optional(convexVal.string()),  // e.g. "MC-001" for human-readable ID
    epicId: convexVal.optional(convexVal.id("epics")),
    epicTitle: convexVal.optional(convexVal.string()),

    // Change tracking
    message: convexVal.string(),
    oldValue: convexVal.optional(convexVal.any()),
    newValue: convexVal.optional(convexVal.any()),

    createdAt: convexVal.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_business_created_at", ["businessId", "createdAt"])
    .index("by_created_at", ["createdAt"])
    .index("by_agent", ["agentId"])
    .index("by_task", ["taskId"])
    .index("by_type", ["type"])
    .index("by_epic", ["epicId"]),

  /**
   * NOTIFICATIONS - @Mentions & Alerts
   * Real-time alerts with delivery tracking
   */
  notifications: defineTable({
    recipientId: convexVal.id("agents"),   // who gets notified
    type: convexVal.union(
      convexVal.literal("mention"),
      convexVal.literal("assignment"),
      convexVal.literal("status_change"),
      convexVal.literal("block"),
      convexVal.literal("dependency_unblocked"),
      convexVal.literal("help_request")
    ),
    
    content: convexVal.string(),
    
    // Source (denormalized)
    fromId: convexVal.string(),
    fromName: convexVal.string(),
    
    // Context
    taskId: convexVal.optional(convexVal.id("tasks")),
    taskTitle: convexVal.optional(convexVal.string()),
    messageId: convexVal.optional(convexVal.id("messages")),
    
    // Delivery state
    read: convexVal.boolean(),
    readAt: convexVal.optional(convexVal.number()),
    clicked: convexVal.optional(convexVal.boolean()),
    clickedAt: convexVal.optional(convexVal.number()),
    
    // Expiry
    expiresAt: convexVal.optional(convexVal.number()),
    
    createdAt: convexVal.number(),
  })
    .index("by_recipient", ["recipientId"])
    .index("by_read", ["recipientId", "read"])
    .index("by_created_at", ["createdAt"])
    .index("by_task", ["taskId"]),

  /**
   * THREAD_SUBSCRIPTIONS - Auto-Notify
   * Agents auto-subscribed to relevant threads (business-scoped via taskId)
   */
  threadSubscriptions: defineTable({
    // === BUSINESS SCOPING ===
    businessId: convexVal.id("businesses"),  // REQUIRED: scoped via taskId's business

    agentId: convexVal.id("agents"),
    taskId: convexVal.id("tasks"),
    level: convexVal.union(convexVal.literal("all"), convexVal.literal("mentions_only")),
    createdAt: convexVal.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_agent_task", ["agentId", "taskId"])
    .index("by_task", ["taskId"])
    .index("by_agent", ["agentId"]),

  /**
   * DOCUMENTS - Deliverables
   * Research, protocols, specs, drafts (business-scoped)
   */
  documents: defineTable({
    // === BUSINESS SCOPING ===
    businessId: convexVal.id("businesses"),  // REQUIRED: which business this document belongs to

    title: convexVal.string(),
    content: convexVal.string(),
    type: convexVal.union(
      convexVal.literal("deliverable"),
      convexVal.literal("research"),
      convexVal.literal("protocol"),
      convexVal.literal("spec"),
      convexVal.literal("draft"),
      convexVal.literal("receipt")
    ),
    taskId: convexVal.optional(convexVal.id("tasks")),
    epicId: convexVal.optional(convexVal.id("epics")),
    createdBy: convexVal.string(),
    createdByName: convexVal.string(),
    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),
    version: convexVal.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_task", ["taskId"])
    .index("by_epic", ["epicId"])
    .index("by_type", ["type"])
    .index("by_created_at", ["createdAt"]),

  /**
   * AGENT_METRICS - Performance Tracking
   * Aggregated agent performance data
   */
  agentMetrics: defineTable({
    agentId: convexVal.id("agents"),
    period: convexVal.string(),          // "2024-01" for monthly
    
    // Task metrics
    tasksCreated: convexVal.number(),
    tasksCompleted: convexVal.number(),
    tasksBlocked: convexVal.number(),
    avgCompletionTime: convexVal.number(), // hours
    
    // Collaboration
    commentsMade: convexVal.number(),
    mentionsSent: convexVal.number(),
    mentionsReceived: convexVal.number(),
    
    // Engagement
    sessionsCompleted: convexVal.number(),
    totalSessionHours: convexVal.number(),
    
    updatedAt: convexVal.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_period", ["period"]),

  /**
   * WAKE_REQUESTS - Agent Wake Queue
   * Queue for waking agents via notification daemon
   */
  wakeRequests: defineTable({
    agentId: convexVal.id("agents"),
    agentName: convexVal.string(),
    agentSessionKey: convexVal.string(),
    requestedBy: convexVal.string(),    // who requested the wake
    priority: convexVal.union(convexVal.literal("normal"), convexVal.literal("urgent")),
    status: convexVal.union(convexVal.literal("pending"), convexVal.literal("completed"), convexVal.literal("failed")),
    error: convexVal.optional(convexVal.string()),
    createdAt: convexVal.number(),
    expiresAt: convexVal.number(),      // DM-04: TTL for cleanup
    processedAt: convexVal.optional(convexVal.number()),
  })
    .index("by_status", ["status"])
    .index("by_agent", ["agentId"]),

  /**
   * GOALS - Long-term Objectives
   * AI-native goal tracking with memory integration (business-scoped)
   */
  goals: defineTable({
    // === BUSINESS SCOPING ===
    businessId: convexVal.id("businesses"),  // REQUIRED: which business this goal belongs to

    title: convexVal.string(),
    description: convexVal.string(),
    category: convexVal.union(
      convexVal.literal("business"),
      convexVal.literal("personal"),
      convexVal.literal("learning"),
      convexVal.literal("health")
    ),
    status: convexVal.union(
      convexVal.literal("active"),
      convexVal.literal("paused"),
      convexVal.literal("completed"),
      convexVal.literal("archived")
    ),

    // Hierarchy
    parentGoalId: convexVal.optional(convexVal.id("goals")),
    childGoalIds: convexVal.array(convexVal.id("goals")),

    // Progress
    progress: convexVal.number(),          // 0-100% (calculated from tasks)
    deadline: convexVal.optional(convexVal.number()),

    // Strategy
    keyResults: convexVal.optional(convexVal.array(convexVal.string())),  // OKR-style measures
    relatedTaskIds: convexVal.array(convexVal.id("tasks")),
    relatedMemoryRefs: convexVal.array(convexVal.string()),       // Paths in MEMORY.md

    // Metadata
    owner: convexVal.string(),            // "user" or agentId
    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),
    completedAt: convexVal.optional(convexVal.number()),
  })
    .index("by_business", ["businessId"])
    .index("by_status", ["status"])
    .index("by_owner", ["owner"])
    .index("by_created_at", ["createdAt"])
    .index("by_parent", ["parentGoalId"]),

  /**
   * CALENDAR_EVENTS - Merged Timeline
   * Human calendar + AI-scheduled tasks in one view
   */
  calendarEvents: defineTable({
    title: convexVal.string(),
    description: convexVal.optional(convexVal.string()),
    
    // Timing
    startTime: convexVal.number(),        // Epoch ms
    endTime: convexVal.number(),
    timezone: convexVal.string(),         // "Europe/London"
    recurring: convexVal.optional(convexVal.object({
      rule: convexVal.string(),           // RFC 5545 RRULE
      exceptions: convexVal.optional(convexVal.array(convexVal.number())),
    })),
    
    // Type
    type: convexVal.union(
      convexVal.literal("human"),         // Manually created/synced
      convexVal.literal("ai_task"),       // Task scheduled by AI
      convexVal.literal("ai_workflow"),   // Recurring AI workflow
      convexVal.literal("bot_generated")  // Generated by autonomous system
    ),
    
    // AI-specific
    taskId: convexVal.optional(convexVal.id("tasks")),
    generatedBy: convexVal.optional(convexVal.string()),  // Agent name
    executedAt: convexVal.optional(convexVal.number()),   // When task actually ran
    
    // Links
    goalIds: convexVal.optional(convexVal.array(convexVal.id("goals"))),

    // Display
    color: convexVal.optional(convexVal.string()),  // hex or named color
    priority: convexVal.optional(convexVal.number()),
    
    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),
  })
    .index("by_start_time", ["startTime"])
    .index("by_type", ["type"])
    .index("by_task", ["taskId"])
    .index("by_created_at", ["createdAt"]),

  /**
   * MEMORY_INDEX - Linkage between Entities & Memory
   * Semantic index of memory files + entity relationships
   */
  memoryIndex: defineTable({
    // What
    entityType: convexVal.union(
      convexVal.literal("goal"),
      convexVal.literal("task"),
      convexVal.literal("event"),
      convexVal.literal("note")
    ),
    entityId: convexVal.string(),         // Goal/Task/Event ID
    
    // Link to memory
    memoryPath: convexVal.string(),       // "MEMORY.md" or "memory/Projects/YouTube.md"
    memoryLineRange: convexVal.optional(convexVal.object({
      from: convexVal.number(),
      to: convexVal.number(),
    })),
    
    // Semantic metadata
    keywords: convexVal.array(convexVal.string()),
    relatedMemoryPaths: convexVal.array(convexVal.string()),
    
    lastSynced: convexVal.number(),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_memory_path", ["memoryPath"])
    .index("by_last_synced", ["lastSynced"]),

  /**
   * STRATEGIC_REPORTS - Weekly Analysis
   * Generated reports on goal progress + recommendations (business-scoped)
   */
  strategicReports: defineTable({
    // === BUSINESS SCOPING ===
    businessId: convexVal.id("businesses"),  // REQUIRED: which business this report is for

    week: convexVal.number(),             // ISO week number
    year: convexVal.number(),

    // Analysis
    goalsReview: convexVal.object({
      activeGoals: convexVal.number(),
      completedThisWeek: convexVal.array(convexVal.id("goals")),
      blockedGoals: convexVal.array(convexVal.id("goals")),
      acceleratingGoals: convexVal.array(convexVal.id("goals")),
    }),

    taskMetrics: convexVal.object({
      tasksGenerated: convexVal.number(),
      tasksCompleted: convexVal.number(),
      avgCompletionRate: convexVal.number(),  // percentage
      avgTimePerTask: convexVal.number(),     // hours
      blockedBy: convexVal.array(convexVal.string()), // Goal titles
    }),

    insights: convexVal.array(convexVal.string()),
    recommendations: convexVal.array(convexVal.string()),

    createdAt: convexVal.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_business_week", ["businessId", "year", "week"])
    .index("by_week", ["year", "week"])
    .index("by_created_at", ["createdAt"]),

  /**
   * SETTINGS - Configuration
   * Split between global (no businessId) and business-scoped (with businessId)
   * Global keys: theme, taskCounterFormat, features
   * Business keys: githubOrg, githubRepo, ticketPrefix, taskCounter
   */
  settings: defineTable({
    key: convexVal.string(),               // e.g., "theme", "githubRepo", "taskCounter"
    value: convexVal.string(),             // JSON-encoded value
    businessId: convexVal.optional(convexVal.id("businesses")), // null=global, set=business-scoped
    updatedAt: convexVal.number(),
  })
    .index("by_key", ["key"])
    .index("by_business_key", ["businessId", "key"]),

  /**
   * EXECUTION_LOG - Task Execution History
   * Track when tasks run, outcomes, time spent (business-scoped via taskId)
   */
  executionLog: defineTable({
    // === BUSINESS SCOPING ===
    businessId: convexVal.id("businesses"),  // REQUIRED: scoped via taskId's business

    taskId: convexVal.id("tasks"),
    agentId: convexVal.optional(convexVal.string()),  // who executed it

    status: convexVal.union(
      convexVal.literal("started"),
      convexVal.literal("success"),
      convexVal.literal("failed"),
      convexVal.literal("incomplete"),
      convexVal.literal("retry")
    ),

    // Execution details
    startedAt: convexVal.number(),
    completedAt: convexVal.optional(convexVal.number()),
    timeSpent: convexVal.optional(convexVal.number()),  // minutes

    // Outcomes
    output: convexVal.optional(convexVal.string()),
    error: convexVal.optional(convexVal.string()),
    nextAction: convexVal.optional(convexVal.string()),

    // Retry tracking
    attemptNumber: convexVal.number(),
    maxAttempts: convexVal.number(),

    createdAt: convexVal.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_task", ["taskId"])
    .index("by_status", ["status"])
    .index("by_agent", ["agentId"])
    .index("by_started_at", ["startedAt"]),

  /**
   * ALERTS - Operational Alerts for OpenClaw
   * Real-time notifications when issues are detected
   */
  alerts: defineTable({
    businessId: convexVal.id("businesses"),
    agentId: convexVal.optional(convexVal.string()),  // null = system notification
    type: convexVal.union(
      convexVal.literal("queue_overload"),
      convexVal.literal("task_blocked"),
      convexVal.literal("throughput_drop"),
      convexVal.literal("agent_crash"),
      convexVal.literal("overdue_task"),
      convexVal.literal("high_priority_task"),
      convexVal.literal("custom")
    ),
    severity: convexVal.union(
      convexVal.literal("info"),
      convexVal.literal("warning"),
      convexVal.literal("critical")
    ),
    title: convexVal.string(),
    message: convexVal.string(),
    metrics: convexVal.optional(convexVal.any()),  // { queueDepth: 8, etc }
    taskId: convexVal.optional(convexVal.id("tasks")),
    actionable: convexVal.boolean(),
    read: convexVal.boolean(),
    readAt: convexVal.optional(convexVal.number()),
    createdAt: convexVal.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_agent", ["agentId"])
    .index("by_business_read", ["businessId", "read"])
    .index("by_created_at", ["createdAt"]),

  /**
   * ALERT RULES - Define when to alert
   * Rules that trigger notifications when thresholds crossed
   */
  alertRules: defineTable({
    businessId: convexVal.id("businesses"),
    name: convexVal.string(),  // "Queue overload", "Task blocked"
    description: convexVal.optional(convexVal.string()),
    enabled: convexVal.boolean(),

    // Rule condition
    condition: convexVal.union(
      convexVal.literal("queueDepth > threshold"),
      convexVal.literal("taskBlocked > Xmin"),
      convexVal.literal("taskDueDate < now"),
      convexVal.literal("throughput < threshold"),
      convexVal.literal("agentCrash"),
      convexVal.literal("custom")
    ),
    threshold: convexVal.optional(convexVal.number()),  // for numeric conditions

    // Alert properties
    severity: convexVal.union(
      convexVal.literal("info"),
      convexVal.literal("warning"),
      convexVal.literal("critical")
    ),
    cooldownSeconds: convexVal.number(),  // min seconds between same alerts

    // Delivery channels
    channels: convexVal.array(
      convexVal.union(
        convexVal.literal("in-app"),
        convexVal.literal("slack"),
        convexVal.literal("email")
      )
    ),

    // Config for channels
    slackChannel: convexVal.optional(convexVal.string()),  // #ops-alerts
    slackMention: convexVal.optional(convexVal.string()),  // @openclaw
    emailAddresses: convexVal.optional(convexVal.array(convexVal.string())),

    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_enabled", ["enabled"]),

  /**
   * DECISIONS - Audit log of management actions
   * What OpenClaw decided to do and why
   */
  decisions: defineTable({
    businessId: convexVal.id("businesses"),

    // What action
    action: convexVal.union(
      convexVal.literal("escalated"),
      convexVal.literal("reassigned"),
      convexVal.literal("unblocked"),
      convexVal.literal("marked_executed"),
      convexVal.literal("deprioritized"),
      convexVal.literal("custom")
    ),

    // What was affected
    taskId: convexVal.id("tasks"),
    fromAgent: convexVal.optional(convexVal.string()),
    toAgent: convexVal.optional(convexVal.string()),

    // Why (decision rationale)
    reason: convexVal.string(),  // "blocked_too_long", "agent_overloaded", etc
    ruleId: convexVal.optional(convexVal.id("alertRules")),  // which rule triggered this

    // Result
    result: convexVal.union(
      convexVal.literal("success"),
      convexVal.literal("failed"),
      convexVal.literal("no_action_needed")
    ),
    resultMessage: convexVal.optional(convexVal.string()),

    // Who/what decided
    decidedBy: convexVal.string(),  // "openclaw" or agent name
    decidedAt: convexVal.number(),

    // Outcome tracking
    outcome: convexVal.optional(convexVal.string()),  // "task_completed", "issue_resolved", etc
    outcomeAt: convexVal.optional(convexVal.number()),

    createdAt: convexVal.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_task", ["taskId"])
    .index("by_action", ["action"])
    .index("by_decided_by", ["decidedBy"])
    .index("by_created_at", ["createdAt"]),

  /**
   * ALERT EVENTS - Historical alert records
   * When alerts fired and their context
   */
  alertEvents: defineTable({
    businessId: convexVal.id("businesses"),
    ruleId: convexVal.id("alertRules"),
    ruleName: convexVal.string(),

    triggered: convexVal.boolean(),
    metrics: convexVal.optional(convexVal.any()),  // snapshot of metrics when triggered

    notificationIds: convexVal.optional(convexVal.array(convexVal.id("notifications"))),

    resolvedAt: convexVal.optional(convexVal.number()),  // when alert cleared

    createdAt: convexVal.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_rule", ["ruleId"])
    .index("by_created_at", ["createdAt"]),

  /**
   * WIKI PAGES - Confluence-style document store
   * Tree-structured knowledge base organized by business + departments
   * Phase 1: Schema foundations for wiki feature
   */
  wikiPages: defineTable({
    // === BUSINESS SCOPING ===
    businessId: convexVal.id("businesses"),  // REQUIRED: which business this page belongs to

    // Content (TipTap JSON + plain text for search)
    title: convexVal.string(),
    content: convexVal.string(),        // TipTap JSON serialized to string
    contentText: convexVal.string(),    // Plain text extraction for full-text search
    emoji: convexVal.optional(convexVal.string()),

    // === TREE STRUCTURE ===
    parentId: convexVal.optional(convexVal.id("wikiPages")),  // null = department (root page)
    childIds: convexVal.array(convexVal.id("wikiPages")),      // Denormalized children (for fast access)
    position: convexVal.number(),                               // Sort order within siblings

    // === PAGE CLASSIFICATION ===
    type: convexVal.union(
      convexVal.literal("department"),
      convexVal.literal("page")
    ),

    // === OPTIONAL CONNECTIONS ===
    taskIds: convexVal.optional(convexVal.array(convexVal.id("tasks"))),
    epicId: convexVal.optional(convexVal.id("epics")),

    // === AUTHORING METADATA ===
    createdBy: convexVal.string(),
    createdByName: convexVal.string(),
    updatedBy: convexVal.string(),
    updatedByName: convexVal.string(),
    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),

    // === VERSION TRACKING ===
    version: convexVal.number(),  // Increments on each update; snapshots stored in wikiPageHistory
  })
    .index("by_business", ["businessId"])
    .index("by_parent", ["parentId"])
    .index("by_business_parent", ["businessId", "parentId"])
    .index("by_business_type", ["businessId", "type"])
    .searchIndex("search_content", {
      searchField: "contentText",
      filterFields: ["businessId"],
    }),

  /**
   * WIKI PAGE HISTORY - Version snapshots
   * One record per page save, enables history and restore functionality
   */
  wikiPageHistory: defineTable({
    businessId: convexVal.id("businesses"),
    pageId: convexVal.id("wikiPages"),
    title: convexVal.string(),
    content: convexVal.string(),        // TipTap JSON snapshot
    version: convexVal.number(),
    savedBy: convexVal.string(),
    savedByName: convexVal.string(),
    savedAt: convexVal.number(),
  })
    .index("by_page", ["pageId"])
    .index("by_business", ["businessId"]),

  /**
   * WIKI COMMENTS - Threaded discussions on pages
   * Same pattern as messages/tasks, but page-specific
   * Supports one level of threading (parent comment + replies)
   */
  wikiComments: defineTable({
    businessId: convexVal.id("businesses"),
    pageId: convexVal.id("wikiPages"),
    fromId: convexVal.string(),
    fromName: convexVal.string(),
    content: convexVal.string(),
    parentId: convexVal.optional(convexVal.id("wikiComments")),  // null = root comment, set = reply
    replyIds: convexVal.array(convexVal.id("wikiComments")),     // Denormalized replies (for fast access)
    createdAt: convexVal.number(),
    editedAt: convexVal.optional(convexVal.number()),
  })
    .index("by_page", ["pageId"])
    .index("by_business", ["businessId"])
    .index("by_parent", ["parentId"]),

});
