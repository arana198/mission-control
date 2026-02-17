import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Activity Feed
 * Real-time stream of all system events
 */

// Get recent activities (for the feed)
export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit || 50);

    return activities;
  },
});

// Get activities filtered by agent
export const getByAgent = query({
  args: { agentId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { agentId, limit }) => {
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .order("desc")
      .take(limit || 30);

    return activities;
  },
});

// Get activities by type
export const getByType = query({
  args: {
    type: v.union(
      v.literal("task_created"),
      v.literal("task_updated"),
      v.literal("task_completed"),
      v.literal("task_assigned"),
      v.literal("task_blocked"),
      v.literal("comment_added"),
      v.literal("mention"),
      v.literal("epic_created"),
      v.literal("epic_completed"),
      v.literal("agent_claimed"),
      v.literal("agent_status_changed"),
      v.literal("dependency_added"),
      v.literal("dependency_removed")
    ),
    limit: v.optional(v.number())
  },
  handler: async (ctx, { type, limit }) => {
    return await ctx.db
      .query("activities")
      .withIndex("by_type", (q) => q.eq("type", type))
      .order("desc")
      .take(limit || 30);
  },
});

// Create activity entry
export const create = mutation({
  args: {
    type: v.union(
      v.literal("task_created"),
      v.literal("task_updated"),
      v.literal("task_completed"),
      v.literal("task_assigned"),
      v.literal("task_blocked"),
      v.literal("comment_added"),
      v.literal("mention"),
      v.literal("epic_created"),
      v.literal("epic_completed"),
      v.literal("agent_claimed"),
      v.literal("agent_status_changed"),
      v.literal("dependency_added"),
      v.literal("dependency_removed")
    ),
    agentId: v.string(),
    agentName: v.string(),
    message: v.string(),
    agentRole: v.optional(v.string()),
    taskId: v.optional(v.id("tasks")),
    taskTitle: v.optional(v.string()),
    epicId: v.optional(v.id("epics")),
    epicTitle: v.optional(v.string()),
    oldValue: v.optional(v.any()),
    newValue: v.optional(v.any()),
  },
  handler: async (ctx, { type, agentId, agentName, message, agentRole, taskId, taskTitle, epicId, epicTitle, oldValue, newValue }) => {
    return await ctx.db.insert("activities", {
      type,
      agentId,
      agentName,
      message,
      agentRole,
      taskId,
      taskTitle,
      epicId,
      epicTitle,
      oldValue,
      newValue,
      createdAt: Date.now(),
    });
  },
});

// Get activity feed with real-time subscription
export const getFeed = query({
  args: {
    since: v.optional(v.number()),
    limit: v.optional(v.number())
  },
  handler: async (ctx, { since, limit }) => {
    let q = ctx.db.query("activities").withIndex("by_created_at").order("desc");

    if (since) {
      // Filter activities since timestamp
      q = q.filter((q) => q.gt(q.field("createdAt"), since));
    }

    const activities = await q.take(limit || 100);

    return activities;
  },
});
