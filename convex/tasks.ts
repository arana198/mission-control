import { v as convexVal } from "convex/values";
import { query, mutation, internalAction } from "./_generated/server";
import { api } from "./_generated/api";
import { detectCycle } from "./utils/graphValidation";
import { ROLE_KEYWORDS } from "./utils/roleKeywords";
import { CreateTaskSchema, UpdateTaskSchema, validateTaskInput, ValidationError } from "../lib/validators/taskValidators";
import { isTransitionAllowed, ALLOWED_TRANSITIONS } from "../lib/constants/taskTransitions";
import { resolveActorName } from "./utils/activityLogger";
import { canDeleteTask } from "../lib/auth/permissions";
import { syncEpicTaskLink } from "./utils/epicTaskSync";

/**
 * Task Management
 * Kanban-style work queue
 */

/**
 * CONSOLIDATED: Single create function handles both user and agent task creation
 * Replaces duplicate createWithAssignees() and create() functions
 */

/**
 * OBS-01: Infer tags from task title and description
 * Maps keywords to categories: api, ui, bug, auth, database, testing, docs, performance
 */
function inferTagsFromContent(title: string, description: string): string[] {
  const content = `${title} ${description}`.toLowerCase();
  const tags = new Set<string>();

  // Keyword mapping
  const keywordMap: Record<string, string[]> = {
    "api": ["api", "endpoint", "route", "rest", "graphql"],
    "ui": ["ui", "button", "modal", "component", "layout", "design", "styling", "css"],
    "bug": ["bug", "fix", "error", "crash", "broken", "issue", "defect"],
    "auth": ["auth", "login", "token", "session", "permission", "access", "security"],
    "database": ["db", "database", "schema", "query", "migration", "sql", "orm"],
    "testing": ["test", "spec", "coverage", "jest", "unit", "integration"],
    "docs": ["doc", "documentation", "readme", "guide", "tutorial", "manual"],
    "performance": ["perf", "performance", "speed", "optimize", "cache", "efficient"],
  };

  // Match keywords
  for (const [tag, keywords] of Object.entries(keywordMap)) {
    for (const keyword of keywords) {
      if (content.includes(keyword)) {
        tags.add(tag);
        break;
      }
    }
  }

  // Return max 5 tags, deduplicated
  return Array.from(tags).slice(0, 5);
}

export const createTask = mutation({
  args: {
    businessId: convexVal.id("businesses"),  // REQUIRED: business scoping
    title: convexVal.string(),
    description: convexVal.string(),
    priority: convexVal.optional(convexVal.union(convexVal.literal("P0"), convexVal.literal("P1"), convexVal.literal("P2"), convexVal.literal("P3"))),
    createdBy: convexVal.string(), // Can be agent ID or "user"
    source: convexVal.union(convexVal.literal("agent"), convexVal.literal("user")),
    assigneeIds: convexVal.optional(convexVal.array(convexVal.id("agents"))),
    tags: convexVal.optional(convexVal.array(convexVal.string())),
    timeEstimate: convexVal.optional(convexVal.union(convexVal.literal("XS"), convexVal.literal("S"), convexVal.literal("M"), convexVal.literal("L"), convexVal.literal("XL"))),
    dueDate: convexVal.optional(convexVal.number()),
    epicId: convexVal.id("epics"),  // REQUIRED: all tasks must belong to an epic
  },
  handler: async (
    ctx,
    {
      businessId,
      title,
      description,
      priority = "P2",
      createdBy,
      source,
      assigneeIds,
      tags = [],
      timeEstimate,
      dueDate,
      epicId,
    }
  ) => {
    // Validate input (M-01 fix: wire validators into mutations)
    try {
      validateTaskInput(CreateTaskSchema, {
        title,
        description,
        priority,
        assigneeIds,
        dueDate,
        epicId,
        timeEstimate,
        tags,
      });
    } catch (e: any) {
      if (e.name === "ValidationError") {
        throw new Error(`Validation failed: ${e.message} - ${JSON.stringify(e.errors)}`);
      }
      throw e;
    }

    // Determine default assignees based on source
    const defaultAssignees = source === "agent" && createdBy ? [createdBy as any] : [];
    const finalAssignees = assigneeIds && assigneeIds.length > 0 ? assigneeIds : defaultAssignees;

    // OBS-01: Apply inferred tags if none provided
    const finalTags = tags.length > 0 ? tags : inferTagsFromContent(title, description);

    // Create task (now includes businessId for multi-tenant isolation)
    const taskId = await ctx.db.insert("tasks", {
      businessId,  // ADD: business scoping
      title,
      description,
      status: "backlog",
      priority,
      ownerId: createdBy,
      assigneeIds: finalAssignees,
      timeEstimate,
      dueDate,
      epicId,
      createdBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: finalTags,
      receipts: [],
      subtaskIds: [],
      blockedBy: [],
      blocks: [],
      goalIds: [],
    });

    // DM-02: Update epic's taskIds array if epic is specified (C-06 fix: maintain denormalization)
    if (epicId) {
      await syncEpicTaskLink(ctx, taskId, undefined, epicId);
    }

    // TKT-01: Assign atomic ticket number per business (ACME-001, ACME-002... per business)
    const counterSetting = await ctx.db
      .query("settings")
      .withIndex("by_business_key", (q: any) => q.eq("businessId", businessId).eq("key", "taskCounter"))
      .first();
    const nextNum = counterSetting ? parseInt((counterSetting as any).value) + 1 : 1;

    // Get ticket prefix from business settings, fallback to "TASK"
    const prefixSetting = await ctx.db
      .query("settings")
      .withIndex("by_business_key", (q: any) => q.eq("businessId", businessId).eq("key", "ticketPrefix"))
      .first();
    const prefix = prefixSetting ? (prefixSetting as any).value : "TASK";

    const ticketNumber = `${prefix}-${String(nextNum).padStart(3, "0")}`;
    await ctx.db.patch(taskId, { ticketNumber } as any);

    // Upsert per-business counter in settings
    if (counterSetting) {
      await ctx.db.patch((counterSetting as any)._id, {
        value: String(nextNum),
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        businessId,  // ADD: business scoping
        key: "taskCounter",
        value: "1",
        updatedAt: Date.now(),
      });
    }

    // Log activity (LOG-01: resolve actor name)
    const actorName = await resolveActorName(ctx, createdBy);
    await ctx.db.insert("activities", {
      businessId,  // ADD: business scoping
      type: "task_created",
      agentId: createdBy,
      agentName: actorName,
      message: `Created task: ${title}`,
      taskId,
      taskTitle: title,
      createdAt: Date.now(),
    });

    // Create thread subscriptions for assignees
    for (const agentId of finalAssignees) {
      const existing = await ctx.db
        .query("threadSubscriptions")
        .withIndex("by_agent_task", (q) => q.eq("agentId", agentId).eq("taskId", taskId))
        .first();

      if (!existing) {
        await ctx.db.insert("threadSubscriptions", {
          businessId,  // ADD: business scoping
          agentId,
          taskId,
          level: "all",
          createdAt: Date.now(),
        });
      }
    }

    // CP-01: Recalculate epic progress if task has an epic
    if (epicId) {
      await ctx.runMutation(api.epics.recalculateEpicProgress, { epicId });
    }

    // REP-01: Track task creation by agent
    if (createdBy !== "user") {
      await ctx.runMutation(api.agentMetrics.upsertMetrics, {
        agentId: createdBy as any,
        tasksCreated: 1,
      });
    }

    return taskId;
  },
});

// Get all tasks (H-02 fix: removed message loading, reduces memory pressure)
// Comment counts available via separate query if needed
export const getAllTasks = query({
  args: {
    businessId: convexVal.id("businesses"),  // REQUIRED: business scoping
  },
  handler: async (ctx, { businessId }) => {
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .order("desc")
      .take(500);
    return allTasks;
  },
});

// Get message count for a task
export const getMessageCount = query({
  args: { taskId: convexVal.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .collect();
    return messages.length;
  },
});

// Get single task by ID
export const getTaskById = query({
  args: { taskId: convexVal.id("tasks") },
  handler: async (ctx, { taskId }) => {
    return await ctx.db.get(taskId);
  },
});

// Move task status (internal helper)
export const moveStatus = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    fromStatus: convexVal.string(),
    toStatus: convexVal.union(
      convexVal.literal("backlog"),
      convexVal.literal("ready"),
      convexVal.literal("in_progress"),
      convexVal.literal("review"),
      convexVal.literal("blocked"),
      convexVal.literal("done")
    ),
  },
  handler: async (ctx, { taskId, fromStatus, toStatus }) => {
    // TM-01: Validate state transition
    if (!isTransitionAllowed(fromStatus, toStatus)) {
      throw new Error(
        `Invalid transition: ${fromStatus} -> ${toStatus}. ` +
        `Allowed: ${ALLOWED_TRANSITIONS[fromStatus]?.join(", ") || "none"}`
      );
    }

    await ctx.db.patch(taskId, {
      status: toStatus,
      updatedAt: Date.now(),
      ...(toStatus === "in_progress" && !fromStatus.startsWith("in_progress") ? { startedAt: Date.now() } : {}),
      ...(toStatus === "done" ? { completedAt: Date.now() } : {}),
    });
    return { success: true };
  },
});

// Get tasks by status (L-02 fix: added limit to prevent large collections)
export const getByStatus = query({
  args: {
    businessId: convexVal.id("businesses"),  // REQUIRED: business scoping
    status: convexVal.union(
      convexVal.literal("backlog"),
      convexVal.literal("ready"),
      convexVal.literal("in_progress"),
      convexVal.literal("review"),
      convexVal.literal("done"),
      convexVal.literal("blocked")
    ),
    limit: convexVal.optional(convexVal.number()),
  },
  handler: async (ctx, { businessId, status, limit = 200 }) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_business_status", (q) => q.eq("businessId", businessId).eq("status", status))
      .order("desc")
      .take(limit);
  },
});

// Get tasks assigned to specific agent (H-01 fix: scope to active tasks only)
export const getForAgent = query({
  args: {
    businessId: convexVal.id("businesses"),  // REQUIRED: business scoping
    agentId: convexVal.id("agents"),
    limit: convexVal.optional(convexVal.number()), // Optional limit to prevent large scans
  },
  handler: async (ctx, { businessId, agentId, limit = 50 }) => {
    // Only load active/in-progress tasks to limit scope, not all tasks
    // Note: Convex doesn't support array membership queries via indexes
    // This is a known limitation - full scan is necessary here
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_business_status", (q) => q.eq("businessId", businessId).eq("status", "in_progress"))
      .take(limit * 2); // Load more than limit to account for filtering

    // Filter to assigned tasks
    const assigned = tasks.filter((task) => task.assigneeIds.includes(agentId));
    return assigned.slice(0, limit);
  },
});

// Get filtered tasks (for agent API queries)
export const getFiltered = query({
  args: {
    businessId: convexVal.id("businesses"),  // REQUIRED: business scoping
    agentId: convexVal.id("agents"),
    status: convexVal.optional(convexVal.string()),
    priority: convexVal.optional(convexVal.string()),
    assignedToMe: convexVal.optional(convexVal.boolean()),
    limit: convexVal.optional(convexVal.number()),
    offset: convexVal.optional(convexVal.number()),
  },
  handler: async (
    ctx,
    { businessId, agentId, status, priority, assignedToMe = false, limit = 50, offset = 0 }
  ) => {
    let tasks = await (status
      ? ctx.db.query("tasks").withIndex("by_business_status", (indexQuery) => indexQuery.eq("businessId", businessId).eq("status", status as any)).collect()
      : ctx.db.query("tasks").withIndex("by_business", (q) => q.eq("businessId", businessId)).collect());

    // Apply priority filter
    if (priority) {
      tasks = tasks.filter((task) => task.priority === priority);
    }

    // Filter to assigned tasks if requested
    if (assignedToMe) {
      tasks = tasks.filter((task) => task.assigneeIds.includes(agentId));
    }

    // Apply pagination and return enriched shape
    return tasks.slice(offset, offset + limit).map((task: any) => ({
      _id: task._id,
      ticketNumber: task.ticketNumber ?? null,
      title: task.title,
      status: task.status,
      priority: task.priority,
      assigneeIds: task.assigneeIds,
      tags: task.tags,
      dueDate: task.dueDate ?? null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }));
  },
});

// Assign task to agent(s)
export const assign = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    assigneeIds: convexVal.array(convexVal.id("agents")),
    assignedBy: convexVal.id("agents"),
  },
  handler: async (ctx, { taskId, assigneeIds, assignedBy }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    // Only transition to "ready" if task is currently in "backlog"
    const statusUpdate = task.status === "backlog" ? { status: "ready" as const } : {};

    await ctx.db.patch(taskId, {
      assigneeIds,
      ...statusUpdate,
      updatedAt: Date.now(),
    });

    // Log activity
    const assigneeNames = await Promise.all(
      assigneeIds.map(async (id) => {
        const agent = await ctx.db.get(id);
        return agent?.name || "Unknown";
      })
    );

    // L-04 fix: Use agent name, not ID, in activity log
    const assigner = await ctx.db.get(assignedBy);
    await ctx.db.insert("activities", {
      businessId: task.businessId,  // ADD: inherit businessId from task
      type: "task_assigned",
      agentId: assignedBy,
      agentName: assigner?.name || String(assignedBy),
      message: `Assigned "${task.title}" to ${assigneeNames.join(", ")}`,
      taskId,
      taskTitle: task.title,
      createdAt: Date.now(),
    });

    // Create thread subscriptions
    for (const agentId of assigneeIds) {
      const existing = await ctx.db
        .query("threadSubscriptions")
        .withIndex("by_agent_task", (q) => q.eq("agentId", agentId).eq("taskId", taskId))
        .first();

      if (!existing) {
        await ctx.db.insert("threadSubscriptions", {
          businessId: task.businessId,  // ADD: inherit businessId from task
          agentId,
          taskId,
          level: "all",
          createdAt: Date.now(),
        });
      }
    }

    return { success: true };
  },
});

// Update task status
export const updateStatus = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    status: convexVal.union(
      convexVal.literal("backlog"),
      convexVal.literal("ready"),
      convexVal.literal("in_progress"),
      convexVal.literal("review"),
      convexVal.literal("done"),
      convexVal.literal("blocked")
    ),
    updatedBy: convexVal.optional(convexVal.string()),
    receipts: convexVal.optional(convexVal.array(convexVal.string())),
  },
  handler: async (ctx, { taskId, status, updatedBy, receipts }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    const oldStatus = task.status;

    // TM-01: Validate state transition
    if (!isTransitionAllowed(oldStatus, status)) {
      throw new Error(
        `Invalid transition: ${oldStatus} -> ${status}. ` +
        `Allowed: ${ALLOWED_TRANSITIONS[oldStatus]?.join(", ") || "none"}`
      );
    }

    // Build update data with proper typing
    type ValidStatus = "backlog" | "ready" | "in_progress" | "review" | "blocked" | "done";

    interface UpdateData {
      status: ValidStatus;
      updatedAt: number;
      receipts?: string[];
      completedAt?: number;
    }

    const updateData: UpdateData = {
      status: status as ValidStatus,
      updatedAt: Date.now(),
    };

    if (receipts && receipts.length > 0) {
      updateData.receipts = [...(task.receipts || []), ...receipts];
    }

    if (status === "done") {
      updateData.completedAt = Date.now();
    }

    await ctx.db.patch(taskId, updateData);

    // Log activity (LOG-01: resolve actor name)
    const activityType = status === "done" ? "task_completed" : "task_updated";
    const actorId = updatedBy || "system";
    const actorName = await resolveActorName(ctx, actorId);
    await ctx.db.insert("activities", {
      businessId: task.businessId,  // ADD: inherit businessId from task
      type: activityType,
      agentId: actorId,
      agentName: actorName,
      message: `Task "${task.title}" ${status === "done" ? "completed" : `moved from ${oldStatus} to ${status}`}`,
      taskId,
      taskTitle: task.title,
      oldValue: oldStatus,
      newValue: status,
      createdAt: Date.now(),
    });

    // CP-01: Recalculate epic progress if task has an epic
    if (task.epicId) {
      await ctx.runMutation(api.epics.recalculateEpicProgress, { epicId: task.epicId });
    }

    // REP-01: Update agent metrics
    if (status === "done" && task.ownerId !== "user") {
      await ctx.runMutation(api.agentMetrics.upsertMetrics, {
        agentId: task.ownerId as any,
        tasksCompleted: 1,
      });
    } else if (status === "blocked" && task.ownerId !== "user") {
      await ctx.runMutation(api.agentMetrics.upsertMetrics, {
        agentId: task.ownerId as any,
        tasksBlocked: 1,
      });
    }

    return { success: true };
  },
});

// Get task with all details
export const getWithDetails = query({
  args: { taskId: convexVal.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) return null;

    const assignees = await Promise.all(
      task.assigneeIds.map((id) => ctx.db.get(id))
    );

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .order("desc")
      .take(50);

    return {
      ...task,
      assignees: assignees.filter(Boolean),
      messages,
    };
  },
});

// Update task (generic update)
export const update = mutation({
  args: {
    id: convexVal.id("tasks"),
    title: convexVal.optional(convexVal.string()),
    description: convexVal.optional(convexVal.string()),
    status: convexVal.optional(convexVal.union(
      convexVal.literal("backlog"),
      convexVal.literal("ready"),
      convexVal.literal("in_progress"),
      convexVal.literal("review"),
      convexVal.literal("done"),
      convexVal.literal("blocked")
    )),
    assigneeIds: convexVal.optional(convexVal.array(convexVal.id("agents"))),
    timeEstimate: convexVal.optional(convexVal.union(convexVal.literal("XS"), convexVal.literal("S"), convexVal.literal("M"), convexVal.literal("L"), convexVal.literal("XL"))),
    dueDate: convexVal.optional(convexVal.number()),
    epicId: convexVal.optional(convexVal.id("epics")),
  },
  handler: async (ctx, { id, ...updates }) => {
    const task = await ctx.db.get(id);
    if (!task) throw new Error("Task not found");

    // Validate input (M-01 fix: wire validators into mutations)
    try {
      validateTaskInput(UpdateTaskSchema, {
        taskId: id,
        ...updates,
      });
    } catch (e: any) {
      if (e.name === "ValidationError") {
        throw new Error(`Validation failed: ${e.message} - ${JSON.stringify(e.errors)}`);
      }
      throw e;
    }

    // Build patch object
    const patch: any = {
      updatedAt: Date.now(),
    };

    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.assigneeIds !== undefined) patch.assigneeIds = updates.assigneeIds;
    if (updates.timeEstimate !== undefined) patch.timeEstimate = updates.timeEstimate;
    if (updates.dueDate !== undefined) patch.dueDate = updates.dueDate;
    if (updates.epicId !== undefined) patch.epicId = updates.epicId;

    // TM-01: Validate state transition if status is being changed
    if (patch.status && patch.status !== task.status) {
      if (!isTransitionAllowed(task.status, patch.status)) {
        throw new Error(
          `Invalid transition: ${task.status} -> ${patch.status}. ` +
          `Allowed: ${ALLOWED_TRANSITIONS[task.status]?.join(", ") || "none"}`
        );
      }
    }

    await ctx.db.patch(id, patch);

    // DM-02: Sync epic relationship if epicId changed
    if (updates.epicId !== undefined && updates.epicId !== task.epicId) {
      await syncEpicTaskLink(ctx, id, task.epicId, updates.epicId);
    }

    // Log status change (LOG-01: resolve actor name)
    if (patch.status && patch.status !== task.status) {
      const actorName = await resolveActorName(ctx, "user");
      await ctx.db.insert("activities", {
        businessId: task.businessId,  // ADD: inherit businessId from task
        type: patch.status === "done" ? "task_completed" : "task_updated",
        agentId: "user",
        agentName: actorName,
        message: `Task "${task.title}" moved to ${patch.status.replace("_", " ")}`,
        taskId: id,
        taskTitle: task.title,
        oldValue: task.status,
        newValue: patch.status,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Get tasks in "ready" status with assignees (for auto-claim) (H-01 fix: pre-load agents)
export const getReadyWithAssignees = query({
  handler: async (ctx) => {
    const [tasks, allAgents] = await Promise.all([
      ctx.db
        .query("tasks")
        .withIndex("by_status", (q) => q.eq("status", "ready"))
        .collect(),
      ctx.db.query("agents").collect(), // Load all agents once, not N times
    ]);

    // Create agent map for O(1) lookup
    const agentMap = new Map(
      allAgents.map((a) => [a._id, { id: a._id, name: a.name, sessionKey: a.sessionKey }])
    );

    // Filter to only tasks with assignees and enrich with agent details
    const enriched = tasks
      .filter((t) => t.assigneeIds && t.assigneeIds.length > 0)
      .map((task) => {
        const assignees = task.assigneeIds
          .map((agentId) => agentMap.get(agentId))
          .filter((a) => a !== undefined) as any[];
        return {
          ...task,
          assignees,
        };
      });
    
    return enriched;
  },
});

/**
 * Auto-Claim System
 * Polls for tasks in "ready" status and notifies assigned agents
 * Called via cron every minute
 */
export const autoClaim = internalAction({
  handler: async (ctx): Promise<any> => {
    // Get all tasks in "ready" status with assignees
    const readyTasks: any = await ctx.runQuery(api.tasks.getReadyWithAssignees, {});

    if (readyTasks.length === 0) {
      return { notified: 0, tasks: [] };
    }

    const notifiedAgents = new Set();
    const results: any[] = [];

    for (const task of readyTasks) {
      for (const assignee of task.assignees) {
        // Skip if already notified this agent in this run
        if (notifiedAgents.has(assignee.id)) {
          continue;
        }

        try {
          // Check if agent already has wake request pending
          const existingWakes: any = await ctx.runQuery(api.wake.getPending, {});
          const alreadyPending = existingWakes.some(
            (w: any) => w.agentId === assignee.id && w.priority === "normal"
          );

          if (!alreadyPending) {
            // Create wake request for agent
            await ctx.runMutation(api.wake.requestWake, {
              agentId: assignee.id,
              requestedBy: "system:auto-claim",
              priority: "normal",
            });

            // Create notification for agent
            await ctx.runMutation(api.notifications.create, {
              recipientId: assignee.id,
              type: "assignment",
              content: `New task ready: "${task.title}" (Priority: ${task.priority})`,
              fromId: "system",
              fromName: "Mission Control",
              taskId: task._id,
              taskTitle: task.title,
            });

            notifiedAgents.add(assignee.id);
            results.push({
              taskId: task._id,
              taskTitle: task.title,
              agentId: assignee.id,
              agentName: assignee.name,
              status: "notified",
            });
          }
        } catch (err) {
          // Note: Notification failed - agent may not be reachable
          // Error details stored in results for audit trail
          results.push({
            taskId: task._id,
            taskTitle: task.title,
            agentId: assignee.id,
            agentName: assignee.name,
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // Log activity if any agents were notified
    // Note: Use businessId from first task (system action spans multiple businesses)
    if (notifiedAgents.size > 0 && readyTasks.length > 0) {
      await ctx.runMutation(api.activities.create, {
        businessId: readyTasks[0].businessId,
        type: "task_assigned",
        agentId: "system",
        agentName: "Mission Control",
        message: `Auto-claim: Notified ${notifiedAgents.size} agent(s) about ${readyTasks.length} ready task(s)`,
      });
    }

    return {
      notified: notifiedAgents.size,
      tasks: results,
    };
  },
});

// Unassign task (remove all assignees)
export const unassign = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    unassignedBy: convexVal.optional(convexVal.string()),
  },
  handler: async (ctx, { taskId, unassignedBy }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    const previousAssignees = task.assigneeIds;
    
    await ctx.db.patch(taskId, {
      assigneeIds: [],
      status: "backlog",
      updatedAt: Date.now(),
    });

    // Remove thread subscriptions for previous assignees
    for (const agentId of previousAssignees) {
      const sub = await ctx.db
        .query("threadSubscriptions")
        .withIndex("by_agent_task", (q) => q.eq("agentId", agentId).eq("taskId", taskId))
        .first();
      
      if (sub) {
        await ctx.db.delete(sub._id);
      }
    }

    // Log activity
    await ctx.db.insert("activities", {
      businessId: task.businessId,  // ADD: inherit businessId from task
      type: "task_updated",
      agentId: unassignedBy || "system",
      agentName: unassignedBy || "system",
      message: `Unassigned all agents from "${task.title}" — returned to backlog`,
      taskId,
      taskTitle: task.title,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// Smart assignment - Jarvis assigns based on task content
export const smartAssign = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    assignedBy: convexVal.optional(convexVal.id("agents")),
  },
  handler: async (ctx, { taskId, assignedBy }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    if (task.assigneeIds && task.assigneeIds.length > 0) {
      return { success: false, reason: "Already assigned" };
    }

    // Get all agents to analyze their roles
    const agents = await ctx.db.query("agents").collect();
    
    // Create role-keyword mapping for intelligent matching
    // Calculate match scores for each agent
    const searchText = `${task.title} ${task.description}`.toLowerCase();
    const matchedAgents: { agentId: any; name: string; score: number; reason: string }[] = [];

    for (const agent of agents) {
      const keywords = ROLE_KEYWORDS[agent.role] || [];
      const matchingKeywords: string[] = [];

      for (const keyword of keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          matchingKeywords.push(keyword);
        }
      }

      const score = matchingKeywords.length;
      if (score > 0) {
        matchedAgents.push({
          agentId: agent._id,
          name: agent.name,
          score,
          reason: `Matched keywords: ${matchingKeywords.join(", ")}`,
        });
      }
    }

    // Sort by score and pick best match(es)
    matchedAgents.sort((a, b) => b.score - a.score);

    let selectedAssignees: any[] = [];
    let assignmentReason = "";
    let bestMatch = matchedAgents[0];

    if (bestMatch && bestMatch.score >= 1) {
      // Best single match
      selectedAssignees = [bestMatch.agentId];
      assignmentReason = `Assigned to ${bestMatch.name} (${bestMatch.reason})`;
    } else {
      // Fallback to squad lead (Jarvis or first lead)
      const lead = agents.find(a => a.level === "lead") || agents[0];
      if (lead) {
        selectedAssignees = [lead._id];
        assignmentReason = `No strong match found — assigned to ${lead.name} (${lead.role}) for delegation`;
      }
    }

    if (selectedAssignees.length === 0) {
      return { success: false, reason: "No suitable agents found" };
    }

    // Update task
    await ctx.db.patch(taskId, {
      assigneeIds: selectedAssignees as any,
      status: "ready",
      updatedAt: Date.now(),
    });

    // Create thread subscriptions
    for (const agentId of selectedAssignees) {
      const existing = await ctx.db
        .query("threadSubscriptions")
        .withIndex("by_agent_task", (q) => q.eq("agentId", agentId as any).eq("taskId", taskId))
        .first();

      if (!existing) {
        await ctx.db.insert("threadSubscriptions", {
          businessId: task.businessId,  // ADD: inherit businessId from task
          agentId: agentId as any,
          taskId,
          level: "all",
          createdAt: Date.now(),
        });
      }
    }

    // Log activity (LOG-01: resolve actor name)
    const assigneeNames = selectedAssignees.map(id => {
      const agent = agents.find(a => a._id === id);
      return agent?.name || "Unknown";
    });

    const actorId = assignedBy?.toString() || "system:auto-assign";
    const actorName = await resolveActorName(ctx, actorId);
    await ctx.db.insert("activities", {
      businessId: task.businessId,  // ADD: inherit businessId from task
      type: "task_assigned",
      agentId: actorId,
      agentName: actorName,
      message: `Smart assigned "${task.title}" to ${assigneeNames.join(", ")} — ${assignmentReason}`,
      taskId,
      taskTitle: task.title,
      createdAt: Date.now(),
    });

    return {
      success: true,
      assignedTo: assigneeNames,
      reason: assignmentReason,
    };
  },
});

// Jarvis auto-assign all unassigned backlog tasks
// Helper function to find best agent for a task (H-03 fix: extracted to avoid mutation-calling-mutation)
// AA-02: Added workload balancing
async function findBestAgent(ctx: any, agents: any[], task: any) {
  // Load all in-progress tasks once to calculate workload
  const inProgressTasks = await ctx.db
    .query("tasks")
    .withIndex("by_status", (indexQuery: any) => indexQuery.eq("status", "in_progress"))
    .collect();

  // Count tasks per agent
  const agentTaskCounts = new Map<string, number>();
  for (const agent of agents) {
    agentTaskCounts.set(agent._id, 0);
  }
  for (const inProgressTask of inProgressTasks) {
    for (const assigneeId of inProgressTask.assigneeIds) {
      agentTaskCounts.set(
        assigneeId,
        (agentTaskCounts.get(assigneeId) ?? 0) + 1
      );
    }
  }

  const searchText = `${task.title} ${task.description}`.toLowerCase();
  const matchedAgents: {
    agentId: any;
    name: string;
    score: number;
    workload: number;
  }[] = [];

  for (const agent of agents) {
    const keywords = ROLE_KEYWORDS[agent.role] || [];
    let keywordScore = 0;

    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        keywordScore++;
      }
    }

    if (keywordScore > 0) {
      matchedAgents.push({
        agentId: agent._id,
        name: agent.name,
        score: keywordScore,
        workload: agentTaskCounts.get(agent._id) ?? 0,
      });
    }
  }

  // Score = keyword_score - (workload_penalty_per_task * active_tasks)
  // Workload penalty: each active task reduces score by 0.2
  const WORKLOAD_PENALTY_PER_TASK = 0.2;
  matchedAgents.sort((a, b) => {
    const scoreA = a.score - a.workload * WORKLOAD_PENALTY_PER_TASK;
    const scoreB = b.score - b.workload * WORKLOAD_PENALTY_PER_TASK;
    return scoreB - scoreA;
  });

  return (
    matchedAgents[0] ||
    (agents.find((a) => a.level === "lead") || agents[0])
  );
}

export const autoAssignBacklog = mutation({
  args: {
    jarvisId: convexVal.string(),
    limit: convexVal.optional(convexVal.number()),
  },
  handler: async (ctx, { jarvisId, limit = 10 }) => {
    // Pre-load agents and tasks once (H-03 fix: avoid N+1 and mutation-in-loop)
    const [tasks, agents] = await Promise.all([
      ctx.db.query("tasks")
        .withIndex("by_status", (q) => q.eq("status", "backlog"))
        .filter((q) => q.eq(q.field("assigneeIds"), []))
        .take(limit),
      ctx.db.query("agents").collect(),
    ]);

    const results: any[] = [];

    for (const task of tasks) {
      try {
        const bestAgent = await findBestAgent(ctx, agents, task);
        if (!bestAgent) throw new Error("No suitable agents found");

        await ctx.db.patch(task._id, {
          assigneeIds: [bestAgent.agentId],
          status: "ready",
          updatedAt: Date.now(),
        });

        results.push({
          taskId: task._id,
          taskTitle: task.title,
          success: true,
          assignedTo: bestAgent.name,
        });
      } catch (err) {
        results.push({
          taskId: task._id,
          taskTitle: task.title,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      processed: results.length,
      assigned: results.filter(r => r.success).length,
      results,
    };
  },
});

// Create subtask under parent task
export const createSubtask = mutation({
  args: {
    parentId: convexVal.id("tasks"),
    title: convexVal.string(),
    description: convexVal.optional(convexVal.string()),
    priority: convexVal.optional(convexVal.union(convexVal.literal("P0"), convexVal.literal("P1"), convexVal.literal("P2"), convexVal.literal("P3"))),
    createdBy: convexVal.string(),
  },
  handler: async (ctx, { parentId, title, description, priority, createdBy }) => {
    const parent = await ctx.db.get(parentId);
    if (!parent) throw new Error("Parent task not found");

    // Create subtask
    const subtaskId = await ctx.db.insert("tasks", {
      businessId: parent.businessId,  // ADD: inherit businessId from parent
      title,
      description: description || "",
      status: "backlog",
      priority: priority || "P2",
      parentId,
      epicId: parent.epicId,
      ownerId: createdBy,
      assigneeIds: [],
      createdBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      receipts: [],
      subtaskIds: [],
      blockedBy: [],
      blocks: [],
      goalIds: [],
    });

    // Update parent's subtask list
    await ctx.db.patch(parentId, {
      subtaskIds: [...(parent.subtaskIds || []), subtaskId],
      updatedAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      businessId: parent.businessId,  // ADD: inherit businessId from parent
      type: "task_created",
      agentId: createdBy,
      agentName: createdBy,
      message: `Created subtask "${title}" for "${parent.title}"`,
      taskId: subtaskId,
      taskTitle: title,
      createdAt: Date.now(),
    });

    return subtaskId;
  },
});

// Get task with subtasks
export const getWithSubtasks = query({
  args: { taskId: convexVal.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) return null;

    // Get subtasks
    const subtasks = await ctx.db
      .query("tasks")
      .withIndex("by_parent", (q) => q.eq("parentId", taskId))
      .collect();

    // Get assignees for main task
    const assignees = await Promise.all(
      task.assigneeIds.map((id) => ctx.db.get(id))
    );

    return {
      ...task,
      assignees: assignees.filter(Boolean),
      subtasks: subtasks,
      subtaskCount: subtasks.length,
      completedSubtasks: subtasks.filter(s => s.status === "done").length,
    };
  },
});

// Delete task (only creator or admin can delete)
export const deleteTask = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    deletedBy: convexVal.string(), // User ID or agent ID
  },
  handler: async (ctx, { taskId, deletedBy }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    // SEC-01: Verify deleter has permission (only creator or authorized system actors)
    if (!canDeleteTask(task, deletedBy)) {
      throw new Error("Unauthorized: only task creator can delete this task");
    }

    // Get task info for activity log before deletion
    const taskTitle = task.title;

    // Clean up dependency references in related tasks (CRITICAL FIX: C-05)
    // Remove this task from any tasks that block it
    for (const blockerId of task.blockedBy || []) {
      const blocker = await ctx.db.get(blockerId);
      if (blocker && blocker.blocks) {
        await ctx.db.patch(blockerId, {
          blocks: blocker.blocks.filter((id: string) => id !== taskId),
          updatedAt: Date.now(),
        });
      }
    }

    // Remove this task from any tasks it blocks
    for (const blockedId of task.blocks || []) {
      const blocked = await ctx.db.get(blockedId);
      if (blocked && blocked.blockedBy) {
        await ctx.db.patch(blockedId, {
          blockedBy: blocked.blockedBy.filter((id: string) => id !== taskId),
          updatedAt: Date.now(),
        });
      }
    }

    // Clean up epic taskIds reference (C-06 fix: maintain denormalization)
    if (task.epicId) {
      const epic = await ctx.db.get(task.epicId);
      if (epic && epic.taskIds) {
        await ctx.db.patch(task.epicId, {
          taskIds: epic.taskIds.filter((id: string) => id !== taskId),
          updatedAt: Date.now(),
        });
      }
    }

    // DM-01: Clean up parent's subtaskIds reference on subtask deletion
    if (task.parentId) {
      const parent = await ctx.db.get(task.parentId);
      if (parent && parent.subtaskIds) {
        await ctx.db.patch(task.parentId, {
          subtaskIds: parent.subtaskIds.filter((id: string) => id !== taskId),
          updatedAt: Date.now(),
        });
      }
    }

    // Delete all messages for this task
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .collect();

    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    // PERF-03: Delete thread subscriptions using by_task index
    const subscriptions = await ctx.db
      .query("threadSubscriptions")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .collect();

    for (const sub of subscriptions) {
      await ctx.db.delete(sub._id);
    }

    // PERF-03: Delete notifications for this task using by_task index
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .collect();

    for (const notif of notifications) {
      await ctx.db.delete(notif._id);
    }

    // Delete the task
    await ctx.db.delete(taskId);

    // Log activity
    await ctx.db.insert("activities", {
      businessId: task.businessId,
      type: "task_updated",
      agentId: deletedBy,
      agentName: deletedBy,
      message: `Deleted task: "${taskTitle}"`,
      taskTitle: taskTitle,
      createdAt: Date.now(),
    });

    return { success: true, deleted: taskTitle };
  },
});

/**
 * Add dependency between tasks with cycle detection
 *
 * Safe mutation for adding task dependencies that prevents circular references.
 * Validates that adding the dependency would not create a cycle.
 */
export const addDependency = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    blockedByTaskId: convexVal.id("tasks"),
    addedBy: convexVal.string(), // User ID or "system"
  },
  handler: async (ctx, { taskId, blockedByTaskId, addedBy }) => {
    // Validate tasks exist
    const task = await ctx.db.get(taskId);
    const blocker = await ctx.db.get(blockedByTaskId);

    if (!task) throw new Error("Task not found");
    if (!blocker) throw new Error("Blocking task not found");

    // Check self-reference
    if (taskId === blockedByTaskId) {
      throw new Error("A task cannot block itself");
    }

    // CRITICAL: Check for circular dependencies
    const wouldCreateCycle = await detectCycle(ctx, taskId, blockedByTaskId);
    if (wouldCreateCycle) {
      throw new Error("CIRCULAR_DEPENDENCY: Adding this dependency would create a circular reference");
    }

    // Update the task being blocked
    const updatedBlockedBy = [...(task.blockedBy || []), blockedByTaskId];
    await ctx.db.patch(taskId, {
      blockedBy: updatedBlockedBy,
      updatedAt: Date.now(),
    });

    // Update the blocking task
    const updatedBlocks = [...(blocker.blocks || []), taskId];
    await ctx.db.patch(blockedByTaskId, {
      blocks: updatedBlocks,
      updatedAt: Date.now(),
    });

    // TM-02: Auto-set blocked status when dependency is added
    // Only block if the blocker is not already done
    if (blocker.status !== "done" && task.status !== "done" && task.status !== "blocked") {
      await ctx.db.patch(taskId, {
        status: "blocked",
        updatedAt: Date.now(),
      });

      // Log the automatic status change
      await ctx.db.insert("activities", {
        businessId: task.businessId,
        type: "task_blocked",
        agentId: addedBy,
        agentName: addedBy,
        message: `Task "${task.title}" automatically blocked by "${blocker.title}"`,
        taskId,
        taskTitle: task.title,
        oldValue: task.status,
        newValue: "blocked",
        createdAt: Date.now(),
      });
    }

    // Log activity
    await ctx.db.insert("activities", {
      businessId: task.businessId,
      type: "dependency_added",
      agentId: addedBy,
      agentName: addedBy,
      message: `Added dependency: "${task.title}" is now blocked by "${blocker.title}"`,
      taskId,
      taskTitle: task.title,
      oldValue: undefined,
      newValue: blockedByTaskId,
      createdAt: Date.now(),
    });

    return { success: true, taskId, blockedByTaskId };
  },
});

/**
 * Remove dependency between tasks
 *
 * Safe mutation for removing task dependencies.
 */
export const removeDependency = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    blockedByTaskId: convexVal.id("tasks"),
    removedBy: convexVal.string(),
  },
  handler: async (ctx, { taskId, blockedByTaskId, removedBy }) => {
    // Validate tasks exist
    const task = await ctx.db.get(taskId);
    const blocker = await ctx.db.get(blockedByTaskId);

    if (!task) throw new Error("Task not found");
    if (!blocker) throw new Error("Blocking task not found");

    // Remove from blockedBy array
    const updatedBlockedBy = (task.blockedBy || []).filter((id) => id !== blockedByTaskId);
    await ctx.db.patch(taskId, {
      blockedBy: updatedBlockedBy,
      updatedAt: Date.now(),
    });

    // Remove from blocks array
    const updatedBlocks = (blocker.blocks || []).filter((id) => id !== taskId);
    await ctx.db.patch(blockedByTaskId, {
      blocks: updatedBlocks,
      updatedAt: Date.now(),
    });

    // TM-03: Auto-unblock when all blockers removed
    const remainingBlockers = updatedBlockedBy;
    const activeBlockers = await Promise.all(
      remainingBlockers.map((id) => ctx.db.get(id))
    );
    const hasActiveBlockers = activeBlockers.some(
      (b) => b && b.status !== "done"
    );

    if (!hasActiveBlockers && task.status === "blocked") {
      await ctx.db.patch(taskId, {
        status: "ready",
        updatedAt: Date.now(),
      });

      await ctx.db.insert("activities", {
        businessId: task.businessId,
        type: "task_updated",
        agentId: removedBy,
        agentName: removedBy,
        message: `Task "${task.title}" automatically unblocked — all dependencies cleared`,
        taskId,
        taskTitle: task.title,
        oldValue: "blocked",
        newValue: "ready",
        createdAt: Date.now(),
      });

      // Notify assignees that task is now unblocked
      for (const assigneeId of task.assigneeIds) {
        await ctx.db.insert("notifications", {
          recipientId: assigneeId,
          type: "dependency_unblocked",
          content: `Task "${task.title}" is now unblocked and ready to work on`,
          fromId: removedBy,
          fromName: removedBy,
          taskId,
          taskTitle: task.title,
          read: false,
          createdAt: Date.now(),
        });
      }
    }

    // Log activity
    await ctx.db.insert("activities", {
      businessId: task.businessId,
      type: "dependency_removed",
      agentId: removedBy,
      agentName: removedBy,
      message: `Removed dependency: "${task.title}" is no longer blocked by "${blocker.title}"`,
      taskId,
      taskTitle: task.title,
      oldValue: blockedByTaskId,
      newValue: undefined,
      createdAt: Date.now(),
    });

    return { success: true, taskId, blockedByTaskId };
  },
});

/**
 * Agent task completion
 * Atomic mutation: updates task, agent status, and logs activity in one transaction
 * Called by POST /api/agents/tasks/complete
 */
export const completeByAgent = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    agentId: convexVal.id("agents"),
    completionNotes: convexVal.optional(convexVal.string()),
    timeTracked: convexVal.optional(convexVal.number()),  // minutes
    status: convexVal.optional(convexVal.union(convexVal.literal("done"), convexVal.literal("review"))),
  },
  handler: async (ctx, { taskId, agentId, completionNotes, timeTracked, status = "done" }) => {
    // Fetch task and agent
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    const agent = await ctx.db.get(agentId);
    if (!agent) throw new Error("Agent not found");

    // Update task
    await ctx.db.patch(taskId, {
      status,
      completedAt: status === "done" ? Date.now() : undefined,
      completionNotes,
      timeTracked,
      updatedAt: Date.now(),
    });

    // Set agent to idle
    await ctx.db.patch(agentId, {
      status: "idle",
      currentTaskId: undefined,
      lastHeartbeat: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      businessId: task.businessId,
      type: "task_completed",
      agentId: agentId,
      agentName: agent.name,
      agentRole: agent.role,
      message: `${agent.name} completed: "${task.title}"`,
      taskId,
      taskTitle: task.title,
      oldValue: task.status,
      newValue: status,
      createdAt: Date.now(),
    });

    return { success: true, completedAt: Date.now() };
  },
});

// Add or remove tags from task
export const addTags = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    tags: convexVal.array(convexVal.string()),
    action: convexVal.union(convexVal.literal("add"), convexVal.literal("remove")),
    updatedBy: convexVal.optional(convexVal.string()),
  },
  handler: async (ctx, { taskId, tags, action, updatedBy }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    const currentTags = task.tags || [];
    let newTags = [...currentTags];

    if (action === "add") {
      // Add new tags, avoiding duplicates
      newTags = Array.from(new Set([...newTags, ...tags]));
    } else if (action === "remove") {
      // Remove specified tags
      newTags = newTags.filter((t) => !tags.includes(t));
    }

    await ctx.db.patch(taskId, {
      tags: newTags,
      updatedAt: Date.now(),
    });

    // Log activity
    const actorId = updatedBy || "system";
    const actorName = await resolveActorName(ctx, actorId);
    await ctx.db.insert("activities", {
      businessId: task.businessId,
      type: "tags_updated",
      agentId: actorId,
      agentName: actorName,
      message: `${action === "add" ? "Added tags" : "Removed tags"} on "${task.title}": ${tags.join(", ")}`,
      taskId,
      taskTitle: task.title,
      createdAt: Date.now(),
    });

    return { success: true, tags: newTags };
  },
});

/**
 * ============================================
 * Phase 1: Definition of Done Checklist
 * ============================================
 */

export const addChecklistItem = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    text: convexVal.string(),
    addedBy: convexVal.optional(convexVal.string()),
  },
  handler: async (ctx, { taskId, text, addedBy = "user" }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    // Generate UUID for item
    const itemId = crypto.randomUUID();
    const newItem = {
      id: itemId,
      text,
      completed: false,
      completedAt: undefined,
      completedBy: undefined,
    };

    const checklist = task.doneChecklist || [];
    checklist.push(newItem);

    await ctx.db.patch(taskId, {
      doneChecklist: checklist,
      updatedAt: Date.now(),
    });

    return { itemId, item: newItem };
  },
});

export const updateChecklistItem = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    itemId: convexVal.string(),
    completed: convexVal.boolean(),
    updatedBy: convexVal.optional(convexVal.string()),
  },
  handler: async (ctx, { taskId, itemId, completed, updatedBy = "user" }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    const checklist = task.doneChecklist || [];
    const itemIndex = checklist.findIndex((i) => i.id === itemId);

    if (itemIndex === -1) throw new Error("Checklist item not found");

    const now = Date.now();
    checklist[itemIndex] = {
      ...checklist[itemIndex],
      completed,
      completedAt: completed ? now : undefined,
      completedBy: completed ? updatedBy : undefined,
    };

    await ctx.db.patch(taskId, {
      doneChecklist: checklist,
      updatedAt: now,
    });

    return { success: true, item: checklist[itemIndex] };
  },
});

export const removeChecklistItem = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    itemId: convexVal.string(),
    removedBy: convexVal.optional(convexVal.string()),
  },
  handler: async (ctx, { taskId, itemId, removedBy = "user" }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    const checklist = task.doneChecklist || [];
    const filtered = checklist.filter((i) => i.id !== itemId);

    await ctx.db.patch(taskId, {
      doneChecklist: filtered,
      updatedAt: Date.now(),
    });

    return { success: true, remaining: filtered };
  },
});

/**
 * ============================================
 * Phase 1: Agent Inbox Query
 * ============================================
 */

export const getInboxForAgent = query({
  args: {
    businessId: convexVal.id("businesses"),
    agentId: convexVal.id("agents"),
  },
  handler: async (ctx, { businessId, agentId }) => {
    // Fetch all tasks for the business
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();

    // Filter tasks assigned to the agent
    const agentTasks = allTasks.filter((task) =>
      task.assigneeIds?.includes(agentId)
    );

    // Group by status
    const myTasks = agentTasks.filter((t) => t.status === "in_progress");
    const ready = agentTasks.filter((t) => t.status === "ready");
    const blocked = agentTasks.filter((t) => t.status === "blocked");
    const inReview = agentTasks.filter((t) => t.status === "review");

    // Only return last 10 completed tasks to avoid huge lists
    const done = agentTasks
      .filter((t) => t.status === "done")
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      .slice(0, 10);

    return {
      myTasks,
      ready,
      blocked,
      inReview,
      done,
      summary: {
        totalTasks: agentTasks.length,
        inProgress: myTasks.length,
        readyCount: ready.length,
        blockedCount: blocked.length,
        inReviewCount: inReview.length,
        completedCount: done.length,
      },
    };
  },
});
