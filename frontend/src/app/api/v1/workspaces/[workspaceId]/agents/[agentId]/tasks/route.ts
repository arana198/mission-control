/**
 * GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks
 * POST /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks
 *
 * Agent task management endpoints — v1 REST API standardized format
 *
 * GET - List all tasks assigned to an agent with cursor pagination
 * POST - Create a new task for an agent
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";
import {
  extractWorkspaceIdFromPath,
  parsePaginationFromRequest,
  createListResponseObject,
} from "@/lib/api/routeHelpers";
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from "@/lib/api/errors";
import { generateRequestId } from "@/lib/api/responses";
import { extractAuth, isAuthRequired } from "@/lib/api/auth";

const log = createLogger("api:v1:agents:tasks");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks
 * List all tasks assigned to an agent with pagination support
 *
 * Query Parameters:
 *   limit: number (1-100, default 20) - items per page
 *   cursor: string (optional) - base64 encoded pagination cursor
 *   status: string (optional) - filter by status (pending, in_progress, completed)
 *
 * Response: RFC 9457 compliant paginated list
 */
export async function GET(
  request: NextRequest,
  context: any
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

    // Parse pagination and filter parameters
    const searchParams = new URL(request.url).searchParams;
    const paginationParams = parsePaginationFromRequest(searchParams, 20);
    const statusFilter = searchParams.get("status") || undefined;

    // Query tasks from Convex
    const tasks = await convex.query(api.agents.getAgentTasks, {
      agentId,
    });

    // Filter and sanitize task list
    const taskList = (tasks || []).map((t: any) => ({
      id: t._id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      createdAt: t._creationTime,
      updatedAt: t._creationTime,
    }));

    log.info("Agent tasks listed", {
      workspaceId,
      agentId,
      count: taskList.length,
      requestId,
    });

    // Create paginated response
    const response = createListResponseObject(
      taskList,
      taskList.length,
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
    log.error("Error listing agent tasks", { error, requestId });

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
 * POST /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks
 * Create a new task assigned to an agent
 *
 * Body:
 * {
 *   title: string (required)
 *   description?: string
 *   priority?: "low" | "normal" | "high"
 *   dueDate?: ISO date string
 *   tags?: string[]
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

    // Validate required fields
    if (!body.title || typeof body.title !== "string") {
      throw new ValidationError("Title is required and must be a string", pathname);
    }

    if (body.priority && !["low", "normal", "high"].includes(body.priority)) {
      throw new ValidationError("Invalid priority value", pathname);
    }

    // Map priority from API format to internal format
    const priorityMap: { [key: string]: string } = {
      low: "P3",
      normal: "P2",
      high: "P1",
    };
    const internalPriority = body.priority ? priorityMap[body.priority] : "P2";

    // Call Convex — create task
    const taskId = await convex.mutation(api.agents.createAgentTask, {
      agentId,
      workspaceId,
      title: body.title,
      description: body.description || undefined,
      priority: internalPriority,
      dueDate: body.dueDate || undefined,
      tags: body.tags || [],
    });

    // Fetch the created task to return full details
    const task = await convex.query(api.tasks.getTask, { taskId: taskId as any });

    if (!task) {
      throw new NotFoundError("Created task not found", pathname);
    }

    log.info("Agent task created", {
      workspaceId,
      agentId,
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
          status: task.status || "pending",
          priority: task.priority,
          dueDate: task.dueDate,
          createdAt: new Date(task.createdAt).toISOString(),
        },
        timestamp: new Date().toISOString(),
        requestId,
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
    log.error("Error creating agent task", { error, requestId });

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
