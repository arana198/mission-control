/**
 * Advanced Error Handling & Recovery
 *
 * Implements:
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern
 * - Error recovery strategies
 * - Graceful degradation
 */

import { log } from "./logger";

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeoutMs?: number;
}

/**
 * Retry helper with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  operationName: string,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 100,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    shouldRetry = isRetryableError,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      log.debug(`${operationName}: attempt ${attempt}/${maxAttempts}`);
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts || !shouldRetry(lastError, attempt)) {
        log.error(`${operationName}: failed after ${attempt} attempts`, lastError);
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delayMs = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
        maxDelayMs
      );

      log.warn(`${operationName}: attempt ${attempt} failed, retrying in ${delayMs}ms`, {
        error: lastError.message,
      });

      await sleep(delayMs);
    }
  }

  throw lastError || new Error(`${operationName}: all retries failed`);
}

/**
 * Determine if error is retryable
 */
function isRetryableError(error: Error): boolean {
  // Transient errors worth retrying
  const retryablePatterns = [
    /timeout/i,
    /ECONNRESET/i,
    /ENOTFOUND/i,
    /temporarily unavailable/i,
    /rate limit/i,
    /429/i,
    /503/i,
    /502/i,
    /504/i,
  ];

  return retryablePatterns.some(pattern => pattern.test(error.message));
}

/**
 * Circuit breaker pattern for preventing cascading failures
 */
export class CircuitBreaker {
  private state: "closed" | "open" | "half-open" = "closed";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;

  constructor(
    private name: string,
    private options: CircuitBreakerOptions = {}
  ) {
    this.options = {
      failureThreshold: 5,
      successThreshold: 2,
      timeoutMs: 60000, // 1 minute
      ...options,
    };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > this.options.timeoutMs!) {
        log.info(`${this.name}: circuit breaker half-open, testing...`);
        this.state = "half-open";
      } else {
        throw new Error(
          `${this.name}: Circuit breaker is OPEN. Service is unavailable.`
        );
      }
    }

    try {
      const result = await fn();

      if (this.state === "half-open") {
        this.successCount++;
        if (this.successCount >= this.options.successThreshold!) {
          this.reset();
          log.info(`${this.name}: circuit breaker CLOSED (recovered)`);
        }
      } else {
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.options.failureThreshold!) {
        this.state = "open";
        log.error(`${this.name}: circuit breaker OPEN (too many failures)`);
      }

      throw error;
    }
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.successCount = 0;
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
    };
  }
}

/**
 * Error recovery strategies
 */
export class ErrorRecovery {
  /**
   * Try operation with fallback
   */
  static async withFallback<T>(
    operation: () => Promise<T>,
    fallback: () => T | Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      log.warn(`${operationName}: failed, using fallback`, error);
      return await fallback();
    }
  }

  /**
   * Graceful degradation - try multiple strategies
   */
  static async gracefulDegrade<T>(
    strategies: Array<{
      name: string;
      operation: () => Promise<T>;
      fallback?: T;
    }>
  ): Promise<T | undefined> {
    for (const strategy of strategies) {
      try {
        log.debug(`Trying strategy: ${strategy.name}`);
        return await strategy.operation();
      } catch (error) {
        log.warn(`Strategy "${strategy.name}" failed`, error);
        if (strategy.fallback !== undefined) {
          log.info(`Using fallback for strategy: ${strategy.name}`);
          return strategy.fallback;
        }
      }
    }
    return undefined;
  }

  /**
   * Batch retry with partial success
   */
  static async batchRetry<T>(
    items: T[],
    operation: (item: T) => Promise<unknown>,
    operationName: string
  ): Promise<{ successful: T[]; failed: T[] }> {
    const successful: T[] = [];
    const failed: T[] = [];

    for (const item of items) {
      try {
        await retryWithBackoff(() => operation(item), `${operationName}: item`);
        successful.push(item);
      } catch (error) {
        log.error(
          `${operationName}: item failed permanently`,
          error instanceof Error ? error : new Error(String(error))
        );
        failed.push(item);
      }
    }

    return { successful, failed };
  }
}

/**
 * Error categorization for better handling
 */
export enum ErrorCategory {
  NETWORK = "network",
  VALIDATION = "validation",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  NOT_FOUND = "not_found",
  CONFLICT = "conflict",
  RATE_LIMIT = "rate_limit",
  SERVER = "server",
  UNKNOWN = "unknown",
}

/**
 * Categorize error for appropriate handling
 */
export function categorizeError(error: Error | unknown): ErrorCategory {
  const message = (error as any)?.message || String(error);

  if (
    /timeout|ECONNRESET|ENOTFOUND|network|offline/i.test(message)
  ) {
    return ErrorCategory.NETWORK;
  } else if (/validation|invalid|required|must/i.test(message)) {
    return ErrorCategory.VALIDATION;
  } else if (/unauthorized|unauthenticated|401/i.test(message)) {
    return ErrorCategory.AUTHENTICATION;
  } else if (/forbidden|permission|403/i.test(message)) {
    return ErrorCategory.AUTHORIZATION;
  } else if (/not found|404|does not exist/i.test(message)) {
    return ErrorCategory.NOT_FOUND;
  } else if (/conflict|duplicate|409/i.test(message)) {
    return ErrorCategory.CONFLICT;
  } else if (/rate limit|429|too many/i.test(message)) {
    return ErrorCategory.RATE_LIMIT;
  } else if (/server|500|502|503|504/i.test(message)) {
    return ErrorCategory.SERVER;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * User-friendly error messages
 */
export const ErrorMessages: Record<ErrorCategory, string> = {
  [ErrorCategory.NETWORK]: "Network connection error. Please check your internet and try again.",
  [ErrorCategory.VALIDATION]: "The data you provided is invalid. Please check and try again.",
  [ErrorCategory.AUTHENTICATION]:
    "You need to log in to perform this action.",
  [ErrorCategory.AUTHORIZATION]:
    "You don't have permission to perform this action.",
  [ErrorCategory.NOT_FOUND]: "The requested item was not found.",
  [ErrorCategory.CONFLICT]:
    "This item already exists or there was a conflict. Please refresh and try again.",
  [ErrorCategory.RATE_LIMIT]:
    "You're making requests too quickly. Please wait a moment and try again.",
  [ErrorCategory.SERVER]: "Server error. Our team has been notified. Please try again later.",
  [ErrorCategory.UNKNOWN]: "An unexpected error occurred. Please try again.",
};

/**
 * Helper to get user-friendly error message
 */
export function getUserFriendlyMessage(error: Error | unknown): string {
  const category = categorizeError(error);
  return ErrorMessages[category];
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Global circuit breakers for common operations
export const apiCircuitBreaker = new CircuitBreaker("API", {
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 60000,
});

export const databaseCircuitBreaker = new CircuitBreaker("Database", {
  failureThreshold: 10,
  successThreshold: 3,
  timeoutMs: 120000,
});
