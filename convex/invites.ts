import { v as convexVal } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import type { QueryBuilder } from "convex/server";

/**
 * Invite Management - Email-based invite flow
 *
 * Handles:
 * - Creating invites with email + role + board access
 * - Accepting invites (validating token + email)
 * - Tracking invitation status (pending/accepted)
 * - Deleting/revoking invites
 */

/**
 * Get all invites for a workspace (pending + accepted)
 */
export const getInvites = query({
  args: {
    workspaceId: convexVal.id("workspaces"),
  },
  async handler(ctx, args) {
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();

    // Enrich with board access info
    const enriched = await Promise.all(
      invites.map(async (invite) => {
        const boardAccess = await ctx.db
          .query("inviteBoardAccess")
          .withIndex("by_invite", (q: any) => q.eq("inviteId", invite._id))
          .collect();

        return {
          ...invite,
          boardAccess,
        };
      })
    );

    return enriched;
  },
});

/**
 * Get invite by token (for accept flow)
 */
export const getByToken = query({
  args: {
    token: convexVal.string(),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query("invites")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .first();
  },
});

/**
 * Get pending invites by email
 */
export const getByEmail = query({
  args: {
    email: convexVal.string(),
  },
  async handler(ctx, args) {
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .collect();

    // Filter for pending (not yet accepted)
    return invites.filter((inv) => !inv.acceptedAt);
  },
});

/**
 * Create invite with optional per-board access
 * Returns { inviteId, token }
 */
export const createInvite = mutation({
  args: {
    workspaceId: convexVal.id("workspaces"),
    email: convexVal.string(),
    role: convexVal.union(convexVal.literal("owner"), convexVal.literal("admin"), convexVal.literal("member")),
    allBoardsRead: convexVal.boolean(),
    allBoardsWrite: convexVal.boolean(),
    boardAccess: convexVal.optional(
      convexVal.array(
        convexVal.object({
          workspaceId: convexVal.id("workspaces"),
          canRead: convexVal.boolean(),
          canWrite: convexVal.boolean(),
        })
      )
    ),
    invitedBy: convexVal.string(),
  },
  async handler(ctx, args) {
    // Generate random 32-char token
    const token = generateToken();

    // Create invite
    const inviteId = await ctx.db.insert("invites", {
      workspaceId: args.workspaceId,
      token,
      email: args.email.toLowerCase(), // normalize to lowercase
      role: args.role,
      allBoardsRead: args.allBoardsRead,
      allBoardsWrite: args.allBoardsWrite,
      invitedBy: args.invitedBy,
      acceptedBy: undefined,
      acceptedAt: undefined,
      createdAt: Date.now(),
    });

    // Create board access records if provided
    if (args.boardAccess && args.boardAccess.length > 0) {
      for (const access of args.boardAccess) {
        await ctx.db.insert("inviteBoardAccess", {
          inviteId,
          workspaceId: access.workspaceId,
          canRead: access.canRead,
          canWrite: access.canWrite,
        });
      }
    }

    return { inviteId, token };
  },
});

/**
 * Accept invite by validating token + email
 * Creates organizationMember + copies board access + marks accepted
 */
export const acceptInvite = mutation({
  args: {
    token: convexVal.string(),
    userId: convexVal.string(),
    userEmail: convexVal.string(),
    userName: convexVal.optional(convexVal.string()),
  },
  async handler(ctx, args) {
    // Find invite by token
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .first();

    if (!invite) {
      throw new ConvexError("Invalid or expired invite");
    }

    // Verify email matches (case-insensitive)
    if (invite.email !== args.userEmail.toLowerCase()) {
      throw new ConvexError("Email does not match invite");
    }

    // Check if already accepted
    if (invite.acceptedAt) {
      throw new ConvexError("Invite already accepted");
    }

    // Check if user already member
    const existing = await ctx.db
      .query("organizationMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", invite.workspaceId).eq("userId", args.userId)
      )
      .first();

    if (existing) {
      throw new ConvexError("User already member of this business");
    }

    // Create organizationMember
    const memberId = await ctx.db.insert("organizationMembers", {
      workspaceId: invite.workspaceId,
      userId: args.userId,
      userEmail: args.userEmail,
      userName: args.userName,
      role: invite.role,
      allBoardsRead: invite.allBoardsRead,
      allBoardsWrite: invite.allBoardsWrite,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Copy board access from invite
    const inviteBoardAccess = await ctx.db
      .query("inviteBoardAccess")
      .withIndex("by_invite", (q: any) => q.eq("inviteId", invite._id))
      .collect();

    for (const access of inviteBoardAccess) {
      await ctx.db.insert("boardAccess", {
        workspaceId: access.workspaceId,
        memberId,
        canRead: access.canRead,
        canWrite: access.canWrite,
        createdAt: Date.now(),
      });
    }

    // Mark invite as accepted
    await ctx.db.patch(invite._id, {
      acceptedBy: args.userId,
      acceptedAt: Date.now(),
    });

    return { memberId, workspaceId: invite.workspaceId };
  },
});

/**
 * Revoke/delete an invite
 */
export const deleteInvite = mutation({
  args: {
    inviteId: convexVal.id("invites"),
  },
  async handler(ctx, args) {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw new ConvexError("Invite not found");
    }

    // Delete associated board access
    const boardAccess = await ctx.db
      .query("inviteBoardAccess")
      .withIndex("by_invite", (q) => q.eq("inviteId", args.inviteId))
      .collect();

    for (const access of boardAccess) {
      await ctx.db.delete(access._id);
    }

    // Delete invite
    await ctx.db.delete(args.inviteId);
  },
});

/**
 * Generate a random 32-character hex token
 */
function generateToken(): string {
  const chars = "0123456789abcdef";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}
