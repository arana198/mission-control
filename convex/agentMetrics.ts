import { v as convexVal } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ApiError, wrapConvexHandler } from "../lib/errors";

/**
 * Agent Metrics & Leaderboard
 * Tracks per-agent performance on a monthly basis
 *
 * Phase 1: Error standardization - all mutations now use ApiError with request IDs
 */

// REP-01: Upsert metrics for an agent in a given period
export const upsertMetrics = mutation({
  args: {
    agentId: convexVal.id("agents"),
    tasksCreated: convexVal.optional(convexVal.number()),
    tasksCompleted: convexVal.optional(convexVal.number()),
    tasksBlocked: convexVal.optional(convexVal.number()),
    commentsMade: convexVal.optional(convexVal.number()),
  },
  handler: wrapConvexHandler(async (ctx, { agentId, tasksCreated, tasksCompleted, tasksBlocked, commentsMade }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) throw ApiError.notFound('Agent', { agentId });

    // Get current month as period (YYYY-MM format)
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Find existing metrics for this agent + period
    const existing = await ctx.db
      .query("agentMetrics")
      .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
      .filter((q: any) => q.eq(q.field("period"), period))
      .first();

    // Denormalize agent info (Phase 4: avoid N+1 in getLeaderboard)
    const denormalized = {
      agentName: agent.name,
      agentRole: agent.role,
    };

    if (existing) {
      // Update existing metrics with denormalized fields
      await ctx.db.patch(existing._id, {
        tasksCreated: (existing.tasksCreated || 0) + (tasksCreated || 0),
        tasksCompleted: (existing.tasksCompleted || 0) + (tasksCompleted || 0),
        tasksBlocked: (existing.tasksBlocked || 0) + (tasksBlocked || 0),
        commentsMade: (existing.commentsMade || 0) + (commentsMade || 0),
        ...denormalized,
        updatedAt: Date.now(),
      } as any);
    } else {
      // Create new metrics entry with denormalized fields
      await ctx.db.insert("agentMetrics", {
        agentId,
        period,
        tasksCreated: tasksCreated || 0,
        tasksCompleted: tasksCompleted || 0,
        tasksBlocked: tasksBlocked || 0,
        commentsMade: commentsMade || 0,
        mentionsSent: 0,
        mentionsReceived: 0,
        sessionsCompleted: 0,
        totalSessionHours: 0,
        avgCompletionTime: 0,
        ...denormalized,
        updatedAt: Date.now(),
      } as any);
    }
  }),
});

// Get metrics for an agent across all periods
export const getByAgent = query({
  args: { agentId: convexVal.id("agents") },
  handler: async (ctx, { agentId }) => {
    const metrics = await ctx.db
      .query("agentMetrics")
      .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
      .order("desc")
      .collect();

    return metrics;
  },
});

// Get metrics for a specific period (all agents)
export const getByPeriod = query({
  args: { period: convexVal.string() },
  handler: async (ctx, { period }) => {
    const metrics = await ctx.db
      .query("agentMetrics")
      .withIndex("by_period", (q: any) => q.eq("period", period))
      .order("desc")
      .take(50);

    return metrics;
  },
});

// Get leaderboard for a period (top agents by tasksCompleted)
export const getLeaderboard = query({
  args: { period: convexVal.optional(convexVal.string()), limit: convexVal.optional(convexVal.number()) },
  handler: async (ctx, { period, limit = 10 }) => {
    const queryPeriod = period || (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    })();

    const allMetrics = await ctx.db
      .query("agentMetrics")
      .withIndex("by_period", (q: any) => q.eq("period", queryPeriod))
      .take(100);

    // Sort by tasksCompleted descending, then by commentsMade
    const sorted = allMetrics
      .sort((a, b) => {
        const completedDiff = (b.tasksCompleted || 0) - (a.tasksCompleted || 0);
        if (completedDiff !== 0) return completedDiff;
        return (b.commentsMade || 0) - (a.commentsMade || 0);
      })
      .slice(0, limit);

    // Phase 4: Use denormalized agentName/agentRole (no N+1 lookups!)
    return sorted.map((metric) => ({
      ...metric,
      agentName: (metric as any).agentName || "Unknown",
      agentRole: (metric as any).agentRole || "",
    }));
  },
});

// Get current month metrics for a specific agent
export const getCurrentMonth = query({
  args: { agentId: convexVal.id("agents") },
  handler: async (ctx, { agentId }) => {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const metric = await ctx.db
      .query("agentMetrics")
      .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
      .filter((q: any) => q.eq(q.field("period"), period))
      .first();

    return metric || null;
  },
});
