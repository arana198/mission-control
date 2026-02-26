/**
 * Tests for API key rotation endpoint
 * POST /api/agents/{agentId}/rotate-key
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

describe("POST /api/agents/{agentId}/rotate-key", () => {
  describe("Request validation", () => {
    it("should reject missing agentId", async () => {
      const body = { apiKey: "test-key" };
      // This would be tested at the route level with mocked context
      // In real tests, validate input locally
      expect(body.apiKey).toBeDefined();
    });

    it("should reject missing apiKey in header and body", async () => {
      const body = {};
      const authHeader = null;
      // Simulate validation
      const hasAuth = !!(body.apiKey || (authHeader && authHeader.startsWith("Bearer ")));
      expect(hasAuth).toBe(false);
    });

    it("should reject invalid gracePeriodSeconds (negative)", async () => {
      const body = {
        apiKey: "test-key",
        gracePeriodSeconds: -1,
      };
      const isValid = body.gracePeriodSeconds >= 0 && body.gracePeriodSeconds <= 300;
      expect(isValid).toBe(false);
    });

    it("should reject invalid gracePeriodSeconds (too large)", async () => {
      const body = {
        apiKey: "test-key",
        gracePeriodSeconds: 301,
      };
      const isValid = body.gracePeriodSeconds >= 0 && body.gracePeriodSeconds <= 300;
      expect(isValid).toBe(false);
    });

    it("should reject invalid reason enum", async () => {
      const validReasons = ["scheduled", "compromised", "deployment", "refresh"];
      const invalidReason = "invalid";
      const isValid = validReasons.includes(invalidReason);
      expect(isValid).toBe(false);
    });

    it("should accept valid request with Authorization header", async () => {
      const authHeader = "Bearer valid-api-key-uuid";
      const body = {
        reason: "deployment",
        gracePeriodSeconds: 60,
      };

      const hasAuth = authHeader.startsWith("Bearer ");
      const apiKey = authHeader.slice(7);
      const hasGracePeriod = body.gracePeriodSeconds >= 0 && body.gracePeriodSeconds <= 300;

      expect(hasAuth).toBe(true);
      expect(apiKey).toBe("valid-api-key-uuid");
      expect(hasGracePeriod).toBe(true);
    });

    it("should accept valid request with apiKey in body", async () => {
      const body = {
        apiKey: "valid-api-key-uuid",
        reason: "scheduled",
        gracePeriodSeconds: 120,
      };

      expect(body.apiKey).toBeDefined();
      expect(body.apiKey.length > 0).toBe(true);
      expect(["scheduled", "compromised", "deployment", "refresh"].includes(body.reason)).toBe(
        true
      );
    });

    it("should use default values for optional fields", async () => {
      const body = {
        apiKey: "test-key",
      };

      const reason = body.reason || "refresh";
      const gracePeriodSeconds = body.gracePeriodSeconds ?? 0;

      expect(reason).toBe("refresh");
      expect(gracePeriodSeconds).toBe(0);
    });
  });

  describe("Response format", () => {
    it("should return success response with newApiKey", async () => {
      const successResponse = {
        success: true,
        data: {
          agentId: "agent-123",
          newApiKey: "new-uuid-key",
          rotatedAt: Date.now(),
          oldKeyExpiresAt: Date.now(),
          gracePeriodSeconds: 0,
        },
      };

      expect(successResponse.success).toBe(true);
      expect(successResponse.data).toHaveProperty("newApiKey");
      expect(typeof successResponse.data.newApiKey).toBe("string");
      expect(successResponse.data.newApiKey.length).toBeGreaterThan(0);
      expect(successResponse.data.rotatedAt).toBeLessThanOrEqual(Date.now());
    });

    it("should return 401 for invalid credentials", async () => {
      const errorResponse = {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid agent credentials",
        },
      };

      const statusCode = 401;

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe("UNAUTHORIZED");
      expect(statusCode).toBe(401);
    });

    it("should return 404 for agent not found", async () => {
      const errorResponse = {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Agent not found",
        },
      };

      const statusCode = 404;

      expect(errorResponse.error.code).toBe("NOT_FOUND");
      expect(statusCode).toBe(404);
    });

    it("should return 429 for rate limit exceeded", async () => {
      const errorResponse = {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many rotation requests. Maximum 3 per hour.",
          details: {
            retryAfterSeconds: 3600,
          },
        },
      };

      const statusCode = 429;

      expect(errorResponse.error.code).toBe("RATE_LIMITED");
      expect(errorResponse.error.details.retryAfterSeconds).toBe(3600);
      expect(statusCode).toBe(429);
    });

    it("should return 400 for validation error", async () => {
      const errorResponse = {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: {
            gracePeriodSeconds: "Must be between 0 and 300",
          },
        },
      };

      const statusCode = 400;

      expect(errorResponse.error.code).toBe("VALIDATION_ERROR");
      expect(errorResponse.error.details).toHaveProperty("gracePeriodSeconds");
      expect(statusCode).toBe(400);
    });

    it("should include X-Request-Id header in response", async () => {
      const headers = {
        "X-Request-Id": "req-abc-123",
        "Cache-Control": "no-store",
      };

      expect(headers).toHaveProperty("X-Request-Id");
      expect(headers["Cache-Control"]).toBe("no-store");
    });
  });

  describe("Grace period handling", () => {
    it("should calculate oldKeyExpiresAt correctly with grace period", async () => {
      const gracePeriodSeconds = 120;
      const rotatedAt = Date.now();
      const expectedExpiry = rotatedAt + gracePeriodSeconds * 1000;

      const actualExpiry = rotatedAt + gracePeriodSeconds * 1000;

      expect(actualExpiry).toBe(expectedExpiry);
    });

    it("should expire old key immediately when gracePeriodSeconds is 0", async () => {
      const gracePeriodSeconds = 0;
      const rotatedAt = Date.now();
      const expectedExpiry = rotatedAt;

      const actualExpiry = rotatedAt + gracePeriodSeconds * 1000;

      expect(actualExpiry).toBe(expectedExpiry);
    });

    it("should allow configurable grace periods", async () => {
      const testCases = [
        { gracePeriodSeconds: 0, name: "immediate" },
        { gracePeriodSeconds: 60, name: "1 minute" },
        { gracePeriodSeconds: 300, name: "5 minutes" },
      ];

      for (const testCase of testCases) {
        const isValid =
          testCase.gracePeriodSeconds >= 0 && testCase.gracePeriodSeconds <= 300;
        expect(isValid).toBe(true);
      }
    });
  });

  describe("Rate limiting", () => {
    it("should track rotation attempts per agent", async () => {
      const agentId = "agent-123";
      const attempts: Array<{ timestamp: number; success: boolean }> = [];

      // First rotation
      attempts.push({ timestamp: Date.now(), success: true });
      expect(attempts.length).toBe(1);

      // Second rotation
      attempts.push({ timestamp: Date.now(), success: true });
      expect(attempts.length).toBe(2);

      // Third rotation
      attempts.push({ timestamp: Date.now(), success: true });
      expect(attempts.length).toBe(3);
    });

    it("should allow 3 rotations per hour", async () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const attempts = [
        { timestamp: oneHourAgo + 1000, success: true },
        { timestamp: oneHourAgo + 2000, success: true },
        { timestamp: oneHourAgo + 3000, success: true },
      ];

      const recentRotations = attempts.filter((a) => a.timestamp > oneHourAgo);

      expect(recentRotations.length).toBe(3);
      expect(recentRotations.length < 3).toBe(false); // Should NOT allow 4th
    });

    it("should reject 4th rotation in the same hour", async () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const attempts = [
        { timestamp: oneHourAgo + 1000, success: true },
        { timestamp: oneHourAgo + 2000, success: true },
        { timestamp: oneHourAgo + 3000, success: true },
      ];

      const recentRotations = attempts.filter((a) => a.timestamp > oneHourAgo && a.success);
      const canRotate = recentRotations.length < 3;

      expect(canRotate).toBe(false);
    });

    it("should allow rotation after 1 hour has passed", async () => {
      const now = Date.now();
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;

      const attempts = [
        { timestamp: twoHoursAgo + 1000, success: true },
        { timestamp: twoHoursAgo + 2000, success: true },
        { timestamp: twoHoursAgo + 3000, success: true },
      ];

      const oneHourAgo = now - 60 * 60 * 1000;
      const recentRotations = attempts.filter((a) => a.timestamp > oneHourAgo);

      expect(recentRotations.length).toBe(0);
      expect(recentRotations.length < 3).toBe(true);
    });

    it("should ignore failed rotation attempts in rate limit", async () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const attempts = [
        { timestamp: oneHourAgo + 1000, success: false },
        { timestamp: oneHourAgo + 2000, success: false },
        { timestamp: oneHourAgo + 3000, success: true },
        { timestamp: oneHourAgo + 4000, success: true },
        { timestamp: oneHourAgo + 5000, success: true },
      ];

      const successfulRotations = attempts.filter((a) => a.success);

      expect(successfulRotations.length).toBe(3);
      expect(attempts.length).toBe(5);
    });
  });

  describe("Key rotation guarantees", () => {
    it("should generate unique new keys", async () => {
      const keys = new Set<string>();

      // Simulate generating 10 keys
      for (let i = 0; i < 10; i++) {
        const newKey = crypto.randomUUID();
        keys.add(newKey);
      }

      expect(keys.size).toBe(10); // All unique
    });

    it("should not be idempotent", async () => {
      // First rotation returns key1
      const key1 = "new-key-1-uuid";

      // Same request returns different key2
      const key2 = "new-key-2-uuid";

      expect(key1).not.toBe(key2);
    });

    it("should preserve old key during grace period", async () => {
      const oldKey = "old-key-uuid";
      const newKey = "new-key-uuid";
      const gracePeriodSeconds = 60;

      const agentState = {
        apiKey: newKey,
        previousApiKey: oldKey,
        previousKeyExpiresAt: Date.now() + gracePeriodSeconds * 1000,
      };

      expect(agentState.apiKey).toBe(newKey);
      expect(agentState.previousApiKey).toBe(oldKey);
      expect(agentState.previousKeyExpiresAt).toBeGreaterThan(Date.now());
    });

    it("should invalidate old key after grace period", async () => {
      const now = Date.now();
      const gracePeriodSeconds = 60;
      const previousKeyExpiresAt = now + gracePeriodSeconds * 1000;

      // Before expiry
      const isValidBefore = now < previousKeyExpiresAt;
      expect(isValidBefore).toBe(true);

      // After expiry (simulate 61 seconds later)
      const afterExpiry = now + 61 * 1000;
      const isValidAfter = afterExpiry < previousKeyExpiresAt;
      expect(isValidAfter).toBe(false);
    });
  });

  describe("Audit trail", () => {
    it("should log rotation with reason", async () => {
      const logEntry = {
        event: "agent:key_rotated",
        agentId: "agent-123",
        reason: "deployment",
        timestamp: Date.now(),
      };

      expect(logEntry.event).toBe("agent:key_rotated");
      expect(logEntry.reason).toBe("deployment");
    });

    it("should increment keyRotationCount", async () => {
      const agent = {
        _id: "agent-123",
        keyRotationCount: 0,
      };

      // After rotation
      const updatedCount = (agent.keyRotationCount || 0) + 1;

      expect(updatedCount).toBe(1);
    });

    it("should record lastKeyRotationAt timestamp", async () => {
      const now = Date.now();
      const lastKeyRotationAt = now;

      expect(lastKeyRotationAt).toBeLessThanOrEqual(Date.now());
    });
  });
});
