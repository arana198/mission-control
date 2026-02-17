/**
 * API Response Utilities
 * Consistent response format across all API routes
 * Standardizes success, error, and validation responses
 */

import { z } from "zod";
import { ERROR_CODES } from "@/lib/constants/business";

/**
 * Standard success response format
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp?: number;
}

/**
 * Standard error response format
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp?: number;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Custom error class for API errors
 */
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ERROR_CODES.VALIDATION_ERROR, message, 400, details);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(
      ERROR_CODES.NOT_FOUND,
      `${resource} not found`,
      404
    );
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Unauthorized error
 */
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(ERROR_CODES.UNAUTHORIZED, message, 401);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * Conflict error (e.g., duplicate, circular dependency)
 */
export class ConflictError extends AppError {
  constructor(message: string, code: string = ERROR_CODES.CONFLICT) {
    super(code, message, 409);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Create a success response
 */
export function successResponse<T>(data: T): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: Date.now(),
  };
}

/**
 * Create an error response
 */
export function errorResponse(
  code: string,
  message: string,
  details?: unknown
): ApiErrorResponse {
  return {
    success: false,
    error: { code, message, details },
    timestamp: Date.now(),
  };
}

/**
 * Handle API error and return appropriate response and status code
 */
export function handleApiError(error: unknown): [ApiErrorResponse, number] {
  // App error
  if (error instanceof AppError) {
    return [
      errorResponse(error.code, error.message, error.details),
      error.statusCode,
    ];
  }

  // Zod validation error
  if (error instanceof z.ZodError) {
    return [
      errorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        "Invalid request data",
        error.issues.map((e) => ({
          field: e.path.join(".") || "root",
          message: e.message,
        }))
      ),
      400,
    ];
  }

  // Regular error
  if (error instanceof Error) {
    return [
      errorResponse(ERROR_CODES.INTERNAL_ERROR, error.message),
      500,
    ];
  }

  // Unknown error
  return [
    errorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      "An unexpected error occurred"
    ),
    500,
  ];
}

/**
 * Wrap API handler with error handling
 */
export function withErrorHandling<T>(
  handler: (request: Request) => Promise<Response>
) {
  return async (request: Request): Promise<Response> => {
    try {
      return await handler(request);
    } catch (error) {
      const [errorData, statusCode] = handleApiError(error);
      return new Response(JSON.stringify(errorData), {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}

/**
 * Response helper - returns properly formatted Response
 */
export function jsonResponse<T>(
  data: ApiSuccessResponse<T> | ApiErrorResponse,
  statusCode: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
