/**
 * Task Validators
 * Zod schemas for all task-related inputs
 * Ensures type safety and validation at the boundary
 */

import { z } from "zod";
import { TASK_PRIORITY, TASK_STATUS, TIME_ESTIMATES, VALIDATION } from "../constants/business";

/**
 * VAL-01: Convex ID validator
 * Convex generates IDs in format: alphanumeric strings like j97abc123def456
 */
const convexId = () => z.string().regex(/^[a-z0-9]+$/, "Invalid Convex ID format");

/**
 * Schema for creating a new task
 */
export const CreateTaskSchema = z.object({
  title: z
    .string()
    .min(VALIDATION.TASK_TITLE_MIN, `Title must be at least ${VALIDATION.TASK_TITLE_MIN} characters`)
    .max(VALIDATION.TASK_TITLE_MAX, `Title must not exceed ${VALIDATION.TASK_TITLE_MAX} characters`)
    .trim(),

  description: z
    .string()
    .min(VALIDATION.TASK_DESC_MIN, `Description must be at least ${VALIDATION.TASK_DESC_MIN} characters`)
    .max(VALIDATION.TASK_DESC_MAX, `Description must not exceed ${VALIDATION.TASK_DESC_MAX} characters`)
    .trim(),

  priority: z
    .enum([TASK_PRIORITY.P0, TASK_PRIORITY.P1, TASK_PRIORITY.P2, TASK_PRIORITY.P3])
    .default(TASK_PRIORITY.P2)
    .optional(),

  assigneeIds: z
    .array(convexId())
    .optional()
    .default([]),

  dueDate: z
    .number()
    .positive("Due date must be in the future")
    .optional(),

  epicId: convexId(),  // REQUIRED: all tasks must belong to an epic

  timeEstimate: z
    .enum([
      TIME_ESTIMATES.XS,
      TIME_ESTIMATES.S,
      TIME_ESTIMATES.M,
      TIME_ESTIMATES.L,
      TIME_ESTIMATES.XL,
    ])
    .optional(),

  tags: z
    .array(z.string().min(1).max(50))
    .optional()
    .default([]),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

/**
 * Schema for updating a task
 */
export const UpdateTaskSchema = z.object({
  taskId: convexId(),

  title: z
    .string()
    .min(VALIDATION.TASK_TITLE_MIN)
    .max(VALIDATION.TASK_TITLE_MAX)
    .trim()
    .optional(),

  description: z
    .string()
    .min(VALIDATION.TASK_DESC_MIN)
    .max(VALIDATION.TASK_DESC_MAX)
    .trim()
    .optional(),

  status: z
    .enum([
      TASK_STATUS.BACKLOG,
      TASK_STATUS.READY,
      TASK_STATUS.IN_PROGRESS,
      TASK_STATUS.REVIEW,
      TASK_STATUS.BLOCKED,
      TASK_STATUS.DONE,
    ])
    .optional(),

  priority: z
    .enum([TASK_PRIORITY.P0, TASK_PRIORITY.P1, TASK_PRIORITY.P2, TASK_PRIORITY.P3])
    .optional(),

  assigneeIds: z
    .array(convexId())
    .optional(),

  dueDate: z
    .number()
    .positive()
    .optional(),

  timeEstimate: z
    .enum([
      TIME_ESTIMATES.XS,
      TIME_ESTIMATES.S,
      TIME_ESTIMATES.M,
      TIME_ESTIMATES.L,
      TIME_ESTIMATES.XL,
    ])
    .optional(),

  epicId: convexId().optional(),  // Allow moving task to different epic
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

/**
 * Schema for assigning tasks to agents
 */
export const AssignTaskSchema = z.object({
  taskId: convexId(),

  assigneeIds: z
    .array(convexId())
    .min(1, "Must assign to at least one agent")
    .max(10, "Cannot assign to more than 10 agents"),

  assignedBy: z.union([convexId(), z.literal("user")]),
});

export type AssignTaskInput = z.infer<typeof AssignTaskSchema>;

/**
 * Schema for updating task status
 */
export const UpdateTaskStatusSchema = z.object({
  taskId: convexId(),

  status: z.enum([
    TASK_STATUS.BACKLOG,
    TASK_STATUS.READY,
    TASK_STATUS.IN_PROGRESS,
    TASK_STATUS.REVIEW,
    TASK_STATUS.BLOCKED,
    TASK_STATUS.DONE,
  ]),

  receipts: z
    .array(z.string())
    .optional(),

  updatedBy: z
    .string()
    .optional(),
});

export type UpdateTaskStatusInput = z.infer<typeof UpdateTaskStatusSchema>;

/**
 * Schema for creating comments
 */
export const CreateCommentSchema = z.object({
  taskId: convexId(),

  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(VALIDATION.COMMENT_MAX, `Comment must not exceed ${VALIDATION.COMMENT_MAX} characters`)
    .trim(),

  senderId: z.string(),

  senderName: z.string().min(1),

  mentions: z
    .array(convexId())
    .optional()
    .default([]),
});

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

/**
 * Schema for adding task dependencies
 */
export const AddDependencySchema = z.object({
  taskId: convexId(),
  blockedByTaskId: convexId(),
  addedBy: z.union([convexId(), z.literal("user")]),
}).refine(
  (data) => data.taskId !== data.blockedByTaskId,
  {
    message: "A task cannot block itself",
    path: ["blockedByTaskId"],
  }
);

export type AddDependencyInput = z.infer<typeof AddDependencySchema>;

/**
 * Validation helper - returns errors as structured object or throws
 */
export function validateTaskInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new ValidationError(
      "Invalid input",
      result.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }))
    );
  }

  return result.data;
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = "ValidationError";
  }
}
