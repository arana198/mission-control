import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ApiError, wrapConvexHandler } from "../lib/errors";

/**
 * Task Comments System (Phase 5A)
 * Threaded discussions on tasks with reactions, mentions, and notifications
 *
 * Phase 1: Error standardization - all mutations now use ApiError with request IDs
 */

/**
 * Get all comments for a task, ordered by creation time
 */
export const getTaskComments = query({
  args: {
    taskId: v.id("tasks"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { taskId, limit = 50 }) => {
    return await ctx.db
      .query("taskComments")
      .withIndex("by_task_created_at", (q: any) => q.eq("taskId", taskId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get replies to a specific comment (thread)
 */
export const getThreadReplies = query({
  args: {
    parentCommentId: v.id("taskComments"),
  },
  handler: async (ctx, { parentCommentId }) => {
    return await ctx.db
      .query("taskComments")
      .withIndex("by_parent", (q: any) => q.eq("parentCommentId", parentCommentId))
      .order("asc")
      .collect();
  },
});

/**
 * Get comment count for a task
 */
export const getCommentCount = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, { taskId }) => {
    const comments = await ctx.db
      .query("taskComments")
      .withIndex("by_task", (q: any) => q.eq("taskId", taskId))
      .collect();
    return comments.length;
  },
});

/**
 * Create a new comment (root or reply)
 */
export const createComment = mutation({
  args: {
    taskId: v.id("tasks"),
    agentId: v.id("agents"),
    agentName: v.string(),
    workspaceId: v.id("workspaces"),
    content: v.string(),
    parentCommentId: v.optional(v.id("taskComments")),
    mentions: v.optional(v.array(v.id("agents"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const commentId = await ctx.db.insert("taskComments", {
      workspaceId: args.workspaceId,
      taskId: args.taskId,
      agentId: args.agentId,
      agentName: args.agentName,
      content: args.content,
      parentCommentId: args.parentCommentId,
      mentions: args.mentions,
      reactions: {},
      createdAt: now,
      updatedAt: now,
    });

    // Create mention notifications for @mentioned agents
    if (args.mentions && args.mentions.length > 0) {
      for (const mentionedId of args.mentions) {
        await ctx.db.insert("mentions", {
          workspaceId: args.workspaceId,
          mentionedAgentId: mentionedId,
          mentionedBy: args.agentId,
          context: "task_comment",
          contextId: args.taskId as any,
          contextTitle: "Task comment",
          read: false,
          createdAt: now,
        });

        // Also create notification
        await ctx.db.insert("notifications", {
          workspaceId: args.workspaceId,
          recipientId: mentionedId,
          type: "mention",
          content: `${args.agentName} mentioned you in a task comment`,
          taskId: args.taskId,
          fromId: args.agentId as any,
          fromName: args.agentName,
          read: false,
          createdAt: now,
        });
      }
    }

    // Notify task subscribers (except commenter)
    const subscribers = await ctx.db
      .query("taskSubscriptions")
      .withIndex("by_task", (q: any) => q.eq("taskId", args.taskId))
      .collect();

    for (const sub of subscribers) {
      if (sub.agentId !== args.agentId) {
        if (sub.notifyOn === "all" || sub.notifyOn === "comments") {
          await ctx.db.insert("notifications", {
            workspaceId: args.workspaceId,
            recipientId: sub.agentId,
            type: "mention",
            content: `${args.agentName} commented on a task you're subscribed to`,
            taskId: args.taskId,
            fromId: args.agentId as any,
            fromName: args.agentName,
            read: false,
            createdAt: now,
          });
        }
      }
    }

    return commentId;
  },
});

/**
 * Add emoji reaction to a comment (toggle on/off)
 */
export const addReaction = mutation({
  args: {
    commentId: v.id("taskComments"),
    emoji: v.string(),
    agentId: v.id("agents"),
  },
  handler: wrapConvexHandler(async (ctx, { commentId, emoji, agentId }) => {
    const comment = await ctx.db.get(commentId);
    if (!comment) throw ApiError.notFound('TaskComment', { commentId });

    const reactions = comment.reactions || {};
    const emojiReactions = reactions[emoji] || [];

    // Toggle: remove if already reacted, add if not
    const alreadyReacted = emojiReactions.some((id: any) => id === agentId);
    if (alreadyReacted) {
      reactions[emoji] = emojiReactions.filter((id: any) => id !== agentId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...emojiReactions, agentId];
    }

    await ctx.db.patch(commentId, {
      reactions,
      updatedAt: Date.now(),
    });

    return reactions;
  }),
});

/**
 * Delete a comment (soft delete - keep for history)
 */
export const deleteComment = mutation({
  args: {
    commentId: v.id("taskComments"),
  },
  handler: wrapConvexHandler(async (ctx, { commentId }) => {
    const comment = await ctx.db.get(commentId);
    if (!comment) throw ApiError.notFound('TaskComment', { commentId });

    // Replace content with deletion marker
    await ctx.db.patch(commentId, {
      content: "[deleted]",
      updatedAt: Date.now(),
    });

    return commentId;
  }),
});

/**
 * Edit a comment
 */
export const editComment = mutation({
  args: {
    commentId: v.id("taskComments"),
    content: v.string(),
    mentions: v.optional(v.array(v.id("agents"))),
  },
  handler: wrapConvexHandler(async (ctx, { commentId, content, mentions }) => {
    const comment = await ctx.db.get(commentId);
    if (!comment) throw ApiError.notFound('TaskComment', { commentId });

    const now = Date.now();

    await ctx.db.patch(commentId, {
      content,
      mentions,
      updatedAt: now,
    });

    return commentId;
  }),
});

/**
 * Subscribe agent to task notifications
 */
export const subscribeToTask = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    taskId: v.id("tasks"),
    agentId: v.id("agents"),
    notifyOn: v.optional(
      v.union(
        v.literal("all"),
        v.literal("comments"),
        v.literal("status"),
        v.literal("mentions")
      )
    ),
  },
  handler: async (
    ctx,
    { workspaceId, taskId, agentId, notifyOn = "all" }
  ) => {
    // Check if already subscribed
    const existing = await ctx.db
      .query("taskSubscriptions")
      .withIndex("by_agent_task", (q: any) =>
        q.eq("agentId", agentId).eq("taskId", taskId)
      )
      .first();

    if (existing) {
      // Update notification type
      await ctx.db.patch(existing._id, {
        notifyOn,
      });
      return existing._id;
    }

    return await ctx.db.insert("taskSubscriptions", {
      workspaceId,
      taskId,
      agentId,
      notifyOn,
      subscribedAt: Date.now(),
    });
  },
});

/**
 * Unsubscribe agent from task
 */
export const unsubscribeFromTask = mutation({
  args: {
    taskId: v.id("tasks"),
    agentId: v.id("agents"),
  },
  handler: async (ctx, { taskId, agentId }) => {
    const subscription = await ctx.db
      .query("taskSubscriptions")
      .withIndex("by_agent_task", (q: any) =>
        q.eq("agentId", agentId).eq("taskId", taskId)
      )
      .first();

    if (subscription) {
      await ctx.db.delete(subscription._id);
      return true;
    }
    return false;
  },
});

/**
 * Get task subscribers
 */
export const getTaskSubscribers = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, { taskId }) => {
    return await ctx.db
      .query("taskSubscriptions")
      .withIndex("by_task", (q: any) => q.eq("taskId", taskId))
      .collect();
  },
});

/**
 * Mark mentions as read
 */
export const markMentionAsRead = mutation({
  args: {
    mentionId: v.id("mentions"),
  },
  handler: wrapConvexHandler(async (ctx, { mentionId }) => {
    const mention = await ctx.db.get(mentionId);
    if (!mention) throw ApiError.notFound('Mention', { mentionId });

    await ctx.db.patch(mentionId, {
      read: true,
      readAt: Date.now(),
    });

    return mentionId;
  }),
});

/**
 * Get unread mentions for an agent
 */
export const getUnreadMentions = query({
  args: {
    agentId: v.id("agents"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { agentId, workspaceId }) => {
    return await ctx.db
      .query("mentions")
      .withIndex("by_read", (q: any) =>
        q.eq("mentionedAgentId", agentId).eq("read", false)
      )
      .collect();
  },
});
