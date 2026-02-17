import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Epic Management
 * Strategic initiatives and roadmap tracking
 */

// Get all epics
export const getAll = query({
  handler: async (ctx) => {
    return await ctx.db.query("epics").order("desc").take(500);
  },
});

// Get epic with details
export const getWithDetails = query({
  args: { epicId: v.id("epics") },
  handler: async (ctx, { epicId }) => {
    const epic = await ctx.db.get(epicId);
    if (!epic) return null;

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_epic", (q) => q.eq("epicId", epicId))
      .collect();

    return {
      ...epic,
      tasks,
      progress: tasks.length > 0
        ? Math.round((tasks.filter(t => t.status === "done").length / tasks.length) * 100)
        : 0,
    };
  },
});

// Create epic
export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    ownerId: v.optional(v.id("agents")),
  },
  handler: async (ctx, { title, description, ownerId }) => {
    const epicId = await ctx.db.insert("epics", {
      title,
      description,
      status: "planning",
      progress: 0,
      taskIds: [],
      ownerId: ownerId as any,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Log activity
    const ownerName = ownerId ? (await ctx.db.get(ownerId))?.name : "system";
    await ctx.db.insert("activities", {
      type: "epic_created",
      agentId: ownerId ? ownerId : "system",
      agentName: ownerName || "system",
      message: `Created epic: ${title}`,
      epicId,
      epicTitle: title,
      createdAt: Date.now(),
    });

    return epicId;
  },
});

// Update epic
export const update = mutation({
  args: {
    id: v.id("epics"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("planning"), v.literal("active"), v.literal("completed"))),
  },
  handler: async (ctx, { id, ...updates }) => {
    const epic = await ctx.db.get(id);
    if (!epic) throw new Error("Epic not found");

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    // Log status change (only when completed)
    if (updates.status === "completed" && updates.status !== epic.status) {
      await ctx.db.insert("activities", {
        type: "epic_completed",
        agentId: "system",
        agentName: "system",
        message: `Epic "${epic.title}" completed`,
        epicId: id,
        epicTitle: epic.title,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Delete epic
export const remove = mutation({
  args: { id: v.id("epics") },
  handler: async (ctx, { id }) => {
    const epic = await ctx.db.get(id);
    if (!epic) throw new Error("Epic not found");

    // Clear epic references from tasks
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_epic", (q) => q.eq("epicId", id))
      .collect();

    for (const task of tasks) {
      await ctx.db.patch(task._id, { epicId: undefined });
    }

    // Delete the epic
    await ctx.db.delete(id);

    return { success: true };
  },
});

// Internal: Recalculate epic progress (called when tasks change)
export const recalculateEpicProgress = mutation({
  args: { epicId: v.id("epics") },
  handler: async (ctx, { epicId }) => {
    const epic = await ctx.db.get(epicId);
    if (!epic) return;

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_epic", (q) => q.eq("epicId", epicId))
      .collect();

    const doneCount = tasks.filter(t => t.status === "done").length;
    const newProgress = tasks.length > 0
      ? Math.round((doneCount / tasks.length) * 100)
      : 0;

    // Update epic progress and completedAt
    const patch: any = {
      progress: newProgress,
      updatedAt: Date.now(),
    };

    // Set completedAt when reaching 100%
    if (newProgress === 100 && !epic.completedAt) {
      patch.completedAt = Date.now();
      patch.status = "completed";
    }

    await ctx.db.patch(epicId, patch);
  },
});
