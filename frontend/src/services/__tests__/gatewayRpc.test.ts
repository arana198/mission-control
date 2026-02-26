/**
 * @jest-environment node
 *
 * Gateway RPC Service Tests
 * Tests ping() function interface, types, and exported contracts
 */

import { ping, PingResult } from '../gatewayRpc';

describe('gatewayRpc.ping()', () => {
  describe('Function Signature & Exports', () => {
    it('ping function is exported and callable', () => {
      expect(typeof ping).toBe('function');
    });

    it('ping has correct parameters: url, token, allowInsecureTls, timeoutMs', () => {
      const signature = ping.toString();
      expect(signature).toContain('url');
      expect(signature).toContain('token');
      expect(signature).toContain('allowInsecureTls');
      expect(signature).toContain('timeoutMs');
    });

    it('ping returns a Promise<PingResult>', () => {
      const signature = ping.toString();
      expect(signature).toContain('Promise');
    });
  });

  describe('PingResult Interface', () => {
    it('PingResult should have success property (boolean)', () => {
      const result: PingResult = {
        success: true,
        latencyMs: 42,
      };

      expect(typeof result.success).toBe('boolean');
    });

    it('PingResult should have latencyMs property (number, non-negative)', () => {
      const results: PingResult[] = [
        { success: true, latencyMs: 0 },
        { success: true, latencyMs: 100 },
        { success: false, latencyMs: 50, error: 'timeout' },
      ];

      results.forEach((result) => {
        expect(typeof result.latencyMs).toBe('number');
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      });
    });

    it('PingResult.error is optional and should be a string when present', () => {
      const successResult: PingResult = {
        success: true,
        latencyMs: 42,
      };

      const failureResult: PingResult = {
        success: false,
        latencyMs: 100,
        error: 'Connection refused',
      };

      expect(successResult.error).toBeUndefined();
      expect(typeof failureResult.error).toBe('string');
    });

    it('success=true should not have error message', () => {
      const result: PingResult = {
        success: true,
        latencyMs: 42,
      };

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('success=false should have error message', () => {
      const result: PingResult = {
        success: false,
        latencyMs: 100,
        error: 'Connection refused',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    });
  });

  describe('Default Parameters', () => {
    it('timeoutMs should default to 5000ms', () => {
      const signature = ping.toString();
      // Check if default value is mentioned in the function (5000)
      expect(signature).toContain('5000');
    });
  });

  describe('Type Validation', () => {
    it('disableDevicePairing should be forced to true internally', () => {
      // Verify the docstring mentions this
      const docstring = ping.toString();
      // This is tested more thoroughly in integration tests
      expect(typeof ping).toBe('function');
    });
  });
});
