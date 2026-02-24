import { v as convexVal } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Notification System
 * @Mentions and thread subscriptions
 */

// Create notification
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
  handler: async (ctx, { recipientId, type, content, taskId, taskTitle, fromId, fromName, messageId }) => {
    return await ctx.db.insert("notifications", {
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
    });
  },
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

// Mark notification as read
export const markRead = mutation({
  args: { id: convexVal.id("notifications") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, {
      read: true,
      readAt: Date.now(),
    });
    return { success: true };
  },
});

// Mark all notifications as read for an agent
export const markAllRead = mutation({
  args: { agentId: convexVal.id("agents") },
  handler: async (ctx, { agentId }) => {
    // Use by_read index for efficient querying
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_read", (q: any) => q.eq("recipientId", agentId).eq("read", false))
      .take(500); // Reasonable cap for batch marking

    // Mark all as read in parallel to avoid sequential patch timeout
    await Promise.all(
      unread.map((notif) =>
        ctx.db.patch(notif._id, {
          read: true,
          readAt: Date.now(),
        })
      )
    );

    return { marked: unread.length };
  },
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
