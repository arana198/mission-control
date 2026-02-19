/**
 * Agent API Validators
 * Zod schemas for all agent API route inputs
 * Pattern mirrors taskValidators.ts
 */

import { z } from "zod";
import { AGENT_STATUS, AGENT_LEVEL } from "@/lib/constants/business";

/**
 * VAL-01: Convex ID validator
 * Convex generates IDs in format: alphanumeric with hyphens (e.g., agent-123, task-456)
 */
const convexId = () =>
  z.string().regex(/^[a-z0-9-]+$/, "Invalid Convex ID format");

/**
 * Schema for agent registration
 * POST /api/agents/register
 */
export const RegisterAgentSchema = z.object({
  name: z
    .string()
    .min(2, "Agent name must be at least 2 characters")
    .max(50, "Agent name must not exceed 50 characters")
    .regex(
      /^[a-zA-Z][a-zA-Z0-9_-]*$/,
      "Agent name must start with a letter and contain only letters, numbers, underscores, or hyphens"
    ),
  role: z
    .string()
    .min(2, "Role must be at least 2 characters")
    .max(100, "Role must not exceed 100 characters"),
  level: z.enum([AGENT_LEVEL.LEAD, AGENT_LEVEL.SPECIALIST, AGENT_LEVEL.INTERN]),
  sessionKey: z.string().min(1, "Session key is required"),
  capabilities: z
    .array(z.string().min(1).max(100))
    .optional(),
  model: z.string().max(100).optional(),
  personality: z.string().max(2000).optional(),
  workspacePath: z.string().min(1, "Workspace path is required"),  // Agent's workspace directory path
});

export type RegisterAgentInput = z.infer<typeof RegisterAgentSchema>;

/**
 * Schema for agent polling
 * POST /api/agents/poll
 */
export const PollAgentSchema = z.object({
  agentId: convexId(),
  agentKey: z.string().min(1, "Agent API key is required"),
});

export type PollAgentInput = z.infer<typeof PollAgentSchema>;

/**
 * Schema for agent self-update
 * PUT /api/agents/{agentId}/update
 */
export const UpdateAgentSchema = z.object({
  agentId: convexId(),
  apiKey: z.string().min(1, "API key is required for authentication"),
  // Optional fields - agent can update any of these
  workspacePath: z.string().min(1, "Workspace path must not be empty").optional(),
  model: z.string().max(100).optional(),
  personality: z.string().max(2000).optional(),
  capabilities: z
    .array(z.string().min(1).max(100))
    .optional(),
});

export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;

/**
 * Schema for task completion
 * POST /api/agents/tasks/complete
 */
export const CompleteTaskSchema = z.object({
  agentId: convexId(),
  agentKey: z.string().min(1, "Agent API key is required"),
  taskId: convexId(),
  status: z
    .enum(["done", "review"])
    .optional()
    .default("done"),
  completionNotes: z.string().max(5000).optional(),
  timeSpent: z.number().positive("Time spent must be positive").optional(), // minutes
});

export type CompleteTaskInput = z.infer<typeof CompleteTaskSchema>;

/**
 * Schema for heartbeat
 * POST /api/agents/heartbeat
 */
export const HeartbeatSchema = z.object({
  agentId: convexId(),
  agentKey: z.string().min(1, "Agent API key is required"),
  currentTaskId: convexId().optional(),
  status: z
    .enum([AGENT_STATUS.IDLE, AGENT_STATUS.ACTIVE, AGENT_STATUS.BLOCKED])
    .optional(),
});

export type HeartbeatInput = z.infer<typeof HeartbeatSchema>;

/**
 * Validation helper — throws z.ZodError on failure
 * ZodError is handled by handleApiError() to return HTTP 400
 */
export function validateAgentInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  return schema.parse(data);
}
