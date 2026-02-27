import { defineSchema, defineTable } from "convex/server";
import { v as convexVal } from "convex/values";

/**
 * Mission Control Schema - Production Architecture
 * Real-time agent orchestration with full audit trail
 */

export default defineSchema({
  /**
   * WORKSPACES - Multi-tenant Support
   * 2-5 workspaces sharing a single Mission Control instance
   */
  workspaces: defineTable({
    name: convexVal.string(),
    slug: convexVal.string(),                      // URL-safe unique identifier
    color: convexVal.optional(convexVal.string()), // Hex color for UI
    emoji: convexVal.optional(convexVal.string()), // Workspace emoji/icon
    description: convexVal.optional(convexVal.string()),
    missionStatement: convexVal.optional(convexVal.string()), // Workspace purpose/problem being solved
    isDefault: convexVal.boolean(),                // Exactly one default at all times
    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),
    createdBy: convexVal.optional(convexVal.string()), // userId of system admin who created this workspace
    budget: convexVal.optional(convexVal.object({
      monthlyTokenLimit: convexVal.number(),
      alertThreshold: convexVal.optional(convexVal.number()),
    })), // Per-workspace monthly budget
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
    // Phase 1: Extended runtime info
    runtimeLocation: convexVal.optional(convexVal.string()),    // workspace path or remote
    version: convexVal.optional(convexVal.string()),            // agent version
    runtimeStatus: convexVal.optional(convexVal.union(         // actual runtime status
      convexVal.literal("stopped"),
      convexVal.literal("running"),
      convexVal.literal("error")
    )),
    scale: convexVal.optional(convexVal.number()),              // horizontal workers

    // Phase 7: Gateway/Distributed Runtime Support
    gatewayId: convexVal.optional(convexVal.id("gateways")),
    isBoardLead: convexVal.optional(convexVal.boolean()),
    isGatewayMain: convexVal.optional(convexVal.boolean()),
    gatewayStatus: convexVal.optional(convexVal.union(
      convexVal.literal("provisioning"),
      convexVal.literal("online"),
      convexVal.literal("updating"),
      convexVal.literal("deleting"),
      convexVal.literal("error")
    )),
    openclawSessionId: convexVal.optional(convexVal.string()),
    identityProfile: convexVal.optional(convexVal.any()),
  })
    .index("by_name", ["name"])
    .index("by_status", ["status"])
    .index("by_session_key", ["sessionKey"])
    .index("by_current_task", ["currentTaskId"])
    .index("by_api_key", ["apiKey"]),

  /**
   * EXECUTIONS - Agent Execution Audit Ledger (Phase 1/6A)
   * Every agent action logged for observability (immutable audit trail)
   */
  executions: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")), // optional for system-level executions
    agentId: convexVal.id("agents"),
    agentName: convexVal.string(),           // denormalized
    taskId: convexVal.optional(convexVal.id("tasks")),
    taskTitle: convexVal.optional(convexVal.string()),
    workflowId: convexVal.optional(convexVal.id("workflows")), // Phase 6C: multi-agent pipelines
    triggerType: convexVal.union(
      convexVal.literal("manual"),
      convexVal.literal("cron"),
      convexVal.literal("autonomous"),
      convexVal.literal("webhook")
    ),
    status: convexVal.union(
      convexVal.literal("pending"),
      convexVal.literal("running"),
      convexVal.literal("success"),
      convexVal.literal("failed"),
      convexVal.literal("aborted")
    ),
    startTime: convexVal.number(),
    endTime: convexVal.optional(convexVal.number()),
    durationMs: convexVal.optional(convexVal.number()),
    inputTokens: convexVal.optional(convexVal.number()),
    outputTokens: convexVal.optional(convexVal.number()),
    totalTokens: convexVal.optional(convexVal.number()),
    costCents: convexVal.optional(convexVal.number()),
    model: convexVal.optional(convexVal.string()),
    modelProvider: convexVal.optional(convexVal.string()),
    error: convexVal.optional(convexVal.string()),
    logs: convexVal.optional(convexVal.array(convexVal.string())),
    metadata: convexVal.optional(convexVal.object({
      sessionKey: convexVal.optional(convexVal.string()),
      sessionId: convexVal.optional(convexVal.string()),
      retryCount: convexVal.optional(convexVal.number()),
    })),
  })
    .index("by_agent_time", ["agentId", "startTime"])
    .index("by_status_time", ["status", "startTime"])
    .index("by_workflow_id", ["workflowId"])
    .index("by_workspace_id", ["workspaceId"])
    .index("by_agent", ["agentId"])
    .index("by_status", ["status"])
    .index("by_start_time", ["startTime"])
    .index("by_trigger", ["triggerType"]),

  /**
   * EPICS - Large Initiatives
   * Group tasks into strategic objectives (workspace-scoped)
   */
  epics: defineTable({
    // === workspace SCOPING ===
    workspaceId: convexVal.optional(convexVal.id("workspaces")),  // Temporarily optional for migration (will be made required after fixing old docs)
    businessId: convexVal.optional(convexVal.string()),  // Legacy field - being migrated to workspaceId

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
    .index("by_workspace", ["workspaceId"])
    .index("by_status", ["status"])
    .index("by_owner", ["ownerId"])
    .index("by_created_at", ["createdAt"]),

  /**
   * TASKS - The Work Queue
   * Kanban-style task management with hierarchy (workspace-scoped)
   */
  tasks: defineTable({
    // === workspace SCOPING ===
    workspaceId: convexVal.optional(convexVal.id("workspaces")),  // REQUIRED: which workspace this task belongs to
    businessId: convexVal.optional(convexVal.string()),  // Legacy field - being migrated to workspaceId

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
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_ticket_number", ["workspaceId", "ticketNumber"])
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
   * Comments on tasks with @mentions and threading (workspace-scoped via taskId)
   */
  messages: defineTable({
    // === workspace SCOPING ===
    workspaceId: convexVal.optional(convexVal.id("workspaces")),  // REQUIRED: scoped via taskId's business
    businessId: convexVal.optional(convexVal.string()),  // Legacy field - being migrated to workspaceId

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
    .index("by_workspace", ["workspaceId"])
    .index("by_task", ["taskId"])
    .index("by_parent", ["parentId"])
    .index("by_from", ["fromId"])
    .index("by_created_at", ["createdAt"]),

  /**
   * ACTIVITIES - The Feed (Audit Log)
   * Real-time stream with full denormalization (workspace-scoped but globally viewable)
   */
  activities: defineTable({
    // === workspace SCOPING ===
    // NOTE: workspaceId is optional to support agent-scoped activities (like heartbeat changes)
    // that don't belong to a specific workspace (agents are global)
    workspaceId: convexVal.optional(convexVal.id("workspaces")),  // Optional: for task/workspace-scoped activities
    businessId: convexVal.optional(convexVal.string()),  // Legacy field - being migrated to workspaceId

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
      convexVal.literal("tasks_queried"),
      convexVal.literal("anomaly_detected"),
      convexVal.literal("anomaly_resolved"),
      convexVal.literal("approval_requested"),
      convexVal.literal("approval_resolved")
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
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_created_at", ["workspaceId", "createdAt"])
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
    workspaceId: convexVal.optional(convexVal.id("workspaces")),  // for scoped notifications
    recipientId: convexVal.optional(convexVal.id("agents")),   // who gets notified (optional for broadcast alerts)
    type: convexVal.union(
      convexVal.literal("mention"),
      convexVal.literal("assignment"),
      convexVal.literal("status_change"),
      convexVal.literal("block"),
      convexVal.literal("dependency_unblocked"),
      convexVal.literal("help_request"),
      convexVal.literal("alert_rule_triggered")
    ),

    content: convexVal.string(),

    // Source (denormalized)
    fromId: convexVal.string(),
    fromName: convexVal.string(),

    // Context
    taskId: convexVal.optional(convexVal.id("tasks")),
    taskTitle: convexVal.optional(convexVal.string()),
    messageId: convexVal.optional(convexVal.id("messages")),

    // Alert-specific fields
    title: convexVal.optional(convexVal.string()),
    severity: convexVal.optional(convexVal.union(
      convexVal.literal("info"),
      convexVal.literal("warning"),
      convexVal.literal("critical")
    )),
    metadata: convexVal.optional(convexVal.any()),

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
    .index("by_workspace", ["workspaceId"])
    .index("by_task", ["taskId"]),

  /**
   * THREAD_SUBSCRIPTIONS - Auto-Notify
   * Agents auto-subscribed to relevant threads (workspace-scoped via taskId)
   */
  threadSubscriptions: defineTable({
    // === workspace SCOPING ===
    workspaceId: convexVal.optional(convexVal.id("workspaces")),  // REQUIRED: scoped via taskId's business
    businessId: convexVal.optional(convexVal.string()),  // Legacy field - being migrated to workspaceId

    agentId: convexVal.id("agents"),
    taskId: convexVal.id("tasks"),
    level: convexVal.union(convexVal.literal("all"), convexVal.literal("mentions_only")),
    createdAt: convexVal.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_agent_task", ["agentId", "taskId"])
    .index("by_task", ["taskId"])
    .index("by_agent", ["agentId"]),

  /**
   * DOCUMENTS - Deliverables
   * Research, protocols, specs, drafts (workspace-scoped)
   */
  documents: defineTable({
    // === workspace SCOPING ===
    workspaceId: convexVal.optional(convexVal.id("workspaces")),  // REQUIRED: which workspace this document belongs to
    businessId: convexVal.optional(convexVal.string()),  // Legacy field - being migrated to workspaceId

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
    .index("by_workspace", ["workspaceId"])
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

    // === PHASE 4: Denormalized agent info (to avoid N+1 lookups in getLeaderboard) ===
    agentName: convexVal.optional(convexVal.string()),  // denormalized from agents table
    agentRole: convexVal.optional(convexVal.string()),  // denormalized from agents table

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
   * CALENDAR_EVENTS - Merged Timeline
   * Human calendar + AI-scheduled tasks in one view
   */
  calendarEvents: defineTable({
    // === workspace SCOPING ===
    workspaceId: convexVal.optional(convexVal.id("workspaces")), // MIG-10: backfilled from taskId

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

    // Display
    color: convexVal.optional(convexVal.string()),  // hex or named color
    priority: convexVal.optional(convexVal.number()),

    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),
  })
    .index("by_workspace", ["workspaceId"])
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
   * Generated reports on goal progress + recommendations (workspace-scoped)
   */
  strategicReports: defineTable({
    // === workspace SCOPING ===
    workspaceId: convexVal.optional(convexVal.id("workspaces")),  // REQUIRED: which workspace this report is for
    businessId: convexVal.optional(convexVal.string()),  // Legacy field - being migrated to workspaceId

    week: convexVal.number(),             // ISO week number
    year: convexVal.number(),

    // Analysis
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
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_week", ["workspaceId", "year", "week"])
    .index("by_week", ["year", "week"])
    .index("by_created_at", ["createdAt"]),

  /**
   * SETTINGS - Configuration
   * Split between global (no workspaceId) and workspace-scoped (with workspaceId)
   * Global keys: theme, taskCounterFormat, features
   *  keys: githubOrg, githubRepo, ticketPrefix, taskCounter
   */
  settings: defineTable({
    key: convexVal.string(),               // e.g., "theme", "githubRepo", "taskCounter"
    value: convexVal.string(),             // JSON-encoded value
    workspaceId: convexVal.optional(convexVal.id("workspaces")), // null=global, set=workspace-scoped
    businessId: convexVal.optional(convexVal.string()), // DEPRECATED: legacy field from businesses table, being migrated to workspaceId (MIG-06)
    updatedAt: convexVal.number(),
  })
    .index("by_key", ["key"])
    .index("by_workspace_key", ["workspaceId", "key"]),

  /**
   * EXECUTION_LOG - Task Execution History
   * Track when tasks run, outcomes, time spent (workspace-scoped via taskId)
   */
  executionLog: defineTable({
    // === workspace SCOPING ===
    workspaceId: convexVal.optional(convexVal.id("workspaces")),  // REQUIRED: scoped via taskId's business
    businessId: convexVal.optional(convexVal.string()),  // Legacy field - being migrated to workspaceId

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
    .index("by_workspace", ["workspaceId"])
    .index("by_task", ["taskId"])
    .index("by_status", ["status"])
    .index("by_agent", ["agentId"])
    .index("by_started_at", ["startedAt"]),

  /**
   * ALERTS - Operational Alerts for OpenClaw
   * Real-time notifications when issues are detected
   */
  alerts: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
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
    .index("by_workspace", ["workspaceId"])
    .index("by_agent", ["agentId"])
    .index("by_workspace_read", ["workspaceId", "read"])
    .index("by_created_at", ["createdAt"]),

  /**
   * ALERT RULES - Define when to alert
   * Rules that trigger notifications when thresholds crossed
   */
  alertRules: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
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

    // Tracking last fire time for cooldown enforcement
    lastFiredAt: convexVal.optional(convexVal.number()),

    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_enabled", ["enabled"]),

  /**
   * DECISIONS - Audit log of management actions
   * What OpenClaw decided to do and why
   */
  decisions: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),

    // What action
    action: convexVal.union(
      convexVal.literal("escalated"),
      convexVal.literal("reassigned"),
      convexVal.literal("unblocked"),
      convexVal.literal("marked_executed"),
      convexVal.literal("deprioritized"),
      convexVal.literal("alert_rule_triggered"),
      convexVal.literal("custom")
    ),

    // What was affected (optional for alert_rule_triggered actions)
    taskId: convexVal.optional(convexVal.id("tasks")),
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
    .index("by_workspace", ["workspaceId"])
    .index("by_task", ["taskId"])
    .index("by_action", ["action"])
    .index("by_decided_by", ["decidedBy"])
    .index("by_created_at", ["createdAt"]),

  /**
   * ALERT EVENTS - Historical alert records
   * When alerts fired and their context
   */
  alertEvents: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
    ruleId: convexVal.id("alertRules"),
    ruleName: convexVal.string(),

    triggered: convexVal.boolean(),
    metrics: convexVal.optional(convexVal.any()),  // snapshot of metrics when triggered

    notificationIds: convexVal.optional(convexVal.array(convexVal.id("notifications"))),

    resolvedAt: convexVal.optional(convexVal.number()),  // when alert cleared

    createdAt: convexVal.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_rule", ["ruleId"])
    .index("by_created_at", ["createdAt"]),

  /**
   * WIKI PAGES - Simple markdown-based document store
   * Tree-structured knowledge base organized by workspace + pages and subpages
   * No Confluence-style features: just markdown content, hierarchy, and basic metadata
   */
  wikiPages: defineTable({
    // === workspace SCOPING ===
    workspaceId: convexVal.optional(convexVal.id("workspaces")),

    // === CONTENT ===
    title: convexVal.string(),
    content: convexVal.string(),  // Plain markdown string

    // === TREE STRUCTURE ===
    parentId: convexVal.optional(convexVal.id("wikiPages")),
    childIds: convexVal.array(convexVal.id("wikiPages")),
    position: convexVal.number(),

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
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_parent", ["parentId"])
    .index("by_workspace_parent", ["workspaceId", "parentId"])
    .index("by_workspace_type", ["workspaceId", "type"]),

  /**
   * WIKI COMMENTS - Threaded discussions on pages
   * Same pattern as messages/tasks, but page-specific
   * Supports one level of threading (parent comment + replies)
   */
  wikiComments: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
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
    .index("by_workspace", ["workspaceId"])
    .index("by_parent", ["parentId"]),

  /**
   * TASK COMMENTS - Threaded discussions on tasks (Phase 5A)
   * Supports nested replies with emoji reactions and @mentions
   */
  taskComments: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
    taskId: convexVal.id("tasks"),
    agentId: convexVal.id("agents"),
    agentName: convexVal.string(),

    // Content
    content: convexVal.string(),  // markdown support
    mentions: convexVal.optional(convexVal.array(convexVal.id("agents"))),

    // Threading
    parentCommentId: convexVal.optional(convexVal.id("taskComments")),

    // Reactions (emoji → array of agent IDs)
    reactions: convexVal.optional(convexVal.record(convexVal.string(), convexVal.array(convexVal.id("agents")))),

    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),
  })
    .index("by_task", ["taskId"])
    .index("by_task_created_at", ["taskId", "createdAt"])
    .index("by_agent", ["agentId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_parent", ["parentCommentId"]),

  /**
   * MENTIONS - @mention tracking for notifications (Phase 5A)
   */
  mentions: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
    mentionedAgentId: convexVal.id("agents"),
    mentionedBy: convexVal.id("agents"),

    context: convexVal.union(
      convexVal.literal("task_comment"),
      convexVal.literal("task_description"),
      convexVal.literal("decision"),
      convexVal.literal("epic")
    ),
    contextId: convexVal.string(),
    contextTitle: convexVal.string(),

    read: convexVal.boolean(),
    readAt: convexVal.optional(convexVal.number()),

    createdAt: convexVal.number(),
  })
    .index("by_mentioned_agent", ["mentionedAgentId"])
    .index("by_read", ["mentionedAgentId", "read"])
    .index("by_workspace", ["workspaceId"]),

  /**
   * TASK SUBSCRIPTIONS - Agent subscriptions for task notifications (Phase 5A)
   */
  taskSubscriptions: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
    taskId: convexVal.id("tasks"),
    agentId: convexVal.id("agents"),

    notifyOn: convexVal.union(
      convexVal.literal("all"),
      convexVal.literal("comments"),
      convexVal.literal("status"),
      convexVal.literal("mentions")
    ),

    subscribedAt: convexVal.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_agent_task", ["agentId", "taskId"])
    .index("by_task", ["taskId"])
    .index("by_agent", ["agentId"]),

  /**
   * PRESENCE INDICATORS - Real-time agent status and activity (Phase 5A)
   */
  presenceIndicators: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
    agentId: convexVal.id("agents"),

    status: convexVal.union(
      convexVal.literal("online"),
      convexVal.literal("away"),
      convexVal.literal("do_not_disturb"),
      convexVal.literal("offline")
    ),

    currentActivity: convexVal.optional(convexVal.string()),  // e.g., "viewing task #123"
    lastActivity: convexVal.number(),

    updatedAt: convexVal.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_agent", ["agentId"])
    .index("by_status", ["status"]),

  /**
   * AGENT SKILLS - Inferred and manual skill tracking (Phase 5B)
   * Tracks agent expertise with confidence scores
   */
  agentSkills: defineTable({
    agentId: convexVal.id("agents"),
    skill: convexVal.string(), // "design", "backend", "frontend", "testing", "docs", etc
    confidence: convexVal.number(), // 0-100
    inferredFromTaskCount: convexVal.number(),
    manuallyOverridden: convexVal.boolean(),
    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_skill", ["agentId", "skill"]),

  /**
   * TASK PATTERNS - Learned task sequences (Phase 5B)
   * Identifies and tracks successful task workflows
   */
  taskPatterns: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
    pattern: convexVal.string(), // e.g., "design→backend→frontend"
    taskTypeSequence: convexVal.array(convexVal.string()), // ["design_task", "backend_task", "frontend_task"]
    occurrences: convexVal.number(),
    successCount: convexVal.number(),
    successRate: convexVal.number(), // 0-100%
    avgDurationDays: convexVal.number(),
    lastSeen: convexVal.number(),
    createdAt: convexVal.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_success_rate", ["successRate"]),

  /**
   * ANOMALIES - Unusual behavior detection (Phase 5B)
   * Flags deviations from expected patterns and performance
   */
  anomalies: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
    agentId: convexVal.id("agents"),
    type: convexVal.union(
      convexVal.literal("duration_deviation"),
      convexVal.literal("error_rate"),
      convexVal.literal("skill_mismatch"),
      convexVal.literal("status_spike")
    ),
    severity: convexVal.union(
      convexVal.literal("low"),
      convexVal.literal("medium"),
      convexVal.literal("high")
    ),
    message: convexVal.string(),
    taskId: convexVal.optional(convexVal.id("tasks")),
    detectedValue: convexVal.number(),
    expectedValue: convexVal.number(),
    flagged: convexVal.boolean(),
    resolvedAt: convexVal.optional(convexVal.number()),
    createdAt: convexVal.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_severity", ["severity"])
    .index("by_flagged", ["flagged"]),

  /**
   * AGENT_STATUS - Real-time Agent State (Phase 6A)
   * Ephemeral state (separate from agents table to avoid contention)
   * Updated frequently via heartbeat, separately from static agent registry
   */
  agent_status: defineTable({
    agentId: convexVal.id("agents"),
    status: convexVal.union(
      convexVal.literal("idle"),
      convexVal.literal("busy"),
      convexVal.literal("failed"),
      convexVal.literal("stopped")
    ),
    currentTaskId: convexVal.optional(convexVal.id("tasks")),
    queuedTaskCount: convexVal.number(),           // tasks waiting
    lastHeartbeatAt: convexVal.number(),           // unix timestamp
    uptimePercent: convexVal.number(),             // 24h rolling 0-100
    totalExecutions: convexVal.number(),           // lifetime counter
    failureRate: convexVal.number(),               // 0-1.0
    cpuPercent: convexVal.optional(convexVal.number()), // optional metrics
    memoryMb: convexVal.optional(convexVal.number()),   // optional metrics
  })
    .index("by_agent", ["agentId"]),

  /**
   * EVENTS - Real-time Event Stream (Phase 6A)
   * Immutable event log for dashboard subscriptions + notifications
   * 24-hour retention, then automatically deleted
   */
  events: defineTable({
    type: convexVal.union(
      convexVal.literal("agent_started"),
      convexVal.literal("agent_stopped"),
      convexVal.literal("execution_started"),
      convexVal.literal("execution_completed"),
      convexVal.literal("execution_failed"),
      convexVal.literal("error_occurred"),
      convexVal.literal("retry_attempt"),
      convexVal.literal("workflow_started"),
      convexVal.literal("workflow_completed"),
      convexVal.literal("cron_triggered")
    ),
    agentId: convexVal.optional(convexVal.id("agents")),
    executionId: convexVal.optional(convexVal.id("executions")),
    workflowId: convexVal.optional(convexVal.id("workflows")),
    message: convexVal.string(),
    severity: convexVal.union(
      convexVal.literal("info"),
      convexVal.literal("warning"),
      convexVal.literal("error")
    ),
    timestamp: convexVal.number(),
  })
    .index("by_timestamp", ["timestamp"]),

  /**
   * WORKFLOWS - Multi-Agent Pipeline Definitions (Phase 6C)
   * DAG-based workflow orchestration (workspace-scoped)
   */
  workflows: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
    name: convexVal.string(),
    description: convexVal.optional(convexVal.string()),

    // DAG structure (adjacency list)
    definition: convexVal.object({
      nodes: convexVal.any(),                    // { [nodeId]: { agentId, taskTemplate, retryPolicy, timeoutMs } }
      edges: convexVal.any(),                    // { [fromNodeId]: [toNodeId1, toNodeId2, ...] }
      conditionalBranches: convexVal.optional(convexVal.any()), // conditional routing
    }),

    isActive: convexVal.boolean(),
    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_active", ["isActive"]),

  /**
   * WORKFLOW_EXECUTIONS - Multi-Agent Pipeline Runs (Phase 6C)
   * Track execution of multi-agent workflows (immutable)
   */
  workflow_executions: defineTable({
    workflowId: convexVal.id("workflows"),
    status: convexVal.union(
      convexVal.literal("running"),
      convexVal.literal("success"),
      convexVal.literal("failed"),
      convexVal.literal("aborted")
    ),

    // Node execution tracking
    nodeExecutions: convexVal.any(),              // { [nodeId]: Id<executions> }

    startTime: convexVal.number(),
    endTime: convexVal.optional(convexVal.number()),
    durationMs: convexVal.optional(convexVal.number()),

    // Overall result
    error: convexVal.optional(convexVal.string()),
    totalTokens: convexVal.optional(convexVal.number()),
    totalCostCents: convexVal.optional(convexVal.number()),
  })
    .index("by_workflow", ["workflowId"])
    .index("by_status", ["status"])
    .index("by_start_time", ["startTime"]),

  /**
   * METRICS - Aggregated Performance Metrics (Phase 6B)
   * Pre-calculated hourly summaries for dashboard performance
   * Recalculated hourly via background job (immutable per hour)
   */
  metrics: defineTable({
    agentId: convexVal.id("agents"),
    date: convexVal.string(),                    // YYYY-MM-DD
    hour: convexVal.number(),                    // 0-23

    // Execution counts
    executionCount: convexVal.number(),
    successCount: convexVal.number(),
    failureCount: convexVal.number(),

    // Duration
    totalDurationMs: convexVal.number(),
    avgDurationMs: convexVal.number(),

    // Tokens & cost
    totalTokens: convexVal.number(),
    avgTokensPerExecution: convexVal.number(),
    totalCostCents: convexVal.number(),
    avgCostCentsPerExecution: convexVal.number(),

    // Rates
    failureRate: convexVal.number(),             // 0-1.0
  })
    .index("by_agent_date", ["agentId", "date"])
    .index("by_date", ["date"]),

  /**
   * CRON_JOBS - Scheduled Workflow Executions (Phase 6C)
   * Store cron schedules and execution history (workspace-scoped)
   */
  cron_jobs: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
    name: convexVal.string(),
    description: convexVal.optional(convexVal.string()),

    // Schedule
    schedule: convexVal.string(),                // cron expression "0 * * * *"
    timezone: convexVal.optional(convexVal.string()), // "UTC", "America/New_York"

    // Execution target
    workflowId: convexVal.id("workflows"),

    // State
    isActive: convexVal.boolean(),
    lastRunAt: convexVal.optional(convexVal.number()),
    lastStatus: convexVal.optional(convexVal.union(
      convexVal.literal("success"),
      convexVal.literal("failed"),
      convexVal.literal("partial")
    )),

    // Retry policy
    maxRetries: convexVal.number(),
    retryDelayMs: convexVal.number(),

    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_active", ["isActive"])
    .index("by_workflow", ["workflowId"]),

  /**
   * RBAC - Organization Members & Board Access
   * Enables role-based access control (owner/admin/member) with per-board permissions
   */
  organizationMembers: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
    userId: convexVal.string(),
    userEmail: convexVal.optional(convexVal.string()),
    userName: convexVal.optional(convexVal.string()),
    // Legacy role field (optional for migration)
    role: convexVal.optional(convexVal.union(
      convexVal.literal("owner"),
      convexVal.literal("admin"),
      convexVal.literal("member")
    )),
    // New 4-level role field (optional during migration, required after MIG-18)
    userRole: convexVal.optional(convexVal.union(
      convexVal.literal("admin"),
      convexVal.literal("agent"),
      convexVal.literal("collaborator"),
      convexVal.literal("viewer")
    )),
    allBoardsRead: convexVal.boolean(),
    allBoardsWrite: convexVal.boolean(),
    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_workspace_user", ["workspaceId", "userId"]),

  boardAccess: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
    memberId: convexVal.id("organizationMembers"),
    canRead: convexVal.boolean(),
    canWrite: convexVal.boolean(),
    createdAt: convexVal.number(),
  })
    .index("by_member", ["memberId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_member_business", ["memberId", "workspaceId"]),

  invites: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
    token: convexVal.string(),
    email: convexVal.string(),
    // Legacy role field (optional for migration)
    role: convexVal.optional(convexVal.union(
      convexVal.literal("owner"),
      convexVal.literal("admin"),
      convexVal.literal("member")
    )),
    // New 4-level role field (optional during migration, required after MIG-18)
    userRole: convexVal.optional(convexVal.union(
      convexVal.literal("admin"),
      convexVal.literal("agent"),
      convexVal.literal("collaborator"),
      convexVal.literal("viewer")
    )),
    allBoardsRead: convexVal.boolean(),
    allBoardsWrite: convexVal.boolean(),
    invitedBy: convexVal.string(),
    acceptedBy: convexVal.optional(convexVal.string()),
    acceptedAt: convexVal.optional(convexVal.number()),
    createdAt: convexVal.number(),
  })
    .index("by_token", ["token"])
    .index("by_workspace", ["workspaceId"])
    .index("by_email", ["email"]),

  inviteBoardAccess: defineTable({
    inviteId: convexVal.id("invites"),
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
    canRead: convexVal.boolean(),
    canWrite: convexVal.boolean(),
  }).index("by_invite", ["inviteId"]),

  /**
   * APPROVALS - Human-in-the-Loop Governance
   * Confidence-based action approval requests with rubric scoring
   */
  approvals: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
    agentId: convexVal.optional(convexVal.id("agents")),
    taskId: convexVal.optional(convexVal.id("tasks")),
    actionType: convexVal.string(),
    payload: convexVal.optional(convexVal.any()),
    confidence: convexVal.number(),
    rubricScores: convexVal.optional(convexVal.any()),
    leadReasoning: convexVal.string(),
    isExternal: convexVal.optional(convexVal.boolean()),
    isRisky: convexVal.optional(convexVal.boolean()),
    status: convexVal.union(
      convexVal.literal("pending"),
      convexVal.literal("approved"),
      convexVal.literal("rejected")
    ),
    resolvedBy: convexVal.optional(convexVal.string()),
    resolvedAt: convexVal.optional(convexVal.number()),
    createdAt: convexVal.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_agent", ["agentId"])
    .index("by_task", ["taskId"])
    .index("by_status", ["status"]),

  approvalTaskLinks: defineTable({
    approvalId: convexVal.id("approvals"),
    taskId: convexVal.id("tasks"),
    createdAt: convexVal.number(),
  })
    .index("by_approval", ["approvalId"])
    .index("by_task", ["taskId"]),

  /**
   * GATEWAYS - Distributed Runtime Control
   * WebSocket gateway configurations for Claude Code agent provisioning
   */
  gateways: defineTable({
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
    name: convexVal.string(),
    url: convexVal.string(),
    token: convexVal.optional(convexVal.string()),
    workspaceRoot: convexVal.string(),
    disableDevicePairing: convexVal.boolean(),
    allowInsecureTls: convexVal.boolean(),
    lastHealthCheck: convexVal.optional(convexVal.number()),
    isHealthy: convexVal.optional(convexVal.boolean()),
    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),
  }).index("by_workspace", ["workspaceId"]),

  /**
   * SYSTEM ADMINS - Global Administrative Access
   * Users with system-wide administrative privileges (bypass workspace membership checks)
   */
  systemAdmins: defineTable({
    userId: convexVal.string(),
    createdAt: convexVal.number(),
  })
    .index("by_user", ["userId"]),

  /**
   * API KEY QUOTA - Rate Limiting Tracking
   * Per-API-key token bucket state for rate limiting enforcement
   */
  apiKeyQuota: defineTable({
    apiKeyId: convexVal.string(),         // Indexed for fast lookup
    tokensRemaining: convexVal.number(),  // Current quota balance
    tokensPerHour: convexVal.number(),    // Refill rate per hour (default 1000)
    tokensPerDay: convexVal.number(),     // Daily hard cap (default 10000)
    hourlyResetAt: convexVal.number(),    // Timestamp when hourly quota resets
    dailyResetAt: convexVal.number(),     // Timestamp when daily quota resets
    createdAt: convexVal.number(),
    updatedAt: convexVal.number(),
  }).index("by_api_key", ["apiKeyId"]),

});
