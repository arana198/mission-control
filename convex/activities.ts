import { v as convexVal } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Activity Feed
 * Real-time stream of all system events
 */

// Get recent activities (for the feed)
export const getRecent = query({
  args: { limit: convexVal.optional(convexVal.number()) },
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
  args: { agentId: convexVal.string(), limit: convexVal.optional(convexVal.number()) },
  handler: async (ctx, { agentId, limit }) => {
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_agent", (indexQuery) => indexQuery.eq("agentId", agentId))
      .order("desc")
      .take(limit || 30);

    return activities;
  },
});

// Get activities by type
export const getByType = query({
  args: {
    type: convexVal.union(
      convexVal.literal("task_created"),
      convexVal.literal("task_updated"),
      convexVal.literal("task_completed"),
      convexVal.literal("task_assigned"),
      convexVal.literal("task_blocked"),
      convexVal.literal("comment_added"),
      convexVal.literal("mention"),
      convexVal.literal("epic_created"),
      convexVal.literal("epic_completed"),
      convexVal.literal("agent_claimed"),
      convexVal.literal("agent_status_changed"),
      convexVal.literal("dependency_added"),
      convexVal.literal("dependency_removed"),
      convexVal.literal("tags_updated"),
      convexVal.literal("tasks_queried")
    ),
    limit: convexVal.optional(convexVal.number())
  },
  handler: async (ctx, { type, limit }) => {
    return await ctx.db
      .query("activities")
      .withIndex("by_type", (indexQuery) => indexQuery.eq("type", type))
      .order("desc")
      .take(limit || 30);
  },
});

// Create activity entry
export const create = mutation({
  args: {
    type: convexVal.union(
      convexVal.literal("task_created"),
      convexVal.literal("task_updated"),
      convexVal.literal("task_completed"),
      convexVal.literal("task_assigned"),
      convexVal.literal("task_blocked"),
      convexVal.literal("comment_added"),
      convexVal.literal("mention"),
      convexVal.literal("epic_created"),
      convexVal.literal("epic_completed"),
      convexVal.literal("agent_claimed"),
      convexVal.literal("agent_status_changed"),
      convexVal.literal("dependency_added"),
      convexVal.literal("dependency_removed"),
      convexVal.literal("tags_updated"),
      convexVal.literal("tasks_queried")
    ),
    agentId: convexVal.string(),
    agentName: convexVal.string(),
    message: convexVal.string(),
    agentRole: convexVal.optional(convexVal.string()),
    taskId: convexVal.optional(convexVal.id("tasks")),
    taskTitle: convexVal.optional(convexVal.string()),
    epicId: convexVal.optional(convexVal.id("epics")),
    epicTitle: convexVal.optional(convexVal.string()),
    oldValue: convexVal.optional(convexVal.any()),
    newValue: convexVal.optional(convexVal.any()),
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
    since: convexVal.optional(convexVal.number()),
    limit: convexVal.optional(convexVal.number())
  },
  handler: async (ctx, { since, limit }) => {
    let activitiesQuery = ctx.db.query("activities").withIndex("by_created_at").order("desc");

    if (since) {
      // Filter activities since timestamp
      activitiesQuery = activitiesQuery.filter((filterQuery) => filterQuery.gt(filterQuery.field("createdAt"), since));
    }

    const activities = await activitiesQuery.take(limit || 100);

    return activities;
  },
});
