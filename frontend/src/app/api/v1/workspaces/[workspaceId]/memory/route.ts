/**
 * GET/POST /api/v1/workspaces/{workspaceId}/memory
 *
 * Memory management endpoints — v1 REST API standardized format
 *
 * GET - List memory entries with pagination
 * POST - Create new memory entry
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

const log = createLogger("api:v1:workspaces:memory");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/v1/workspaces/{workspaceId}/memory
 * List memory entries with pagination
 *
 * Query Parameters:
 * - limit: number (1-100, default 20)
 * - cursor: string (pagination cursor)
 * - type: string (optional - filter by memory type)
 *
 * Response: RFC 9457 compliant paginated memory list
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
    const { limit, cursor } = parsePaginationFromRequest(request);

    // Get optional type filter from query
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || undefined;

    // Query memory entries from Convex
    const memory = await convex.query(api.memory.listMemory, {
      workspaceId,
      limit,
      cursor,
      type,
    });

    log.info("Workspace memory listed", {
      workspaceId,
      count: memory.items?.length || 0,
      requestId,
    });

    const response = createListResponse(memory.items || [], {
      total: memory.total || 0,
      cursor: memory.nextCursor,
      hasMore: !!memory.nextCursor,
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
    log.error("Error listing workspace memory", { error, requestId });

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
 * POST /api/v1/workspaces/{workspaceId}/memory
 * Create new memory entry
 *
 * Body:
 * {
 *   title: string (required, 1-200 chars)
 *   content: string (required, max 10000 chars)
 *   type: string (optional - knowledge, task, decision, note)
 * }
 *
 * Response: RFC 9457 compliant with created memory entry
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
      throw new ValidationError("Memory title is required", pathname);
    }

    if (body.title.trim().length === 0) {
      throw new ValidationError("Memory title cannot be empty", pathname);
    }

    if (body.title.length > 200) {
      throw new ValidationError(
        "Memory title cannot exceed 200 characters",
        pathname
      );
    }

    if (!body.content || typeof body.content !== "string") {
      throw new ValidationError("Memory content is required", pathname);
    }

    if (body.content.length > 10000) {
      throw new ValidationError(
        "Memory content cannot exceed 10000 characters",
        pathname
      );
    }

    // Validate optional type field
    if (body.type && typeof body.type !== "string") {
      throw new ValidationError("Memory type must be a string", pathname);
    }

    if (body.type && ![
      "knowledge",
      "task",
      "decision",
      "note",
    ].includes(body.type)) {
      throw new ValidationError("Invalid memory type", pathname);
    }

    // Call Convex — create memory entry
    const memory = await convex.mutation(api.memory.createMemory, {
      workspaceId,
      title: body.title,
      content: body.content,
      type: body.type || null,
    });

    if (!memory) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: "Failed to create memory entry",
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Memory entry created", {
      workspaceId,
      memoryId: memory._id,
      requestId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: memory._id,
          title: memory.title,
          content: memory.content,
          type: memory.type,
          createdAt: memory._creationTime,
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
    log.error("Error creating memory entry", { error, requestId });

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
