import { v as convexVal } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ApiError, wrapConvexHandler, withRetry, RETRY_CONFIGS } from "../lib/errors";

/**
 * Notification System
 * @Mentions and thread subscriptions
 *
 * Phase 1: Error standardization
 * Phase 2: Advanced error handling with retry logic for critical operations
 */

/**
 * Create notification
 * Phase 2: Added retry logic for transient DB failures
 */
export const create = mutation({
  args: {
    recipientId: convexVal.id("agents"),
    type: convexVal.union(
      convexVal.literal("mention"),
      convexVal.literal("assignment"),
      convexVal.literal("status_change"),
      convexVal.literal("block"),
      convexVal.literal("dependency_unblocked")
    ),
    content: convexVal.string(),
    taskId: convexVal.optional(convexVal.id("tasks")),
    taskTitle: convexVal.optional(convexVal.string()),
    fromId: convexVal.string(),
    fromName: convexVal.string(),
    messageId: convexVal.optional(convexVal.id("messages")),
  },
  handler: wrapConvexHandler(
    async (ctx, { recipientId, type, content, taskId, taskTitle, fromId, fromName, messageId }) => {
      // Verify recipient exists
      const recipient = await ctx.db.get(recipientId);
      if (!recipient) {
        throw ApiError.notFound("Agent", { agentId: recipientId });
      }

      // Insert with retry for transient failures
      return await withRetry(
        () =>
          ctx.db.insert("notifications", {
            recipientId,
            type,
            content,
            taskId,
            taskTitle,
            fromId,
            fromName,
            messageId,
            read: false,
            createdAt: Date.now(),
          }),
        "create-notification",
        RETRY_CONFIGS.STANDARD
      );
    }
  ),
});

// Get all notifications
export const getAll = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("notifications")
      .order("desc")
      .take(100);
  },
});

// Get undelivered notifications (for daemon polling)
export const getUndelivered = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("notifications")
      .filter((q: any) => q.eq(q.field("read"), false))
      .order("desc")
      .take(100);
  },
});

// Get notifications for specific agent
export const getForAgent = query({
  args: {
    agentId: convexVal.id("agents"),
    includeRead: convexVal.optional(convexVal.boolean()),
    limit: convexVal.optional(convexVal.number())
  },
  handler: async (ctx, { agentId, includeRead, limit }) => {
    let notifications;

    if (includeRead) {
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_recipient", (q: any) => q.eq("recipientId", agentId))
        .order("desc")
        .take(limit || 50);
    } else {
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_recipient", (q: any) => q.eq("recipientId", agentId))
        .filter((q: any) => q.eq(q.field("read"), false))
        .order("desc")
        .take(limit || 50);
    }

    return notifications;
  },
});

/**
 * Mark notification as read
 * Phase 2: Added error handling and validation
 */
export const markRead = mutation({
  args: { id: convexVal.id("notifications") },
  handler: wrapConvexHandler(async (ctx, { id }) => {
    // Verify notification exists
    const notification = await ctx.db.get(id);
    if (!notification) {
      throw ApiError.notFound("Notification", { notificationId: id });
    }

    // Patch with retry
    await withRetry(
      () =>
        ctx.db.patch(id, {
          read: true,
          readAt: Date.now(),
        }),
      "mark-read",
      RETRY_CONFIGS.FAST
    );

    return { success: true };
  }),
});

/**
 * Mark all notifications as read for an agent
 * Phase 2: Added error handling with graceful degradation
 * Marks notifications as read in parallel with individual error handling
 */
export const markAllRead = mutation({
  args: { agentId: convexVal.id("agents") },
  handler: wrapConvexHandler(async (ctx, { agentId }) => {
    // Verify agent exists
    const agent = await ctx.db.get(agentId);
    if (!agent) {
      throw ApiError.notFound("Agent", { agentId });
    }

    // Fetch unread notifications with retry
    const unread: any[] = await withRetry(
      () =>
        ctx.db
          .query("notifications")
          .withIndex("by_read", (q: any) => q.eq("recipientId", agentId).eq("read", false))
          .take(500),
      "fetch-unread",
      RETRY_CONFIGS.STANDARD
    );

    // Mark all as read in parallel with individual error handling
    const results = await Promise.allSettled(
      unread.map((notif) =>
        withRetry(
          () =>
            ctx.db.patch(notif._id, {
              read: true,
              readAt: Date.now(),
            }),
          `mark-read-${notif._id}`,
          RETRY_CONFIGS.FAST
        )
      )
    );

    // Count successes and failures for observability
    const successes = results.filter((r) => r.status === "fulfilled").length;
    const failures = results.filter((r) => r.status === "rejected").length;

    if (failures > 0) {
      console.warn(
        `[Notifications] markAllRead: ${successes} succeeded, ${failures} failed for agent ${agentId}`
      );
    }

    return {
      marked: successes,
      failed: failures,
      total: (unread as any[]).length,
    };
  }),
});

// Count unread notifications for agent
export const countUnread = query({
  args: { agentId: convexVal.id("agents") },
  handler: async (ctx, { agentId }) => {
    // Use by_read index + take (not collect) to avoid loading all unread into memory
    // Take 101 to detect "100+" threshold without loading potentially large result set
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_read", (q: any) => q.eq("recipientId", agentId).eq("read", false))
      .take(101);

    return unread.length;
  },
});

// Get next actionable notification for agent (with task info)
export const getNextActionable = query({
  args: { agentId: convexVal.id("agents") },
  handler: async (ctx, { agentId }) => {
    // Use by_read index for efficient unread query
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_read", (q: any) => q.eq("recipientId", agentId).eq("read", false))
      .order("desc")
      .take(10);

    // Filter to assignment type notifications with taskIds (minimize point reads)
    const assignmentNotifs = unread.filter(
      (n: any) => n.type === "assignment" && n.taskId
    ) as (typeof unread[0] & { taskId: NonNullable<(typeof unread[0])["taskId"]> })[];

    // Only fetch tasks for actionable notifications
    const enriched = await Promise.all(
      assignmentNotifs.map(async (notif) => {
        const task = await ctx.db.get(notif.taskId);
        return { ...notif, task };
      })
    );

    // Return first one with ready status
    return enriched.find((n: any) => n.task?.status === "ready") || null;
  },
});
