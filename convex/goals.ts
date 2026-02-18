/**
 * Goals - Convex Functions
 * 
 * Long-term objective management with progress tracking
 * Integrates with task completion and memory
 */

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';

/**
 * GET all active goals
 */
export const getActiveGoals = query(async (ctx) => {
  return await ctx.db
    .query('goals')
    .filter(q => q.eq(q.field('status'), 'active'))
    .collect();
});

/**
 * GET goal by ID with related tasks
 */
export const getGoalById = query(async (ctx, args: { id: Id<'goals'> }) => {
  const goal = await ctx.db.get(args.id);
  
  if (!goal) {
    return null;
  }

  // Fetch related tasks
  const relatedTasks = await Promise.all(
    goal.relatedTaskIds.map(taskId => ctx.db.get(taskId))
  );

  return {
    ...goal,
    tasks: relatedTasks.filter(t => t !== null),
  };
});

/**
 * GET goals by category
 */
export const getGoalsByCategory = query(async (ctx, args: {
  category: 'business' | 'personal' | 'learning' | 'health';
}) => {
  return await ctx.db
    .query('goals')
    .filter(q => q.eq(q.field('category'), args.category))
    .collect();
});

/**
 * GET goals grouped by progress
 */
export const getByProgress = query(async (ctx) => {
  const goals = await ctx.db
    .query('goals')
    .filter(q => q.eq(q.field('status'), 'active'))
    .collect();

  // Recalculate progress for each goal
  const goalsWithProgress = await Promise.all(
    goals.map(async (goal) => ({
      ...goal,
      progress: await calculateProgress(ctx, goal._id),
    }))
  );

  return {
    accelerating: goalsWithProgress
      .filter(g => g.progress >= 75)
      .sort((a, b) => b.progress - a.progress),
    onTrack: goalsWithProgress
      .filter(g => g.progress >= 50 && g.progress < 75)
      .sort((a, b) => b.progress - a.progress),
    atRisk: goalsWithProgress
      .filter(g => g.progress >= 25 && g.progress < 50)
      .sort((a, b) => b.progress - a.progress),
    blocked: goalsWithProgress
      .filter(g => g.progress < 25)
      .sort((a, b) => b.progress - a.progress),
  };
});

/**
 * CREATE a new goal
 */
export const create = mutation(async (ctx, args: {
  title: string;
  description: string;
  category: 'business' | 'personal' | 'learning' | 'health';
  deadline?: number;
  keyResults?: string[];
  relatedMemoryRefs?: string[];
  parentGoalId?: Id<'goals'>;
}) => {
  const goalId = await ctx.db.insert('goals', {
    title: args.title,
    description: args.description,
    category: args.category,
    status: 'active',
    progress: 0,
    deadline: args.deadline,
    keyResults: args.keyResults || [],
    relatedTaskIds: [],
    relatedMemoryRefs: args.relatedMemoryRefs || [],
    parentGoalId: args.parentGoalId,
    childGoalIds: [],
    owner: 'user',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Update parent goal if provided
  if (args.parentGoalId) {
    const parentGoal = await ctx.db.get(args.parentGoalId);
    if (parentGoal) {
      await ctx.db.patch(args.parentGoalId, {
        childGoalIds: [...parentGoal.childGoalIds, goalId],
      });
    }
  }

  return goalId;
});

/**
 * UPDATE goal
 */
export const update = mutation(async (ctx, args: {
  id: Id<'goals'>;
  title?: string;
  description?: string;
  status?: 'active' | 'paused' | 'completed' | 'archived';
  deadline?: number;
  keyResults?: string[];
  relatedMemoryRefs?: string[];
}) => {
  const updates: any = {
    updatedAt: Date.now(),
  };

  if (args.title !== undefined) updates.title = args.title;
  if (args.description !== undefined) updates.description = args.description;
  if (args.status !== undefined) {
    updates.status = args.status;
    if (args.status === 'completed') {
      updates.completedAt = Date.now();
    }
  }
  if (args.deadline !== undefined) updates.deadline = args.deadline;
  if (args.keyResults !== undefined) updates.keyResults = args.keyResults;
  if (args.relatedMemoryRefs !== undefined) {
    updates.relatedMemoryRefs = args.relatedMemoryRefs;
  }

  await ctx.db.patch(args.id, updates);
});

/**
 * LINK task to goal
 */
export const linkTask = mutation(async (ctx, args: {
  goalId: Id<'goals'>;
  taskId: Id<'tasks'>;
}) => {
  const goal = await ctx.db.get(args.goalId);
  const task = await ctx.db.get(args.taskId);

  if (!goal || !task) throw new Error('Goal or task not found');

  // Add task to goal
  if (!goal.relatedTaskIds.includes(args.taskId)) {
    await ctx.db.patch(args.goalId, {
      relatedTaskIds: [...goal.relatedTaskIds, args.taskId],
    });
  }

  // Add goal to task
  const currentGoals = task.goalIds || [];
  if (!currentGoals.includes(args.goalId)) {
    await ctx.db.patch(args.taskId, {
      goalIds: [...currentGoals, args.goalId],
    });
  }

  // Recalculate goal progress
  const newProgress = await calculateProgress(ctx, args.goalId);
  await ctx.db.patch(args.goalId, { progress: newProgress });
});

/**
 * UNLINK task from goal
 */
export const unlinkTask = mutation(async (ctx, args: {
  goalId: Id<'goals'>;
  taskId: Id<'tasks'>;
}) => {
  const goal = await ctx.db.get(args.goalId);
  const task = await ctx.db.get(args.taskId);

  if (!goal || !task) throw new Error('Goal or task not found');

  // Remove task from goal
  await ctx.db.patch(args.goalId, {
    relatedTaskIds: goal.relatedTaskIds.filter(id => id !== args.taskId),
  });

  // Remove goal from task
  const updatedGoals = (task.goalIds || []).filter(id => id !== args.goalId);
  await ctx.db.patch(args.taskId, {
    goalIds: updatedGoals,
  });

  // Recalculate goal progress
  const newProgress = await calculateProgress(ctx, args.goalId);
  await ctx.db.patch(args.goalId, { progress: newProgress });
});

/**
 * Helper: Calculate goal progress based on linked tasks
 * 
 * Progress = (completed tasks / total tasks) * 100
 * If no tasks, progress = 0
 */
async function calculateProgress(ctx: any, goalId: Id<'goals'>): Promise<number> {
  const goal = await ctx.db.get(goalId);
  if (!goal || goal.relatedTaskIds.length === 0) {
    return 0;
  }

  const tasks = await Promise.all(
    goal.relatedTaskIds.map((taskId: Id<"tasks">) => ctx.db.get(taskId))
  );

  const completedCount = tasks.filter(t => t && t.status === 'done').length;
  const totalCount = tasks.filter(t => t !== null).length;

  return totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
}

/**
 * RECALCULATE progress for all goals
 */
export const recalculateAllProgress = mutation(async (ctx) => {
  const goals = await ctx.db.query('goals').collect();

  for (const goal of goals) {
    const newProgress = await calculateProgress(ctx, goal._id);
    await ctx.db.patch(goal._id, { progress: newProgress });
  }

  return { updated: goals.length };
});

/**
 * DETECT bottlenecks (goals with no progress)
 */
export const detectBottlenecks = query(async (ctx) => {
  const goals = await ctx.db
    .query('goals')
    .filter(q => q.eq(q.field('status'), 'active'))
    .collect();

  const bottlenecks = [];

  for (const goal of goals) {
    const progress = await calculateProgress(ctx, goal._id);

    // Bottleneck = active goal with 0-25% progress
    if (progress <= 25) {
      const tasks = await Promise.all(
        goal.relatedTaskIds.map(taskId => ctx.db.get(taskId))
      );

      bottlenecks.push({
        goal,
        progress,
        blockedTasks: tasks.filter(t => t && t.status === 'blocked'),
        openTasks: tasks.filter(t => t && t.status !== 'done'),
      });
    }
  }

  return bottlenecks.sort((a, b) => a.progress - b.progress);
});

/**
 * DELETE goal (archive instead)
 */
export const archive = mutation(async (ctx, args: { id: Id<'goals'> }) => {
  await ctx.db.patch(args.id, {
    status: 'archived',
    updatedAt: Date.now(),
  });
});

/**
 * SEED demo goals with linked tasks (for testing/demo purposes)
 */
export const seedDemoGoals = mutation(async (ctx) => {
  const tasks = await ctx.db.query('tasks').collect();

  if (tasks.length === 0) {
    return { error: 'No tasks available to link to goals' };
  }

  const demoGoals = [
    {
      title: 'Launch Q1 Product Features',
      description: 'Ship core features for Q1 product roadmap',
      category: 'business' as const,
      relatedTasks: tasks.slice(0, Math.ceil(tasks.length / 3)).map(t => t._id),
    },
    {
      title: 'Improve System Performance',
      description: 'Reduce API latency and improve database query performance',
      category: 'business' as const,
      relatedTasks: tasks.slice(Math.ceil(tasks.length / 3), Math.ceil(2 * tasks.length / 3)).map(t => t._id),
    },
    {
      title: 'Complete Developer Documentation',
      description: 'Write comprehensive API docs and architecture guides',
      category: 'learning' as const,
      relatedTasks: tasks.slice(Math.ceil(2 * tasks.length / 3)).map(t => t._id),
    },
  ];

  const createdGoals = [];

  for (const demoGoal of demoGoals) {
    const goalId = await ctx.db.insert('goals', {
      title: demoGoal.title,
      description: demoGoal.description,
      category: demoGoal.category,
      status: 'active',
      progress: 0,
      deadline: Date.now() + (90 * 24 * 60 * 60 * 1000), // 90 days from now
      keyResults: [],
      relatedTaskIds: demoGoal.relatedTasks,
      relatedMemoryRefs: [],
      parentGoalId: undefined,
      childGoalIds: [],
      owner: 'user',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Link tasks to goal
    for (const taskId of demoGoal.relatedTasks) {
      const task = await ctx.db.get(taskId);
      if (task) {
        const currentGoals = task.goalIds || [];
        await ctx.db.patch(taskId, {
          goalIds: [...currentGoals, goalId],
        });
      }
    }

    createdGoals.push(goalId);
  }

  return { created: createdGoals.length, goalIds: createdGoals };
});

/**
 * CLEANUP: Archive recently created demo goals
 * Only archives goals created within the last hour to avoid accidental deletion
 */
export const archiveDemoGoals = mutation(async (ctx) => {
  const goals = await ctx.db.query('goals').collect();
  const oneHourAgo = Date.now() - (60 * 60 * 1000);

  const demoGoals = goals.filter((g: any) => g.createdAt > oneHourAgo);

  for (const goal of demoGoals) {
    await ctx.db.patch(goal._id, {
      status: 'archived',
      updatedAt: Date.now(),
    });
  }

  return { archived: demoGoals.length };
});
