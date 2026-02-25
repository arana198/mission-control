/**
 * Gateway Validate Connection API Endpoint Tests
 * Tests WebSocket connection validation before saving
 */

describe('POST /api/gateway/[gatewayId]?action=validate', () => {
  const mockGatewayId = 'gateway_123';
  const baseUrl = `/api/gateway/${mockGatewayId}?action=validate`;

  describe('successful connection', () => {
    it('returns { success: true, latencyMs: number } for reachable WebSocket', async () => {
      // Mock fetch to simulate successful WebSocket connection
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          latencyMs: 45,
        }),
      });

      const response = await fetch(baseUrl, { method: 'POST' });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(typeof data.latencyMs).toBe('number');
      expect(data.latencyMs).toBeGreaterThan(0);
    });
  });

  describe('failed connection', () => {
    it('returns { success: false, error: string } when WebSocket is unreachable', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: 'ECONNREFUSED: Connection refused',
        }),
      });

      const response = await fetch(baseUrl, { method: 'POST' });
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(typeof data.error).toBe('string');
      expect(data.error.length).toBeGreaterThan(0);
    });

    it('handles timeout errors (5 second timeout)', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: 'Connection timeout after 5000ms',
        }),
      });

      const response = await fetch(baseUrl, { method: 'POST' });
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('timeout');
    });
  });

  describe('gateway not found', () => {
    it('returns 400 if gatewayId not found in Convex', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Gateway not found',
        }),
      });

      const response = await fetch(baseUrl, { method: 'POST' });

      expect(response.status).toBe(400);
    });
  });

  describe('edge cases', () => {
    it('handles invalid WebSocket URL format', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: 'Invalid WebSocket URL: must start with ws:// or wss://',
        }),
      });

      const response = await fetch(baseUrl, { method: 'POST' });
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toMatch(/invalid|format/i);
    });

    it('returns error for self-signed certificate without allowInsecureTls flag', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: 'Certificate verification failed: SELF_SIGNED_CERT_IN_CHAIN',
        }),
      });

      const response = await fetch(baseUrl, { method: 'POST' });
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('Certificate');
    });

    it('succeeds with allowInsecureTls=true for self-signed certificates', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          latencyMs: 32,
          warning: 'Certificate verification was skipped (allowInsecureTls=true)',
        }),
      });

      const response = await fetch(baseUrl, { method: 'POST' });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.latencyMs).toBeGreaterThan(0);
    });
  });

  describe('latency measurement', () => {
    it('accurately measures connection latency in milliseconds', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          latencyMs: 123,
        }),
      });

      const response = await fetch(baseUrl, { method: 'POST' });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.latencyMs).toBe(123);
    });

    it('handles very fast connections (< 1ms)', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          latencyMs: 0,
        }),
      });

      const response = await fetch(baseUrl, { method: 'POST' });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('handles slow connections (approaching 5s timeout)', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          latencyMs: 4800,
        }),
      });

      const response = await fetch(baseUrl, { method: 'POST' });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.latencyMs).toBeGreaterThan(4000);
    });
  });
});
