/**
 * API Error Type Definitions
 * RFC 9457 compliant error types for standardized error handling
 */

export const ERROR_CODES = {
  // Validation errors (400)
  VALIDATION_ERROR: "validation_error",
  INVALID_REQUEST: "invalid_request",
  MISSING_FIELD: "missing_field",
  INVALID_CURSOR: "invalid_cursor",
  CURSOR_EXPIRED: "cursor_expired",

  // Authentication/Authorization errors (401/403)
  UNAUTHORIZED: "unauthorized",
  INVALID_TOKEN: "invalid_token",
  MISSING_AUTH: "missing_auth",
  FORBIDDEN: "forbidden",
  INSUFFICIENT_PERMISSIONS: "insufficient_permissions",

  // Not found (404)
  NOT_FOUND: "not_found",
  RESOURCE_NOT_FOUND: "resource_not_found",

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",

  // Conflict (409)
  CONFLICT: "conflict",
  DUPLICATE: "duplicate",

  // Server errors (500)
  INTERNAL_SERVER_ERROR: "internal_server_error",
  SERVICE_UNAVAILABLE: "service_unavailable",
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    public title: string,
    public detail: string,
    public instance?: string
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

export class ValidationError extends ApiError {
  constructor(detail: string, instance?: string) {
    super(400, ERROR_CODES.VALIDATION_ERROR, "Validation Error", detail, instance);
    this.name = "ValidationError";
  }
}

export class MissingFieldError extends ApiError {
  constructor(fieldName: string, instance?: string) {
    super(
      400,
      ERROR_CODES.MISSING_FIELD,
      "Missing Required Field",
      `Missing required field: ${fieldName}`,
      instance
    );
    this.name = "MissingFieldError";
  }
}

export class CursorExpiredError extends ApiError {
  constructor(instance?: string) {
    super(
      400,
      ERROR_CODES.CURSOR_EXPIRED,
      "Cursor Expired",
      "Cursor has expired. Please restart pagination from the beginning.",
      instance
    );
    this.name = "CursorExpiredError";
  }
}

export class InvalidCursorError extends ApiError {
  constructor(detail: string = "Invalid cursor format", instance?: string) {
    super(400, ERROR_CODES.INVALID_CURSOR, "Invalid Cursor", detail, instance);
    this.name = "InvalidCursorError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(detail: string = "Unauthorized", instance?: string) {
    super(401, ERROR_CODES.UNAUTHORIZED, "Unauthorized", detail, instance);
    this.name = "UnauthorizedError";
  }
}

export class InvalidTokenError extends ApiError {
  constructor(detail: string = "Invalid or expired token", instance?: string) {
    super(401, ERROR_CODES.INVALID_TOKEN, "Invalid Token", detail, instance);
    this.name = "InvalidTokenError";
  }
}

export class MissingAuthError extends ApiError {
  constructor(instance?: string) {
    super(
      401,
      ERROR_CODES.MISSING_AUTH,
      "Missing Authentication",
      "Missing authentication credentials. Provide Authorization header or API key.",
      instance
    );
    this.name = "MissingAuthError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(detail: string = "Access denied", instance?: string) {
    super(403, ERROR_CODES.FORBIDDEN, "Forbidden", detail, instance);
    this.name = "ForbiddenError";
  }
}

export class InsufficientPermissionsError extends ApiError {
  constructor(resource: string, instance?: string) {
    super(
      403,
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      "Insufficient Permissions",
      `Insufficient permissions to access ${resource}`,
      instance
    );
    this.name = "InsufficientPermissionsError";
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, instance?: string) {
    super(404, ERROR_CODES.NOT_FOUND, "Not Found", `${resource} not found`, instance);
    this.name = "NotFoundError";
  }
}

export class RateLimitExceededError extends ApiError {
  public retryAfter: number;

  constructor(retryAfter: number, instance?: string) {
    super(
      429,
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      "Rate Limit Exceeded",
      `API rate limit exceeded. Please try again after ${retryAfter} seconds.`,
      instance
    );
    this.retryAfter = retryAfter;
    this.name = "RateLimitExceededError";
  }
}

export class ConflictError extends ApiError {
  constructor(detail: string, instance?: string) {
    super(409, ERROR_CODES.CONFLICT, "Conflict", detail, instance);
    this.name = "ConflictError";
  }
}

export class DuplicateError extends ApiError {
  constructor(resource: string, instance?: string) {
    super(409, ERROR_CODES.DUPLICATE, "Duplicate", `${resource} already exists`, instance);
    this.name = "DuplicateError";
  }
}

export class InternalServerError extends ApiError {
  constructor(detail: string = "Internal server error", instance?: string) {
    super(500, ERROR_CODES.INTERNAL_SERVER_ERROR, "Internal Server Error", detail, instance);
    this.name = "InternalServerError";
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(service: string = "Service", instance?: string) {
    super(
      503,
      ERROR_CODES.SERVICE_UNAVAILABLE,
      "Service Unavailable",
      `${service} is temporarily unavailable`,
      instance
    );
    this.name = "ServiceUnavailableError";
  }
}
