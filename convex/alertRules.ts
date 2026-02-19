/**
 * Alert Rules Module
 * Define and manage alert rules that trigger notifications
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create an alert rule
 */
export const create = mutation({
  args: {
    businessId: v.id("businesses"),
    name: v.string(),
    condition: v.union(
      v.literal("queueDepth > threshold"),
      v.literal("taskBlocked > Xmin"),
      v.literal("taskDueDate < now"),
      v.literal("throughput < threshold"),
      v.literal("agentCrash"),
      v.literal("custom")
    ),
    threshold: v.optional(v.number()),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
    cooldownSeconds: v.number(),
    channels: v.array(
      v.union(v.literal("in-app"), v.literal("slack"), v.literal("email"))
    ),
    slackChannel: v.optional(v.string()),
    slackMention: v.optional(v.string()),
    emailAddresses: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ruleId = await ctx.db.insert("alertRules", {
      businessId: args.businessId,
      name: args.name,
      description: args.description,
      enabled: true,
      condition: args.condition,
      threshold: args.threshold,
      severity: args.severity,
      cooldownSeconds: args.cooldownSeconds,
      channels: args.channels,
      slackChannel: args.slackChannel,
      slackMention: args.slackMention,
      emailAddresses: args.emailAddresses,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return ruleId;
  },
});

/**
 * Get all alert rules for a business
 */
export const getByBusiness = query({
  args: {
    businessId: v.id("businesses"),
    enabledOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const rules = await ctx.db
      .query("alertRules")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    let filtered = rules;
    if (args.enabledOnly) {
      filtered = rules.filter((r) => r.enabled === true);
    }

    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Get a single alert rule
 */
export const getById = query({
  args: {
    ruleId: v.id("alertRules"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.ruleId);
  },
});

/**
 * Update an alert rule
 */
export const update = mutation({
  args: {
    ruleId: v.id("alertRules"),
    name: v.optional(v.string()),
    threshold: v.optional(v.number()),
    severity: v.optional(v.union(v.literal("info"), v.literal("warning"), v.literal("critical"))),
    cooldownSeconds: v.optional(v.number()),
    channels: v.optional(v.array(v.union(v.literal("in-app"), v.literal("slack"), v.literal("email")))),
    slackChannel: v.optional(v.string()),
    slackMention: v.optional(v.string()),
    emailAddresses: v.optional(v.array(v.string())),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { ruleId, ...updates } = args;

    const rule = await ctx.db.get(ruleId);
    if (!rule) throw new Error("Alert rule not found");

    await ctx.db.patch(ruleId, {
      ...updates,
      updatedAt: Date.now(),
    });

    return rule;
  },
});

/**
 * Toggle alert rule enabled/disabled
 */
export const toggle = mutation({
  args: {
    ruleId: v.id("alertRules"),
  },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new Error("Alert rule not found");

    await ctx.db.patch(args.ruleId, {
      enabled: !rule.enabled,
      updatedAt: Date.now(),
    });

    return rule;
  },
});

/**
 * Delete an alert rule
 */
export const delete_ = mutation({
  args: {
    ruleId: v.id("alertRules"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.ruleId);
    return args.ruleId;
  },
});
