import { v } from "convex/values";
import { query, mutation, httpAction } from "./_generated/server";
import { httpRouter } from "convex/server";
import { api } from "./_generated/api";

/**
 * Agent Wake System
 * Allows Mission Control to wake agents via HTTP actions
 */

// Store wake requests for the daemon to process
export const requestWake = mutation({
  args: {
    agentId: v.id("agents"),
    requestedBy: v.string(),
    priority: v.optional(v.union(v.literal("normal"), v.literal("urgent"))),
  },
  handler: async (ctx, { agentId, requestedBy, priority }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) throw new Error("Agent not found");

    // Create wake request (DM-04: add TTL)
    const wakeId = await ctx.db.insert("wakeRequests", {
      agentId,
      agentName: agent.name,
      agentSessionKey: agent.sessionKey,
      requestedBy,
      priority: priority || "normal",
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 day TTL
    });

    // Log activity
    await ctx.db.insert("activities", {
      type: "agent_status_changed",
      agentId: requestedBy,
      agentName: requestedBy,
      message: `Requested wake for ${agent.name} (${priority || "normal"} priority)`,
      createdAt: Date.now(),
    });

    // Update agent status to show wake requested
    await ctx.db.patch(agentId, {
      status: "idle", // Reset to idle so they can be activated
      lastHeartbeat: Date.now(),
    });

    return { wakeId, agentName: agent.name, sessionKey: agent.sessionKey };
  },
});

// Get pending wake requests (for daemon to poll)
export const getPending = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("wakeRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(50);
  },
});

// Mark wake request as processed
export const markProcessed = mutation({
  args: {
    wakeId: v.id("wakeRequests"),
    success: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { wakeId, success, error }) => {
    await ctx.db.patch(wakeId, {
      status: success ? "completed" : "failed",
      processedAt: Date.now(),
      error: error || undefined,
    });
  },
});

// DM-04: Clean up stale wake requests older than TTL
export const cleanupStale = mutation({
  args: {
    olderThanMs: v.optional(v.number()),
  },
  handler: async (ctx, { olderThanMs = 7 * 24 * 60 * 60 * 1000 }) => {
    const cutoff = Date.now() - olderThanMs;
    let deletedCount = 0;

    // Delete completed requests older than TTL
    const stale = await ctx.db
      .query("wakeRequests")
      .filter((doc: any) => doc.status === "completed" && doc.createdAt < cutoff)
      .take(100); // Batch cap per MIG-01 pattern

    for (const req of stale) {
      await ctx.db.delete(req._id);
      deletedCount++;
    }

    // Delete failed requests older than TTL
    const staleFailed = await ctx.db
      .query("wakeRequests")
      .filter((doc: any) => doc.status === "failed" && doc.createdAt < cutoff)
      .take(100);

    for (const req of staleFailed) {
      await ctx.db.delete(req._id);
      deletedCount++;
    }

    return { deleted: deletedCount };
  },
});

// HTTP endpoint for direct wake (if daemon unavailable)
const wakeAgentHttp = httpAction(async (ctx, request) => {
  // Verify authentication via shared secret
  const secret = request.headers.get("X-Wake-Secret");
  const expectedSecret = process.env.WAKE_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { agentId, requestedBy = "system" } = payload;

  const agent = await ctx.runQuery(api.agents.getById, { id: agentId });
  if (!agent) {
    return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404 });
  }

  // Note: sessions_send can't be called from HTTP action directly
  // This creates a wake request for the daemon to process
  const result = await ctx.runMutation(api.wake.requestWake, {
    agentId,
    requestedBy,
    priority: "normal",
  });

  return new Response(JSON.stringify({
    success: true,
    message: `Wake requested for ${result.agentName}`,
    agentId,
    sessionKey: result.sessionKey,
  }), {
    headers: { "Content-Type": "application/json" },
  });
});

const http = httpRouter();
http.route({
  path: "/wake-agent",
  method: "POST",
  handler: wakeAgentHttp,
});

export { http };
