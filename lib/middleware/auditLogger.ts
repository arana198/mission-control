/**
 * Audit Logging Middleware
 * Logs all agent API calls for compliance and debugging
 * Tracks: timestamp, endpoint, agent ID, method, status, response time
 */

import { createLogger } from "@/lib/utils/logger";

const log = createLogger("audit:agents");

export interface AuditLogEntry {
  timestamp: number;
  requestId: string;
  endpoint: string;
  method: string;
  agentId?: string;
  statusCode: number;
  responseTimeMs: number;
  authMethod?: "header" | "body";
  reason?: string; // For key rotation
  error?: string;
}

/**
 * Extract agent ID from URL path
 * Pattern: /api/agents/{agentId}/...
 */
function extractAgentIdFromPath(path: string): string | undefined {
  const match = path.match(/\/api\/agents\/([^/]+)/);
  return match ? match[1] : undefined;
}

/**
 * Log agent API request (called before handler)
 */
export function logAgentRequestStart(
  requestId: string,
  request: Request
): { startTime: number; agentId?: string; endpoint: string } {
  const url = new URL(request.url);
  const endpoint = url.pathname;
  const agentId = extractAgentIdFromPath(endpoint);
  const authMethod = request.headers.get("Authorization") ? "header" : "body";

  log.info("Agent API request started", {
    requestId,
    endpoint,
    method: request.method,
    agentId,
    authMethod,
  });

  return {
    startTime: Date.now(),
    agentId,
    endpoint,
  };
}

/**
 * Log agent API request completion (called after handler)
 */
export function logAgentRequestEnd(
  requestId: string,
  startTime: number,
  statusCode: number,
  endpoint: string,
  agentId?: string,
  reason?: string,
  error?: string
): AuditLogEntry {
  const responseTimeMs = Date.now() - startTime;

  const entry: AuditLogEntry = {
    timestamp: Date.now(),
    requestId,
    endpoint,
    method: "POST", // Agent API mostly uses POST
    agentId,
    statusCode,
    responseTimeMs,
    authMethod: "header",
    reason,
    error,
  };

  // Determine log level based on status code
  if (statusCode >= 500) {
    log.error("Agent API request failed (server error)", entry as unknown as Record<string, unknown>);
  } else if (statusCode >= 400) {
    log.warn("Agent API request failed (client error)", entry as unknown as Record<string, unknown>);
  } else {
    log.info("Agent API request completed", entry as unknown as Record<string, unknown>);
  }

  return entry;
}

/**
 * Audit log for specific agent events (e.g., key rotation)
 */
export function logAgentEvent(
  eventType: "key_rotated" | "auth_failed" | "rate_limited" | "registration",
  agentId: string,
  details: Record<string, any>
): void {
  const entry = {
    timestamp: Date.now(),
    event: eventType,
    agentId,
    ...details,
  };

  log.info(`Agent event: ${eventType}`, entry);
}

/**
 * Audit log for auth failures (helps detect attacks)
 */
export function logAuthFailure(
  agentId: string,
  reason: "invalid_credentials" | "agent_not_found" | "key_expired",
  requestId?: string
): void {
  log.warn("Agent auth failure", {
    timestamp: Date.now(),
    agentId,
    reason,
    requestId,
  });
}

/**
 * Audit log for rate limit violations
 */
export function logRateLimitViolation(
  agentId: string,
  endpoint: string,
  attemptCount: number,
  requestId?: string
): void {
  log.warn("Rate limit violated", {
    timestamp: Date.now(),
    agentId,
    endpoint,
    attemptCount,
    requestId,
  });
}
