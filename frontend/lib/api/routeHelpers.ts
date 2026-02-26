/**
 * Route Migration Helpers
 * Reusable utilities for standardizing API routes during migration to /api/v1/
 *
 * Features:
 * - Standardized response formatting (RFC 9457 for errors, consistent success format)
 * - Pagination helper for list endpoints
 * - Workspace ID extraction and validation
 * - Rate limit checking and enforcement
 * - Request context attachment
 */

import {
  successResponse,
  errorResponse,
  rateLimitExceeded,
  listResponse,
} from "./responses";
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  RateLimitExceededError,
  InternalServerError,
} from "./errors";
import {
  parsePaginationParams,
  createPaginatedResponse,
} from "./pagination";
import { generateRequestId } from "./responses";

export interface RouteHandlerOptions {
  requireAuth?: boolean;
  checkRateLimit?: boolean;
  methods?: ("GET" | "POST" | "PUT" | "PATCH" | "DELETE")[];
}

export interface PaginationOptions {
  limit?: number;
  cursor?: string;
  defaultLimit?: number;
}

/**
 * Extract workspace ID from request URL
 * Supports both /api/v1/workspaces/{id}/... and /api/workspaces/{id}/... formats
 *
 * @param pathname URL pathname from request
 * @returns {workspaceId: string} or null if not found
 */
export function extractWorkspaceIdFromPath(pathname: string): string | null {
  const match = pathname.match(
    /\/api\/(?:v\d+\/)?workspaces\/([a-zA-Z0-9_-]+)/
  );
  return match ? match[1] : null;
}

/**
 * Parse pagination parameters from request
 *
 * @param searchParams URLSearchParams from request
 * @param defaultLimit Default items per page (default: 20)
 * @returns {limit, cursor, defaultLimit}
 */
export function parsePaginationFromRequest(
  searchParams: URLSearchParams,
  defaultLimit: number = 20
): PaginationOptions {
  const limitStr = searchParams.get("limit");
  const cursor = searchParams.get("cursor") || undefined;

  const parsedParams = parsePaginationParams(limitStr ? parseInt(limitStr) : undefined, cursor);

  return {
    limit: parsedParams.limit,
    cursor,
    defaultLimit,
  };
}

/**
 * Create a standardized paginated response for list endpoints
 * Includes success flag, data wrapper, and timestamp for RFC compliance
 *
 * @param items Array of items to paginate
 * @param total Total count of items (before pagination)
 * @param limit Items per page
 * @param offset Current offset in result set
 * @returns RFC 9457 compliant paginated response with success flag and timestamp
 */
export function createListResponse(
  items: any[],
  total: number,
  limit: number,
  offset: number
) {
  return listResponse(items, total, limit, offset);
}

/**
 * Validate workspace access
 * Check if user has access to the workspace
 *
 * @param workspaceId Workspace ID from URL
 * @param userWorkspaceIds Array of workspace IDs user has access to
 * @throws ForbiddenError if no access
 */
export function validateWorkspaceAccess(
  workspaceId: string,
  userWorkspaceIds: string[]
): void {
  if (!userWorkspaceIds.includes(workspaceId)) {
    throw new ForbiddenError(
      "You do not have access to this workspace",
      `GET /api/v1/workspaces/${workspaceId}`
    );
  }
}

/**
 * Check if request method is allowed
 *
 * @param method HTTP method from request
 * @param allowedMethods Array of allowed methods
 * @returns true if allowed
 */
export function isMethodAllowed(
  method: string,
  allowedMethods: string[]
): boolean {
  return allowedMethods.includes(method);
}

/**
 * Helper to get workspace ID from URL and validate
 *
 * @param url URL string
 * @returns Workspace ID
 * @throws NotFoundError if workspace ID not found in URL
 */
export function getWorkspaceIdFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const workspaceId = extractWorkspaceIdFromPath(pathname);

  if (!workspaceId) {
    throw new NotFoundError(
      "Workspace ID not found in request path",
      pathname
    );
  }

  return workspaceId;
}

/**
 * Create error response object (plain data, not NextResponse)
 *
 * @param status HTTP status code
 * @param errorCode Error code (e.g., "validation_error")
 * @param title Error title
 * @param detail Error detail message
 * @param instance Request instance (pathname)
 * @param requestId Request ID for tracing
 * @returns Error response object
 */
export function createErrorResponseObject(
  status: number,
  errorCode: string,
  title: string,
  detail: string,
  instance: string,
  requestId: string
) {
  return errorResponse(status, errorCode, title, detail, instance, requestId);
}

/**
 * Create success response object (plain data, not NextResponse)
 *
 * @param data Response data (optional)
 * @param meta Optional metadata
 * @returns Success response object
 */
export function createSuccessResponseObject(
  data: any = null,
  meta: any = null
) {
  return successResponse(data, meta);
}

/**
 * Create list response object with pagination (plain data, not NextResponse)
 *
 * @param items Items to return
 * @param total Total count
 * @param limit Items per page
 * @param offset Current offset
 * @returns Paginated list response object with success, data, and pagination
 */
export function createListResponseObject(
  items: any[],
  total: number,
  limit: number,
  offset: number
) {
  return listResponse(items, total, limit, offset);
}
