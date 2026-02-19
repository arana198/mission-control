/**
 * OpenAPI Spec Generator
 *
 * Generates OpenAPI 3.0 specification for all API endpoints
 * Integrates with Swagger UI for interactive API documentation
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
 * This builds the complete spec from our documented endpoints
 */
export function generateOpenAPISpec(): OpenAPISpec {
  return {
    openapi: "3.0.0",
    info: {
      title: "Mission Control API",
      version: "1.0.0",
      description:
        "Comprehensive API for autonomous agent management, state engine, and task orchestration",
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
      // AGENT MANAGEMENT
      "/api/agents": {
        post: {
          tags: ["Agent Management"],
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
          tags: ["Agent Management"],
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
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          agents: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                id: { type: "string" },
                                name: { type: "string" },
                                role: { type: "string" },
                                level: { type: "string" },
                                status: { type: "string" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      "/api/agents/{agentId}": {
        get: {
          tags: ["Agent Management"],
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
            "200": {
              description: "Agent details retrieved",
            },
            "401": {
              description: "Unauthorized",
            },
          },
        },
        patch: {
          tags: ["Agent Management"],
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
            "200": {
              description: "Agent updated",
            },
          },
        },
      },

      "/api/agents/{agentId}/heartbeat": {
        post: {
          tags: ["Agent Management"],
          summary: "Send heartbeat",
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
            "200": {
              description: "Heartbeat received",
            },
          },
        },
      },

      "/api/agents/{agentId}/poll": {
        post: {
          tags: ["Agent Management"],
          summary: "Poll for work",
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
                  },
                  required: ["agentKey", "businessId"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Work queue retrieved",
            },
          },
        },
      },

      "/api/agents/{agentId}/tasks": {
        get: {
          tags: ["Agent Management"],
          summary: "Query assigned tasks",
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
            {
              name: "businessId",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "status",
              in: "query",
              schema: { type: "string" },
            },
            {
              name: "priority",
              in: "query",
              schema: { type: "string" },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 50 },
            },
            {
              name: "offset",
              in: "query",
              schema: { type: "integer", default: 0 },
            },
          ],
          responses: {
            "200": {
              description: "Tasks retrieved",
            },
          },
        },
      },

      "/api/agents/{agentId}/tasks/{taskId}": {
        get: {
          tags: ["Agent Management"],
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
            "200": {
              description: "Task details",
            },
            "404": {
              description: "Task not found",
            },
          },
        },
      },

      "/api/agents/{agentId}/tasks/{taskId}/assign": {
        post: {
          tags: ["Agent Management"],
          summary: "Assign task",
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
                    assigneeIds: {
                      type: "array",
                      items: { type: "string" },
                      minItems: 1,
                      maxItems: 10,
                    },
                  },
                  required: ["agentKey", "assigneeIds"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Task assigned",
            },
          },
        },
      },

      "/api/agents/{agentId}/tasks/{taskId}/complete": {
        post: {
          tags: ["Agent Management"],
          summary: "Complete task",
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
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    agentKey: { type: "string" },
                    completionNotes: { type: "string" },
                    timeSpent: { type: "number" },
                  },
                  required: ["agentKey"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Task completed",
            },
          },
        },
      },

      "/api/agents/{agentId}/tasks/{taskId}/comments": {
        post: {
          tags: ["Agent Management"],
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
                    content: { type: "string", minLength: 1, maxLength: 5000 },
                    mentions: { type: "array", items: { type: "string" } },
                  },
                  required: ["agentKey", "content"],
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Comment created",
            },
          },
        },
      },

      "/api/agents/{agentId}/tasks/{taskId}/status": {
        patch: {
          tags: ["Agent Management"],
          summary: "Update task status",
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
                    status: {
                      type: "string",
                      enum: ["backlog", "ready", "in_progress", "review", "blocked", "done"],
                    },
                  },
                  required: ["agentKey", "status"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Status updated",
            },
          },
        },
      },

      "/api/agents/{agentId}/tasks/{taskId}/tags": {
        patch: {
          tags: ["Agent Management"],
          summary: "Update task tags",
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
                    tags: { type: "array", items: { type: "string" } },
                    action: { type: "string", enum: ["add", "remove"] },
                  },
                  required: ["agentKey", "tags", "action"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Tags updated",
            },
          },
        },
      },

      // STATE ENGINE
      "/api/state-engine/metrics": {
        get: {
          tags: ["State Engine"],
          summary: "Get real-time metrics",
          parameters: [
            {
              name: "businessId",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Metrics snapshot",
            },
          },
        },
      },

      "/api/state-engine/alerts": {
        get: {
          tags: ["State Engine"],
          summary: "Get alert rules",
          parameters: [
            {
              name: "businessId",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Alert rules",
            },
          },
        },
      },

      "/api/state-engine/decisions": {
        get: {
          tags: ["State Engine"],
          summary: "Get audit trail",
          parameters: [
            {
              name: "businessId",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer" },
            },
          ],
          responses: {
            "200": {
              description: "Decisions",
            },
          },
        },
      },

      "/api/state-engine/actions/escalate": {
        post: {
          tags: ["State Engine"],
          summary: "Escalate task",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    businessId: { type: "string" },
                    taskId: { type: "string" },
                    reason: { type: "string" },
                    decidedBy: { type: "string" },
                  },
                  required: ["businessId", "taskId", "reason", "decidedBy"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Task escalated",
            },
          },
        },
      },

      "/api/state-engine/actions/reassign": {
        post: {
          tags: ["State Engine"],
          summary: "Reassign task",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    businessId: { type: "string" },
                    taskId: { type: "string" },
                    toAgent: { type: "string" },
                    reason: { type: "string" },
                  },
                  required: ["businessId", "taskId", "toAgent", "reason"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Task reassigned",
            },
          },
        },
      },

      "/api/state-engine/actions/unblock": {
        post: {
          tags: ["State Engine"],
          summary: "Unblock task",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    businessId: { type: "string" },
                    taskId: { type: "string" },
                    reason: { type: "string" },
                  },
                  required: ["businessId", "taskId", "reason"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Task unblocked",
            },
          },
        },
      },

      "/api/state-engine/actions/mark-executed": {
        post: {
          tags: ["State Engine"],
          summary: "Mark task executed",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    businessId: { type: "string" },
                    taskId: { type: "string" },
                    outcome: { type: "string" },
                  },
                  required: ["businessId", "taskId", "outcome"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Task marked executed",
            },
          },
        },
      },

      // BUSINESSES
      "/api/businesses": {
        get: {
          tags: ["Businesses"],
          summary: "List all businesses",
          responses: {
            "200": {
              description: "Businesses list",
            },
          },
        },
      },

      // CALENDAR
      "/api/calendar/events": {
        get: {
          tags: ["Calendar"],
          summary: "List calendar events",
          responses: {
            "200": {
              description: "Events list",
            },
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
            "200": {
              description: "Event details",
            },
          },
        },
      },

      "/api/calendar/slots": {
        get: {
          tags: ["Calendar"],
          summary: "Get available slots",
          parameters: [
            {
              name: "startDate",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "endDate",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Available slots",
            },
          },
        },
      },

      // EPICS
      "/api/epics/list": {
        get: {
          tags: ["Epics"],
          summary: "List all epics",
          parameters: [
            {
              name: "businessId",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Epics list",
            },
          },
        },
      },

      // GOALS
      "/api/goals/seed-demo": {
        get: {
          tags: ["Goals"],
          summary: "Seed demo goals",
          responses: {
            "200": {
              description: "Demo created",
            },
          },
        },
      },

      "/api/goals/cleanup-demo": {
        get: {
          tags: ["Goals"],
          summary: "Clean up demo",
          responses: {
            "200": {
              description: "Demo cleaned",
            },
          },
        },
      },

      // MEMORY
      "/api/memory/list": {
        get: {
          tags: ["Memory"],
          summary: "List memory entries",
          responses: {
            "200": {
              description: "Memory entries",
            },
          },
        },
      },

      "/api/memory/search": {
        get: {
          tags: ["Memory"],
          summary: "Search memory",
          parameters: [
            {
              name: "query",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer" },
            },
          ],
          responses: {
            "200": {
              description: "Search results",
            },
          },
        },
      },

      "/api/memory/context": {
        get: {
          tags: ["Memory"],
          summary: "Get memory context",
          responses: {
            "200": {
              description: "Context data",
            },
          },
        },
      },

      "/api/memory/content": {
        get: {
          tags: ["Memory"],
          summary: "Get memory content",
          responses: {
            "200": {
              description: "Memory content",
            },
          },
        },
      },

      // REPORTS
      "/api/reports/strategic-weekly": {
        get: {
          tags: ["Reports"],
          summary: "Get weekly report",
          parameters: [
            {
              name: "businessId",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Weekly report",
            },
          },
        },
      },

      // TASKS
      "/api/tasks/generate-daily": {
        get: {
          tags: ["Tasks"],
          summary: "Generate daily tasks",
          parameters: [
            {
              name: "businessId",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Tasks generated",
            },
          },
        },
      },

      "/api/tasks/execute": {
        get: {
          tags: ["Tasks"],
          summary: "Execute task",
          responses: {
            "200": {
              description: "Task executed",
            },
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
            "200": {
              description: "Calendar events",
            },
          },
        },
      },

      // ADMIN
      "/api/admin/agents/setup-workspace": {
        get: {
          tags: ["Admin"],
          summary: "Setup agent workspace",
          responses: {
            "200": {
              description: "Workspace configured",
            },
          },
        },
      },

      "/api/admin/migrations/agent-workspace-paths": {
        get: {
          tags: ["Admin"],
          summary: "Run workspace migration",
          responses: {
            "200": {
              description: "Migration completed",
            },
          },
        },
      },

      "/api/agents/workspace/structure": {
        get: {
          tags: ["Admin"],
          summary: "Get workspace structure",
          responses: {
            "200": {
              description: "Workspace structure",
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
      },
      securitySchemes: {
        agentAuth: {
          type: "http",
          scheme: "bearer",
          description: "Agent API key authentication",
        },
        headerAuth: {
          type: "apiKey",
          in: "header",
          name: "agentKey",
          description: "Agent API key in header",
        },
      },
    },
    tags: [
      {
        name: "Agent Management",
        description: "Agent lifecycle, tasks, and operations",
      },
      {
        name: "State Engine",
        description: "Metrics, alerts, decisions, and actions",
      },
      {
        name: "Businesses",
        description: "Business workspace management",
      },
      {
        name: "Calendar",
        description: "Calendar events and scheduling",
      },
      {
        name: "Epics",
        description: "Epic management and roadmap",
      },
      {
        name: "Goals",
        description: "Goals and objectives",
      },
      {
        name: "Memory",
        description: "Agent memory and brain",
      },
      {
        name: "Reports",
        description: "Strategic reports and analytics",
      },
      {
        name: "Tasks",
        description: "Task generation and execution",
      },
      {
        name: "Admin",
        description: "Administrative operations",
      },
    ],
  };
}
