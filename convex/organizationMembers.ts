import { v as convexVal } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import type { QueryBuilder } from "convex/server";

/**
 * Organization Members - RBAC (Role-Based Access Control)
 *
 * Handles:
 * - Member queries (by business, by user)
 * - Member mutations (add, update, remove)
 * - Board-level access control
 * - Permission checks (requireAdmin, requireOwner)
 */

/**
 * Get all members for a business with their roles
 */
export const getMembers = query({
  args: {
    businessId: convexVal.id("businesses"),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query("organizationMembers")
      .withIndex("by_business", (q: any) => q.eq("businessId", args.businessId))
      .collect();
  },
});

/**
 * Get single member by business + user
 */
export const getMemberByUser = query({
  args: {
    businessId: convexVal.id("businesses"),
    userId: convexVal.string(),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query("organizationMembers")
      .withIndex("by_business_user", (q: any) =>
        q.eq("businessId", args.businessId).eq("userId", args.userId)
      )
      .first();
  },
});

/**
 * Check if user has required access (returns boolean, no throw)
 */
export const hasAccess = query({
  args: {
    businessId: convexVal.id("businesses"),
    userId: convexVal.string(),
    requiredRole: convexVal.optional(
      convexVal.union(convexVal.literal("owner"), convexVal.literal("admin"), convexVal.literal("member"))
    ),
  },
  async handler(ctx, args) {
    const member = await ctx.db
      .query("organizationMembers")
      .withIndex("by_business_user", (q: any) =>
        q.eq("businessId", args.businessId).eq("userId", args.userId)
      )
      .first();

    if (!member) return false;

    if (!args.requiredRole) return true;

    // Role hierarchy: owner > admin > member
    const roleHierarchy = { owner: 3, admin: 2, member: 1 };
    return roleHierarchy[member.role] >= roleHierarchy[args.requiredRole];
  },
});

/**
 * Add a new member to business
 */
export const addMember = mutation({
  args: {
    businessId: convexVal.id("businesses"),
    userId: convexVal.string(),
    userEmail: convexVal.optional(convexVal.string()),
    userName: convexVal.optional(convexVal.string()),
    role: convexVal.union(convexVal.literal("owner"), convexVal.literal("admin"), convexVal.literal("member")),
    allBoardsRead: convexVal.boolean(),
    allBoardsWrite: convexVal.boolean(),
  },
  async handler(ctx, args) {
    // Check if member already exists
    const existing = await ctx.db
      .query("organizationMembers")
      .withIndex("by_business_user", (q: any) =>
        q.eq("businessId", args.businessId).eq("userId", args.userId)
      )
      .first();

    if (existing) {
      throw new ConvexError(`User ${args.userId} already member of this business`);
    }

    const memberId = await ctx.db.insert("organizationMembers", {
      businessId: args.businessId,
      userId: args.userId,
      userEmail: args.userEmail,
      userName: args.userName,
      role: args.role,
      allBoardsRead: args.allBoardsRead,
      allBoardsWrite: args.allBoardsWrite,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return memberId;
  },
});

/**
 * Update member role/permissions
 */
export const updateMember = mutation({
  args: {
    memberId: convexVal.id("organizationMembers"),
    role: convexVal.optional(
      convexVal.union(convexVal.literal("owner"), convexVal.literal("admin"), convexVal.literal("member"))
    ),
    allBoardsRead: convexVal.optional(convexVal.boolean()),
    allBoardsWrite: convexVal.optional(convexVal.boolean()),
  },
  async handler(ctx, args) {
    const member = await ctx.db.get(args.memberId);
    if (!member) {
      throw new ConvexError("Member not found");
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.role !== undefined) updates.role = args.role;
    if (args.allBoardsRead !== undefined) updates.allBoardsRead = args.allBoardsRead;
    if (args.allBoardsWrite !== undefined) updates.allBoardsWrite = args.allBoardsWrite;

    await ctx.db.patch(args.memberId, updates);
  },
});

/**
 * Remove member from business
 */
export const removeMember = mutation({
  args: {
    memberId: convexVal.id("organizationMembers"),
  },
  async handler(ctx, args) {
    const member = await ctx.db.get(args.memberId);
    if (!member) {
      throw new ConvexError("Member not found");
    }

    // Don't allow removing the last owner
    if (member.role === "owner") {
      const ownerCount = await ctx.db
        .query("organizationMembers")
        .withIndex("by_business", (q) => q.eq("businessId", member.businessId))
        .collect();

      const ownerMembers = ownerCount.filter((m) => m.role === "owner");
      if (ownerMembers.length <= 1) {
        throw new ConvexError("Cannot remove the last owner");
      }
    }

    // Delete associated board access records
    const boardAccess = await ctx.db
      .query("boardAccess")
      .withIndex("by_member", (q) => q.eq("memberId", args.memberId))
      .collect();

    for (const access of boardAccess) {
      await ctx.db.delete(access._id);
    }

    // Delete member
    await ctx.db.delete(args.memberId);
  },
});

/**
 * Set board-level access for member
 */
export const setBoardAccess = mutation({
  args: {
    memberId: convexVal.id("organizationMembers"),
    businessId: convexVal.id("businesses"),
    canRead: convexVal.boolean(),
    canWrite: convexVal.boolean(),
  },
  async handler(ctx, args) {
    // Check if access record exists
    const existing = await ctx.db
      .query("boardAccess")
      .withIndex("by_member_business", (q) =>
        q.eq("memberId", args.memberId).eq("businessId", args.businessId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        canRead: args.canRead,
        canWrite: args.canWrite,
      });
    } else {
      await ctx.db.insert("boardAccess", {
        businessId: args.businessId,
        memberId: args.memberId,
        canRead: args.canRead,
        canWrite: args.canWrite,
        createdAt: Date.now(),
      });
    }
  },
});

/**
 * ─────────────────────────────────────────────────────────────────
 * INTERNAL HELPERS (exported for use by other Convex functions)
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * Require that user is admin+ for a business (throws ConvexError if not)
 */
export async function requireAdmin(
  ctx: any,
  businessId: Id<"businesses">,
  userId: string
): Promise<void> {
  const member = await ctx.db
    .query("organizationMembers")
    .withIndex("by_business_user", (q: any) => q.eq("businessId", businessId).eq("userId", userId))
    .first();

  if (!member) {
    throw new ConvexError("User is not a member of this business");
  }

  if (member.role !== "owner" && member.role !== "admin") {
    throw new ConvexError("Insufficient permissions (admin+ required)");
  }
}

/**
 * Require that user is owner for a business (throws ConvexError if not)
 */
export async function requireOwner(
  ctx: any,
  businessId: Id<"businesses">,
  userId: string
): Promise<void> {
  const member = await ctx.db
    .query("organizationMembers")
    .withIndex("by_business_user", (q: any) => q.eq("businessId", businessId).eq("userId", userId))
    .first();

  if (!member) {
    throw new ConvexError("User is not a member of this business");
  }

  if (member.role !== "owner") {
    throw new ConvexError("Insufficient permissions (owner required)");
  }
}
