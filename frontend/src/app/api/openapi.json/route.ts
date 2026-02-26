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
