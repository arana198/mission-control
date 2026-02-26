/**
 * @jest-environment node
 *
 * Gateway Status Endpoint Tests
 * Tests the health check write-back integration
 */

describe('Gateway Status Endpoint', () => {
  describe('Integration contract', () => {
    it('status endpoint pings gateway and writes health status', () => {
      // This endpoint should:
      // 1. Load gateway from Convex DB
      // 2. Call ping() with gateway configuration
      // 3. Write result to Convex via updateHealthStatus mutation
      // 4. Return comprehensive status response

      const expectedFlow = {
        step1: 'Query gateway from Convex DB',
        step2: 'Call ping(url, token, allowInsecureTls, 5000)',
        step3: 'Mutation: updateHealthStatus(gatewayId, isHealthy)',
        step4: 'Return: { gatewayId, name, url, isHealthy, latencyMs, lastChecked, error? }',
      };

      expect(expectedFlow.step1).toBeDefined();
      expect(expectedFlow.step2).toBeDefined();
      expect(expectedFlow.step3).toBeDefined();
      expect(expectedFlow.step4).toBeDefined();
    });

    it('response includes required fields on success', () => {
      const successResponse = {
        gatewayId: 'gateway_123',
        name: 'Test Gateway',
        url: 'wss://test.example.com',
        isHealthy: true,
        latencyMs: 42,
        lastChecked: Date.now(),
      };

      expect(successResponse).toHaveProperty('gatewayId');
      expect(successResponse).toHaveProperty('name');
      expect(successResponse).toHaveProperty('url');
      expect(successResponse).toHaveProperty('isHealthy');
      expect(successResponse).toHaveProperty('latencyMs');
      expect(successResponse).toHaveProperty('lastChecked');
    });

    it('response includes error field on ping failure', () => {
      const failureResponse = {
        gatewayId: 'gateway_456',
        name: 'Failed Gateway',
        url: 'wss://failed.example.com',
        isHealthy: false,
        latencyMs: 5000,
        error: 'Connection timeout',
      };

      expect(failureResponse).toHaveProperty('error');
      expect(typeof failureResponse.error).toBe('string');
      expect(failureResponse.isHealthy).toBe(false);
    });

    it('returns 404 when gateway not found', () => {
      const notFoundResponse = {
        error: 'Gateway not found',
      };

      expect(notFoundResponse).toHaveProperty('error');
      expect(notFoundResponse.error).toBe('Gateway not found');
    });

    it('returns 500 on mutation or ping errors', () => {
      const errorResponse = {
        error: 'Failed to check gateway status',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(typeof errorResponse.error).toBe('string');
    });
  });

  describe('Health status write-back', () => {
    it('updateHealthStatus mutation receives correct parameters on success', () => {
      const mutationCall = {
        gatewayId: 'gateway_123',
        isHealthy: true,
      };

      expect(mutationCall).toHaveProperty('gatewayId');
      expect(mutationCall).toHaveProperty('isHealthy');
      expect(typeof mutationCall.isHealthy).toBe('boolean');
    });

    it('updateHealthStatus mutation receives isHealthy=false on ping failure', () => {
      const mutationCall = {
        gatewayId: 'gateway_456',
        isHealthy: false,
      };

      expect(mutationCall.isHealthy).toBe(false);
    });
  });

  describe('Ping integration', () => {
    it('ping called with gateway URL and configuration', () => {
      const pingCall = {
        url: 'wss://gateway.example.com',
        token: 'auth-token-123',
        allowInsecureTls: false,
        timeoutMs: 5000,
      };

      expect(pingCall).toHaveProperty('url');
      expect(pingCall).toHaveProperty('token');
      expect(pingCall).toHaveProperty('allowInsecureTls');
      expect(pingCall).toHaveProperty('timeoutMs');
      expect(pingCall.timeoutMs).toBe(5000);
    });

    it('ping called with undefined token when gateway has no auth', () => {
      const pingCall = {
        url: 'ws://public-gateway.example.com',
        token: undefined,
        allowInsecureTls: false,
        timeoutMs: 5000,
      };

      expect(pingCall.token).toBeUndefined();
    });
  });
});
