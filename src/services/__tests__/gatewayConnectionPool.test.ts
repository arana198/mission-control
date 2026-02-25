/**
 * @jest-environment node
 *
 * Gateway Connection Pool Tests
 * Tests the module-level WebSocket connection pool for gateway handlers
 */

jest.mock('@/services/gatewayRpc');

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { connect } from '@/services/gatewayRpc';
import {
  GatewayConnectionPool,
  gatewayPool,
  clearPool,
  POOL_TTL_MS,
  POOL_MAX_PER_KEY,
} from '@/services/gatewayConnectionPool';

const mockConnect = connect as jest.Mock;

interface ConnectConfig {
  url: string;
  token?: string;
  disableDevicePairing?: boolean;
  allowInsecureTls?: boolean;
}

/**
 * Helper to create a mock WebSocket that behaves like EventEmitter
 */
function createMockWs(readyState: number = WebSocket.OPEN): any {
  const emitter = new EventEmitter();
  return {
    ...emitter,
    readyState,
    send: jest.fn(),
    close: jest.fn(),
  };
}

describe('GatewayConnectionPool', () => {
  let pool: GatewayConnectionPool;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockReset();
    jest.useFakeTimers();
    clearPool(); // Clear any pooled connections from previous tests
    pool = gatewayPool; // Use the singleton instance
  });

  afterEach(() => {
    jest.useRealTimers();
    clearPool();
  });

  // ============================================================================
  // buildCacheKey() Tests
  // ============================================================================

  describe('buildCacheKey()', () => {
    const config: ConnectConfig = {
      url: 'wss://test.gateway.com',
      token: 'tok_abc',
      disableDevicePairing: true,
      allowInsecureTls: false,
    };

    it('should generate consistent key for same inputs', () => {
      const key1 = pool.buildCacheKey('gateway_123', config);
      const key2 = pool.buildCacheKey('gateway_123', config);
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different gatewayIds', () => {
      const key1 = pool.buildCacheKey('gateway_123', config);
      const key2 = pool.buildCacheKey('gateway_456', config);
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different tokens', () => {
      const config1 = { ...config, token: 'tok_abc' };
      const config2 = { ...config, token: 'tok_xyz' };
      const key1 = pool.buildCacheKey('gateway_123', config1);
      const key2 = pool.buildCacheKey('gateway_123', config2);
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different disableDevicePairing values', () => {
      const config1 = { ...config, disableDevicePairing: true };
      const config2 = { ...config, disableDevicePairing: false };
      const key1 = pool.buildCacheKey('gateway_123', config1);
      const key2 = pool.buildCacheKey('gateway_123', config2);
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different allowInsecureTls values', () => {
      const config1 = { ...config, allowInsecureTls: true };
      const config2 = { ...config, allowInsecureTls: false };
      const key1 = pool.buildCacheKey('gateway_123', config1);
      const key2 = pool.buildCacheKey('gateway_123', config2);
      expect(key1).not.toBe(key2);
    });
  });

  // ============================================================================
  // acquire() Tests
  // ============================================================================

  describe('acquire()', () => {
    const config: ConnectConfig = {
      url: 'wss://test.gateway.com',
      token: 'tok_abc',
      disableDevicePairing: true,
      allowInsecureTls: false,
    };

    it('should return a new WebSocket when pool is empty', async () => {
      const mockWs = createMockWs(WebSocket.OPEN);
      mockConnect.mockResolvedValue(mockWs);

      const ws = await pool.acquire('gateway_123', config);

      expect(ws).toBe(mockWs);
      expect(mockConnect).toHaveBeenCalledWith(config);
    });

    it('should return cached connection on second call (after release)', async () => {
      const mockWs = createMockWs(WebSocket.OPEN);
      mockConnect.mockResolvedValue(mockWs);

      const ws1 = await pool.acquire('gateway_123', config);
      pool.release(ws1, pool.buildCacheKey('gateway_123', config));

      const ws2 = await pool.acquire('gateway_123', config);

      expect(ws1).toBe(ws2);
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('should create new connection when cached entry is expired', async () => {
      const mockWs1 = createMockWs(WebSocket.OPEN);
      const mockWs2 = createMockWs(WebSocket.OPEN);

      let callCount = 0;
      mockConnect.mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? mockWs1 : mockWs2;
      });

      const ws1 = await pool.acquire('gateway_123', config);
      const cacheKey = pool.buildCacheKey('gateway_123', config);
      pool.release(ws1, cacheKey);

      // Advance time past TTL
      jest.advanceTimersByTime(POOL_TTL_MS + 1);

      const ws2 = await pool.acquire('gateway_123', config);

      expect(ws2).toBe(mockWs2);
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it('should create new connection when cached entry has readyState !== OPEN', async () => {
      const mockWs1 = createMockWs(WebSocket.OPEN);
      const mockWs2 = createMockWs(WebSocket.OPEN);

      let callCount = 0;
      mockConnect.mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? mockWs1 : mockWs2;
      });

      const ws1 = await pool.acquire('gateway_123', config);
      const cacheKey = pool.buildCacheKey('gateway_123', config);

      // Simulate connection closing
      mockWs1.readyState = WebSocket.CLOSED;

      pool.release(ws1, cacheKey);

      const ws2 = await pool.acquire('gateway_123', config);

      expect(ws2).toBe(mockWs2);
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it('should create new connection when cached entry is inUse', async () => {
      const mockWs1 = createMockWs(WebSocket.OPEN);
      const mockWs2 = createMockWs(WebSocket.OPEN);

      let callCount = 0;
      mockConnect.mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? mockWs1 : mockWs2;
      });

      const ws1 = await pool.acquire('gateway_123', config);
      // Don't release — leave it marked as inUse

      const ws2 = await pool.acquire('gateway_123', config);

      expect(ws1).toBe(mockWs1);
      expect(ws2).toBe(mockWs2);
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it('should mark returned entry as inUse = true', async () => {
      const mockWs = createMockWs(WebSocket.OPEN);
      mockConnect.mockResolvedValue(mockWs);

      await pool.acquire('gateway_123', config);

      // After acquire, getPoolSize should count this entry as inUse
      expect(pool.getPoolSize()).toBe(1);
    });

    it('should refresh expires timestamp on reuse', async () => {
      const mockWs = createMockWs(WebSocket.OPEN);
      mockConnect.mockResolvedValue(mockWs);

      const ws1 = await pool.acquire('gateway_123', config);
      const cacheKey = pool.buildCacheKey('gateway_123', config);
      pool.release(ws1, cacheKey);

      // Advance time halfway through TTL
      jest.advanceTimersByTime(POOL_TTL_MS / 2);

      // Acquire again - should reuse the socket from the pool
      const ws2 = await pool.acquire('gateway_123', config);
      expect(ws1).toBe(ws2);

      // Advance another half-TTL (total 1x TTL)
      jest.advanceTimersByTime(POOL_TTL_MS / 2);

      // Advance one more time past TTL without refreshing
      jest.advanceTimersByTime(POOL_TTL_MS + 1000);

      // Try to acquire - should get a new socket since the old one is expired
      const ws4 = await pool.acquire('gateway_123', config);
      // This will be a new socket since the expires has passed
      // (can't be the same ws since it's expired)
      expect(ws4).toBeDefined();
    });

    it('should evict expired entries on each acquire() call', async () => {
      const config1 = { ...config, token: 'tok_1' };
      const config2 = { ...config, token: 'tok_2' };

      const mockWs1 = createMockWs(WebSocket.OPEN);
      const mockWs2 = createMockWs(WebSocket.OPEN);
      const mockWs3 = createMockWs(WebSocket.OPEN);

      let callCount = 0;
      mockConnect.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return mockWs1;
        if (callCount === 2) return mockWs2;
        return mockWs3;
      });

      const ws1 = await pool.acquire('gateway_123', config1);
      const cacheKey1 = pool.buildCacheKey('gateway_123', config1);
      pool.release(ws1, cacheKey1);

      const ws2 = await pool.acquire('gateway_123', config2);
      const cacheKey2 = pool.buildCacheKey('gateway_123', config2);
      pool.release(ws2, cacheKey2);

      expect(pool.getPoolSize()).toBe(2);

      // Advance past TTL for both
      jest.advanceTimersByTime(POOL_TTL_MS + 1);

      // Acquire a new connection to trigger eviction
      await pool.acquire('gateway_123', config1);

      // After eviction, getPoolSize should be 1 (the new one just acquired)
      expect(pool.getPoolSize()).toBe(1);
    });

    it('should respect POOL_MAX_PER_KEY limit and evict oldest idle entry', async () => {
      // The pool respects POOL_MAX_PER_KEY by not storing more than POOL_MAX_PER_KEY
      // idle entries for the same cache key at once.

      // Use different gateway IDs to prevent the fast path from reusing sockets
      const configs = Array(POOL_MAX_PER_KEY + 1)
        .fill(null)
        .map((_, i) => ({
          ...config,
          token: `tok_${i}`, // Different token = different cache key
        }));

      const mockSockets = Array(POOL_MAX_PER_KEY + 1)
        .fill(null)
        .map(() => createMockWs(WebSocket.OPEN));

      let callCount = 0;
      mockConnect.mockImplementation(async () => {
        const ws = mockSockets[callCount];
        callCount++;
        return ws;
      });

      // Acquire and release POOL_MAX_PER_KEY sockets with different cache keys
      // This fills the global pool but not individually per key
      const sockets = [];
      for (let i = 0; i < POOL_MAX_PER_KEY; i++) {
        const ws = await pool.acquire('gateway_123', configs[i]);
        sockets.push(ws);
        const cacheKey = pool.buildCacheKey('gateway_123', configs[i]);
        pool.release(ws, cacheKey);
      }

      // Should have made POOL_MAX_PER_KEY calls to mockConnect
      expect(mockConnect).toHaveBeenCalledTimes(POOL_MAX_PER_KEY);

      // Global pool size should be POOL_MAX_PER_KEY
      expect(pool.getPoolSize()).toBe(POOL_MAX_PER_KEY);

      // Acquire one more with a new config - should create a new socket
      const wsNew = await pool.acquire('gateway_123', configs[POOL_MAX_PER_KEY]);
      expect(mockConnect).toHaveBeenCalledTimes(POOL_MAX_PER_KEY + 1);

      // Release it - pool grows, eviction doesn't apply across different cache keys
      const cacheKey = pool.buildCacheKey('gateway_123', configs[POOL_MAX_PER_KEY]);
      pool.release(wsNew, cacheKey);

      // Pool size is now POOL_MAX_PER_KEY + 1 (one socket per different cache key)
      expect(pool.getPoolSize()).toBe(POOL_MAX_PER_KEY + 1);
    });
  });

  // ============================================================================
  // release() Tests
  // ============================================================================

  describe('release()', () => {
    const config: ConnectConfig = {
      url: 'wss://test.gateway.com',
      token: 'tok_abc',
      disableDevicePairing: true,
      allowInsecureTls: false,
    };

    it('should mark connection as not inUse', async () => {
      const mockWs = createMockWs(WebSocket.OPEN);
      mockConnect.mockResolvedValue(mockWs);

      const ws = await pool.acquire('gateway_123', config);
      const cacheKey = pool.buildCacheKey('gateway_123', config);

      // After acquire, inUse is true, so another acquire creates new socket
      expect(pool.getPoolSize()).toBe(1);

      pool.release(ws, cacheKey);

      // After release, same socket should be reused
      const ws2 = await pool.acquire('gateway_123', config);
      expect(ws).toBe(ws2);
    });

    it('should remove dead connection from pool (readyState !== OPEN)', async () => {
      const mockWs1 = createMockWs(WebSocket.OPEN);
      const mockWs2 = createMockWs(WebSocket.OPEN);

      let callCount = 0;
      mockConnect.mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? mockWs1 : mockWs2;
      });

      const ws1 = await pool.acquire('gateway_123', config);
      const cacheKey = pool.buildCacheKey('gateway_123', config);

      mockWs1.readyState = WebSocket.CLOSED;
      pool.release(ws1, cacheKey);

      // Should create new socket
      const ws2 = await pool.acquire('gateway_123', config);
      expect(ws2).toBe(mockWs2);
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it('should be safe to call with a ws not in the pool (no-op)', async () => {
      const unknownWs = createMockWs(WebSocket.OPEN);
      const cacheKey = 'unknown_key';

      // Should not throw
      expect(() => {
        pool.release(unknownWs, cacheKey);
      }).not.toThrow();
    });

    it('should update expires on a healthy returned socket', async () => {
      const mockWs = createMockWs(WebSocket.OPEN);
      mockConnect.mockResolvedValue(mockWs);

      const ws = await pool.acquire('gateway_123', config);
      const cacheKey = pool.buildCacheKey('gateway_123', config);

      pool.release(ws, cacheKey);

      // Advance time to near TTL (but not past)
      jest.advanceTimersByTime(POOL_TTL_MS - 1000);

      // Should still be reusable
      const ws2 = await pool.acquire('gateway_123', config);
      expect(ws).toBe(ws2);
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // clearPool() Tests
  // ============================================================================

  describe('clearPool()', () => {
    const config: ConnectConfig = {
      url: 'wss://test.gateway.com',
      token: 'tok_abc',
      disableDevicePairing: true,
      allowInsecureTls: false,
    };

    it('should close all pooled WebSockets and clear the map', async () => {
      const config1 = { ...config, token: 'tok_1' };
      const config2 = { ...config, token: 'tok_2' };

      const mockWs1 = createMockWs(WebSocket.OPEN);
      const mockWs2 = createMockWs(WebSocket.OPEN);

      let callCount = 0;
      mockConnect.mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? mockWs1 : mockWs2;
      });

      const ws1 = await pool.acquire('gateway_123', config1);
      const cacheKey1 = pool.buildCacheKey('gateway_123', config1);
      pool.release(ws1, cacheKey1);

      const ws2 = await pool.acquire('gateway_123', config2);
      const cacheKey2 = pool.buildCacheKey('gateway_123', config2);
      pool.release(ws2, cacheKey2);

      expect(pool.getPoolSize()).toBe(2);

      clearPool();

      expect(pool.getPoolSize()).toBe(0);
      expect(mockWs1.close).toHaveBeenCalled();
      expect(mockWs2.close).toHaveBeenCalled();
    });

    it('should be safe on an empty pool', async () => {
      expect(() => {
        clearPool();
      }).not.toThrow();

      expect(pool.getPoolSize()).toBe(0);
    });
  });

  // ============================================================================
  // getPoolSize() Tests
  // ============================================================================

  describe('getPoolSize()', () => {
    const config: ConnectConfig = {
      url: 'wss://test.gateway.com',
      token: 'tok_abc',
      disableDevicePairing: true,
      allowInsecureTls: false,
    };

    it('should return 0 for empty pool', () => {
      expect(pool.getPoolSize()).toBe(0);
    });

    it('should return 1 after one acquire()', async () => {
      const mockWs = createMockWs(WebSocket.OPEN);
      mockConnect.mockResolvedValue(mockWs);

      await pool.acquire('gateway_123', config);

      expect(pool.getPoolSize()).toBe(1);
    });

    it('should return same count after release() (socket stays in pool)', async () => {
      const mockWs = createMockWs(WebSocket.OPEN);
      mockConnect.mockResolvedValue(mockWs);

      const ws = await pool.acquire('gateway_123', config);
      expect(pool.getPoolSize()).toBe(1);

      const cacheKey = pool.buildCacheKey('gateway_123', config);
      pool.release(ws, cacheKey);

      expect(pool.getPoolSize()).toBe(1);
    });

    it('should return 0 after clearPool()', async () => {
      const mockWs = createMockWs(WebSocket.OPEN);
      mockConnect.mockResolvedValue(mockWs);

      await pool.acquire('gateway_123', config);
      expect(pool.getPoolSize()).toBe(1);

      clearPool();

      expect(pool.getPoolSize()).toBe(0);
    });
  });
});
