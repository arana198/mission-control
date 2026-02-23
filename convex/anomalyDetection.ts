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

type AnomalyType =
  | "duration_deviation"
  | "error_rate"
  | "skill_mismatch"
  | "status_spike";
type Severity = "low" | "medium" | "high";

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
    businessId: v.id("businesses"),
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
      businessId: args.businessId,
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
        businessId: args.businessId,
        type: "anomaly_detected",
        agentId: args.agentId as any,
        agentName: ((agent as any).name as string) || "Unknown",
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
    businessId: v.id("businesses"),
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
      businessId: args.businessId,
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
        businessId: args.businessId,
        type: "anomaly_detected",
        agentId: args.agentId as any,
        agentName: ((agent as any).name as string) || "Unknown",
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
    businessId: v.id("businesses"),
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
      businessId: args.businessId,
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
        businessId: args.businessId,
        type: "anomaly_detected",
        agentId: args.agentId as any,
        agentName: ((agent as any).name as string) || "Unknown",
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
    businessId: v.id("businesses"),
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
      businessId: args.businessId,
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
        businessId: args.businessId,
        type: "anomaly_detected",
        agentId: args.agentId as any,
        agentName: ((agent as any).name as string) || "Unknown",
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
    const anomalies = await ctx.db.query("anomalies" as any).collect();
    return (anomalies as any[])
      .filter((a) => a.agentId === args.agentId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },
});

/**
 * Get flagged anomalies for a business
 */
export const getFlaggedAnomalies = query({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const anomalies = await ctx.db.query("anomalies" as any).collect();
    return (anomalies as any[])
      .filter((a) => a.businessId === args.businessId && a.flagged === true)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },
});

/**
 * Get anomalies by type and severity
 */
export const getAnomaliesByTypeAndSeverity = query({
  args: {
    businessId: v.id("businesses"),
    type: v.optional(v.string()),
    severity: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("anomalies" as any).collect();
    let anomalies = (all as any[]).filter((a) => a.businessId === args.businessId);

    if (args.type) {
      anomalies = anomalies.filter((a) => a.type === args.type);
    }

    if (args.severity) {
      anomalies = anomalies.filter((a) => a.severity === args.severity);
    }

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
      if (agent) {
        await ctx.db.insert("activities", {
          businessId: anomaly.businessId,
          type: "anomaly_resolved",
          agentId: anomaly.agentId as any,
          agentName: ((agent as any).name as string) || "Unknown",
          message: `Anomaly resolved: ${(anomaly as any).message}`,
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
    const all = await ctx.db.query("anomalies" as any).collect();
    const anomalies = (all as any[]).filter(
      (a) => a.agentId === args.agentId && a.type === args.anomalyType
    );

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
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("anomalies" as any).collect();
    const anomalies = (all as any[]).filter((a) => a.businessId === args.businessId);

    const flagged = anomalies.filter((a) => (a.flagged as boolean) === true);
    const resolved = anomalies.filter((a) => (a.resolvedAt as number | undefined) !== undefined);

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
      byType[(a.type as AnomalyType) || "duration_deviation"]++;
      bySeverity[(a.severity as Severity) || "low"]++;
    }

    // Average resolution time
    let avgResolutionTime = 0;
    const resolvedWithTime = resolved.filter(
      (a) =>
        (a.createdAt as number) && (a.resolvedAt as number)
    );

    if (resolvedWithTime.length > 0) {
      const totalTime = resolvedWithTime.reduce(
        (sum, a) =>
          sum + (((a.resolvedAt as number) - (a.createdAt as number)) / (1000 * 60 * 60)),
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
