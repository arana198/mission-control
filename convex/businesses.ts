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
 * Mutation: Remove a business
 * Constraints:
 * - Cannot delete if only 1 business exists
 * - Cannot delete default business
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

    // Delete business
    await ctx.db.delete(businessId);

    // Clean up business-scoped data (optional: cascading deletes handled by migration)
    // In production, consider implementing proper cascading delete or migration cleanup

    return { success: true, deletedBusinessId: businessId };
  },
});
