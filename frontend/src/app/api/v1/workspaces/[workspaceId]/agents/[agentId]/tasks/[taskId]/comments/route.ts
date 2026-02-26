/**
 * GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}/comments
 *
 * Agent task comments endpoints — v1 REST API standardized format
 *
 * GET - List task comments with pagination
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";
import {
  createListResponse,
  createErrorResponseObject,
} from "@/lib/api/routeHelpers";
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from "@/lib/api/errors";
import { generateRequestId } from "@/lib/api/responses";
import { extractAuth, isAuthRequired } from "@/lib/api/auth";
import { parsePaginationFromRequest } from "@/lib/api/routeHelpers";

const log = createLogger("api:v1:agents:tasks:comments");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}/comments
 * List task comments with pagination
 *
 * Query Parameters:
 * - limit: number (1-100, default 20)
 * - cursor: string (pagination cursor)
 *
 * Response: RFC 9457 compliant paginated comment list
 */
export async function GET(
  request: NextRequest,
  context: { params: { workspaceId: string; agentId: string; taskId: string } }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    const { workspaceId, agentId, taskId } = context.params;

    if (!workspaceId) {
      throw new NotFoundError(
        "Workspace ID not found in request path",
        pathname
      );
    }

    if (!agentId) {
      throw new NotFoundError("Agent ID not found in request path", pathname);
    }

    if (!taskId) {
      throw new NotFoundError("Task ID not found in request path", pathname);
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

    // Query comments from Convex
    const comments = await convex.query(api.agents.getTaskComments, {
      taskId,
      agentId,
      workspaceId,
      limit,
      cursor,
    });

    log.info("Task comments listed", {
      workspaceId,
      agentId,
      taskId,
      count: comments.items?.length || 0,
      requestId,
    });

    const response = createListResponse(
      comments.items || [],
      {
        total: comments.total || 0,
        cursor: comments.nextCursor,
        hasMore: !!comments.nextCursor,
      }
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
    log.error("Error listing task comments", { error, requestId });

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
 * POST /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}/comments
 * Add task comment
 *
 * Body:
 * {
 *   content: string (required)
 * }
 *
 * Response: RFC 9457 compliant with created comment
 */
export async function POST(
  request: NextRequest,
  context: { params: { workspaceId: string; agentId: string; taskId: string } }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    const { workspaceId, agentId, taskId } = context.params;

    if (!workspaceId) {
      throw new NotFoundError(
        "Workspace ID not found in request path",
        pathname
      );
    }

    if (!agentId) {
      throw new NotFoundError("Agent ID not found in request path", pathname);
    }

    if (!taskId) {
      throw new NotFoundError("Task ID not found in request path", pathname);
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

    if (!body.content || typeof body.content !== "string") {
      throw new ValidationError("Comment content is required", pathname);
    }

    if (body.content.trim().length === 0) {
      throw new ValidationError("Comment content cannot be empty", pathname);
    }

    if (body.content.length > 5000) {
      throw new ValidationError("Comment content exceeds maximum length", pathname);
    }

    // Call Convex — create comment
    const comment = await convex.mutation(api.agents.createTaskComment, {
      taskId,
      agentId,
      workspaceId,
      content: body.content,
    });

    if (!comment) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: `Task with ID ${taskId} not found`,
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Task comment created", {
      workspaceId,
      agentId,
      taskId,
      commentId: comment._id,
      requestId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: comment._id,
          content: comment.content,
          authorId: comment.authorId,
          createdAt: comment._creationTime,
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
    log.error("Error creating task comment", { error, requestId });

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
