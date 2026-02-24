import { v as convexVal } from "convex/values";
import { mutation, query } from "./_generated/server";
import { batchDelete } from "./utils/batchDelete";

/**
 * Businesses Module
 * CRUD operations for multi-business support (2-5 businesses per workspace)
 */

/**
 * Query: Get all businesses
 * Returns: Array of all businesses, sorted by name
 */
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const businesses = await ctx.db.query("businesses").collect();
    return businesses.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Query: Get business by ID
 * Parameters: businessId
 * Returns: Business object or null if not found
 */
export const getById = query({
  args: { businessId: convexVal.id("businesses") },
  handler: async (ctx, { businessId }) => {
    return await ctx.db.get(businessId);
  },
});

/**
 * Query: Get business by slug
 * Parameters: slug (URL-safe identifier)
 * Returns: Business object or null if not found
 */
export const getBySlug = query({
  args: { slug: convexVal.string() },
  handler: async (ctx, { slug }) => {
    const businesses = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .collect();

    return businesses.length > 0 ? businesses[0] : null;
  },
});

/**
 * Query: Get default business
 * Returns: Business object with isDefault: true (exactly one always exists)
 */
export const getDefault = query({
  args: {},
  handler: async (ctx) => {
    const businesses = await ctx.db
      .query("businesses")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .collect();

    return businesses.length > 0 ? businesses[0] : null;
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
    missionStatement: convexVal.string(), // Required: business purpose/problem being solved
  },
  handler: async (ctx, { name, slug, color, emoji, description, missionStatement }) => {
    // Validate slug format: lowercase, alphanumeric, hyphens only
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      throw new Error(
        "Invalid slug format. Use only lowercase letters, numbers, and hyphens."
      );
    }

    // Check slug uniqueness
    const existing = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .collect();

    if (existing.length > 0) {
      throw new Error(`Business with slug "${slug}" already exists.`);
    }

    // Check max 5 businesses limit
    const allBusinesses = await ctx.db.query("businesses").collect();
    if (allBusinesses.length >= 5) {
      throw new Error("Maximum 5 businesses allowed per workspace.");
    }

    // If first business, make it default
    const isDefault = allBusinesses.length === 0;

    // If making this default, unset previous default
    if (isDefault) {
      const previousDefault = await ctx.db
        .query("businesses")
        .withIndex("by_default", (q) => q.eq("isDefault", true))
        .collect();

      if (previousDefault.length > 0) {
        await ctx.db.patch(previousDefault[0]._id, { isDefault: false });
      }
    }

    const now = Date.now();
    const businessId = await ctx.db.insert("businesses", {
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

    // Initialize per-business settings (taskCounter starts at 0)
    await ctx.db.insert("settings", {
      key: "taskCounter",
      businessId,
      value: "0",
      updatedAt: now,
    });

    return await ctx.db.get(businessId);
  },
});

/**
 * Mutation: Update business details
 * Slug cannot be changed (immutable)
 * Can update: name, color, emoji, description, missionStatement
 */
export const update = mutation({
  args: {
    businessId: convexVal.id("businesses"),
    name: convexVal.optional(convexVal.string()),
    color: convexVal.optional(convexVal.string()),
    emoji: convexVal.optional(convexVal.string()),
    description: convexVal.optional(convexVal.string()),
    missionStatement: convexVal.optional(convexVal.string()),
  },
  handler: async (ctx, { businessId, name, color, emoji, description, missionStatement }) => {
    const business = await ctx.db.get(businessId);
    if (!business) {
      throw new Error("Business not found.");
    }

    const updates: Record<string, any> = { updatedAt: Date.now() };

    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    if (emoji !== undefined) updates.emoji = emoji;
    if (description !== undefined) updates.description = description;
    if (missionStatement !== undefined) updates.missionStatement = missionStatement;

    await ctx.db.patch(businessId, updates);
    return await ctx.db.get(businessId);
  },
});

/**
 * Mutation: Set default business
 * Atomically unsets previous default and sets new one
 * Idempotent: calling with already-default business is no-op
 */
export const setDefault = mutation({
  args: { businessId: convexVal.id("businesses") },
  handler: async (ctx, { businessId }) => {
    const business = await ctx.db.get(businessId);
    if (!business) {
      throw new Error("Business not found.");
    }

    // If already default, return (idempotent)
    if (business.isDefault) {
      return business;
    }

    // Find current default
    const currentDefault = await ctx.db
      .query("businesses")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .collect();

    // Unset previous default
    if (currentDefault.length > 0) {
      await ctx.db.patch(currentDefault[0]._id, { isDefault: false });
    }

    // Set new default
    await ctx.db.patch(businessId, { isDefault: true, updatedAt: Date.now() });
    return await ctx.db.get(businessId);
  },
});

/**
 * Mutation: Remove a business and all its data
 * Constraints:
 * - Cannot delete if only 1 business exists
 * - Cannot delete default business
 * Cascades:
 * - Deletes all tasks, epics, messages, activities
 * - Deletes all documents, calendar events, goals
 * - Deletes all related metrics and logs
 * - Deletes all settings and alerts
 * - Deletes all 25 business-scoped tables (includes MIG-10 additions)
 *
 * Optimization: Uses batchDelete() utility to handle 100+ records without timeout.
 * Performance: Linear time complexity O(n), no O(n²) cascades.
 */
export const remove = mutation({
  args: { businessId: convexVal.id("businesses") },
  handler: async (ctx, { businessId }) => {
    const business = await ctx.db.get(businessId);
    if (!business) {
      throw new Error("Business not found.");
    }

    // Check if only business
    const allBusinesses = await ctx.db.query("businesses").collect();
    if (allBusinesses.length <= 1) {
      throw new Error("Cannot delete the only business in workspace.");
    }

    // Check if default
    if (business.isDefault) {
      throw new Error("Cannot delete the default business. Set another as default first.");
    }

    // === Cascade Delete: Remove all business-scoped data ===
    // Uses unified pattern: query with index → collect IDs → batchDelete
    // This avoids timeout issues with individual delete loops

    const deletedCounts: Record<string, number> = {};

    // Helper: Collect IDs for a business-scoped table with index
    async function collectAndDelete(
      table: string,
      indexName: string
    ): Promise<number> {
      const records = await ctx.db
        .query(table as any)
        .withIndex(indexName, (q: any) => q.eq("businessId", businessId))
        .collect();

      if (records.length === 0) return 0;

      const ids = records.map((r: any) => r._id);
      const deleted = await batchDelete(ctx, ids, 100);
      return deleted;
    }

    // Delete from all 25 business-scoped tables (using indexes)
    deletedCounts.tasks = await collectAndDelete("tasks", "by_business");
    deletedCounts.epics = await collectAndDelete("epics", "by_business");
    deletedCounts.goals = await collectAndDelete("goals", "by_business");
    deletedCounts.messages = await collectAndDelete("messages", "by_business");
    deletedCounts.activities = await collectAndDelete("activities", "by_business");
    deletedCounts.documents = await collectAndDelete("documents", "by_business");
    deletedCounts.threadSubscriptions = await collectAndDelete("threadSubscriptions", "by_business");
    deletedCounts.executionLog = await collectAndDelete("executionLog", "by_business");
    deletedCounts.alerts = await collectAndDelete("alerts", "by_business");
    deletedCounts.alertRules = await collectAndDelete("alertRules", "by_business");
    deletedCounts.alertEvents = await collectAndDelete("alertEvents", "by_business");
    deletedCounts.decisions = await collectAndDelete("decisions", "by_business");
    deletedCounts.strategicReports = await collectAndDelete("strategicReports", "by_business");
    deletedCounts.settings = await collectAndDelete("settings", "by_business_key");

    // Delete calendar events using by_business index (MIG-10 backfill provides businessId)
    deletedCounts.calendarEvents = await collectAndDelete("calendarEvents", "by_business");

    // Delete task-scoped tables added in Phase 2
    deletedCounts.taskComments = await collectAndDelete("taskComments", "by_business");
    deletedCounts.mentions = await collectAndDelete("mentions", "by_business");
    deletedCounts.taskSubscriptions = await collectAndDelete("taskSubscriptions", "by_business");
    deletedCounts.presenceIndicators = await collectAndDelete("presenceIndicators", "by_business");
    deletedCounts.taskPatterns = await collectAndDelete("taskPatterns", "by_business");
    deletedCounts.anomalies = await collectAndDelete("anomalies", "by_business");
    deletedCounts.wikiPages = await collectAndDelete("wikiPages", "by_business");
    deletedCounts.wikiComments = await collectAndDelete("wikiComments", "by_business");
    deletedCounts.notifications = await collectAndDelete("notifications", "by_business");

    // Delete the business itself
    await ctx.db.delete(businessId);

    return {
      success: true,
      deletedBusinessId: businessId,
      deletedData: deletedCounts,
      totalRecordsDeleted: Object.values(deletedCounts).reduce((a, b) => a + b, 0),
    };
  },
});
