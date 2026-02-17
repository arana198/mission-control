/**
 * Business Domain Constants
 * Single source of truth for all enums and constants
 * Prevents magic strings and ensures type safety
 */

// Task status values
export const TASK_STATUS = {
  BACKLOG: "backlog",
  READY: "ready",
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  BLOCKED: "blocked",
  DONE: "done",
} as const;

export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];

// Task priority levels
export const TASK_PRIORITY = {
  P0: "P0",
  P1: "P1",
  P2: "P2",
  P3: "P3",
} as const;

export type TaskPriority = typeof TASK_PRIORITY[keyof typeof TASK_PRIORITY];

// Time estimate sizes
export const TIME_ESTIMATES = {
  XS: "XS", // < 1 hour
  S: "S",   // 1-2 hours
  M: "M",   // 2-4 hours
  L: "L",   // 4-8 hours
  XL: "XL", // > 8 hours
} as const;

export type TimeEstimate = typeof TIME_ESTIMATES[keyof typeof TIME_ESTIMATES];

// Activity types for audit trail
export const ACTIVITY_TYPE = {
  TASK_CREATED: "task_created",
  TASK_UPDATED: "task_updated",
  TASK_COMPLETED: "task_completed",
  TASK_BLOCKED: "task_blocked",
  TASK_ASSIGNED: "task_assigned",
  AGENT_CLAIMED: "agent_claimed",
  AGENT_STATUS_CHANGED: "agent_status_changed",
  COMMENT_ADDED: "comment_added",
  MENTION: "mention",
  EPIC_CREATED: "epic_created",
  EPIC_COMPLETED: "epic_completed",
  DEPENDENCY_ADDED: "dependency_added",
  DEPENDENCY_REMOVED: "dependency_removed",
} as const;

export type ActivityType = typeof ACTIVITY_TYPE[keyof typeof ACTIVITY_TYPE];

// Agent status values
export const AGENT_STATUS = {
  IDLE: "idle",
  ACTIVE: "active",
  BLOCKED: "blocked",
} as const;

export type AgentStatus = typeof AGENT_STATUS[keyof typeof AGENT_STATUS];

// Agent level/seniority
export const AGENT_LEVEL = {
  LEAD: "lead",
  SPECIALIST: "specialist",
  INTERN: "intern",
} as const;

export type AgentLevel = typeof AGENT_LEVEL[keyof typeof AGENT_LEVEL];

// Epic status
export const EPIC_STATUS = {
  PLANNING: "planning",
  ACTIVE: "active",
  COMPLETED: "completed",
} as const;

export type EpicStatus = typeof EPIC_STATUS[keyof typeof EPIC_STATUS];

// Notification types
export const NOTIFICATION_TYPE = {
  MENTION: "mention",
  ASSIGNMENT: "assignment",
  STATUS_CHANGE: "status_change",
  BLOCK: "block",
  DEPENDENCY_UNBLOCKED: "dependency_unblocked",
} as const;

export type NotificationType = typeof NOTIFICATION_TYPE[keyof typeof NOTIFICATION_TYPE];

// System message types
export const SYSTEM_MESSAGE_TYPE = {
  STATUS_CHANGE: "status_change",
  ASSIGNMENT: "assignment",
  DEPENDENCY_ADDED: "dependency_added",
  BLOCKER_ADDED: "blocker_added",
} as const;

export type SystemMessageType = typeof SYSTEM_MESSAGE_TYPE[keyof typeof SYSTEM_MESSAGE_TYPE];

// Color scheme for UI
export const AGENT_COLORS: Record<string, string> = {
  Jarvis: "bg-blue-500",
  Shuri: "bg-purple-500",
  Fury: "bg-red-500",
  Vision: "bg-yellow-500",
  Loki: "bg-green-500",
  Quill: "bg-orange-500",
  Wanda: "bg-pink-500",
  Pepper: "bg-cyan-500",
  Friday: "bg-indigo-500",
  Wong: "bg-slate-500",
};

// Time estimates for display
export const TIME_ESTIMATE_LABELS: Record<TimeEstimate, string> = {
  XS: "< 1h",
  S: "1-2h",
  M: "2-4h",
  L: "4-8h",
  XL: "> 8h",
};

// Priority colors for UI
export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  P0: "bg-red-500",
  P1: "bg-orange-500",
  P2: "bg-yellow-500",
  P3: "bg-green-500",
};

// Status colors for UI
export const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "bg-gray-500",
  ready: "bg-blue-500",
  in_progress: "bg-amber-500",
  review: "bg-purple-500",
  blocked: "bg-red-500",
  done: "bg-green-500",
};

// Validation constants
export const VALIDATION = {
  TASK_TITLE_MIN: 3,
  TASK_TITLE_MAX: 200,
  TASK_DESC_MIN: 10,
  TASK_DESC_MAX: 5000,
  COMMENT_MAX: 10000,
} as const;

// Timeouts and intervals (in ms)
export const TIMEOUTS = {
  TASK_EXECUTION: 300000, // 5 minutes
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  ACTIVITY_POLL: 5000, // 5 seconds
} as const;

// API response codes
export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  CONFLICT: "CONFLICT",
  CIRCULAR_DEPENDENCY: "CIRCULAR_DEPENDENCY",
  ASSIGNMENT_BLOCKED: "ASSIGNMENT_BLOCKED",
} as const;
