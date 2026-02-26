import { v as convexVal } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Activity Feed
 * Real-time stream of all system events
 */

// Get recent activities (for the feed)
// PERF: Phase 5C - Use index-based filtering instead of JS filtering when workspaceId provided
export const getRecent = query({
  args: {
    limit: convexVal.optional(convexVal.number()),
    workspaceId: convexVal.optional(convexVal.id("workspaces")),  // Optional: filter by business
  },
  handler: async (ctx, { limit, workspaceId }) => {
    const pageLimit = limit || 50;

    if (workspaceId) {
      // Use by_workspace_created_at index when workspaceId provided (no JS filtering needed)
      return await ctx.db
        .query("activities")
        .withIndex("by_workspace_created_at", (q: any) => q.eq("workspaceId", workspaceId))
        .order("desc")
        .take(pageLimit);
    }

    // Fallback to by_created_at index when no workspaceId filter
    return await ctx.db
      .query("activities")
      .withIndex("by_created_at")
      .order("desc")
      .take(pageLimit);
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
    limit: convexVal.optional(convexVal.number()),
    workspaceId: convexVal.optional(convexVal.id("workspaces")),  // Optional: filter by business
  },
  handler: async (ctx, { type, limit, workspaceId }) => {
    let activities = await ctx.db
      .query("activities")
      .withIndex("by_type", (indexQuery) => indexQuery.eq("type", type))
      .order("desc")
      .take((limit || 30) * 2);  // Load extra to account for filtering

    // Filter by workspace if provided
    if (workspaceId) {
      activities = activities.filter((a: any) => a.workspaceId === workspaceId);
    }

    return activities.slice(0, limit || 30);
  },
});

// Create activity entry
export const create = mutation({
  args: {
    workspaceId: convexVal.id("workspaces"),  // REQUIRED: workspace scoping
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
    ticketNumber: convexVal.optional(convexVal.string()),
    epicId: convexVal.optional(convexVal.id("epics")),
    epicTitle: convexVal.optional(convexVal.string()),
    oldValue: convexVal.optional(convexVal.any()),
    newValue: convexVal.optional(convexVal.any()),
  },
  handler: async (ctx, { workspaceId, type, agentId, agentName, message, agentRole, taskId, taskTitle, ticketNumber, epicId, epicTitle, oldValue, newValue }) => {
    return await ctx.db.insert("activities", {
      workspaceId,  // ADD: workspace scoping
      type,
      agentId,
      agentName,
      message,
      agentRole,
      taskId,
      taskTitle,
      ticketNumber,
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
    limit: convexVal.optional(convexVal.number()),
    workspaceId: convexVal.optional(convexVal.id("workspaces")),  // Optional: filter by business
  },
  handler: async (ctx, { since, limit, workspaceId }) => {
    let activitiesQuery = ctx.db.query("activities").withIndex("by_created_at").order("desc");

    if (since) {
      // Filter activities since timestamp
      activitiesQuery = activitiesQuery.filter((filterQuery) => filterQuery.gt(filterQuery.field("createdAt"), since));
    }

    let activities = await activitiesQuery.take((limit || 100) * 2);  // Load extra to account for filtering

    // Filter by workspace if provided
    if (workspaceId) {
      activities = activities.filter((a: any) => a.workspaceId === workspaceId);
    }

    return activities.slice(0, limit || 100);
  },
});
