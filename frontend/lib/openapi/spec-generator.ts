/**
 * OpenAPI 3.0 Spec Generator (zod-openapi v5)
 *
 * Generates a complete OpenAPI 3.0 document from Zod schemas annotated in schemas.ts.
 * This is the code-first replacement for lib/openapi-generator.ts.
 *
 * Replaces lib/openapi-generator.ts — see REFACTORING-ROADMAP.md for migration plan.
 *
 * The existing lib/openapi-generator.ts is NOT deleted by this plan; it remains as-is
 * until Phase 1.1 is complete and this generator is validated against it.
 *
 * Usage:
 *   import { generateOpenAPISpec } from "@/lib/openapi/spec-generator";
 *   const spec = generateOpenAPISpec();
 *
 * The spec can be wired to the /api/openapi route to replace the old generator.
 */

import "zod-openapi"; // Augments Zod's .meta() with OpenAPI TypeScript types
import { createDocument } from "zod-openapi";
import * as z from "zod";

import {
  RegisterAgentRequestSchema,
  UpdateAgentRequestSchema,
  HeartbeatRequestSchema,
  AgentPollRequestSchema,
  RotateKeyRequestSchema,
  AgentResponseSchema,
  AgentTaskListQuerySchema,
  TaskUpdateRequestSchema,
  AddCommentRequestSchema,
  TaskResponseSchema,
  CreateCalendarEventRequestSchema,
  UpdateCalendarEventRequestSchema,
  CalendarEventResponseSchema,
  CreateBusinessRequestSchema,
  BusinessResponseSchema,
  GatewayProvisionRequestSchema,
  GatewaySendMessageRequestSchema,
  GatewayValidateRequestSchema,
  GatewayStatusResponseSchema,
  SetupWorkspaceRequestSchema,
  MigrateWorkspacePathsRequestSchema,
  StateEngineMetricsResponseSchema,
  StateEngineDecisionsResponseSchema,
  StateEngineAlertsResponseSchema,
  MemoryFileListResponseSchema,
  GenerateReportRequestSchema,
  EpicResponseSchema,
  HealthResponseSchema,
  WikiPageRequestSchema,
  WikiPageResponseSchema,
  ExecuteTaskRequestSchema,
  GenerateDailyTasksRequestSchema,
  ErrorResponseSchema,
  PaginationMetaSchema,
} from "./schemas";

// ---------------------------------------------------------------------------
// Shared response definitions (reused across multiple operations)
// ---------------------------------------------------------------------------

const bearerSecurityRequirement = [{ BearerAuth: [] }];

/** Builds a standard 200/201 JSON response definition with an inline schema */
function jsonResponse(description: string, schema: z.ZodType) {
  return {
    description,
    content: {
      "application/json": { schema },
    },
  };
}

/** Standard error response definitions for common HTTP status codes */
const standardErrorResponses = {
  "400": jsonResponse("Validation error — request body or query params failed validation", ErrorResponseSchema),
  "401": jsonResponse("Unauthorized — invalid or missing agent key", ErrorResponseSchema),
  "404": jsonResponse("Not found — resource does not exist", ErrorResponseSchema),
  "500": jsonResponse("Internal server error", ErrorResponseSchema),
};

const serverErrorOnly = {
  "400": jsonResponse("Bad request — missing required parameters", ErrorResponseSchema),
  "500": jsonResponse("Internal server error", ErrorResponseSchema),
};

// ---------------------------------------------------------------------------
// Main spec generator
// ---------------------------------------------------------------------------

/**
 * Generates the OpenAPI 3.0 specification document for Mission Control API.
 *
 * The document is built from Zod schemas annotated with .meta() in schemas.ts.
 * All 42 HTTP operations across 11 domains are registered.
 *
 * @returns OpenAPI 3.0 document as a plain JavaScript object
 */
export function generateOpenAPISpec() {
  return createDocument({
    openapi: "3.0.0",
    info: {
      title: "Mission Control API",
      version: "1.0.0",
      description: `
Mission Control REST API — Agent governance, task management, and execution tracking.

**Authentication:** Most agent endpoints use \`Authorization: Bearer <agentKey>\` per RFC 6750.
Some legacy endpoints accept \`agentKey\` in query params or request body — these are deprecated
and will be removed in Phase 1.2 (see REFACTORING-ROADMAP.md, item B-01).

**Error Format:** Standard error responses use Shape A: \`{ success: false, error: { code, message }, timestamp }\`.
Some endpoints return non-standard shapes — these are identified in endpoint descriptions.

**Security Gaps:** Admin endpoints (/api/admin/*) have no auth guard — see REFACTORING-ROADMAP.md item NB-01.

Generated from Zod validators via zod-openapi v5. Single source of truth for validation and documentation.
      `.trim(),
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
    tags: [
      {
        name: "Health",
        description: "Service health check",
      },
      {
        name: "Agents",
        description: "Agent registration, status, and lifecycle management",
      },
      {
        name: "Tasks",
        description: "Task assignment, status updates, and execution",
      },
      {
        name: "Calendar",
        description: "Scheduled event management for agent tasks",
      },
      {
        name: "Businesses",
        description: "Business/workspace registration (alias: workspaces)",
      },
      {
        name: "Epics",
        description: "Epic management and tracking",
      },
      {
        name: "Gateway",
        description: "Agent gateway communication via WebSocket RPC. NOTE: Uses ?action= anti-pattern (Richardson Level 0) — see REFACTORING-ROADMAP.md item B-02.",
      },
      {
        name: "Memory",
        description: "Agent memory file access. Development-only — reads from local filesystem (~/.openclaw/).",
      },
      {
        name: "State Engine",
        description: "Autonomous state engine metrics, decisions, and alerts",
      },
      {
        name: "Reports",
        description: "Weekly and sprint report generation",
      },
      {
        name: "Admin",
        description: "Administrative operations. WARNING: No authentication on any admin endpoints — CRITICAL security gap.",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Agent API key. Obtained during agent registration (POST /api/agents). Pass as: Authorization: Bearer <agentKey>",
        },
      },
    },
    paths: {
      // -----------------------------------------------------------------------
      // Health
      // -----------------------------------------------------------------------
      "/api/health": {
        get: {
          operationId: "getHealth",
          summary: "Health check",
          description: "Returns service health status. Does not use standard ApiSuccessResponse wrapper.",
          tags: ["Health"],
          responses: {
            "200": jsonResponse("Service is healthy", HealthResponseSchema),
            "503": {
              description: "Service is unhealthy",
              content: {
                "application/json": {
                  schema: z.object({
                    status: z.literal("unhealthy"),
                    timestamp: z.string(),
                    error: z.string(),
                  }),
                },
              },
            },
          },
        },
      },

      // -----------------------------------------------------------------------
      // OpenAPI (documentation endpoint)
      // -----------------------------------------------------------------------
      "/api/openapi": {
        get: {
          operationId: "getOpenAPISpec",
          summary: "OpenAPI specification",
          description: "Returns the OpenAPI 3.0 specification for all Mission Control APIs. Used by Swagger UI.",
          tags: ["Admin"],
          responses: {
            "200": {
              description: "OpenAPI 3.0 document",
              content: {
                "application/json": {
                  schema: z.object({
                    openapi: z.string().meta({ example: "3.0.0" }),
                    info: z.object({ title: z.string(), version: z.string() }),
                    paths: z.unknown(),
                  }),
                },
              },
            },
            "500": jsonResponse("Failed to generate spec", ErrorResponseSchema),
          },
        },
      },

      // -----------------------------------------------------------------------
      // Agents
      // -----------------------------------------------------------------------
      "/api/agents": {
        get: {
          operationId: "listAgents",
          summary: "List all agents",
          description: "Returns all registered agents. Auth via non-standard agentId + agentKey custom headers (deprecated — migrate to Authorization: Bearer).",
          tags: ["Agents"],
          security: bearerSecurityRequirement,
          requestParams: {
            header: z.object({
              "agentId": z.string().optional().meta({
                description: "Agent ID for authentication (deprecated: use Authorization: Bearer)",
              }),
              "agentKey": z.string().optional().meta({
                description: "Agent key for authentication (deprecated: use Authorization: Bearer)",
              }),
            }),
          },
          responses: {
            "200": jsonResponse("List of agents", z.object({
              success: z.literal(true),
              data: z.object({
                agents: z.array(AgentResponseSchema),
              }),
              timestamp: z.number().optional(),
            })),
            "401": jsonResponse("Unauthorized", ErrorResponseSchema),
            "500": jsonResponse("Internal server error", ErrorResponseSchema),
          },
        },
        post: {
          operationId: "registerAgent",
          summary: "Register a new agent",
          description: "Open registration endpoint — no authentication required. Returns 201 for new agents, 200 if agent already exists.",
          tags: ["Agents"],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: RegisterAgentRequestSchema },
            },
          },
          responses: {
            "200": jsonResponse("Agent already exists (upsert)", z.object({
              success: z.literal(true),
              data: z.object({ agent: AgentResponseSchema }),
              timestamp: z.number().optional(),
            })),
            "201": jsonResponse("Agent registered successfully", z.object({
              success: z.literal(true),
              data: z.object({ agent: AgentResponseSchema, sessionKey: z.string() }),
              timestamp: z.number().optional(),
            })),
            "400": jsonResponse("Validation error", ErrorResponseSchema),
            "500": jsonResponse("Internal server error", ErrorResponseSchema),
          },
        },
      },

      "/api/agents/{agentId}": {
        get: {
          operationId: "getAgent",
          summary: "Get agent details",
          description: "Returns agent data. Auth via agentKey query param (deprecated — exposes credentials in server logs). Migrate to Authorization: Bearer.",
          tags: ["Agents"],
          requestParams: {
            path: z.object({
              agentId: z.string().meta({ description: "Agent Convex ID" }),
            }),
            query: z.object({
              agentKey: z.string().optional().meta({
                description: "Agent API key (deprecated: use Authorization: Bearer header)",
              }),
            }),
          },
          security: bearerSecurityRequirement,
          responses: {
            "200": jsonResponse("Agent details", z.object({
              success: z.literal(true),
              data: z.object({ agent: AgentResponseSchema }),
              timestamp: z.number().optional(),
            })),
            ...standardErrorResponses,
          },
        },
        patch: {
          operationId: "updateAgent",
          summary: "Update agent (self-update)",
          description: "Agent updates its own metadata. Auth via Authorization: Bearer (preferred) or apiKey in body (deprecated).",
          tags: ["Agents"],
          security: bearerSecurityRequirement,
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: UpdateAgentRequestSchema },
            },
          },
          responses: {
            "200": jsonResponse("Agent updated", z.object({
              success: z.literal(true),
              data: z.object({ agent: AgentResponseSchema }),
              timestamp: z.number().optional(),
            })),
            ...standardErrorResponses,
          },
        },
      },

      "/api/agents/{agentId}/heartbeat": {
        post: {
          operationId: "agentHeartbeat",
          summary: "Agent heartbeat",
          description: "Agent reports liveness. Auth via agentKey in request body (deprecated — migrate to Authorization: Bearer).",
          tags: ["Agents"],
          security: bearerSecurityRequirement,
          requestParams: {
            path: z.object({
              agentId: z.string().meta({ description: "Agent Convex ID" }),
            }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: HeartbeatRequestSchema },
            },
          },
          responses: {
            "200": jsonResponse("Heartbeat acknowledged", z.object({
              success: z.literal(true),
              data: z.object({ acknowledged: z.boolean() }),
              timestamp: z.number().optional(),
            })),
            ...standardErrorResponses,
          },
        },
      },

      "/api/agents/{agentId}/poll": {
        post: {
          operationId: "pollAgent",
          summary: "Agent poll for tasks",
          description: "Agent polls for pending tasks and notifications. Auth via agentKey in request body (deprecated — migrate to Authorization: Bearer).",
          tags: ["Agents"],
          security: bearerSecurityRequirement,
          requestParams: {
            path: z.object({
              agentId: z.string().meta({ description: "Agent Convex ID" }),
            }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: AgentPollRequestSchema },
            },
          },
          responses: {
            "200": jsonResponse("Poll result with pending tasks", z.object({
              success: z.literal(true),
              data: z.object({
                tasks: z.array(TaskResponseSchema),
                notifications: z.array(z.unknown()),
              }),
              timestamp: z.number().optional(),
            })),
            ...standardErrorResponses,
          },
        },
      },

      "/api/agents/{agentId}/rotate-key": {
        post: {
          operationId: "rotateAgentKey",
          summary: "Rotate agent API key",
          description: "Rotates the agent's API key. Reference implementation for auth pattern — supports grace period and audit logging. Returns X-Request-Id header. Auth via Authorization: Bearer (preferred) or apiKey in body.",
          tags: ["Agents"],
          security: bearerSecurityRequirement,
          requestParams: {
            path: z.object({
              agentId: z.string().meta({ description: "Agent Convex ID" }),
            }),
            header: z.object({
              "Idempotency-Key": z.string().optional().meta({
                description: "Idempotency key — echoed back in response header",
              }),
            }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: RotateKeyRequestSchema },
            },
          },
          responses: {
            "200": jsonResponse("Key rotated — returns new key", z.object({
              success: z.literal(true),
              data: z.object({
                newKey: z.string().meta({ description: "New API key" }),
                gracePeriodSeconds: z.number(),
              }),
              timestamp: z.number().optional(),
            })),
            "400": jsonResponse("Validation error", ErrorResponseSchema),
            "401": jsonResponse("Unauthorized", ErrorResponseSchema),
            "404": jsonResponse("Agent not found", ErrorResponseSchema),
            "429": jsonResponse("Rate limit exceeded (3 rotations per hour per agent — non-durable, resets on restart)", ErrorResponseSchema),
            "500": jsonResponse("Internal server error", ErrorResponseSchema),
          },
        },
      },

      "/api/agents/{agentId}/tasks": {
        get: {
          operationId: "getAgentTasks",
          summary: "List agent tasks",
          description: "Returns paginated list of tasks for the specified agent. Auth via agentKey query param (deprecated — exposes credentials in server logs).",
          tags: ["Agents", "Tasks"],
          security: bearerSecurityRequirement,
          requestParams: {
            path: z.object({
              agentId: z.string().meta({ description: "Agent Convex ID" }),
            }),
            query: AgentTaskListQuerySchema,
          },
          responses: {
            "200": jsonResponse("Agent task list", z.object({
              success: z.literal(true),
              data: z.object({
                tasks: z.array(TaskResponseSchema),
                meta: PaginationMetaSchema,
              }),
              timestamp: z.number().optional(),
            })),
            ...standardErrorResponses,
          },
        },
      },

      "/api/agents/{agentId}/tasks/{taskId}": {
        get: {
          operationId: "getAgentTask",
          summary: "Get task details (agent view)",
          description: "Returns full details of a specific task. Auth via agentKey query param (deprecated).",
          tags: ["Agents", "Tasks"],
          security: bearerSecurityRequirement,
          requestParams: {
            path: z.object({
              agentId: z.string().meta({ description: "Agent Convex ID" }),
              taskId: z.string().meta({ description: "Task Convex ID" }),
            }),
            query: z.object({
              agentKey: z.string().optional().meta({
                description: "Agent API key (deprecated: use Authorization: Bearer header)",
              }),
            }),
          },
          responses: {
            "200": jsonResponse("Task details", z.object({
              success: z.literal(true),
              data: z.object({ task: TaskResponseSchema }),
              timestamp: z.number().optional(),
            })),
            ...standardErrorResponses,
          },
        },
      },

      "/api/agents/{agentId}/tasks/{taskId}/comments": {
        post: {
          operationId: "addTaskComment",
          summary: "Add comment to task",
          description: "Adds a comment to a task. Auth via agentKey in request body (deprecated). Supports Idempotency-Key header (echoed, not used for deduplication).",
          tags: ["Agents", "Tasks"],
          security: bearerSecurityRequirement,
          requestParams: {
            path: z.object({
              agentId: z.string().meta({ description: "Agent Convex ID" }),
              taskId: z.string().meta({ description: "Task Convex ID" }),
            }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: AddCommentRequestSchema },
            },
          },
          responses: {
            "201": jsonResponse("Comment added", z.object({
              success: z.literal(true),
              data: z.object({ commentId: z.string() }),
              timestamp: z.number().optional(),
            })),
            ...standardErrorResponses,
          },
        },
      },

      "/api/agents/{agentId}/wiki/pages": {
        get: {
          operationId: "listWikiPages",
          summary: "List agent wiki pages",
          description: "Returns all wiki pages for the agent. Auth via agentKey query param (deprecated).",
          tags: ["Agents"],
          security: bearerSecurityRequirement,
          requestParams: {
            path: z.object({
              agentId: z.string().meta({ description: "Agent Convex ID" }),
            }),
            query: z.object({
              agentKey: z.string().optional().meta({
                description: "Agent API key (deprecated: use Authorization: Bearer)",
              }),
            }),
          },
          responses: {
            "200": jsonResponse("Wiki pages list", z.object({
              success: z.literal(true),
              data: z.object({ pages: z.array(WikiPageResponseSchema) }),
              timestamp: z.number().optional(),
            })),
            ...standardErrorResponses,
          },
        },
        post: {
          operationId: "createWikiPage",
          summary: "Create wiki page",
          description: "Creates a new wiki page for the agent. Auth via agentKey query param (deprecated).",
          tags: ["Agents"],
          security: bearerSecurityRequirement,
          requestParams: {
            path: z.object({
              agentId: z.string().meta({ description: "Agent Convex ID" }),
            }),
            query: z.object({
              agentKey: z.string().optional().meta({
                description: "Agent API key (deprecated: use Authorization: Bearer)",
              }),
            }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: WikiPageRequestSchema },
            },
          },
          responses: {
            "201": jsonResponse("Wiki page created", z.object({
              success: z.literal(true),
              data: z.object({ page: WikiPageResponseSchema }),
              timestamp: z.number().optional(),
            })),
            ...standardErrorResponses,
          },
        },
      },

      "/api/agents/{agentId}/wiki/pages/{pageId}": {
        get: {
          operationId: "getWikiPage",
          summary: "Get wiki page",
          description: "Returns a specific wiki page. Auth via agentKey query param (deprecated).",
          tags: ["Agents"],
          security: bearerSecurityRequirement,
          requestParams: {
            path: z.object({
              agentId: z.string().meta({ description: "Agent Convex ID" }),
              pageId: z.string().meta({ description: "Wiki page Convex ID" }),
            }),
            query: z.object({
              agentKey: z.string().optional().meta({
                description: "Agent API key (deprecated: use Authorization: Bearer)",
              }),
            }),
          },
          responses: {
            "200": jsonResponse("Wiki page", z.object({
              success: z.literal(true),
              data: z.object({ page: WikiPageResponseSchema }),
              timestamp: z.number().optional(),
            })),
            ...standardErrorResponses,
          },
        },
        patch: {
          operationId: "updateWikiPage",
          summary: "Update wiki page",
          description: "Updates a wiki page's content. Auth via agentKey query param (deprecated).",
          tags: ["Agents"],
          security: bearerSecurityRequirement,
          requestParams: {
            path: z.object({
              agentId: z.string().meta({ description: "Agent Convex ID" }),
              pageId: z.string().meta({ description: "Wiki page Convex ID" }),
            }),
            query: z.object({
              agentKey: z.string().optional().meta({
                description: "Agent API key (deprecated: use Authorization: Bearer)",
              }),
            }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: WikiPageRequestSchema },
            },
          },
          responses: {
            "200": jsonResponse("Wiki page updated", z.object({
              success: z.literal(true),
              data: z.object({ page: WikiPageResponseSchema }),
              timestamp: z.number().optional(),
            })),
            ...standardErrorResponses,
          },
        },
      },

      "/api/agents/workspace/structure": {
        get: {
          operationId: "getWorkspaceStructure",
          summary: "Get agent workspace structure",
          description: "Returns the filesystem structure of an agent's workspace. WARNING: No authentication. Reads server filesystem directly via readdirSync/statSync. Returns non-standard response shape (no success field). Error responses use Shape B.",
          tags: ["Agents"],
          requestParams: {
            query: z.object({
              agentId: z.string().meta({ description: "Agent ID (query param — not in path like other agent endpoints)" }),
              maxDepth: z.number().optional().meta({ example: 3 }),
              includeHidden: z.boolean().optional(),
              filter: z.enum(["all", "files", "directories"]).optional(),
            }),
          },
          responses: {
            "200": {
              description: "Workspace structure (non-standard shape — no success wrapper)",
              content: {
                "application/json": {
                  schema: z.object({
                    agentId: z.string(),
                    agentName: z.string(),
                    rootPath: z.string(),
                    totalFiles: z.number(),
                    totalFolders: z.number(),
                    totalSize: z.number(),
                    lastUpdated: z.number(),
                  }),
                },
              },
            },
            ...serverErrorOnly,
          },
        },
      },

      // -----------------------------------------------------------------------
      // Tasks
      // -----------------------------------------------------------------------
      "/api/tasks/{taskId}": {
        patch: {
          operationId: "updateTask",
          summary: "Update task (action discriminator)",
          description: "Performs one of 8 operations on a task via action discriminator in request body. Agent-initiated actions (assign, complete, update-status, update-tags) require agentKey. State-engine actions (escalate, reassign, unblock, mark-executed) require no auth — CRITICAL security gap.",
          tags: ["Tasks"],
          security: bearerSecurityRequirement,
          requestParams: {
            path: z.object({
              taskId: z.string().meta({ description: "Task Convex ID" }),
            }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: TaskUpdateRequestSchema },
            },
          },
          responses: {
            "200": jsonResponse("Task updated", z.object({
              success: z.literal(true),
              data: z.object({ task: TaskResponseSchema }),
              timestamp: z.number().optional(),
            })),
            "400": jsonResponse("Validation error", ErrorResponseSchema),
            "401": jsonResponse("Unauthorized (for agent-initiated actions)", ErrorResponseSchema),
            "500": jsonResponse("Internal server error", ErrorResponseSchema),
          },
        },
      },

      "/api/tasks/execute": {
        get: {
          operationId: "getTaskExecution",
          summary: "Get task execution status (stub)",
          description: "Polls execution status by executionId. STUB IMPLEMENTATION — returns hardcoded 'completed' without DB query. No auth. Verb in URL is known anti-pattern (see REFACTORING-ROADMAP.md B-03).",
          tags: ["Tasks"],
          requestParams: {
            query: z.object({
              executionId: z.string().meta({ description: "Execution ID to poll" }),
            }),
          },
          responses: {
            "200": {
              description: "Execution status (hardcoded stub response)",
              content: {
                "application/json": {
                  schema: z.object({
                    executionId: z.string(),
                    status: z.literal("completed"),
                  }),
                },
              },
            },
            ...serverErrorOnly,
          },
        },
        post: {
          operationId: "executeTask",
          summary: "Execute task",
          description: "Dispatches task for execution via OpenClaw sub-agent. PARTIALLY MOCKED — HTTP dispatch is disabled (Phase 6A TODO). No auth. Error responses use Shape B (non-standard). Verb in URL is known anti-pattern (see REFACTORING-ROADMAP.md B-03).",
          tags: ["Tasks"],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: ExecuteTaskRequestSchema },
            },
          },
          responses: {
            "200": {
              description: "Execution accepted",
              content: {
                "application/json": {
                  schema: z.object({
                    executionId: z.string(),
                    status: z.string(),
                  }),
                },
              },
            },
            ...serverErrorOnly,
          },
        },
      },

      "/api/tasks/generate-daily": {
        get: {
          operationId: "getDailyTasksBatch",
          summary: "Get daily tasks batch status (stub)",
          description: "Returns status of daily task generation. STUB — returns hardcoded mock. No auth. Verb in URL is known anti-pattern (see REFACTORING-ROADMAP.md B-03).",
          tags: ["Tasks"],
          responses: {
            "200": {
              description: "Mock daily batch status",
              content: {
                "application/json": {
                  schema: z.object({ status: z.string(), tasks: z.array(z.unknown()) }),
                },
              },
            },
            ...serverErrorOnly,
          },
        },
        post: {
          operationId: "generateDailyTasks",
          summary: "Generate daily tasks",
          description: "Generates daily task batch for workspace using taskGenerationService. No auth. Returns 201 on success, 200 for empty result. Success shape is non-standard (not wrapped in data). Error shape is mixed (Shape C on error). Verb in URL is known anti-pattern (see REFACTORING-ROADMAP.md B-03).",
          tags: ["Tasks"],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: GenerateDailyTasksRequestSchema },
            },
          },
          responses: {
            "201": {
              description: "Tasks generated (non-standard success shape)",
              content: {
                "application/json": {
                  schema: z.object({
                    success: z.literal(true),
                    tasks: z.array(TaskResponseSchema),
                    count: z.number(),
                    generatedAt: z.string(),
                  }),
                },
              },
            },
            "200": {
              description: "No tasks generated (empty result)",
              content: {
                "application/json": {
                  schema: z.object({ success: z.literal(true), tasks: z.array(z.unknown()), count: z.literal(0) }),
                },
              },
            },
            ...serverErrorOnly,
          },
        },
      },

      "/api/tasks/{taskId}/calendar-events": {
        post: {
          operationId: "createTaskCalendarEvent",
          summary: "Create calendar event for task",
          description: "Schedules a task for execution on a specific date. Auth via agentId + agentKey in request body (deprecated — migrate to Authorization: Bearer).",
          tags: ["Tasks", "Calendar"],
          security: bearerSecurityRequirement,
          requestParams: {
            path: z.object({
              taskId: z.string().meta({ description: "Task Convex ID" }),
            }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: CreateCalendarEventRequestSchema },
            },
          },
          responses: {
            "201": jsonResponse("Calendar event created", z.object({
              success: z.literal(true),
              data: z.object({ event: CalendarEventResponseSchema }),
              timestamp: z.number().optional(),
            })),
            ...standardErrorResponses,
          },
        },
      },

      // -----------------------------------------------------------------------
      // Calendar
      // -----------------------------------------------------------------------
      "/api/calendar/events": {
        post: {
          operationId: "createCalendarEvent",
          summary: "Create calendar event",
          description: "Creates a scheduled calendar event for agent task execution. Auth via agentId + agentKey in request body (deprecated — migrate to Authorization: Bearer). Supports Idempotency-Key header (echoed, not used for deduplication).",
          tags: ["Calendar"],
          security: bearerSecurityRequirement,
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: CreateCalendarEventRequestSchema },
            },
          },
          responses: {
            "201": jsonResponse("Calendar event created", z.object({
              success: z.literal(true),
              data: z.object({ event: CalendarEventResponseSchema }),
              timestamp: z.number().optional(),
            })),
            ...standardErrorResponses,
          },
        },
      },

      "/api/calendar/events/{eventId}": {
        put: {
          operationId: "markCalendarEventExecuted",
          summary: "Mark calendar event as executed",
          description: "Marks a calendar event as executed (idempotent update). Auth via agentId + agentKey in request body (deprecated — migrate to Authorization: Bearer). Uses PUT (full replace semantics — functionally a partial update).",
          tags: ["Calendar"],
          security: bearerSecurityRequirement,
          requestParams: {
            path: z.object({
              eventId: z.string().meta({ description: "Calendar event Convex ID" }),
            }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: UpdateCalendarEventRequestSchema },
            },
          },
          responses: {
            "200": jsonResponse("Calendar event marked as executed", z.object({
              success: z.literal(true),
              data: z.object({ event: CalendarEventResponseSchema }),
              timestamp: z.number().optional(),
            })),
            ...standardErrorResponses,
          },
        },
      },

      "/api/calendar/slots": {
        get: {
          operationId: "getCalendarSlots",
          summary: "Get available calendar slots",
          description: "Returns available scheduling slots for an agent. Auth via agentId + agentKey query params (deprecated — exposes credentials in server logs, migrate to Authorization: Bearer).",
          tags: ["Calendar"],
          security: bearerSecurityRequirement,
          requestParams: {
            query: z.object({
              agentId: z.string().meta({ description: "Agent ID (deprecated query auth)" }),
              agentKey: z.string().meta({ description: "Agent key (deprecated query auth)" }),
              date: z.string().optional().meta({ description: "Date string (YYYY-MM-DD)", example: "2026-03-01" }),
              duration: z.number().optional().meta({ description: "Slot duration in minutes", example: 60 }),
            }),
          },
          responses: {
            "200": jsonResponse("Available calendar slots", z.object({
              success: z.literal(true),
              data: z.object({ slots: z.array(z.unknown()) }),
              timestamp: z.number().optional(),
            })),
            ...standardErrorResponses,
          },
        },
      },

      // -----------------------------------------------------------------------
      // Businesses
      // -----------------------------------------------------------------------
      "/api/businesses": {
        get: {
          operationId: "listBusinesses",
          summary: "List businesses",
          description: "Returns all businesses/workspaces. No auth. Error responses use Shape C (string, not object) — see REFACTORING-ROADMAP.md NB-02.",
          tags: ["Businesses"],
          responses: {
            "200": {
              description: "Business list (non-standard success shape — direct field, not wrapped in data)",
              content: {
                "application/json": {
                  schema: z.object({
                    success: z.literal(true),
                    businesses: z.array(BusinessResponseSchema),
                  }),
                },
              },
            },
            "500": jsonResponse("Internal server error (Shape C error)", ErrorResponseSchema),
          },
        },
        post: {
          operationId: "createBusiness",
          summary: "Create business",
          description: "Creates a new business/workspace. No auth. Internally calls api.workspaces.create (naming inconsistency). Error responses use Shape C (string, not object).",
          tags: ["Businesses"],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: CreateBusinessRequestSchema },
            },
          },
          responses: {
            "201": jsonResponse("Business created", z.object({
              success: z.literal(true),
              data: z.object({ business: BusinessResponseSchema }),
              timestamp: z.number().optional(),
            })),
            "400": jsonResponse("Validation error", ErrorResponseSchema),
            "500": jsonResponse("Internal server error (Shape C error)", ErrorResponseSchema),
          },
        },
      },

      // -----------------------------------------------------------------------
      // Epics
      // -----------------------------------------------------------------------
      "/api/epics": {
        get: {
          operationId: "listEpics",
          summary: "List epics",
          description: "Returns all epics for a workspace. No auth. Non-standard success response (not wrapped in data, uses local jsonResponse duplicate). Error uses Shape B. See REFACTORING-ROADMAP.md NB-03.",
          tags: ["Epics"],
          requestParams: {
            query: z.object({
              workspaceId: z.string().meta({ description: "Workspace/business ID" }),
            }),
          },
          responses: {
            "200": {
              description: "Epic list (non-standard shape — epics field at root, not in data)",
              content: {
                "application/json": {
                  schema: z.object({
                    success: z.literal(true),
                    epics: z.array(EpicResponseSchema),
                    message: z.string().optional(),
                  }),
                },
              },
            },
            ...serverErrorOnly,
          },
        },
      },

      // -----------------------------------------------------------------------
      // Gateway (Level 0 anti-pattern documented as-is)
      // -----------------------------------------------------------------------
      "/api/gateway/{gatewayId}": {
        get: {
          operationId: "gatewayGet",
          summary: "Gateway operations (GET)",
          description: "LEVEL 0 ANTI-PATTERN: ?action= parameter discriminates 3 operations on one URL. No auth. Error responses use Shape B. See REFACTORING-ROADMAP.md B-02 for decomposition plan. Operations: sessions (list sessions), history (get chat history), status/none (health check).",
          tags: ["Gateway"],
          requestParams: {
            path: z.object({
              gatewayId: z.string().meta({ description: "Gateway Convex ID" }),
            }),
            query: z.object({
              action: z.enum(["sessions", "history", "status"]).optional().meta({
                description: "Operation selector. If omitted, defaults to status check.",
                example: "sessions",
              }),
              sessionKey: z.string().optional().meta({
                description: "Required when action=history — identifies the session",
              }),
            }),
          },
          responses: {
            "200": {
              description: "Operation result (shape varies by action)",
              content: {
                "application/json": {
                  schema: z.union([
                    GatewayStatusResponseSchema,
                    z.object({ sessions: z.array(z.unknown()) }),
                    z.object({ history: z.array(z.unknown()) }),
                  ]),
                },
              },
            },
            "400": {
              description: "Missing required parameter (Shape B — non-standard)",
              content: {
                "application/json": {
                  schema: z.object({ error: z.string() }),
                },
              },
            },
            "500": {
              description: "Internal error (Shape B — non-standard)",
              content: {
                "application/json": {
                  schema: z.object({ error: z.string() }),
                },
              },
            },
          },
        },
        post: {
          operationId: "gatewayPost",
          summary: "Gateway operations (POST)",
          description: "LEVEL 0 ANTI-PATTERN: ?action= parameter discriminates 4 operations on one URL. No auth. Error responses use Shape B. See REFACTORING-ROADMAP.md B-02 for decomposition plan. Operations: message (send chat message), provision (7-step agent provisioning), sync (stub), validate (WebSocket URL validation).",
          tags: ["Gateway"],
          requestParams: {
            path: z.object({
              gatewayId: z.string().meta({ description: "Gateway Convex ID" }),
            }),
            query: z.object({
              action: z.enum(["message", "provision", "sync", "validate"]).meta({
                description: "Operation selector — required for POST",
                example: "provision",
              }),
            }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.union([
                  GatewaySendMessageRequestSchema,
                  GatewayProvisionRequestSchema,
                  GatewayValidateRequestSchema,
                  z.object({}).meta({ description: "Empty body for sync action" }),
                ]),
              },
            },
          },
          responses: {
            "200": {
              description: "Operation result (shape varies by action)",
              content: {
                "application/json": {
                  schema: z.union([
                    z.object({ ok: z.boolean(), response: z.unknown() }),
                    z.object({ ok: z.boolean(), synced: z.boolean() }),
                    z.object({ ok: z.boolean(), valid: z.boolean() }),
                  ]),
                },
              },
            },
            "400": {
              description: "Missing required parameter (Shape B — non-standard)",
              content: {
                "application/json": {
                  schema: z.object({ error: z.string() }),
                },
              },
            },
            "500": {
              description: "Internal error (Shape B — non-standard)",
              content: {
                "application/json": {
                  schema: z.object({ error: z.string() }),
                },
              },
            },
          },
        },
      },

      // -----------------------------------------------------------------------
      // State Engine
      // -----------------------------------------------------------------------
      "/api/state-engine/metrics": {
        get: {
          operationId: "getStateEngineMetrics",
          summary: "Get state engine metrics",
          description: "Returns performance metrics for the autonomous state engine. No auth. Response uses raw Convex query result (no success wrapper). Error uses Shape B.",
          tags: ["State Engine"],
          requestParams: {
            query: z.object({
              workspaceId: z.string().meta({ description: "Workspace ID to get metrics for" }),
            }),
          },
          responses: {
            "200": {
              description: "State engine metrics (no success wrapper — raw Convex result)",
              content: {
                "application/json": {
                  schema: StateEngineMetricsResponseSchema,
                },
              },
            },
            ...serverErrorOnly,
          },
        },
      },

      "/api/state-engine/decisions": {
        get: {
          operationId: "getStateEngineDecisions",
          summary: "Get state engine decisions",
          description: "Returns decisions and patterns made by the state engine. No auth. Response uses raw shape (no success wrapper). Error uses Shape B.",
          tags: ["State Engine"],
          requestParams: {
            query: z.object({
              workspaceId: z.string().meta({ description: "Workspace ID" }),
              limit: z.number().optional().meta({ description: "Max decisions to return" }),
            }),
          },
          responses: {
            "200": {
              description: "State engine decisions (no success wrapper)",
              content: {
                "application/json": {
                  schema: StateEngineDecisionsResponseSchema,
                },
              },
            },
            ...serverErrorOnly,
          },
        },
      },

      "/api/state-engine/alerts": {
        get: {
          operationId: "getStateEngineAlerts",
          summary: "Get state engine alert rules",
          description: "Returns alert rules for the state engine. No auth. Response uses raw shape (no success wrapper). Error uses Shape B.",
          tags: ["State Engine"],
          requestParams: {
            query: z.object({
              workspaceId: z.string().meta({ description: "Workspace ID" }),
            }),
          },
          responses: {
            "200": {
              description: "Alert rules (no success wrapper)",
              content: {
                "application/json": {
                  schema: StateEngineAlertsResponseSchema,
                },
              },
            },
            ...serverErrorOnly,
          },
        },
      },

      // -----------------------------------------------------------------------
      // Memory (development-only)
      // -----------------------------------------------------------------------
      "/api/memory": {
        get: {
          operationId: "listMemoryFiles",
          summary: "List memory files",
          description: "Lists files in ~/.openclaw/workspace/memory directory. DEVELOPMENT ONLY — reads local server filesystem. No auth. Non-standard response shape (no success field). Returns { files: [] } with status 500 on empty directory (incorrect behavior).",
          tags: ["Memory"],
          "x-development-only": true,
          responses: {
            "200": {
              description: "Memory file list (non-standard shape — no success field)",
              content: {
                "application/json": {
                  schema: MemoryFileListResponseSchema,
                },
              },
            },
            "500": {
              description: "Error reading filesystem (incorrectly returns { files: [] } instead of error shape)",
              content: {
                "application/json": {
                  schema: MemoryFileListResponseSchema,
                },
              },
            },
          },
        },
      },

      "/api/memory/files": {
        get: {
          operationId: "getMemoryFile",
          summary: "Get memory file content",
          description: "Reads file content from ~/.openclaw/workspace/ via path query param. DEVELOPMENT ONLY. No auth. Has path traversal guard (returns 403 on traversal attempt). Non-standard response shape.",
          tags: ["Memory"],
          "x-development-only": true,
          requestParams: {
            query: z.object({
              path: z.string().meta({ description: "Relative file path within memory workspace" }),
            }),
          },
          responses: {
            "200": {
              description: "File content (non-standard shape)",
              content: {
                "application/json": {
                  schema: z.object({ content: z.string() }),
                },
              },
            },
            "400": {
              description: "Missing path parameter",
              content: { "application/json": { schema: z.object({ content: z.literal(""), error: z.string() }) } },
            },
            "403": {
              description: "Path traversal attack detected",
              content: { "application/json": { schema: z.object({ content: z.literal(""), error: z.string() }) } },
            },
            "500": {
              description: "File read error",
              content: { "application/json": { schema: z.object({ content: z.literal(""), error: z.string() }) } },
            },
          },
        },
      },

      "/api/memory/context": {
        get: {
          operationId: "getMemoryContext",
          summary: "Get memory context",
          description: "Returns memory context. STUB IMPLEMENTATION — returns empty arrays. DEVELOPMENT ONLY. No auth. Non-standard response shape.",
          tags: ["Memory"],
          "x-development-only": true,
          responses: {
            "200": {
              description: "Memory context (stub — always empty, non-standard shape)",
              content: {
                "application/json": {
                  schema: z.object({
                    memories: z.array(z.unknown()),
                    patterns: z.array(z.unknown()),
                    recentDecisions: z.array(z.unknown()),
                  }),
                },
              },
            },
            "500": {
              description: "Internal error",
              content: { "application/json": { schema: z.object({ error: z.string() }) } },
            },
          },
        },
      },

      // -----------------------------------------------------------------------
      // Reports
      // -----------------------------------------------------------------------
      "/api/reports": {
        get: {
          operationId: "getReport",
          summary: "Get weekly report",
          description: "Returns a pre-generated weekly or sprint report. No auth. Returns 404 for ungenerated reports with raw shape (not standard ApiErrorResponse). Error uses Shape B.",
          tags: ["Reports"],
          requestParams: {
            query: z.object({
              week: z.string().optional().meta({ description: "Week identifier", example: "2026-W08" }),
              year: z.number().optional().meta({ example: 2026 }),
              type: z.string().optional().meta({ example: "weekly" }),
            }),
          },
          responses: {
            "200": {
              description: "Report data (raw shape — no success wrapper)",
              content: {
                "application/json": { schema: z.unknown() },
              },
            },
            "404": {
              description: "Report not generated yet (non-standard shape)",
              content: {
                "application/json": {
                  schema: z.object({ week: z.string(), year: z.number(), message: z.string() }),
                },
              },
            },
            "400": jsonResponse("Missing parameters (Shape B)", ErrorResponseSchema),
            "500": jsonResponse("Internal error (Shape B)", ErrorResponseSchema),
          },
        },
        post: {
          operationId: "generateReport",
          summary: "Generate report",
          description: "Generates a weekly or sprint report. No auth. Returns raw report JSON (no success wrapper). Silently swallows persistence errors. Mixed error shapes (400: Shape B, 500: Shape C).",
          tags: ["Reports"],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: GenerateReportRequestSchema },
            },
          },
          responses: {
            "200": {
              description: "Report generated (raw shape — no success wrapper)",
              content: {
                "application/json": { schema: z.unknown() },
              },
            },
            "400": jsonResponse("Validation error (Shape B)", ErrorResponseSchema),
            "500": jsonResponse("Internal error (Shape C)", ErrorResponseSchema),
          },
        },
      },

      // -----------------------------------------------------------------------
      // Admin (no auth — CRITICAL security gap)
      // -----------------------------------------------------------------------
      "/api/admin/agents/setup-workspace": {
        post: {
          operationId: "adminSetupWorkspace",
          summary: "Set agent workspace path (admin)",
          description: "Sets the workspace path for an agent identified by name. CRITICAL: No authentication — anyone with network access can reset workspace paths. Uses Shape A (correct). Workaround: calls api.agents.register instead of a proper update mutation.",
          tags: ["Admin"],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: SetupWorkspaceRequestSchema },
            },
          },
          responses: {
            "200": jsonResponse("Workspace path updated", z.object({
              success: z.literal(true),
              data: z.object({ agent: AgentResponseSchema }),
              timestamp: z.number().optional(),
            })),
            "400": jsonResponse("Validation error", ErrorResponseSchema),
            "404": jsonResponse("Agent not found", ErrorResponseSchema),
            "500": jsonResponse("Internal server error", ErrorResponseSchema),
          },
        },
      },

      "/api/admin/migrations/agent-workspace-paths": {
        post: {
          operationId: "adminMigrateWorkspacePaths",
          summary: "Migrate agent workspace paths (admin)",
          description: "Runs database migration to set default workspace paths for all agents. CRITICAL: No authentication — publicly exposes DB migration endpoint. Uses Shape A (correct).",
          tags: ["Admin"],
          requestBody: {
            required: false,
            content: {
              "application/json": { schema: MigrateWorkspacePathsRequestSchema },
            },
          },
          responses: {
            "200": jsonResponse("Migration complete", z.object({
              success: z.literal(true),
              data: z.object({ migrated: z.number(), skipped: z.number() }),
              timestamp: z.number().optional(),
            })),
            "500": jsonResponse("Migration failed", ErrorResponseSchema),
          },
        },
      },
    },
  });
}
