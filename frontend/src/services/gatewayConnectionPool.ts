/**
 * Gateway Connection Pool
 *
 * Module-level singleton that keeps authenticated WebSocket connections alive
 * for 60 seconds of idle time. Handlers call pool.acquire() instead of connect()
 * and pool.release() instead of ws.close().
 *
 * Benefits:
 * - Eliminates 10-second connection handshake on every 30-second poll
 * - Reduces load on gateway daemon
 * - Transparent to rest of system (no changes to call(), provisionAgent(), frontend)
 *
 * Pool lifecycle:
 * 1. HTTP request handler calls pool.acquire(gatewayId, config)
 * 2. Handler uses the WebSocket via call(ws, method, params)
 * 3. Handler calls pool.release(ws, cacheKey) in finally block
 * 4. Socket stays in pool for POOL_TTL_MS (60s) unless connection dies
 * 5. Next request within 60s reuses same socket (FAST PATH)
 */

import WebSocket from 'ws';
import { connect } from '@/services/gatewayRpc';

// Pool constants (exported for tests)
export const POOL_TTL_MS = 60_000;      // 2× the 30s polling interval
export const POOL_MAX_PER_KEY = 3;       // max concurrent connections per gateway config

export interface ConnectConfig {
  url: string;
  token?: string;
  disableDevicePairing?: boolean;
  allowInsecureTls?: boolean;
}

interface PoolEntry {
  ws: WebSocket;
  expires: number;   // absolute ms timestamp
  inUse: boolean;    // true while a handler holds this socket
}

/**
 * WebSocket connection pool for gateway handlers
 * Keeps connections alive between requests to avoid handshake overhead
 */
export class GatewayConnectionPool {
  private pool = new Map<string, PoolEntry[]>();

  /**
   * Build cache key from gatewayId and connect config
   * Includes all params that affect handshake behavior
   */
  buildCacheKey(gatewayId: string, config: ConnectConfig): string {
    return `${gatewayId}:${config.url}:${config.token ?? ''}:${config.disableDevicePairing}:${config.allowInsecureTls}`;
  }

  /**
   * Acquire a WebSocket connection from the pool
   * FAST PATH: Returns cached idle socket within TTL
   * SLOW PATH: Opens new connection and adds to pool
   */
  async acquire(gatewayId: string, config: ConnectConfig): Promise<WebSocket> {
    const cacheKey = this.buildCacheKey(gatewayId, config);

    // Housekeeping: remove expired entries
    this.evictExpired();

    // Try to find a healthy, idle entry in the pool
    const entries = this.pool.get(cacheKey) || [];
    for (const entry of entries) {
      if (
        !entry.inUse &&
        entry.ws.readyState === WebSocket.OPEN &&
        Date.now() < entry.expires
      ) {
        // Found a reusable socket
        entry.inUse = true;
        entry.expires = Date.now() + POOL_TTL_MS;
        return entry.ws;
      }
    }

    // No usable entry found, open new connection via gatewayRpc.connect()
    const ws = await connect(config);

    // Create pool entry
    const entry: PoolEntry = {
      ws,
      expires: Date.now() + POOL_TTL_MS,
      inUse: true,
    };

    // Add to pool, respecting POOL_MAX_PER_KEY limit
    if (!this.pool.has(cacheKey)) {
      this.pool.set(cacheKey, []);
    }

    const poolEntries = this.pool.get(cacheKey)!;
    if (poolEntries.length >= POOL_MAX_PER_KEY) {
      // Find and evict oldest idle entry
      let oldestIdx = -1;
      let oldestTime = Date.now();
      for (let i = 0; i < poolEntries.length; i++) {
        if (!poolEntries[i].inUse && poolEntries[i].expires < oldestTime) {
          oldestIdx = i;
          oldestTime = poolEntries[i].expires;
        }
      }
      if (oldestIdx >= 0) {
        const evicted = poolEntries.splice(oldestIdx, 1)[0];
        try {
          evicted.ws.close();
        } catch {
          // ignore close errors
        }
      }
    }

    poolEntries.push(entry);
    return ws;
  }

  /**
   * Release a WebSocket connection back to the pool
   * If socket is dead, it is removed from pool
   * If socket is healthy, it is marked not inUse and expires timestamp is refreshed
   */
  release(ws: WebSocket, cacheKey: string): void {
    const entries = this.pool.get(cacheKey);
    if (!entries) return;

    const entryIdx = entries.findIndex((e) => e.ws === ws);
    if (entryIdx < 0) return;

    const entry = entries[entryIdx];

    // If socket is dead, remove it from pool
    if (ws.readyState !== WebSocket.OPEN) {
      try {
        ws.close();
      } catch {
        // ignore close errors
      }
      entries.splice(entryIdx, 1);
      return;
    }

    // Socket is healthy, mark not inUse and refresh expiration
    entry.inUse = false;
    entry.expires = Date.now() + POOL_TTL_MS;
  }

  /**
   * Get count of non-expired entries in pool (for tests)
   */
  getPoolSize(): number {
    let count = 0;
    const now = Date.now();
    for (const entries of this.pool.values()) {
      count += entries.filter((e) => e.expires > now).length;
    }
    return count;
  }

  /**
   * Remove all expired entries from the pool
   */
  private evictExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entries] of this.pool.entries()) {
      // Filter out expired entries
      const alive = entries.filter((e) => e.expires > now);

      if (alive.length === 0) {
        keysToDelete.push(key);
      } else if (alive.length < entries.length) {
        this.pool.set(key, alive);
      }
    }

    for (const key of keysToDelete) {
      this.pool.delete(key);
    }
  }
}

/**
 * Module-level singleton pool
 * All handlers use this shared instance
 */
export const gatewayPool = new GatewayConnectionPool();

/**
 * Clear the pool (synchronous)
 * Closes all sockets and empties the map
 * Used in afterEach() for test isolation
 */
export function clearPool(): void {
  // Get reference to internal pool via any-cast (private map)
  const pool = (gatewayPool as any).pool as Map<string, PoolEntry[]>;

  for (const entries of pool.values()) {
    for (const entry of entries) {
      try {
        entry.ws.close();
      } catch {
        // ignore close errors
      }
    }
  }

  pool.clear();
}
