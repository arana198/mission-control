/**
 * Advanced Caching Strategy
 *
 * Implements multi-tier caching with:
 * - Client-side persistent cache (localStorage)
 * - In-memory cache with TTL
 * - Cache versioning
 * - Smart invalidation
 * - Cache statistics
 */

interface CacheEntry<T> {
  value: T;
  expires: number;
  version: number;
  hits: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

/**
 * Multi-tier cache with persistent storage
 */
export class AdvancedCache<T> {
  private memoryCache = new Map<string, CacheEntry<T>>();
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0, size: 0, hitRate: 0 };
  private currentVersion = 1;

  constructor(
    private namespace: string = "cache",
    private defaultTTL: number = 5 * 60 * 1000, // 5 min
    private maxMemorySize: number = 100 // max entries
  ) {
    this.initializeFromStorage();
  }

  /**
   * Get value from cache (memory first, then storage)
   */
  get(key: string): T | undefined {
    // Try memory cache first
    const memEntry = this.memoryCache.get(key);
    if (memEntry && !this.isExpired(memEntry)) {
      this.recordHit(memEntry);
      return memEntry.value;
    }

    // Try persistent storage
    const storageEntry = this.getFromStorage(key);
    if (storageEntry && !this.isExpired(storageEntry)) {
      // Restore to memory
      this.memoryCache.set(key, storageEntry);
      this.recordHit(storageEntry);
      return storageEntry.value;
    }

    // Cache miss
    this.stats.misses++;
    this.updateHitRate();
    return undefined;
  }

  /**
   * Set value in both memory and persistent storage
   */
  set(key: string, value: T, ttl: number = this.defaultTTL): void {
    const entry: CacheEntry<T> = {
      value,
      expires: Date.now() + ttl,
      version: this.currentVersion,
      hits: 0,
      lastAccessed: Date.now(),
    };

    // Add to memory cache
    this.memoryCache.set(key, entry);

    // Persist to storage
    this.setInStorage(key, entry);

    // Enforce size limits
    this.enforceMemoryLimit();
    this.stats.size = this.memoryCache.size;
  }

  /**
   * Clear specific key
   */
  delete(key: string): void {
    this.memoryCache.delete(key);
    this.deleteFromStorage(key);
    this.stats.size = this.memoryCache.size;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    this.clearStorage();
    this.stats = { hits: 0, misses: 0, evictions: 0, size: 0, hitRate: 0 };
  }

  /**
   * Invalidate cache by pattern
   */
  invalidatePattern(pattern: string | RegExp): number {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    let count = 0;

    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        count++;
      }
    }

    // Also invalidate from storage
    const storageKeys = this.getStorageKeys();
    for (const key of storageKeys) {
      if (regex.test(key)) {
        this.deleteFromStorage(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get top accessed entries
   */
  getTopEntries(limit: number = 10): Array<{ key: string; hits: number; value: T }> {
    return Array.from(this.memoryCache.entries())
      .map(([key, entry]) => ({ key, hits: entry.hits, value: entry.value }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit);
  }

  /**
   * Warm cache with initial data
   */
  warm(entries: Record<string, T>, ttl?: number): void {
    for (const [key, value] of Object.entries(entries)) {
      this.set(key, value, ttl);
    }
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() > entry.expires;
  }

  /**
   * Record cache hit
   */
  private recordHit(entry: CacheEntry<T>): void {
    entry.hits++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    this.updateHitRate();
  }

  /**
   * Update hit rate percentage
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Enforce memory size limit with LRU eviction
   */
  private enforceMemoryLimit(): void {
    if (this.memoryCache.size <= this.maxMemorySize) return;

    // Sort by last accessed time and evict least recently used
    const entries = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)
      .slice(0, Math.ceil(this.maxMemorySize * 0.2)); // evict 20%

    for (const [key] of entries) {
      this.memoryCache.delete(key);
      this.stats.evictions++;
    }
  }

  /**
   * Persistent storage operations
   */
  private getStorageKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  private getFromStorage(key: string): CacheEntry<T> | undefined {
    if (typeof window === "undefined") return undefined;

    try {
      const stored = localStorage.getItem(this.getStorageKey(key));
      if (!stored) return undefined;
      return JSON.parse(stored);
    } catch {
      return undefined;
    }
  }

  private setInStorage(key: string, entry: CacheEntry<T>): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(this.getStorageKey(key), JSON.stringify(entry));
    } catch {
      // Storage full or not available
    }
  }

  private deleteFromStorage(key: string): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.removeItem(this.getStorageKey(key));
    } catch {
      // Ignore errors
    }
  }

  private clearStorage(): void {
    if (typeof window === "undefined") return;

    try {
      const prefix = `${this.namespace}:`;
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Ignore errors
    }
  }

  private getStorageKeys(): string[] {
    if (typeof window === "undefined") return [];

    try {
      const prefix = `${this.namespace}:`;
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          keys.push(key.substring(prefix.length));
        }
      }
      return keys;
    } catch {
      return [];
    }
  }

  private initializeFromStorage(): void {
    if (typeof window === "undefined") return;

    try {
      const prefix = `${this.namespace}:`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          const storageKey = key.substring(prefix.length);
          const entry = this.getFromStorage(storageKey);
          if (entry && !this.isExpired(entry)) {
            this.memoryCache.set(storageKey, entry);
          }
        }
      }
      this.stats.size = this.memoryCache.size;
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Cache manager for different data types
 */
export class CacheManager {
  private caches = new Map<string, AdvancedCache<any>>();

  /**
   * Get or create cache for a namespace
   */
  getCache<T>(namespace: string, ttl?: number): AdvancedCache<T> {
    if (!this.caches.has(namespace)) {
      this.caches.set(namespace, new AdvancedCache<T>(namespace, ttl));
    }
    return this.caches.get(namespace) as AdvancedCache<T>;
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
    this.caches.clear();
  }

  /**
   * Get statistics for all caches
   */
  getStatistics(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    for (const [namespace, cache] of this.caches.entries()) {
      stats[namespace] = cache.getStats();
    }
    return stats;
  }
}

// Global cache manager instance
export const cacheManager = new CacheManager();

// Pre-configured caches for common use cases
export const taskCache = cacheManager.getCache<any>("tasks", 10 * 60 * 1000); // 10 min
export const agentCache = cacheManager.getCache<any>("agents", 15 * 60 * 1000); // 15 min
export const epicCache = cacheManager.getCache<any>("epics", 10 * 60 * 1000); // 10 min
export const memoryCache = cacheManager.getCache<any>("memory", 30 * 60 * 1000); // 30 min
export const goalCache = cacheManager.getCache<any>("goals", 20 * 60 * 1000); // 20 min
