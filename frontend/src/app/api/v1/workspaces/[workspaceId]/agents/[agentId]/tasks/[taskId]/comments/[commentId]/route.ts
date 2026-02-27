/**
 * GET/PUT/DELETE /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}/comments/{commentId}
 *
 * Agent task comment detail endpoints — v1 REST API standardized format
 *
 * GET - Get comment details
 * PUT - Update comment content
 * DELETE - Delete comment
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";
import {
  createErrorResponseObject,
} from "@/lib/api/routeHelpers";
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from "@/lib/api/errors";
import { generateRequestId } from "@/lib/api/responses";
import { extractAuth, isAuthRequired } from "@/lib/api/auth";

const log = createLogger("api:v1:agents:tasks:comments:detail");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}/comments/{commentId}
 * Get comment details
 *
 * Response: RFC 9457 compliant comment object
 */
export async function GET(
  request: NextRequest,
  context: any
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    const { workspaceId, agentId, taskId, commentId } = context.params;

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

    if (!commentId) {
      throw new NotFoundError(
        "Comment ID not found in request path",
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

    // Query comment from Convex
    const comment = await convex.query(api.agents.getTaskComment, {
      commentId,
    });

    if (!comment) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: `Comment with ID ${commentId} not found`,
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Task comment retrieved", {
      workspaceId,
      agentId,
      taskId,
      commentId,
      requestId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: comment._id,
          content: comment.content,
          authorId: comment.agentId,
          authorName: comment.agentName,
          createdAt: new Date(comment.createdAt).toISOString(),
          updatedAt: new Date(comment.updatedAt).toISOString(),
        },
        requestId,
        timestamp: new Date().toISOString(),
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
    log.error("Error retrieving task comment", { error, requestId });

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
 * PUT /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}/comments/{commentId}
 * Update comment content
 *
 * Body:
 * {
 *   content: string (required, 1-5000 chars)
 * }
 *
 * Response: RFC 9457 compliant with updated comment
 */
export async function PUT(
  request: NextRequest,
  context: any
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    const { workspaceId, agentId, taskId, commentId } = context.params;

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

    if (!commentId) {
      throw new NotFoundError(
        "Comment ID not found in request path",
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

    if (!body.content || typeof body.content !== "string") {
      throw new ValidationError("Comment content is required", pathname);
    }

    if (body.content.trim().length === 0) {
      throw new ValidationError("Comment content cannot be empty", pathname);
    }

    if (body.content.length > 5000) {
      throw new ValidationError(
        "Comment content exceeds maximum length",
        pathname
      );
    }

    // Call Convex — update comment
    const comment = await convex.mutation(api.agents.updateTaskComment, {
      commentId,
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
          detail: `Comment with ID ${commentId} not found`,
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Task comment updated", {
      workspaceId,
      agentId,
      taskId,
      commentId,
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
          updatedAt: comment._creationTime,
        },
        requestId,
        timestamp: new Date().toISOString(),
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
    log.error("Error updating task comment", { error, requestId });

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
 * DELETE /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}/comments/{commentId}
 * Delete comment
 *
 * Response: RFC 9457 compliant with success confirmation
 */
export async function DELETE(
  request: NextRequest,
  context: any
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    const { workspaceId, agentId, taskId, commentId } = context.params;

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

    if (!commentId) {
      throw new NotFoundError(
        "Comment ID not found in request path",
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

    // Call Convex — delete comment
    const result = await convex.mutation(api.agents.deleteTaskComment, {
      commentId,
      taskId,
      agentId,
      workspaceId,
    });

    if (!result) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: `Comment with ID ${commentId} not found`,
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Task comment deleted", {
      workspaceId,
      agentId,
      taskId,
      commentId,
      requestId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: commentId,
          deleted: true,
        },
        requestId,
        timestamp: new Date().toISOString(),
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
    log.error("Error deleting task comment", { error, requestId });

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
