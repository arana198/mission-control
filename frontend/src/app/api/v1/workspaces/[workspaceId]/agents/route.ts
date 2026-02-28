/**
 * GET /api/v1/workspaces/{workspaceId}/agents
 * POST /api/v1/workspaces/{workspaceId}/agents
 *
 * RESTful agent management endpoints — v1 REST API standardized format
 *
 * GET - List all agents in workspace (requires Bearer token or legacy auth)
 *       Supports cursor pagination: ?limit=20&cursor=abc123
 * POST - Register new agent or get existing agent
 *        Returns 201 for new agents, 200 for existing
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { verifyAgent } from "@/lib/agent-auth";
import {
  RegisterAgentSchema,
  validateAgentInput,
} from "@/lib/validators/agentValidators";
import { createLogger } from "@/lib/utils/logger";
import {
  extractWorkspaceIdFromPath,
  parsePaginationFromRequest,
  createListResponseObject,
  validateWorkspaceAccess,
  getWorkspaceIdFromUrl,
  createErrorResponseObject,
} from "@/lib/api/routeHelpers";
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from "@/lib/api/errors";
import { generateRequestId } from "@/lib/api/responses";
import { extractAuth, isAuthRequired } from "@/lib/api/auth";
import { requireWorkspaceRole } from "@/lib/api/rbac";

const log = createLogger("api:v1:agents");

// Create Convex client lazily to support testing with mocks
function getConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

/**
 * GET /api/v1/workspaces/{workspaceId}/agents
 * List all agents in a workspace with cursor pagination
 *
 * Query Parameters:
 *   limit: number (1-100, default 20) - items per page
 *   cursor: string (optional) - base64 encoded pagination cursor
 *
 * Headers:
 *   Authorization: Bearer <token> (primary)
 *   OR X-Agent-ID, X-Agent-Key (legacy fallback)
 *
 * Response: RFC 9457 compliant paginated list
 * {
 *   success: true,
 *   data: [{ id, name, role, level, status }, ...],
 *   pagination: { total, limit, offset, cursor, nextCursor, hasMore },
 *   timestamp: ISO string,
 *   requestId: unique request ID
 * }
 */
export async function GET(
  request: NextRequest,
  context: any
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    // Extract workspace ID from URL
    const workspaceId = context.params.workspaceId;
    if (!workspaceId) {
      throw new NotFoundError(
        "Workspace ID not found in request path",
        pathname
      );
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

    // Parse pagination parameters
    const searchParams = new URL(request.url).searchParams;
    const paginationParams = parsePaginationFromRequest(searchParams, 20);

    // Validate workspace membership using RBAC (via middleware-injected headers)
    const callerId = request.headers.get("x-api-key-id");
    if (!callerId) {
      return NextResponse.json(
        createErrorResponseObject(401, "unauthorized", "Unauthorized", "API key required", pathname, requestId),
        { status: 401 }
      );
    }

    try {
      await requireWorkspaceRole(workspaceId, callerId, "viewer");
    } catch (err) {
      if (err instanceof NotFoundError) {
        return NextResponse.json(
          createErrorResponseObject(404, "not_found", "Not Found", "Workspace not found", pathname, requestId),
          { status: 404 }
        );
      }
      throw err;
    }

    // Query agents from Convex
    const convex = getConvexClient();
    const agents = await convex.query(api.agents.getAllAgents);

    // Filter and sanitize agent list (all agents for now, later add workspace filtering)
    const agentList = agents.map((a: any) => ({
      id: a._id,
      name: a.name,
      role: a.role,
      level: a.level,
      status: a.status,
    }));

    log.info("Agents list requested", {
      workspaceId,
      count: agentList.length,
      requestId,
    });

    // Create paginated response
    const response = createListResponseObject(
      agentList,
      agentList.length,
      paginationParams.limit!,
      0
    );

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
    log.error("Error listing agents", { error, requestId });

    // Handle known error types
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

    // Handle unknown errors
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
 * POST /api/v1/workspaces/{workspaceId}/agents
 * Register a new agent or get existing agent's API key
 *
 * Body:
 * {
 *   name: string (required)
 *   role: string (required)
 *   level: "lead" | "specialist" | "intern" (required)
 *   sessionKey: string (required)
 *   workspacePath: string (required)
 *   capabilities?: string[]
 *   model?: string
 *   personality?: string
 * }
 *
 * Response: RFC 9457 compliant
 * {
 *   success: true,
 *   data: { agentId, apiKey, isNew },
 *   timestamp: ISO string,
 *   requestId: unique request ID
 * }
 *
 * Status Codes:
 * - 201: New agent created
 * - 200: Existing agent retrieved
 */
export async function POST(
  request: NextRequest,
  context: any
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    // Extract workspace ID from URL
    const workspaceId = context.params.workspaceId;
    if (!workspaceId) {
      throw new NotFoundError(
        "Workspace ID not found in request path",
        pathname
      );
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

    // Validate workspace membership using RBAC (via middleware-injected headers)
    const callerId = request.headers.get("x-api-key-id");
    if (!callerId) {
      return NextResponse.json(
        createErrorResponseObject(401, "unauthorized", "Unauthorized", "API key required", pathname, requestId),
        { status: 401 }
      );
    }

    try {
      await requireWorkspaceRole(workspaceId, callerId, "collaborator");
    } catch (err) {
      if (err instanceof NotFoundError) {
        return NextResponse.json(
          createErrorResponseObject(404, "not_found", "Not Found", "Workspace not found", pathname, requestId),
          { status: 404 }
        );
      }
      throw err;
    }

    // Validate input against schema
    const input = validateAgentInput(RegisterAgentSchema, body);

    // Generate API key
    const generatedApiKey = crypto.randomUUID();

    // Call Convex — create or get agent
    const convex = getConvexClient();
    const result = await convex.mutation(api.agents.register, {
      name: input.name,
      role: input.role,
      level: input.level,
      sessionKey: input.sessionKey,
      capabilities: input.capabilities,
      model: input.model,
      personality: input.personality,
      workspacePath: input.workspacePath,
      generatedApiKey,
    });

    log.info("Agent registered", {
      workspaceId,
      agentId: result.agentId,
      isNew: result.isNew,
      name: input.name,
      requestId,
    });

    const statusCode = result.isNew ? 201 : 200;

    return NextResponse.json(
      {
        success: true,
        data: {
          agentId: result.agentId,
          apiKey: result.apiKey,
          isNew: result.isNew,
        },
        timestamp: new Date().toISOString(),
        requestId,
      },
      {
        status: statusCode,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
      }
    );
  } catch (error) {
    log.error("Error registering agent", { error, requestId });

    // Handle known error types
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

    // Handle unknown errors
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
