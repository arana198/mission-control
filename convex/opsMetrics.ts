/**
 * Ops Metrics Module
 * Real-time operational state snapshots for OpenClaw
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Helper function to calculate metrics snapshot
 */
async function calculateSnapshot(ctx: any, businessId: any) {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  // Get all agents
  const allAgents = await ctx.db.query("agents").collect();
  const activeAgents = allAgents.filter((a: any) => a.status === "active");
  const idleAgents = allAgents.filter((a: any) => a.status === "idle");
  const blockedAgents = allAgents.filter((a: any) => a.status === "blocked");

  // Get all tasks for this business
  const allTasks = await ctx.db
    .query("tasks")
    .withIndex("by_business", (q: any) => q.eq("businessId", businessId))
    .collect();

  // Queue depth - backlog tasks (tasks waiting to be started)
  const pendingTasks = allTasks.filter((t: any) => t.status === "backlog");

  // In progress tasks
  const inProgressTasks = allTasks.filter((t: any) => t.status === "in_progress");

  // Blocked tasks - in progress but not updated for 20+ minutes
  const BLOCKED_THRESHOLD = 20 * 60 * 1000; // 20 minutes
  const blockedTasks = inProgressTasks.filter((t: any) => now - t.updatedAt > BLOCKED_THRESHOLD);

  // Overdue tasks - past due date and not done
  const overdueTasks = allTasks.filter(
    (t: any) => t.dueDate && t.dueDate < now && t.status !== "done"
  );

  // Completed tasks in last hour
  const completedRecently = allTasks.filter(
    (t: any) => t.status === "done" && t.completedAt && t.completedAt > oneHourAgo
  );

  // Average task completion time (for completed tasks)
  let avgCompletionTime = 0;
  if (completedRecently.length > 0) {
    const totalTime = completedRecently.reduce((sum: number, t: any) => {
      if (t.completedAt && t.createdAt) {
        return sum + (t.completedAt - t.createdAt);
      }
      return sum;
    }, 0);
    avgCompletionTime = Math.round(totalTime / completedRecently.length / 1000 / 60); // minutes
  }

  // High priority pending tasks (P0 = highest)
  const highPriorityPending = pendingTasks.filter((t: any) => t.priority === "P0" || t.priority === "P1");

  return {
    timestamp: now,
    businessId: businessId,

    // Agent metrics
    agents: {
      total: allAgents.length,
      active: activeAgents.length,
      idle: idleAgents.length,
      blocked: blockedAgents.length,
    },

    // Queue metrics
    queue: {
      depth: pendingTasks.length,
      highPriority: highPriorityPending.length,
    },

    // Task status breakdown
    tasks: {
      total: allTasks.length,
      pending: pendingTasks.length,
      inProgress: inProgressTasks.length,
      completed: allTasks.filter((t: any) => t.status === "done").length,
      blocked: blockedTasks.length,
      overdue: overdueTasks.length,
    },

    // Throughput metrics
    throughput: {
      tasksPerHour: completedRecently.length,
      avgCompletionTimeMinutes: avgCompletionTime,
    },

    // Blocked tasks detail
    blockedTasksDetail: blockedTasks.map((t: any) => ({
      id: t._id,
      title: t.title,
      blockedForMinutes: Math.floor((now - t.updatedAt) / 1000 / 60),
      assignedTo: t.ownerId,
      priority: t.priority,
    })),

    // Overdue tasks detail
    overdueTasksDetail: overdueTasks.map((t: any) => ({
      id: t._id,
      title: t.title,
      dueDate: t.dueDate,
      overdueDays: Math.floor((now - (t.dueDate || 0)) / 1000 / 60 / 60 / 24),
      assignedTo: t.ownerId,
      priority: t.priority,
    })),

    // Health indicators
    health: {
      queueHealthy: pendingTasks.length < 10, // < 10 is healthy
      blockedHealthy: blockedTasks.length === 0,
      throughputHealthy: completedRecently.length > 0, // at least 1 task/hour
      agentHealthy: activeAgents.length > 0,
    },
  };
}

/**
 * Get current operational metrics snapshot
 * This is the heart of the state engine - provides current system state
 */
export const getSnapshot = query({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    return await calculateSnapshot(ctx, args.businessId);
  },
});

/**
 * Get historical metrics over time
 */
export const getTimeSeries = query({
  args: {
    businessId: v.id("businesses"),
    metricType: v.union(
      v.literal("queue_depth"),
      v.literal("throughput"),
      v.literal("blocked_tasks"),
      v.literal("agent_status")
    ),
    hoursBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hoursBack = args.hoursBack || 24;
    const sinceTime = Date.now() - hoursBack * 60 * 60 * 1000;

    // Get all activities in the time range
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_business_created_at", (q: any) =>
        q.eq("businessId", args.businessId).gt("createdAt", sinceTime)
      )
      .collect();

    // Build time series based on activities
    const timeSeries: Record<number, any> = {};

    for (const activity of activities) {
      const bucket = Math.floor(activity.createdAt / (15 * 60 * 1000)) * (15 * 60 * 1000); // 15 min buckets

      if (!timeSeries[bucket]) {
        timeSeries[bucket] = {
          timestamp: bucket,
          [args.metricType]: 0,
        };
      }

      if (args.metricType === "queue_depth" && activity.type === "task_created") {
        timeSeries[bucket][args.metricType]++;
      } else if (args.metricType === "throughput" && activity.type === "task_completed") {
        timeSeries[bucket][args.metricType]++;
      } else if (args.metricType === "blocked_tasks" && activity.type === "task_blocked") {
        timeSeries[bucket][args.metricType]++;
      } else if (args.metricType === "agent_status" && activity.type === "agent_status_changed") {
        // Track agent status
      }
    }

    return Object.values(timeSeries).sort((a, b) => a.timestamp - b.timestamp);
  },
});

/**
 * Check if system has critical issues
 */
export const getHealthStatus = query({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const metrics = await calculateSnapshot(ctx, args.businessId);

    const issues: string[] = [];
    const warnings: string[] = [];

    // Critical issues
    if (metrics.queue.depth > 20) {
      issues.push("Queue depth critically high (> 20)");
    }
    if (metrics.tasks.blocked > 5) {
      issues.push("Multiple tasks blocked (> 5)");
    }
    if (metrics.agents.active === 0) {
      issues.push("No active agents");
    }
    if (metrics.tasks.overdue > 3) {
      issues.push("Multiple overdue tasks (> 3)");
    }

    // Warnings
    if (metrics.queue.depth > 10 && metrics.queue.depth <= 20) {
      warnings.push("Queue depth elevated (> 10)");
    }
    if (metrics.tasks.blocked > 0 && metrics.tasks.blocked <= 5) {
      warnings.push("Some tasks blocked");
    }
    if (metrics.throughput.tasksPerHour < 1) {
      warnings.push("Throughput low (< 1 task/hour)");
    }

    return {
      status: issues.length > 0 ? "critical" : warnings.length > 0 ? "warning" : "healthy",
      criticalIssues: issues,
      warnings: warnings,
      metrics: metrics,
    };
  },
});
