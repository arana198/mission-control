/**
 * Retry Strategy & Resilience Patterns
 * Phase 2: Advanced Error Handling & Recovery
 *
 * Provides:
 * - Exponential backoff with jitter
 * - Circuit breaker pattern
 * - Graceful degradation
 * - Idempotency key management
 * - Dead letter queue simulation
 */

import { ApiError, ErrorCode } from "./ApiError";

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number; // Total attempts (1 = no retry)
  initialDelayMs: number; // First retry delay
  maxDelayMs: number; // Cap on backoff
  backoffMultiplier: number; // Exponential factor
  jitterFactor: number; // 0-1: randomness added
  retryableErrorCodes?: ErrorCode[]; // Only retry these errors
}

/**
 * Default retry config for different operation types
 */
export const RETRY_CONFIGS = {
  // Critical operations: more aggressive retries
  CRITICAL: {
    maxAttempts: 5,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    retryableErrorCodes: [
      ErrorCode.SERVICE_UNAVAILABLE,
      ErrorCode.LIMIT_EXCEEDED,
      ErrorCode.INTERNAL_ERROR,
    ],
  },

  // Standard operations: moderate retries
  STANDARD: {
    maxAttempts: 3,
    initialDelayMs: 100,
    maxDelayMs: 3000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    retryableErrorCodes: [
      ErrorCode.SERVICE_UNAVAILABLE,
      ErrorCode.LIMIT_EXCEEDED,
    ],
  },

  // Fast operations: minimal retries
  FAST: {
    maxAttempts: 2,
    initialDelayMs: 50,
    maxDelayMs: 500,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    retryableErrorCodes: [ErrorCode.SERVICE_UNAVAILABLE],
  },

  // Cron jobs: aggressive with longer delays
  CRON: {
    maxAttempts: 4,
    initialDelayMs: 200,
    maxDelayMs: 10000,
    backoffMultiplier: 3,
    jitterFactor: 0.2,
    retryableErrorCodes: [
      ErrorCode.SERVICE_UNAVAILABLE,
      ErrorCode.LIMIT_EXCEEDED,
      ErrorCode.INTERNAL_ERROR,
    ],
  },
};

/**
 * Calculate exponential backoff with jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig
): number {
  // Exponential backoff: initialDelay * (multiplier ^ (attempt - 1))
  const baseDelay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
    config.maxDelayMs
  );

  // Add jitter: randomness to prevent thundering herd
  const jitter = baseDelay * config.jitterFactor * Math.random();
  return Math.floor(baseDelay + jitter);
}

/**
 * Retry wrapper function
 * Automatically retries failed operations based on error type
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  config: RetryConfig = RETRY_CONFIGS.STANDARD
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      const isRetryable =
        !config.retryableErrorCodes ||
        (error instanceof ApiError &&
          config.retryableErrorCodes.includes(error.code));

      // Don't retry if not eligible or this is the last attempt
      if (!isRetryable || attempt === config.maxAttempts) {
        throw error;
      }

      // Calculate backoff and wait
      const delayMs = calculateBackoffDelay(attempt, config);
      console.log(
        `[Retry] ${operationName} failed (attempt ${attempt}/${config.maxAttempts}). ` +
          `Retrying in ${delayMs}ms. Error: ${error.message}`
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

/**
 * Circuit Breaker Pattern
 * Prevents cascading failures by fast-failing after threshold breaches
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  constructor(
    private operationName: string,
    private failureThreshold: number = 5, // Fail after N errors
    private resetTimeoutMs: number = 60000 // Reset after N ms
  ) {}

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit should reset
    if (
      this.state === "OPEN" &&
      Date.now() - this.lastFailureTime > this.resetTimeoutMs
    ) {
      console.log(`[CircuitBreaker] ${this.operationName} attempting recovery`);
      this.state = "HALF_OPEN";
      this.failureCount = 0;
    }

    // Fast-fail if circuit is open
    if (this.state === "OPEN") {
      throw ApiError.unavailable(
        `Circuit breaker open for ${this.operationName}`,
        {
          operationName: this.operationName,
          failureCount: this.failureCount,
          resetIn: this.resetTimeoutMs - (Date.now() - this.lastFailureTime),
        }
      );
    }

    try {
      const result = await operation();
      // Success: close circuit if was half-open
      if (this.state === "HALF_OPEN") {
        console.log(`[CircuitBreaker] ${this.operationName} recovered`);
        this.state = "CLOSED";
        this.failureCount = 0;
      }
      return result;
    } catch (error: any) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      // Open circuit if threshold reached
      if (this.failureCount >= this.failureThreshold) {
        console.log(
          `[CircuitBreaker] ${this.operationName} circuit opened after ${this.failureCount} failures`
        );
        this.state = "OPEN";
      }

      throw error;
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Idempotency Key Manager
 * Prevents duplicate operations for same request
 */
export class IdempotencyManager {
  private requestMap = new Map<
    string,
    { result: any; timestamp: number; error?: any }
  >();
  private readonly ttlMs: number;

  constructor(ttlMs: number = 3600000) {
    // 1 hour default
    this.ttlMs = ttlMs;
    // Cleanup old entries every 10 minutes
    setInterval(() => this.cleanup(), 600000);
  }

  /**
   * Execute operation with idempotency
   * If same key is seen again, returns cached result
   */
  async execute<T>(
    idempotencyKey: string,
    operation: () => Promise<T>
  ): Promise<T> {
    // Check cache
    const cached = this.requestMap.get(idempotencyKey);
    if (cached) {
      if (cached.error) throw cached.error;
      return cached.result;
    }

    try {
      const result = await operation();
      this.requestMap.set(idempotencyKey, {
        result,
        timestamp: Date.now(),
      });
      return result;
    } catch (error: any) {
      this.requestMap.set(idempotencyKey, {
        result: undefined,
        timestamp: Date.now(),
        error,
      });
      throw error;
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, value] of this.requestMap.entries()) {
      if (now - value.timestamp > this.ttlMs) {
        this.requestMap.delete(key);
      }
    }
  }
}

/**
 * Dead Letter Queue simulation
 * Stores failed operations for later retry/analysis
 */
export interface DeadLetterEntry {
  id: string;
  operationName: string;
  payload: any;
  error: string;
  errorCode?: ErrorCode;
  attempt: number;
  maxAttempts: number;
  timestamp: number;
  retryAt?: number;
}

export class DeadLetterQueue {
  private queue: DeadLetterEntry[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Add failed operation to queue
   */
  enqueue(entry: Omit<DeadLetterEntry, "id" | "timestamp">): string {
    if (this.queue.length >= this.maxSize) {
      console.warn("[DLQ] Queue at max capacity, removing oldest entry");
      this.queue.shift();
    }

    const id = `dlq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newEntry: DeadLetterEntry = {
      ...entry,
      id,
      timestamp: Date.now(),
      retryAt: entry.retryAt || Date.now() + 60000, // Retry after 1 min default
    };

    this.queue.push(newEntry);
    console.log(
      `[DLQ] Enqueued ${entry.operationName} (${entry.attempt}/${entry.maxAttempts} attempts)`
    );

    return id;
  }

  /**
   * Get entries ready for retry
   */
  getRetryable(): DeadLetterEntry[] {
    const now = Date.now();
    return this.queue.filter((entry) => {
      const isRetryable =
        entry.attempt < entry.maxAttempts &&
        (entry.retryAt || 0) <= now;
      return isRetryable;
    });
  }

  /**
   * Mark entry as processed
   */
  remove(id: string): void {
    const index = this.queue.findIndex((entry) => entry.id === id);
    if (index >= 0) {
      this.queue.splice(index, 1);
    }
  }

  /**
   * Get queue stats
   */
  getStats() {
    const retryable = this.getRetryable();
    return {
      total: this.queue.length,
      retryable: retryable.length,
      capacity: this.maxSize,
    };
  }

  /**
   * Get all entries (for monitoring/debugging)
   */
  getAll(): DeadLetterEntry[] {
    return [...this.queue];
  }
}

/**
 * Global DLQ instance
 */
export const globalDLQ = new DeadLetterQueue(1000);

/**
 * Graceful Degradation Helper
 * Executes fallback when primary operation fails
 */
export async function withFallback<T>(
  primaryOperation: () => Promise<T>,
  fallbackOperation: () => Promise<T>,
  operationName: string
): Promise<T> {
  try {
    return await primaryOperation();
  } catch (error: any) {
    console.warn(
      `[GracefulDegradation] ${operationName} primary failed, using fallback. Error: ${error.message}`
    );

    try {
      return await fallbackOperation();
    } catch (fallbackError: any) {
      throw ApiError.unavailable(
        `Both primary and fallback operations failed for ${operationName}`,
        {
          operationName,
          primaryError: error.message,
          fallbackError: fallbackError.message,
        }
      );
    }
  }
}
