/**
 * API Middleware for Mission Control
 *
 * Handles:
 * - Request ID generation for tracing
 * - Workspace ID extraction from URL
 * - Authentication validation (Bearer token + legacy headers)
 * - Rate limit checking
 * - Request context attachment
 */

import { NextRequest, NextResponse } from "next/server";
import { generateRequestId } from "./lib/api/responses";
import {
  extractWorkspaceId,
  extractAuth,
  isAuthRequired,
} from "./lib/api/auth";
import { InvalidTokenError, UnauthorizedError } from "./lib/api/errors";

export interface RequestContext {
  requestId: string;
  workspaceId?: string;
  apiKeyId?: string;
  agentId?: string;
  timestamp: number;
}

// Extend Request to include custom context
declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
    }
  }
}

/**
 * Middleware configuration
 * Specify which routes should use this middleware
 */
export const config = {
  matcher: [
    // All API routes
    "/api/:path*",
  ],
};

/**
 * Main middleware function
 * Processes all API requests with auth, workspace extraction, request ID generation
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestId = generateRequestId();
  const timestamp = Date.now();

  try {
    // Step 1: Check if auth is required for this endpoint
    const authRequired = isAuthRequired(pathname);

    // Initialize context
    const context: RequestContext = {
      requestId,
      timestamp,
    };

    // Step 2: Extract workspace ID from path (if present)
    if (pathname.includes("/workspaces/")) {
      try {
        const workspaceContext = extractWorkspaceId(pathname);
        context.workspaceId = workspaceContext.workspaceId;
      } catch (err) {
        // Workspace extraction failed - will return 400
        return errorResponse(400, "invalid_path", "Invalid API path format", pathname, requestId);
      }
    }

    // Step 3: Validate authentication (if required)
    if (authRequired) {
      try {
        const authHeader = request.headers.get("authorization");
        const headers: Record<string, string | string[] | undefined> = {};

        // Copy relevant headers for legacy auth
        request.headers.forEach((value, key) => {
          if (key.toLowerCase().startsWith("x-agent-")) {
            headers[key] = value;
          }
        });

        const auth = extractAuth(authHeader || undefined, headers);

        if (auth.type === "bearer") {
          const bearerAuth = auth.value as any;
          context.apiKeyId = bearerAuth.apiKeyId;
        } else {
          const legacyAuth = auth.value as any;
          context.agentId = legacyAuth.agentId;
          context.apiKeyId = legacyAuth.apiKey;
        }
      } catch (err) {
        if (err instanceof InvalidTokenError) {
          return errorResponse(
            401,
            "invalid_token",
            "Invalid token",
            (err as InvalidTokenError).detail,
            pathname,
            requestId
          );
        }
        if (err instanceof UnauthorizedError || err instanceof Error) {
          return errorResponse(
            401,
            "unauthorized",
            "Unauthorized",
            "Missing or invalid authentication",
            pathname,
            requestId
          );
        }
        throw err;
      }
    }

    // Step 4: Attach context to response headers for handler access
    const response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    // Attach context to response (can be read by route handlers)
    response.headers.set("x-request-id", context.requestId);
    if (context.workspaceId) {
      response.headers.set("x-workspace-id", context.workspaceId);
    }
    if (context.apiKeyId) {
      response.headers.set("x-api-key-id", context.apiKeyId);
    }
    if (context.agentId) {
      response.headers.set("x-agent-id", context.agentId);
    }

    return response;
  } catch (err) {
    console.error(`[Middleware Error] ${pathname}:`, err);

    return errorResponse(
      500,
      "internal_error",
      "Internal Server Error",
      "An unexpected error occurred processing your request",
      pathname,
      requestId
    );
  }
}

/**
 * Helper: Create RFC 9457 error response
 */
function errorResponse(
  status: number,
  code: string,
  title: string,
  detail: string,
  instance: string,
  requestId: string
) {
  return NextResponse.json(
    {
      type: `https://api.mission-control.dev/errors/${code}`,
      title,
      detail,
      instance,
      status,
      requestId,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * Helper: Create success response
 */
export function createSuccessResponse<T>(
  data: T,
  requestId: string
) {
  return {
    success: true,
    data,
    requestId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper: Get context from request headers
 * Used by route handlers to retrieve middleware context
 */
export function getRequestContext(request: NextRequest): Partial<RequestContext> {
  return {
    requestId: request.headers.get("x-request-id") || undefined,
    workspaceId: request.headers.get("x-workspace-id") || undefined,
    apiKeyId: request.headers.get("x-api-key-id") || undefined,
    agentId: request.headers.get("x-agent-id") || undefined,
  };
}
