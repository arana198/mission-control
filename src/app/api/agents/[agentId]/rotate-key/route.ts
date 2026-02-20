/**
 * POST /api/agents/{agentId}/rotate-key
 *
 * Rotate agent's API key securely
 * Supports grace period for in-flight requests to complete
 *
 * Request: { reason?, gracePeriodSeconds? }
 * Auth: Authorization header or apiKey in body
 * Response: { newApiKey, rotatedAt, oldKeyExpiresAt, gracePeriodSeconds }
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  RotateKeySchema,
  validateAgentInput,
} from "@/lib/validators/agentValidators";
import {
  successResponse,
  handleApiError,
  jsonResponse,
  UnauthorizedError,
} from "@/lib/utils/apiResponse";
import { createLogger } from "@/lib/utils/logger";
import {
  logAgentRequestStart,
  logAgentRequestEnd,
  logAgentEvent,
  logAuthFailure,
  logRateLimitViolation,
} from "@/lib/middleware/auditLogger";

const log = createLogger("api:agents:rotate-key");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Rate limiting: max 3 rotations per agent per hour
 * Stored in memory for this process (simplified for MVP)
 * In production: use Redis or database
 */
const rotationAttempts = new Map<
  string,
  Array<{ timestamp: number; success: boolean }>
>();

function checkRateLimit(agentId: string): boolean {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  // Get attempts for this agent
  const attempts = rotationAttempts.get(agentId) || [];

  // Filter to successful rotations in last hour
  const recentRotations = attempts.filter(
    (a) => a.timestamp > oneHourAgo && a.success
  );

  // Clean up old attempts
  rotationAttempts.set(
    agentId,
    attempts.filter((a) => a.timestamp > oneHourAgo)
  );

  // Max 3 per hour
  return recentRotations.length < 3;
}

function recordRotationAttempt(agentId: string, success: boolean) {
  const attempts = rotationAttempts.get(agentId) || [];
  attempts.push({ timestamp: Date.now(), success });
  rotationAttempts.set(agentId, attempts);
}

export async function POST(
  request: Request,
  context: any
): Promise<Response> {
  const { agentId } = context.params;
  const requestId = crypto.randomUUID();

  // Log request start
  const { startTime } = logAgentRequestStart(requestId, request);

  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      logAgentRequestEnd(
        requestId,
        startTime,
        400,
        `/api/agents/${agentId}/rotate-key`,
        agentId,
        undefined,
        "VALIDATION_ERROR"
      );

      return jsonResponse(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid JSON" },
        },
        400
      );
    }

    // Extract apiKey from Authorization header or body
    let apiKey = body.apiKey;
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      apiKey = authHeader.slice(7);
    }

    // Validate input
    const input = validateAgentInput(RotateKeySchema, {
      agentId,
      apiKey,
      reason: body.reason,
      gracePeriodSeconds: body.gracePeriodSeconds,
    });

    // Check rate limit
    if (!checkRateLimit(input.agentId)) {
      logRateLimitViolation(input.agentId, "/api/agents/{agentId}/rotate-key", 4, requestId);

      logAgentRequestEnd(requestId, startTime, 429, `/api/agents/${input.agentId}/rotate-key`, input.agentId, undefined, "RATE_LIMITED");

      return jsonResponse(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many rotation requests. Maximum 3 per hour.",
            details: {
              retryAfterSeconds: 3600,
            },
          },
        },
        429
      );
    }

    // Generate new API key
    const newApiKey = crypto.randomUUID();

    // Call Convex mutation to rotate key
    const result = await convex.mutation(api.agents.rotateKey, {
      agentId: input.agentId as Id<"agents">,
      apiKey: input.apiKey,
      newApiKey,
      reason: input.reason,
      gracePeriodSeconds: input.gracePeriodSeconds,
    });

    // Record successful rotation
    recordRotationAttempt(input.agentId, true);

    // Log the key rotation event
    logAgentEvent("key_rotated", input.agentId, {
      reason: input.reason,
      gracePeriodSeconds: input.gracePeriodSeconds,
      requestId,
    });

    log.info("API key rotated successfully", {
      agentId: input.agentId,
      reason: input.reason,
      gracePeriodSeconds: input.gracePeriodSeconds,
      requestId,
    });

    // Log request end with success
    logAgentRequestEnd(
      requestId,
      startTime,
      200,
      `/api/agents/${input.agentId}/rotate-key`,
      input.agentId,
      input.reason
    );

    return jsonResponse(
      successResponse({
        agentId: result.agentId,
        newApiKey: result.newApiKey,
        rotatedAt: result.rotatedAt,
        oldKeyExpiresAt: result.oldKeyExpiresAt,
        gracePeriodSeconds: result.gracePeriodSeconds,
      }),
      200,
      {
        "X-Request-Id": requestId,
        "Cache-Control": "no-store",
      }
    );
  } catch (error: any) {
    // Record failed attempt
    if (context.params.agentId) {
      recordRotationAttempt(context.params.agentId, false);
    }

    // Handle specific error types
    if (error.message === "Invalid credentials") {
      logAuthFailure(context.params.agentId, "invalid_credentials", requestId);

      logAgentRequestEnd(
        requestId,
        startTime,
        401,
        `/api/agents/${context.params.agentId}/rotate-key`,
        context.params.agentId,
        undefined,
        "UNAUTHORIZED"
      );

      log.warn("Authentication failed for key rotation", {
        agentId: context.params.agentId,
        reason: "invalid_credentials",
        requestId,
      });

      return jsonResponse(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid agent credentials",
          },
        },
        401,
        {
          "X-Request-Id": requestId,
        }
      );
    }

    if (error.message === "Agent not found") {
      logAgentRequestEnd(
        requestId,
        startTime,
        404,
        `/api/agents/${context.params.agentId}/rotate-key`,
        context.params.agentId,
        undefined,
        "NOT_FOUND"
      );

      return jsonResponse(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Agent not found",
          },
        },
        404,
        {
          "X-Request-Id": requestId,
        }
      );
    }

    // Use standard error handler
    const [errorData, statusCode] = handleApiError(error);

    // Log request end with error
    logAgentRequestEnd(
      requestId,
      startTime,
      statusCode,
      `/api/agents/${context.params.agentId}/rotate-key`,
      context.params.agentId,
      undefined,
      errorData.error?.code
    );

    return jsonResponse(
      errorData,
      statusCode,
      {
        "X-Request-Id": requestId,
      }
    );
  }
}
