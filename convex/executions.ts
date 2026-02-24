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
 * Export for testing
 */
export { calculateCost };
