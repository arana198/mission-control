/**
 * Standardized API Response Formatting
 * RFC 9457 error format + consistent success format
 */

import { RateLimitCheckResult } from "@/convex/types";

export interface ErrorResponse {
  type: string;
  title: string;
  detail: string;
  instance: string;
  status: number;
  requestId: string;
  timestamp: string;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  cursor: string | null;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ListResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
  timestamp: string;
}

export interface RateLimitedResponse extends ErrorResponse {
  retryAfter: number; // Seconds
}

/**
 * Generate a unique request ID for tracing
 * Format: req-{timestamp}-{randomHex}
 */
export function generateRequestId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(16).substring(2, 8);
  return `req-${timestamp}-${random}`;
}

/**
 * Create RFC 9457 error response
 * @param status HTTP status code
 * @param code Error code (e.g., "validation_error", "not_found")
 * @param title Human-readable error title
 * @param detail Detailed error message
 * @param instance Request path or context
 * @param requestId Optional request ID (auto-generated if not provided)
 */
export function errorResponse(
  status: number,
  code: string,
  title: string,
  detail: string,
  instance: string = "/api",
  requestId: string = generateRequestId()
): ErrorResponse {
  return {
    type: `https://api.mission-control.dev/errors/${code}`,
    title,
    detail,
    instance,
    status,
    requestId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create standardized success response
 * @param data Response payload
 * @param meta Optional metadata
 */
export function successResponse<T>(
  data: T,
  meta?: Record<string, any>
): SuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    ...(meta && meta),
  };
}

/**
 * Create paginated list response
 * @param items Array of items
 * @param total Total count
 * @param limit Items per page
 * @param offset Current offset
 * @param nextCursor Cursor for next page (if available)
 */
export function listResponse<T>(
  items: T[],
  total: number,
  limit: number,
  offset: number,
  nextCursor: string | null = null
): ListResponse<T> {
  const hasMore = offset + items.length < total;
  const cursor = encodeCursor(offset);

  return {
    success: true,
    data: items,
    pagination: {
      total,
      limit,
      offset,
      cursor,
      nextCursor,
      hasMore,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create rate limit exceeded error response
 * @param remaining Tokens remaining
 * @param resetAt When quota resets (timestamp in ms)
 * @param requestId Optional request ID
 */
export function rateLimitExceeded(
  remaining: number,
  resetAt: number,
  requestId: string = generateRequestId()
): RateLimitedResponse {
  const now = Date.now();
  const secondsUntilReset = Math.ceil((resetAt - now) / 1000);

  return {
    type: "https://api.mission-control.dev/errors/rate_limit_exceeded",
    title: "Rate Limit Exceeded",
    detail: `API rate limit exceeded. Please try again after ${secondsUntilReset} seconds.`,
    instance: "/api",
    status: 429,
    requestId,
    timestamp: new Date().toISOString(),
    retryAfter: Math.max(1, secondsUntilReset),
  };
}

/**
 * Simple encoder for cursor (for pagination)
 * Used to encode offset for cursor-based pagination
 */
function encodeCursor(offset: number): string {
  return Buffer.from(`offset:${offset}:${Date.now()}`).toString("base64");
}
