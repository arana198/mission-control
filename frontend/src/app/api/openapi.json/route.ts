/**
 * OpenAPI Spec Endpoint
 * Returns the OpenAPI 3.0 specification for the Mission Control API
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createOpenAPIDocument,
  addRoute,
  standardErrorResponses,
  createPathParameters,
  createQueryParameters,
  successResponseSchema,
  paginatedResponseSchema,
} from "@/lib/api/openapi";

/**
 * Generate OpenAPI spec for all API endpoints
 * This is a foundation that will be extended as routes are migrated to /api/v1/
 */
function generateOpenAPISpec() {
  const doc = createOpenAPIDocument("Mission Control API", "1.0.0");

  // Example: Health Check endpoint (public)
  addRoute(doc, {
    path: "/api/health",
    method: "GET",
    summary: "Health Check",
    description: "Check API health status",
    tags: ["Health"],
    responses: {
      "200": {
        description: "API is healthy",
        content: {
          "application/json": {
            schema: successResponseSchema({
              type: "object",
              properties: {
                status: { type: "string", example: "healthy" },
                timestamp: { type: "string", format: "date-time" },
              },
            }),
          },
        },
      },
    },
  });

  // Example: List Workspaces endpoint
  const pathParams = createPathParameters();
  const queryParams = createQueryParameters();

  addRoute(doc, {
    path: "/api/v1/workspaces/{workspaceId}/agents",
    method: "GET",
    summary: "List Agents",
    description: "Get all agents in a workspace with pagination support",
    tags: ["Agents"],
    parameters: [
      pathParams.workspaceId,
      queryParams.limit,
      queryParams.cursor,
    ],
    responses: {
      "200": {
        description: "List of agents",
        content: {
          "application/json": {
            schema: paginatedResponseSchema({
              type: "object",
              properties: {
                id: { type: "string", example: "agent-123" },
                name: { type: "string", example: "Jarvis" },
                role: { type: "string", example: "Squad Lead" },
                status: {
                  type: "string",
                  enum: ["idle", "active", "blocked"],
                  example: "active",
                },
              },
            }),
          },
        },
      },
      ...standardErrorResponses(),
    },
  });

  // Example: Create Agent endpoint
  addRoute(doc, {
    path: "/api/v1/workspaces/{workspaceId}/agents",
    method: "POST",
    summary: "Create Agent",
    description: "Create a new agent in a workspace",
    tags: ["Agents"],
    parameters: [pathParams.workspaceId],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["name", "role"],
            properties: {
              name: { type: "string", example: "Jarvis" },
              role: { type: "string", example: "Squad Lead" },
              sessionKey: { type: "string", example: "agent:main:main" },
            },
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Agent created successfully",
        content: {
          "application/json": {
            schema: successResponseSchema({
              type: "object",
              properties: {
                id: { type: "string", example: "agent-123" },
                name: { type: "string", example: "Jarvis" },
                role: { type: "string", example: "Squad Lead" },
                createdAt: { type: "string", format: "date-time" },
              },
            }),
          },
        },
      },
      ...standardErrorResponses(),
    },
  });

  // Example: Get Agent endpoint
  addRoute(doc, {
    path: "/api/v1/workspaces/{workspaceId}/agents/{agentId}",
    method: "GET",
    summary: "Get Agent",
    description: "Retrieve details of a specific agent",
    tags: ["Agents"],
    parameters: [
      pathParams.workspaceId,
      {
        ...pathParams.resourceId,
        name: "agentId",
        description: "Agent ID",
      },
    ],
    responses: {
      "200": {
        description: "Agent details",
        content: {
          "application/json": {
            schema: successResponseSchema({
              type: "object",
              properties: {
                id: { type: "string", example: "agent-123" },
                name: { type: "string", example: "Jarvis" },
                role: { type: "string", example: "Squad Lead" },
                status: { type: "string", enum: ["idle", "active", "blocked"] },
              },
            }),
          },
        },
      },
      ...standardErrorResponses(),
    },
  });

  // Example: Update Agent endpoint
  addRoute(doc, {
    path: "/api/v1/workspaces/{workspaceId}/agents/{agentId}",
    method: "PUT",
    summary: "Update Agent",
    description: "Update an agent's properties",
    tags: ["Agents"],
    parameters: [
      pathParams.workspaceId,
      {
        ...pathParams.resourceId,
        name: "agentId",
        description: "Agent ID",
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string", example: "Jarvis" },
              role: { type: "string", example: "Squad Lead" },
              status: {
                type: "string",
                enum: ["idle", "active", "blocked"],
                example: "active",
              },
            },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Agent updated successfully",
        content: {
          "application/json": {
            schema: successResponseSchema({
              type: "object",
              properties: {
                id: { type: "string", example: "agent-123" },
                name: { type: "string", example: "Jarvis" },
                role: { type: "string", example: "Squad Lead" },
                status: { type: "string", enum: ["idle", "active", "blocked"] },
              },
            }),
          },
        },
      },
      ...standardErrorResponses(),
    },
  });

  // Example: Delete Agent endpoint
  addRoute(doc, {
    path: "/api/v1/workspaces/{workspaceId}/agents/{agentId}",
    method: "DELETE",
    summary: "Delete Agent",
    description: "Remove an agent from a workspace",
    tags: ["Agents"],
    parameters: [
      pathParams.workspaceId,
      {
        ...pathParams.resourceId,
        name: "agentId",
        description: "Agent ID",
      },
    ],
    responses: {
      "204": {
        description: "Agent deleted successfully",
      },
      ...standardErrorResponses(),
    },
  });

  // Example: Agent Heartbeat endpoint
  addRoute(doc, {
    path: "/api/v1/workspaces/{workspaceId}/agents/{agentId}/heartbeat",
    method: "POST",
    summary: "Agent Heartbeat",
    description: "Send periodic heartbeat to indicate agent is active",
    tags: ["Agents"],
    parameters: [
      pathParams.workspaceId,
      {
        ...pathParams.resourceId,
        name: "agentId",
        description: "Agent ID",
      },
    ],
    requestBody: {
      required: false,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: ["active", "idle", "blocked"],
                example: "active",
              },
              metrics: {
                type: "object",
                properties: {
                  cpuUsage: { type: "number", example: 45.2 },
                  memoryUsage: { type: "number", example: 62.1 },
                  taskCount: { type: "number", example: 3 },
                },
              },
            },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Heartbeat recorded successfully",
        content: {
          "application/json": {
            schema: successResponseSchema({
              type: "object",
              properties: {
                agentId: { type: "string", example: "agent-123" },
                status: { type: "string", enum: ["active", "idle", "blocked"] },
                lastHeartbeat: { type: "string", format: "date-time" },
                nextHeartbeatIn: {
                  type: "number",
                  description: "Expected next heartbeat interval in milliseconds",
                  example: 30000,
                },
              },
            }),
          },
        },
      },
      ...standardErrorResponses(),
    },
  });

  // Example: Agent Poll for Work endpoint
  addRoute(doc, {
    path: "/api/v1/workspaces/{workspaceId}/agents/{agentId}/poll",
    method: "GET",
    summary: "Poll for Work",
    description: "Poll for pending work/tasks assigned to the agent",
    tags: ["Agents"],
    parameters: [
      pathParams.workspaceId,
      {
        ...pathParams.resourceId,
        name: "agentId",
        description: "Agent ID",
      },
      {
        name: "timeout",
        in: "query",
        description: "Long-poll timeout in milliseconds (1000-60000)",
        schema: { type: "number", example: 30000 },
      },
      {
        name: "filter",
        in: "query",
        description: "Task filter criteria",
        schema: { type: "string", example: "priority:high" },
      },
    ],
    responses: {
      "200": {
        description: "Pending work item or null if none available",
        content: {
          "application/json": {
            schema: successResponseSchema({
              oneOf: [
                {
                  type: "object",
                  properties: {
                    taskId: { type: "string", example: "task-123" },
                    type: { type: "string", example: "task" },
                    priority: {
                      type: "string",
                      enum: ["low", "normal", "high"],
                      example: "high",
                    },
                    payload: { type: "object" },
                    assignedAt: { type: "string", format: "date-time" },
                  },
                },
                { type: "null", example: null },
              ],
            }),
          },
        },
      },
      ...standardErrorResponses(),
    },
  });

  // Example: Agent Rotate API Key endpoint
  addRoute(doc, {
    path: "/api/v1/workspaces/{workspaceId}/agents/{agentId}/rotate-key",
    method: "POST",
    summary: "Rotate API Key",
    description: "Rotate the agent's API key for security purposes",
    tags: ["Agents"],
    parameters: [
      pathParams.workspaceId,
      {
        ...pathParams.resourceId,
        name: "agentId",
        description: "Agent ID",
      },
    ],
    responses: {
      "200": {
        description: "API key rotated successfully",
        content: {
          "application/json": {
            schema: successResponseSchema({
              type: "object",
              properties: {
                agentId: { type: "string", example: "agent-123" },
                newApiKey: {
                  type: "string",
                  description: "New API key (UUID format)",
                  example: "550e8400-e29b-41d4-a716-446655440000",
                },
                oldKeyExpiresAt: {
                  type: "string",
                  format: "date-time",
                  description: "When the old API key will expire (24 hour grace period)",
                },
                rotatedAt: { type: "string", format: "date-time" },
              },
            }),
          },
        },
      },
      ...standardErrorResponses(),
    },
  });

  return doc;
}

export async function GET(request: NextRequest) {
  try {
    const spec = generateOpenAPISpec();

    return NextResponse.json(spec, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("Error generating OpenAPI spec:", error);

    return NextResponse.json(
      {
        type: "https://api.mission-control.dev/errors/internal_error",
        title: "Internal Server Error",
        detail: "Failed to generate OpenAPI specification",
        instance: "/api/openapi.json",
        status: 500,
        requestId: request.headers.get("x-request-id") || "unknown",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
