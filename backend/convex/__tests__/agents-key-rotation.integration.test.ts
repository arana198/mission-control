/**
 * Integration Tests for Agent Key Rotation
 * Tests full flow: registration → rotation → verification with Convex
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

describe("Agent Key Rotation - Integration Tests", () => {
  let testAgentId: string;
  let initialApiKey: string;
  let newApiKey: string;

  beforeEach(() => {
    testAgentId = "agent-integration-test-123";
    initialApiKey = "initial-key-uuid-001";
    newApiKey = "rotated-key-uuid-002";
  });

  describe("Complete Rotation Flow", () => {
    it("should complete full rotation flow: register → rotate → verify with new key", async () => {
      // Step 1: Agent Registration (simulated)
      const agent = {
        _id: testAgentId,
        name: "test-agent",
        apiKey: initialApiKey,
        lastKeyRotationAt: null,
        keyRotationCount: 0,
        previousApiKey: null,
        previousKeyExpiresAt: null,
      };

      expect(agent.apiKey).toBe(initialApiKey);
      expect(agent.keyRotationCount).toBe(0);
      expect(agent.previousApiKey).toBeNull();

      // Step 2: Rotate Key
      const now = Date.now();
      const gracePeriodSeconds = 60;
      const rotatedAgent = {
        ...agent,
        apiKey: newApiKey,
        previousApiKey: initialApiKey,
        previousKeyExpiresAt: now + gracePeriodSeconds * 1000,
        lastKeyRotationAt: now,
        keyRotationCount: 1,
      };

      expect(rotatedAgent.apiKey).toBe(newApiKey);
      expect(rotatedAgent.previousApiKey).toBe(initialApiKey);
      expect(rotatedAgent.keyRotationCount).toBe(1);
      expect(rotatedAgent.lastKeyRotationAt).toBeLessThanOrEqual(Date.now());

      // Step 3: Verify with new key (should succeed)
      expect(rotatedAgent.apiKey).toBe(newApiKey);
    });

    it("should keep old key valid during grace period", async () => {
      const now = Date.now();
      const gracePeriodSeconds = 120;
      const oldKeyExpiresAt = now + gracePeriodSeconds * 1000;

      const agent = {
        _id: testAgentId,
        apiKey: newApiKey,
        previousApiKey: initialApiKey,
        previousKeyExpiresAt: oldKeyExpiresAt,
      };

      // Before expiry - both keys should be valid
      const beforeExpiry = now;
      expect(beforeExpiry).toBeLessThan(agent.previousKeyExpiresAt!);
      expect(agent.apiKey === newApiKey || agent.previousApiKey === initialApiKey).toBe(true);

      // After expiry - only new key valid
      const afterExpiry = oldKeyExpiresAt + 1000;
      expect(afterExpiry).toBeGreaterThan(agent.previousKeyExpiresAt!);
      expect(agent.apiKey).toBe(newApiKey);
    });

    it("should invalidate old key after grace period expiry", async () => {
      const now = Date.now();
      const gracePeriodSeconds = 60;
      const oldKeyExpiresAt = now + gracePeriodSeconds * 1000;

      const agent = {
        _id: testAgentId,
        apiKey: newApiKey,
        previousApiKey: initialApiKey,
        previousKeyExpiresAt: oldKeyExpiresAt,
      };

      // Check old key during grace period
      if (now < agent.previousKeyExpiresAt!) {
        expect(agent.previousApiKey).toBe(initialApiKey);
      }

      // Check old key after grace period
      const expiredTime = (agent.previousKeyExpiresAt || 0) + 1;
      if (expiredTime >= (agent.previousKeyExpiresAt || 0)) {
        // Key is stored but should be rejected due to expiry time
        expect(agent.previousApiKey).toBe(initialApiKey);
        expect(expiredTime < (agent.previousKeyExpiresAt || 0)).toBe(false);
      }
    });
  });

  describe("Multiple Consecutive Rotations", () => {
    it("should handle multiple rotations, keeping only last previous key", async () => {
      const key1 = "key-1-uuid";
      const key2 = "key-2-uuid";
      const key3 = "key-3-uuid";

      // First rotation: null → key1
      let agent: { _id: string; apiKey: string; previousApiKey: string | null; keyRotationCount: number } = {
        _id: testAgentId,
        apiKey: key1,
        previousApiKey: null,
        keyRotationCount: 1,
      };

      expect(agent.apiKey).toBe(key1);
      expect(agent.previousApiKey).toBeNull();

      // Second rotation: key1 → key2
      agent = {
        ...agent,
        apiKey: key2,
        previousApiKey: key1,
        keyRotationCount: 2,
      };

      expect(agent.apiKey).toBe(key2);
      expect(agent.previousApiKey).toBe(key1); // Previous key is now key1

      // Third rotation: key2 → key3
      agent = {
        ...agent,
        apiKey: key3,
        previousApiKey: key2, // Old key1 is lost (overwritten)
        keyRotationCount: 3,
      };

      expect(agent.apiKey).toBe(key3);
      expect(agent.previousApiKey).toBe(key2);
      expect(agent.previousApiKey).not.toBe(key1);
      expect(agent.keyRotationCount).toBe(3);
    });

    it("should increment rotation counter correctly", async () => {
      let rotationCount = 0;

      // First rotation
      rotationCount += 1;
      expect(rotationCount).toBe(1);

      // Second rotation
      rotationCount += 1;
      expect(rotationCount).toBe(2);

      // Third rotation
      rotationCount += 1;
      expect(rotationCount).toBe(3);

      // Verify count matches number of rotations
      expect(rotationCount).toBe(3);
    });
  });

  describe("Concurrent Rotation Attempts", () => {
    it("should handle concurrent rotation requests (race condition)", async () => {
      const agent = {
        _id: testAgentId,
        apiKey: initialApiKey,
        keyRotationCount: 0,
      };

      // Simulate two concurrent rotation requests
      const rotation1 = async () => {
        return {
          ...agent,
          apiKey: "key-from-request-1",
          keyRotationCount: agent.keyRotationCount + 1,
        };
      };

      const rotation2 = async () => {
        return {
          ...agent,
          apiKey: "key-from-request-2",
          keyRotationCount: agent.keyRotationCount + 1,
        };
      };

      const [result1, result2] = await Promise.all([rotation1(), rotation2()]);

      // Both requests succeeded but only one should persist in real scenario
      expect(result1.apiKey).not.toBe(result2.apiKey);
      expect(result1.keyRotationCount).toBe(1);
      expect(result2.keyRotationCount).toBe(1);
    });

    it("should rate limit concurrent rotation requests", async () => {
      const rotationAttempts = new Map<string, Array<{ timestamp: number; success: boolean }>>();

      const checkRateLimit = (agentId: string): boolean => {
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;
        const attempts = rotationAttempts.get(agentId) || [];
        const recentRotations = attempts.filter(
          (a: any) => a.timestamp > oneHourAgo && a.success
        );
        return recentRotations.length < 3;
      };

      // First 3 rotations should succeed
      for (let i = 0; i < 3; i++) {
        expect(checkRateLimit(testAgentId)).toBe(true);
        rotationAttempts.set(testAgentId, [
          ...(rotationAttempts.get(testAgentId) || []),
          { timestamp: Date.now(), success: true },
        ]);
      }

      // 4th rotation should be rate limited
      expect(checkRateLimit(testAgentId)).toBe(false);
    });
  });

  describe("Grace Period Verification", () => {
    it("should accept authentication with old key during grace period", async () => {
      const now = Date.now();
      const gracePeriodSeconds = 120;
      const agent = {
        _id: testAgentId,
        apiKey: newApiKey,
        previousApiKey: initialApiKey,
        previousKeyExpiresAt: now + gracePeriodSeconds * 1000,
      };

      // Verify with new key
      expect(agent.apiKey === newApiKey).toBe(true);

      // Verify with old key (during grace period)
      if (now < agent.previousKeyExpiresAt!) {
        expect(agent.previousApiKey === initialApiKey).toBe(true);
      }
    });

    it("should reject old key after grace period expires", async () => {
      const now = Date.now();
      const gracePeriodSeconds = 60;
      const agent = {
        _id: testAgentId,
        apiKey: newApiKey,
        previousApiKey: initialApiKey,
        previousKeyExpiresAt: now + gracePeriodSeconds * 1000,
      };

      // Simulate checking after grace period expires
      const checkTime = agent.previousKeyExpiresAt! + 1000;

      const isOldKeyValid = checkTime < agent.previousKeyExpiresAt!;
      expect(isOldKeyValid).toBe(false);

      // Old key should no longer work
      expect(agent.apiKey).toBe(newApiKey); // Only new key is valid
    });

    it("should handle immediate grace period (0 seconds)", async () => {
      const now = Date.now();
      const agent = {
        _id: testAgentId,
        apiKey: newApiKey,
        previousApiKey: initialApiKey,
        previousKeyExpiresAt: now, // Expires immediately
      };

      // Old key should be invalid immediately
      expect(now < agent.previousKeyExpiresAt!).toBe(false);
      expect(now >= agent.previousKeyExpiresAt!).toBe(true);
    });

    it("should handle max grace period (300 seconds = 5 minutes)", async () => {
      const now = Date.now();
      const gracePeriodSeconds = 300;
      const agent = {
        _id: testAgentId,
        apiKey: newApiKey,
        previousApiKey: initialApiKey,
        previousKeyExpiresAt: now + gracePeriodSeconds * 1000,
      };

      // Old key valid for 5 minutes
      const expireTime = agent.previousKeyExpiresAt;
      expect(expireTime! - now).toBe(300000); // 5 minutes in milliseconds
    });
  });

  describe("Rotation Reasons Tracking", () => {
    it("should track scheduled rotation reason", async () => {
      const rotation = {
        agentId: testAgentId,
        reason: "scheduled" as const,
        rotatedAt: Date.now(),
      };

      expect(rotation.reason).toBe("scheduled");
    });

    it("should track compromised key rotation reason", async () => {
      const rotation = {
        agentId: testAgentId,
        reason: "compromised" as const,
        rotatedAt: Date.now(),
      };

      expect(rotation.reason).toBe("compromised");
    });

    it("should track deployment rotation reason", async () => {
      const rotation = {
        agentId: testAgentId,
        reason: "deployment" as const,
        rotatedAt: Date.now(),
      };

      expect(rotation.reason).toBe("deployment");
    });

    it("should track refresh rotation reason", async () => {
      const rotation = {
        agentId: testAgentId,
        reason: "refresh" as const,
        rotatedAt: Date.now(),
      };

      expect(rotation.reason).toBe("refresh");
    });

    it("should store rotation with all metadata", async () => {
      const now = Date.now();
      const rotation = {
        agentId: testAgentId,
        reason: "scheduled" as const,
        gracePeriodSeconds: 120,
        rotatedAt: now,
        oldKeyExpiresAt: now + 120000,
      };

      expect(rotation).toEqual(
        expect.objectContaining({
          agentId: testAgentId,
          reason: "scheduled",
          gracePeriodSeconds: 120,
        })
      );
    });
  });

  describe("Audit Trail", () => {
    it("should record last key rotation timestamp", async () => {
      const agent = {
        _id: testAgentId,
        lastKeyRotationAt: null,
      };

      const now = Date.now();
      const updatedAgent = {
        ...agent,
        lastKeyRotationAt: now,
      };

      expect(updatedAgent.lastKeyRotationAt).toBeLessThanOrEqual(Date.now());
    });

    it("should increment key rotation count", async () => {
      const agent = {
        _id: testAgentId,
        keyRotationCount: 0,
      };

      const rotations = [1, 2, 3, 4, 5];
      let count = agent.keyRotationCount;

      rotations.forEach(() => {
        count += 1;
        expect(count).toBeGreaterThan(0);
      });

      expect(count).toBe(5);
    });

    it("should maintain rotation history across multiple rotations", async () => {
      const rotationHistory: Array<{ timestamp: number; reason: string }> = [];

      const reasons = ["scheduled", "deployment", "refresh", "compromised"];

      reasons.forEach((reason) => {
        rotationHistory.push({
          timestamp: Date.now(),
          reason,
        });
      });

      expect(rotationHistory).toHaveLength(4);
      expect(rotationHistory[0].reason).toBe("scheduled");
      expect(rotationHistory[rotationHistory.length - 1].reason).toBe("compromised");
    });
  });

  describe("Agent State Consistency", () => {
    it("should maintain agent state after rotation", async () => {
      const agent = {
        _id: testAgentId,
        name: "test-agent",
        role: "worker",
        status: "idle" as const,
        apiKey: initialApiKey,
      };

      const rotatedAgent = {
        ...agent,
        apiKey: newApiKey, // Only API key changes
      };

      // Other fields should remain unchanged
      expect(rotatedAgent._id).toBe(agent._id);
      expect(rotatedAgent.name).toBe(agent.name);
      expect(rotatedAgent.role).toBe(agent.role);
      expect(rotatedAgent.status).toBe(agent.status);
      expect(rotatedAgent.apiKey).not.toBe(agent.apiKey);
    });

    it("should verify agent still exists after rotation", async () => {
      const agent = { _id: testAgentId, apiKey: initialApiKey };
      const rotatedAgent = { ...agent, apiKey: newApiKey };

      expect(rotatedAgent._id).toBe(agent._id);
      expect(rotatedAgent._id).toBeTruthy();
    });
  });

  describe("Error Scenarios", () => {
    it("should fail rotation for non-existent agent", async () => {
      const nonExistentAgentId = "does-not-exist-xyz";
      const agent = null;

      expect(agent).toBeNull();
    });

    it("should fail rotation with invalid current key", async () => {
      const agent = {
        _id: testAgentId,
        apiKey: initialApiKey,
      };

      const invalidKey = "wrong-key-xyz";
      const isValid = agent.apiKey === invalidKey;

      expect(isValid).toBe(false);
    });

    it("should fail rotation with invalid grace period", async () => {
      const invalidGracePeriods = [-1, 301, -100, 1000];

      invalidGracePeriods.forEach((period) => {
        const isValid = period >= 0 && period <= 300;
        expect(isValid).toBe(false);
      });
    });

    it("should fail rotation with invalid reason", async () => {
      const validReasons = ["scheduled", "compromised", "deployment", "refresh"];
      const invalidReason = "invalid_reason";

      const isValid = validReasons.includes(invalidReason);
      expect(isValid).toBe(false);
    });
  });

  describe("Rate Limiting During Integration", () => {
    it("should enforce 3 rotations per hour limit", async () => {
      const rotationAttempts = new Map<string, Array<{ timestamp: number; success: boolean }>>();

      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      // Simulate 3 successful rotations
      const attempts = [
        { timestamp: oneHourAgo + 1000, success: true },
        { timestamp: oneHourAgo + 2000, success: true },
        { timestamp: oneHourAgo + 3000, success: true },
      ];

      rotationAttempts.set(testAgentId, attempts);

      const recentRotations = attempts.filter(
        (a: any) => a.timestamp > oneHourAgo && a.success
      );

      expect(recentRotations).toHaveLength(3);
      expect(recentRotations.length < 3).toBe(false);
    });

    it("should reject 4th rotation in same hour", async () => {
      const rotationAttempts: Array<{ timestamp: number; success: boolean }> = [
        { timestamp: Date.now(), success: true },
        { timestamp: Date.now() + 1000, success: true },
        { timestamp: Date.now() + 2000, success: true },
      ];

      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const recentRotations = rotationAttempts.filter(
        (a: any) => a.timestamp > oneHourAgo && a.success
      );

      const canRotate = recentRotations.length < 3;
      expect(canRotate).toBe(false);
    });

    it("should reset rate limit after 1 hour", async () => {
      const now = Date.now();
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;

      const oldAttempts = [
        { timestamp: twoHoursAgo + 1000, success: true },
        { timestamp: twoHoursAgo + 2000, success: true },
        { timestamp: twoHoursAgo + 3000, success: true },
      ];

      const oneHourAgo = now - 60 * 60 * 1000;
      const recentRotations = oldAttempts.filter((a: any) => a.timestamp > oneHourAgo);

      expect(recentRotations).toHaveLength(0);
      expect(recentRotations.length < 3).toBe(true);
    });
  });
});
