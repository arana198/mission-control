import { v as convexVal } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Approvals - Governance & Confidence-Based Workflows
 *
 * Handles:
 * - Creating approval requests with confidence scores
 * - Detecting conflicts (task already has pending approval)
 * - Resolving/reopening approvals
 * - Tracking approval history
 *
 * Confidence threshold: 80.0 (from lead_policy.CONFIDENCE_THRESHOLD)
 * If confidence < 80 OR isExternal OR isRisky → approval required
 */

const CONFIDENCE_THRESHOLD = 80.0;

/**
 * Check if approval is required based on confidence + risk factors
 */
export function approvalRequired({
  confidence,
  isExternal,
  isRisky,
}: {
  confidence: number;
  isExternal?: boolean;
  isRisky?: boolean;
}): boolean {
  return isExternal === true || isRisky === true || confidence < CONFIDENCE_THRESHOLD;
}

/**
 * Get approvals for workspace, optionally filtered by status
 * Returns pending approvals first, then resolved
 */
export const getBy = query({
  args: {
    workspaceId: convexVal.id("workspaces"),
    status: convexVal.optional(
      convexVal.union(
        convexVal.literal("pending"),
        convexVal.literal("approved"),
        convexVal.literal("rejected")
      )
    ),
  },
  async handler(ctx, args) {
    let query = ctx.db
      .query("approvals")
      .withIndex("by_workspace_status", (q: any) =>
        q.eq("workspaceId", args.workspaceId).eq("status", args.status || "pending")
      );

    let approvals = await query.collect();

    // If no status filter, get all and sort: pending first
    if (!args.status) {
      const all = await ctx.db
        .query("approvals")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
        .collect();

      approvals = all.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    }

    return approvals;
  },
});

/**
 * Get pending approval count (for sidebar badge)
 */
export const getPendingCount = query({
  args: {
    workspaceId: convexVal.id("workspaces"),
  },
  async handler(ctx, args) {
    const approvals = await ctx.db
      .query("approvals")
      .withIndex("by_workspace_status", (q: any) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "pending")
      )
      .collect();

    return approvals.length;
  },
});

/**
 * Get approvals linked to a specific task
 */
export const getByTask = query({
  args: {
    taskId: convexVal.id("tasks"),
  },
  async handler(ctx, args) {
    const links = await ctx.db
      .query("approvalTaskLinks")
      .withIndex("by_task", (q: any) => q.eq("taskId", args.taskId))
      .collect();

    const approvalIds = links.map((l) => l.approvalId);
    const approvals = await Promise.all(approvalIds.map((id) => ctx.db.get(id)));

    return approvals.filter((a) => a !== null);
  },
});

/**
 * Get tasks linked to an approval
 */
export const getTaskLinks = query({
  args: {
    approvalId: convexVal.id("approvals"),
  },
  async handler(ctx, args) {
    const links = await ctx.db
      .query("approvalTaskLinks")
      .withIndex("by_approval", (q: any) => q.eq("approvalId", args.approvalId))
      .collect();

    const taskIds = links.map((l) => l.taskId);
    const tasks = await Promise.all(taskIds.map((id) => ctx.db.get(id)));

    return tasks.filter((t) => t !== null);
  },
});

/**
 * Create approval request
 * Validates:
 * - leadReasoning is non-empty
 * - Each taskId doesn't already have pending approval (conflict check)
 */
export const createApproval = mutation({
  args: {
    workspaceId: convexVal.id("workspaces"),
    agentId: convexVal.optional(convexVal.id("agents")),
    taskIds: convexVal.optional(convexVal.array(convexVal.id("tasks"))),
    actionType: convexVal.string(),
    payload: convexVal.optional(convexVal.any()),
    confidence: convexVal.number(),
    rubricScores: convexVal.optional(convexVal.any()),
    leadReasoning: convexVal.string(),
    isExternal: convexVal.optional(convexVal.boolean()),
    isRisky: convexVal.optional(convexVal.boolean()),
  },
  async handler(ctx, args) {
    // Validate leadReasoning non-empty
    if (!args.leadReasoning || args.leadReasoning.trim().length === 0) {
      throw new ConvexError("leadReasoning required");
    }

    const taskIds = args.taskIds || [];

    // Check for conflicts: each task shouldn't already have pending approval
    for (const taskId of taskIds) {
      const existingLinks = await ctx.db
        .query("approvalTaskLinks")
        .withIndex("by_task", (q: any) => q.eq("taskId", taskId))
        .collect();

      for (const link of existingLinks) {
        const approval = await ctx.db.get(link.approvalId);
        if (approval && approval.status === "pending") {
          throw new ConvexError(`Task ${taskId} already has pending approval`);
        }
      }
    }

    // Create approval
    const approvalId = await ctx.db.insert("approvals", {
      workspaceId: args.workspaceId,
      agentId: args.agentId,
      actionType: args.actionType,
      payload: args.payload,
      confidence: args.confidence,
      rubricScores: args.rubricScores,
      leadReasoning: args.leadReasoning,
      isExternal: args.isExternal,
      isRisky: args.isRisky,
      status: "pending",
      resolvedBy: undefined,
      resolvedAt: undefined,
      createdAt: Date.now(),
    });

    // Create task links
    for (const taskId of taskIds) {
      await ctx.db.insert("approvalTaskLinks", {
        approvalId,
        taskId,
        createdAt: Date.now(),
      });
    }

    return approvalId;
  },
});

/**
 * Resolve approval (approve or reject)
 */
export const resolveApproval = mutation({
  args: {
    approvalId: convexVal.id("approvals"),
    status: convexVal.union(convexVal.literal("approved"), convexVal.literal("rejected")),
    resolvedBy: convexVal.string(),
  },
  async handler(ctx, args) {
    const approval = await ctx.db.get(args.approvalId);
    if (!approval) {
      throw new ConvexError("Approval not found");
    }

    if (approval.status !== "pending") {
      throw new ConvexError("Approval already resolved");
    }

    // Update approval
    await ctx.db.patch(args.approvalId, {
      status: args.status,
      resolvedBy: args.resolvedBy,
      resolvedAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      workspaceId: approval.workspaceId,
      type: "approval_resolved",
      agentId: args.resolvedBy,
      agentName: args.resolvedBy,
      message: `Approval ${args.status}`,
      createdAt: Date.now(),
    });

    return args.status;
  },
});

/**
 * Reopen approval (only if not already resolved)
 * Re-validates: no conflicting pending approvals on linked tasks
 */
export const reopenApproval = mutation({
  args: {
    approvalId: convexVal.id("approvals"),
  },
  async handler(ctx, args) {
    const approval = await ctx.db.get(args.approvalId);
    if (!approval) {
      throw new ConvexError("Approval not found");
    }

    if (approval.status === "pending") {
      throw new ConvexError("Approval already pending");
    }

    // Get linked tasks
    const links = await ctx.db
      .query("approvalTaskLinks")
      .withIndex("by_approval", (q: any) => q.eq("approvalId", args.approvalId))
      .collect();

    // Re-check conflicts
    for (const link of links) {
      const otherLinks = await ctx.db
        .query("approvalTaskLinks")
        .withIndex("by_task", (q: any) => q.eq("taskId", link.taskId))
        .collect();

      for (const otherLink of otherLinks) {
        if (otherLink.approvalId === args.approvalId) continue; // Skip self
        const otherApproval = await ctx.db.get(otherLink.approvalId);
        if (otherApproval && otherApproval.status === "pending") {
          throw new ConvexError(`Task ${link.taskId} has other pending approval`);
        }
      }
    }

    // Reopen
    await ctx.db.patch(args.approvalId, {
      status: "pending",
      resolvedAt: undefined,
    });

    return "pending";
  },
});

/**
 * Delete approval (only if already resolved)
 */
export const deleteApproval = mutation({
  args: {
    approvalId: convexVal.id("approvals"),
  },
  async handler(ctx, args) {
    const approval = await ctx.db.get(args.approvalId);
    if (!approval) {
      throw new ConvexError("Approval not found");
    }

    if (approval.status === "pending") {
      throw new ConvexError("Cannot delete pending approval");
    }

    // Delete task links
    const links = await ctx.db
      .query("approvalTaskLinks")
      .withIndex("by_approval", (q: any) => q.eq("approvalId", args.approvalId))
      .collect();

    for (const link of links) {
      await ctx.db.delete(link._id);
    }

    // Delete approval
    await ctx.db.delete(args.approvalId);
  },
});
