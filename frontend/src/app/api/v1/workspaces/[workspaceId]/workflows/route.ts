/**
 * GET/POST /api/v1/workspaces/{workspaceId}/workflows
 *
 * Workflow management endpoints — v1 REST API standardized format
 *
 * GET - List workflows with pagination
 * POST - Create new workflow
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";
import {
  createListResponse,
  parsePaginationFromRequest,
} from "@/lib/api/routeHelpers";
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from "@/lib/api/errors";
import { generateRequestId } from "@/lib/api/responses";
import { extractAuth, isAuthRequired } from "@/lib/api/auth";

const log = createLogger("api:v1:workspaces:workflows");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/v1/workspaces/{workspaceId}/workflows
 * List workflows with pagination
 *
 * Query Parameters:
 * - limit: number (1-100, default 20)
 * - cursor: string (pagination cursor)
 * - status: string (optional - filter by status)
 *
 * Response: RFC 9457 compliant paginated workflow list
 */
export async function GET(
  request: NextRequest,
  context: { params: { workspaceId: string } }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    const { workspaceId } = context.params;

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
    const { limit, cursor } = parsePaginationFromRequest(request);

    // Get optional status filter from query
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || undefined;

    // Query workflows from Convex
    const workflows = await convex.query(api.workflows.listWorkflows, {
      workspaceId,
      limit,
      cursor,
      status,
    });

    log.info("Workspace workflows listed", {
      workspaceId,
      count: workflows.items?.length || 0,
      requestId,
    });

    const response = createListResponse(workflows.items || [], {
      total: workflows.total || 0,
      cursor: workflows.nextCursor,
      hasMore: !!workflows.nextCursor,
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
    log.error("Error listing workspace workflows", { error, requestId });

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
 * POST /api/v1/workspaces/{workspaceId}/workflows
 * Create new workflow
 *
 * Body:
 * {
 *   name: string (required, 1-200 chars)
 *   description: string (optional, max 5000 chars)
 * }
 *
 * Response: RFC 9457 compliant with created workflow
 */
export async function POST(
  request: NextRequest,
  context: { params: { workspaceId: string } }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    const { workspaceId } = context.params;

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

    if (!body.name || typeof body.name !== "string") {
      throw new ValidationError("Workflow name is required", pathname);
    }

    if (body.name.trim().length === 0) {
      throw new ValidationError("Workflow name cannot be empty", pathname);
    }

    if (body.name.length > 200) {
      throw new ValidationError(
        "Workflow name cannot exceed 200 characters",
        pathname
      );
    }

    // Validate optional fields
    if (body.description && typeof body.description !== "string") {
      throw new ValidationError(
        "Workflow description must be a string",
        pathname
      );
    }

    if (body.description && body.description.length > 5000) {
      throw new ValidationError(
        "Workflow description cannot exceed 5000 characters",
        pathname
      );
    }

    // Call Convex — create workflow
    const workflow = await convex.mutation(api.workflows.createWorkflow, {
      workspaceId,
      name: body.name,
      description: body.description || null,
    });

    if (!workflow) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: "Failed to create workflow",
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Workflow created", {
      workspaceId,
      workflowId: workflow._id,
      requestId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: workflow._id,
          name: workflow.name,
          description: workflow.description,
          createdAt: workflow._creationTime,
        },
        requestId,
        timestamp: new Date().toISOString(),
      },
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
      }
    );
  } catch (error) {
    log.error("Error creating workflow", { error, requestId });

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
