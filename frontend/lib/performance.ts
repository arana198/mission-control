/**
 * Performance Optimization Utilities
 *
 * Provides caching, memoization, and performance monitoring
 * for Mission Control application
 */

// Simple in-memory cache with TTL support
export class CacheWithTTL<K, V> {
  private cache = new Map<K, { value: V; expires: number }>();

  constructor(private defaultTTL: number = 5 * 60 * 1000) {} // 5 min default

  set(key: K, value: V, ttl: number = this.defaultTTL) {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl,
    });
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

// Request deduplication - prevents multiple identical requests
export class RequestDeduplicator<Args extends unknown[], Result> {
  private pending = new Map<string, Promise<Result>>();
  private keyGenerator: (args: Args) => string;

  constructor(keyGenerator?: (args: Args) => string) {
    this.keyGenerator = keyGenerator || ((args) => JSON.stringify(args));
  }

  async deduplicate(
    args: Args,
    fn: (...args: Args) => Promise<Result>
  ): Promise<Result> {
    const key = this.keyGenerator(args);

    // If request is already in flight, return the same promise
    if (this.pending.has(key)) {
      return this.pending.get(key)!;
    }

    // Make the request and store the promise
    const promise = fn(...args)
      .then((result) => {
        this.pending.delete(key);
        return result;
      })
      .catch((error) => {
        this.pending.delete(key);
        throw error;
      });

    this.pending.set(key, promise);
    return promise;
  }
}

// Performance monitoring
export const performanceMetrics = {
  marks: new Map<string, number>(),

  mark(name: string) {
    this.marks.set(name, performance.now());
  },

  measure(name: string, startMark: string) {
    const start = this.marks.get(startMark);
    if (!start) {
      console.warn(`Start mark "${startMark}" not found`);
      return undefined;
    }

    const duration = performance.now() - start;
    console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`);
    this.marks.delete(startMark);
    return duration;
  },

  async track<T>(
    label: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      console.log(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
    }
  },

  sync<T>(label: string, fn: () => T): T {
    const start = performance.now();
    try {
      return fn();
    } finally {
      const duration = performance.now() - start;
      console.log(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
    }
  },
};

// Batch operation processor
export class BatchProcessor<Item, Result> {
  private queue: Item[] = [];
  private timer: NodeJS.Timeout | null = null;
  private processing = false;

  constructor(
    private processFn: (items: Item[]) => Promise<Result[]>,
    private batchSize: number = 10,
    private debounceMs: number = 100
  ) {}

  add(item: Item): Promise<Result> {
    return new Promise((resolve, reject) => {
      this.queue.push(item as any);
      this.scheduleProcess();
    });
  }

  private scheduleProcess() {
    if (this.timer) clearTimeout(this.timer);

    if (this.queue.length >= this.batchSize) {
      // Process immediately if batch is full
      this.process();
    } else {
      // Debounce processing
      this.timer = setTimeout(() => this.process(), this.debounceMs);
    }
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      await this.processFn(batch);
    } catch (error) {
      console.error("[BATCH] Processing failed:", error);
      // Re-add failed items to queue
      this.queue.unshift(...batch);
    } finally {
      this.processing = false;

      // Schedule next batch if items remain
      if (this.queue.length > 0) {
        this.scheduleProcess();
      }
    }
  }

  async flush() {
    while (this.queue.length > 0 || this.processing) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

// Memoization decorator
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, any>();
  const genKey =
    keyGenerator || ((...args) => JSON.stringify(args));

  return ((...args: Parameters<T>) => {
    const key = genKey(...args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// Rate limiter
export class RateLimiter {
  private requests: number[] = [];

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    // Remove old requests
    this.requests = this.requests.filter((t) => t > cutoff);

    if (this.requests.length >= this.maxRequests) {
      // Wait until oldest request expires
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + this.windowMs - now;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.requests.shift();
    }

    this.requests.push(now);
  }

  isAllowed(): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    this.requests = this.requests.filter((t) => t > cutoff);
    return this.requests.length < this.maxRequests;
  }
}

// Query cache for Convex data
export const queryCache = new CacheWithTTL<string, any>(
  10 * 60 * 1000 // 10 minute default TTL
);

// Request deduplicator for API calls
export const requestDedup = new RequestDeduplicator<[string], Response>();

// Create a key for caching query results
export function createQueryKey(
  queryName: string,
  params?: Record<string, any>
): string {
  if (!params || Object.keys(params).length === 0) {
    return queryName;
  }
  return `${queryName}:${JSON.stringify(params)}`;
}
