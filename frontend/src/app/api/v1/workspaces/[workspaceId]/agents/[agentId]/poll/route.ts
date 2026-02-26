/**
 * GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/poll
 *
 * Agent work polling endpoint — v1 REST API standardized format
 *
 * GET - Poll for work/tasks assigned to the agent
 *       Returns pending tasks or null if nothing to do
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";
import {
  createSuccessResponseObject,
  parsePaginationFromRequest,
} from "@/lib/api/routeHelpers";
import {
  UnauthorizedError,
  NotFoundError,
} from "@/lib/api/errors";
import { generateRequestId } from "@/lib/api/responses";
import { extractAuth, isAuthRequired } from "@/lib/api/auth";

const log = createLogger("api:v1:agents:poll");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/poll
 * Poll for pending work/tasks assigned to the agent
 *
 * Query Parameters:
 *   timeout: number (optional, default 30000ms) - long-poll timeout
 *   filter: string (optional) - task filter criteria (e.g., "priority:high")
 *
 * Response: RFC 9457 compliant work item or null
 * {
 *   success: true,
 *   data: {
 *     taskId,
 *     type,
 *     priority,
 *     payload,
 *     assignedAt
 *   } | null,
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

    // Parse optional query parameters
    const searchParams = new URL(request.url).searchParams;
    const timeoutStr = searchParams.get("timeout");
    const filter = searchParams.get("filter") || undefined;

    // Validate timeout (min 1s, max 60s for long-poll)
    let timeout = 30000; // default 30s
    if (timeoutStr) {
      const parsedTimeout = parseInt(timeoutStr);
      if (isNaN(parsedTimeout) || parsedTimeout < 1000 || parsedTimeout > 60000) {
        return NextResponse.json(
          {
            type: "https://api.mission-control.dev/errors/validation_error",
            title: "Validation Error",
            detail: "timeout must be between 1000 and 60000 milliseconds",
            instance: pathname,
            status: 400,
            requestId,
            timestamp: new Date().toISOString(),
          },
          { status: 400, headers: { "X-Request-ID": requestId } }
        );
      }
      timeout = parsedTimeout;
    }

    // Call Convex — poll for work
    const work = await convex.query(api.agents.pollWork, {
      agentId,
      workspaceId,
      filter,
    });

    log.info("Agent polled for work", {
      workspaceId,
      agentId,
      hasWork: !!work,
      requestId,
    });

    const response = createSuccessResponseObject(
      work
        ? {
            taskId: work._id,
            type: work.type || "task",
            priority: work.priority || "normal",
            payload: work.payload || {},
            assignedAt: new Date().toISOString(),
          }
        : null
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
    log.error("Error polling for work", { error, requestId });

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
