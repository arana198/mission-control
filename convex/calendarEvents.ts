/**
 * Calendar Events - Convex Functions
 * 
 * Manages merged timeline of human calendar + AI-scheduled tasks
 * Provides intelligent scheduling and conflict resolution
 */

import { mutation, query } from './_generated/server';
import { v as convexVal } from "convex/values";
import { Id } from './_generated/dataModel';

/**
 * GET events in time range (human + AI merged)
 */
export const getTimelineRange = query(async (ctx, args: {
  startTime: number;
  endTime: number;
}) => {
  const events = await ctx.db
    .query('calendarEvents')
    .filter((filterQuery) =>
      filterQuery.and(
        filterQuery.gte(filterQuery.field('startTime'), args.startTime),
        filterQuery.lte(filterQuery.field('endTime'), args.endTime)
      )
    )
    .collect();

  // Sort by start time and type (human first, then AI)
  return events.sort((a, b) => {
    if (a.startTime !== b.startTime) {
      return a.startTime - b.startTime;
    }
    // Human events before AI
    const typeOrder = { human: 0, ai_task: 1, ai_workflow: 2, bot_generated: 3 };
    return typeOrder[a.type as keyof typeof typeOrder] -
           typeOrder[b.type as keyof typeof typeOrder];
  });
});

/**
 * GET all events for a goal
 */
export const getByGoal = query(async (ctx, args: {
  goalId: Id<'goals'>;
}) => {
  const events = await ctx.db
    .query('calendarEvents')
    .collect();

  return events.filter(e => e.goalIds?.includes(args.goalId));
});

/**
 * CREATE human calendar event
 */
export const createHumanEvent = mutation(async (ctx, args: {
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  timezone: string;
  goalIds?: Id<'goals'>[];
  color?: string;
}) => {
  return await ctx.db.insert('calendarEvents', {
    title: args.title,
    description: args.description,
    startTime: args.startTime,
    endTime: args.endTime,
    timezone: args.timezone,
    type: 'human',
    goalIds: args.goalIds || [],
    color: args.color || '#3b82f6',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
});

/**
 * CREATE AI-scheduled task event
 * 
 * Called when a task is scheduled for a specific time
 */
export const scheduleTaskEvent = mutation(async (ctx, args: {
  taskId: Id<'tasks'>;
  startTime: number;
  durationHours: number;
  generatedBy: string;
  goalIds?: Id<'goals'>[];
}) => {
  const task = await ctx.db.get(args.taskId);
  if (!task) throw new Error('Task not found');

  const endTime = args.startTime + (args.durationHours * 60 * 60 * 1000);

  return await ctx.db.insert('calendarEvents', {
    title: task.title,
    description: task.description,
    startTime: args.startTime,
    endTime,
    timezone: 'Europe/London',
    type: 'ai_task',
    taskId: args.taskId,
    generatedBy: args.generatedBy,
    goalIds: args.goalIds || task.goalIds || [],
    color: '#8b5cf6', // Purple for AI tasks
    priority: task.priority === 'P0' ? 0 : task.priority === 'P1' ? 1 : 2,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
});

/**
 * FIND free time slots
 * 
 * Used by task scheduler to find available time
 */
export const findFreeSlots = query(async (ctx, args: {
  startDate: number;
  endDate: number;
  durationMinutes: number;
  preferBefore?: number;  // Prefer slots before this time (e.g., 14:00)
  preferAfter?: number;   // Prefer slots after this time
}) => {
  const allEvents = await ctx.db
    .query('calendarEvents')
    .filter((filterQuery) =>
      filterQuery.and(
        filterQuery.gte(filterQuery.field('startTime'), args.startDate),
        filterQuery.lte(filterQuery.field('startTime'), args.endDate)
      )
    )
    .collect();

  // Sort by start time
  allEvents.sort((a, b) => a.startTime - b.startTime);

  const slots: { startTime: number; endTime: number; score: number }[] = [];
  const durationMs = args.durationMinutes * 60 * 1000;

  // Slot 1: Before first event
  if (allEvents.length > 0) {
    const firstEvent = allEvents[0];
    if (firstEvent.startTime - args.startDate >= durationMs) {
      slots.push({
        startTime: args.startDate,
        endTime: args.startDate + durationMs,
        score: scoreSlot(args!, args.startDate),
      });
    }
  } else {
    // No events, whole range is free
    slots.push({
      startTime: args.startDate,
      endTime: args.startDate + durationMs,
      score: 100,
    });
    return slots.slice(0, 5);
  }

  // Slots between events
  for (let eventIndex = 0; eventIndex < allEvents.length - 1; eventIndex++) {
    const gapStart = allEvents[eventIndex].endTime;
    const gapEnd = allEvents[eventIndex + 1].startTime;

    if (gapEnd - gapStart >= durationMs) {
      slots.push({
        startTime: gapStart,
        endTime: gapStart + durationMs,
        score: scoreSlot(args!, gapStart),
      });
    }
  }

  // Slot after last event
  const lastEvent = allEvents[allEvents.length - 1];
  if (args.endDate - lastEvent.endTime >= durationMs) {
    slots.push({
      startTime: lastEvent.endTime,
      endTime: lastEvent.endTime + durationMs,
      score: scoreSlot(args!, lastEvent.endTime),
    });
  }

  // Sort by score (higher = better)
  return slots
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
});

/**
 * RESCHEDULE a task to a new time
 */
export const rescheduleTask = mutation(async (ctx, args: {
  taskId: Id<'tasks'>;
  newStartTime: number;
  reason?: string;
}) => {
  // Find existing calendar event for this task
  const existingEvent = await ctx.db
    .query('calendarEvents')
    .filter(q =>
      q.and(
        q.eq(q.field('taskId'), args.taskId),
        q.eq(q.field('type'), 'ai_task')
      )
    )
    .first();

  if (!existingEvent) {
    throw new Error('No scheduled event found for this task');
  }

  const duration = existingEvent.endTime - existingEvent.startTime;
  const newEndTime = args.newStartTime + duration;

  // Update event
  await ctx.db.patch(existingEvent._id, {
    startTime: args.newStartTime,
    endTime: newEndTime,
    updatedAt: Date.now(),
  });

  return existingEvent._id;
});

/**
 * MARK task as executed
 */
export const markTaskExecuted = mutation(async (ctx, args: {
  eventId: Id<'calendarEvents'>;
  executedAt: number;
}) => {
  await ctx.db.patch(args.eventId, {
    executedAt: args.executedAt,
    updatedAt: Date.now(),
  });
});

/**
 * UPDATE event (edit details)
 */
export const updateEvent = mutation(async (ctx, args: {
  id: Id<'calendarEvents'>;
  title?: string;
  description?: string;
  startTime?: number;
  endTime?: number;
  color?: string;
  goalIds?: Id<'goals'>[];
}) => {
  const updates: any = {
    updatedAt: Date.now(),
  };

  if (args.title) updates.title = args.title;
  if (args.description !== undefined) updates.description = args.description;
  if (args.startTime) updates.startTime = args.startTime;
  if (args.endTime) updates.endTime = args.endTime;
  if (args.color) updates.color = args.color;
  if (args.goalIds) updates.goalIds = args.goalIds;

  await ctx.db.patch(args.id, updates);
});

/**
 * DELETE event
 */
export const deleteEvent = mutation(async (ctx, args: {
  id: Id<'calendarEvents'>;
}) => {
  await ctx.db.delete(args.id);
});

/**
 * Helper: Score a time slot based on preferences
 */
function scoreSlot(
  args: any,
  startTime: number
): number {
  let score = 50; // Base score

  // Extract hour from timestamp
  const date = new Date(startTime);
  const hour = date.getHours();

  // Preference scoring
  if (args.preferBefore && hour < new Date(args.preferBefore).getHours()) {
    score += 30;
  }

  if (args.preferAfter && hour > new Date(args.preferAfter).getHours()) {
    score += 30;
  }

  // Business hours bonus (9-17)
  if (hour >= 9 && hour < 17) {
    score += 20;
  }

  // Avoid very early/late
  if (hour < 7 || hour > 21) {
    score -= 20;
  }

  return score;
}

/**
 * GET execution history for a task
 */
export const getExecutionHistory = query(async (ctx, args: {
  taskId: Id<'tasks'>;
}) => {
  return await ctx.db
    .query('calendarEvents')
    .filter(q =>
      q.and(
        q.eq(q.field('taskId'), args.taskId),
        q.eq(q.field('type'), 'ai_task')
      )
    )
    .collect();
});
