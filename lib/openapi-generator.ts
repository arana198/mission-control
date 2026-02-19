/**
 * OpenAPI Spec Generator (RESTful)
 *
 * Generates OpenAPI 3.0 specification for all API endpoints
 * Follows REST architectural best practices with resource-based URLs
 */

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
  };
  tags: Array<{
    name: string;
    description: string;
  }>;
}

/**
 * Generate OpenAPI specification
 * Consolidates 35 endpoints into RESTful resource structure
 */
export function generateOpenAPISpec(): OpenAPISpec {
  return {
    openapi: "3.0.0",
    info: {
      title: "Mission Control API",
      version: "2.0.0",
      description:
        "RESTful API for autonomous agent management, state engine, and task orchestration. Follows REST best practices with resource-based URLs and HTTP method semantics.",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
      {
        url: "https://mission-control.example.com",
        description: "Production server",
      },
    ],
    paths: {
      // ============= AGENT MANAGEMENT =============
      "/api/agents": {
        post: {
          tags: ["Agents"],
          summary: "Register new agent",
          description: "Register a new AI agent or retrieve existing agent credentials",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string", minLength: 2, maxLength: 50 },
                    role: { type: "string" },
                    level: { type: "string", enum: ["lead", "specialist", "intern"] },
                    sessionKey: { type: "string" },
                    capabilities: { type: "array", items: { type: "string" } },
                    model: { type: "string" },
                    personality: { type: "string" },
                  },
                  required: ["name", "role", "level", "sessionKey"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Agent registered successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          agentId: { type: "string" },
                          apiKey: { type: "string" },
                          isNew: { type: "boolean" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        get: {
          tags: ["Agents"],
          summary: "List all agents",
          description: "Get a list of all agents for @mention discovery",
          parameters: [
            {
              name: "agentId",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "agentKey",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "List of agents retrieved",
            },
          },
        },
      },
      "/api/agents/{agentId}": {
        get: {
          tags: ["Agents"],
          summary: "Get agent details",
          parameters: [
            {
              name: "agentId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "agentKey",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Agent details retrieved" },
            "401": { description: "Unauthorized" },
          },
        },
        patch: {
          tags: ["Agents"],
          summary: "Update agent",
          parameters: [
            {
              name: "agentId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    agentKey: { type: "string" },
                    workspace: { type: "string" },
                    model: { type: "string" },
                    personality: { type: "string" },
                    capabilities: { type: "array", items: { type: "string" } },
                  },
                  required: ["agentKey"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Agent updated" },
          },
        },
      },
      "/api/agents/{agentId}/heartbeat": {
        post: {
          tags: ["Agents"],
          summary: "Send heartbeat",
          description: "Agent health check and status update",
          parameters: [
            {
              name: "agentId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    agentKey: { type: "string" },
                    currentTaskId: { type: "string" },
                    status: { type: "string", enum: ["idle", "active", "blocked"] },
                  },
                  required: ["agentKey"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Heartbeat received" },
          },
        },
      },
      "/api/agents/{agentId}/poll": {
        post: {
          tags: ["Agents"],
          summary: "Poll for work",
          description: "Agent polls for new tasks from specified business",
          parameters: [
            {
              name: "agentId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    agentKey: { type: "string" },
                    businessId: { type: "string" },
                    limit: { type: "number" },
                  },
                  required: ["agentKey", "businessId"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Tasks retrieved" },
          },
        },
      },
      "/api/agents/{agentId}/tasks": {
        get: {
          tags: ["Tasks"],
          summary: "Query assigned tasks",
          description: "Get tasks assigned to specific agent",
          parameters: [
            {
              name: "agentId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "businessId",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Tasks retrieved" },
          },
        },
      },
      "/api/agents/{agentId}/tasks/{taskId}": {
        get: {
          tags: ["Tasks"],
          summary: "Get task details",
          parameters: [
            {
              name: "agentId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "taskId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "agentKey",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Task details retrieved" },
          },
        },
      },
      "/api/agents/{agentId}/tasks/{taskId}/comments": {
        post: {
          tags: ["Tasks"],
          summary: "Add task comment",
          parameters: [
            {
              name: "agentId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "taskId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    agentKey: { type: "string" },
                    text: { type: "string" },
                  },
                  required: ["agentKey", "text"],
                },
              },
            },
          },
          responses: {
            "201": { description: "Comment added" },
          },
        },
      },

      // ============= UNIFIED TASK ACTIONS =============
      "/api/tasks/{taskId}": {
        patch: {
          tags: ["Tasks"],
          summary: "Execute task action",
          description:
            "Unified endpoint for task mutations: assign, complete, update status/tags, escalate, reassign, unblock, mark-executed",
          parameters: [
            {
              name: "taskId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    action: {
                      type: "string",
                      enum: [
                        "assign",
                        "complete",
                        "update-status",
                        "update-tags",
                        "escalate",
                        "reassign",
                        "unblock",
                        "mark-executed",
                      ],
                      description: "Action discriminator",
                    },
                    // Agent-facing actions (require agentKey)
                    agentKey: { type: "string", description: "For agent-facing actions" },
                    agentId: { type: "string", description: "For agent-facing actions" },
                    assigneeIds: {
                      type: "array",
                      items: { type: "string" },
                      description: "For assign action",
                    },
                    completionNotes: { type: "string", description: "For complete action" },
                    timeSpent: { type: "number", description: "For complete action" },
                    status: { type: "string", description: "For update-status or complete actions" },
                    tags: { type: "array", items: { type: "string" }, description: "For update-tags" },
                    tagsToAdd: {
                      type: "array",
                      items: { type: "string" },
                      description: "For update-tags",
                    },
                    tagsToRemove: {
                      type: "array",
                      items: { type: "string" },
                      description: "For update-tags",
                    },
                    // State engine actions (require decidedBy)
                    businessId: { type: "string", description: "For state-engine actions" },
                    reason: { type: "string", description: "For state-engine actions" },
                    decidedBy: { type: "string", description: "For state-engine actions" },
                    toAgent: { type: "string", description: "For reassign action" },
                    outcome: { type: "string", description: "For mark-executed action" },
                  },
                  required: ["action"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Action executed successfully" },
            "400": { description: "Invalid action or missing parameters" },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/tasks/{taskId}/calendar-events": {
        get: {
          tags: ["Tasks"],
          summary: "Get task calendar events",
          parameters: [
            {
              name: "taskId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Calendar events for task" },
          },
        },
      },

      // ============= RESOURCES =============
      "/api/epics": {
        get: {
          tags: ["Epics"],
          summary: "List epics",
          description: "Get all available epics for a business",
          parameters: [
            {
              name: "businessId",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Epics retrieved" },
          },
        },
      },
      "/api/memory": {
        get: {
          tags: ["Memory"],
          summary: "List memory entries",
          description: "List all memory files in workspace",
          responses: {
            "200": { description: "Memory files listed" },
          },
        },
      },
      "/api/memory/files": {
        get: {
          tags: ["Memory"],
          summary: "Get memory file content",
          parameters: [
            {
              name: "path",
              in: "query",
              required: true,
              schema: { type: "string" },
              description: "Path to memory file",
            },
          ],
          responses: {
            "200": { description: "File content retrieved" },
            "403": { description: "Forbidden - path traversal attempt" },
          },
        },
      },
      "/api/memory/search": {
        post: {
          tags: ["Memory"],
          summary: "Search memory",
          description: "Server-side memory search with relevance scoring",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    limit: { type: "number", default: 10 },
                  },
                  required: ["query"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Search results" },
          },
        },
      },
      "/api/memory/context": {
        get: {
          tags: ["Memory"],
          summary: "Get memory context",
          description: "Get context for an entity (goal, task, strategy)",
          parameters: [
            {
              name: "entity",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "type",
              in: "query",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Context retrieved" },
          },
        },
      },
      "/api/reports": {
        get: {
          tags: ["Reports"],
          summary: "Fetch report",
          description: "Fetch stored report by type and parameters",
          parameters: [
            {
              name: "type",
              in: "query",
              required: true,
              schema: { type: "string", enum: ["strategic-weekly"] },
            },
            {
              name: "week",
              in: "query",
              required: true,
              schema: { type: "number" },
            },
            {
              name: "year",
              in: "query",
              schema: { type: "number", default: 2026 },
            },
          ],
          responses: {
            "200": { description: "Report retrieved" },
            "404": { description: "Report not found" },
          },
        },
        post: {
          tags: ["Reports"],
          summary: "Generate report",
          description: "Generate a new report of specified type",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["strategic-weekly"] },
                    businessId: { type: "string" },
                    startDate: { type: "string" },
                    endDate: { type: "string" },
                  },
                  required: ["businessId"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Report generated" },
          },
        },
      },
      "/api/calendar/events": {
        get: {
          tags: ["Calendar"],
          summary: "List calendar events",
          responses: {
            "200": { description: "Events retrieved" },
          },
        },
      },
      "/api/calendar/events/{eventId}": {
        get: {
          tags: ["Calendar"],
          summary: "Get event details",
          parameters: [
            {
              name: "eventId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Event details retrieved" },
          },
        },
      },
      "/api/calendar/slots": {
        get: {
          tags: ["Calendar"],
          summary: "Get available slots",
          responses: {
            "200": { description: "Available slots retrieved" },
          },
        },
      },
      "/api/businesses": {
        get: {
          tags: ["Businesses"],
          summary: "List businesses",
          responses: {
            "200": { description: "Businesses retrieved" },
          },
        },
      },
      "/api/state/metrics": {
        get: {
          tags: ["State"],
          summary: "Get system metrics",
          parameters: [
            {
              name: "agentId",
              in: "query",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Metrics retrieved" },
          },
        },
      },
      "/api/state/alerts": {
        get: {
          tags: ["State"],
          summary: "Get alerts",
          parameters: [
            {
              name: "severity",
              in: "query",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Alerts retrieved" },
          },
        },
      },
      "/api/audit-trail": {
        get: {
          tags: ["Audit"],
          summary: "Get audit trail",
          description: "Get historical actions for audit purposes",
          parameters: [
            {
              name: "action",
              in: "query",
              schema: { type: "string" },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "number", default: 100 },
            },
          ],
          responses: {
            "200": { description: "Audit trail retrieved" },
          },
        },
      },
      "/api/admin/goals/seed": {
        post: {
          tags: ["Admin"],
          summary: "Seed demo goals",
          description: "Create demo goals for testing and demonstration",
          responses: {
            "201": { description: "Demo goals created" },
          },
        },
      },
      "/api/admin/goals/demo": {
        delete: {
          tags: ["Admin"],
          summary: "Delete demo goals",
          description: "Archive demo goals created within the last hour",
          responses: {
            "200": { description: "Demo goals archived" },
          },
        },
      },
      "/api/agents/workspace/structure": {
        get: {
          tags: ["Agents"],
          summary: "Get workspace structure",
          responses: {
            "200": { description: "Workspace structure retrieved" },
          },
        },
      },
      "/api/tasks/execute": {
        post: {
          tags: ["Tasks"],
          summary: "Execute task",
          description: "Queue task execution",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    taskId: { type: "string" },
                    goalIds: { type: "array", items: { type: "string" } },
                    timeout: { type: "number" },
                  },
                  required: ["taskId"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Task queued" },
          },
        },
      },
      "/api/tasks/generate-daily": {
        post: {
          tags: ["Tasks"],
          summary: "Generate daily tasks",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    businessId: { type: "string" },
                    date: { type: "string" },
                  },
                  required: ["businessId"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Tasks generated" },
          },
        },
      },
      "/api/openapi": {
        get: {
          tags: ["API"],
          summary: "Get OpenAPI specification",
          description: "Returns the OpenAPI 3.0 specification for this API",
          responses: {
            "200": {
              description: "OpenAPI spec",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
    },

    components: {
      schemas: {},
      securitySchemes: {
        agentAuth: {
          type: "http",
          scheme: "bearer",
          description: "Agent API key authentication",
        },
      },
    },

    tags: [
      {
        name: "Agents",
        description: "Agent lifecycle and management",
      },
      {
        name: "Tasks",
        description: "Task management and execution",
      },
      {
        name: "Epics",
        description: "Epic and roadmap management",
      },
      {
        name: "Memory",
        description: "Workspace memory and knowledge base",
      },
      {
        name: "Reports",
        description: "Strategic reports and analytics",
      },
      {
        name: "Calendar",
        description: "Calendar and scheduling",
      },
      {
        name: "Businesses",
        description: "Business management and configuration",
      },
      {
        name: "State",
        description: "System state and metrics",
      },
      {
        name: "Audit",
        description: "Audit trail and action history",
      },
      {
        name: "Admin",
        description: "Administrative operations",
      },
      {
        name: "API",
        description: "API metadata and documentation",
      },
    ],
  };
}
