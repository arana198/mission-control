/**
 * ApiError Class
 * Standardized error handling for Convex mutations and queries
 *
 * Maps to HTTP status codes for RESTful semantics:
 * - 422: Validation errors (input doesn't match schema)
 * - 404: Resource not found
 * - 409: Conflict (duplicate, state mismatch)
 * - 403: Forbidden (permission denied)
 * - 429: Rate/limit exceeded
 * - 500: Internal server error
 * - 503: Service unavailable (temporary)
 */

import { generateRequestId } from "../utils/requestId";

export enum ErrorCode {
  // 4xx: Client Errors
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  FORBIDDEN = "FORBIDDEN",
  LIMIT_EXCEEDED = "LIMIT_EXCEEDED",

  // 5xx: Server Errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

interface ErrorCodeConfig {
  statusCode: number;
  retryable: boolean;
}

// Map error codes to HTTP status codes
const ERROR_CODE_MAP: Record<ErrorCode, ErrorCodeConfig> = {
  [ErrorCode.VALIDATION_ERROR]: { statusCode: 422, retryable: false },
  [ErrorCode.NOT_FOUND]: { statusCode: 404, retryable: false },
  [ErrorCode.CONFLICT]: { statusCode: 409, retryable: false },
  [ErrorCode.FORBIDDEN]: { statusCode: 403, retryable: false },
  [ErrorCode.LIMIT_EXCEEDED]: { statusCode: 429, retryable: true },
  [ErrorCode.INTERNAL_ERROR]: { statusCode: 500, retryable: false },
  [ErrorCode.SERVICE_UNAVAILABLE]: { statusCode: 503, retryable: true },
};

export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;
  public readonly requestId: string;
  private readonly _retryable: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.requestId = generateRequestId();

    const config = ERROR_CODE_MAP[code];
    this.statusCode = config.statusCode;
    this._retryable = config.retryable;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /**
   * Check if this error is retryable (transient)
   * Transient errors: SERVICE_UNAVAILABLE, LIMIT_EXCEEDED
   * Permanent errors: VALIDATION_ERROR, NOT_FOUND, CONFLICT, FORBIDDEN, INTERNAL_ERROR
   */
  isRetryable(): boolean {
    return this._retryable;
  }

  /**
   * Serialize error to JSON for API response
   */
  toJSON() {
    const json: any = {
      code: this.code,
      statusCode: this.statusCode,
      message: this.message,
      requestId: this.requestId,
      retryable: this._retryable,
    };

    if (this.details !== undefined) {
      json.details = this.details;
    }

    return json;
  }

  // ─── Static Factory Methods ──────────────────────────────────────────────

  static notFound(
    resource: string,
    details?: Record<string, any>
  ): ApiError {
    return new ApiError(
      ErrorCode.NOT_FOUND,
      `${resource} not found`,
      details
    );
  }

  static validationError(
    message: string,
    details?: Record<string, any>
  ): ApiError {
    return new ApiError(ErrorCode.VALIDATION_ERROR, message, details);
  }

  static conflict(message: string, details?: Record<string, any>): ApiError {
    return new ApiError(ErrorCode.CONFLICT, message, details);
  }

  static forbidden(message: string, details?: Record<string, any>): ApiError {
    return new ApiError(ErrorCode.FORBIDDEN, message, details);
  }

  static limitExceeded(
    message: string,
    details?: Record<string, any>
  ): ApiError {
    return new ApiError(ErrorCode.LIMIT_EXCEEDED, message, details);
  }

  static internal(message: string, details?: Record<string, any>): ApiError {
    return new ApiError(ErrorCode.INTERNAL_ERROR, message, details);
  }

  static unavailable(
    message: string,
    details?: Record<string, any>
  ): ApiError {
    return new ApiError(ErrorCode.SERVICE_UNAVAILABLE, message, details);
  }
}
