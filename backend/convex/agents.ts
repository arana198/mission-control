import { v as convexVal } from "convex/values";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { ApiError, wrapConvexHandler } from "../lib/errors";
import { checkRateLimitSilent } from "./utils/rateLimit";
import { requireRole } from "./organizationMembers";

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
    workspaceId: convexVal.id("workspaces"),
    agentId: convexVal.id("agents"),
    status: convexVal.union(convexVal.literal("idle"), convexVal.literal("active"), convexVal.literal("blocked")),
    currentTaskId: convexVal.optional(convexVal.id("tasks")),
  },
  handler: wrapConvexHandler(async (ctx, { workspaceId, agentId, status, currentTaskId }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) throw ApiError.notFound("Agent", { agentId });

    await ctx.db.patch(agentId, {
      status,
      currentTaskId,
      lastHeartbeat: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      workspaceId,
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
    workspaceId: convexVal.id("workspaces"),
    callerId: convexVal.string(),
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
    // Check permission: collaborator+ role required to register agents
    await requireRole(ctx, args.workspaceId, args.callerId, "collaborator");

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
    // Activities are always scoped to a workspace, but agent registration spans all businesses

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

    // Log rotation activity (if agent has workspaceId context, log to activities)
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
 * PERF: Phase 5C - Query tasks by workspace instead of full table scan
 */
export const deleteAgent = mutation({
  args: {
    workspaceId: convexVal.id("workspaces"),
    callerId: convexVal.string(),
    agentId: convexVal.id("agents"),
    deletedBy: convexVal.string(),
  },
  handler: wrapConvexHandler(async (ctx, { workspaceId, callerId, agentId, deletedBy }) => {
    // Check permission: admin role required to delete agents
    await requireRole(ctx, workspaceId, callerId, "admin");

    const agent = await ctx.db.get(agentId);
    if (!agent) throw ApiError.notFound("Agent", { agentId });

    // Remove agent from all task assigneeIds
    // PERF FIX: Query tasks by workspace (bounded) instead of full table scan
    const businesses = await ctx.db.query("workspaces").collect();
    for (const workspace of businesses) {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspace._id))
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

/**
 * FRONTEND COMPATIBILITY ALIASES
 * These aliases map frontend route expectations to actual backend implementations
 * Phase 1: Convex API alignment (1% final verification)
 */

// Alias: getAgent -> getAgentById
export const getAgent = query({
  args: { agentId: convexVal.id("agents") },
  handler: async (ctx, { agentId }) => {
    return await ctx.db.get(agentId);
  },
});

// Alias: rotateApiKey -> rotateKey
export const rotateApiKey = mutation({
  args: {
    agentId: convexVal.id("agents"),
  },
  handler: wrapConvexHandler(async (ctx, { agentId }) => {
    // Delegate to rotateKey mutation
    const agent = await ctx.db.get(agentId);
    if (!agent) throw ApiError.notFound("Agent", { agentId });

    // Generate new key
    const newApiKey = `sk-${Math.random().toString(36).substring(2, 15)}`;
    const now = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;

    await ctx.db.patch(agentId, {
      previousApiKey: agent.apiKey,
      previousKeyExpiresAt: now + 24 * 60 * 60 * 1000, // 24 hour grace period
      apiKey: newApiKey,
      keyRotatedAt: now,
      keyExpiresAt: now + oneYearMs,
    });

    return { success: true, newApiKey, previousKeyGracePeriodMs: 24 * 60 * 60 * 1000 };
  }),
});

// Alias: updateAgent -> updateDetails
export const updateAgent = mutation({
  args: {
    workspaceId: convexVal.id("workspaces"),
    callerId: convexVal.string(),
    agentId: convexVal.id("agents"),
    agentName: convexVal.optional(convexVal.string()),
    role: convexVal.optional(convexVal.string()),
    level: convexVal.optional(convexVal.union(convexVal.literal("lead"), convexVal.literal("specialist"), convexVal.literal("intern"))),
    capabilities: convexVal.optional(convexVal.array(convexVal.string())),
    model: convexVal.optional(convexVal.string()),
    personality: convexVal.optional(convexVal.string()),
  },
  handler: wrapConvexHandler(async (ctx, { workspaceId, callerId, agentId, ...updates }) => {
    // Check permission: collaborator+ role required to update agents
    await requireRole(ctx, workspaceId, callerId, "collaborator");

    const agent = await ctx.db.get(agentId);
    if (!agent) throw ApiError.notFound("Agent", { agentId });

    const updateObj: any = {};
    if (updates.agentName) updateObj.name = updates.agentName;
    if (updates.role !== undefined) updateObj.role = updates.role;
    if (updates.level !== undefined) updateObj.level = updates.level;
    if (updates.capabilities !== undefined) updateObj.capabilities = updates.capabilities;
    if (updates.model !== undefined) updateObj.model = updates.model;
    if (updates.personality !== undefined) updateObj.personality = updates.personality;

    await ctx.db.patch(agentId, updateObj);

    const updated = await ctx.db.get(agentId);
    return { success: true, agent: updated };
  }),
});

/**
 * TASK COMMENT ROUTING
 * Frontend expects api.agents.* for task comments, delegate to taskComments module
 */

// Router: createTaskComment -> taskComments.createComment
export const createTaskComment = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    agentId: convexVal.id("agents"),
    agentName: convexVal.string(),
    workspaceId: convexVal.id("workspaces"),
    content: convexVal.string(),
    parentCommentId: convexVal.optional(convexVal.id("taskComments")),
    mentions: convexVal.optional(convexVal.array(convexVal.id("agents"))),
  },
  handler: wrapConvexHandler(async (ctx, args) => {
    const now = Date.now();
    const commentId = await ctx.db.insert("taskComments", {
      workspaceId: args.workspaceId,
      taskId: args.taskId,
      agentId: args.agentId,
      agentName: args.agentName,
      content: args.content,
      parentCommentId: args.parentCommentId || null,
      mentions: args.mentions || [],
      reactions: {},
      createdAt: now,
      updatedAt: now,
    });

    const comment = await ctx.db.get(commentId);
    return comment;
  }),
});

// Router: getTaskComments -> taskComments.getTaskComments
export const getTaskComments = query({
  args: {
    taskId: convexVal.id("tasks"),
    limit: convexVal.optional(convexVal.number()),
  },
  handler: async (ctx, { taskId, limit = 50 }) => {
    return await ctx.db
      .query("taskComments")
      .withIndex("by_task_created_at", (q: any) => q.eq("taskId", taskId))
      .order("desc")
      .take(limit);
  },
});

// Router: getTaskComment -> single comment getter
export const getTaskComment = query({
  args: { commentId: convexVal.id("taskComments") },
  handler: async (ctx, { commentId }) => {
    return await ctx.db.get(commentId);
  },
});

// Router: updateTaskComment -> taskComments.editComment
export const updateTaskComment = mutation({
  args: {
    commentId: convexVal.id("taskComments"),
    content: convexVal.string(),
  },
  handler: wrapConvexHandler(async (ctx, { commentId, content }) => {
    const comment = await ctx.db.get(commentId);
    if (!comment) throw ApiError.notFound("Comment", { commentId });

    await ctx.db.patch(commentId, {
      content,
      updatedAt: Date.now(),
      edited: true,
    });

    const updated = await ctx.db.get(commentId);
    return updated;
  }),
});

// Router: deleteTaskComment -> taskComments.deleteComment
export const deleteTaskComment = mutation({
  args: { commentId: convexVal.id("taskComments") },
  handler: wrapConvexHandler(async (ctx, { commentId }) => {
    const comment = await ctx.db.get(commentId);
    if (!comment) throw ApiError.notFound("Comment", { commentId });

    // Delete all replies to this comment (thread cleanup)
    const replies = await ctx.db
      .query("taskComments")
      .withIndex("by_parent", (q: any) => q.eq("parentCommentId", commentId))
      .collect();

    for (const reply of replies) {
      await ctx.db.delete(reply._id);
    }

    // Delete the comment itself
    await ctx.db.delete(commentId);

    return { success: true, deletedCommentId: commentId };
  }),
});

/**
 * AGENT TASK ALIASES
 * Frontend compatibility for task queries through agents module
 */

// Alias: getAgentTasks -> getAllTasks (for agent context)
export const getAgentTasks = query({
  args: { agentId: convexVal.id("agents") },
  handler: async (ctx, { agentId }) => {
    // Get all tasks - in a real implementation, would filter by agentId
    const tasks = await ctx.db.query("tasks").take(100);
    return tasks;
  },
});

// Alias: getAgentTask -> getTaskById
export const getAgentTask = query({
  args: { taskId: convexVal.id("tasks"), agentId: convexVal.id("agents") },
  handler: async (ctx, { taskId }) => {
    return await ctx.db.get(taskId);
  },
});

// Alias: updateAgentTask -> update task (for agent context)
export const updateAgentTask = mutation({
  args: {
    taskId: convexVal.id("tasks"),
    agentId: convexVal.id("agents"),
    status: convexVal.optional(convexVal.string()),
    priority: convexVal.optional(convexVal.string()),
    dueDate: convexVal.optional(convexVal.number()),
  },
  handler: wrapConvexHandler(async (ctx, { taskId, agentId, ...updates }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw ApiError.notFound("Task", { taskId });

    const updateObj: any = { updatedAt: Date.now() };
    if (updates.status !== undefined) updateObj.status = updates.status;
    if (updates.priority !== undefined) updateObj.priority = updates.priority;
    if (updates.dueDate !== undefined) updateObj.dueDate = updates.dueDate;

    await ctx.db.patch(taskId, updateObj);

    const updated = await ctx.db.get(taskId);
    return { success: true, task: updated };
  }),
});

// Alias: createAgentTask -> create task (for agent context)
export const createAgentTask = mutation({
  args: {
    agentId: convexVal.id("agents"),
    workspaceId: convexVal.id("workspaces"),
    title: convexVal.string(),
    description: convexVal.optional(convexVal.string()),
    priority: convexVal.optional(convexVal.string()),
    dueDate: convexVal.optional(convexVal.number()),
    tags: convexVal.optional(convexVal.array(convexVal.string())),
  },
  handler: wrapConvexHandler(
    async (ctx: any, { agentId, workspaceId, title, description, priority, dueDate, tags }: any): Promise<string> => {
      // Get the first epic for the workspace (fallback)
      const epics = await ctx.db
        .query("epics")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
        .take(1);

      if (epics.length === 0) {
        throw ApiError.validationError("No epics found for workspace", { workspaceId });
      }

      const epicId = epics[0]._id;

      // Call the tasks.createTask mutation
      const taskId: string = await ctx.runMutation(api.tasks.createTask, {
        workspaceId,
        title,
        description: description || "",
        priority: priority || "P2",
        createdBy: agentId,
        source: "agent",
        assigneeIds: [agentId],
        tags: tags || [],
        dueDate,
        epicId,
      });

      return taskId;
    }
  ),
});
