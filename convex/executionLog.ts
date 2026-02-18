/**
 * Execution Log - Convex Functions
 * 
 * Track task execution history, retries, and outcomes
 */

import { mutation, query } from './_generated/server';
import { v as convexVal } from "convex/values";
import { Id } from './_generated/dataModel';

/**
 * CREATE execution log entry
 */
export const create = mutation(async (ctx, args: {
  taskId: Id<'tasks'>;
  agentId?: string;
  status: 'started' | 'success' | 'failed' | 'incomplete';
  output?: string;
  error?: string;
  timeSpent: number;  // minutes
  attemptNumber: number;
  nextAction?: string;
}) => {
  return await ctx.db.insert('executionLog', {
    taskId: args.taskId,
    agentId: args.agentId,
    status: args.status,
    output: args.output,
    error: args.error,
    timeSpent: args.timeSpent,
    attemptNumber: args.attemptNumber,
    nextAction: args.nextAction,
    startedAt: Date.now(),
    completedAt: ['success', 'failed', 'incomplete'].includes(args.status)
      ? Date.now()
      : undefined,
    maxAttempts: 3,
    createdAt: Date.now(),
  });
});

/**
 * GET execution history for a task
 */
export const getByTask = query(async (ctx, args: {
  taskId: Id<'tasks'>;
  limit?: number;
}) => {
  return await ctx.db
    .query('executionLog')
    .filter(q => q.eq(q.field('taskId'), args.taskId))
    .collect()
    .then(logs => logs.sort((a, b) => b.createdAt - a.createdAt))
    .then(logs => logs.slice(0, args.limit || 10));
});

/**
 * GET executions by status
 */
export const getByStatus = query(async (ctx, args: {
  status: 'started' | 'success' | 'failed' | 'incomplete' | 'retry';
}) => {
  return await ctx.db
    .query('executionLog')
    .filter(q => q.eq(q.field('status'), args.status))
    .collect();
});

/**
 * GET execution stats for a time period
 */
export const getStats = query(async (ctx, args: {
  since: number;  // milliseconds ago
}) => {
  const cutoffTime = Date.now() - args.since;

  const logs = await ctx.db
    .query('executionLog')
    .filter(q => q.gte(q.field('createdAt'), cutoffTime))
    .collect();

  const successful = logs.filter(l => l.status === 'success').length;
  const failed = logs.filter(l => l.status === 'failed').length;
  const incomplete = logs.filter(l => l.status === 'incomplete').length;
  const totalTime = logs.reduce((sum, l) => sum + (l.timeSpent || 0), 0);

  return {
    total: logs.length,
    successful,
    failed,
    incomplete,
    successRate: logs.length > 0 ? Math.round((successful / logs.length) * 100) : 0,
    avgTimePerTask: logs.length > 0 ? Math.round(totalTime / logs.length) : 0,
    totalTimeSpent: totalTime,
  };
});

/**
 * UPDATE execution status (completion)
 */
export const complete = mutation(async (ctx, args: {
  id: Id<'executionLog'>;
  status: 'success' | 'failed' | 'incomplete';
  output?: string;
  error?: string;
  timeSpent?: number;
}) => {
  const entry = await ctx.db.get(args.id);
  if (!entry) throw new Error('Log entry not found');

  const elapsedMs = Date.now() - entry.startedAt;
  const elapsedMinutes = Math.round(elapsedMs / 1000 / 60);

  await ctx.db.patch(args.id, {
    status: args.status,
    output: args.output || entry.output,
    error: args.error || entry.error,
    timeSpent: args.timeSpent || elapsedMinutes,
    completedAt: Date.now(),
  });
});
