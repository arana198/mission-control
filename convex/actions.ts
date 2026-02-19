/**
 * Actions Module
 * Execute management actions (escalate, reassign, unblock tasks)
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Escalate a task to highest priority (P0)
 */
export const escalateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    reason: v.string(),
    decidedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    if (task.priority === "P0") {
      throw new Error("Task is already highest priority");
    }

    // Update task priority to P0 (highest)
    await ctx.db.patch(args.taskId, {
      priority: "P0",
      updatedAt: Date.now(),
    });

    // Record decision
    const decisionId = await ctx.db.insert("decisions", {
      businessId: task.businessId,
      action: "escalated",
      taskId: args.taskId,
      reason: args.reason,
      result: "success",
      decidedBy: args.decidedBy,
      decidedAt: Date.now(),
      createdAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      businessId: task.businessId,
      type: "task_updated",
      agentId: args.decidedBy,
      agentName: args.decidedBy,
      taskId: args.taskId,
      taskTitle: task.title,
      message: `Task escalated to P0. Reason: ${args.reason}`,
      createdAt: Date.now(),
    } as any);

    return {
      success: true,
      taskId: args.taskId,
      decisionId: decisionId,
      message: "Task escalated to high priority",
    };
  },
});

/**
 * Reassign a task to a different agent
 */
export const reassignTask = mutation({
  args: {
    taskId: v.id("tasks"),
    fromAgent: v.optional(v.string()),
    toAgent: v.string(),
    reason: v.string(),
    decidedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const fromAgent = task.ownerId || "unassigned";
    if (fromAgent === args.toAgent) {
      throw new Error("Task is already owned by this agent");
    }

    // Update task assignment - set owner to new agent
    await ctx.db.patch(args.taskId, {
      ownerId: args.toAgent,
      status: "backlog", // Reset to backlog for new agent
      updatedAt: Date.now(),
    });

    // Record decision
    const decisionId = await ctx.db.insert("decisions", {
      businessId: task.businessId,
      action: "reassigned",
      taskId: args.taskId,
      fromAgent: fromAgent,
      toAgent: args.toAgent,
      reason: args.reason,
      result: "success",
      decidedBy: args.decidedBy,
      decidedAt: Date.now(),
      createdAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      businessId: task.businessId,
      type: "task_assigned",
      agentId: args.decidedBy,
      agentName: args.decidedBy,
      taskId: args.taskId,
      taskTitle: task.title,
      message: `Task reassigned from ${fromAgent} to ${args.toAgent}. Reason: ${args.reason}`,
      createdAt: Date.now(),
    } as any);

    return {
      success: true,
      taskId: args.taskId,
      decisionId: decisionId,
      fromAgent: fromAgent,
      toAgent: args.toAgent,
      message: `Task reassigned to ${args.toAgent}`,
    };
  },
});

/**
 * Unblock a task (clear blockedBy)
 */
export const unblockTask = mutation({
  args: {
    taskId: v.id("tasks"),
    reason: v.string(),
    decidedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    if (!task.blockedBy || task.blockedBy.length === 0) {
      throw new Error("Task is not blocked");
    }

    // Clear blocked status
    await ctx.db.patch(args.taskId, {
      blockedBy: [],
      updatedAt: Date.now(),
    });

    // Record decision
    const decisionId = await ctx.db.insert("decisions", {
      businessId: task.businessId,
      action: "unblocked",
      taskId: args.taskId,
      reason: args.reason,
      result: "success",
      decidedBy: args.decidedBy,
      decidedAt: Date.now(),
      createdAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      businessId: task.businessId,
      type: "task_updated",
      agentId: args.decidedBy,
      agentName: args.decidedBy,
      taskId: args.taskId,
      taskTitle: task.title,
      message: `Task unblocked. Reason: ${args.reason}`,
      createdAt: Date.now(),
    } as any);

    return {
      success: true,
      taskId: args.taskId,
      decisionId: decisionId,
      message: "Task unblocked and ready to execute",
    };
  },
});

/**
 * Mark task as executed/completed
 */
export const markExecuted = mutation({
  args: {
    taskId: v.id("tasks"),
    outcome: v.string(),
    decidedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    if (task.status === "done") {
      throw new Error("Task is already completed");
    }

    // Mark as done
    await ctx.db.patch(args.taskId, {
      status: "done",
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Record decision
    const decisionId = await ctx.db.insert("decisions", {
      businessId: task.businessId,
      action: "marked_executed",
      taskId: args.taskId,
      reason: args.outcome,
      result: "success",
      decidedBy: args.decidedBy,
      decidedAt: Date.now(),
      createdAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      businessId: task.businessId,
      type: "task_completed",
      agentId: args.decidedBy,
      agentName: args.decidedBy,
      taskId: args.taskId,
      taskTitle: task.title,
      message: `Task marked as executed. Outcome: ${args.outcome}`,
      createdAt: Date.now(),
    } as any);

    return {
      success: true,
      taskId: args.taskId,
      decisionId: decisionId,
      message: "Task marked as completed",
    };
  },
});

/**
 * Deprioritize a task
 */
export const deprioritizeTask = mutation({
  args: {
    taskId: v.id("tasks"),
    reason: v.string(),
    decidedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    if (task.priority === "P3") {
      throw new Error("Task is already lowest priority");
    }

    // Update task priority to P3 (lowest)
    await ctx.db.patch(args.taskId, {
      priority: "P3",
      updatedAt: Date.now(),
    });

    // Record decision
    const decisionId = await ctx.db.insert("decisions", {
      businessId: task.businessId,
      action: "deprioritized",
      taskId: args.taskId,
      reason: args.reason,
      result: "success",
      decidedBy: args.decidedBy,
      decidedAt: Date.now(),
      createdAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      businessId: task.businessId,
      type: "task_updated",
      agentId: args.decidedBy,
      agentName: args.decidedBy,
      taskId: args.taskId,
      taskTitle: task.title,
      message: `Task deprioritized to P3. Reason: ${args.reason}`,
      createdAt: Date.now(),
    } as any);

    return {
      success: true,
      taskId: args.taskId,
      decisionId: decisionId,
      message: "Task deprioritized to P3 (lowest priority)",
    };
  },
});

/**
 * Get action history for a task
 */
export const getTaskHistory = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    return {
      decisions: decisions.sort((a, b) => b.createdAt - a.createdAt),
      activities: activities.sort((a, b) => b.createdAt - a.createdAt),
      totalActions: decisions.length,
    };
  },
});
