import { v as convexVal } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import type { QueryBuilder } from "convex/server";

/**
 * Organization Members - RBAC (Role-Based Access Control)
 *
 * Handles:
 * - Member queries (by workspace, by user)
 * - Member mutations (add, update, remove)
 * - Board-level access control
 * - Permission checks (requireRole, requireAdmin, requireOwner)
 * - 4-level role hierarchy: admin (4) > agent (3) > collaborator (2) > viewer (1)
 */

/**
 * ROLE_LEVELS - 4-level role hierarchy
 * admin (4) > agent (3) > collaborator (2) > viewer (1)
 */
export const ROLE_LEVELS = {
  admin: 4,
  agent: 3,
  collaborator: 2,
  viewer: 1,
} as const;

/**
 * UserRole type - the 4-level role system
 */
export type UserRole = keyof typeof ROLE_LEVELS;

/**
 * Check if a user's role satisfies a required role
 * Returns true if userRole >= requiredRole (hierarchy-based)
 */
export function hasRequiredRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
}

/**
 * Map legacy roles (owner/admin/member) to new 4-level roles
 * Used during migration period when both role and userRole fields exist
 */
function mapLegacyRole(role: string | undefined): UserRole {
  const mapping: Record<string, UserRole> = {
    owner: "admin",
    admin: "collaborator",
    member: "viewer",
  };
  return mapping[role ?? ""] ?? "viewer";
}

/**
 * Require a specific role for a user in a workspace
 * Throws ConvexError("NOT_FOUND") if user doesn't have the required role
 * System admins bypass this check (they have all roles in all workspaces)
 */
export async function requireRole(
  ctx: any,
  workspaceId: Id<"workspaces">,
  userId: string,
  requiredRole: UserRole
): Promise<void> {
  // Check if system admin (bypasses workspace membership)
  const sysAdmin = await ctx.db
    .query("systemAdmins")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (sysAdmin) return;

  // Look up workspace membership
  const member = await ctx.db
    .query("organizationMembers")
    .withIndex("by_workspace_user", (q: any) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId)
    )
    .first();

  // Return 404 per locked decision (security through obscurity, not 403)
  if (!member) {
    throw new ConvexError("NOT_FOUND");
  }

  // Use new userRole if available, fall back to legacy role mapping
  const effectiveRole = (member.userRole ?? mapLegacyRole(member.role)) as UserRole;

  if (!hasRequiredRole(effectiveRole, requiredRole)) {
    throw new ConvexError("NOT_FOUND");
  }
}

/**
 * Get all members for a workspace with their roles
 */
export const getMembers = query({
  args: {
    workspaceId: convexVal.id("workspaces"),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query("organizationMembers")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

/**
 * Get single member by workspace + user
 */
export const getMemberByUser = query({
  args: {
    workspaceId: convexVal.id("workspaces"),
    userId: convexVal.string(),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query("organizationMembers")
      .withIndex("by_workspace_user", (q: any) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .first();
  },
});

/**
 * Check if user has required access (returns boolean, no throw)
 * Supports both legacy 3-role and new 4-level role systems during migration
 */
export const hasAccess = query({
  args: {
    workspaceId: convexVal.id("workspaces"),
    userId: convexVal.string(),
    requiredRole: convexVal.optional(
      convexVal.union(
        convexVal.literal("owner"),
        convexVal.literal("admin"),
        convexVal.literal("member"),
        convexVal.literal("agent"),
        convexVal.literal("collaborator"),
        convexVal.literal("viewer")
      )
    ),
  },
  async handler(ctx, args) {
    const member = await ctx.db
      .query("organizationMembers")
      .withIndex("by_workspace_user", (q: any) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .first();

    if (!member) return false;

    if (!args.requiredRole) return true;

    // Support both legacy 3-role and new 4-level role systems
    const roleHierarchy: Record<string, number> = {
      // New 4-level system
      admin: 4,
      agent: 3,
      collaborator: 2,
      viewer: 1,
      // Legacy 3-level system (mapped to new system)
      owner: 4,      // maps to admin
      member: 1,     // maps to viewer
    };

    // Get effective role (prefer new userRole, fall back to legacy role)
    const effectiveRole = member.userRole ?? (member.role ? mapLegacyRole(member.role) : undefined);

    if (!effectiveRole) return false;

    return roleHierarchy[effectiveRole] >= roleHierarchy[args.requiredRole];
  },
});

/**
 * Add a new member to business
 */
export const addMember = mutation({
  args: {
    workspaceId: convexVal.id("workspaces"),
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
      .withIndex("by_workspace_user", (q: any) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .first();

    if (existing) {
      throw new ConvexError(`User ${args.userId} already member of this business`);
    }

    const memberId = await ctx.db.insert("organizationMembers", {
      workspaceId: args.workspaceId,
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
 * Remove member mutation
 * Prevents removing the last admin of a workspace
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

    // Check if this is an admin (either new userRole or legacy role)
    const isAdmin =
      member.userRole === "admin" || member.role === "owner";

    // Don't allow removing the last admin
    if (isAdmin) {
      const allMembers = await ctx.db
        .query("organizationMembers")
        .withIndex("by_workspace", (q: any) =>
          q.eq("workspaceId", member.workspaceId)
        )
        .collect();

      // Count admins (check both new and legacy role fields)
      const adminMembers = allMembers.filter(
        (m: any) => m.userRole === "admin" || m.role === "owner"
      );

      if (adminMembers.length <= 1) {
        throw new ConvexError("Must have at least one admin");
      }
    }

    // Delete associated board access records
    const boardAccess = await ctx.db
      .query("boardAccess")
      .withIndex("by_member", (q: any) => q.eq("memberId", args.memberId))
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
    workspaceId: convexVal.id("workspaces"),
    canRead: convexVal.boolean(),
    canWrite: convexVal.boolean(),
  },
  async handler(ctx, args) {
    // Check if access record exists
    const existing = await ctx.db
      .query("boardAccess")
      .withIndex("by_member_business", (q) =>
        q.eq("memberId", args.memberId).eq("workspaceId", args.workspaceId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        canRead: args.canRead,
        canWrite: args.canWrite,
      });
    } else {
      await ctx.db.insert("boardAccess", {
        workspaceId: args.workspaceId,
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
 * Require that user is admin+ for a workspace (throws ConvexError if not)
 */
export async function requireAdmin(
  ctx: any,
  workspaceId: Id<"workspaces">,
  userId: string
): Promise<void> {
  const member = await ctx.db
    .query("organizationMembers")
    .withIndex("by_workspace_user", (q: any) => q.eq("workspaceId", workspaceId).eq("userId", userId))
    .first();

  if (!member) {
    throw new ConvexError("User is not a member of this business");
  }

  if (member.role !== "owner" && member.role !== "admin") {
    throw new ConvexError("Insufficient permissions (admin+ required)");
  }
}

/**
 * Require that user is owner for a workspace (throws ConvexError if not)
 */
export async function requireOwner(
  ctx: any,
  workspaceId: Id<"workspaces">,
  userId: string
): Promise<void> {
  const member = await ctx.db
    .query("organizationMembers")
    .withIndex("by_workspace_user", (q: any) => q.eq("workspaceId", workspaceId).eq("userId", userId))
    .first();

  if (!member) {
    throw new ConvexError("User is not a member of this business");
  }

  if (member.role !== "owner") {
    throw new ConvexError("Insufficient permissions (owner required)");
  }
}
