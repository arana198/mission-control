import { mutation, query } from "./_generated/server";
import { v as convexVal } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Strategic Reports API
 * Persistent storage and retrieval of weekly strategic analyses
 */

export const create = mutation({
  args: {
    businessId: convexVal.id("businesses"),  // REQUIRED: business scoping
    week: convexVal.number(),
    year: convexVal.number(),
    report: convexVal.string(), // JSON stringified
  },
  handler: async (ctx, args) => {
    // Parse report JSON to extract structured data
    const reportData = typeof args.report === "string" ? JSON.parse(args.report) : args.report;

    return await ctx.db.insert("strategicReports", {
      businessId: args.businessId,  // ADD: business scoping
      week: args.week,
      year: args.year,
      goalsReview: reportData.goalsReview || {
        activeGoals: 0,
        completedThisWeek: [],
        blockedGoals: [],
        acceleratingGoals: [],
      },
      taskMetrics: reportData.taskMetrics || {
        tasksGenerated: 0,
        tasksCompleted: 0,
        avgCompletionRate: 0,
        avgTimePerTask: 0,
        blockedBy: [],
      },
      insights: reportData.insights || [],
      recommendations: reportData.recommendations || [],
      createdAt: Date.now(),
    });
  },
});

export const getLatest = query({
  args: {
    businessId: convexVal.id("businesses"),  // REQUIRED: business scoping
  },
  async handler(ctx, args) {
    const reports = await ctx.db
      .query("strategicReports")
      .withIndex("by_business_week", (q: any) => q.eq("businessId", args.businessId))
      .order("desc")
      .take(1);
    return reports[0] || null;
  },
});

export const getByWeek = query({
  args: {
    businessId: convexVal.id("businesses"),  // REQUIRED: business scoping
    week: convexVal.number(),
    year: convexVal.number(),
  },
  async handler(ctx, args) {
    const reports = await ctx.db
      .query("strategicReports")
      .withIndex("by_business_week", (q: any) => q.eq("businessId", args.businessId))
      .filter((q: any) => q.and(q.eq(q.field("week"), args.week), q.eq(q.field("year"), args.year)))
      .take(1);
    return reports[0] || null;
  },
});

export const getAll = query({
  args: {
    businessId: convexVal.id("businesses"),  // REQUIRED: business scoping
    limit: convexVal.optional(convexVal.number()),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query("strategicReports")
      .withIndex("by_business_week", (q: any) => q.eq("businessId", args.businessId))
      .order("desc")
      .take(args.limit || 10);
  },
});

export const deleteByWeek = mutation({
  args: {
    week: convexVal.number(),
    year: convexVal.number(),
  },
  async handler(ctx, args) {
    const report = await ctx.db
      .query("strategicReports")
      .filter((q: any) => q.and(q.eq(q.field("week"), args.week), q.eq(q.field("year"), args.year)))
      .unique();

    if (report) {
      await ctx.db.delete(report._id);
    }
    return report?._id || null;
  },
});
