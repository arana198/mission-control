import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { ApiError, withRetry, CircuitBreaker, RETRY_CONFIGS } from "../lib/errors";

/**
 * Cron Jobs for Mission Control
 * Automated background tasks (Phase 4A + Phase 2 Resilience)
 *
 * NOTE: Cron handlers must be internalMutations to have database access.
 *
 * Phase 2 Features:
 * - Retry logic with exponential backoff for transient failures
 * - Circuit breaker to prevent cascading failures
 * - Graceful error handling with detailed logging
 */

// Circuit breakers for each cron operation
const autoclaimCircuitBreaker = new CircuitBreaker("auto-claim", 5, 120000);
const heartbeatCircuitBreaker = new CircuitBreaker("heartbeat-monitor", 5, 120000);
const escalationCircuitBreaker = new CircuitBreaker("escalation-check", 5, 120000);

/**
 * Auto-Claim Handler
 * Called every 60 seconds to check for tasks in "ready" status
 * and notifies assigned agents
 *
 * Phase 2 Enhancements:
 * - Circuit breaker prevents cascading failures
 * - Retry logic for transient failures
 * - Graceful degradation when some notifications fail
 */
export const autoClaimCronHandler = internalMutation({
  handler: async (ctx) => {
    try {
      return await autoclaimCircuitBreaker.execute(async () => {
        console.log("[Cron] Running auto-claim check...");

        // Fetch with retry for transient failures
        const readyTasks: any = await withRetry(
          () => ctx.runQuery(api.tasks.getReadyWithAssignees, {}),
          "fetch-ready-tasks",
          RETRY_CONFIGS.CRON
        );

        if (readyTasks.length === 0) {
          console.log("[Cron] No ready tasks found");
          return { notified: 0, tasks: [], succeeded: true };
        }

        const notifiedAgents = new Set();
        const failedNotifications: Array<{ agentId: string; error: string }> = [];
        let notificationCount = 0;

        for (const task of readyTasks) {
          for (const assignee of task.assignees) {
            // Skip if already notified this agent in this run
            if (notifiedAgents.has(assignee.id)) {
              continue;
            }

            try {
              // Check if agent already has wake request pending (with retry)
              const existingWakes: any = await withRetry(
                () => ctx.runQuery(api.wake.getPending, {}),
                `check-pending-wakes-${assignee.id}`,
                RETRY_CONFIGS.FAST
              );

              const alreadyPending = existingWakes.some(
                (w: any) => w.agentId === assignee.id && w.priority === "normal"
              );

              if (!alreadyPending) {
                // Create wake request (critical, use CRITICAL retry config)
                await withRetry(
                  () =>
                    ctx.runMutation(api.wake.requestWake, {
                      agentId: assignee.id,
                      requestedBy: "system:auto-claim",
                      priority: "normal",
                    }),
                  `request-wake-${assignee.id}`,
                  RETRY_CONFIGS.CRITICAL
                );

                // Create notification (non-critical, can fail gracefully)
                await withRetry(
                  () =>
                    ctx.runMutation(api.notifications.create, {
                      recipientId: assignee.id,
                      type: "assignment",
                      content: `New task ready: "${task.title}" (Priority: ${task.priority})`,
                      fromId: "system",
                      fromName: "System",
                    }),
                  `create-notification-${assignee.id}`,
                  RETRY_CONFIGS.FAST
                ).catch((error) => {
                  // Graceful degradation: log but don't fail the whole operation
                  failedNotifications.push({
                    agentId: assignee.id,
                    error: error.message,
                  });
                  console.warn(
                    `[Cron] Non-critical: Failed to create notification for ${assignee.id}: ${error.message}`
                  );
                });

                notifiedAgents.add(assignee.id);
                notificationCount++;
              }
            } catch (error: any) {
              failedNotifications.push({
                agentId: assignee.id,
                error: error.message,
              });
              console.error(
                `[Cron] Error processing agent ${assignee.id}:`,
                error.message
              );
              // Continue processing other agents despite this error
            }
          }
        }

        console.log(
          `[Cron] Auto-claim result: ${notificationCount} agents notified, ` +
            `${failedNotifications.length} failures`
        );

        return {
          notified: notificationCount,
          tasks: readyTasks,
          failedNotifications,
          succeeded: failedNotifications.length === 0,
        };
      });
    } catch (error: any) {
      console.error("[Cron] Auto-claim cron failed:", error.message);
      throw ApiError.internal("Auto-claim cron handler failed", {
        operationName: "auto-claim",
        error: error.message,
      });
    }
  },
});

/**
 * Heartbeat Monitor Handler
 * Called every 5 minutes to check for stale agents
 * Updates agent status to "idle" if no heartbeat > 5 min
 *
 * Phase 2 Enhancements:
 * - Circuit breaker prevents repeated failures
 * - Batch processing with limits to prevent timeouts
 * - Graceful handling of individual agent update failures
 */
export const heartbeatMonitorCronHandler = internalMutation({
  handler: async (ctx) => {
    try {
      return await heartbeatCircuitBreaker.execute(async () => {
        console.log("[Cron] Checking agent heartbeats...");

        // Find agents with no heartbeat in the last 5 minutes
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        const allAgents = await ctx.db.query("agents").collect();

        const staleAgents = allAgents.filter(
          (a: any) => a.lastHeartbeat < fiveMinutesAgo && a.status === "active"
        );

        // Process in batches to prevent timeout
        const batchSize = 50;
        let processedCount = 0;
        const failedUpdates: Array<{ agentId: string; error: string }> = [];

        for (let i = 0; i < staleAgents.length; i += batchSize) {
          const batch = staleAgents.slice(i, i + batchSize);

          for (const agent of batch) {
            try {
              await withRetry(
                async () => {
                  await ctx.db.patch(agent._id, { status: "idle" });

                  // Log activity with retry
                  await ctx.db.insert("activities", {
                    type: "agent_status_changed",
                    agentId: agent._id,
                    agentName: agent.name,
                    message: `Agent status changed to idle (heartbeat stale)`,
                    oldValue: "active",
                    newValue: "idle",
                    createdAt: Date.now(),
                  });
                },
                `heartbeat-update-${agent._id}`,
                RETRY_CONFIGS.STANDARD
              );
              processedCount++;
            } catch (error: any) {
              failedUpdates.push({
                agentId: agent._id,
                error: error.message,
              });
              console.warn(
                `[Cron] Failed to update agent ${agent._id}: ${error.message}`
              );
            }
          }
        }

        console.log(
          `[Cron] Heartbeat monitor: checked ${allAgents.length} agents, ` +
            `marked ${processedCount} as idle, ${failedUpdates.length} failures`
        );

        return {
          checked: allAgents.length,
          stale: staleAgents.length,
          processed: processedCount,
          failedUpdates,
          succeeded: failedUpdates.length === 0,
        };
      });
    } catch (error: any) {
      console.error("[Cron] Heartbeat monitor cron failed:", error.message);
      throw ApiError.internal("Heartbeat monitor cron handler failed", {
        operationName: "heartbeat-monitor",
        error: error.message,
      });
    }
  },
});

/**
 * Escalation Check Handler
 * Called every 15 minutes to check for long-blocked tasks
 * Notifies lead agents of tasks blocked > 24 hours
 */
/**
 * Escalation Check Handler
 * Called every 15 minutes to check for long-blocked tasks
 * Notifies lead agents of tasks blocked > 24 hours
 *
 * Phase 2 Enhancements:
 * - Circuit breaker prevents repeated failures
 * - Retry logic for transient failures
 * - Graceful degradation for notification failures
 */
export const escalationCheckCronHandler = internalMutation({
  handler: async (ctx) => {
    try {
      return await escalationCircuitBreaker.execute(async () => {
        console.log("[Cron] Running escalation check...");

        // Find tasks blocked for > 24 hours (with retry)
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const blockedTasks = await withRetry(
          () =>
            ctx.db
              .query("tasks")
              .withIndex("by_status", (q: any) => q.eq("status", "blocked"))
              .take(100),
          "fetch-blocked-tasks",
          RETRY_CONFIGS.CRON
        );

        const escalatedTasks = blockedTasks
          .filter((t: any) => t.updatedAt < oneDayAgo)
          .slice(0, 10); // Max 10 per run

        // Get lead agents (with retry)
        const allAgents = await withRetry(
          () => ctx.db.query("agents").collect(),
          "fetch-agents",
          RETRY_CONFIGS.STANDARD
        );
        const leadAgents = allAgents.filter((a: any) => a.level === "lead");

        const failedNotifications: Array<{
          taskId: string;
          leadId: string;
          error: string;
        }> = [];

        // Create notifications for leads
        for (const task of escalatedTasks) {
          for (const lead of leadAgents) {
            try {
              // Create notifications with retry (critical for escalations)
              await withRetry(
                async () => {
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

                  // Log escalation activity with notification
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
                },
                `escalation-notify-${task._id}-${lead._id}`,
                RETRY_CONFIGS.CRITICAL
              );
            } catch (error: any) {
              failedNotifications.push({
                taskId: task._id,
                leadId: lead._id,
                error: error.message,
              });
              console.warn(
                `[Cron] Failed to escalate task ${task._id} to lead ${lead._id}: ${error.message}`
              );
            }
          }
        }

        console.log(
          `[Cron] Escalation check: found ${escalatedTasks.length} long-blocked tasks, ` +
            `${failedNotifications.length} notification failures`
        );

        return {
          escalatedTasks: escalatedTasks.length,
          failedNotifications,
          succeeded: failedNotifications.length === 0,
        };
      });
    } catch (error: any) {
      console.error("[Cron] Escalation check cron failed:", error.message);
      throw ApiError.internal("Escalation check cron handler failed", {
        operationName: "escalation-check",
        error: error.message,
      });
    }
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
