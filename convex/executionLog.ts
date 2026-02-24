/**
 * Execution Logging - Mutations
 */

import { query, mutation } from './_generated/server';
import { v as convexVal } from "convex/values";

/**
 * Log an agent execution
 */
export const logExecution = mutation({
  args: {
    agentId: convexVal.id('agents'),
    agentName: convexVal.string(),
    taskTitle: convexVal.optional(convexVal.string()),
    triggerType: convexVal.union(
      convexVal.literal('manual'),
      convexVal.literal('cron'),
      convexVal.literal('autonomous'),
      convexVal.literal('webhook')
    ),
    status: convexVal.union(
      convexVal.literal('pending'),
      convexVal.literal('running'),
      convexVal.literal('success'),
      convexVal.literal('failed'),
      convexVal.literal('aborted')
    ),
    startTime: convexVal.number(),
    endTime: convexVal.optional(convexVal.number()),
    durationMs: convexVal.optional(convexVal.number()),
    inputTokens: convexVal.optional(convexVal.number()),
    outputTokens: convexVal.optional(convexVal.number()),
    totalTokens: convexVal.optional(convexVal.number()),
    model: convexVal.optional(convexVal.string()),
    modelProvider: convexVal.optional(convexVal.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('executions', {
      agentId: args.agentId,
      agentName: args.agentName,
      taskId: undefined,
      taskTitle: args.taskTitle,
      triggerType: args.triggerType,
      status: args.status,
      startTime: args.startTime,
      endTime: args.endTime,
      durationMs: args.durationMs,
      inputTokens: args.inputTokens || 0,
      outputTokens: args.outputTokens || 0,
      totalTokens: args.totalTokens || 0,
      costCents: undefined,
      model: args.model,
      modelProvider: args.modelProvider,
      error: undefined,
      logs: undefined,
      metadata: {},
    });
    return { executionId: id };
  },
});

/**
 * Get execution stats
 */
export const getExecutionStats = query({
  args: {},
  handler: async (ctx) => {
    const executions = await ctx.db.query('executions').collect();
    
    let totalTokens = 0;
    let success = 0;
    let failed = 0;
    let running = 0;
    
    for (const ex of executions) {
      totalTokens += ex.totalTokens || 0;
      if (ex.status === 'success') success++;
      else if (ex.status === 'failed') failed++;
      else if (ex.status === 'running') running++;
    }
    
    return {
      total: executions.length,
      success,
      failed,
      running,
      totalTokens,
    };
  },
});
