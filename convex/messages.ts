import { v as convexVal } from "convex/values";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import type { MessageSenderId } from "./types";
import { Id } from "./_generated/dataModel";
import { ApiError, wrapConvexHandler } from "../lib/errors";

/**
 * Message / Comment System
 * Threaded discussions with @mentions
 *
 * Phase 1: Error standardization - all mutations now use ApiError with request IDs
 *
 * PHASE 6: Race Condition Safety
 * ─────────────────────────────────────────────────────────────────────────────
 * The pattern of appending to replyIds (lines 42-43) is SAFE despite appearing
 * to have a race condition. Convex mutations are serialized at the transaction
 * level on a per-document basis. This means:
 *
 * 1. Multiple mutations modifying the same document cannot run concurrently
 * 2. Reads and writes within a single mutation are atomic
 * 3. No explicit locking or CAS (compare-and-swap) needed
 *
 * Example: Two concurrent messages replying to parent MSG_123
 * ─────────────────────────────────────────────────────────────────────────────
 * Mutation 1 (reply_1): read replyIds=[A,B] → patch [A,B,reply_1]
 * Mutation 2 (reply_2): BLOCKED until Mutation 1 commits
 * Mutation 2 (reply_2): read replyIds=[A,B,reply_1] → patch [A,B,reply_1,reply_2]
 *
 * The SECOND mutation reads the UPDATED state from the first, ensuring no lost
 * updates. This is Convex's core guarantee: no two mutations touch the same
 * document concurrently.
 */

// Create message with optional @mentions and thread subscriptions
export const create = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    content: convexVal.string(),
    senderId: convexVal.string(),
    senderName: convexVal.string(),
    mentions: convexVal.optional(convexVal.array(convexVal.id("agents"))),
    mentionAll: convexVal.optional(convexVal.boolean()), // @all support
    parentId: convexVal.optional(convexVal.id("messages")), // MSG-01: Reply to thread
  },
  handler: wrapConvexHandler(async (ctx, { taskId, content, senderId, senderName, mentions, mentionAll, parentId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw ApiError.notFound("Task", { taskId });

    // Insert message (scoped to task's business)
    const messageId = await ctx.db.insert("messages", {
      businessId: task.businessId,
      taskId,
      fromId: senderId, // Can be agent ID or "user"
      fromName: senderName,
      content,
      mentions: mentions || [],
      replyIds: [],
      parentId,
      createdAt: Date.now(),
    });

    // MSG-01: If replying to a message, update parent's replyIds
    if (parentId) {
      const parentMsg = await ctx.db.get(parentId);
      if (parentMsg) {
        const updatedReplyIds = [...(parentMsg.replyIds || []), messageId];
        await ctx.db.patch(parentId, { replyIds: updatedReplyIds });
      }
    }

    // Log activity
    await ctx.db.insert("activities", {
      businessId: task.businessId,
      type: "comment_added",
      agentId: senderId,
      agentName: senderName,
      message: `${senderName} commented on "${task.title}"`,
      taskId,
      taskTitle: task.title,
      createdAt: Date.now(),
    });

    // Auto-subscribe sender to thread (only if sender is an agent, not "user")
    if (senderId !== "user") {
      const agent = await ctx.db.get(senderId as Id<"agents">);
      if (agent) {
        const existingSub = await ctx.db
          .query("threadSubscriptions")
          .withIndex("by_agent_task", (q: any) => q.eq("agentId", senderId as Id<"agents">).eq("taskId", taskId))
          .first();

        if (!existingSub) {
          await ctx.db.insert("threadSubscriptions", {
            businessId: task.businessId,
            agentId: senderId as Id<"agents">,
            taskId,
            level: "all",
            createdAt: Date.now(),
          });
        }
      }
    }

    // Handle @all mention (notify all agents except sender)
    if (mentionAll) {
      const allAgents = await ctx.db.query("agents").collect();
      for (const agent of allAgents) {
        // Don't notify the sender
        if (agent._id === senderId || agent.name === senderName) continue;
        
        await ctx.db.insert("notifications", {
          recipientId: agent._id,
          type: "mention",
          content: `📢 @all: ${senderName} posted in "${task.title}": ${content.substring(0, 100)}${content.length > 100 ? "..." : ""}`,
          taskId,
          taskTitle: task.title,
          fromId: senderId,
          fromName: senderName,
          messageId,
          read: false,
          createdAt: Date.now(),
        });

        // Auto-subscribe mentioned agents to thread
        const agentSub = await ctx.db
          .query("threadSubscriptions")
          .withIndex("by_agent_task", (q: any) => q.eq("agentId", agent._id).eq("taskId", taskId))
          .first();
        
        if (!agentSub) {
          await ctx.db.insert("threadSubscriptions", {
            businessId: task.businessId,
            agentId: agent._id,
            taskId,
            level: "all",
            createdAt: Date.now(),
          });
        }
      }
      
      // Log @all mention
      await ctx.db.insert("activities", {
        businessId: task.businessId,
        type: "mention",
        agentId: senderId,
        agentName: senderName,
        message: `${senderName} mentioned @all in task`,
        taskId,
        taskTitle: task.title,
        createdAt: Date.now(),
      });
    }

    // Create notifications for @mentions
    if (mentions && mentions.length > 0) {
      for (const mentionedAgentId of mentions) {
        await ctx.db.insert("notifications", {
          recipientId: mentionedAgentId,
          type: "mention",
          content: `@${senderName} mentioned you in "${task.title}": ${content.substring(0, 100)}${content.length > 100 ? "..." : ""}`,
          taskId,
          taskTitle: task.title,
          fromId: senderId,
          fromName: senderName,
          messageId,
          read: false,
          createdAt: Date.now(),
        });

        // Auto-subscribe mentioned agents to thread
        const agentSub = await ctx.db
          .query("threadSubscriptions")
          .withIndex("by_agent_task", (q: any) => q.eq("agentId", mentionedAgentId).eq("taskId", taskId))
          .first();
        
        if (!agentSub) {
          await ctx.db.insert("threadSubscriptions", {
            businessId: task.businessId,
            agentId: mentionedAgentId,
            taskId,
            level: "all",
            createdAt: Date.now(),
          });
        }

        // Also log as mention activity
        await ctx.db.insert("activities", {
          businessId: task.businessId,
          type: "mention",
          agentId: senderId,
          agentName: senderName,
          message: `${senderName} mentioned agent in task`,
          taskId,
          taskTitle: task.title,
          createdAt: Date.now(),
        });
      }
    }

    // Notify thread subscribers (except sender and direct mentions)
    const subscribers = await ctx.db
      .query("threadSubscriptions")
      .withIndex("by_task", (q: any) => q.eq("taskId", taskId))
      .collect();

    const notifiedIds = new Set<string>([
      senderId,
      ...(mentions || []).map((id: any) => id as string),
    ]);

    for (const sub of subscribers) {
      if (notifiedIds.has(sub.agentId)) continue;
      
      await ctx.db.insert("notifications", {
        recipientId: sub.agentId,
        type: "status_change",
        content: `💬 New comment on "${task.title}" by ${senderName}`,
        taskId,
        taskTitle: task.title,
        fromId: senderId,
        fromName: senderName,
        messageId,
        read: false,
        createdAt: Date.now(),
      });
      
      notifiedIds.add(sub.agentId);
    }

    // REP-01: Track comments by agents
    if (senderId !== "user") {
      await ctx.runMutation(api.agentMetrics.upsertMetrics, {
        agentId: senderId as Id<"agents">,
        commentsMade: 1,
      });
    }

    return messageId;
  }),
});

// Get messages for a task
export const getByTask = query({
  args: { taskId: convexVal.id("tasks"), limit: convexVal.optional(convexVal.number()) },
  handler: async (ctx, { taskId, limit }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_task", (q: any) => q.eq("taskId", taskId))
      .order("desc")
      .take(limit || 50);

    // Enrich with sender info
    const enriched = messages.map((msg) => ({
      ...msg,
      senderName: msg.fromName || (msg.fromId === "user" ? "You" : "Agent"),
    }));

    return enriched.reverse(); // Chronological order
  },
});

// Get messages where agent was mentioned
export const getWithMentions = query({
  args: { agentId: convexVal.id("agents"), limit: convexVal.optional(convexVal.number()) },
  handler: async (ctx, { agentId, limit }) => {
    const allMessages = await ctx.db.query("messages").take(200);
    const mentioned = allMessages.filter((msg) => msg.mentions.includes(agentId));

    const enriched = mentioned.slice(0, limit || 20).map((msg) => ({
      ...msg,
      taskTitle: msg.taskId,
    }));

    return enriched;
  },
});

// MSG-01: Get a message thread (parent + replies)
export const getThread = query({
  args: { parentId: convexVal.id("messages") },
  handler: async (ctx, { parentId }) => {
    const parent = await ctx.db.get(parentId);
    if (!parent) return null;

    // Fetch all replies
    const replies = parent.replyIds
      ? await Promise.all(parent.replyIds.map((id: Id<"messages">) => ctx.db.get(id)))
      : [];

    return {
      parent,
      replies: replies.filter(Boolean), // Filter out deleted replies
    };
  },
});

// Delete message (only sender can delete)
export const remove = mutation({
  args: {
    messageId: convexVal.id("messages"),
    senderId: convexVal.string(), // Must match original sender
  },
  handler: wrapConvexHandler(async (ctx, { messageId, senderId }) => {
    const message = await ctx.db.get(messageId);
    if (!message) throw ApiError.notFound("Message", { messageId });

    // Verify sender owns this message
    if (message.fromId !== senderId) {
      throw ApiError.forbidden("Only the message author can delete it", { messageId, requestSenderId: senderId, actualSenderId: message.fromId });
    }

    // Get task for activity log
    const task = await ctx.db.get(message.taskId);
    const taskTitle = task?.title || "Unknown";

    // Delete the message
    await ctx.db.delete(messageId);

    // Log activity
    await ctx.db.insert("activities", {
      businessId: message.businessId,
      type: "comment_added",
      agentId: senderId,
      agentName: message.fromName,
      message: `${message.fromName} deleted a comment from "${taskTitle}"`,
      taskId: message.taskId,
      taskTitle: taskTitle,
      createdAt: Date.now(),
    });

    return { success: true };
  }),
});

/**
 * ============================================
 * Phase 1: Help Request System
 * ============================================
 */

export const createHelpRequest = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    fromId: convexVal.string(),
    fromName: convexVal.string(),
    reason: convexVal.string(), // "Blocked on dependency", "Need design input", etc.
    context: convexVal.optional(convexVal.string()), // Additional context/details
    leadAgentId: convexVal.optional(convexVal.id("agents")), // Escalate to lead agent
  },
  handler: wrapConvexHandler(async (
    ctx,
    { taskId, fromId, fromName, reason, context, leadAgentId }
  ) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw ApiError.notFound("Task", { taskId });

    // Build help request message content
    const content = context
      ? `${reason}: ${context}`
      : reason;

    // Create system message for help request
    const mentions = leadAgentId ? [leadAgentId] : [];
    const messageId = await ctx.db.insert("messages", {
      businessId: task.businessId,
      taskId,
      fromId,
      fromName,
      content,
      isSystem: true,
      systemType: "help_request",
      mentions,
      replyIds: [],
      attachments: [],
      createdAt: Date.now(),
    });

    // Create notification for lead agent if specified
    if (leadAgentId) {
      await ctx.db.insert("notifications", {
        recipientId: leadAgentId,
        type: "help_request",
        content: `${fromName} needs help on task: "${task.title}" - ${reason}`,
        fromId,
        fromName,
        taskId,
        messageId,
        read: false,
        createdAt: Date.now(),
      });
    }

    // Log activity
    await ctx.db.insert("activities", {
      businessId: task.businessId,
      type: "comment_added", // Use comment_added for help request activity
      agentId: fromId,
      agentName: fromName,
      message: `${fromName} requested help: ${reason}`,
      taskId,
      taskTitle: task.title,
      createdAt: Date.now(),
    });

    return {
      success: true,
      messageId,
      notification: leadAgentId ? { recipientId: leadAgentId } : null,
    };
  }),
});
