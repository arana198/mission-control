/**
 * OpenAPI Schema Definitions
 *
 * Annotates existing Zod validators with OpenAPI metadata using zod-openapi v5.
 * Uses Zod's native .meta() method (no monkey-patching required in v5).
 *
 * This file is the single source of truth for both runtime validation and
 * API documentation. All schemas are imported from lib/validators/ and extended
 * with documentation metadata only — validation behavior is unchanged.
 *
 * Usage: Import annotated schemas in spec-generator.ts to build OpenAPI document.
 */

import "zod-openapi"; // Augments Zod's .meta() with OpenAPI-specific TypeScript types
import * as z from "zod";

// ---------------------------------------------------------------------------
// Shared primitive schemas (reusable across domains)
// ---------------------------------------------------------------------------

export const ConvexIdSchema = z.string().regex(/^[a-z0-9]+$/).meta({
  description: "Convex database document ID",
  example: "jd7x2k9mq3t4",
  id: "ConvexId",
});

// ---------------------------------------------------------------------------
// Error and common response schemas
// ---------------------------------------------------------------------------

export const ErrorDetailSchema = z.object({
  code: z.string().meta({
    description: "Machine-readable error code",
    example: "VALIDATION_ERROR",
  }),
  message: z.string().meta({
    description: "Human-readable error description",
    example: "Agent name must be at least 2 characters",
  }),
  details: z.unknown().optional().meta({
    description: "Optional structured error context (field-level validation errors, etc.)",
  }),
}).meta({ id: "ErrorDetail" });

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: ErrorDetailSchema,
  timestamp: z.number().optional().meta({
    description: "Unix timestamp in milliseconds",
    example: 1706313600000,
  }),
}).meta({
  id: "ErrorResponse",
  description: "Standard error response (Shape A)",
});

export const PaginationMetaSchema = z.object({
  limit: z.number().meta({
    description: "Maximum number of items returned",
    example: 50,
  }),
  offset: z.number().meta({
    description: "Number of items skipped",
    example: 0,
  }),
  hasMore: z.boolean().meta({
    description: "Whether there are more items beyond this page",
    example: false,
  }),
}).meta({
  id: "PaginationMeta",
  description: "Pagination metadata included in list responses",
});

// ---------------------------------------------------------------------------
// Agent domain schemas
// ---------------------------------------------------------------------------

export const RegisterAgentRequestSchema = z.object({
  name: z.string().min(2).max(50).meta({
    description: "Agent display name. Must start with a letter.",
    example: "Atlas",
  }),
  role: z.string().min(2).max(100).meta({
    description: "Agent role description",
    example: "Backend Engineer",
  }),
  level: z.enum(["lead", "specialist", "intern"]).meta({
    description: "Agent seniority level",
    example: "lead",
  }),
  sessionKey: z.string().min(1).meta({
    description: "Initial session key for authentication",
    example: "sk_abc123xyz",
  }),
  capabilities: z.array(z.string()).optional().meta({
    description: "List of capabilities this agent supports",
    example: ["typescript", "api-design", "testing"],
  }),
  model: z.string().max(100).optional().meta({
    description: "LLM model identifier",
    example: "claude-sonnet-4-5",
  }),
  personality: z.string().max(2000).optional().meta({
    description: "Agent personality prompt (up to 2000 characters)",
  }),
  workspacePath: z.string().min(1).meta({
    description: "Absolute path to the agent's workspace directory",
    example: "/Users/dev/.openclaw/workspaces/atlas",
  }),
}).meta({
  id: "RegisterAgentRequest",
  description: "Request body for agent registration (POST /api/agents)",
});

export const UpdateAgentRequestSchema = z.object({
  agentId: z.string().meta({
    description: "Convex ID of the agent to update",
    example: "jd7x2k9mq3t4",
  }),
  apiKey: z.string().min(1).meta({
    description: "Current API key for authentication (deprecated: prefer Authorization: Bearer header)",
    example: "sk_abc123xyz",
  }),
  workspacePath: z.string().min(1).optional().meta({
    description: "New workspace path",
    example: "/Users/dev/.openclaw/workspaces/atlas-v2",
  }),
  model: z.string().max(100).optional().meta({
    description: "Updated LLM model identifier",
    example: "claude-opus-4-5",
  }),
  personality: z.string().max(2000).optional().meta({
    description: "Updated personality prompt",
  }),
  capabilities: z.array(z.string()).optional().meta({
    description: "Updated capabilities list",
    example: ["typescript", "go", "api-design"],
  }),
}).meta({
  id: "UpdateAgentRequest",
  description: "Request body for agent self-update (PATCH /api/agents/{agentId})",
});

export const HeartbeatRequestSchema = z.object({
  agentId: z.string().meta({
    description: "Agent's Convex ID",
    example: "jd7x2k9mq3t4",
  }),
  agentKey: z.string().min(1).meta({
    description: "Agent API key for authentication (deprecated: prefer Authorization: Bearer header)",
    example: "sk_abc123xyz",
  }),
  currentTaskId: z.string().optional().meta({
    description: "ID of the task the agent is currently working on",
    example: "kt8p3m2nq1v5",
  }),
  status: z.enum(["idle", "active", "blocked"]).optional().meta({
    description: "Current agent status",
    example: "active",
  }),
}).meta({
  id: "HeartbeatRequest",
  description: "Request body for agent heartbeat (POST /api/agents/{agentId}/heartbeat)",
});

export const AgentPollRequestSchema = z.object({
  agentId: z.string().meta({
    description: "Agent's Convex ID",
    example: "jd7x2k9mq3t4",
  }),
  agentKey: z.string().min(1).meta({
    description: "Agent API key for authentication (deprecated: prefer Authorization: Bearer header)",
    example: "sk_abc123xyz",
  }),
}).meta({
  id: "AgentPollRequest",
  description: "Request body for agent polling (POST /api/agents/{agentId}/poll)",
});

export const RotateKeyRequestSchema = z.object({
  agentId: z.string().meta({
    description: "Agent's Convex ID",
    example: "jd7x2k9mq3t4",
  }),
  apiKey: z.string().min(1).meta({
    description: "Current API key (deprecated: prefer Authorization: Bearer header)",
    example: "sk_abc123xyz",
  }),
  reason: z.enum(["scheduled", "compromised", "deployment", "refresh"]).optional().meta({
    description: "Reason for rotation",
    example: "scheduled",
  }),
  gracePeriodSeconds: z.number().int().min(0).max(300).optional().meta({
    description: "Seconds the old key remains valid after rotation (0-300)",
    example: 30,
  }),
}).meta({
  id: "RotateKeyRequest",
  description: "Request body for API key rotation (POST /api/agents/{agentId}/rotate-key)",
});

export const AgentResponseSchema = z.object({
  id: z.string().meta({ description: "Agent Convex ID", example: "jd7x2k9mq3t4" }),
  name: z.string().meta({ description: "Agent display name", example: "Atlas" }),
  role: z.string().meta({ description: "Agent role", example: "Backend Engineer" }),
  level: z.string().meta({ description: "Agent seniority level", example: "lead" }),
  status: z.string().meta({ description: "Current agent status", example: "active" }),
  workspacePath: z.string().optional().meta({ description: "Agent workspace path" }),
  capabilities: z.array(z.string()).optional(),
  model: z.string().optional(),
  createdAt: z.number().optional().meta({ description: "Unix timestamp ms" }),
  lastActive: z.number().optional().meta({ description: "Unix timestamp ms" }),
}).meta({
  id: "AgentResponse",
  description: "Agent data object",
});

// ---------------------------------------------------------------------------
// Task domain schemas
// ---------------------------------------------------------------------------

export const AgentTaskListQuerySchema = z.object({
  agentKey: z.string().min(1).optional().meta({
    description: "Agent API key (deprecated: prefer Authorization: Bearer header)",
  }),
  status: z.enum(["backlog", "ready", "in_progress", "review", "blocked", "done"]).optional().meta({
    description: "Filter tasks by status",
    example: "in_progress",
  }),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional().meta({
    description: "Filter tasks by priority",
    example: "P1",
  }),
  assignedTo: z.literal("me").optional().meta({
    description: "Filter to tasks assigned to the requesting agent",
  }),
  limit: z.number().positive().max(100).optional().meta({
    description: "Maximum number of tasks to return (default: 50, max: 100)",
    example: 50,
  }),
  offset: z.number().nonnegative().optional().meta({
    description: "Number of tasks to skip for pagination",
    example: 0,
  }),
}).meta({
  id: "AgentTaskListQuery",
  description: "Query parameters for listing agent tasks (GET /api/agents/{agentId}/tasks)",
});

export const TaskUpdateRequestSchema = z.object({
  action: z.enum(["assign", "complete", "update-status", "update-tags", "escalate", "reassign", "unblock", "mark-executed"]).meta({
    description: "Action discriminator — determines which operation to perform",
    example: "complete",
  }),
  agentKey: z.string().optional().meta({
    description: "Agent API key (required for agent-initiated actions: assign, complete, update-status, update-tags)",
  }),
  // Fields used by assign action
  assigneeIds: z.array(z.string()).optional().meta({
    description: "Target agent IDs (required for action: assign)",
    example: ["jd7x2k9mq3t4", "kt8p3m2nq1v5"],
  }),
  // Fields used by complete action
  completionNotes: z.string().optional(),
  timeSpent: z.number().optional(),
  // Fields used by update-status action
  status: z.enum(["backlog", "ready", "in_progress", "review", "blocked", "done"]).optional(),
  // Fields used by update-tags action
  tags: z.array(z.string()).optional(),
  // Fields used by state-engine actions (escalate/reassign/unblock/mark-executed)
  decidedBy: z.string().optional().meta({
    description: "Decision maker identifier (required for state-engine actions — no auth required)",
    example: "state-engine-v2",
  }),
}).meta({
  id: "TaskUpdateRequest",
  description: "Request body for task operations (PATCH /api/tasks/{taskId}). Uses action discriminator pattern. Note: escalate, reassign, unblock, mark-executed actions currently have no auth guard.",
});

export const AddCommentRequestSchema = z.object({
  agentId: z.string().meta({
    description: "Agent's Convex ID",
    example: "jd7x2k9mq3t4",
  }),
  agentKey: z.string().min(1).meta({
    description: "Agent API key (deprecated: prefer Authorization: Bearer header)",
    example: "sk_abc123xyz",
  }),
  taskId: z.string(),
  content: z.string().min(1).max(5000).meta({
    description: "Comment text (1-5000 characters)",
    example: "Completed the API integration. All tests pass.",
  }),
  mentions: z.array(z.string()).optional().meta({
    description: "Agent IDs to mention in the comment",
    example: [],
  }),
}).meta({
  id: "AddCommentRequest",
  description: "Request body for adding a comment to a task",
});

export const TaskResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
  priority: z.string(),
  assigneeIds: z.array(z.string()),
  tags: z.array(z.string()),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
  epicId: z.string().optional(),
}).meta({
  id: "TaskResponse",
  description: "Task data object",
});

// ---------------------------------------------------------------------------
// Calendar domain schemas
// ---------------------------------------------------------------------------

export const CreateCalendarEventRequestSchema = z.object({
  agentId: z.string().meta({
    description: "Agent's Convex ID",
    example: "jd7x2k9mq3t4",
  }),
  agentKey: z.string().min(1).meta({
    description: "Agent API key (deprecated: prefer Authorization: Bearer header)",
    example: "sk_abc123xyz",
  }),
  taskId: z.string().meta({
    description: "Convex ID of the associated task",
    example: "kt8p3m2nq1v5",
  }),
  scheduledFor: z.number().meta({
    description: "Unix timestamp for scheduled execution",
    example: 1706313600000,
  }),
  estimatedDuration: z.number().optional().meta({
    description: "Estimated duration in minutes",
    example: 60,
  }),
  notes: z.string().optional(),
}).meta({
  id: "CreateCalendarEventRequest",
  description: "Request body for creating a calendar event",
});

export const UpdateCalendarEventRequestSchema = z.object({
  agentId: z.string().meta({
    description: "Agent's Convex ID",
    example: "jd7x2k9mq3t4",
  }),
  agentKey: z.string().min(1).meta({
    description: "Agent API key (deprecated: prefer Authorization: Bearer header)",
    example: "sk_abc123xyz",
  }),
  executedAt: z.number().meta({
    description: "Unix timestamp when the event was actually executed",
    example: 1706313700000,
  }),
  notes: z.string().optional(),
}).meta({
  id: "UpdateCalendarEventRequest",
  description: "Request body for marking a calendar event as executed (PUT /api/calendar/events/{eventId})",
});

export const CalendarEventResponseSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  agentId: z.string(),
  scheduledFor: z.number(),
  estimatedDuration: z.number().optional(),
  executedAt: z.number().optional(),
  notes: z.string().optional(),
  createdAt: z.number(),
}).meta({
  id: "CalendarEventResponse",
  description: "Calendar event data object",
});

// ---------------------------------------------------------------------------
// Business (workspace) domain schemas
// ---------------------------------------------------------------------------

export const CreateBusinessRequestSchema = z.object({
  name: z.string().min(1).meta({
    description: "Business/workspace display name",
    example: "OpenClaw Labs",
  }),
  slug: z.string().min(1).meta({
    description: "URL-safe identifier",
    example: "openclaw-labs",
  }),
  missionStatement: z.string().optional().meta({
    description: "Brief mission statement",
    example: "Building the future of autonomous AI agents",
  }),
}).meta({
  id: "CreateBusinessRequest",
  description: "Request body for creating a business/workspace (POST /api/businesses)",
});

export const BusinessResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  missionStatement: z.string().optional(),
  createdAt: z.number(),
}).meta({
  id: "BusinessResponse",
  description: "Business/workspace data object",
});

// ---------------------------------------------------------------------------
// Gateway domain schemas
// ---------------------------------------------------------------------------

export const GatewayProvisionRequestSchema = z.object({
  agent: z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
  }).meta({ description: "Agent metadata to provision" }),
  workspace: z.object({
    id: z.string(),
    path: z.string(),
  }).meta({ description: "Workspace configuration" }),
  baseUrl: z.string().meta({
    description: "Base URL for callback",
    example: "http://localhost:3000",
  }),
}).meta({
  id: "GatewayProvisionRequest",
  description: "Request body for provisioning an agent via gateway (POST /api/gateway/{gatewayId}?action=provision)",
});

export const GatewaySendMessageRequestSchema = z.object({
  sessionKey: z.string().meta({
    description: "Active session key",
    example: "sess_abc123",
  }),
  content: z.string().min(1).meta({
    description: "Message content to send",
    example: "What is the current task status?",
  }),
}).meta({
  id: "GatewaySendMessageRequest",
  description: "Request body for sending a message via gateway (POST /api/gateway/{gatewayId}?action=message)",
});

export const GatewayValidateRequestSchema = z.object({
  url: z.string().meta({
    description: "WebSocket URL to validate",
    example: "ws://localhost:8080",
  }),
}).meta({
  id: "GatewayValidateRequest",
  description: "Request body for validating a gateway WebSocket connection",
});

export const GatewayStatusResponseSchema = z.object({
  gatewayId: z.string(),
  status: z.enum(["healthy", "degraded", "down"]),
  lastPingedAt: z.number().optional(),
  sessionCount: z.number().optional(),
}).meta({
  id: "GatewayStatusResponse",
  description: "Gateway health status",
});

// ---------------------------------------------------------------------------
// Admin domain schemas
// ---------------------------------------------------------------------------

export const SetupWorkspaceRequestSchema = z.object({
  agentName: z.string().meta({
    description: "Agent name to set workspace for",
    example: "Atlas",
  }),
  workspacePath: z.string().meta({
    description: "Absolute path to the agent's workspace directory",
    example: "/Users/dev/.openclaw/workspaces/atlas",
  }),
}).meta({
  id: "SetupWorkspaceRequest",
  description: "Request body for admin workspace setup (POST /api/admin/agents/setup-workspace). WARNING: No auth guard — critical security gap.",
});

export const MigrateWorkspacePathsRequestSchema = z.object({
  defaultWorkspacePath: z.string().optional().meta({
    description: "Default workspace path to assign to agents without one",
    example: "/Users/dev/.openclaw/workspaces",
  }),
}).meta({
  id: "MigrateWorkspacePathsRequest",
  description: "Request body for workspace path migration (POST /api/admin/migrations/agent-workspace-paths). WARNING: No auth guard — exposes database migration endpoint publicly.",
});

// ---------------------------------------------------------------------------
// State Engine domain schemas
// ---------------------------------------------------------------------------

export const StateEngineMetricsResponseSchema = z.object({
  workspaceId: z.string(),
  decisions: z.number(),
  escalations: z.number(),
  completions: z.number(),
  avgDecisionTimeMs: z.number().optional(),
}).meta({
  id: "StateEngineMetricsResponse",
  description: "State engine performance metrics",
});

export const StateEngineDecisionsResponseSchema = z.object({
  workspaceId: z.string(),
  decisions: z.array(z.unknown()),
  patterns: z.array(z.unknown()),
  count: z.number(),
}).meta({
  id: "StateEngineDecisionsResponse",
  description: "State engine decisions and patterns",
});

export const StateEngineAlertsResponseSchema = z.object({
  workspaceId: z.string(),
  rules: z.array(z.unknown()),
  count: z.number(),
}).meta({
  id: "StateEngineAlertsResponse",
  description: "State engine alert rules",
});

// ---------------------------------------------------------------------------
// Memory domain schemas (development-only)
// ---------------------------------------------------------------------------

export const MemoryFileSchema = z.object({
  name: z.string(),
  path: z.string(),
  size: z.number().optional(),
  modified: z.number().optional(),
}).meta({
  id: "MemoryFile",
  description: "Memory file metadata",
});

export const MemoryFileListResponseSchema = z.object({
  files: z.array(MemoryFileSchema),
}).meta({
  id: "MemoryFileListResponse",
  description: "List of memory files. Development-only endpoint — reads from local ~/.openclaw/workspace/memory filesystem.",
});

// ---------------------------------------------------------------------------
// Reports domain schemas
// ---------------------------------------------------------------------------

export const GenerateReportRequestSchema = z.object({
  workspaceId: z.string().meta({
    description: "Workspace ID for the report",
    example: "jd7x2k9mq3t4",
  }),
  type: z.enum(["weekly", "sprint", "custom"]).optional().meta({
    description: "Report type",
    example: "weekly",
  }),
}).meta({
  id: "GenerateReportRequest",
  description: "Request body for generating a report (POST /api/reports)",
});

// ---------------------------------------------------------------------------
// Epics domain schemas
// ---------------------------------------------------------------------------

export const EpicResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
  workspaceId: z.string(),
  taskIds: z.array(z.string()),
  createdAt: z.number(),
}).meta({
  id: "EpicResponse",
  description: "Epic data object",
});

// ---------------------------------------------------------------------------
// Health domain schemas
// ---------------------------------------------------------------------------

export const HealthResponseSchema = z.object({
  status: z.enum(["healthy", "unhealthy"]),
  timestamp: z.string(),
  uptime: z.number(),
  environment: z.string(),
  version: z.string(),
}).meta({
  id: "HealthResponse",
  description: "Health check response (GET /api/health). Note: does not use standard success wrapper.",
});

// ---------------------------------------------------------------------------
// Wiki domain schemas
// ---------------------------------------------------------------------------

export const WikiPageRequestSchema = z.object({
  title: z.string().min(1).max(200).meta({
    description: "Wiki page title",
    example: "Architecture Overview",
  }),
  content: z.string().optional().meta({
    description: "Wiki page content (Markdown)",
  }),
}).meta({
  id: "WikiPageRequest",
  description: "Request body for creating/updating a wiki page",
});

export const WikiPageResponseSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  title: z.string(),
  content: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
}).meta({
  id: "WikiPageResponse",
  description: "Wiki page data object",
});

// ---------------------------------------------------------------------------
// Task Execution domain schemas
// ---------------------------------------------------------------------------

export const ExecuteTaskRequestSchema = z.object({
  taskId: z.string().meta({
    description: "Convex ID of the task to execute",
    example: "kt8p3m2nq1v5",
  }),
  taskTitle: z.string().meta({
    description: "Task title (used to construct execution prompt)",
    example: "Implement OAuth2 authentication",
  }),
  taskDescription: z.string().optional().meta({
    description: "Task description",
  }),
}).meta({
  id: "ExecuteTaskRequest",
  description: "Request body for task execution (POST /api/tasks/execute). Note: Partially mocked — HTTP dispatch is disabled. Verb in URL is a known anti-pattern (see REFACTORING-ROADMAP.md B-03).",
});

export const GenerateDailyTasksRequestSchema = z.object({
  workspaceId: z.string().meta({
    description: "Workspace ID for daily task generation",
    example: "jd7x2k9mq3t4",
  }),
}).meta({
  id: "GenerateDailyTasksRequest",
  description: "Request body for generating daily tasks (POST /api/tasks/generate-daily). Verb in URL is a known anti-pattern (see REFACTORING-ROADMAP.md B-03).",
});
