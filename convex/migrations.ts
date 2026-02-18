import { v as convexVal } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Migration utilities for data fixes and schema updates
 * This is backend code only - no "use client" directive
 */

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
        updatedAt: Date.now(),
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
        // Create a default epic
        const lead = await ctx.db.query("agents").first();
        targetEpicId = await ctx.db.insert("epics", {
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
        updatedAt: Date.now(),
      });
      updatedCount++;
      updatedTaskIds.push(task._id);
    }

    // Update epic's taskIds list
    const epic = await ctx.db.get(targetEpicId);
    if (epic) {
      await ctx.db.patch(targetEpicId, {
        taskIds: [...epic.taskIds, ...updatedTaskIds] as any,
        updatedAt: Date.now(),
      });
    }

    // Log activity
    if (updatedCount > 0) {
      await ctx.db.insert("activities", {
        type: "task_updated",
        agentId: "system",
        agentName: "System",
        message: `Migrated ${updatedCount} tasks without epic to "${epic?.title || 'General Tasks'}"`,
        createdAt: Date.now(),
      });
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
      updatedAt: Date.now(),
    });

    // Remove from old epic's taskIds if exists
    if (oldEpicId) {
      const oldEpic = await ctx.db.get(oldEpicId);
      if (oldEpic) {
        await ctx.db.patch(oldEpicId, {
          taskIds: oldEpic.taskIds.filter((id: string) => id !== taskId),
          updatedAt: Date.now(),
        });
      }
    }

    // Add to new epic's taskIds
    if (newEpic) {
      if (!newEpic.taskIds.includes(taskId)) {
        await ctx.db.patch(epicId, {
          taskIds: [...newEpic.taskIds, taskId],
          updatedAt: Date.now(),
        });
      }
    }

    // Log activity
    await ctx.db.insert("activities", {
      type: "task_updated",
      agentId: updatedBy,
      agentName: updatedBy,
      message: `Assigned "${task.title}" to epic "${newEpic?.title || 'Unknown'}"`,
      taskId,
      taskTitle: task.title,
      createdAt: Date.now(),
    });

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
          updatedAt: Date.now(),
        });

        // Update epic's task list
        if (!bestEpic.taskIds.includes(task._id)) {
          await ctx.db.patch(bestEpic._id, {
            taskIds: [...bestEpic.taskIds, task._id],
            updatedAt: Date.now(),
          });
        }

        assignedCount++;
        assignments.push({ task: task.title, epic: bestEpic.title });
      }
    }

    // Log activity
    if (assignedCount > 0) {
      await ctx.db.insert("activities", {
        type: "task_updated",
        agentId: "system",
        agentName: "System",
        message: `Smart-assigned ${assignedCount} tasks to epics based on content matching`,
        createdAt: Date.now(),
      });
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
          updatedAt: Date.now(),
        });
        affectedCount++;
      }

      // Add tasks to target epic
      await ctx.db.patch(reassignTo, {
        taskIds: [...targetEpic.taskIds, ...(batch as string[])] as any,
        updatedAt: Date.now(),
      });
    } else {
      // Clear epic from tasks (they become orphaned)
      for (const taskId of batch) {
        await ctx.db.patch(taskId as any, {
          epicId: undefined,
          updatedAt: Date.now(),
        });
        affectedCount++;
      }
    }

    // Delete the epic (only if all tasks processed)
    if (batch.length === taskIds.length) {
      await ctx.db.delete(epicId);
    }

    // Log activity
    await ctx.db.insert("activities", {
      type: "epic_completed",
      agentId: deletedBy,
      agentName: deletedBy,
      message: `Deleted epic "${epic.title}"${reassignTo ? " (tasks reassigned)" : " (tasks unassigned)"}`,
      createdAt: Date.now(),
    });

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

    // Log activity
    const changeType = status ? `marked ${status}` : "updated";
    await ctx.db.insert("activities", {
      type: "task_updated",
      agentId: updatedBy,
      agentName: updatedBy,
      message: `${changeType} epic "${title || epic.title}"`,
      createdAt: Date.now(),
    });

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
            updatedAt: Date.now(),
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
              updatedAt: Date.now(),
            });
          }
        }
      }
    }

    // Log activity
    await ctx.db.insert("activities", {
      type: "task_updated",
      agentId: updatedBy,
      agentName: updatedBy,
      message: `Updated task "${task.title}"${status ? ` to ${status}` : ""}`,
      taskId,
      taskTitle: task.title,
      createdAt: Date.now(),
    });

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
          updatedAt: Date.now(),
        });
      }
    }

    // Delete the task
    await ctx.db.delete(taskId);

    // Log activity
    await ctx.db.insert("activities", {
      type: "task_updated",
      agentId: deletedBy,
      agentName: deletedBy,
      message: `Deleted task "${task.title}"`,
      createdAt: Date.now(),
    });

    return { success: true };
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
