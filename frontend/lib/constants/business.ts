/**
 * Frontend Business Constants
 * Subset of backend constants needed by frontend API routes
 * Prevents cross-package dependencies while maintaining consistency
 * NOTE: MUST match backend/lib/constants/business.ts values exactly
 */

// Task status values - MUST match backend
export const TASK_STATUS = {
  BACKLOG: 'backlog',
  READY: 'ready',
  IN_PROGRESS: 'in_progress',
  REVIEW: 'review',
  BLOCKED: 'blocked',
  DONE: 'done',
} as const;

export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];

// Task priority levels - MUST match backend
export const TASK_PRIORITY = {
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
} as const;

export type TaskPriority = typeof TASK_PRIORITY[keyof typeof TASK_PRIORITY];

// API response codes - MUST match backend/lib/constants/business.ts ERROR_CODES
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFLICT: 'CONFLICT',
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
  ASSIGNMENT_BLOCKED: 'ASSIGNMENT_BLOCKED',
} as const;
