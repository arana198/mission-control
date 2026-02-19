import { v as convexVal } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Migration utilities for data fixes and schema updates
 * This is backend code only - no "use client" directive
 */

/**
 * MIG-04: Multi-Business Support (2026-02-19)
 *
 * Schema changes:
 * - NEW TABLE: businesses (name, slug, color, emoji, isDefault, createdAt, updatedAt)
 * - Added businessId to: tasks, epics, goals, activities, documents, strategicReports, messages, threadSubscriptions, executionLog
 * - Modified settings table: added optional businessId (null=global, set=business-scoped)
 * - NOT modified: calendarEvents (stays globally shared), agents, agentMetrics, wakeRequests, notifications, memoryIndex
 *
 * Reason: Enable 2-5 businesses to share a single Mission Control instance with complete data isolation.
 * Per-business configuration (GitHub org/repo, ticket prefix, taskCounter), global settings (theme, features).
 *
 * Migration action:
 * 1. Create default business ("Mission Control Default") if no businesses exist
 * 2. Add businessId to all existing tasks, epics, goals, etc. (set to default business)
 * 3. Migrate global taskCounter to per-business counter
 * 4. Keep calendarEvents unchanged (globally shared for conflict detection)
 *
 * Idempotent: Check if businesses table has entries before creating default.
 */
export const migrationMultiBusinessSupport = mutation({
  args: {
    businessName: convexVal.optional(convexVal.string()),
    businessSlug: convexVal.optional(convexVal.string()),
    batchSize: convexVal.optional(convexVal.number()),
  },
  handler: async (ctx, { businessName = "Mission Control Default", businessSlug = "default", batchSize = 100 }) => {
    // Check if businesses exist
    const existingBusinesses = await ctx.db.query("businesses").collect();

    if (existingBusinesses.length === 0) {
      // Create default business
      const defaultBusiness = await ctx.db.insert("businesses", {
        name: businessName,
        slug: businessSlug,
        color: "#6366f1",
        emoji: "🚀",
        description: "Default business migration from single-business setup",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Migrate tasks - add businessId
      const tasks = await ctx.db.query("tasks").collect();
      const tasksBatch = tasks.slice(0, batchSize);

      for (const task of tasksBatch) {
        if (!task.businessId) {
          await ctx.db.patch(task._id, {
            businessId: defaultBusiness,
          });
        }
      }

      // Migrate epics - add businessId
      const epics = await ctx.db.query("epics").collect();
      const epicsBatch = epics.slice(0, batchSize);

      for (const epic of epicsBatch) {
        if (!epic.businessId) {
          await ctx.db.patch(epic._id, {
            businessId: defaultBusiness,
          });
        }
      }

      // Migrate goals - add businessId
      const goals = await ctx.db.query("goals").collect();
      const goalsBatch = goals.slice(0, batchSize);

      for (const goal of goalsBatch) {
        if (!goal.businessId) {
          await ctx.db.patch(goal._id, {
            businessId: defaultBusiness,
          });
        }
      }

      // Migrate activities - add businessId
      const activities = await ctx.db.query("activities").collect();
      const activitiesBatch = activities.slice(0, batchSize);

      for (const activity of activitiesBatch) {
        if (!activity.businessId) {
          await ctx.db.patch(activity._id, {
            businessId: defaultBusiness,
          });
        }
      }

      // Migrate documents - add businessId
      const documents = await ctx.db.query("documents").collect();
      const documentsBatch = documents.slice(0, batchSize);

      for (const document of documentsBatch) {
        if (!document.businessId) {
          await ctx.db.patch(document._id, {
            businessId: defaultBusiness,
          });
        }
      }

      // Migrate strategicReports - add businessId
      const reports = await ctx.db.query("strategicReports").collect();
      const reportsBatch = reports.slice(0, batchSize);

      for (const report of reportsBatch) {
        if (!report.businessId) {
          await ctx.db.patch(report._id, {
            businessId: defaultBusiness,
          });
        }
      }

      // Migrate messages - add businessId
      const messages = await ctx.db.query("messages").collect();
      const messagesBatch = messages.slice(0, batchSize);

      for (const message of messagesBatch) {
        if (!message.businessId) {
          await ctx.db.patch(message._id, {
            businessId: defaultBusiness,
          });
        }
      }

      // Migrate threadSubscriptions - add businessId
      const subscriptions = await ctx.db.query("threadSubscriptions").collect();
      const subscriptionsBatch = subscriptions.slice(0, batchSize);

      for (const sub of subscriptionsBatch) {
        if (!sub.businessId) {
          await ctx.db.patch(sub._id, {
            businessId: defaultBusiness,
          });
        }
      }

      // Migrate executionLog - add businessId
      const logs = await ctx.db.query("executionLog").collect();
      const logsBatch = logs.slice(0, batchSize);

      for (const log of logsBatch) {
        if (!log.businessId) {
          await ctx.db.patch(log._id, {
            businessId: defaultBusiness,
          });
        }
      }

      // Migrate global taskCounter to per-business counter
      const globalCounter = await ctx.db
        .query("settings")
        .withIndex("by_key", (q: any) => q.eq("key", "taskCounter"))
        .first();

      if (globalCounter && !globalCounter.businessId) {
        // Update existing to add businessId
        await ctx.db.patch(globalCounter._id, {
          businessId: defaultBusiness,
        });
      } else if (!globalCounter) {
        // Create new per-business counter
        await ctx.db.insert("settings", {
          key: "taskCounter",
          businessId: defaultBusiness,
          value: "0",
          updatedAt: Date.now(),
        });
      }

      return {
        success: true,
        defaultBusinessId: defaultBusiness,
        migratedTasks: Math.min(tasks.length, batchSize),
        migratedEpics: Math.min(epics.length, batchSize),
        migratedGoals: Math.min(goals.length, batchSize),
        migratedActivities: Math.min(activities.length, batchSize),
        migratedDocuments: Math.min(documents.length, batchSize),
        migratedReports: Math.min(reports.length, batchSize),
        migratedMessages: Math.min(messages.length, batchSize),
        migratedSubscriptions: Math.min(subscriptions.length, batchSize),
        migratedLogs: Math.min(logs.length, batchSize),
        message: "MIG-04: Multi-business support migration complete. Default business created and all entities migrated.",
      };
    }

    return {
      success: true,
      message: "MIG-04: Businesses already exist. No migration needed.",
    };
  },
});

/**
 * MIG-02: Add apiKey to agents table (2026-02-18)
 *
 * Schema change: Added `apiKey: convexVal.optional(convexVal.string())` field to agents table
 * and `by_api_key` index for efficient lookup.
 *
 * Reason: Enables the HTTP API auth layer. Agents register via
 * POST /api/agents/register to receive an apiKey for authentication.
 *
 * Migration action: None required. Optional fields are non-breaking in Convex.
 * Existing agents have no apiKey until they re-register via the API.
 */
export const migrateApiKeyDocumentation = mutation({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    const withoutKey = agents.filter((agent: any) => !agent.apiKey);
    return {
      totalAgents: agents.length,
      agentsWithoutApiKey: withoutKey.length,
      message: "MIG-02: apiKey field added. Agents can re-register to receive API keys.",
    };
  },
});

/**
 * MIG-03: Add ticketNumber to tasks table (2026-02-18)
 *
 * Schema change: Added `ticketNumber: convexVal.optional(convexVal.string())` field to tasks table.
 * Counter: Initializes "taskCounter" key in settings table.
 *
 * Reason: Provides stable, human-readable task IDs (MC-001, MC-002...) for agent
 * API consumers and activity log messages.
 *
 * Migration action: Assigns sequential ticket numbers to all existing tasks
 * ordered by _creationTime. Initializes taskCounter setting to the count.
 * Idempotent: skips tasks that already have ticketNumber.
 * If task count > 100, run repeatedly until patched === 0.
 */
export const migrateAddTicketNumbers = mutation({
  args: {},
  handler: async (ctx) => {
    // Load existing tasks ordered by creation time
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_created_at")
      .order("asc")
      .collect();

    const unpatched = tasks.filter((task: any) => !task.ticketNumber);

    // Find highest existing counter value
    const existingCounter = await ctx.db
      .query("settings")
      .withIndex("by_key", (indexQuery: any) => indexQuery.eq("key", "taskCounter"))
      .first();

    let counter = existingCounter ? parseInt((existingCounter as any).value) : 0;

    // Find tasks that already have ticketNumbers to set starting counter
    const patched = tasks.filter((task: any) => task.ticketNumber);
    if (patched.length > 0 && counter === 0) {
      // Extract highest number from existing tickets
      const nums = patched
        .map((task: any) => parseInt((task.ticketNumber as string).replace("MC-", "")))
        .filter((n: number) => !isNaN(n));
      counter = nums.length > 0 ? Math.max(...nums) : 0;
    }

    // Patch unpatched tasks in batch (Convex limit: 8192 writes/mutation)
    const BATCH_SIZE = 100;
    for (let batchIndex = 0; batchIndex < Math.min(unpatched.length, BATCH_SIZE); batchIndex++) {
      counter++;
      const ticketNumber = `MC-${String(counter).padStart(3, "0")}`;
      await ctx.db.patch((unpatched[batchIndex] as any)._id, { ticketNumber } as any);
    }

    // Upsert counter in settings
    if (existingCounter) {
      await ctx.db.patch((existingCounter as any)._id, {
        value: String(counter),
      });
    } else {
      await ctx.db.insert("settings", {
        key: "taskCounter",
        value: String(counter),
        updatedAt: Date.now(),
      });
    }

    return {
      patched: Math.min(unpatched.length, BATCH_SIZE),
      totalExisting: patched.length,
      counterNow: counter,
      message: `MIG-03: Assigned ticket numbers. Counter at ${counter}.`,
    };
  },
});

// Get all tasks without an epic
export const getTasksWithoutEpic = query({
  args: {},
  handler: async (ctx) => {
    const allTasks = await ctx.db.query("tasks").collect();
    return allTasks.filter(t => !t.epicId);
  },
});

// Get activities for a specific agent
export const getAgentActivities = query({
  args: { agentName: convexVal.string(), limit: convexVal.optional(convexVal.number()) },
  handler: async (ctx, { agentName, limit }) => {
    const activities = await ctx.db.query("activities")
      .order("desc")
      .take(limit || 50);
    
    // Filter activities related to this agent (by name)
    return activities.filter(a => 
      a.agentName === agentName ||
      (a.message && a.message.includes(agentName))
    );
  },
});

// Migrate tasks without epic to a default epic
// MIG-01: Add batch cap to migration
export const migrateTasksToEpic = mutation({
  args: {
    epicId: convexVal.optional(convexVal.id("epics")), // If provided, use this. Otherwise create one
    batchSize: convexVal.optional(convexVal.number()),
  },
  handler: async (ctx, { epicId, batchSize = 100 }) => {
    let targetEpicId = epicId;

    // If no epic provided, check if "General Tasks" exists
    if (!targetEpicId) {
      const allEpics = await ctx.db.query("epics").collect();
      const generalEpic = allEpics.find(e =>
        e.title.toLowerCase() === "general tasks" ||
        e.title.toLowerCase() === "general"
      );

      if (generalEpic) {
        targetEpicId = generalEpic._id;
      } else {
        // Create a default epic - get businessId from default business
        const lead = await ctx.db.query("agents").first();
        const defaultBusiness = await ctx.db
          .query("businesses")
          .withIndex("by_default", (q: any) => q.eq("isDefault", true))
          .first();

        const businessId = defaultBusiness?._id;
        if (!businessId) {
          throw new Error("No default business found. Cannot create epic.");
        }

        targetEpicId = await ctx.db.insert("epics", {
          businessId,
          title: "General Tasks",
          description: "Default epic for tasks that were created before epic association was required. Contains migrated tasks without an epic.",
          status: "active",
          taskIds: [],
          ownerId: lead?._id,
          progress: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    // Find all tasks without an epic
    const tasksWithoutEpic = await ctx.db.query("tasks").collect();
    const orphanedTasks = tasksWithoutEpic.filter(t => !t.epicId);

    let updatedCount = 0;
    const updatedTaskIds: string[] = [];

    // MIG-01: Process only up to batchSize to avoid timeout
    const batch = orphanedTasks.slice(0, batchSize);
    for (const task of batch) {
      await ctx.db.patch(task._id, {
        epicId: targetEpicId,
      });
      updatedCount++;
      updatedTaskIds.push(task._id);
    }

    // Update epic's taskIds list
    const epic = await ctx.db.get(targetEpicId);
    if (epic) {
      await ctx.db.patch(targetEpicId, {
        taskIds: [...epic.taskIds, ...updatedTaskIds] as any,
      });
    }

    // Note: Activity logging skipped for migrations
    if (updatedCount > 0) {
    }

    return {
      updatedCount,
      remaining: orphanedTasks.length - batch.length,
      epicId: targetEpicId,
      epicTitle: epic?.title || "General Tasks",
    };
  },
});

// Assign or update epic for specific task
export const assignEpic = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    epicId: convexVal.id("epics"),
    updatedBy: convexVal.string(),
  },
  handler: async (ctx, { taskId, epicId, updatedBy }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    const oldEpicId = task.epicId;
    const newEpic = await ctx.db.get(epicId);

    // Update task
    await ctx.db.patch(taskId, {
      epicId,
    });

    // Remove from old epic's taskIds if exists
    if (oldEpicId) {
      const oldEpic = await ctx.db.get(oldEpicId);
      if (oldEpic) {
        await ctx.db.patch(oldEpicId, {
          taskIds: oldEpic.taskIds.filter((id: string) => id !== taskId),
        });
      }
    }

    // Add to new epic's taskIds
    if (newEpic) {
      if (!newEpic.taskIds.includes(taskId)) {
        await ctx.db.patch(epicId, {
          taskIds: [...newEpic.taskIds, taskId],
        });
      }
    }

    // Note: Activity logging skipped for migrations

    return { success: true };
  },
});

// Smart assign tasks to epics based on content matching
// MIG-01: Add batch cap
export const smartAssignEpics = mutation({
  args: {
    batchSize: convexVal.optional(convexVal.number()),
  },
  handler: async (ctx, { batchSize = 100 }) => {
    const tasks = await ctx.db.query("tasks").collect();
    const epics = await ctx.db.query("epics").collect();

    const orphanedTasks = tasks.filter(t => !t.epicId);
    let assignedCount = 0;
    const assignments: { task: string; epic: string }[] = [];

    // Process only up to batchSize tasks
    const batch = orphanedTasks.slice(0, batchSize);
    for (const task of batch) {
      const text = `${task.title} ${task.description}`.toLowerCase();
      let bestEpic: typeof epics[0] | null = null;
      let bestScore = 0;

      for (const epic of epics) {
        const epicKeywords = getEpicKeywords(epic.title, epic.description);
        let score = 0;
        
        for (const keyword of epicKeywords) {
          if (text.includes(keyword.toLowerCase())) {
            score += 1;
            // Bonus for title match
            if (task.title.toLowerCase().includes(keyword.toLowerCase())) {
              score += 2;
            }
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestEpic = epic;
        }
      }

      // Only assign if we have a reasonable match (score >= 2)
      if (bestEpic && bestScore >= 2) {
        await ctx.db.patch(task._id, {
          epicId: bestEpic._id,
        });

        // Update epic's task list
        if (!bestEpic.taskIds.includes(task._id)) {
          await ctx.db.patch(bestEpic._id, {
            taskIds: [...bestEpic.taskIds, task._id],
          });
        }

        assignedCount++;
        assignments.push({ task: task.title, epic: bestEpic.title });
      }
    }

    // Note: Activity logging skipped for migrations
    if (assignedCount > 0) {
    }

    return {
      assignedCount,
      remaining: orphanedTasks.length - batch.length,
      assignments,
    };
  },
});

// Delete epic (reassigns tasks or deletes them)
// MIG-01: Add batch cap to prevent timeout
export const deleteEpic = mutation({
  args: {
    epicId: convexVal.id("epics"),
    reassignTo: convexVal.optional(convexVal.id("epics")), // If set, tasks move here. Otherwise tasks become orphaned
    deletedBy: convexVal.string(),
    batchSize: convexVal.optional(convexVal.number()),
  },
  handler: async (ctx, { epicId, reassignTo, deletedBy, batchSize = 100 }) => {
    const epic = await ctx.db.get(epicId);
    if (!epic) throw new Error("Epic not found");

    const taskIds = epic.taskIds || [];

    // MIG-01: Process only up to batchSize to avoid timeout
    const batch = taskIds.slice(0, batchSize);
    let affectedCount = 0;

    // Reassign or clear tasks
    if (reassignTo) {
      const targetEpic = await ctx.db.get(reassignTo);
      if (!targetEpic) throw new Error("Target epic not found");

      // Update batch of tasks to new epic
      for (const taskId of batch) {
        await ctx.db.patch(taskId as any, {
          epicId: reassignTo,
        });
        affectedCount++;
      }

      // Add tasks to target epic
      await ctx.db.patch(reassignTo, {
        taskIds: [...targetEpic.taskIds, ...(batch as string[])] as any,
      });
    } else {
      // Clear epic from tasks (they become orphaned)
      for (const taskId of batch) {
        await ctx.db.patch(taskId as any, {
          epicId: undefined,
        });
        affectedCount++;
      }
    }

    // Delete the epic (only if all tasks processed)
    if (batch.length === taskIds.length) {
      await ctx.db.delete(epicId);
    }

    // Note: Activity logging skipped for migrations

    return {
      success: true,
      tasksAffected: affectedCount,
      remaining: taskIds.length - batch.length,
    };
  },
});

// Update epic
export const updateEpic = mutation({
  args: {
    epicId: convexVal.id("epics"),
    title: convexVal.optional(convexVal.string()),
    description: convexVal.optional(convexVal.string()),
    status: convexVal.optional(convexVal.union(
      convexVal.literal("planning"),
      convexVal.literal("active"),
      convexVal.literal("completed")
    )),
    updatedBy: convexVal.string(),
  },
  handler: async (ctx, { epicId, title, description, status, updatedBy }) => {
    const epic = await ctx.db.get(epicId);
    if (!epic) throw new Error("Epic not found");

    const updates: any = { updatedAt: Date.now() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) {
      updates.status = status;
      // Update progress if completed
      if (status === "completed") {
        updates.progress = 100;
      } else if (status === "planning") {
        updates.progress = 0;
      }
    }

    await ctx.db.patch(epicId, updates);

    // Note: Activity logging skipped for migrations
    const changeType = status ? `marked ${status}` : "updated";

    return { success: true };
  },
});

// Update task (used by Roadmap for status/epic changes)
export const updateTask = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    title: convexVal.optional(convexVal.string()),
    status: convexVal.optional(convexVal.string()),
    priority: convexVal.optional(convexVal.string()),
    epicId: convexVal.optional(convexVal.id("epics")),
    description: convexVal.optional(convexVal.string()),
    timeEstimate: convexVal.optional(convexVal.string()),
    updatedBy: convexVal.string(),
  },
  handler: async (ctx, { taskId, title, status, priority, epicId, description, timeEstimate, updatedBy }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    const oldEpicId = task.epicId;
    const updates: any = { updatedAt: Date.now() };

    if (title !== undefined) updates.title = title;
    if (status !== undefined) {
      updates.status = status;
      if (status === "done" && !task.completedAt) {
        updates.completedAt = Date.now();
      }
    }
    if (priority !== undefined) updates.priority = priority;
    if (description !== undefined) updates.description = description;
    if (timeEstimate !== undefined) updates.timeEstimate = timeEstimate;
    if (epicId !== undefined) updates.epicId = epicId;

    await ctx.db.patch(taskId, updates);

    // Handle epic reassignment
    if (epicId !== undefined && oldEpicId !== epicId) {
      // Remove from old epic
      if (oldEpicId) {
        const oldEpic = await ctx.db.get(oldEpicId);
        if (oldEpic) {
          await ctx.db.patch(oldEpicId, {
            taskIds: oldEpic.taskIds.filter((id: string) => id !== taskId),
          });
        }
      }

      // Add to new epic
      if (epicId) {
        const newEpic = await ctx.db.get(epicId);
        if (newEpic) {
          if (!newEpic.taskIds.includes(taskId)) {
            await ctx.db.patch(epicId, {
              taskIds: [...newEpic.taskIds, taskId],
            });
          }
        }
      }
    }

    // Note: Activity logging skipped for migrations

    return { success: true };
  },
});

// Delete task
export const deleteTask = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    deletedBy: convexVal.string(),
  },
  handler: async (ctx, { taskId, deletedBy }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    // Remove from epic if assigned
    if (task.epicId) {
      const epic = await ctx.db.get(task.epicId);
      if (epic) {
        await ctx.db.patch(task.epicId, {
          taskIds: epic.taskIds.filter((id: string) => id !== taskId),
        });
      }
    }

    // Delete the task
    await ctx.db.delete(taskId);

    // Note: Activity logging skipped for migrations

    return { success: true };
  },
});

/**
 * MIG-05: Add ticketNumber to activities table (2026-02-19)
 *
 * Schema change:
 * - Added ticketNumber field to activities table for human-readable ticket reference
 *
 * Reason: Enable activities to display clickable ticket numbers (e.g., "MC-001") instead of just task IDs.
 * Improves UX by making activity log more human-readable and actionable.
 *
 * Migration action:
 * 1. For each activity with a taskId, fetch the task and update activity with its ticketNumber
 * 2. Idempotent: Skip if ticketNumber already exists
 */
export const migrationAddTicketNumberToActivities = mutation({
  args: {
    batchSize: convexVal.optional(convexVal.number()),
  },
  handler: async (ctx, { batchSize = 100 }) => {
    // Fetch all activities
    const allActivities = await ctx.db.query("activities").collect();

    let updatedCount = 0;
    const batch = allActivities.slice(0, batchSize);

    for (const activity of batch) {
      // Skip if already has ticketNumber
      if (activity.ticketNumber) {
        continue;
      }

      // Only process activities with taskId
      if (!activity.taskId) {
        continue;
      }

      try {
        const task = await ctx.db.get(activity.taskId);
        if (task && task.ticketNumber) {
          await ctx.db.patch(activity._id, {
            ticketNumber: task.ticketNumber,
          });
          updatedCount++;
        }
      } catch (e) {
        console.error(`[Migration] Failed to update activity ${activity._id}:`, e);
      }
    }

    return {
      success: true,
      message: `Updated ${updatedCount} activities with ticketNumber`,
      processedCount: batch.length,
      totalActivities: allActivities.length,
      remainingActivities: Math.max(0, allActivities.length - batchSize),
    };
  },
});

// Helper to extract keywords from epic title/description
function getEpicKeywords(title: string, description?: string): string[] {
  const text = `${title} ${description || ""}`;
  
  // Common keyword mappings for specific epics
  const keywordMappings: Record<string, string[]> = {
    "marketing": ["marketing", "campaign", "promotion", "social media", "ads", "advertising", "content", "blog", "seo"],
    "content": ["content", "blog", "article", "writing", "copy", "documentation", "guide", "tutorial"],
    "seo": ["seo", "search", "keywords", "ranking", "organic", "traffic"],
    "development": ["development", "code", "programming", "feature", "api", "backend", "frontend", "build"],
    "design": ["design", "ui", "ux", "mockup", "wireframe", "visual", "brand"],
    "infrastructure": ["infrastructure", "server", "deployment", "ci/cd", "devops", "hosting", "cloud"],
    "bug": ["bug", "fix", "issue", "error", "crash", "broken", "repair"],
    "research": ["research", "analysis", "investigate", "study", "survey", "data"],
    "product": ["product", "roadmap", "strategy", "planning", "road map"],
    "finance": ["finance", "payment", "billing", "invoice", "revenue", "money", "cost"],
    "legal": ["legal", "compliance", "gdpr", "privacy", "terms", "policy"],
    "general": ["general", "misc", "other"],
  };

  // Find matching keyword set
  const lowerTitle = title.toLowerCase();
  for (const [key, keywords] of Object.entries(keywordMappings)) {
    if (lowerTitle.includes(key)) {
      return keywords;
    }
  }

  // Default: extract words from title
  return title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
}

/**
 * MIG-05: Add Agent Workspace Paths (2026-02-19)
 *
 * Schema changes:
 * - Added workspacePath to agents table (required field)
 *
 * Reason: Store agent workspace directory paths for workspace viewer feature
 *
 * Migration action:
 * 1. For each agent without workspacePath, set to /Users/arana/.openclaw/workspace
 *
 * Idempotent: Check if workspacePath exists before updating.
 */
export const migrationAgentWorkspacePaths = mutation({
  args: {
    defaultWorkspacePath: convexVal.optional(convexVal.string()),
  },
  handler: async (ctx, { defaultWorkspacePath = "/Users/arana/.openclaw/workspace" }) => {
    const agents = await ctx.db.query("agents").collect();
    let updated = 0;

    for (const agent of agents) {
      if (!agent.workspacePath) {
        await ctx.db.patch(agent._id, {
          workspacePath: defaultWorkspacePath,
        });
        updated++;
      }
    }

    return {
      success: true,
      updated,
      total: agents.length,
      message: `Updated ${updated} agents with workspace path: ${defaultWorkspacePath}`,
    };
  },
});

/**
 * MIG-06: Add missionStatement to businesses (2026-02-19)
 *
 * Schema change:
 * - Added missionStatement field to businesses table (optional in schema, required in API)
 *
 * Reason: Enable businesses to define their purpose/mission, displayed on overview and
 * accessible to agents as context for their work.
 *
 * Migration action:
 * 1. For each business without missionStatement, set to their description or a default value
 * 2. Idempotent: skip if missionStatement already exists
 */
export const migrationAddMissionStatement = mutation({
  args: { defaultMissionStatement: convexVal.optional(convexVal.string()) },
  handler: async (ctx, { defaultMissionStatement = "To deliver exceptional value and solve real problems for our users." }) => {
    const businesses = await ctx.db.query("businesses").collect();
    let updated = 0;

    for (const b of businesses) {
      if (!(b as any).missionStatement) {
        await ctx.db.patch(b._id, {
          missionStatement: (b as any).description || defaultMissionStatement,
        } as any);
        updated++;
      }
    }

    return {
      success: true,
      updated,
      total: businesses.length,
      message: `MIG-06: Added missionStatement to ${updated} businesses.`,
    };
  },
});

/**
 * MIG-07: Add doneChecklist to tasks (2026-02-19)
 *
 * Schema change:
 * - Added doneChecklist field to tasks table (optional array of checklist items)
 * - doneChecklist format: Array<{ id, text, completed, completedAt?, completedBy? }>
 *
 * Reason: Enable agents to define and track Definition of Done criteria for tasks,
 * ensuring shared understanding of completion requirements between humans and AI.
 *
 * Migration action:
 * 1. For each existing task without doneChecklist, set to empty array []
 * 2. Idempotent: skip if doneChecklist already exists (check === undefined)
 * 3. Batch processing to avoid overwhelming the database
 */
export const migrationAddDoneChecklist = mutation({
  args: { batchSize: convexVal.optional(convexVal.number()) },
  handler: async (ctx, { batchSize = 200 }) => {
    const tasks = await ctx.db.query("tasks").collect();
    let patched = 0;

    const tasksBatch = tasks.slice(0, batchSize);
    for (const task of tasksBatch) {
      if ((task as any).doneChecklist === undefined) {
        await ctx.db.patch(task._id, {
          doneChecklist: [],
        } as any);
        patched++;
      }
    }

    return {
      success: true,
      patched,
      total: tasks.length,
      message: `MIG-07: Added doneChecklist to ${patched} tasks (batch ${batchSize}).`,
      remaining: tasks.length - patched,
    };
  },
});
