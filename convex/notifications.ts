import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Notification System
 * @Mentions and thread subscriptions
 */

// Create notification
export const create = mutation({
  args: {
    recipientId: v.id("agents"),
    type: v.union(
      v.literal("mention"),
      v.literal("assignment"),
      v.literal("status_change"),
      v.literal("block"),
      v.literal("dependency_unblocked")
    ),
    content: v.string(),
    taskId: v.optional(v.id("tasks")),
    taskTitle: v.optional(v.string()),
    fromId: v.string(),
    fromName: v.string(),
    messageId: v.optional(v.id("messages")),
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
    agentId: v.id("agents"),
    includeRead: v.optional(v.boolean()),
    limit: v.optional(v.number())
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
  args: { id: v.id("notifications") },
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
  args: { agentId: v.id("agents") },
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
  args: { agentId: v.id("agents") },
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
  args: { agentId: v.id("agents") },
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
