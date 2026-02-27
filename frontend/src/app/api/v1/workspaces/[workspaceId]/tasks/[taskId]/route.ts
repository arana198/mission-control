/**
 * GET/PUT/DELETE /api/v1/workspaces/{workspaceId}/tasks/{taskId}
 *
 * Task detail endpoints — v1 REST API standardized format
 *
 * GET - Retrieve single task
 * PUT - Update task
 * DELETE - Delete task
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";
import { createErrorResponseObject } from "@/lib/api/routeHelpers";
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from "@/lib/api/errors";
import { generateRequestId } from "@/lib/api/responses";
import { extractAuth, isAuthRequired } from "@/lib/api/auth";

const log = createLogger("api:v1:workspaces:tasks:detail");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/v1/workspaces/{workspaceId}/tasks/{taskId}
 * Retrieve single task
 *
 * Response: RFC 9457 compliant with task details
 */
export async function GET(
  request: NextRequest,
  context: { params: { workspaceId: string; taskId: string } }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    const { workspaceId, taskId } = context.params;

    if (!workspaceId) {
      throw new NotFoundError(
        "Workspace ID not found in request path",
        pathname
      );
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

    // Query task from Convex
    const task = await convex.query(api.tasks.getTask, {
      workspaceId,
      taskId,
    });

    if (!task) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: "Task not found",
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Task retrieved", {
      workspaceId,
      taskId,
      requestId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: task._id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          createdAt: task._creationTime,
          updatedAt: task._creationTime,
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
    log.error("Error retrieving task", { error, requestId });

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
 * PUT /api/v1/workspaces/{workspaceId}/tasks/{taskId}
 * Update task
 *
 * Body:
 * {
 *   title: string (required, 1-200 chars)
 *   description: string (optional, max 5000 chars)
 *   priority: string (optional - low, normal, high)
 *   status: string (optional - pending, in_progress, completed)
 * }
 *
 * Response: RFC 9457 compliant with updated task
 */
export async function PUT(
  request: NextRequest,
  context: { params: { workspaceId: string; taskId: string } }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    const { workspaceId, taskId } = context.params;

    if (!workspaceId) {
      throw new NotFoundError(
        "Workspace ID not found in request path",
        pathname
      );
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

    // Validate at least one field is provided
    if (
      !body.title &&
      !body.description &&
      !body.priority &&
      !body.status
    ) {
      throw new ValidationError(
        "At least one field must be provided for update",
        pathname
      );
    }

    // Validate title if provided
    if (body.title !== undefined) {
      if (typeof body.title !== "string") {
        throw new ValidationError("Task title must be a string", pathname);
      }

      if (body.title.trim().length === 0) {
        throw new ValidationError("Task title cannot be empty", pathname);
      }

      if (body.title.length > 200) {
        throw new ValidationError(
          "Task title cannot exceed 200 characters",
          pathname
        );
      }
    }

    // Validate description if provided
    if (
      body.description !== undefined &&
      body.description !== null
    ) {
      if (typeof body.description !== "string") {
        throw new ValidationError("Task description must be a string", pathname);
      }

      if (body.description.length > 5000) {
        throw new ValidationError(
          "Task description cannot exceed 5000 characters",
          pathname
        );
      }
    }

    // Validate priority if provided
    if (
      body.priority !== undefined &&
      ![
        "low",
        "normal",
        "high",
      ].includes(body.priority)
    ) {
      throw new ValidationError("Invalid task priority", pathname);
    }

    // Validate status if provided
    if (
      body.status !== undefined &&
      !["pending", "in_progress", "completed"].includes(body.status)
    ) {
      throw new ValidationError("Invalid task status", pathname);
    }

    // Call Convex — update task
    const task = await convex.mutation(api.tasks.updateTask, {
      workspaceId,
      taskId,
      title: body.title || undefined,
      description: body.description !== undefined ? body.description : undefined,
      priority: body.priority || undefined,
      status: body.status || undefined,
    });

    if (!task) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: "Task not found",
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Task updated", {
      workspaceId,
      taskId,
      requestId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: task._id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          createdAt: task._creationTime,
          updatedAt: task._creationTime,
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
    log.error("Error updating task", { error, requestId });

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
 * DELETE /api/v1/workspaces/{workspaceId}/tasks/{taskId}
 * Delete task
 *
 * Response: RFC 9457 compliant with deletion confirmation
 */
export async function DELETE(
  request: NextRequest,
  context: { params: { workspaceId: string; taskId: string } }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    const { workspaceId, taskId } = context.params;

    if (!workspaceId) {
      throw new NotFoundError(
        "Workspace ID not found in request path",
        pathname
      );
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

    // Call Convex — delete task
    const deleted = await convex.mutation(api.tasks.deleteTask, {
      workspaceId,
      taskId,
    });

    if (!deleted) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: "Task not found",
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Task deleted", {
      workspaceId,
      taskId,
      requestId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          deleted: true,
          taskId,
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
    log.error("Error deleting task", { error, requestId });

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
