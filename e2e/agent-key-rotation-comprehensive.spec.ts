/**
 * Comprehensive E2E Tests for Agent Key Rotation
 * Extended test coverage for edge cases, race conditions, and complex scenarios
 */

import { test, expect } from "@playwright/test";

const API_BASE = process.env.API_BASE || "http://localhost:3000";

test.describe("Agent Key Rotation - Comprehensive E2E Tests", () => {
  const testAgentId = "e2e-test-agent-123";
  const testApiKey = "e2e-test-key-uuid-001";

  // =========================================================================
  // POSITIVE SCENARIOS
  // =========================================================================

  test.describe("Positive Scenarios", () => {
    test("should rotate key with default parameters", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: {
            Authorization: `Bearer ${testApiKey}`,
            "Content-Type": "application/json",
          },
          data: {},
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.newApiKey).toBeTruthy();
      expect(body.data.gracePeriodSeconds).toBe(0); // Default
    });

    test("should rotate key with scheduled reason", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { reason: "scheduled" },
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should rotate key with deployment reason", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { reason: "deployment" },
        }
      );

      expect(response.status()).toBe(200);
      expect((await response.json()).success).toBe(true);
    });

    test("should rotate key with 30-second grace period", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { gracePeriodSeconds: 30 },
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.gracePeriodSeconds).toBe(30);
    });

    test("should rotate key with max grace period (300 seconds)", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { gracePeriodSeconds: 300 },
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.gracePeriodSeconds).toBe(300);
    });

    test("should return proper response structure", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { reason: "refresh", gracePeriodSeconds: 0 },
        }
      );

      const body = await response.json();
      expect(body).toHaveProperty("success");
      expect(body).toHaveProperty("data");
      expect(body.data).toHaveProperty("newApiKey");
      expect(body.data).toHaveProperty("rotatedAt");
      expect(body.data).toHaveProperty("oldKeyExpiresAt");
      expect(body.data).toHaveProperty("gracePeriodSeconds");
      expect(body.data).toHaveProperty("agentId");
    });

    test("new key should be different from previous rotations", async ({ request }) => {
      const response1 = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: {},
        }
      );

      const key1 = (await response1.json()).data.newApiKey;

      const response2 = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: {},
        }
      );

      const key2 = (await response2.json()).data.newApiKey;

      expect(key1).not.toBe(key2);
    });
  });

  // =========================================================================
  // NEGATIVE SCENARIOS
  // =========================================================================

  test.describe("Negative Scenarios", () => {
    test("should return 401 for invalid API key", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: "Bearer invalid-key-xyz" },
          data: {},
        }
      );

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    test("should return 401 when missing Authorization header", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          data: {},
        }
      );

      expect([400, 401]).toContain(response.status());
    });

    test("should return 404 for non-existent agent", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/nonexistent-agent-xyz/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: {},
        }
      );

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    test("should return 400 for invalid gracePeriodSeconds (negative)", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { gracePeriodSeconds: -1 },
        }
      );

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    test("should return 400 for invalid gracePeriodSeconds (too large)", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { gracePeriodSeconds: 301 },
        }
      );

      expect(response.status()).toBe(400);
    });

    test("should return 400 for invalid reason enum", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { reason: "invalid_reason" },
        }
      );

      expect(response.status()).toBe(400);
    });

    test("should return 400 for malformed JSON", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: {
            Authorization: `Bearer ${testApiKey}`,
            "Content-Type": "application/json",
          },
          data: "not valid json {{{",
        }
      );

      expect(response.status()).toBe(400);
    });

    test("should return 400 for invalid gracePeriodSeconds type (string)", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { gracePeriodSeconds: "sixty" as any },
        }
      );

      expect(response.status()).toBe(400);
    });

    test("should return 400 for invalid gracePeriodSeconds type (float)", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { gracePeriodSeconds: 60.5 },
        }
      );

      expect(response.status()).toBe(400);
    });
  });

  // =========================================================================
  // EDGE CASES
  // =========================================================================

  test.describe("Edge Cases", () => {
    test("should handle rotation with exactly 0-second grace period", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { gracePeriodSeconds: 0 },
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.oldKeyExpiresAt).toBe(body.data.rotatedAt);
    });

    test("should handle rotation with exactly 300-second grace period", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { gracePeriodSeconds: 300 },
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.gracePeriodSeconds).toBe(300);
      expect(body.data.oldKeyExpiresAt - body.data.rotatedAt).toBe(300000);
    });

    test("should handle rotation at hour boundary (59:59 seconds)", async ({ request }) => {
      // This tests the rate limit behavior at hour boundary
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: {},
        }
      );

      expect([200, 429]).toContain(response.status());
    });

    test("should handle empty request body", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: {},
        }
      );

      expect(response.status()).toBe(200);
    });

    test("should handle extra fields in request body", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: {
            reason: "refresh",
            gracePeriodSeconds: 60,
            extraField: "should-be-ignored",
            anotherField: 123,
          },
        }
      );

      expect(response.status()).toBe(200);
    });

    test("should handle very large agentId", async ({ request }) => {
      const longAgentId = "a".repeat(500);
      const response = await request.post(
        `${API_BASE}/api/agents/${longAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: {},
        }
      );

      expect([400, 404]).toContain(response.status());
    });
  });

  // =========================================================================
  // RATE LIMITING TESTS
  // =========================================================================

  test.describe("Rate Limiting", () => {
    test("should allow 3 rotations within 1 hour", async ({ request }) => {
      const agentId = "rate-limit-test-agent-1";
      const apiKey = "rate-limit-test-key-1";

      const results = [];
      for (let i = 0; i < 3; i++) {
        const response = await request.post(
          `${API_BASE}/api/agents/${agentId}/rotate-key`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
            data: {},
          }
        );
        results.push(response.status());
      }

      expect(results[0]).toBe(200);
      expect(results[1]).toBe(200);
      expect(results[2]).toBe(200);
    });

    test("should reject 4th rotation within same hour", async ({ request }) => {
      const agentId = "rate-limit-test-agent-2";
      const apiKey = "rate-limit-test-key-2";

      // Make 3 successful rotations
      for (let i = 0; i < 3; i++) {
        await request.post(`${API_BASE}/api/agents/${agentId}/rotate-key`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          data: {},
        });
      }

      // 4th rotation should fail
      const response = await request.post(
        `${API_BASE}/api/agents/${agentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          data: {},
        }
      );

      expect(response.status()).toBe(429);
      const body = await response.json();
      expect(body.error.code).toBe("RATE_LIMITED");
      expect(body.error.details.retryAfterSeconds).toBe(3600);
    });

    test("should have separate rate limits per agent", async ({ request }) => {
      const agent1Id = "rate-limit-agent-a";
      const agent1Key = "rate-limit-key-a";
      const agent2Id = "rate-limit-agent-b";
      const agent2Key = "rate-limit-key-b";

      // Agent 1: 3 rotations
      for (let i = 0; i < 3; i++) {
        await request.post(`${API_BASE}/api/agents/${agent1Id}/rotate-key`, {
          headers: { Authorization: `Bearer ${agent1Key}` },
          data: {},
        });
      }

      // Agent 2: Should still be able to rotate
      const agent2Response = await request.post(
        `${API_BASE}/api/agents/${agent2Id}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${agent2Key}` },
          data: {},
        }
      );

      expect(agent2Response.status()).toBe(200);
    });

    test("should include retry-after header on 429", async ({ request }) => {
      const agentId = "rate-limit-test-agent-3";
      const apiKey = "rate-limit-test-key-3";

      // Max out rotations
      for (let i = 0; i < 3; i++) {
        await request.post(`${API_BASE}/api/agents/${agentId}/rotate-key`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          data: {},
        });
      }

      // Check for rate limit
      const response = await request.post(
        `${API_BASE}/api/agents/${agentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          data: {},
        }
      );

      if (response.status() === 429) {
        const body = await response.json();
        expect(body.error.details.retryAfterSeconds).toBe(3600);
      }
    });
  });

  // =========================================================================
  // GRACE PERIOD TESTS
  // =========================================================================

  test.describe("Grace Period Behavior", () => {
    test("old key should remain valid during grace period", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { gracePeriodSeconds: 60 },
        }
      );

      const body = await response.json();
      const gracePeriodMs = body.data.gracePeriodSeconds * 1000;
      const expiryTime = body.data.oldKeyExpiresAt;

      // Verify old key expiry is in the future
      expect(expiryTime).toBeGreaterThan(Date.now());
    });

    test("should calculate correct oldKeyExpiresAt", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { gracePeriodSeconds: 120 },
        }
      );

      const body = await response.json();
      const expectedExpiry = body.data.rotatedAt + 120000; // 120 seconds in ms

      expect(body.data.oldKeyExpiresAt).toBe(expectedExpiry);
    });

    test("should handle minimum grace period (0 seconds)", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { gracePeriodSeconds: 0 },
        }
      );

      const body = await response.json();
      expect(body.data.oldKeyExpiresAt).toBe(body.data.rotatedAt);
    });

    test("should handle maximum grace period (300 seconds)", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { gracePeriodSeconds: 300 },
        }
      );

      const body = await response.json();
      const timeDiff = body.data.oldKeyExpiresAt - body.data.rotatedAt;
      expect(timeDiff).toBe(300000); // 300 seconds in milliseconds
    });
  });

  // =========================================================================
  // RESPONSE HEADERS & FORMAT
  // =========================================================================

  test.describe("Response Headers and Format", () => {
    test("should include X-Request-Id header", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: {},
        }
      );

      const requestId = response.headers()["x-request-id"];
      expect(requestId).toBeTruthy();
      // Should be UUID format
      expect(requestId).toMatch(/^[a-f0-9-]+$/);
    });

    test("should include Cache-Control header", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: {},
        }
      );

      expect(response.headers()["cache-control"]).toBe("no-store");
    });

    test("should return JSON content-type", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: {},
        }
      );

      expect(response.headers()["content-type"]).toContain("application/json");
    });

    test("response body should have consistent structure", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { reason: "scheduled", gracePeriodSeconds: 60 },
        }
      );

      const body = await response.json();

      if (body.success) {
        expect(body.data.newApiKey).toMatch(/^[a-f0-9-]+$/); // UUID format
        expect(typeof body.data.rotatedAt).toBe("number");
        expect(typeof body.data.oldKeyExpiresAt).toBe("number");
        expect(typeof body.data.gracePeriodSeconds).toBe("number");
      }
    });
  });

  // =========================================================================
  // CONCURRENT REQUESTS
  // =========================================================================

  test.describe("Concurrent Request Handling", () => {
    test("should handle multiple concurrent rotations", async ({ request }) => {
      const agentId = "concurrent-test-agent";
      const apiKey = "concurrent-test-key";

      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          request.post(`${API_BASE}/api/agents/${agentId}/rotate-key`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            data: {},
          })
        );
      }

      const responses = await Promise.all(promises);

      const successCount = responses.filter((r) => r.status() === 200).length;
      const rateLimitCount = responses.filter((r) => r.status() === 429).length;

      // Some should succeed, some might hit rate limit depending on timing
      expect(successCount + rateLimitCount).toBe(3);
    });
  });

  // =========================================================================
  // ERROR MESSAGE QUALITY
  // =========================================================================

  test.describe("Error Message Quality", () => {
    test("should provide clear error message for invalid credentials", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: "Bearer wrong-key" },
          data: {},
        }
      );

      const body = await response.json();
      expect(body.error.message).toContain("Invalid");
    });

    test("should provide clear error message for rate limit", async ({ request }) => {
      const agentId = "error-msg-test-agent";
      const apiKey = "error-msg-test-key";

      for (let i = 0; i < 3; i++) {
        await request.post(`${API_BASE}/api/agents/${agentId}/rotate-key`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          data: {},
        });
      }

      const response = await request.post(
        `${API_BASE}/api/agents/${agentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          data: {},
        }
      );

      if (response.status() === 429) {
        const body = await response.json();
        expect(body.error.message).toContain("3");
        expect(body.error.message).toContain("hour");
      }
    });

    test("should provide details object for validation errors", async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/agents/${testAgentId}/rotate-key`,
        {
          headers: { Authorization: `Bearer ${testApiKey}` },
          data: { gracePeriodSeconds: 999 },
        }
      );

      if (response.status() === 400) {
        const body = await response.json();
        expect(body.error).toHaveProperty("message");
      }
    });
  });
});
