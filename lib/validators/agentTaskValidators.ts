/**
 * Agent Task Operation Validators
 * Zod schemas for agent task manipulation endpoints
 */

import { z } from "zod";
import { TASK_STATUS, TASK_PRIORITY } from "@/lib/constants/business";

const convexId = () =>
  z.string().regex(/^[a-z0-9]+$/, "Invalid Convex ID format");

/**
 * Schema for adding comment to task
 * POST /api/agents/tasks/{taskId}/comment
 */
export const AddCommentSchema = z.object({
  agentId: convexId(),
  agentKey: z.string().min(1),
  taskId: convexId(),
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(5000, "Comment must not exceed 5000 characters"),
  mentions: z
    .array(convexId())
    .optional()
    .default([]),
});

export type AddCommentInput = z.infer<typeof AddCommentSchema>;

/**
 * Schema for updating task status
 * POST /api/agents/tasks/{taskId}/status
 */
export const UpdateTaskStatusSchema = z.object({
  agentId: convexId(),
  agentKey: z.string().min(1),
  taskId: convexId(),
  status: z.enum([
    TASK_STATUS.BACKLOG,
    TASK_STATUS.READY,
    TASK_STATUS.IN_PROGRESS,
    TASK_STATUS.REVIEW,
    TASK_STATUS.BLOCKED,
    TASK_STATUS.DONE,
  ]),
});

export type UpdateTaskStatusInput = z.infer<typeof UpdateTaskStatusSchema>;

/**
 * Schema for tagging/untagging task
 * POST /api/agents/tasks/{taskId}/tag
 */
export const TagTaskSchema = z.object({
  agentId: convexId(),
  agentKey: z.string().min(1),
  taskId: convexId(),
  tags: z
    .array(z.string().min(1).max(50))
    .min(1, "Must provide at least one tag"),
  action: z.enum(["add", "remove"]),
});

export type TagTaskInput = z.infer<typeof TagTaskSchema>;

/**
 * Schema for querying tasks with filters
 * GET /api/agents/tasks?...
 */
export const QueryTasksSchema = z.object({
  agentId: convexId(),
  agentKey: z.string().min(1),
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
  assignedTo: z.literal("me").optional(),
  limit: z.coerce.number().positive().max(100).optional().default(50),
  offset: z.coerce.number().nonnegative().optional().default(0),
});

export type QueryTasksInput = z.infer<typeof QueryTasksSchema>;

/**
 * Schema for getting task details
 * GET /api/agents/tasks/{taskId}
 */
export const GetTaskDetailsSchema = z.object({
  agentId: convexId(),
  agentKey: z.string().min(1),
  taskId: convexId(),
});

export type GetTaskDetailsInput = z.infer<typeof GetTaskDetailsSchema>;

/**
 * Schema for assigning task to agents
 * POST /api/agents/tasks/{taskId}/assign
 */
export const AssignTaskSchema = z.object({
  agentId: convexId(),
  agentKey: z.string().min(1),
  taskId: convexId(),
  assigneeIds: z
    .array(convexId())
    .min(1, "Must assign to at least one agent")
    .max(10, "Cannot assign to more than 10 agents"),
});

export type AssignTaskInput = z.infer<typeof AssignTaskSchema>;

/**
 * Schema for updating task metadata
 * POST /api/agents/tasks/{taskId}/update
 */
export const UpdateTaskMetadataSchema = z.object({
  agentId: convexId(),
  agentKey: z.string().min(1),
  taskId: convexId(),
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must not exceed 200 characters")
    .optional(),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(5000, "Description must not exceed 5000 characters")
    .optional(),
  priority: z
    .enum([TASK_PRIORITY.P0, TASK_PRIORITY.P1, TASK_PRIORITY.P2, TASK_PRIORITY.P3])
    .optional(),
  dueDate: z.number().positive().optional(),
});

export type UpdateTaskMetadataInput = z.infer<typeof UpdateTaskMetadataSchema>;

/**
 * Validation helper
 */
export function validateAgentTaskInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  return schema.parse(data);
}
