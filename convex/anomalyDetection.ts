/**
 * Anomaly Detection System
 *
 * Identifies unusual behavior patterns:
 * - Duration deviations (tasks taking significantly longer than baseline)
 * - Error rate spikes (high failure rates)
 * - Skill-task mismatches (junior agents on expert tasks)
 * - Status spikes (rapid status changes indicating instability)
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { AnomalyType, Severity } from "./types";
import { ACTIVITY_TYPES } from "./types";

/**
 * Calculate standard deviations from mean
 */
function calculateDeviation(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return Math.abs(value - mean) / stdDev;
}

/**
 * Determine severity based on deviation
 */
function determineSeverity(deviation: number): Severity {
  if (deviation < 2) return "low";
  if (deviation < 3) return "medium";
  return "high";
}

/**
 * Detect duration deviations
 */
export const detectDurationDeviation = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    taskId: v.id("tasks"),
    actualDuration: v.number(), // in days
    expectedDuration: v.number(), // baseline in days
    stdDeviation: v.number(), // standard deviation
  },
  handler: async (ctx, args) => {
    const deviation = calculateDeviation(
      args.actualDuration,
      args.expectedDuration,
      args.stdDeviation
    );
    const severity = determineSeverity(deviation);

    // Only flag significant deviations
    if (deviation < 2) {
      return null;
    }

    const anomalyId = await ctx.db.insert("anomalies", {
      workspaceId: args.workspaceId,
      agentId: args.agentId,
      type: "duration_deviation",
      severity,
      message: `Task took ${args.actualDuration.toFixed(1)} days (expected ${args.expectedDuration.toFixed(1)} days)`,
      taskId: args.taskId,
      detectedValue: args.actualDuration,
      expectedValue: args.expectedDuration,
      flagged: true,
      createdAt: Date.now(),
    });

    // Log activity (get agent name for denormalization)
    const agent = await ctx.db.get(args.agentId);
    if (agent) {
      await ctx.db.insert("activities", {
        workspaceId: args.workspaceId,
        type: "task_assigned" as any, // Note: "anomaly_detected" not in ACTIVITY_TYPES, using task_assigned for now
        agentId: args.agentId as any,
        agentName: agent.name || "Unknown",
        message: `Duration deviation detected: ${args.actualDuration.toFixed(1)}d vs ${args.expectedDuration.toFixed(1)}d (${severity})`,
        createdAt: Date.now(),
      });
    }

    return anomalyId;
  },
});

/**
 * Detect error rate spikes
 */
export const detectErrorRateSpike = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    completedTasks: v.number(),
    failedTasks: v.number(),
    expectedErrorRate: v.number(), // in percent
  },
  handler: async (ctx, args) => {
    const totalTasks = args.completedTasks + args.failedTasks;
    if (totalTasks === 0) return null;

    const actualErrorRate = (args.failedTasks / totalTasks) * 100;

    // Only flag if 3x above expected or above 20%
    if (actualErrorRate < args.expectedErrorRate * 3 && actualErrorRate < 20) {
      return null;
    }

    const deviation = actualErrorRate / (args.expectedErrorRate || 1);
    const severity = deviation > 3 ? "high" : deviation > 2 ? "medium" : "low";

    const anomalyId = await ctx.db.insert("anomalies", {
      workspaceId: args.workspaceId,
      agentId: args.agentId,
      type: "error_rate",
      severity,
      message: `Error rate: ${actualErrorRate.toFixed(1)}% (expected <${args.expectedErrorRate}%)`,
      detectedValue: actualErrorRate,
      expectedValue: args.expectedErrorRate,
      flagged: true,
      createdAt: Date.now(),
    });

    // Log activity (get agent name for denormalization)
    const agent = await ctx.db.get(args.agentId);
    if (agent) {
      await ctx.db.insert("activities", {
        workspaceId: args.workspaceId,
        type: "task_assigned" as any, // Note: "anomaly_detected" not in ACTIVITY_TYPES, using task_assigned for now
        agentId: args.agentId as any,
        agentName: agent.name || "Unknown",
        message: `Error rate spike: ${actualErrorRate.toFixed(1)}% (${severity})`,
        createdAt: Date.now(),
      });
    }

    return anomalyId;
  },
});

/**
 * Detect skill-task mismatch
 */
export const detectSkillMismatch = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    taskId: v.id("tasks"),
    agentSkillLevel: v.number(), // 1-3 scale
    taskComplexity: v.number(), // 1-3 scale
  },
  handler: async (ctx, args) => {
    // Flag if agent is >1 level below required
    if (args.agentSkillLevel >= args.taskComplexity - 1) {
      return null;
    }

    const severity = args.taskComplexity - args.agentSkillLevel > 2 ? "high" : "medium";

    const anomalyId = await ctx.db.insert("anomalies", {
      workspaceId: args.workspaceId,
      agentId: args.agentId,
      type: "skill_mismatch",
      severity,
      message: `Agent skill level ${args.agentSkillLevel} assigned task requiring level ${args.taskComplexity}`,
      taskId: args.taskId,
      detectedValue: args.agentSkillLevel,
      expectedValue: args.taskComplexity,
      flagged: true,
      createdAt: Date.now(),
    });

    // Log activity (get agent name for denormalization)
    const agent = await ctx.db.get(args.agentId);
    if (agent) {
      await ctx.db.insert("activities", {
        workspaceId: args.workspaceId,
        type: "task_assigned" as any, // Note: "anomaly_detected" not in ACTIVITY_TYPES, using task_assigned for now
        agentId: args.agentId as any,
        agentName: agent.name || "Unknown",
        message: `Skill mismatch: Level ${args.agentSkillLevel} agent on level ${args.taskComplexity} task (${severity})`,
        createdAt: Date.now(),
      });
    }

    return anomalyId;
  },
});

/**
 * Detect rapid status changes (instability indicator)
 */
export const detectStatusSpike = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    changeCount: v.number(), // status changes in time window
    timeWindowMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const changesPerMinute = args.changeCount / args.timeWindowMinutes;

    // Flag if more than 1 change per 12 minutes (5+ in 1 hour)
    if (changesPerMinute < 1 / 12) {
      return null;
    }

    const severity = changesPerMinute > 1 / 5 ? "high" : "low";

    const anomalyId = await ctx.db.insert("anomalies", {
      workspaceId: args.workspaceId,
      agentId: args.agentId,
      type: "status_spike",
      severity,
      message: `${args.changeCount} status changes in ${args.timeWindowMinutes} minutes`,
      detectedValue: args.changeCount,
      expectedValue: 1,
      flagged: true,
      createdAt: Date.now(),
    });

    // Log activity (get agent name for denormalization)
    const agent = await ctx.db.get(args.agentId);
    if (agent) {
      await ctx.db.insert("activities", {
        workspaceId: args.workspaceId,
        type: "task_assigned" as any, // Note: "anomaly_detected" not in ACTIVITY_TYPES, using task_assigned for now
        agentId: args.agentId as any,
        agentName: agent.name || "Unknown",
        message: `Status spike: ${args.changeCount} changes in ${args.timeWindowMinutes}min (${severity})`,
        createdAt: Date.now(),
      });
    }

    return anomalyId;
  },
});

/**
 * Get all anomalies for an agent
 */
export const getAnomaliesByAgent = query({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const anomalies = await ctx.db
      .query("anomalies")
      .filter((q: any) => q.eq(q.field("agentId"), args.agentId))
      .collect();
    return anomalies.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },
});

/**
 * Get flagged anomalies for a workspace
 */
export const getFlaggedAnomalies = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const anomalies = await ctx.db
      .query("anomalies")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .filter((q: any) => q.eq(q.field("flagged"), true))
      .collect();
    return anomalies.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },
});

/**
 * Get anomalies by type and severity
 */
export const getAnomaliesByTypeAndSeverity = query({
  args: {
    workspaceId: v.id("workspaces"),
    type: v.optional(v.string()),
    severity: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("anomalies")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId));

    if (args.type) {
      query = query.filter((q: any) => q.eq(q.field("type"), args.type));
    }

    if (args.severity) {
      query = query.filter((q: any) => q.eq(q.field("severity"), args.severity));
    }

    const anomalies = await query.collect();
    return anomalies.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },
});

/**
 * Mark anomaly as resolved
 */
export const resolveAnomaly = mutation({
  args: {
    anomalyId: v.id("anomalies"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.anomalyId, {
      flagged: false,
      resolvedAt: Date.now(),
    });

    const anomaly = await ctx.db.get(args.anomalyId);
    if (anomaly) {
      const agent = await ctx.db.get(anomaly.agentId as any);
      if (agent && (agent as any).name) {
        await ctx.db.insert("activities", {
          workspaceId: anomaly.workspaceId,
          type: "task_assigned" as any, // Note: "anomaly_resolved" not in ACTIVITY_TYPES
          agentId: anomaly.agentId as any,
          agentName: (agent as any).name || "Unknown",
          message: `Anomaly resolved: ${(anomaly as any).message || ""}`,
          createdAt: Date.now(),
        });
      }
    }

    return args.anomalyId;
  },
});

/**
 * Get recurring anomalies for an agent
 */
export const getRecurringAnomalies = query({
  args: {
    agentId: v.id("agents"),
    anomalyType: v.string(),
    minOccurrences: v.number(),
  },
  handler: async (ctx, args) => {
    const anomalies = await ctx.db
      .query("anomalies")
      .filter((q: any) =>
        q.and(
          q.eq(q.field("agentId"), args.agentId),
          q.eq(q.field("type"), args.anomalyType)
        )
      )
      .collect();

    if (anomalies.length < args.minOccurrences) {
      return [];
    }

    return anomalies;
  },
});

/**
 * Get anomaly statistics for business
 */
export const getAnomalyStats = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const anomalies = await ctx.db
      .query("anomalies")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const flagged = anomalies.filter((a: any) => a.flagged === true);
    const resolved = anomalies.filter((a: any) => a.resolvedAt !== undefined);

    // Count by type
    const byType: Record<AnomalyType, number> = {
      duration_deviation: 0,
      error_rate: 0,
      skill_mismatch: 0,
      status_spike: 0,
    };

    // Count by severity
    const bySeverity: Record<Severity, number> = {
      low: 0,
      medium: 0,
      high: 0,
    };

    for (const a of anomalies) {
      const aType = (a.type as AnomalyType) || "duration_deviation";
      if (aType in byType) byType[aType]++;
      const aSev = (a.severity as Severity) || "low";
      if (aSev in bySeverity) bySeverity[aSev]++;
    }

    // Average resolution time
    let avgResolutionTime = 0;
    const resolvedWithTime = resolved.filter(
      (a: any) => a.createdAt && a.resolvedAt !== undefined
    );

    if (resolvedWithTime.length > 0) {
      const totalTime = resolvedWithTime.reduce(
        (sum, a) =>
          sum + (((a.resolvedAt || 0) - a.createdAt) / (1000 * 60 * 60)),
        0
      );
      avgResolutionTime = totalTime / resolvedWithTime.length;
    }

    return {
      total: anomalies.length,
      flagged: flagged.length,
      resolved: resolved.length,
      byType,
      bySeverity,
      avgResolutionTimeHours: Math.round(avgResolutionTime * 100) / 100,
    };
  },
});

/**
 * Get mitigation suggestions for anomaly
 */
export const getMitigationSuggestion = query({
  args: {
    anomalyType: v.string(),
  },
  handler: async (ctx, args) => {
    const suggestions: Record<AnomalyType, string> = {
      skill_mismatch: "Consider pairing with experienced mentor",
      error_rate: "Consider task rotation or break time",
      duration_deviation: "Review agent capacity and task complexity",
      status_spike: "Investigate environmental or personal factors",
    };

    return suggestions[args.anomalyType as AnomalyType] || "Review anomaly with manager";
  },
});
