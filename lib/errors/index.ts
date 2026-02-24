/**
 * Error Handling Exports
 * Centralized error definitions and utilities
 *
 * Phase 1: Error Standardization
 * Phase 2: Advanced Error Handling & Recovery Patterns
 */

export { ApiError, ErrorCode } from "./ApiError";
export type { ConvexErrorHandler } from "./convexErrorHandler";
export { wrapConvexHandler, isApiError } from "./convexErrorHandler";

// Phase 2: Resilience Patterns
export {
  withRetry,
  calculateBackoffDelay,
  CircuitBreaker,
  IdempotencyManager,
  DeadLetterQueue,
  globalDLQ,
  withFallback,
  RETRY_CONFIGS,
} from "./retryStrategy";
export type { RetryConfig, DeadLetterEntry } from "./retryStrategy";
