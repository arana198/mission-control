/**
 * Advanced Query Optimization Utilities
 *
 * Provides tools for:
 * - Batch loading related data
 * - Query result caching
 * - N+1 query prevention
 * - Query composition
 */

import { log } from "./logger";
import { metrics } from "./monitoring";

interface QueryResult<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Batch loader for preventing N+1 queries
 */
export class BatchLoader<K, V> {
  private cache = new Map<string, QueryResult<V>>();
  private queue: Array<{
    key: K;
    resolve: (value: V) => void;
    reject: (error: Error) => void;
  }> = [];
  private batchScheduled = false;

  constructor(
    private name: string,
    private batchLoadFn: (keys: K[]) => Promise<Map<K, V>>,
    private defaultTTL: number = 5 * 60 * 1000
  ) {}

  /**
   * Load a single value, batching with other concurrent requests
   */
  async load(key: K): Promise<V> {
    const cacheKey = this.getCacheKey(key);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      log.debug(`${this.name}: cache hit for key ${cacheKey}`);
      return cached.data;
    }

    // Queue the request
    return new Promise((resolve, reject) => {
      this.queue.push({ key, resolve, reject });

      // Schedule batch if not already scheduled
      if (!this.batchScheduled) {
        this.batchScheduled = true;
        // Batch after next microtask
        Promise.resolve().then(() => this.executeBatch());
      }
    });
  }

  /**
   * Load multiple values
   */
  async loadMany(keys: K[]): Promise<V[]> {
    return Promise.all(keys.map(key => this.load(key)));
  }

  /**
   * Execute batch load
   */
  private async executeBatch(): Promise<void> {
    if (this.queue.length === 0) {
      this.batchScheduled = false;
      return;
    }

    const batch = [...this.queue];
    this.queue = [];
    this.batchScheduled = false;

    const uniqueKeys = Array.from(new Set(batch.map(b => b.key)));

    try {
      const startTime = performance.now();
      log.debug(`${this.name}: executing batch load for ${uniqueKeys.length} keys`);

      const results = await this.batchLoadFn(uniqueKeys);

      const duration = performance.now() - startTime;
      metrics.recordMetric({
        name: "batch_load",
        value: duration,
        unit: "ms",
        tags: { loader: this.name, items: String(uniqueKeys.length) },
      });

      // Process results
      for (const item of batch) {
        const value = results.get(item.key);
        if (value !== undefined) {
          const cacheKey = this.getCacheKey(item.key);
          this.cache.set(cacheKey, {
            data: value,
            timestamp: Date.now(),
            ttl: this.defaultTTL,
          });
          item.resolve(value);
        } else {
          item.reject(new Error(`No result for key: ${item.key}`));
        }
      }

      log.debug(`${this.name}: batch load completed in ${duration.toFixed(2)}ms`);
    } catch (error) {
      log.error(`${this.name}: batch load failed`, error as Error);
      batch.forEach(item =>
        item.reject(error instanceof Error ? error : new Error(String(error)))
      );
    }
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache key
   */
  private getCacheKey(key: K): string {
    return String(key);
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      name: this.name,
      cacheSize: this.cache.size,
      queueSize: this.queue.length,
    };
  }
}

/**
 * Query composition for combining related queries
 */
export class QueryComposer {
  /**
   * Compose multiple queries that depend on each other
   */
  static async compose<T, U>(
    firstQuery: () => Promise<T>,
    secondQuery: (first: T) => Promise<U>,
    name: string
  ): Promise<U> {
    const startTime = performance.now();

    try {
      log.debug(`Composing queries: ${name}`);

      const first = await firstQuery();
      const second = await secondQuery(first);

      const duration = performance.now() - startTime;
      metrics.recordMetric({
        name: "composed_query",
        value: duration,
        unit: "ms",
        tags: { operation: name },
      });

      log.debug(`Composed query completed: ${name}`, { duration: duration.toFixed(2) });

      return second;
    } catch (error) {
      log.error(`Composed query failed: ${name}`, error as Error);
      throw error;
    }
  }

  /**
   * Parallel queries with Promise.all
   */
  static async parallel<T extends any[]>(
    queries: Array<() => Promise<any>>,
    name: string
  ): Promise<T> {
    const startTime = performance.now();

    try {
      log.debug(`Running parallel queries: ${name}`, { count: queries.length });

      const results = await Promise.all(queries.map(q => q()));

      const duration = performance.now() - startTime;
      metrics.recordMetric({
        name: "parallel_queries",
        value: duration,
        unit: "ms",
        tags: { operation: name, count: String(queries.length) },
      });

      log.debug(`Parallel queries completed: ${name}`, {
        duration: duration.toFixed(2),
        count: queries.length,
      });

      return results as T;
    } catch (error) {
      log.error(`Parallel queries failed: ${name}`, error as Error);
      throw error;
    }
  }

  /**
   * Race multiple queries for the fastest result
   */
  static async race<T>(
    queries: Array<() => Promise<T>>,
    name: string
  ): Promise<T> {
    const startTime = performance.now();

    try {
      log.debug(`Racing queries: ${name}`, { count: queries.length });

      const result = await Promise.race(queries.map(q => q()));

      const duration = performance.now() - startTime;
      metrics.recordMetric({
        name: "race_query",
        value: duration,
        unit: "ms",
        tags: { operation: name },
      });

      return result;
    } catch (error) {
      log.error(`Race queries failed: ${name}`, error as Error);
      throw error;
    }
  }
}

/**
 * Query result normalizer for deduplication
 */
export class QueryNormalizer {
  private normalizers = new Map<string, (data: any) => any>();

  /**
   * Register a normalizer for a query type
   */
  registerNormalizer(queryType: string, normalizer: (data: any) => any): void {
    this.normalizers.set(queryType, normalizer);
  }

  /**
   * Normalize query result to deduplicate data
   */
  normalize(queryType: string, data: any): any {
    const normalizer = this.normalizers.get(queryType);
    if (normalizer) {
      return normalizer(data);
    }
    return data;
  }

  /**
   * Denormalize for client-side use
   */
  denormalize(normalized: any, includes: string[]): any {
    // Custom denormalization logic per data structure
    return normalized;
  }
}

/**
 * Query performance profiler
 */
export class QueryProfiler {
  private profiles = new Map<string, { count: number; totalTime: number; avgTime: number }>();

  /**
   * Profile a query execution
   */
  async profile<T>(
    queryName: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await queryFn();
      const duration = performance.now() - startTime;

      this.recordProfile(queryName, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordProfile(queryName, duration);
      throw error;
    }
  }

  /**
   * Record profile data
   */
  private recordProfile(queryName: string, duration: number): void {
    const existing = this.profiles.get(queryName) || { count: 0, totalTime: 0, avgTime: 0 };

    existing.count++;
    existing.totalTime += duration;
    existing.avgTime = existing.totalTime / existing.count;

    this.profiles.set(queryName, existing);

    if (duration > 100) {
      log.warn(`Slow query detected: ${queryName}`, {
        duration: `${duration.toFixed(2)}ms`,
      });
    }
  }

  /**
   * Get profiles
   */
  getProfiles() {
    return Object.fromEntries(this.profiles);
  }

  /**
   * Get slow queries
   */
  getSlowQueries(threshold: number = 100): Record<string, any> {
    const slow: Record<string, any> = {};
    for (const [name, profile] of this.profiles) {
      if (profile.avgTime > threshold) {
        slow[name] = profile;
      }
    }
    return slow;
  }

  /**
   * Reset profiler
   */
  reset(): void {
    this.profiles.clear();
  }
}

// Global instances
export const queryProfiler = new QueryProfiler();
export const queryNormalizer = new QueryNormalizer();
