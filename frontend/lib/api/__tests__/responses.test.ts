/**
 * Response Formatting Tests
 * Tests RFC 9457 error format and standardized response formats
 */

import {
  generateRequestId,
  errorResponse,
  successResponse,
  listResponse,
  rateLimitExceeded,
} from "../responses";

describe("Response Formatting", () => {
  describe("generateRequestId", () => {
    it("should generate a unique request ID", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^req-\d+-[a-f0-9]+$/);
    });

    it("should include timestamp in request ID", () => {
      const before = Date.now();
      const id = generateRequestId();
      const after = Date.now();

      const parts = id.split("-");
      const timestamp = parseInt(parts[1], 10);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it("should generate 1000 unique IDs (no collisions)", () => {
      const ids = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        ids.add(generateRequestId());
      }

      expect(ids.size).toBe(1000);
    });
  });

  describe("errorResponse", () => {
    it("should create RFC 9457 compliant error response", () => {
      const response = errorResponse(400, "validation_error", "Validation Error", "Missing required field: agentKey", "/api/v1/agents");

      expect(response).toMatchObject({
        type: "https://api.mission-control.dev/errors/validation_error",
        title: "Validation Error",
        detail: "Missing required field: agentKey",
        instance: "/api/v1/agents",
        status: 400,
      });

      expect(response.requestId).toMatch(/^req-\d+-[a-f0-9]+$/);
      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("should include all required RFC 9457 fields", () => {
      const response = errorResponse(404, "not_found", "Not Found", "Agent not found");

      expect(response).toHaveProperty("type");
      expect(response).toHaveProperty("title");
      expect(response).toHaveProperty("detail");
      expect(response).toHaveProperty("instance");
      expect(response).toHaveProperty("status");
      expect(response).toHaveProperty("requestId");
      expect(response).toHaveProperty("timestamp");
    });

    it("should use default instance if not provided", () => {
      const response = errorResponse(500, "internal_error", "Internal Error", "Something went wrong");

      expect(response.instance).toBe("/api");
    });

    it("should use provided request ID", () => {
      const customId = "req-custom-123";
      const response = errorResponse(400, "validation_error", "Error", "Detail", "/api", customId);

      expect(response.requestId).toBe(customId);
    });

    it("should generate request ID if not provided", () => {
      const response = errorResponse(500, "internal_error", "Error", "Detail");

      expect(response.requestId).toMatch(/^req-\d+-[a-f0-9]+$/);
    });

    it("should include HTTP status code", () => {
      const response = errorResponse(429, "rate_limit", "Too Many Requests", "Rate limit exceeded");

      expect(response.status).toBe(429);
    });

    it("should format timestamp as ISO8601", () => {
      const response = errorResponse(400, "error", "Error", "Detail");

      expect(() => new Date(response.timestamp)).not.toThrow();
      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe("successResponse", () => {
    it("should create success response with data", () => {
      const data = { id: "agent-123", name: "Jarvis" };
      const response = successResponse(data);

      expect(response).toMatchObject({
        success: true,
        data,
      });

      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("should include success flag", () => {
      const response = successResponse({ test: "data" });

      expect(response.success).toBe(true);
    });

    it("should include ISO8601 timestamp", () => {
      const response = successResponse({ test: "data" });

      expect(() => new Date(response.timestamp)).not.toThrow();
    });

    it("should support optional metadata", () => {
      const data = { id: "123" };
      const meta = { version: "1.0.0" };
      const response = successResponse(data, meta);

      expect(response).toMatchObject({
        success: true,
        data,
        version: "1.0.0",
      });
    });

    it("should work with various data types", () => {
      const arrayResponse = successResponse([1, 2, 3]);
      expect(arrayResponse.data).toEqual([1, 2, 3]);

      const stringResponse = successResponse("test");
      expect(stringResponse.data).toBe("test");

      const numberResponse = successResponse(42);
      expect(numberResponse.data).toBe(42);

      const nullResponse = successResponse(null);
      expect(nullResponse.data).toBeNull();
    });
  });

  describe("listResponse", () => {
    it("should create paginated list response", () => {
      const items = [
        { id: "1", name: "Agent 1" },
        { id: "2", name: "Agent 2" },
      ];
      const response = listResponse(items, 100, 20, 0);

      expect(response).toMatchObject({
        success: true,
        data: items,
      });

      expect(response.pagination).toMatchObject({
        total: 100,
        limit: 20,
        offset: 0,
        hasMore: true,
      });
    });

    it("should indicate hasMore correctly", () => {
      // Has more items
      const response1 = listResponse([1, 2], 100, 20, 0);
      expect(response1.pagination.hasMore).toBe(true);

      // No more items
      const response2 = listResponse([1, 2], 2, 20, 0);
      expect(response2.pagination.hasMore).toBe(false);

      // Exactly at end
      const response3 = listResponse([1, 2], 2, 2, 0);
      expect(response3.pagination.hasMore).toBe(false);
    });

    it("should include cursor information", () => {
      const response = listResponse([1, 2], 100, 20, 0);

      expect(response.pagination.cursor).toBeDefined();
      expect(response.pagination.cursor).toMatch(/^[A-Za-z0-9+/=]+$/); // base64
    });

    it("should handle nextCursor parameter", () => {
      const nextCursor = "next-cursor-123";
      const response = listResponse([1, 2], 100, 20, 0, nextCursor);

      expect(response.pagination.nextCursor).toBe(nextCursor);
    });

    it("should handle empty list", () => {
      const response = listResponse([], 0, 20, 0);

      expect(response.data).toEqual([]);
      expect(response.pagination.hasMore).toBe(false);
      expect(response.pagination.total).toBe(0);
    });

    it("should include timestamp", () => {
      const response = listResponse([1], 10, 20, 0);

      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe("rateLimitExceeded", () => {
    it("should create rate limit error response", () => {
      const now = Date.now();
      const resetAt = now + 3600 * 1000; // 1 hour from now
      const response = rateLimitExceeded(50, resetAt);

      expect(response).toMatchObject({
        type: "https://api.mission-control.dev/errors/rate_limit_exceeded",
        title: "Rate Limit Exceeded",
        status: 429,
      });

      expect(response.retryAfter).toBeGreaterThan(0);
      expect(response.retryAfter).toBeLessThanOrEqual(3600);
    });

    it("should calculate retryAfter in seconds", () => {
      const now = Date.now();
      const resetAt = now + 30 * 1000; // 30 seconds from now
      const response = rateLimitExceeded(10, resetAt);

      expect(response.retryAfter).toBeGreaterThanOrEqual(29);
      expect(response.retryAfter).toBeLessThanOrEqual(31);
    });

    it("should have minimum retryAfter of 1 second", () => {
      const now = Date.now();
      const resetAt = now - 1000; // Already passed
      const response = rateLimitExceeded(0, resetAt);

      expect(response.retryAfter).toBeGreaterThanOrEqual(1);
    });

    it("should include 429 status code", () => {
      const response = rateLimitExceeded(0, Date.now() + 60000);

      expect(response.status).toBe(429);
    });

    it("should generate request ID", () => {
      const response = rateLimitExceeded(0, Date.now() + 60000);

      expect(response.requestId).toMatch(/^req-\d+-[a-f0-9]+$/);
    });

    it("should use provided request ID", () => {
      const customId = "req-custom-rate-limit";
      const response = rateLimitExceeded(0, Date.now() + 60000, customId);

      expect(response.requestId).toBe(customId);
    });
  });

  describe("Integration tests", () => {
    it("should format complete error response workflow", () => {
      const requestId = generateRequestId();
      const response = errorResponse(
        400,
        "validation_error",
        "Validation Error",
        "Missing required field: agentKey",
        "/api/v1/agents",
        requestId
      );

      expect(response.requestId).toBe(requestId);
      expect(response.status).toBe(400);
      expect(response.detail).toContain("agentKey");
      expect(response.timestamp).toBeDefined();
    });

    it("should format complete success response workflow", () => {
      const data = { agents: 10, active: 5 };
      const response = successResponse(data, { cacheVersion: "1.0" });

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect((response as any).cacheVersion).toBe("1.0");
    });

    it("should format complete paginated response workflow", () => {
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      const response = listResponse(items, 1000, 20, 0);

      expect(response.success).toBe(true);
      expect(response.data.length).toBe(20);
      expect(response.pagination.total).toBe(1000);
      expect(response.pagination.hasMore).toBe(true);
    });
  });
});
