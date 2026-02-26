/**
 * Dashboard queries - Convex Functions
 * No "use node" - these run in standard runtime
 */

import { query } from './_generated/server';
import { v as convexVal } from "convex/values";

/**
 * Get dashboard summary
 */
export const getDashboardSummary = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query('agents').collect();
    const executions = await ctx.db.query('executions')
      .filter(q => q.gte(q.field('startTime'), Date.now() - 24 * 60 * 60 * 1000))
      .collect();

    // Calculate metrics
    let totalTokens = 0;
    let runningCount = 0;
    let successCount = 0;
    let failedCount = 0;

    for (const ex of executions) {
      totalTokens += ex.totalTokens || 0;
      if (ex.status === 'running') runningCount++;
      if (ex.status === 'success') successCount++;
      if (ex.status === 'failed') failedCount++;
    }

    return {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.status === 'active').length,
      totalExecutions: executions.length,
      runningExecutions: runningCount,
      todayTokens: totalTokens,
      successRate: executions.length > 0 
        ? Math.round((successCount / executions.length) * 100) 
        : 0,
    };
  },
});

/**
 * Get all executions with optional filters
 */
export const getExecutions = query({
  args: {
    agentId: convexVal.optional(convexVal.string()),
    status: convexVal.optional(convexVal.string()),
    limit: convexVal.optional(convexVal.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query('executions');
    
    const all = await query.collect();
    let results = all;
    
    if (args.agentId) {
      results = results.filter(e => e.agentId === args.agentId);
    }
    
    if (args.status) {
      results = results.filter(e => e.status === args.status);
    }
    
    // Sort by startTime desc
    results.sort((a, b) => b.startTime - a.startTime);
    
    return results.slice(0, args.limit || 50);
  },
});

/**
 * Get agent with execution stats
 */
export const getAgentWithStats = query({
  args: {
    agentId: convexVal.id('agents'),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) return null;

    // Get executions for this agent
    const allExecutions = await ctx.db.query('executions').collect();
    const agentExecutions = allExecutions.filter(e => e.agentId === args.agentId);

    // Calculate stats
    const totalExecutions = agentExecutions.length;
    const successfulExecutions = agentExecutions.filter(e => e.status === 'success').length;
    const failedExecutions = agentExecutions.filter(e => e.status === 'failed').length;
    const totalTokens = agentExecutions.reduce((sum, e) => sum + (e.totalTokens || 0), 0);
    const totalDuration = agentExecutions.reduce((sum, e) => sum + (e.durationMs || 0), 0);

    return {
      ...agent,
      stats: {
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        successRate: totalExecutions > 0 
          ? Math.round((successfulExecutions / totalExecutions) * 100) 
          : 0,
        totalTokens,
        avgDuration: totalExecutions > 0 
          ? Math.round(totalDuration / totalExecutions) 
          : 0,
      },
    };
  },
});
