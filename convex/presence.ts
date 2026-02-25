import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Presence System (Phase 5A)
 * Real-time agent status and activity tracking
 */

/**
 * Update agent presence status
 */
export const updatePresence = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    status: v.union(
      v.literal("online"),
      v.literal("away"),
      v.literal("do_not_disturb"),
      v.literal("offline")
    ),
    currentActivity: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if presence indicator exists
    const existing = await ctx.db
      .query("presenceIndicators")
      .withIndex("by_agent", (q: any) => q.eq("agentId", args.agentId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        currentActivity: args.currentActivity,
        lastActivity: now,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("presenceIndicators", {
        workspaceId: args.workspaceId,
        agentId: args.agentId,
        status: args.status,
        currentActivity: args.currentActivity,
        lastActivity: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Get all presence indicators for a workspace
 */
export const getPresence = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    return await ctx.db
      .query("presenceIndicators")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
      .collect();
  },
});

/**
 * Get presence for a specific agent
 */
export const getAgentPresence = query({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, { agentId }) => {
    return await ctx.db
      .query("presenceIndicators")
      .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
      .first();
  },
});

/**
 * Get online agents for a workspace
 */
export const getOnlineAgents = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const all = await ctx.db
      .query("presenceIndicators")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
      .collect();

    return all.filter((p: any) => p.status === "online");
  },
});

/**
 * Mark agent as away if no activity for 5+ minutes
 */
export const checkAndMarkAway = mutation({
  args: {
    agentId: v.id("agents"),
    workspaceId: v.id("workspaces"),
    awayThresholdMs: v.optional(v.number()),
  },
  handler: async (ctx, { agentId, workspaceId, awayThresholdMs = 5 * 60 * 1000 }) => {
    const presence = await ctx.db
      .query("presenceIndicators")
      .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
      .first();

    if (!presence) {
      return null;
    }

    const now = Date.now();
    const timeSinceActivity = now - presence.lastActivity;

    if (
      timeSinceActivity > awayThresholdMs &&
      presence.status !== "offline" &&
      presence.status !== "away"
    ) {
      await ctx.db.patch(presence._id, {
        status: "away",
        updatedAt: now,
      });

      return presence._id;
    }

    return null;
  },
});

/**
 * Mark all agents as offline if no activity for 30+ minutes
 */
export const cleanupStalePresence = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    staleThresholdMs: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, staleThresholdMs = 30 * 60 * 1000 }) => {
    const all = await ctx.db
      .query("presenceIndicators")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
      .collect();

    const now = Date.now();
    let updated = 0;

    for (const presence of all) {
      const timeSinceActivity = now - presence.lastActivity;

      if (timeSinceActivity > staleThresholdMs && presence.status !== "offline") {
        await ctx.db.patch(presence._id, {
          status: "offline",
          updatedAt: now,
        });
        updated++;
      }
    }

    return { cleaned: updated };
  },
});

/**
 * Update agent activity without changing status
 */
export const recordActivity = mutation({
  args: {
    agentId: v.id("agents"),
    workspaceId: v.id("workspaces"),
    activity: v.string(),
  },
  handler: async (ctx, { agentId, workspaceId, activity }) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("presenceIndicators")
      .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        currentActivity: activity,
        lastActivity: now,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new presence record if doesn't exist
      return await ctx.db.insert("presenceIndicators", {
        workspaceId,
        agentId,
        status: "online",
        currentActivity: activity,
        lastActivity: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Get agent presence with full agent details
 */
export const getAgentPresenceWithDetails = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const presence = await ctx.db
      .query("presenceIndicators")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
      .collect();

    const agentIds = presence.map((p: any) => p.agentId);
    const agents = await Promise.all(
      agentIds.map((id) => ctx.db.get(id))
    );

    return presence.map((p, idx) => ({
      ...p,
      agent: agents[idx],
    })).filter((item) => item.agent !== null);
  },
});
