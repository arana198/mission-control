/**
 * Actions Module
 * Execute management actions (escalate, reassign, unblock tasks)
 *
 * Phase 1: Error standardization - all mutations now use ApiError with request IDs
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ApiError, wrapConvexHandler } from "../lib/errors";

/**
 * Escalate a task to highest priority (P0)
 */
export const escalateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    reason: v.string(),
    decidedBy: v.string(),
  },
  handler: wrapConvexHandler(async (ctx, { taskId, reason, decidedBy }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw ApiError.notFound('Task', { taskId });

    if (task.priority === "P0") {
      throw ApiError.conflict('Task is already highest priority', { taskId, priority: task.priority });
    }

    // Update task priority to P0 (highest)
    await ctx.db.patch(taskId, {
      priority: "P0",
      updatedAt: Date.now(),
    });

    // Record decision
    const decisionId = await ctx.db.insert("decisions", {
      workspaceId: task.workspaceId,
      action: "escalated",
      taskId,
      reason,
      result: "success",
      decidedBy,
      decidedAt: Date.now(),
      createdAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      workspaceId: task.workspaceId,
      type: "task_updated",
      agentId: decidedBy,
      agentName: decidedBy,
      taskId,
      taskTitle: task.title,
      message: `Task escalated to P0. Reason: ${reason}`,
      createdAt: Date.now(),
    } as any);

    return {
      success: true,
      taskId,
      decisionId: decisionId,
      message: "Task escalated to high priority",
    };
  }),
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
  handler: wrapConvexHandler(async (ctx, { taskId, toAgent, reason, decidedBy }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw ApiError.notFound('Task', { taskId });

    const fromAgent = task.ownerId || "unassigned";
    if (fromAgent === toAgent) {
      throw ApiError.conflict('Task is already owned by this agent', { taskId, currentOwner: fromAgent });
    }

    // Update task assignment - set owner to new agent
    await ctx.db.patch(taskId, {
      ownerId: toAgent,
      status: "backlog", // Reset to backlog for new agent
      updatedAt: Date.now(),
    });

    // Record decision
    const decisionId = await ctx.db.insert("decisions", {
      workspaceId: task.workspaceId,
      action: "reassigned",
      taskId,
      fromAgent: fromAgent,
      toAgent,
      reason,
      result: "success",
      decidedBy,
      decidedAt: Date.now(),
      createdAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      workspaceId: task.workspaceId,
      type: "task_assigned",
      agentId: decidedBy,
      agentName: decidedBy,
      taskId,
      taskTitle: task.title,
      message: `Task reassigned from ${fromAgent} to ${toAgent}. Reason: ${reason}`,
      createdAt: Date.now(),
    } as any);

    return {
      success: true,
      taskId,
      decisionId: decisionId,
      fromAgent: fromAgent,
      toAgent,
      message: `Task reassigned to ${toAgent}`,
    };
  }),
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
  handler: wrapConvexHandler(async (ctx, { taskId, reason, decidedBy }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw ApiError.notFound('Task', { taskId });

    if (!task.blockedBy || task.blockedBy.length === 0) {
      throw ApiError.conflict('Task is not blocked', { taskId, blockedBy: task.blockedBy });
    }

    // Clear blocked status
    await ctx.db.patch(taskId, {
      blockedBy: [],
      updatedAt: Date.now(),
    });

    // Record decision
    const decisionId = await ctx.db.insert("decisions", {
      workspaceId: task.workspaceId,
      action: "unblocked",
      taskId,
      reason,
      result: "success",
      decidedBy,
      decidedAt: Date.now(),
      createdAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      workspaceId: task.workspaceId,
      type: "task_updated",
      agentId: decidedBy,
      agentName: decidedBy,
      taskId,
      taskTitle: task.title,
      message: `Task unblocked. Reason: ${reason}`,
      createdAt: Date.now(),
    } as any);

    return {
      success: true,
      taskId,
      decisionId: decisionId,
      message: "Task unblocked and ready to execute",
    };
  }),
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
  handler: wrapConvexHandler(async (ctx, { taskId, outcome, decidedBy }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw ApiError.notFound('Task', { taskId });

    if (task.status === "done") {
      throw ApiError.conflict('Task is already completed', { taskId, status: task.status });
    }

    // Mark as done
    await ctx.db.patch(taskId, {
      status: "done",
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Record decision
    const decisionId = await ctx.db.insert("decisions", {
      workspaceId: task.workspaceId,
      action: "marked_executed",
      taskId,
      reason: outcome,
      result: "success",
      decidedBy,
      decidedAt: Date.now(),
      createdAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      workspaceId: task.workspaceId,
      type: "task_completed",
      agentId: decidedBy,
      agentName: decidedBy,
      taskId,
      taskTitle: task.title,
      message: `Task marked as executed. Outcome: ${outcome}`,
      createdAt: Date.now(),
    } as any);

    return {
      success: true,
      taskId,
      decisionId: decisionId,
      message: "Task marked as completed",
    };
  }),
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
  handler: wrapConvexHandler(async (ctx, { taskId, reason, decidedBy }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw ApiError.notFound('Task', { taskId });

    if (task.priority === "P3") {
      throw ApiError.conflict('Task is already lowest priority', { taskId, priority: task.priority });
    }

    // Update task priority to P3 (lowest)
    await ctx.db.patch(taskId, {
      priority: "P3",
      updatedAt: Date.now(),
    });

    // Record decision
    const decisionId = await ctx.db.insert("decisions", {
      workspaceId: task.workspaceId,
      action: "deprioritized",
      taskId,
      reason,
      result: "success",
      decidedBy,
      decidedAt: Date.now(),
      createdAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      workspaceId: task.workspaceId,
      type: "task_updated",
      agentId: decidedBy,
      agentName: decidedBy,
      taskId,
      taskTitle: task.title,
      message: `Task deprioritized to P3. Reason: ${reason}`,
      createdAt: Date.now(),
    } as any);

    return {
      success: true,
      taskId,
      decisionId: decisionId,
      message: "Task deprioritized to P3 (lowest priority)",
    };
  }),
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
      .withIndex("by_task", (q: any) => q.eq("taskId", args.taskId))
      .collect();

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_task", (q: any) => q.eq("taskId", args.taskId))
      .collect();

    return {
      decisions: decisions.sort((a, b) => b.createdAt - a.createdAt),
      activities: activities.sort((a, b) => b.createdAt - a.createdAt),
      totalActions: decisions.length,
    };
  },
});
