/**
 * Pattern Learning System
 *
 * Detects recurring task sequences, tracks their success rates,
 * and suggests patterns for new epics based on historical data.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

interface TaskSequence {
  taskTypes: string[];
  succeeded: boolean;
  duration: number; // in days
}

/**
 * Detect patterns from task sequences in completed epics
 */
export const detectPatterns = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    epicId: v.id("epics"),
    taskSequence: v.array(v.string()), // task types in order
    succeeded: v.boolean(),
    duration: v.number(), // in days
  },
  handler: async (ctx, args) => {
    // Create pattern signature: "task1→task2→task3"
    const patternSignature = args.taskSequence.join("→");

    // Find existing pattern using by_workspace index
    const patterns = await ctx.db
      .query("taskPatterns")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const existing = patterns.find(
      (p: any) => p.pattern === patternSignature
    );

    if (existing) {
      // Update existing pattern
      const newOccurrences = ((existing.occurrences as number) || 0) + 1;
      const newSuccesses =
        ((existing.successCount as number) || 0) + (args.succeeded ? 1 : 0);
      const newSuccessRate = (newSuccesses / newOccurrences) * 100;

      // Update average duration with weighted average
      const oldCount = (existing.occurrences as number) || 1;
      const oldAvgDuration = (existing.avgDurationDays as number) || args.duration;
      const newAvgDuration =
        (oldAvgDuration * oldCount + args.duration) / (oldCount + 1);

      await ctx.db.patch(existing._id, {
        occurrences: newOccurrences,
        successCount: newSuccesses,
        successRate: Math.round(newSuccessRate * 100) / 100,
        avgDurationDays: Math.round(newAvgDuration * 100) / 100,
        lastSeen: Date.now(),
      });

      return existing._id;
    } else {
      // Create new pattern
      return await ctx.db.insert("taskPatterns", {
        workspaceId: args.workspaceId,
        pattern: patternSignature,
        taskTypeSequence: args.taskSequence,
        occurrences: 1,
        successCount: args.succeeded ? 1 : 0,
        successRate: args.succeeded ? 100 : 0,
        avgDurationDays: args.duration,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });
    }
  },
});

/**
 * Get all patterns for a workspace
 */
export const getPatternsBy = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const patterns = await ctx.db
      .query("taskPatterns")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return patterns.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },
});

/**
 * Get common patterns ranked by frequency and success rate
 */
export const getCommonPatterns = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const patterns = await ctx.db
      .query("taskPatterns")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();

    // Sort by occurrences desc, then success rate desc
    return patterns
      .sort((a, b) => {
        const aOcc = a.occurrences || 0;
        const bOcc = b.occurrences || 0;
        if (aOcc !== bOcc) return bOcc - aOcc;

        const aSuccess = a.successRate || 0;
        const bSuccess = b.successRate || 0;
        return bSuccess - aSuccess;
      })
      .slice(0, args.limit);
  },
});

/**
 * Suggest matching patterns for a new epic
 */
export const suggestPatternsForEpic = query({
  args: {
    workspaceId: v.id("workspaces"),
    taskTypes: v.array(v.string()), // task types user wants to include
  },
  handler: async (ctx, args) => {
    const patterns = await ctx.db
      .query("taskPatterns")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();

    // Find patterns that match the task types
    const suggestions = patterns.filter((p: any) => {
      const patternTypes = p.taskTypeSequence || [];
      // Pattern matches if all its types are in the requested types
      return patternTypes.every((t: string) => args.taskTypes.includes(t));
    });

    // Sort by success rate desc, then occurrences desc
    return suggestions
      .sort((a, b) => {
        const aSuccess = a.successRate || 0;
        const bSuccess = b.successRate || 0;
        if (aSuccess !== bSuccess) return bSuccess - aSuccess;

        const aOcc = a.occurrences || 0;
        const bOcc = b.occurrences || 0;
        return bOcc - aOcc;
      })
      .slice(0, 5);
  },
});

/**
 * Identify anti-patterns (low success rate)
 */
export const getAntiPatterns = query({
  args: {
    workspaceId: v.id("workspaces"),
    successThreshold: v.number(),
  },
  handler: async (ctx, args) => {
    const patterns = await ctx.db
      .query("taskPatterns")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();

    // Filter to low-success patterns with minimum occurrences
    return patterns
      .filter(
        (p) =>
          (p.successRate || 0) < args.successThreshold &&
          (p.occurrences || 0) >= 3
      )
      .sort((a, b) => (a.successRate || 0) - (b.successRate || 0));
  },
});

/**
 * Get duration estimates for planning
 */
export const estimateDuration = query({
  args: {
    workspaceId: v.id("workspaces"),
    taskTypes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const patterns = await ctx.db
      .query("taskPatterns")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();

    // Find matching patterns
    const matchingPatterns = patterns.filter((p: any) => {
      const patternTypes = p.taskTypeSequence || [];
      return patternTypes.every((t: string) => args.taskTypes.includes(t));
    });

    if (matchingPatterns.length === 0) {
      // Estimate based on number of tasks (2-3 days per task)
      return args.taskTypes.length * 2.5;
    }

    // Average duration of matching patterns, weighted by success rate
    const weighted = matchingPatterns
      .filter((p: any) => (p.successRate || 0) >= 50)
      .reduce((sum, p) => sum + (p.avgDurationDays || 0), 0);

    const highSuccessCount = matchingPatterns.filter(
      (p: any) => (p.successRate || 0) >= 50
    ).length;

    return highSuccessCount > 0
      ? Math.round((weighted / highSuccessCount) * 100) / 100
      : Math.round(matchingPatterns[0]?.avgDurationDays || 0) || args.taskTypes.length * 2.5;
  },
});

/**
 * Track pattern dormancy (not seen in recent period)
 */
export const getDormantPatterns = query({
  args: {
    workspaceId: v.id("workspaces"),
    daysSinceLastSeen: v.number(),
  },
  handler: async (ctx, args) => {
    const patterns = await ctx.db
      .query("taskPatterns")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const thresholdMs = args.daysSinceLastSeen * 24 * 60 * 60 * 1000;

    return patterns.filter(
      (p: any) => Date.now() - (p.lastSeen || 0) > thresholdMs
    );
  },
});

/**
 * Get pattern insights for analytics
 */
export const getPatternAnalytics = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const patterns = await ctx.db
      .query("taskPatterns")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const totalPatterns = patterns.length;
    const totalOccurrences = patterns.reduce((sum, p) => sum + (p.occurrences || 0), 0);
    const totalSuccesses = patterns.reduce((sum, p) => sum + (p.successCount || 0), 0);

    // Top patterns
    const topPatterns = patterns
      .sort((a, b) => (b.occurrences || 0) - (a.occurrences || 0))
      .slice(0, 5);

    // Patterns by success rate (high, medium, low)
    const highSuccess = patterns.filter(
      (p: any) => (p.successRate || 0) >= 80
    ).length;
    const mediumSuccess = patterns.filter(
      (p) =>
        (p.successRate || 0) >= 50 && (p.successRate || 0) < 80
    ).length;
    const lowSuccess = patterns.filter(
      (p: any) => (p.successRate || 0) < 50
    ).length;

    return {
      totalPatterns,
      totalOccurrences,
      overallSuccessRate:
        totalOccurrences > 0
          ? Math.round((totalSuccesses / totalOccurrences) * 100 * 100) / 100
          : 0,
      bySuccessRate: {
        high: highSuccess,
        medium: mediumSuccess,
        low: lowSuccess,
      },
      topPatterns,
    };
  },
});
