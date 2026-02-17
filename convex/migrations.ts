import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Migration utilities for data fixes and schema updates
 * This is backend code only - no "use client" directive
 */

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
  args: { agentName: v.string(), limit: v.optional(v.number()) },
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
    epicId: v.optional(v.id("epics")), // If provided, use this. Otherwise create one
    batchSize: v.optional(v.number()),
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
    taskId: v.id("tasks"),
    epicId: v.id("epics"),
    updatedBy: v.string(),
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
    batchSize: v.optional(v.number()),
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
    epicId: v.id("epics"),
    reassignTo: v.optional(v.id("epics")), // If set, tasks move here. Otherwise tasks become orphaned
    deletedBy: v.string(),
    batchSize: v.optional(v.number()),
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
    epicId: v.id("epics"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("planning"),
      v.literal("active"),
      v.literal("completed")
    )),
    updatedBy: v.string(),
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
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    epicId: v.optional(v.id("epics")),
    description: v.optional(v.string()),
    timeEstimate: v.optional(v.string()),
    updatedBy: v.string(),
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
    taskId: v.id("tasks"),
    deletedBy: v.string(),
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
