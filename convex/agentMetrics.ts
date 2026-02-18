import { v as convexVal } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Agent Metrics & Leaderboard
 * Tracks per-agent performance on a monthly basis
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
  handler: async (ctx, { agentId, tasksCreated, tasksCompleted, tasksBlocked, commentsMade }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) throw new Error("Agent not found");

    // Get current month as period (YYYY-MM format)
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Find existing metrics for this agent + period
    const existing = await ctx.db
      .query("agentMetrics")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .filter((q) => q.eq(q.field("period"), period))
      .first();

    if (existing) {
      // Update existing metrics
      await ctx.db.patch(existing._id, {
        tasksCreated: (existing.tasksCreated || 0) + (tasksCreated || 0),
        tasksCompleted: (existing.tasksCompleted || 0) + (tasksCompleted || 0),
        tasksBlocked: (existing.tasksBlocked || 0) + (tasksBlocked || 0),
        commentsMade: (existing.commentsMade || 0) + (commentsMade || 0),
        updatedAt: Date.now(),
      });
    } else {
      // Create new metrics entry
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
        updatedAt: Date.now(),
      });
    }
  },
});

// Get metrics for an agent across all periods
export const getByAgent = query({
  args: { agentId: convexVal.id("agents") },
  handler: async (ctx, { agentId }) => {
    const metrics = await ctx.db
      .query("agentMetrics")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
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
      .withIndex("by_period", (q) => q.eq("period", period))
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
      .withIndex("by_period", (q) => q.eq("period", queryPeriod))
      .take(100);

    // Sort by tasksCompleted descending, then by commentsMade
    const sorted = allMetrics
      .sort((a, b) => {
        const completedDiff = (b.tasksCompleted || 0) - (a.tasksCompleted || 0);
        if (completedDiff !== 0) return completedDiff;
        return (b.commentsMade || 0) - (a.commentsMade || 0);
      })
      .slice(0, limit);

    // Fetch agent names for display
    const withAgents = await Promise.all(
      sorted.map(async (metric) => {
        const agent = await ctx.db.get(metric.agentId);
        return {
          ...metric,
          agentName: agent?.name || "Unknown",
          agentRole: agent?.role || "",
        };
      })
    );

    return withAgents;
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
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .filter((q) => q.eq(q.field("period"), period))
      .first();

    return metric || null;
  },
});
