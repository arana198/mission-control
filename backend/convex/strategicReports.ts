import { mutation, query } from "./_generated/server";
import { v as convexVal } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Strategic Reports API
 * Persistent storage and retrieval of weekly strategic analyses
 */

export const create = mutation({
  args: {
    workspaceId: convexVal.id("workspaces"),  // REQUIRED: workspace scoping
    week: convexVal.number(),
    year: convexVal.number(),
    report: convexVal.string(), // JSON stringified
  },
  handler: async (ctx, args) => {
    // Parse report JSON to extract structured data
    const reportData = typeof args.report === "string" ? JSON.parse(args.report) : args.report;

    return await ctx.db.insert("strategicReports", {
      workspaceId: args.workspaceId,  // ADD: workspace scoping
      week: args.week,
      year: args.year,
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
    workspaceId: convexVal.id("workspaces"),  // REQUIRED: workspace scoping
  },
  async handler(ctx, args) {
    const reports = await ctx.db
      .query("strategicReports")
      .withIndex("by_workspace_week", (q: any) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(1);
    return reports[0] || null;
  },
});

export const getByWeek = query({
  args: {
    workspaceId: convexVal.id("workspaces"),  // REQUIRED: workspace scoping
    week: convexVal.number(),
    year: convexVal.number(),
  },
  async handler(ctx, args) {
    const reports = await ctx.db
      .query("strategicReports")
      .withIndex("by_workspace_week", (q: any) => q.eq("workspaceId", args.workspaceId))
      .filter((q: any) => q.and(q.eq(q.field("week"), args.week), q.eq(q.field("year"), args.year)))
      .take(1);
    return reports[0] || null;
  },
});

export const getAll = query({
  args: {
    workspaceId: convexVal.id("workspaces"),  // REQUIRED: workspace scoping
    limit: convexVal.optional(convexVal.number()),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query("strategicReports")
      .withIndex("by_workspace_week", (q: any) => q.eq("workspaceId", args.workspaceId))
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

/**
 * FRONTEND COMPATIBILITY ALIASES
 * These aliases map frontend route expectations to actual backend implementations
 * Phase 1: Convex API alignment (1% final verification)
 */

// Alias: listReports -> getAll
export const listReports = query({
  handler: async (ctx) => {
    return await ctx.db.query("strategicReports").take(100);
  },
});

// Alias: createReport -> create (with compatibility args)
export const createReport = mutation({
  args: {
    title: v.string(),
    content: v.optional(v.string()),
    week: v.optional(v.number()),
    year: v.optional(v.number()),
  },
  handler: wrapConvexHandler(async (ctx, { title, content, week, year }) => {
    const now = Date.now();
    const date = new Date();

    const reportId = await ctx.db.insert("strategicReports", {
      title,
      content: content || "",
      week: week || date.getWeek?.() || 1,
      year: year || date.getFullYear(),
      createdAt: now,
      updatedAt: now,
    });

    const report = await ctx.db.get(reportId);
    return report;
  }),
});

// Alias: getReport -> getLatest (or by ID)
export const getReport = query({
  args: { reportId: v.optional(v.id("strategicReports")) },
  handler: async (ctx, { reportId }) => {
    if (reportId) {
      return await ctx.db.get(reportId);
    }
    // If no ID provided, return latest
    return await ctx.db
      .query("strategicReports")
      .order("desc")
      .first();
  },
});

// Add: updateReport (missing in original)
export const updateReport = mutation({
  args: {
    reportId: v.id("strategicReports"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: wrapConvexHandler(async (ctx, { reportId, title, content }) => {
    const report = await ctx.db.get(reportId);
    if (!report) throw ApiError.notFound("Report", { reportId });

    const updates: any = { updatedAt: Date.now() };
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;

    await ctx.db.patch(reportId, updates);

    const updated = await ctx.db.get(reportId);
    return updated;
  }),
});

// Alias: deleteReport -> generic delete (not deleteByWeek)
export const deleteReport = mutation({
  args: { reportId: v.id("strategicReports") },
  handler: wrapConvexHandler(async (ctx, { reportId }) => {
    const report = await ctx.db.get(reportId);
    if (!report) throw ApiError.notFound("Report", { reportId });

    await ctx.db.delete(reportId);

    return { success: true, deletedReportId: reportId };
  }),
});
