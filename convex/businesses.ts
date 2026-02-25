import { v as convexVal } from "convex/values";
import { mutation, query } from "./_generated/server";
import { batchDelete } from "./utils/batchDelete";
import { ApiError, wrapConvexHandler } from "../lib/errors";

/**
 * es Module
 * CRUD operations for multi-business support (2-5 workspaces per workspace)
 *
 * Phase 1: Error standardization - all mutations now use ApiError with request IDs
 */

/**
 * Query: Get all businesses
 * Returns: Array of all businesses, sorted by name
 */
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("workspaces").collect();
    return workspaces.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Query: Get workspace by ID
 * Parameters: workspaceId
 * Returns:  object or null if not found
 */
export const getWorkspaceById = query({
  args: { workspaceId: convexVal.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    return await ctx.db.get(workspaceId);
  },
});

/**
 * Query: Get workspace by slug
 * Parameters: slug (URL-safe identifier)
 * Returns:  object or null if not found
 */
export const getBySlug = query({
  args: { slug: convexVal.string() },
  handler: async (ctx, { slug }) => {
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .collect();

    return workspaces.length > 0 ? workspaces[0] : null;
  },
});

/**
 * Query: Get default business
 * Returns:  object with isDefault: true (exactly one always exists)
 */
export const getDefaultWorkspace = query({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_default", (q: any) => q.eq("isDefault", true))
      .collect();

    return workspaces.length > 0 ? workspaces[0] : null;
  },
});

/**
 * Mutation: Create a new business
 * Validates: slug format, uniqueness, max 5 businesses
 * Auto-sets isDefault: true if first business
 */
export const create = mutation({
  args: {
    name: convexVal.string(),
    slug: convexVal.string(),
    color: convexVal.optional(convexVal.string()),
    emoji: convexVal.optional(convexVal.string()),
    description: convexVal.optional(convexVal.string()),
    missionStatement: convexVal.string(), // Required: workspace purpose/problem being solved
  },
  handler: wrapConvexHandler(async (ctx, { name, slug, color, emoji, description, missionStatement }) => {
    // Validate slug format: lowercase, alphanumeric, hyphens only
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      throw ApiError.validationError(
        "Invalid slug format. Use only lowercase letters, numbers, and hyphens.",
        { field: "slug", value: slug, pattern: "[a-z0-9-]+" }
      );
    }

    // Check slug uniqueness
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .collect();

    if (existing.length > 0) {
      throw ApiError.conflict(
        ` with slug "${slug}" already exists`,
        { slug, existingId: existing[0]._id }
      );
    }

    // Check max 5 workspaces limit
    const alles = await ctx.db.query("workspaces").collect();
    if (alles.length >= 5) {
      throw ApiError.limitExceeded(
        "Maximum 5 workspaces allowed per workspace",
        { limit: 5, current: alles.length }
      );
    }

    // If first workspace, make it default
    const isDefault = alles.length === 0;

    // If making this default, unset previous default
    if (isDefault) {
      const previousDefault = await ctx.db
        .query("workspaces")
        .withIndex("by_default", (q: any) => q.eq("isDefault", true))
        .collect();

      if (previousDefault.length > 0) {
        await ctx.db.patch(previousDefault[0]._id, { isDefault: false });
      }
    }

    const now = Date.now();
    const workspaceId = await ctx.db.insert("workspaces", {
      name,
      slug,
      color: color || "#6366f1", // Default indigo
      emoji: emoji || "🚀",
      description,
      missionStatement,
      isDefault,
      createdAt: now,
      updatedAt: now,
    });

    // Initialize per-workspace settings (taskCounter starts at 0)
    await ctx.db.insert("settings", {
      key: "taskCounter",
      workspaceId,
      value: "0",
      updatedAt: now,
    });

    return await ctx.db.get(workspaceId);
  }),
});

/**
 * Mutation: Update workspace details
 * Slug cannot be changed (immutable)
 * Can update: name, color, emoji, description, missionStatement
 */
export const update = mutation({
  args: {
    workspaceId: convexVal.id("workspaces"),
    name: convexVal.optional(convexVal.string()),
    color: convexVal.optional(convexVal.string()),
    emoji: convexVal.optional(convexVal.string()),
    description: convexVal.optional(convexVal.string()),
    missionStatement: convexVal.optional(convexVal.string()),
  },
  handler: wrapConvexHandler(async (ctx, { workspaceId, name, color, emoji, description, missionStatement }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
      throw ApiError.notFound("Workspace", { workspaceId });
    }

    const updates: Record<string, any> = { updatedAt: Date.now() };

    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    if (emoji !== undefined) updates.emoji = emoji;
    if (description !== undefined) updates.description = description;
    if (missionStatement !== undefined) updates.missionStatement = missionStatement;

    await ctx.db.patch(workspaceId, updates);
    return await ctx.db.get(workspaceId);
  }),
});

/**
 * Mutation: Set default business
 * Atomically unsets previous default and sets new one
 * Idempotent: calling with already-default workspace is no-op
 */
export const setDefault = mutation({
  args: { workspaceId: convexVal.id("workspaces") },
  handler: wrapConvexHandler(async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
      throw ApiError.notFound("Workspace", { workspaceId });
    }

    // If already default, return (idempotent)
    if (workspace.isDefault) {
      return workspace;
    }

    // Find current default
    const currentDefault = await ctx.db
      .query("workspaces")
      .withIndex("by_default", (q: any) => q.eq("isDefault", true))
      .collect();

    // Unset previous default
    if (currentDefault.length > 0) {
      await ctx.db.patch(currentDefault[0]._id, { isDefault: false });
    }

    // Set new default
    await ctx.db.patch(workspaceId, { isDefault: true, updatedAt: Date.now() });
    return await ctx.db.get(workspaceId);
  }),
});

/**
 * Mutation: Remove a workspace and all its data
 * Constraints:
 * - Cannot delete if only 1 workspace exists
 * - Cannot delete default business
 * Cascades:
 * - Deletes all tasks, epics, messages, activities
 * - Deletes all documents, calendar events, goals
 * - Deletes all related metrics and logs
 * - Deletes all settings and alerts
 * - Deletes all 25 workspace-scoped tables (includes MIG-10 additions)
 *
 * Optimization: Uses batchDelete() utility to handle 100+ records without timeout.
 * Performance: Linear time complexity O(n), no O(n²) cascades.
 */
export const remove = mutation({
  args: { workspaceId: convexVal.id("workspaces") },
  handler: wrapConvexHandler(async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
      throw ApiError.notFound("Workspace", { workspaceId });
    }

    // Check if only business
    const alles = await ctx.db.query("workspaces").collect();
    if (alles.length <= 1) {
      throw ApiError.conflict(
        "Cannot delete the only workspace in workspace",
        { workspaceId, totales: alles.length }
      );
    }

    // Check if default
    if (workspace.isDefault) {
      throw ApiError.conflict(
        "Cannot delete the default  workspace. Set another as default first.",
        { workspaceId, isDefault: true }
      );
    }

    // === Cascade Delete: Remove all workspace-scoped data ===
    // Uses unified pattern: query with index → collect IDs → batchDelete
    // This avoids timeout issues with individual delete loops

    const deletedCounts: Record<string, number> = {};

    // Helper: Collect IDs for a workspace-scoped table with index
    async function collectAndDelete(
      table: string,
      indexName: string
    ): Promise<number> {
      const records = await ctx.db
        .query(table as any)
        .withIndex(indexName, (q: any) => q.eq("workspaceId", workspaceId))
        .collect();

      if (records.length === 0) return 0;

      const ids = records.map((r: any) => r._id);
      const deleted = await batchDelete(ctx, ids, 100);
      return deleted;
    }

    // Delete from all 25 workspace-scoped tables (using indexes)
    deletedCounts.tasks = await collectAndDelete("tasks", "by_workspace");
    deletedCounts.epics = await collectAndDelete("epics", "by_workspace");
    deletedCounts.goals = await collectAndDelete("goals", "by_workspace");
    deletedCounts.messages = await collectAndDelete("messages", "by_workspace");
    deletedCounts.activities = await collectAndDelete("activities", "by_workspace");
    deletedCounts.documents = await collectAndDelete("documents", "by_workspace");
    deletedCounts.threadSubscriptions = await collectAndDelete("threadSubscriptions", "by_workspace");
    deletedCounts.executionLog = await collectAndDelete("executionLog", "by_workspace");
    deletedCounts.alerts = await collectAndDelete("alerts", "by_workspace");
    deletedCounts.alertRules = await collectAndDelete("alertRules", "by_workspace");
    deletedCounts.alertEvents = await collectAndDelete("alertEvents", "by_workspace");
    deletedCounts.decisions = await collectAndDelete("decisions", "by_workspace");
    deletedCounts.strategicReports = await collectAndDelete("strategicReports", "by_workspace");
    deletedCounts.settings = await collectAndDelete("settings", "by_workspace_key");

    // Delete calendar events using by_workspace index (MIG-10 backfill provides workspaceId)
    deletedCounts.calendarEvents = await collectAndDelete("calendarEvents", "by_workspace");

    // Delete task-scoped tables added in Phase 2
    deletedCounts.taskComments = await collectAndDelete("taskComments", "by_workspace");
    deletedCounts.mentions = await collectAndDelete("mentions", "by_workspace");
    deletedCounts.taskSubscriptions = await collectAndDelete("taskSubscriptions", "by_workspace");
    deletedCounts.presenceIndicators = await collectAndDelete("presenceIndicators", "by_workspace");
    deletedCounts.taskPatterns = await collectAndDelete("taskPatterns", "by_workspace");
    deletedCounts.anomalies = await collectAndDelete("anomalies", "by_workspace");
    deletedCounts.wikiPages = await collectAndDelete("wikiPages", "by_workspace");
    deletedCounts.wikiComments = await collectAndDelete("wikiComments", "by_workspace");
    deletedCounts.notifications = await collectAndDelete("notifications", "by_workspace");

    // Delete the workspace itself
    await ctx.db.delete(workspaceId);

    return {
      success: true,
      deletedId: workspaceId,
      deletedData: deletedCounts,
      totalRecordsDeleted: Object.values(deletedCounts).reduce((a, b) => a + b, 0),
    };
  }),
});
