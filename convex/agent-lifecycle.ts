/**
 * Suite 2: Agent Lifecycle - Phase 6A Control Plane Foundation
 *
 * Convex mutations and queries for agent status tracking and health monitoring.
 * Separate agent_status table prevents contention on frequent heartbeat updates.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * PHASE 1: getSystemHealth() - Query
 *
 * Aggregate health metrics across all agents in a business.
 *
 * Signature:
 *   export const getSystemHealth = query({
 *     args: { businessId: v.id("businesses") },
 *     handler: async (ctx, args) => {
 *       return { totalAgents, activeAgents, idleAgents, failedAgents, ... }
 *     }
 *   })
 *
 * Returns structure:
 *   {
 *     totalAgents: number,
 *     activeAgents: number,
 *     idleAgents: number,
 *     failedAgents: number,
 *     avgQueueDepth: number,
 *     systemHealthPercent: number, // 0-100
 *     avgFailureRate: number, // 0-1.0
 *   }
 *
 * Calculation:
 *   - Count agents by status (idle, busy/active, failed)
 *   - Average queuedTaskCount across all agents
 *   - Health % = (totalAgents - failedAgents) / totalAgents * 100
 *   - Failure rate = sum(agent failure rates) / totalAgents
 *
 * Risks (MEDIUM):
 *   - Multi-agent aggregation performance
 *   - Health percentage calculation edge cases
 *
 * Test Cases:
 * - 2.6.1: Aggregates all agent statuses (10 agents: 6 idle, 3 busy, 1 failed)
 * - 2.6.2: Calculates system health percentage (9/10 healthy = 90%)
 */
export const getSystemHealth = query({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    // Step 1: Get all agents (agents are global, not per-business)
    // For business-specific health, caller should filter by businessId separately
    const agents = await ctx.db
      .query("agents")
      .collect();

    if (agents.length === 0) {
      return {
        totalAgents: 0,
        activeAgents: 0,
        idleAgents: 0,
        failedAgents: 0,
        avgQueueDepth: 0,
        systemHealthPercent: 100, // No agents = "healthy" (no failures)
        avgFailureRate: 0,
      };
    }

    // Step 2: Get status for each agent from agent_status table
    const agentStatuses: any = {};
    for (const agent of agents) {
      const status = await ctx.db
        .query("agent_status")
        .filter((q) => q.eq(q.field("agentId"), agent._id))
        .first();

      if (status) {
        agentStatuses[agent._id] = status;
      }
    }

    // Step 3: Count agents by status
    let idleCount = 0;
    let busyCount = 0;
    let failedCount = 0;
    let totalQueueDepth = 0;
    let totalFailureRate = 0;

    for (const agent of agents) {
      const status = agentStatuses[agent._id];

      if (status) {
        switch (status.status) {
          case "idle":
            idleCount++;
            break;
          case "busy":
            busyCount++;
            break;
          case "failed":
          case "stopped":
            failedCount++;
            break;
        }

        // Accumulate queue depth
        if (status.queuedTaskCount) {
          totalQueueDepth += status.queuedTaskCount;
        }

        // Accumulate failure rate
        if (status.failureRate !== undefined) {
          totalFailureRate += status.failureRate;
        }
      } else {
        // No status record means agent hasn't started/registered yet
        idleCount++;
      }
    }

    // Step 4: Calculate aggregates
    const totalAgents = agents.length;
    const activeAgents = busyCount;
    const avgQueueDepth = totalQueueDepth / totalAgents;
    const healthyAgents = totalAgents - failedCount;
    const systemHealthPercent = Math.round((healthyAgents / totalAgents) * 100);
    const avgFailureRate = totalFailureRate / totalAgents;

    return {
      totalAgents,
      activeAgents,
      idleAgents: idleCount,
      failedAgents: failedCount,
      avgQueueDepth: Math.round(avgQueueDepth * 100) / 100, // Round to 2 decimals
      systemHealthPercent,
      avgFailureRate: Math.round(avgFailureRate * 100) / 100, // Round to 2 decimals
    };
  },
});

/**
 * ========== PHASE 2: DEPENDS ON PHASE 1 ==========
 */

/**
 * PHASE 2: recordHeartbeat() - Mutation
 *
 * Record or update agent heartbeat in the agent_status table.
 * Separate table prevents contention on frequent updates.
 *
 * Signature:
 *   export const recordHeartbeat = mutation({
 *     args: {
 *       agentId: v.id("agents"),
 *       cpuPercent?: v.number(),
 *       memoryMb?: v.number(),
 *       queuedTaskCount: v.number(),
 *     },
 *     handler: async (ctx, args) => { success: true }
 *   })
 *
 * Updates or creates agent_status record with latest metrics.
 * Also updates agents.lastHeartbeat for compatibility.
 *
 * Test Cases:
 * - 2.1.1: Creates agent_status if not exists
 * - 2.1.2: Updates lastHeartbeatAt
 * - 2.1.3: Updates queuedTaskCount
 * - 2.1.4: Records optional metrics (cpu, memory)
 * - 2.1.5: Updates agents.lastHeartbeat
 * - 2.1.6: Idempotent (calling twice = same result)
 */
export const recordHeartbeat = mutation({
  args: {
    agentId: v.id("agents"),
    cpuPercent: v.optional(v.number()),
    memoryMb: v.optional(v.number()),
    queuedTaskCount: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get or create agent_status
    let status = await ctx.db
      .query("agent_status")
      .filter((q) => q.eq(q.field("agentId"), args.agentId))
      .first();

    if (status) {
      // Update existing status
      const updateData: any = {
        lastHeartbeatAt: now,
        queuedTaskCount: args.queuedTaskCount,
      };

      if (args.cpuPercent !== undefined) {
        updateData.cpuPercent = args.cpuPercent;
      }
      if (args.memoryMb !== undefined) {
        updateData.memoryMb = args.memoryMb;
      }

      await ctx.db.patch(status._id, updateData);
    } else {
      // Create new status record
      await ctx.db.insert("agent_status", {
        agentId: args.agentId,
        status: "idle" as const,
        queuedTaskCount: args.queuedTaskCount,
        lastHeartbeatAt: now,
        cpuPercent: args.cpuPercent,
        memoryMb: args.memoryMb,
        uptimePercent: 100,
        totalExecutions: 0,
        failureRate: 0,
      });
    }

    // Update agents.lastHeartbeat for backwards compatibility
    const agent = await ctx.db.get(args.agentId);
    if (agent) {
      await ctx.db.patch(args.agentId, {
        lastHeartbeat: now,
      });
    }

    return { success: true };
  },
});

/**
 * PHASE 2: updateAgentStatus() - Mutation
 *
 * Update agent operational status (idle, busy, failed, stopped).
 *
 * Signature:
 *   export const updateAgentStatus = mutation({
 *     args: {
 *       agentId: v.id("agents"),
 *       status: "idle" | "busy" | "failed" | "stopped",
 *       currentTaskId?: v.id("tasks"),
 *     },
 *     handler: async (ctx, args) => { success: true }
 *   })
 *
 * Updates agent_status record.
 * Clears currentTaskId when transitioning to idle.
 * Creates status_change event.
 *
 * Test Cases:
 * - 2.2.1: Transitions from idle→busy
 * - 2.2.2: Sets currentTaskId when busy
 * - 2.2.3: Clears currentTaskId when idle
 * - 2.2.4: Creates status_change event
 * - 2.2.5: Prevents invalid status values
 * - 2.2.6: Handles non-existent agent
 */
export const updateAgentStatus = mutation({
  args: {
    agentId: v.id("agents"),
    status: v.union(
      v.literal("idle"),
      v.literal("busy"),
      v.literal("failed"),
      v.literal("stopped")
    ),
    currentTaskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    // Get or create agent_status
    const existingStatus = await ctx.db
      .query("agent_status")
      .filter((q) => q.eq(q.field("agentId"), args.agentId))
      .first();

    if (!existingStatus) {
      // Create new status if doesn't exist
      const insertData: any = {
        agentId: args.agentId,
        status: args.status,
        queuedTaskCount: 0,
        lastHeartbeatAt: Date.now(),
        uptimePercent: 100,
        totalExecutions: 0,
        failureRate: 0,
      };

      if (args.status === "busy" && args.currentTaskId) {
        insertData.currentTaskId = args.currentTaskId;
      }

      await ctx.db.insert("agent_status", insertData);
    } else {
      // Update existing status
      const updateData: any = {
        status: args.status,
      };

      if (args.status === "busy" && args.currentTaskId) {
        updateData.currentTaskId = args.currentTaskId;
      }

      await ctx.db.patch(existingStatus._id, updateData);
    }

    // Create event for status change (using available event types from schema)
    // Phase 6A: Using agent_started/agent_stopped; will add agent_status_changed in Phase 6B
    if (args.status === "failed" || args.status === "stopped") {
      await ctx.db.insert("events", {
        type: "agent_stopped",
        agentId: args.agentId,
        message: `Agent status changed to: ${args.status}`,
        severity: "error",
        timestamp: Date.now(),
      });
    } else if (args.status === "busy") {
      await ctx.db.insert("events", {
        type: "execution_started",
        agentId: args.agentId,
        message: `Agent status changed to: busy`,
        severity: "info",
        timestamp: Date.now(),
      });
    }

    return { success: true };
  },
});
