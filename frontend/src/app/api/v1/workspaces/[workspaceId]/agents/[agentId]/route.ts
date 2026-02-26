/**
 * GET /api/v1/workspaces/{workspaceId}/agents/{agentId}
 * PUT /api/v1/workspaces/{workspaceId}/agents/{agentId}
 * DELETE /api/v1/workspaces/{workspaceId}/agents/{agentId}
 *
 * RESTful agent detail endpoints — v1 REST API standardized format
 *
 * GET - Retrieve agent details
 * PUT - Update agent properties (name, role, level, etc.)
 * DELETE - Remove agent from workspace
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  UpdateAgentSchema,
  validateAgentInput,
} from "@/lib/validators/agentValidators";
import { createLogger } from "@/lib/utils/logger";
import {
  extractWorkspaceIdFromPath,
  createSuccessResponseObject,
  validateWorkspaceAccess,
  getWorkspaceIdFromUrl,
} from "@/lib/api/routeHelpers";
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from "@/lib/api/errors";
import { generateRequestId } from "@/lib/api/responses";
import { extractAuth, isAuthRequired } from "@/lib/api/auth";

const log = createLogger("api:v1:agents:detail");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/v1/workspaces/{workspaceId}/agents/{agentId}
 * Retrieve details for a specific agent
 *
 * Response: RFC 9457 compliant agent details
 * {
 *   success: true,
 *   data: { id, name, role, level, status, capabilities, model, personality, createdAt, updatedAt },
 *   timestamp: ISO string,
 *   requestId: unique request ID
 * }
 */
export async function GET(
  request: NextRequest,
  context: { params: { workspaceId: string; agentId: string } }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    // Extract workspace and agent IDs from URL
    const workspaceId = context.params.workspaceId;
    const agentId = context.params.agentId;

    if (!workspaceId) {
      throw new NotFoundError(
        "Workspace ID not found in request path",
        pathname
      );
    }

    if (!agentId) {
      throw new NotFoundError("Agent ID not found in request path", pathname);
    }

    // Validate authentication
    const authHeader = request.headers.get("authorization");
    const headers = Object.fromEntries(request.headers.entries());

    if (isAuthRequired(pathname)) {
      try {
        extractAuth(authHeader || "", headers);
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          return NextResponse.json(
            {
              type: "https://api.mission-control.dev/errors/unauthorized",
              title: "Unauthorized",
              detail: error.message,
              instance: pathname,
              status: 401,
              requestId,
              timestamp: new Date().toISOString(),
            },
            { status: 401, headers: { "X-Request-ID": requestId } }
          );
        }
        throw error;
      }
    }

    // Query agent from Convex
    const agent = await convex.query(api.agents.getAgent, {
      agentId,
      workspaceId,
    });

    if (!agent) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: `Agent with ID ${agentId} not found in workspace ${workspaceId}`,
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Agent details retrieved", {
      workspaceId,
      agentId,
      requestId,
    });

    // Create response
    const response = createSuccessResponseObject({
      id: agent._id,
      name: agent.name,
      role: agent.role,
      level: agent.level,
      status: agent.status,
      capabilities: agent.capabilities || [],
      model: agent.model || null,
      personality: agent.personality || null,
      createdAt: agent._creationTime,
      updatedAt: agent._creationTime,
    });

    return NextResponse.json(
      {
        ...response,
        requestId,
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
      }
    );
  } catch (error) {
    log.error("Error retrieving agent", { error, requestId });

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: error.message,
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/unauthorized",
          title: "Unauthorized",
          detail: error.message,
          instance: pathname,
          status: 401,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 401, headers: { "X-Request-ID": requestId } }
      );
    }

    return NextResponse.json(
      {
        type: "https://api.mission-control.dev/errors/internal_error",
        title: "Internal Server Error",
        detail: "An unexpected error occurred",
        instance: pathname,
        status: 500,
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: { "X-Request-ID": requestId } }
    );
  }
}

/**
 * PUT /api/v1/workspaces/{workspaceId}/agents/{agentId}
 * Update agent properties
 *
 * Body:
 * {
 *   name?: string
 *   role?: string
 *   level?: "lead" | "specialist" | "intern"
 *   status?: "active" | "idle" | "blocked"
 *   capabilities?: string[]
 *   model?: string
 *   personality?: string
 * }
 *
 * Response: RFC 9457 compliant with updated agent data
 */
export async function PUT(
  request: NextRequest,
  context: { params: { workspaceId: string; agentId: string } }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    // Extract workspace and agent IDs from URL
    const workspaceId = context.params.workspaceId;
    const agentId = context.params.agentId;

    if (!workspaceId) {
      throw new NotFoundError(
        "Workspace ID not found in request path",
        pathname
      );
    }

    if (!agentId) {
      throw new NotFoundError("Agent ID not found in request path", pathname);
    }

    // Validate authentication
    const authHeader = request.headers.get("authorization");
    const headers = Object.fromEntries(request.headers.entries());

    if (isAuthRequired(pathname)) {
      try {
        extractAuth(authHeader || "", headers);
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          return NextResponse.json(
            {
              type: "https://api.mission-control.dev/errors/unauthorized",
              title: "Unauthorized",
              detail: error.message,
              instance: pathname,
              status: 401,
              requestId,
              timestamp: new Date().toISOString(),
            },
            { status: 401, headers: { "X-Request-ID": requestId } }
          );
        }
        throw error;
      }
    }

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body", pathname);
    }

    if (!body) {
      throw new ValidationError("Request body is required", pathname);
    }

    // Validate input against schema
    const input = validateAgentInput(UpdateAgentSchema, body);

    // Call Convex — update agent
    const result = await convex.mutation(api.agents.updateAgent, {
      agentId,
      workspaceId,
      ...input,
    });

    if (!result) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: `Agent with ID ${agentId} not found`,
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Agent updated", {
      workspaceId,
      agentId,
      requestId,
    });

    const response = createSuccessResponseObject({
      id: result._id,
      name: result.name,
      role: result.role,
      level: result.level,
      status: result.status,
      capabilities: result.capabilities || [],
      model: result.model || null,
      personality: result.personality || null,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        ...response,
        requestId,
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
      }
    );
  } catch (error) {
    log.error("Error updating agent", { error, requestId });

    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/validation_error",
          title: "Validation Error",
          detail: error.message,
          instance: pathname,
          status: 400,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400, headers: { "X-Request-ID": requestId } }
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/unauthorized",
          title: "Unauthorized",
          detail: error.message,
          instance: pathname,
          status: 401,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 401, headers: { "X-Request-ID": requestId } }
      );
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: error.message,
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    return NextResponse.json(
      {
        type: "https://api.mission-control.dev/errors/internal_error",
        title: "Internal Server Error",
        detail: "An unexpected error occurred",
        instance: pathname,
        status: 500,
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: { "X-Request-ID": requestId } }
    );
  }
}

/**
 * DELETE /api/v1/workspaces/{workspaceId}/agents/{agentId}
 * Remove agent from workspace
 *
 * Response: RFC 9457 compliant success response (204 No Content or 200 with empty data)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: { workspaceId: string; agentId: string } }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    // Extract workspace and agent IDs from URL
    const workspaceId = context.params.workspaceId;
    const agentId = context.params.agentId;

    if (!workspaceId) {
      throw new NotFoundError(
        "Workspace ID not found in request path",
        pathname
      );
    }

    if (!agentId) {
      throw new NotFoundError("Agent ID not found in request path", pathname);
    }

    // Validate authentication
    const authHeader = request.headers.get("authorization");
    const headers = Object.fromEntries(request.headers.entries());

    if (isAuthRequired(pathname)) {
      try {
        extractAuth(authHeader || "", headers);
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          return NextResponse.json(
            {
              type: "https://api.mission-control.dev/errors/unauthorized",
              title: "Unauthorized",
              detail: error.message,
              instance: pathname,
              status: 401,
              requestId,
              timestamp: new Date().toISOString(),
            },
            { status: 401, headers: { "X-Request-ID": requestId } }
          );
        }
        throw error;
      }
    }

    // Call Convex — delete agent
    const result = await convex.mutation(api.agents.deleteAgent, {
      agentId,
      workspaceId,
    });

    if (!result) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: `Agent with ID ${agentId} not found`,
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Agent deleted", {
      workspaceId,
      agentId,
      requestId,
    });

    // Return 204 No Content for DELETE success
    return new NextResponse(null, {
      status: 204,
      headers: {
        "X-Request-ID": requestId,
      },
    });
  } catch (error) {
    log.error("Error deleting agent", { error, requestId });

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: error.message,
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/unauthorized",
          title: "Unauthorized",
          detail: error.message,
          instance: pathname,
          status: 401,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 401, headers: { "X-Request-ID": requestId } }
      );
    }

    return NextResponse.json(
      {
        type: "https://api.mission-control.dev/errors/internal_error",
        title: "Internal Server Error",
        detail: "An unexpected error occurred",
        instance: pathname,
        status: 500,
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: { "X-Request-ID": requestId } }
    );
  }
}
