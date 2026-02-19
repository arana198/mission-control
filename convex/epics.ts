import { v as convexVal } from "convex/values";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Epic Management
 * Strategic initiatives and roadmap tracking
 */

// Get all epics
export const getAllEpics = query({
  args: {
    businessId: convexVal.id("businesses"),  // REQUIRED: business scoping
  },
  handler: async (ctx, { businessId }) => {
    return await ctx.db
      .query("epics")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .order("desc")
      .take(500);
  },
});

// Get epic with details
export const getEpicWithDetails = query({
  args: {
    epicId: convexVal.id("epics"),
    businessId: convexVal.id("businesses"),  // REQUIRED: business scoping
  },
  handler: async (ctx, { epicId, businessId }) => {
    const epic = await ctx.db.get(epicId);
    if (!epic) return null;

    // Verify epic belongs to the requested business
    if (epic.businessId !== businessId) {
      throw new Error("Epic does not belong to this business");
    }

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .filter((q) => q.eq(q.field("epicId"), epicId))
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
export const createEpic = mutation({
  args: {
    businessId: convexVal.id("businesses"),  // REQUIRED: business scoping
    title: convexVal.string(),
    description: convexVal.string(),
    ownerId: convexVal.optional(convexVal.id("agents")),
  },
  handler: async (ctx, { businessId, title, description, ownerId }) => {
    const epicId = await ctx.db.insert("epics", {
      businessId,  // ADD: business scoping
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
      businessId,  // ADD: business scoping
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
export const updateEpic = mutation({
  args: {
    businessId: convexVal.id("businesses"),  // REQUIRED: business scoping
    epicId: convexVal.id("epics"),
    title: convexVal.optional(convexVal.string()),
    description: convexVal.optional(convexVal.string()),
    status: convexVal.optional(convexVal.union(convexVal.literal("planning"), convexVal.literal("active"), convexVal.literal("completed"))),
  },
  handler: async (ctx, { businessId, epicId, ...updates }) => {
    const epic = await ctx.db.get(epicId);
    if (!epic) throw new Error("Epic not found");

    // Verify epic belongs to the requested business
    if (epic.businessId !== businessId) {
      throw new Error("Epic does not belong to this business");
    }

    await ctx.db.patch(epicId, {
      ...updates,
      updatedAt: Date.now(),
    });

    // Log status change (only when completed)
    if (updates.status === "completed" && updates.status !== epic.status) {
      await ctx.db.insert("activities", {
        businessId,  // ADD: business scoping
        type: "epic_completed",
        agentId: "system",
        agentName: "system",
        message: `Epic "${epic.title}" completed`,
        epicId,
        epicTitle: epic.title,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Delete epic
export const deleteEpic = mutation({
  args: { epicId: convexVal.id("epics") },
  handler: async (ctx, { epicId }) => {
    const epic = await ctx.db.get(epicId);
    if (!epic) throw new Error("Epic not found");

    // Clear epic references from tasks
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_epic", (q) => q.eq("epicId", epicId))
      .collect();

    for (const task of tasks) {
      await ctx.db.patch(task._id, { epicId: undefined });
    }

    // Delete the epic
    await ctx.db.delete(epicId);

    return { success: true };
  },
});

// Internal: Recalculate epic progress (called when tasks change)
export const recalculateEpicProgress = mutation({
  args: { epicId: convexVal.id("epics") },
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
