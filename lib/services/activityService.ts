/**
 * Activity Service
 * Centralized logging for all activities
 * Prevents duplication and ensures consistency
 */

import { ACTIVITY_TYPE, type ActivityType } from "@/lib/constants/business";

export interface ActivityLogPayload {
  taskId?: any;
  epicId?: any;
  messageId?: any;
  message: string;
  oldValue?: any;
  newValue?: any;
}

/**
 * Log an activity to the audit trail
 * Automatically fetches denormalized data (agentName, taskTitle, etc.)
 */
export async function logActivity(
  ctx: any,
  type: ActivityType,
  agentId: string,
  payload: ActivityLogPayload
) {
  let agentName = "Unknown";
  let taskTitle: string | undefined;
  let epicTitle: string | undefined;

  // Fetch denormalized data
  if (agentId && agentId !== "system") {
    try {
      const agent = await ctx.db.get(agentId);
      agentName = agent?.name || "Unknown";
    } catch (e) {
      console.error(`[ActivityService] Failed to fetch agent ${agentId}:`, e);
    }
  }

  if (payload.taskId) {
    try {
      const task = await ctx.db.get(payload.taskId);
      taskTitle = task?.title;
    } catch (e) {
      console.error(
        `[ActivityService] Failed to fetch task ${payload.taskId}:`,
        e
      );
    }
  }

  if (payload.epicId) {
    try {
      const epic = await ctx.db.get(payload.epicId);
      epicTitle = epic?.title;
    } catch (e) {
      console.error(
        `[ActivityService] Failed to fetch epic ${payload.epicId}:`,
        e
      );
    }
  }

  return ctx.db.insert("activities", {
    type,
    agentId,
    agentName,
    taskTitle,
    epicTitle,
    ...payload,
    createdAt: Date.now(),
  });
}

/**
 * Shortcut: Log task creation
 */
export async function logTaskCreated(
  ctx: any,
  taskId: any,
  title: string,
  createdBy: string
) {
  return logActivity(ctx, ACTIVITY_TYPE.TASK_CREATED, createdBy, {
    taskId,
    message: `Created task: ${title}`,
  });
}

/**
 * Shortcut: Log task completion
 */
export async function logTaskCompleted(
  ctx: any,
  taskId: any,
  title: string,
  completedBy: string
) {
  return logActivity(ctx, ACTIVITY_TYPE.TASK_COMPLETED, completedBy, {
    taskId,
    message: `Completed task: ${title}`,
  });
}

/**
 * Shortcut: Log task assignment
 */
export async function logTaskAssigned(
  ctx: any,
  taskId: any,
  title: string,
  assigneeNames: string[],
  assignedBy: string
) {
  return logActivity(ctx, ACTIVITY_TYPE.TASK_ASSIGNED, assignedBy, {
    taskId,
    message: `Assigned "${title}" to ${assigneeNames.join(", ")}`,
  });
}

/**
 * Shortcut: Log task status change
 */
export async function logTaskStatusChanged(
  ctx: any,
  taskId: any,
  title: string,
  oldStatus: string,
  newStatus: string,
  changedBy: string
) {
  return logActivity(ctx, ACTIVITY_TYPE.TASK_UPDATED, changedBy, {
    taskId,
    message: `Task "${title}" moved from ${oldStatus} to ${newStatus}`,
    oldValue: oldStatus,
    newValue: newStatus,
  });
}

/**
 * Shortcut: Log task blocking
 */
export async function logTaskBlocked(
  ctx: any,
  taskId: any,
  title: string,
  reason: string,
  blockedBy: string
) {
  return logActivity(ctx, ACTIVITY_TYPE.TASK_BLOCKED, blockedBy, {
    taskId,
    message: `Task "${title}" blocked: ${reason}`,
  });
}

/**
 * Shortcut: Log agent status change
 */
export async function logAgentStatusChanged(
  ctx: any,
  agentId: string,
  oldStatus: string,
  newStatus: string
) {
  return logActivity(ctx, ACTIVITY_TYPE.AGENT_STATUS_CHANGED, agentId, {
    message: `Status changed from ${oldStatus} to ${newStatus}`,
    oldValue: oldStatus,
    newValue: newStatus,
  });
}

/**
 * Shortcut: Log epic creation
 */
export async function logEpicCreated(
  ctx: any,
  epicId: any,
  title: string,
  createdBy: string
) {
  return logActivity(ctx, ACTIVITY_TYPE.EPIC_CREATED, createdBy, {
    epicId,
    message: `Created epic: ${title}`,
  });
}

/**
 * Shortcut: Log dependency added
 */
export async function logDependencyAdded(
  ctx: any,
  taskId: any,
  taskTitle: string,
  dependencyTitle: string,
  addedBy: string
) {
  return logActivity(ctx, ACTIVITY_TYPE.DEPENDENCY_ADDED, addedBy, {
    taskId,
    message: `Added dependency: "${taskTitle}" blocked by "${dependencyTitle}"`,
  });
}

/**
 * Shortcut: Log comment added
 */
export async function logCommentAdded(
  ctx: any,
  taskId: any,
  taskTitle: string,
  authorName: string
) {
  return logActivity(ctx, ACTIVITY_TYPE.COMMENT_ADDED, authorName, {
    taskId,
    message: `Commented on task: "${taskTitle}"`,
  });
}

/**
 * Shortcut: Log mention
 */
export async function logMention(
  ctx: any,
  taskId: any,
  taskTitle: string,
  mentionedName: string,
  mentionedBy: string
) {
  return logActivity(ctx, ACTIVITY_TYPE.MENTION, mentionedBy, {
    taskId,
    message: `@${mentionedName} mentioned in "${taskTitle}"`,
  });
}
