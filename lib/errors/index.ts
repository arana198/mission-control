/**
 * Error Handling Exports
 * Centralized error definitions and utilities
 */

export { ApiError, ErrorCode } from "./ApiError";
export type { ConvexErrorHandler } from "./convexErrorHandler";
export { wrapConvexHandler, isApiError } from "./convexErrorHandler";
