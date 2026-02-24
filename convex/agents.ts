import { v as convexVal } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ApiError, wrapConvexHandler } from "../lib/errors";
import { checkRateLimitSilent } from "./utils/rateLimit";

/**
 * Agent Management
 * CRUD operations for the 10-agent squad
 *
 * Phase 1: Error standardization - all mutations now use ApiError with request IDs
 */

// Get all agents with their current status
export const getAllAgents = query({
  handler: async (ctx) => {
    // Limit to 200 agents to prevent OOM on full table scan
    const agents = await ctx.db.query("agents").take(200);
    return agents;
  },
});

// Get single agent by ID
export const getAgentById = query({
  args: { agentId: convexVal.id("agents") },
  handler: async (ctx, { agentId }) => {
    return await ctx.db.get(agentId);
  },
});

// Get agent by name (case-insensitive)
export const getByName = query({
  args: { name: convexVal.string() },
  handler: async (ctx, { name }) => {
    // Try lowercase first (agents query with lowercase names)
    const lowerName = name.toLowerCase();
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_name", (q: any) => q.eq("name", lowerName))
      .first();
    if (agent) return agent;
    
    // Fallback: try exact match (for legacy capitalized names)
    return await ctx.db
      .query("agents")
      .withIndex("by_name", (q: any) => q.eq("name", name))
      .first();
  },
});

// Update agent status
export const updateStatus = mutation({
  args: {
    businessId: convexVal.id("businesses"),
    agentId: convexVal.id("agents"),
    status: convexVal.union(convexVal.literal("idle"), convexVal.literal("active"), convexVal.literal("blocked")),
    currentTaskId: convexVal.optional(convexVal.id("tasks")),
  },
  handler: wrapConvexHandler(async (ctx, { businessId, agentId, status, currentTaskId }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) throw ApiError.notFound("Agent", { agentId });

    await ctx.db.patch(agentId, {
      status,
      currentTaskId,
      lastHeartbeat: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      businessId,
      type: "agent_status_changed",
      agentId,
      agentName: agent.name,
      message: `${agent.name} is now ${status}`,
      taskId: currentTaskId,
      createdAt: Date.now(),
    });

    return { success: true, agentId, status };
  }),
});

// Heartbeat ping from agent
// PERF: Phase 5C - Silent rate limit: 6 heartbeats per minute per agent (no error if exceeded)
export const heartbeat = mutation({
  args: {
    agentId: convexVal.id("agents"),
    currentTaskId: convexVal.optional(convexVal.id("tasks")),
  },
  handler: wrapConvexHandler(async (ctx, { agentId, currentTaskId }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) throw ApiError.notFound("Agent", { agentId });

    // Silent rate limit check: if exceeded, return early without error
    const allowed = await checkRateLimitSilent(
      ctx,
      `ratelimit:heartbeat:${agentId}`,
      6,
      60000
    );

    if (!allowed) {
      // Rate limit exceeded, return silently (no-op)
      return { success: false, rateLimited: true, timestamp: Date.now() };
    }

    await ctx.db.patch(agentId, {
      lastHeartbeat: Date.now(),
      currentTaskId,
    });

    return { success: true, timestamp: Date.now() };
  }),
});

// Get agent with current task details
export const getWithCurrentTask = query({
  args: { agentId: convexVal.id("agents") },
  handler: async (ctx, { agentId }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) return null;

    let currentTask = null;
    if (agent.currentTaskId) {
      currentTask = await ctx.db.get(agent.currentTaskId);
    }

    return { ...agent, currentTask };
  },
});

// Update agent name (for lowercase migration)
export const updateName = mutation({
  args: {
    id: convexVal.id("agents"),
    name: convexVal.string(),
  },
  handler: async (ctx, { id, name }) => {
    await ctx.db.patch(id, { name });
    return { success: true, id, name };
  },
});

// Lowercase all agent names (one-time migration)
export const lowercaseAllNames = mutation({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    let updated = 0;
    for (const agent of agents) {
      const lowerName = agent.name.toLowerCase();
      if (agent.name !== lowerName) {
        await ctx.db.patch(agent._id, { name: lowerName });
        updated++;
      }
    }
    return { updated, total: agents.length };
  },
});

/**
 * Agent self-registration via HTTP API
 * Creates a new agent or returns existing agent with API key
 */
export const register = mutation({
  args: {
    name: convexVal.string(),
    role: convexVal.string(),
    level: convexVal.union(convexVal.literal("lead"), convexVal.literal("specialist"), convexVal.literal("intern")),
    sessionKey: convexVal.string(),
    capabilities: convexVal.optional(convexVal.array(convexVal.string())),
    model: convexVal.optional(convexVal.string()),
    personality: convexVal.optional(convexVal.string()),
    workspacePath: convexVal.string(),  // Agent's workspace directory (required)
    generatedApiKey: convexVal.string(),  // Generated by route layer
  },
  handler: wrapConvexHandler(async (ctx, args) => {
    // Lowercase name for consistent lookups
    const lowerName = args.name.toLowerCase();

    // Check if agent already exists
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_name", (q: any) => q.eq("name", lowerName))
      .first();

    if (existing) {
      // Agent exists — return existing (or assign key/workspace path if missing)
      let apiKey = existing.apiKey;
      const updates: any = {};

      if (!apiKey) {
        // Legacy agent without key — assign new one
        apiKey = args.generatedApiKey;
        updates.apiKey = apiKey;
      }

      if (!existing.workspacePath && args.workspacePath) {
        // Update workspace path for legacy agents
        updates.workspacePath = args.workspacePath;
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }

      return { agentId: existing._id, apiKey, isNew: false };
    }

    // New agent — create with apiKey
    const agentId = await ctx.db.insert("agents", {
      name: lowerName,
      role: args.role,
      level: args.level,
      status: "idle",
      sessionKey: args.sessionKey,
      lastHeartbeat: Date.now(),
      apiKey: args.generatedApiKey,
      capabilities: args.capabilities,
      model: args.model,
      personality: args.personality,
      workspacePath: args.workspacePath,
    });

    // Note: Agent registration is a global event, not business-specific, so we don't log activity
    // Activities are always scoped to a business, but agent registration spans all businesses

    return { agentId, apiKey: args.generatedApiKey, isNew: true };
  }),
});

/**
 * Verify agent credentials (used by all agent API routes)
 */
export const verifyKey = query({
  args: {
    agentId: convexVal.id("agents"),
    apiKey: convexVal.string(),
  },
  handler: async (ctx, { agentId, apiKey }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) return null;
    if (!agent.apiKey || agent.apiKey !== apiKey) return null;
    return agent;
  },
});

/**
 * Update agent details (self-service by agent)
 * Agent authenticates with their apiKey and can update their own details
 */
export const updateDetails = mutation({
  args: {
    agentId: convexVal.id("agents"),
    apiKey: convexVal.string(),
    workspacePath: convexVal.optional(convexVal.string()),
    model: convexVal.optional(convexVal.string()),
    personality: convexVal.optional(convexVal.string()),
    capabilities: convexVal.optional(convexVal.array(convexVal.string())),
  },
  handler: wrapConvexHandler(async (ctx, { agentId, apiKey, workspacePath, model, personality, capabilities }) => {
    // Verify agent credentials
    const agent = await ctx.db.get(agentId);
    if (!agent) throw ApiError.notFound("Agent", { agentId });
    if (!agent.apiKey || agent.apiKey !== apiKey) {
      throw ApiError.forbidden("Invalid API credentials", { agentId });
    }

    // Build update object with only provided fields
    const updates: any = {};
    if (workspacePath !== undefined) updates.workspacePath = workspacePath;
    if (model !== undefined) updates.model = model;
    if (personality !== undefined) updates.personality = personality;
    if (capabilities !== undefined) updates.capabilities = capabilities;

    // If no fields to update, return current state
    if (Object.keys(updates).length === 0) {
      return { success: true, agent, updated: false };
    }

    // Update agent
    await ctx.db.patch(agentId, updates);

    // Get updated agent
    const updatedAgent = await ctx.db.get(agentId);

    return {
      success: true,
      agent: updatedAgent,
      updated: true,
      updatedFields: Object.keys(updates),
    };
  }),
});

/**
 * Rotate agent's API key securely
 * Returns new apiKey, marks old key for expiration
 * Supports grace period for in-flight requests
 */
export const rotateKey = mutation({
  args: {
    agentId: convexVal.id("agents"),
    apiKey: convexVal.string(),  // Current key (for verification)
    newApiKey: convexVal.string(),  // New key to set
    reason: convexVal.optional(convexVal.union(
      convexVal.literal("scheduled"),
      convexVal.literal("compromised"),
      convexVal.literal("deployment"),
      convexVal.literal("refresh")
    )),
    gracePeriodSeconds: convexVal.optional(convexVal.number()),  // 0-300
  },
  handler: wrapConvexHandler(async (ctx, { agentId, apiKey, newApiKey, reason, gracePeriodSeconds = 0 }) => {
    // Verify current key
    const agent = await ctx.db.get(agentId);
    if (!agent) {
      throw ApiError.notFound("Agent", { agentId });
    }
    if (!agent.apiKey || agent.apiKey !== apiKey) {
      throw ApiError.forbidden("Invalid API credentials", { agentId });
    }

    // Validate gracePeriodSeconds
    if (gracePeriodSeconds < 0 || gracePeriodSeconds > 300) {
      throw ApiError.validationError(
        "Grace period must be between 0 and 300 seconds",
        { gracePeriodSeconds, min: 0, max: 300 }
      );
    }

    // Calculate when old key expires
    const now = Date.now();
    const previousKeyExpiresAt = now + (gracePeriodSeconds * 1000);

    // Update agent with new key
    const updates: any = {
      apiKey: newApiKey,
      previousApiKey: agent.apiKey,  // Save old key for grace period
      previousKeyExpiresAt,
      lastKeyRotationAt: now,
      keyRotationCount: (agent.keyRotationCount || 0) + 1,
      updatedAt: now,
    };

    await ctx.db.patch(agentId, updates);

    // Log rotation activity (if agent has businessId context, log to activities)
    // For now, return rotation info
    return {
      agentId,
      newApiKey,
      rotatedAt: now,
      oldKeyExpiresAt: previousKeyExpiresAt,
      gracePeriodSeconds,
      reason: reason || "refresh",
    };
  }),
});

/**
 * Verify agent key (supports both current and grace-period keys)
 * Used during key rotation grace period
 */
export const verifyKeyWithGrace = query({
  args: {
    agentId: convexVal.id("agents"),
    apiKey: convexVal.string(),
  },
  handler: async (ctx, { agentId, apiKey }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) return null;

    const now = Date.now();

    // Check current key
    if (agent.apiKey && agent.apiKey === apiKey) {
      return agent;
    }

    // Check previous key if within grace period
    if (
      agent.previousApiKey &&
      agent.previousApiKey === apiKey &&
      agent.previousKeyExpiresAt &&
      now < agent.previousKeyExpiresAt
    ) {
      return agent; // Still valid during grace period
    }

    return null;
  },
});

/**
 * Delete an agent and unassign from all tasks
 * Called by admin/dashboard operator
 * PERF: Phase 5C - Query tasks by business instead of full table scan
 */
export const deleteAgent = mutation({
  args: {
    agentId: convexVal.id("agents"),
    deletedBy: convexVal.string(),
  },
  handler: wrapConvexHandler(async (ctx, { agentId, deletedBy }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) throw ApiError.notFound("Agent", { agentId });

    // Remove agent from all task assigneeIds
    // PERF FIX: Query tasks by business (bounded) instead of full table scan
    const businesses = await ctx.db.query("businesses").collect();
    for (const business of businesses) {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_business", (q: any) => q.eq("businessId", business._id))
        .collect();

      for (const task of tasks) {
        if (task.assigneeIds?.includes(agentId)) {
          await ctx.db.patch(task._id, {
            assigneeIds: task.assigneeIds.filter((id: string) => id !== agentId),
          });
        }
      }
    }

    // Delete the agent
    await ctx.db.delete(agentId);

    return { success: true, deletedAgent: agent.name };
  }),
});
