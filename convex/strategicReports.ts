import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Strategic Reports API
 * Persistent storage and retrieval of weekly strategic analyses
 */

export const create = mutation({
  args: {
    week: v.number(),
    year: v.number(),
    report: v.string(), // JSON stringified
  },
  handler: async (ctx, args) => {
    // Parse report JSON to extract structured data
    const reportData = typeof args.report === "string" ? JSON.parse(args.report) : args.report;

    return await ctx.db.insert("strategicReports", {
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
  async handler(ctx) {
    const reports = await ctx.db
      .query("strategicReports")
      .order("desc")
      .take(1);
    return reports[0] || null;
  },
});

export const getByWeek = query({
  args: {
    week: v.number(),
    year: v.number(),
  },
  async handler(ctx, args) {
    const reports = await ctx.db
      .query("strategicReports")
      .filter((q) => q.and(q.eq(q.field("week"), args.week), q.eq(q.field("year"), args.year)))
      .take(1);
    return reports[0] || null;
  },
});

export const getAll = query({
  args: {
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query("strategicReports")
      .order("desc")
      .take(args.limit || 10);
  },
});

export const deleteByWeek = mutation({
  args: {
    week: v.number(),
    year: v.number(),
  },
  async handler(ctx, args) {
    const report = await ctx.db
      .query("strategicReports")
      .filter((q) => q.and(q.eq(q.field("week"), args.week), q.eq(q.field("year"), args.year)))
      .unique();

    if (report) {
      await ctx.db.delete(report._id);
    }
    return report?._id || null;
  },
});
