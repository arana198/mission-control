/**
 * POST /api/v1/workspaces/{workspaceId}/agents/{agentId}/heartbeat
 *
 * Agent heartbeat endpoint — v1 REST API standardized format
 *
 * POST - Send periodic heartbeat to indicate agent is alive and operational
 *        Updates last active timestamp and reports current status
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";
import {
  createSuccessResponseObject,
  getWorkspaceIdFromUrl,
} from "@/lib/api/routeHelpers";
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from "@/lib/api/errors";
import { generateRequestId } from "@/lib/api/responses";
import { extractAuth, isAuthRequired } from "@/lib/api/auth";

const log = createLogger("api:v1:agents:heartbeat");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * POST /api/v1/workspaces/{workspaceId}/agents/{agentId}/heartbeat
 * Send periodic heartbeat to indicate agent is active
 *
 * Body:
 * {
 *   status: "active" | "idle" | "blocked" (optional)
 *   metrics?: {
 *     cpuUsage?: number
 *     memoryUsage?: number
 *     taskCount?: number
 *   }
 * }
 *
 * Response: RFC 9457 compliant heartbeat response
 * {
 *   success: true,
 *   data: { agentId, status, lastHeartbeat, nextHeartbeatIn },
 *   timestamp: ISO string,
 *   requestId: unique request ID
 * }
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

    // Parse optional request body
    let body: any = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      throw new ValidationError("Invalid JSON body", pathname);
    }

    // Validate status if provided
    const allowedStatuses = ["active", "idle", "blocked"];
    if (body.status && !allowedStatuses.includes(body.status)) {
      throw new ValidationError(
        `Invalid status: must be one of ${allowedStatuses.join(", ")}`,
        pathname
      );
    }

    // Call Convex — record heartbeat
    const result = await convex.mutation(api.agents.recordHeartbeat, {
      agentId,
      workspaceId,
      status: body.status || "active",
      metrics: body.metrics || undefined,
    });

    if (!result) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: `Agent with ID ${agentId} not found`,
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Agent heartbeat recorded", {
      workspaceId,
      agentId,
      status: body.status || "active",
      requestId,
    });

    const response = createSuccessResponseObject({
      agentId,
      status: result.status,
      lastHeartbeat: new Date().toISOString(),
      nextHeartbeatIn: 30000, // Expected next heartbeat in 30 seconds (milliseconds)
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
    log.error("Error recording heartbeat", { error, requestId });

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
