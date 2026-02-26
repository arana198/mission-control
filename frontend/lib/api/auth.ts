/**
 * Authentication Utilities
 * Validates Bearer tokens and legacy API headers
 */

import { InvalidTokenError, MissingAuthError, UnauthorizedError } from "./errors";

export interface BearerToken {
  apiKeyId: string;
  token: string;
}

export interface LegacyAuth {
  agentId: string;
  apiKey: string;
}

export interface WorkspaceContext {
  workspaceId: string;
  rest: string;
}

/**
 * Extract workspace ID from pathname
 * Expected format: /api/v1/workspaces/{id}/...
 *
 * @param pathname The request pathname
 * @returns WorkspaceContext or throws 400
 * @throws InvalidTokenError if path format is invalid
 */
export function extractWorkspaceId(pathname: string): WorkspaceContext {
  // Match pattern: /api/v1/workspaces/{id}/rest
  // or: /api/workspaces/{id}/rest (legacy)
  const match = pathname.match(/^\/api(\/v1)?\/workspaces\/([^/]+)(.*)$/);

  if (!match || !match[2]) {
    throw new InvalidTokenError("Invalid API path format. Expected: /api/v1/workspaces/{id}/...", pathname);
  }

  const workspaceId = match[2];
  const rest = match[3] || "/";

  if (!workspaceId.trim()) {
    throw new InvalidTokenError("Workspace ID cannot be empty", pathname);
  }

  return { workspaceId, rest };
}

/**
 * Validate Bearer token from Authorization header
 * Expected format: Authorization: Bearer {token}
 *
 * @param authHeader Value of Authorization header
 * @returns BearerToken or throws 401
 * @throws MissingAuthError if header is missing
 * @throws InvalidTokenError if format is invalid
 */
export function validateBearerToken(authHeader?: string): BearerToken {
  if (!authHeader) {
    throw new MissingAuthError();
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i); // Case-insensitive

  if (!match || !match[1]) {
    throw new InvalidTokenError("Invalid Authorization header format. Expected: Bearer {token}", "/api");
  }

  const token = match[1].trim();

  if (!token) {
    throw new InvalidTokenError("Token cannot be empty", "/api");
  }

  // API key ID is typically the token itself or derived from it
  // In a real system, you might validate against a database
  return {
    apiKeyId: token,
    token,
  };
}

/**
 * Validate legacy auth headers (agentId + agentKey)
 * Expected headers:
 *   - X-Agent-ID: {agentId}
 *   - X-Agent-Key: {apiKey}
 *
 * @param headers Request headers object
 * @returns LegacyAuth or throws 401
 * @throws MissingAuthError if headers are missing
 * @throws InvalidTokenError if format is invalid
 */
export function validateLegacyAuth(headers: Record<string, string | string[] | undefined>): LegacyAuth {
  // Normalize header keys to lowercase for case-insensitive lookup
  const normalizedHeaders: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }

  const agentId = Array.isArray(normalizedHeaders["x-agent-id"])
    ? normalizedHeaders["x-agent-id"][0]
    : (normalizedHeaders["x-agent-id"] as string | undefined);

  const apiKey = Array.isArray(normalizedHeaders["x-agent-key"])
    ? normalizedHeaders["x-agent-key"][0]
    : (normalizedHeaders["x-agent-key"] as string | undefined);

  if (!agentId || !apiKey) {
    throw new MissingAuthError();
  }

  if (typeof agentId !== "string" || !agentId.trim()) {
    throw new InvalidTokenError("Invalid X-Agent-ID header", "/api");
  }

  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new InvalidTokenError("Invalid X-Agent-Key header", "/api");
  }

  return {
    agentId: agentId.trim(),
    apiKey: apiKey.trim(),
  };
}

/**
 * Extract auth from request (try Bearer first, then legacy)
 * Supports dual auth mode for backwards compatibility
 *
 * @param authHeader Authorization header value
 * @param headers Request headers
 * @returns { type: 'bearer' | 'legacy', value: BearerToken | LegacyAuth }
 * @throws UnauthorizedError if both auth methods fail
 */
export function extractAuth(
  authHeader?: string,
  headers?: Record<string, string | string[] | undefined>
): { type: "bearer" | "legacy"; value: BearerToken | LegacyAuth } {
  let bearerError: Error | null = null;

  // Try Bearer first
  if (authHeader && authHeader.toLowerCase().startsWith("bearer")) {
    try {
      return { type: "bearer", value: validateBearerToken(authHeader) };
    } catch (err) {
      bearerError = err as Error;
    }
  }

  // Try legacy headers
  if (headers) {
    try {
      return { type: "legacy", value: validateLegacyAuth(headers) };
    } catch (err) {
      // Fall through
    }
  }

  // Both failed
  if (bearerError) {
    throw bearerError;
  }

  throw new MissingAuthError();
}

/**
 * Check if pathname should require authentication
 * Some endpoints might be public (health checks, etc)
 *
 * @param pathname The request pathname
 * @returns true if auth is required, false if endpoint is public
 */
export function isAuthRequired(pathname: string): boolean {
  // Public endpoints that don't require auth
  const publicPaths = ["/api/health", "/api/status", "/api/docs", "/api/openapi.json"];

  return !publicPaths.some((path) => pathname.startsWith(path));
}

/**
 * Validate API key format (basic check)
 * Real validation would check against database
 *
 * @param apiKey The API key to validate
 * @returns true if format is valid
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== "string") {
    return false;
  }

  // Basic format validation: at least 8 characters, alphanumeric + underscore/dash
  return /^[a-zA-Z0-9_-]{8,}$/.test(apiKey);
}
