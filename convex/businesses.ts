import { v as convexVal } from "convex/values";
import { mutation, query } from "./_generated/server";

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

    // Delete tasks (cascades to subtask IDs in parent tasks)
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    for (const task of tasks) {
      await ctx.db.delete(task._id);
    }

    // Delete epics
    const epics = await ctx.db
      .query("epics")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    for (const epic of epics) {
      await ctx.db.delete(epic._id);
    }

    // Delete messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete activities
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    for (const activity of activities) {
      await ctx.db.delete(activity._id);
    }

    // Delete documents
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    for (const document of documents) {
      await ctx.db.delete(document._id);
    }

    // Delete calendar events (business-scoped)
    const calendarEvents = await ctx.db
      .query("calendarEvents")
      .collect();
    for (const event of calendarEvents) {
      // Filter by business context from task
      if (event.taskId) {
        const task = await ctx.db.get(event.taskId as any);
        if (task && (task as any).businessId === businessId) {
          await ctx.db.delete(event._id);
        }
      }
    }

    // Delete goals
    const goals = await ctx.db
      .query("goals")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    for (const goal of goals) {
      await ctx.db.delete(goal._id);
    }

    // Delete thread subscriptions
    const subscriptions = await ctx.db
      .query("threadSubscriptions")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    for (const sub of subscriptions) {
      await ctx.db.delete(sub._id);
    }

    // Delete agent metrics
    const metrics = await ctx.db
      .query("agentMetrics")
      .collect();
    for (const metric of metrics) {
      // Can't directly filter, so we'll skip (metrics are agent-scoped, not business-scoped)
    }

    // Delete execution logs
    const execLogs = await ctx.db
      .query("executionLog")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    for (const log of execLogs) {
      await ctx.db.delete(log._id);
    }

    // Delete alerts
    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    for (const alert of alerts) {
      await ctx.db.delete(alert._id);
    }

    // Delete alert rules
    const alertRules = await ctx.db
      .query("alertRules")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    for (const rule of alertRules) {
      await ctx.db.delete(rule._id);
    }

    // Delete alert events
    const alertEvents = await ctx.db
      .query("alertEvents")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    for (const event of alertEvents) {
      await ctx.db.delete(event._id);
    }

    // Delete decisions
    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    for (const decision of decisions) {
      await ctx.db.delete(decision._id);
    }

    // Delete strategic reports
    const reports = await ctx.db
      .query("strategicReports")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    for (const report of reports) {
      await ctx.db.delete(report._id);
    }

    // Delete settings
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_business_key", (q) => q.eq("businessId", businessId))
      .collect();
    for (const setting of settings) {
      await ctx.db.delete(setting._id);
    }

    // Delete the business itself
    await ctx.db.delete(businessId);

    return {
      success: true,
      deletedBusinessId: businessId,
      deletedData: {
        tasks: tasks.length,
        epics: epics.length,
        messages: messages.length,
        activities: activities.length,
        documents: documents.length,
        goals: goals.length,
        subscriptions: subscriptions.length,
        execLogs: execLogs.length,
        alerts: alerts.length,
        alertRules: alertRules.length,
        alertEvents: alertEvents.length,
        decisions: decisions.length,
        reports: reports.length,
        settings: settings.length,
      },
    };
  },
});
