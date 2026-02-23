import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";

/**
 * Cron Jobs for Mission Control
 * Automated background tasks (Phase 4A)
 *
 * NOTE: Cron handlers must be internalMutations to have database access.
 */

/**
 * Auto-Claim Handler
 * Called every 60 seconds to check for tasks in "ready" status
 * and notifies assigned agents
 */
export const autoClaimCronHandler = internalMutation({
  handler: async (ctx) => {
    console.log("[Cron] Running auto-claim check...");
    // Get all tasks in "ready" status with assignees
    const readyTasks: any = await ctx.runQuery(api.tasks.getReadyWithAssignees, {});

    if (readyTasks.length === 0) {
      return { notified: 0, tasks: [] };
    }

    const notifiedAgents = new Set();
    let notificationCount = 0;

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
              fromName: "System",
            });

            notifiedAgents.add(assignee.id);
            notificationCount++;
          }
        } catch (error) {
          console.error(`[Cron] Error notifying agent ${assignee.id}:`, error);
        }
      }
    }

    console.log(`[Cron] Auto-claim result: ${notificationCount} agents notified`);
    return { notified: notificationCount, tasks: readyTasks };
  },
});

/**
 * Heartbeat Monitor Handler
 * Called every 5 minutes to check for stale agents
 * Updates agent status to "idle" if no heartbeat > 5 min
 */
export const heartbeatMonitorCronHandler = internalMutation({
  handler: async (ctx) => {
    console.log("[Cron] Checking agent heartbeats...");

    // Find agents with no heartbeat in the last 5 minutes
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const allAgents = await ctx.db.query("agents").collect();

    const staleAgents = allAgents.filter(
      (a) => a.lastHeartbeat < fiveMinutesAgo && a.status === "active"
    );

    // Mark stale agents as idle
    for (const agent of staleAgents) {
      await ctx.db.patch(agent._id, { status: "idle" });

      // Log activity (no businessId needed for agent-scoped activities)
      await ctx.db.insert("activities", {
        type: "agent_status_changed",
        agentId: agent._id,
        agentName: agent.name,
        message: `Agent status changed to idle (heartbeat stale)`,
        oldValue: "active",
        newValue: "idle",
        createdAt: Date.now(),
      });
    }

    console.log(
      `[Cron] Heartbeat monitor: checked ${allAgents.length} agents, marked ${staleAgents.length} as idle`
    );
    return { checked: allAgents.length, stale: staleAgents.length };
  },
});

/**
 * Escalation Check Handler
 * Called every 15 minutes to check for long-blocked tasks
 * Notifies lead agents of tasks blocked > 24 hours
 */
export const escalationCheckCronHandler = internalMutation({
  handler: async (ctx) => {
    console.log("[Cron] Running escalation check...");

    // Find tasks blocked for > 24 hours
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const blockedTasks = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "blocked"))
      .take(100);

    const escalatedTasks = blockedTasks.filter((t) => t.updatedAt < oneDayAgo).slice(0, 10); // Max 10 per run

    // Get lead agents
    const allAgents = await ctx.db.query("agents").collect();
    const leadAgents = allAgents.filter((a) => a.level === "lead");

    // Create notifications for leads
    for (const task of escalatedTasks) {
      for (const lead of leadAgents) {
        await ctx.db.insert("notifications", {
          recipientId: lead._id,
          type: "assignment",
          content: `🚨 ESCALATED: "${task.title}" has been blocked for 24+ hours`,
          taskId: task._id,
          taskTitle: task.title,
          fromId: "system",
          fromName: "System",
          read: false,
          createdAt: Date.now(),
        });
      }

      // Log escalation activity (task-scoped, needs businessId from task)
      await ctx.db.insert("activities", {
        businessId: task.businessId,
        type: "task_blocked",
        agentId: "system",
        agentName: "system",
        message: `Task "${task.title}" escalated (blocked > 24 hours)`,
        taskId: task._id,
        taskTitle: task.title,
        createdAt: Date.now(),
      });
    }

    console.log(`[Cron] Escalation check: found ${escalatedTasks.length} long-blocked tasks`);
    return { escalatedTasks: escalatedTasks.length };
  },
});

// Register crons with Convex
const jobs = cronJobs();

jobs.interval(
  "auto-claim-tasks",
  { seconds: 60 },
  autoClaimCronHandler as any
);

jobs.interval(
  "agent-heartbeat-monitor",
  { minutes: 5 },
  heartbeatMonitorCronHandler as any
);

jobs.interval(
  "escalation-check",
  { minutes: 15 },
  escalationCheckCronHandler as any
);
