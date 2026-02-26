/**
 * Convex Error Handler
 * Wraps Convex mutation/query handlers to catch and format ApiErrors
 *
 * Usage in mutations:
 * ```typescript
 * export const createTask = mutation({
 *   args: { businessId, title, ... },
 *   handler: wrapConvexHandler(async (ctx, args) => {
 *     // Your logic here
 *     // Throw ApiError for semantic errors
 *   })
 * });
 * ```
 */

import { ApiError, ErrorCode } from "./ApiError";
import { generateRequestId } from "../utils/requestId";

export interface ConvexErrorHandler {
  <TResult = any>(
    handler: (ctx: any, args: any) => Promise<TResult>
  ): (ctx: any, args: any) => Promise<TResult>;
}

/**
 * Type guard to check if error is an ApiError
 */
export function isApiError(error: any): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Wrapper for Convex handlers that catches ApiErrors and reformats them
 * Non-ApiErrors are converted to INTERNAL_ERROR for safety
 *
 * Supports both patterns:
 * - handler: wrapConvexHandler(async (ctx, args) => { ... })
 * - handler: wrapConvexHandler(async (ctx, { field1, field2 }) => { ... })
 */
export function wrapConvexHandler<TResult = any>(
  handler: (ctx: any, args: any) => Promise<TResult>
): (ctx: any, args: any) => Promise<TResult> {
  return async (ctx: any, args: any): Promise<TResult> => {
    try {
      return await handler(ctx, args);
    } catch (error: any) {
      // If already an ApiError, re-throw (Convex will serialize it)
      if (isApiError(error)) {
        throw error;
      }

      // Convert unexpected errors to ApiError for consistency
      // Don't expose internal error details to client
      const internalError = new ApiError(
        ErrorCode.INTERNAL_ERROR,
        "An unexpected error occurred",
        {
          originalError: error?.message || String(error),
          stack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
        }
      );

      throw internalError;
    }
  };
}

/**
 * Utility to format ApiError for HTTP response
 * Convex automatically serializes Error objects, but this ensures
 * the response has the right structure
 */
export function formatApiErrorResponse(error: ApiError) {
  return {
    error: error.toJSON(),
  };
}

/**
 * Utility to extract ApiError from caught exception
 * Handles both direct ApiError throws and wrapped errors
 */
export function extractApiError(error: any): ApiError {
  if (isApiError(error)) {
    return error;
  }

  // If it looks like a serialized ApiError (from Convex)
  if (error?.code && error?.statusCode) {
    return new ApiError(
      error.code,
      error.message,
      error.details
    );
  }

  // Unknown error
  return new ApiError(
    ErrorCode.INTERNAL_ERROR,
    "An unexpected error occurred",
    { originalError: error?.message || String(error) }
  );
}
