import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Mission Control Schema - Production Architecture
 * Real-time agent orchestration with full audit trail
 */

export default defineSchema({
  /**
   * AGENTS - The Squad
   * 10 specialized agents with distinct roles
   */
  agents: defineTable({
    name: v.string(),              // "Jarvis"
    role: v.string(),              // "Squad Lead"
    status: v.union(
      v.literal("idle"),
      v.literal("active"),
      v.literal("blocked")
    ),
    currentTaskId: v.optional(v.id("tasks")),
    sessionKey: v.string(),        // "agent:main:main"
    lastHeartbeat: v.number(),
    apiKey: v.optional(v.string()),     // API key for HTTP auth layer
    level: v.union(
      v.literal("lead"),
      v.literal("specialist"),
      v.literal("intern")
    ),
    personality: v.optional(v.string()),
    capabilities: v.optional(v.array(v.string())),
    model: v.optional(v.string()),
    metadata: v.optional(v.object({
      totalTasksCompleted: v.optional(v.number()),
      avgTaskDuration: v.optional(v.number()),
      lastActiveAt: v.optional(v.number()),
    })),
  })
    .index("by_name", ["name"])
    .index("by_status", ["status"])
    .index("by_session_key", ["sessionKey"])
    .index("by_current_task", ["currentTaskId"])
    .index("by_api_key", ["apiKey"]),

  /**
   * EPICS - Large Initiatives
   * Group tasks into strategic objectives
   */
  epics: defineTable({
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("planning"),
      v.literal("active"),
      v.literal("completed")
    ),
    taskIds: v.array(v.id("tasks")),
    ownerId: v.optional(v.id("agents")),
    progress: v.number(),          // 0-100 calculated
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_owner", ["ownerId"])
    .index("by_created_at", ["createdAt"]),

  /**
   * TASKS - The Work Queue
   * Kanban-style task management with hierarchy
   */
  tasks: defineTable({
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("backlog"),
      v.literal("ready"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("blocked"),
      v.literal("done")
    ),
    priority: v.union(
      v.literal("P0"),
      v.literal("P1"),
      v.literal("P2"),
      v.literal("P3")
    ),
    
    // Hierarchy
    epicId: v.optional(v.id("epics")),
    parentId: v.optional(v.id("tasks")),
    subtaskIds: v.array(v.id("tasks")),
    
    // Assignment
    ownerId: v.string(),           // agent ID or "user"
    assigneeIds: v.array(v.id("agents")),
    
    // Estimation
    estimatedHours: v.optional(v.number()),
    actualHours: v.optional(v.number()),
    timeEstimate: v.optional(v.union(
      v.literal("XS"),
      v.literal("S"),
      v.literal("M"),
      v.literal("L"),
      v.literal("XL")
    )),
    dueDate: v.optional(v.number()),
    
    // Dependencies
    blockedBy: v.array(v.id("tasks")),
    blocks: v.array(v.id("tasks")),
    
    // Tracking
    createdBy: v.string(),         // agent ID or "user"
    createdAt: v.number(),
    updatedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    
    // Metadata
    tags: v.array(v.string()),
    receipts: v.array(v.string()), // commit hashes, file paths
    
    // === NEW: Goal Integration ===
    goalIds: v.optional(v.array(v.id("goals"))),
    impact: v.optional(v.union(
      v.literal("P0"),
      v.literal("P1"),
      v.literal("P2"),
      v.literal("P3")
    )),
    
    // === NEW: AI Generation Metadata ===
    generatedBy: v.optional(v.string()),  // Agent that created task
    generationReason: v.optional(v.string()), // Why this task was created
    relatedMemoryKeys: v.optional(v.array(v.string())), // MEMORY.md sections
    
    // === NEW: Execution Tracking ===
    timeTracked: v.optional(v.number()),  // Actual hours spent
    completionNotes: v.optional(v.string()),

    // === NEW: Ticket Number ===
    ticketNumber: v.optional(v.string()),  // e.g. "MC-001" — human-readable ID for API
  })
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
   * Comments on tasks with @mentions and threading
   */
  messages: defineTable({
    taskId: v.id("tasks"),
    fromId: v.string(),            // agent ID or "user"
    fromName: v.string(),          // display name (denormalized)
    fromRole: v.optional(v.string()), // agent role
    content: v.string(),
    
    // Threading
    parentId: v.optional(v.id("messages")),
    replyIds: v.array(v.id("messages")),
    
    // @mentions
    mentions: v.array(v.id("agents")),
    
    // Attachments
    attachments: v.optional(v.array(v.id("documents"))),
    
    // System messages
    isSystem: v.optional(v.boolean()),
    systemType: v.optional(v.union(
      v.literal("status_change"),
      v.literal("assignment"),
      v.literal("dependency_added"),
      v.literal("blocker_added")
    )),
    
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
  })
    .index("by_task", ["taskId"])
    .index("by_parent", ["parentId"])
    .index("by_from", ["fromId"])
    .index("by_created_at", ["createdAt"]),

  /**
   * ACTIVITIES - The Feed (Audit Log)
   * Real-time stream with full denormalization
   */
  activities: defineTable({
    type: v.union(
      v.literal("task_created"),
      v.literal("task_updated"),
      v.literal("task_completed"),
      v.literal("task_blocked"),
      v.literal("task_assigned"),
      v.literal("agent_claimed"),
      v.literal("agent_status_changed"),
      v.literal("comment_added"),
      v.literal("mention"),
      v.literal("epic_created"),
      v.literal("epic_completed"),
      v.literal("dependency_added"),
      v.literal("dependency_removed"),
      v.literal("tags_updated"),
      v.literal("tasks_queried")
    ),
    
    // Actor (denormalized for speed)
    agentId: v.string(),
    agentName: v.string(),
    agentRole: v.optional(v.string()),
    
    // Target
    taskId: v.optional(v.id("tasks")),
    taskTitle: v.optional(v.string()),
    epicId: v.optional(v.id("epics")),
    epicTitle: v.optional(v.string()),
    
    // Change tracking
    message: v.string(),
    oldValue: v.optional(v.any()),
    newValue: v.optional(v.any()),
    
    createdAt: v.number(),
  })
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
    recipientId: v.id("agents"),   // who gets notified
    type: v.union(
      v.literal("mention"),
      v.literal("assignment"),
      v.literal("status_change"),
      v.literal("block"),
      v.literal("dependency_unblocked")
    ),
    
    content: v.string(),
    
    // Source (denormalized)
    fromId: v.string(),
    fromName: v.string(),
    
    // Context
    taskId: v.optional(v.id("tasks")),
    taskTitle: v.optional(v.string()),
    messageId: v.optional(v.id("messages")),
    
    // Delivery state
    read: v.boolean(),
    readAt: v.optional(v.number()),
    clicked: v.optional(v.boolean()),
    clickedAt: v.optional(v.number()),
    
    // Expiry
    expiresAt: v.optional(v.number()),
    
    createdAt: v.number(),
  })
    .index("by_recipient", ["recipientId"])
    .index("by_read", ["recipientId", "read"])
    .index("by_created_at", ["createdAt"])
    .index("by_task", ["taskId"]),

  /**
   * THREAD_SUBSCRIPTIONS - Auto-Notify
   * Agents auto-subscribed to relevant threads
   */
  threadSubscriptions: defineTable({
    agentId: v.id("agents"),
    taskId: v.id("tasks"),
    level: v.union(v.literal("all"), v.literal("mentions_only")),
    createdAt: v.number(),
  })
    .index("by_agent_task", ["agentId", "taskId"])
    .index("by_task", ["taskId"])
    .index("by_agent", ["agentId"]),

  /**
   * DOCUMENTS - Deliverables
   * Research, protocols, specs, drafts
   */
  documents: defineTable({
    title: v.string(),
    content: v.string(),
    type: v.union(
      v.literal("deliverable"),
      v.literal("research"),
      v.literal("protocol"),
      v.literal("spec"),
      v.literal("draft"),
      v.literal("receipt")
    ),
    taskId: v.optional(v.id("tasks")),
    epicId: v.optional(v.id("epics")),
    createdBy: v.string(),
    createdByName: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    version: v.number(),
  })
    .index("by_task", ["taskId"])
    .index("by_epic", ["epicId"])
    .index("by_type", ["type"])
    .index("by_created_at", ["createdAt"]),

  /**
   * AGENT_METRICS - Performance Tracking
   * Aggregated agent performance data
   */
  agentMetrics: defineTable({
    agentId: v.id("agents"),
    period: v.string(),          // "2024-01" for monthly
    
    // Task metrics
    tasksCreated: v.number(),
    tasksCompleted: v.number(),
    tasksBlocked: v.number(),
    avgCompletionTime: v.number(), // hours
    
    // Collaboration
    commentsMade: v.number(),
    mentionsSent: v.number(),
    mentionsReceived: v.number(),
    
    // Engagement
    sessionsCompleted: v.number(),
    totalSessionHours: v.number(),
    
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_period", ["period"]),

  /**
   * WAKE_REQUESTS - Agent Wake Queue
   * Queue for waking agents via notification daemon
   */
  wakeRequests: defineTable({
    agentId: v.id("agents"),
    agentName: v.string(),
    agentSessionKey: v.string(),
    requestedBy: v.string(),    // who requested the wake
    priority: v.union(v.literal("normal"), v.literal("urgent")),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    error: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),      // DM-04: TTL for cleanup
    processedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_agent", ["agentId"]),

  /**
   * GOALS - Long-term Objectives
   * AI-native goal tracking with memory integration
   */
  goals: defineTable({
    title: v.string(),
    description: v.string(),
    category: v.union(
      v.literal("business"),
      v.literal("personal"),
      v.literal("learning"),
      v.literal("health")
    ),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("archived")
    ),
    
    // Hierarchy
    parentGoalId: v.optional(v.id("goals")),
    childGoalIds: v.array(v.id("goals")),
    
    // Progress
    progress: v.number(),          // 0-100% (calculated from tasks)
    deadline: v.optional(v.number()),
    
    // Strategy
    keyResults: v.optional(v.array(v.string())),  // OKR-style measures
    relatedTaskIds: v.array(v.id("tasks")),
    relatedMemoryRefs: v.array(v.string()),       // Paths in MEMORY.md
    
    // Metadata
    owner: v.string(),            // "user" or agentId
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_owner", ["owner"])
    .index("by_created_at", ["createdAt"])
    .index("by_parent", ["parentGoalId"]),

  /**
   * CALENDAR_EVENTS - Merged Timeline
   * Human calendar + AI-scheduled tasks in one view
   */
  calendarEvents: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    
    // Timing
    startTime: v.number(),        // Epoch ms
    endTime: v.number(),
    timezone: v.string(),         // "Europe/London"
    recurring: v.optional(v.object({
      rule: v.string(),           // RFC 5545 RRULE
      exceptions: v.optional(v.array(v.number())),
    })),
    
    // Type
    type: v.union(
      v.literal("human"),         // Manually created/synced
      v.literal("ai_task"),       // Task scheduled by AI
      v.literal("ai_workflow"),   // Recurring AI workflow
      v.literal("bot_generated")  // Generated by autonomous system
    ),
    
    // AI-specific
    taskId: v.optional(v.id("tasks")),
    generatedBy: v.optional(v.string()),  // Agent name
    executedAt: v.optional(v.number()),   // When task actually ran
    
    // Links
    goalIds: v.optional(v.array(v.id("goals"))),

    // Display
    color: v.optional(v.string()),  // hex or named color
    priority: v.optional(v.number()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
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
    entityType: v.union(
      v.literal("goal"),
      v.literal("task"),
      v.literal("event"),
      v.literal("note")
    ),
    entityId: v.string(),         // Goal/Task/Event ID
    
    // Link to memory
    memoryPath: v.string(),       // "MEMORY.md" or "memory/Projects/YouTube.md"
    memoryLineRange: v.optional(v.object({
      from: v.number(),
      to: v.number(),
    })),
    
    // Semantic metadata
    keywords: v.array(v.string()),
    relatedMemoryPaths: v.array(v.string()),
    
    lastSynced: v.number(),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_memory_path", ["memoryPath"])
    .index("by_last_synced", ["lastSynced"]),

  /**
   * STRATEGIC_REPORTS - Weekly Analysis
   * Generated reports on goal progress + recommendations
   */
  strategicReports: defineTable({
    week: v.number(),             // ISO week number
    year: v.number(),
    
    // Analysis
    goalsReview: v.object({
      activeGoals: v.number(),
      completedThisWeek: v.array(v.id("goals")),
      blockedGoals: v.array(v.id("goals")),
      acceleratingGoals: v.array(v.id("goals")),
    }),
    
    taskMetrics: v.object({
      tasksGenerated: v.number(),
      tasksCompleted: v.number(),
      avgCompletionRate: v.number(),  // percentage
      avgTimePerTask: v.number(),     // hours
      blockedBy: v.array(v.string()), // Goal titles
    }),
    
    insights: v.array(v.string()),
    recommendations: v.array(v.string()),
    
    createdAt: v.number(),
  })
    .index("by_week", ["year", "week"])
    .index("by_created_at", ["createdAt"]),

  /**
   * SETTINGS - Configuration
   * App-wide settings including ticket patterns for GitHub integration
   */
  settings: defineTable({
    key: v.string(),               // e.g., "ticketPattern", "githubRepo"
    value: v.string(),             // e.g., "[A-Z]+-\\d+", "owner/repo"
    updatedAt: v.number(),
  })
    .index("by_key", ["key"]),

  /**
   * EXECUTION_LOG - Task Execution History
   * Track when tasks run, outcomes, time spent
   */
  executionLog: defineTable({
    taskId: v.id("tasks"),
    agentId: v.optional(v.string()),  // who executed it
    
    status: v.union(
      v.literal("started"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("incomplete"),
      v.literal("retry")
    ),
    
    // Execution details
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    timeSpent: v.optional(v.number()),  // minutes
    
    // Outcomes
    output: v.optional(v.string()),
    error: v.optional(v.string()),
    nextAction: v.optional(v.string()),
    
    // Retry tracking
    attemptNumber: v.number(),
    maxAttempts: v.number(),
    
    createdAt: v.number(),
  })
    .index("by_task", ["taskId"])
    .index("by_status", ["status"])
    .index("by_agent", ["agentId"])
    .index("by_started_at", ["startedAt"]),

});
