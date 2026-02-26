/**
 * GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}
 *
 * RESTful task detail endpoint — v1 REST API standardized format
 *
 * GET - Retrieve specific task details for an agent
 *       Returns task metadata, status, progress, and history
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";
import {
  createSuccessResponseObject,
  validateWorkspaceAccess,
} from "@/lib/api/routeHelpers";
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from "@/lib/api/errors";
import { generateRequestId } from "@/lib/api/responses";
import { extractAuth, isAuthRequired } from "@/lib/api/auth";

const log = createLogger("api:v1:agents:task-detail");

// Create Convex client lazily to support testing with mocks
function getConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

/**
 * GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}
 * Retrieve specific task details for an agent
 *
 * Path Parameters:
 *   workspaceId: string (required) - workspace identifier
 *   agentId: string (required) - agent identifier
 *   taskId: string (required) - task identifier
 *
 * Headers:
 *   Authorization: Bearer <token> (required)
 *
 * Response: RFC 9457 compliant single object
 * {
 *   success: true,
 *   data: {
 *     id: string,
 *     agentId: string,
 *     title: string,
 *     description: string,
 *     status: "pending" | "in-progress" | "completed" | "failed",
 *     priority: "low" | "medium" | "high",
 *     progress: number (0-100),
 *     createdAt: ISO string,
 *     updatedAt: ISO string,
 *     dueDate?: ISO string,
 *     metrics?: {
 *       startedAt?: ISO string,
 *       completedAt?: ISO string,
 *       duration?: number (seconds),
 *       tokens?: number,
 *       cost?: number
 *     }
 *   },
 *   timestamp: ISO string,
 *   requestId: unique request ID
 * }
 */
export async function GET(
  request: NextRequest,
  context: {
    params: { workspaceId: string; agentId: string; taskId: string };
  }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    // Extract IDs from URL
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

    // Query task from Convex
    const convex = getConvexClient();
    const task = await convex.query(api.agents.getTask, {
      taskId,
      agentId,
    });

    if (!task) {
      throw new NotFoundError(`Task ${taskId} not found for agent ${agentId}`);
    }

    // Sanitize and format task data
    const taskData = {
      id: task._id,
      agentId: task.agentId,
      title: task.title,
      description: task.description,
      status: task.status || "pending",
      priority: task.priority || "medium",
      progress: task.progress || 0,
      createdAt: task._creationTime
        ? new Date(task._creationTime).toISOString()
        : new Date().toISOString(),
      updatedAt: task.updatedAt
        ? new Date(task.updatedAt).toISOString()
        : new Date().toISOString(),
      ...(task.dueDate && { dueDate: new Date(task.dueDate).toISOString() }),
      ...(task.metrics && {
        metrics: {
          ...(task.metrics.startedAt && {
            startedAt: new Date(task.metrics.startedAt).toISOString(),
          }),
          ...(task.metrics.completedAt && {
            completedAt: new Date(task.metrics.completedAt).toISOString(),
          }),
          ...(task.metrics.duration && { duration: task.metrics.duration }),
          ...(task.metrics.tokens && { tokens: task.metrics.tokens }),
          ...(task.metrics.cost && { cost: task.metrics.cost }),
        },
      }),
    };

    log.info("Task detail retrieved", {
      workspaceId,
      agentId,
      taskId,
      status: taskData.status,
      requestId,
    });

    // Create success response
    const response = createSuccessResponseObject(taskData);

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
    log.error("Error retrieving task detail", { error, requestId });

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
