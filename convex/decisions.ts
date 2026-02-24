/**
 * Decisions Module
 * Track and audit all management decisions made by OpenClaw
 *
 * Phase 1: Error standardization - all mutations now use ApiError with request IDs
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ApiError, wrapConvexHandler } from "../lib/errors";

/**
 * Create a decision record
 */
export const create = mutation({
  args: {
    businessId: v.id("businesses"),
    action: v.union(
      v.literal("escalated"),
      v.literal("reassigned"),
      v.literal("unblocked"),
      v.literal("marked_executed"),
      v.literal("deprioritized"),
      v.literal("custom")
    ),
    taskId: v.id("tasks"),
    fromAgent: v.optional(v.string()),
    toAgent: v.optional(v.string()),
    reason: v.string(),
    ruleId: v.optional(v.id("alertRules")),
    result: v.union(v.literal("success"), v.literal("failed"), v.literal("no_action_needed")),
    resultMessage: v.optional(v.string()),
    decidedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const decisionId = await ctx.db.insert("decisions", {
      businessId: args.businessId,
      action: args.action,
      taskId: args.taskId,
      fromAgent: args.fromAgent,
      toAgent: args.toAgent,
      reason: args.reason,
      ruleId: args.ruleId,
      result: args.result,
      resultMessage: args.resultMessage,
      decidedBy: args.decidedBy,
      decidedAt: Date.now(),
      createdAt: Date.now(),
    });

    return decisionId;
  },
});

/**
 * Get decisions for a business (with optional filters)
 */
export const getByBusiness = query({
  args: {
    businessId: v.id("businesses"),
    since: v.optional(v.number()),
    action: v.optional(v.string()),
    decidedBy: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_business", (q: any) => q.eq("businessId", args.businessId))
      .collect();

    let filtered = decisions;
    if (args.since) {
      filtered = filtered.filter((d: any) => d.createdAt > args.since!);
    }
    if (args.action) {
      filtered = filtered.filter((d: any) => d.action === args.action);
    }
    if (args.decidedBy) {
      filtered = filtered.filter((d: any) => d.decidedBy === args.decidedBy);
    }

    return filtered.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  },
});

/**
 * Get decisions for a specific task
 */
export const getByTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_task", (q: any) => q.eq("taskId", args.taskId))
      .collect();
    return decisions.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Get pattern analysis - what decisions led to what outcomes
 */
export const analyzePatterns = query({
  args: {
    businessId: v.id("businesses"),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_business", (q: any) => q.eq("businessId", args.businessId))
      .collect();

    // Filter by time if provided
    const filtered = args.since ? decisions.filter((d: any) => d.createdAt > args.since!) : decisions;

    // Analyze patterns
    const patterns: Record<string, any> = {
      totalDecisions: filtered.length,
      byAction: {},
      byReason: {},
      byDecidedBy: {},
      successRate: 0,
    };

    let successCount = 0;

    for (const decision of filtered) {
      // Count by action
      if (!patterns.byAction[decision.action]) {
        patterns.byAction[decision.action] = { count: 0, successful: 0 };
      }
      patterns.byAction[decision.action].count++;
      if (decision.result === "success") {
        patterns.byAction[decision.action].successful++;
      }

      // Count by reason
      if (!patterns.byReason[decision.reason]) {
        patterns.byReason[decision.reason] = { count: 0, successful: 0 };
      }
      patterns.byReason[decision.reason].count++;
      if (decision.result === "success") {
        patterns.byReason[decision.reason].successful++;
      }

      // Count by who decided
      if (!patterns.byDecidedBy[decision.decidedBy]) {
        patterns.byDecidedBy[decision.decidedBy] = { count: 0, successful: 0 };
      }
      patterns.byDecidedBy[decision.decidedBy].count++;
      if (decision.result === "success") {
        patterns.byDecidedBy[decision.decidedBy].successful++;
      }

      if (decision.result === "success") {
        successCount++;
      }
    }

    patterns.successRate = filtered.length > 0 ? Math.round((successCount / filtered.length) * 100) : 0;

    return patterns;
  },
});

/**
 * Update a decision with outcome
 */
export const updateOutcome = mutation({
  args: {
    decisionId: v.id("decisions"),
    outcome: v.string(),
  },
  handler: wrapConvexHandler(async (ctx, args) => {
    const decision = await ctx.db.get(args.decisionId);
    if (!decision) throw ApiError.notFound('Decision', { decisionId: args.decisionId });

    await ctx.db.patch(args.decisionId, {
      outcome: args.outcome,
      outcomeAt: Date.now(),
    });

    return decision;
  }),
});

/**
 * Get decision history (audit trail)
 */
export const getAuditTrail = query({
  args: {
    businessId: v.id("businesses"),
    taskId: v.optional(v.id("tasks")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_business", (q: any) => q.eq("businessId", args.businessId))
      .collect();

    let filtered = decisions;
    if (args.taskId) {
      filtered = filtered.filter((d: any) => d.taskId === args.taskId);
    }

    return filtered.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  },
});
