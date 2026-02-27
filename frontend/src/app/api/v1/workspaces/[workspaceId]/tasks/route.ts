/**
 * GET/POST /api/v1/workspaces/{workspaceId}/tasks
 *
 * Task management endpoints — v1 REST API standardized format
 *
 * GET - List tasks with pagination
 * POST - Create new task
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";
import {
  createListResponse,
  createErrorResponseObject,
  parsePaginationFromRequest,
} from "@/lib/api/routeHelpers";
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from "@/lib/api/errors";
import { generateRequestId } from "@/lib/api/responses";
import { extractAuth, isAuthRequired } from "@/lib/api/auth";

const log = createLogger("api:v1:workspaces:tasks");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/v1/workspaces/{workspaceId}/tasks
 * List tasks with pagination
 *
 * Query Parameters:
 * - limit: number (1-100, default 20)
 * - cursor: string (pagination cursor)
 * - status: string (optional - filter by status)
 *
 * Response: RFC 9457 compliant paginated task list
 */
export async function GET(
  request: NextRequest,
  context: any
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
    const url = new URL(request.url);
    const { limit, cursor } = parsePaginationFromRequest(url.searchParams);

    // Get optional status filter from query
    const status = url.searchParams.get("status") || undefined;

    // Query tasks from Convex
    const allTasks = await convex.query(api.tasks.listTasks);

    // Filter and apply pagination locally
    let filteredTasks = allTasks as any[];
    if (status) {
      filteredTasks = filteredTasks.filter((t: any) => t.status === status);
    }

    // Apply pagination
    const pageLimit = limit || 20;
    const startIndex = pageLimit * (cursor ? parseInt(atob(cursor).split(":")[1]) : 0);
    const paginatedTasks = filteredTasks.slice(startIndex, startIndex + pageLimit);
    const tasks = {
      items: paginatedTasks,
      total: filteredTasks.length,
    };

    log.info("Workspace tasks listed", {
      workspaceId,
      count: tasks.items?.length || 0,
      requestId,
    });

    const offset = cursor ? parseInt(atob(cursor).split(":")[1]) : 0;
    const response = createListResponse(tasks.items || [], tasks.total || 0, pageLimit, offset);

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
    log.error("Error listing workspace tasks", { error, requestId });

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
 * POST /api/v1/workspaces/{workspaceId}/tasks
 * Create new task
 *
 * Body:
 * {
 *   title: string (required, 1-200 chars)
 *   description: string (optional, max 5000 chars)
 *   priority: string (optional - low, normal, high)
 *   status: string (optional - pending, in_progress, completed)
 * }
 *
 * Response: RFC 9457 compliant with created task
 */
export async function POST(
  request: NextRequest,
  context: any
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

    if (!body.title || typeof body.title !== "string") {
      throw new ValidationError("Task title is required", pathname);
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

    // Validate optional fields
    if (body.description && typeof body.description !== "string") {
      throw new ValidationError("Task description must be a string", pathname);
    }

    if (body.description && body.description.length > 5000) {
      throw new ValidationError(
        "Task description cannot exceed 5000 characters",
        pathname
      );
    }

    if (
      body.priority &&
      !["low", "normal", "high"].includes(body.priority)
    ) {
      throw new ValidationError("Invalid task priority", pathname);
    }

    if (
      body.status &&
      !["pending", "in_progress", "completed"].includes(body.status)
    ) {
      throw new ValidationError("Invalid task status", pathname);
    }

    // Call Convex — create task
    const task = await convex.mutation(api.tasks.createTask, {
      workspaceId,
      title: body.title,
      description: body.description || null,
      priority: body.priority || "normal",
      status: body.status || "pending",
    });

    if (!task) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: "Failed to create task",
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Task created", {
      workspaceId,
      taskId: task._id,
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
    log.error("Error creating task", { error, requestId });

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
