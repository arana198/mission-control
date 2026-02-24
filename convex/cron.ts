import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { api } from "./_generated/api";

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
      (a: any) => a.lastHeartbeat < fiveMinutesAgo && a.status === "active"
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
      .withIndex("by_status", (q: any) => q.eq("status", "blocked"))
      .take(100);

    const escalatedTasks = blockedTasks.filter((t: any) => t.updatedAt < oneDayAgo).slice(0, 10); // Max 10 per run

    // Get lead agents
    const allAgents = await ctx.db.query("agents").collect();
    const leadAgents = allAgents.filter((a: any) => a.level === "lead");

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

/**
 * Alert Rule Evaluator Handler
 * Called every 5 minutes to evaluate alert rules for all businesses
 * Checks conditions and creates notifications/decisions when rules trigger (Phase 4C)
 */
export const alertEvaluatorCronHandler = internalMutation({
  handler: async (ctx) => {
    console.log("[Cron] Running alert rule evaluator...");

    // Get all businesses
    const businesses = await ctx.db.query("businesses").collect();

    let totalEvaluated = 0;

    // Evaluate rules for each business
    for (const business of businesses) {
      try {
        const now = Date.now();

        // Fetch all enabled rules for this business
        const rules = await ctx.db
          .query("alertRules")
          .withIndex("by_business", (q: any) => q.eq("businessId", business._id))
          .collect();

        const enabledRules = rules.filter((r: any) => r.enabled);

        for (const rule of enabledRules) {
          // Check cooldown: skip if rule fired recently
          if (rule.lastFiredAt && now - rule.lastFiredAt < rule.cooldownSeconds * 1000) {
            continue;
          }

          // Evaluate condition
          let conditionMet = false;
          let metrics: Record<string, number> = {};

          if (rule.condition === "taskBlocked > Xmin") {
            const threshold = rule.threshold || 30;
            const blockedThresholdMs = threshold * 60 * 1000;

            const blockedTasks = await ctx.db
              .query("tasks")
              .withIndex("by_business_status", (q: any) =>
                q.eq("businessId", business._id).eq("status", "blocked")
              )
              .collect();

            const staleBlockedTasks = blockedTasks.filter(
              (t: any) => now - t.updatedAt >= blockedThresholdMs
            );

            conditionMet = staleBlockedTasks.length > 0;
            metrics = {
              blockedTasksCount: staleBlockedTasks.length,
              thresholdMinutes: threshold,
            };
          } else if (rule.condition === "queueDepth > threshold") {
            const threshold = rule.threshold || 10;

            const backlogTasks = await ctx.db
              .query("tasks")
              .withIndex("by_business_status", (q: any) =>
                q.eq("businessId", business._id).eq("status", "backlog")
              )
              .collect();

            conditionMet = backlogTasks.length > threshold;
            metrics = {
              backlogCount: backlogTasks.length,
              threshold,
            };
          }

          if (conditionMet) {
            // Get up to 3 lead agents for notification
            const agents = await ctx.db.query("agents").collect();
            const leadAgents = agents.filter((a: any) => a.role === "lead").slice(0, 3);

            // Create notification for each lead agent
            for (const agent of leadAgents) {
              await ctx.db.insert("notifications", {
                businessId: business._id,
                recipientId: agent._id,
                type: "alert_rule_triggered",
                title: `Alert: ${rule.name}`,
                content: `Rule "${rule.name}" triggered. Condition: ${rule.condition}`,
                severity: rule.severity,
                metadata: {
                  ruleId: rule._id,
                  condition: rule.condition,
                  metrics,
                },
                fromId: "system",
                fromName: "Alert System",
                read: false,
                createdAt: now,
              });
            }

            // Create decision log entry
            await ctx.db.insert("decisions", {
              businessId: business._id,
              action: "alert_rule_triggered",
              taskId: undefined,
              fromAgent: undefined,
              toAgent: undefined,
              reason: `Alert rule "${rule.name}" triggered: ${rule.condition}`,
              ruleId: rule._id,
              result: "success",
              resultMessage: `Created notifications for ${leadAgents.length} lead agents`,
              decidedBy: "system:alert-evaluator",
              decidedAt: now,
              createdAt: now,
            });

            // Update rule's lastFiredAt to enforce cooldown
            await ctx.db.patch(rule._id, {
              lastFiredAt: now,
            });

            // Create an alert event record
            await ctx.db.insert("alertEvents", {
              businessId: business._id,
              ruleId: rule._id,
              ruleName: rule.name,
              triggered: true,
              metrics,
              notificationIds: [],
              createdAt: now,
            });
          }
        }

        totalEvaluated += enabledRules.length;
      } catch (error) {
        console.error(
          `[Cron] Error evaluating rules for business ${business._id}:`,
          error
        );
      }
    }

    console.log(`[Cron] Alert evaluator: checked ${totalEvaluated} rules across ${businesses.length} businesses`);
    return { businessesChecked: businesses.length, rulesEvaluated: totalEvaluated };
  },
});

// TEMPORARILY DISABLED - broken
/*
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

jobs.interval(
  "alert-rule-evaluator",
  { minutes: 5 },
  alertEvaluatorCronHandler as any
);
*/
