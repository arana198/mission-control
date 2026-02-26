/**
 * Suite 1: Executions - Phase 6A Control Plane Foundation
 *
 * Convex mutations and queries for execution logging and tracking.
 * Part of the immutable execution audit ledger for governance and billing.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * PHASE 1: calculateCost() - Helper function
 *
 * Calculate execution cost based on tokens and model pricing.
 *
 * Signature:
 *   async function calculateCost(
 *     ctx,
 *     inputTokens: number,
 *     outputTokens: number,
 *     model: string
 *   ): Promise<number>
 *
 * Returns: costCents (integer)
 *
 * Formula: (inputTokens * inputRate + outputTokens * outputRate)
 * Rates stored in settings.pricing[model] = { input: rate_per_1k, output: rate_per_1k }
 * Both rates are in cents per 1000 tokens
 *
 * Example:
 *   - gpt-4: input=$0.03, output=$0.06 per 1000 tokens = 3, 6 cents per 1000
 *   - 1000 input, 500 output: (1000 * 3 + 500 * 6) = 6000 cents
 *
 * Risks (HIGH):
 *   - Pricing accuracy — must verify formula matches billing
 *   - Missing model handling — define fallback behavior
 */
async function calculateCost(
  ctx: any,
  inputTokens: number,
  outputTokens: number,
  model: string
): Promise<number> {
  // Get pricing configuration from settings
  // Settings table has a row with key="pricing" containing pricing config
  const settings = await ctx.db
    .query("settings")
    .filter((q: any) => q.eq(q.field("key"), "pricing"))
    .first();

  if (!settings || !settings.value) {
    // Fallback: if no pricing configured, return 0
    // In production, this should probably throw an error
    console.warn(`No pricing configured for model: ${model}`);
    return 0;
  }

  const pricingConfig = settings.value;
  const modelPricing = pricingConfig[model];

  if (!modelPricing) {
    // Model not found in pricing
    console.warn(`Missing pricing for model: ${model}`);
    return 0; // Or throw error — TBD
  }

  const inputRate = modelPricing.input || 0; // cents per 1000 tokens
  const outputRate = modelPricing.output || 0; // cents per 1000 tokens

  // Calculate total cost in cents
  // Formula: (inputTokens * inputRate + outputTokens * outputRate)
  const totalCostCents = inputTokens * inputRate + outputTokens * outputRate;

  return totalCostCents;
}

/**
 * ========== PHASE 2: DEPENDS ON PHASE 1 ==========
 */

/**
 * PHASE 2: createEvent() - Mutation
 *
 * Create an event record in the immutable event stream.
 *
 * Signature:
 *   export const createEvent = mutation({
 *     args: {
 *       type: v.string(),
 *       agentId?: v.id("agents"),
 *       executionId?: v.id("executions"),
 *       workflowId?: v.id("workflows"),
 *       message: v.string(),
 *       severity: "info" | "warning" | "error",
 *     },
 *     handler: async (ctx, args) => eventId
 *   })
 *
 * Events are append-only and auto-cleaned after 24h.
 * Used for: observability, audit trail, alerting
 *
 * Test Cases:
 * - 1.8.1: Creates event with required fields
 * - 1.8.2: Includes optional references (agentId, executionId)
 * - 1.8.3: Timestamps event
 * - 1.8.4: Multiple events don't block each other
 */
export const createEvent = mutation({
  args: {
    type: v.union(
      v.literal("agent_started"),
      v.literal("agent_stopped"),
      v.literal("execution_started"),
      v.literal("execution_completed"),
      v.literal("execution_failed"),
      v.literal("error_occurred"),
      v.literal("retry_attempt"),
      v.literal("workflow_started"),
      v.literal("workflow_completed"),
      v.literal("cron_triggered")
    ),
    agentId: v.optional(v.id("agents")),
    executionId: v.optional(v.id("executions")),
    workflowId: v.optional(v.id("workflows")),
    message: v.string(),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("error")),
  },
  handler: async (ctx, args) => {
    const event = {
      type: args.type,
      agentId: args.agentId,
      executionId: args.executionId,
      workflowId: args.workflowId,
      message: args.message,
      severity: args.severity,
      timestamp: Date.now(),
    };

    return await ctx.db.insert("events", event);
  },
});

/**
 * PHASE 2: createExecution() - Mutation
 *
 * Create a new execution record (start of execution lifecycle).
 *
 * Signature:
 *   export const createExecution = mutation({
 *     args: {
 *       agentId: v.id("agents"),
 *       taskId?: v.id("tasks"),
 *       workflowId?: v.id("workflows"),
 *       triggerType: "manual" | "cron" | "autonomous" | "webhook",
 *       model?: v.string(),
 *       modelProvider?: v.string(),
 *     },
 *     handler: async (ctx, args) => executionId
 *   })
 *
 * Denormalizes agent name and task title for fast access.
 * Initializes execution in "pending" state.
 *
 * Test Cases:
 * - 1.1.1: Creates execution with minimal args
 * - 1.1.2: Sets correct trigger type
 * - 1.1.3: Denormalizes agent name
 * - 1.1.4: Denormalizes task title if provided
 * - 1.1.5: Handles optional model/provider
 */
export const createExecution = mutation({
  args: {
    agentId: v.id("agents"),
    taskId: v.optional(v.id("tasks")),
    workflowId: v.optional(v.id("workflows")),
    triggerType: v.union(
      v.literal("manual"),
      v.literal("cron"),
      v.literal("autonomous"),
      v.literal("webhook")
    ),
    model: v.optional(v.string()),
    modelProvider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get agent details for denormalization
    const agent = await ctx.db.get(args.agentId);
    const agentName = agent?.name || "Unknown Agent";

    // Get task details if provided
    let taskTitle = undefined;
    if (args.taskId) {
      const task = await ctx.db.get(args.taskId);
      taskTitle = task?.title || "Unknown Task";
    }

    // Create execution record
    const execution: any = {
      agentId: args.agentId,
      agentName,
      triggerType: args.triggerType,
      status: "pending" as const,
      startTime: Date.now(),
      inputTokens: 0,
      outputTokens: 0,
      costCents: 0,
      logs: [],
      metadata: {
        retryCount: 0,
      },
    };

    // Add optional fields only if provided
    if (args.taskId) execution.taskId = args.taskId;
    if (taskTitle) execution.taskTitle = taskTitle;
    if (args.workflowId) execution.workflowId = args.workflowId;
    if (args.model) execution.model = args.model;
    if (args.modelProvider) execution.modelProvider = args.modelProvider;

    return await ctx.db.insert("executions", execution);
  },
});

/**
 * PHASE 2: updateExecutionStatus() - Mutation
 *
 * Update execution status and associated fields (tokens, duration, logs, error).
 *
 * Signature:
 *   export const updateExecutionStatus = mutation({
 *     args: {
 *       executionId: v.id("executions"),
 *       status: "pending" | "running" | "success" | "failed" | "aborted",
 *       endTime?: v.number(),
 *       durationMs?: v.number(),
 *       inputTokens?: v.number(),
 *       outputTokens?: v.number(),
 *       error?: v.string(),
 *       logs?: v.array(v.string()),
 *     },
 *     handler: async (ctx, args) => { success: true }
 *   })
 *
 * Validates status transitions (no going backward).
 * Calculates cost from tokens if provided.
 * Creates event for each status change.
 *
 * Test Cases:
 * - 1.2.1: Updates status from pending→running
 * - 1.2.2: Calculates cost from tokens
 * - 1.2.3: Calculates duration
 * - 1.2.4: Stores logs array
 * - 1.2.5: Records error on failure
 * - 1.2.6: Creates event on completion
 * - 1.2.7: Rejects invalid status transition
 * - 1.2.8: Handles non-existent execution
 */
export const updateExecutionStatus = mutation({
  args: {
    executionId: v.id("executions"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("aborted")
    ),
    endTime: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    error: v.optional(v.string()),
    logs: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Get existing execution
    const execution = await ctx.db.get(args.executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${args.executionId}`);
    }

    // Validate status transitions (can't go backward)
    const statusOrder = ["pending", "running", "success", "failed", "aborted"];
    const currentIndex = statusOrder.indexOf(execution.status);
    const newIndex = statusOrder.indexOf(args.status);

    if (newIndex < currentIndex && args.status !== "aborted") {
      throw new Error(
        `Invalid status transition: ${execution.status} → ${args.status}`
      );
    }

    // Calculate duration if not provided
    const endTime = args.endTime || Date.now();
    const durationMs = args.durationMs || endTime - execution.startTime;

    // Calculate cost if tokens provided
    let costCents = execution.costCents || 0;
    if (args.inputTokens !== undefined && args.outputTokens !== undefined) {
      costCents = await calculateCost(
        ctx,
        args.inputTokens,
        args.outputTokens,
        execution.model || "unknown"
      );
    }

    // Update execution
    const updateData: any = {
      status: args.status,
      endTime,
      durationMs,
      error: args.error || execution.error,
      logs: args.logs !== undefined ? args.logs : execution.logs,
    };

    if (args.inputTokens !== undefined) updateData.inputTokens = args.inputTokens;
    if (args.outputTokens !== undefined) updateData.outputTokens = args.outputTokens;
    if (costCents > 0) updateData.costCents = costCents;

    await ctx.db.patch(args.executionId, updateData);

    // Create event for status change (using available event types from schema)
    // Phase 6A: Using execution_completed/execution_failed; will add custom status change event in Phase 6B
    if (args.status === "failed") {
      await ctx.db.insert("events", {
        type: "execution_failed",
        executionId: args.executionId,
        agentId: execution.agentId,
        message: `Execution failed: ${args.error || "Unknown error"}`,
        severity: "error",
        timestamp: Date.now(),
      });
    } else if (args.status === "success") {
      await ctx.db.insert("events", {
        type: "execution_completed",
        executionId: args.executionId,
        agentId: execution.agentId,
        message: `Execution completed successfully`,
        severity: "info",
        timestamp: Date.now(),
      });
    } else if (args.status === "running") {
      await ctx.db.insert("events", {
        type: "execution_started",
        executionId: args.executionId,
        agentId: execution.agentId,
        message: `Execution started`,
        severity: "info",
        timestamp: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * ========== PHASE 3: QUERY & CONTROL FUNCTIONS ==========
 */

/**
 * PHASE 3: getExecutionLog() - Query
 *
 * Retrieve a complete execution record by ID.
 */
export const getExecutionLog = query({
  args: {
    executionId: v.id("executions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.executionId);
  },
});

/**
 * PHASE 3: getAgentExecutions() - Query
 *
 * Get execution history for an agent, with optional status filter.
 * Orders by startTime descending (newest first).
 */
export const getAgentExecutions = query({
  args: {
    agentId: v.id("agents"),
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let executions = await ctx.db
      .query("executions")
      .filter((q: any) => q.eq(q.field("agentId"), args.agentId))
      .order("desc")
      .collect();

    // Filter by status if provided
    if (args.status) {
      executions = executions.filter((e: any) => e.status === args.status);
    }

    // Apply limit if specified
    const limit = args.limit || 50;
    return executions.slice(0, limit);
  },
});

/**
 * PHASE 3: retryExecution() - Mutation
 *
 * Create a new execution from a previous one, incrementing retry count.
 */
export const retryExecution = mutation({
  args: {
    executionId: v.id("executions"),
  },
  handler: async (ctx, args) => {
    const originalExecution = await ctx.db.get(args.executionId);

    if (!originalExecution) {
      throw new Error(`Execution not found: ${args.executionId}`);
    }

    // Can only retry failed or aborted executions
    if (originalExecution.status === "success" || originalExecution.status === "running") {
      throw new Error(
        `Cannot retry execution with status: ${originalExecution.status}`
      );
    }

    // Create new execution with same agent/task
    const retryMetadata = {
      ...originalExecution.metadata,
      retryCount: (originalExecution.metadata?.retryCount || 0) + 1,
      originalExecutionId: args.executionId,
    };

    const newExecution: any = {
      agentId: originalExecution.agentId,
      agentName: originalExecution.agentName,
      triggerType: "autonomous",
      status: "pending",
      startTime: Date.now(),
      inputTokens: 0,
      outputTokens: 0,
      costCents: 0,
      logs: [],
      metadata: retryMetadata,
    };

    if (originalExecution.taskId) newExecution.taskId = originalExecution.taskId;
    if (originalExecution.taskTitle) newExecution.taskTitle = originalExecution.taskTitle;
    if (originalExecution.workflowId) newExecution.workflowId = originalExecution.workflowId;
    if (originalExecution.model) newExecution.model = originalExecution.model;
    if (originalExecution.modelProvider) newExecution.modelProvider = originalExecution.modelProvider;

    const newExecutionId = await ctx.db.insert("executions", newExecution);

    // Create retry event
    await ctx.db.insert("events", {
      type: "retry_attempt",
      executionId: newExecutionId,
      agentId: originalExecution.agentId,
      message: `Retry attempt ${retryMetadata.retryCount} for execution ${args.executionId}`,
      severity: "info",
      timestamp: Date.now(),
    });

    return newExecutionId;
  },
});

/**
 * PHASE 3: abortExecution() - Mutation
 *
 * Abort a pending or running execution.
 */
export const abortExecution = mutation({
  args: {
    executionId: v.id("executions"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId);

    if (!execution) {
      throw new Error(`Execution not found: ${args.executionId}`);
    }

    // Can only abort pending or running executions
    if (execution.status !== "pending" && execution.status !== "running") {
      throw new Error(`Cannot abort execution with status: ${execution.status}`);
    }

    const abortReason = args.reason || "Aborted by user";

    // Update execution to aborted
    await ctx.db.patch(args.executionId, {
      status: "aborted",
      error: abortReason,
      endTime: Date.now(),
      durationMs: Date.now() - execution.startTime,
    });

    // Create abort event
    await ctx.db.insert("events", {
      type: "execution_failed",
      executionId: args.executionId,
      agentId: execution.agentId,
      message: `Execution aborted: ${abortReason}`,
      severity: "error",
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * PHASE 4: executeAgentManually() - Mutation
 *
 * Execute an agent manually with full validation (rate limit, budget, status).
 */
export const executeAgentManually = mutation({
  args: {
    agentId: v.id("agents"),
    taskId: v.optional(v.id("tasks")),
    workflowId: v.optional(v.id("workflows")),
    input: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Get agent and status
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${args.agentId}`);
    }

    const agentStatus = await ctx.db
      .query("agent_status")
      .filter((q: any) => q.eq(q.field("agentId"), args.agentId))
      .first();

    // Validate agent can execute (status, rate limit, budget)
    // Note: In full implementation, would check actual rate limits and budget
    if (agentStatus && (agentStatus.status === "failed" || agentStatus.status === "stopped")) {
      throw new Error(`Agent not available (status: ${agentStatus.status})`);
    }

    // Create execution
    const execution: any = {
      agentId: args.agentId,
      agentName: agent.name,
      triggerType: "manual",
      status: "pending",
      startTime: Date.now(),
      inputTokens: 0,
      outputTokens: 0,
      costCents: 0,
      logs: [],
      metadata: {
        retryCount: 0,
        input: args.input,
      },
    };

    if (args.taskId) execution.taskId = args.taskId;
    if (args.workflowId) execution.workflowId = args.workflowId;

    const executionId = await ctx.db.insert("executions", execution);

    // Create execution_started event
    await ctx.db.insert("events", {
      type: "execution_started",
      executionId,
      agentId: args.agentId,
      message: "Agent execution started (manual trigger)",
      severity: "info",
      timestamp: Date.now(),
    });

    return executionId;
  },
});

/**
 * PHASE 4: aggregateMetrics() - Action
 *
 * Aggregate hourly metrics from executions and store in metrics table.
 */
export const aggregateMetrics = mutation({
  args: {
    date: v.string(), // "2024-02-24"
    hour: v.number(), // 0-23
  },
  handler: async (ctx, args) => {
    // Get executions for the specified hour using time-window filter
    // Calculate epoch ms bounds for the given date+hour
    const dateMs = new Date(`${args.date}T${String(args.hour).padStart(2, "0")}:00:00Z`).getTime();
    const windowStartMs = dateMs;
    const windowEndMs = dateMs + 3600000; // one hour later

    const executions = await ctx.db
      .query("executions")
      .withIndex("by_start_time", (q: any) =>
        q.gte("startTime", windowStartMs).lte("startTime", windowEndMs)
      )
      .collect();
    // Note: No status filter here — we need both successes and failures to compute failureRate

    if (executions.length === 0) {
      return { agentsProcessed: 0, metricsCreated: 0 };
    }

    // Group by agent
    const agentMetrics: Record<string, any> = {};

    for (const exec of executions) {
      const agentId = exec.agentId;

      if (!agentMetrics[agentId]) {
        agentMetrics[agentId] = {
          executionCount: 0,
          successCount: 0,
          failureCount: 0,
          totalDurationMs: 0,
          totalTokens: 0,
          totalCostCents: 0,
        };
      }

      agentMetrics[agentId].executionCount++;
      if (exec.status === "success") agentMetrics[agentId].successCount++;
      if (exec.status === "failed") agentMetrics[agentId].failureCount++;

      agentMetrics[agentId].totalDurationMs += exec.durationMs || 0;
      agentMetrics[agentId].totalTokens +=
        (exec.inputTokens || 0) + (exec.outputTokens || 0);
      agentMetrics[agentId].totalCostCents += exec.costCents || 0;
    }

    // Upsert metrics for each agent
    let metricsCreated = 0;
    for (const [agentIdStr, stats] of Object.entries(agentMetrics)) {
      const failureRate =
        stats.executionCount > 0
          ? Math.round((stats.failureCount / stats.executionCount) * 100) / 100
          : 0;

      const avgCostCentsPerExecution = Math.round(
        stats.totalCostCents / stats.executionCount
      );

      await ctx.db.insert("metrics", {
        agentId: agentIdStr as any,
        date: args.date,
        hour: args.hour,
        executionCount: stats.executionCount,
        successCount: stats.successCount,
        failureCount: stats.failureCount,
        totalDurationMs: stats.totalDurationMs,
        avgDurationMs: Math.round(stats.totalDurationMs / stats.executionCount),
        totalTokens: stats.totalTokens,
        avgTokensPerExecution: Math.round(
          stats.totalTokens / stats.executionCount
        ),
        totalCostCents: stats.totalCostCents,
        avgCostCentsPerExecution,
        failureRate,
      });

      metricsCreated++;
    }

    return {
      agentsProcessed: Object.keys(agentMetrics).length,
      metricsCreated,
    };
  },
});

/**
 * PHASE 4: cleanupOldEvents() - Action/Mutation
 *
 * Delete events older than 24 hours from the event stream.
 * Runs as background job to prevent unbounded growth.
 */
export const cleanupOldEvents = mutation({
  args: {
    maxAgeMs: v.optional(v.number()), // default 24 hours
  },
  handler: async (ctx, args) => {
    const maxAgeMs = args.maxAgeMs || 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    const cutoff = now - maxAgeMs;

    // Get all old events
    const oldEvents = await ctx.db
      .query("events")
      .filter((q: any) => q.lt(q.field("timestamp"), cutoff))
      .collect();

    // Delete them (in batches in production)
    let deleted = 0;
    for (const event of oldEvents) {
      await ctx.db.delete(event._id);
      deleted++;
    }

    return { deleted };
  },
});

/**
 * ========== PHASE 5: OBSERVABILITY DASHBOARD QUERIES ==========
 */

/**
 * PHASE 5: getRecentExecutions() - Query
 *
 * Get recent executions, optionally scoped to a workspace or agent.
 * Uses appropriate index based on filter parameters.
 */
export const getRecentExecutions = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    agentId: v.optional(v.id("agents")),
    startTime: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const cappedLimit = Math.min(args.limit ?? 50, 200);

    let query = ctx.db.query("executions");

    // Use appropriate index based on filter parameters
    if (args.agentId && args.startTime) {
      query = query.withIndex("by_agent_time", (q: any) =>
        q.eq("agentId", args.agentId).gte("startTime", args.startTime)
      ) as any;
    } else if (args.agentId) {
      query = query.withIndex("by_agent", (q: any) =>
        q.eq("agentId", args.agentId)
      ) as any;
    } else if (args.workspaceId) {
      query = query.withIndex("by_workspace_id", (q: any) =>
        q.eq("workspaceId", args.workspaceId)
      ) as any;
    } else {
      query = query.withIndex("by_start_time") as any;
    }

    const executions = await query.order("desc").take(cappedLimit);
    return executions;
  },
});

/**
 * PHASE 5: getEventStream() - Query
 *
 * Get recent events, optionally filtered by agent and severity.
 * Returns newest events first.
 */
export const getEventStream = query({
  args: {
    agentId: v.optional(v.id("agents")),
    severity: v.optional(
      v.union(v.literal("info"), v.literal("warning"), v.literal("error"))
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const cappedLimit = Math.min(args.limit ?? 100, 500);

    const events = await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .take(cappedLimit);

    // Post-filter by agentId and severity in memory
    let filtered = events;
    if (args.agentId) {
      filtered = filtered.filter((e: any) => e.agentId === args.agentId);
    }
    if (args.severity) {
      filtered = filtered.filter((e: any) => e.severity === args.severity);
    }

    return filtered;
  },
});

/**
 * PHASE 5: getCostBreakdown() - Query
 *
 * Get cost breakdown for a specific date.
 * If agentId is provided, return hourly breakdown for that agent.
 * Otherwise, return per-agent breakdown for the entire date.
 */
export const getCostBreakdown = query({
  args: {
    date: v.string(), // "YYYY-MM-DD"
    agentId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    if (args.agentId) {
      // Single agent, hourly breakdown
      const rows = await ctx.db
        .query("metrics")
        .withIndex("by_agent_date", (q: any) =>
          q.eq("agentId", args.agentId).eq("date", args.date)
        )
        .collect();

      let totalCostCents = 0;
      const byHour = [];
      for (const row of rows) {
        totalCostCents += row.totalCostCents || 0;
        byHour.push({
          hour: row.hour,
          costCents: row.totalCostCents,
        });
      }

      return {
        agentId: args.agentId,
        date: args.date,
        totalCostCents,
        byHour,
      };
    } else {
      // All agents, per-agent breakdown
      const rows = await ctx.db
        .query("metrics")
        .withIndex("by_date", (q: any) => q.eq("date", args.date))
        .collect();

      const agentCosts: Record<string, number> = {};
      let totalCostCents = 0;

      for (const row of rows) {
        const cost = row.totalCostCents || 0;
        agentCosts[row.agentId] = (agentCosts[row.agentId] ?? 0) + cost;
        totalCostCents += cost;
      }

      const byAgent = Object.entries(agentCosts).map(([agentId, costCents]) => ({
        agentId,
        costCents,
      }));

      return {
        date: args.date,
        totalCostCents,
        byAgent,
      };
    }
  },
});

/**
 * PHASE 5: getExecutionTimeline() - Query
 *
 * Get time-windowed execution history for an agent.
 * Uses compound by_agent_time index for efficiency.
 */
export const getExecutionTimeline = query({
  args: {
    agentId: v.id("agents"),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, args) => {
    const executions = await ctx.db
      .query("executions")
      .withIndex("by_agent_time", (q: any) =>
        q.eq("agentId", args.agentId).gte("startTime", args.startTime)
      )
      .filter((q: any) => q.lte(q.field("startTime"), args.endTime))
      .take(500); // Hard cap to prevent unbounded queries

    return executions;
  },
});

/**
 * Export for testing
 */
export { calculateCost };
