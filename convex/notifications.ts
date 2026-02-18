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
      .filter((q) => q.eq(q.field("read"), false))
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
        .withIndex("by_recipient", (q) => q.eq("recipientId", agentId))
        .order("desc")
        .take(limit || 50);
    } else {
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_recipient", (q) => q.eq("recipientId", agentId))
        .filter((q) => q.eq(q.field("read"), false))
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
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", agentId))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();

    for (const notif of unread) {
      await ctx.db.patch(notif._id, {
        read: true,
        readAt: Date.now(),
      });
    }

    return { marked: unread.length };
  },
});

// Count unread notifications for agent
export const countUnread = query({
  args: { agentId: convexVal.id("agents") },
  handler: async (ctx, { agentId }) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", agentId))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();

    return unread.length;
  },
});

// Get next actionable notification for agent (with task info)
export const getNextActionable = query({
  args: { agentId: convexVal.id("agents") },
  handler: async (ctx, { agentId }) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", agentId))
      .filter((q) => q.eq(q.field("read"), false))
      .order("desc")
      .take(10);

    // Get task details for each notification
    const enriched = await Promise.all(
      unread.map(async (notif) => {
        if (notif.taskId) {
          const task = await ctx.db.get(notif.taskId);
          return { ...notif, task };
        }
        return { ...notif, task: null };
      })
    );

    // Return first actionable one (assignment notification with task in ready status)
    return enriched.find((n) => n.type === "assignment" && n.task?.status === "ready") || null;
  },
});
