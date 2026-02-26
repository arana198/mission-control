/**
 * Route Helpers Tests
 * Tests utilities for standardizing API routes during migration
 */

import {
  extractWorkspaceIdFromPath,
  parsePaginationFromRequest,
  createListResponse,
  validateWorkspaceAccess,
  isMethodAllowed,
  createErrorResponseObject,
  createSuccessResponseObject,
  createListResponseObject,
  getWorkspaceIdFromUrl,
} from "../routeHelpers";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../errors";

// Mock NextRequest for testing (avoid next/server in test environment)
const mockNextRequest = (url: string) => ({
  url,
  headers: {
    get: (key: string) => null,
  },
  method: "GET",
});

describe("Route Helpers", () => {
  describe("extractWorkspaceIdFromPath", () => {
    it("should extract workspace ID from /api/v1/ path", () => {
      const path = "/api/v1/workspaces/ws-123/agents";
      const result = extractWorkspaceIdFromPath(path);
      expect(result).toBe("ws-123");
    });

    it("should extract workspace ID from /api/ legacy path", () => {
      const path = "/api/workspaces/ws-456/tasks";
      const result = extractWorkspaceIdFromPath(path);
      expect(result).toBe("ws-456");
    });

    it("should return null if no workspace ID found", () => {
      const path = "/api/health";
      const result = extractWorkspaceIdFromPath(path);
      expect(result).toBeNull();
    });

    it("should handle workspace IDs with hyphens and underscores", () => {
      const path = "/api/v1/workspaces/ws_prod-2024/agents";
      const result = extractWorkspaceIdFromPath(path);
      expect(result).toBe("ws_prod-2024");
    });

    it("should extract first workspace ID if multiple in path", () => {
      const path = "/api/v1/workspaces/ws-123/agents/ws-456";
      const result = extractWorkspaceIdFromPath(path);
      expect(result).toBe("ws-123");
    });
  });

  describe("parsePaginationFromRequest", () => {
    it("should parse limit from search params", () => {
      const params = new URLSearchParams("limit=50");
      const result = parsePaginationFromRequest(params, 20);
      expect(result.limit).toBe(50);
    });

    it("should parse cursor from search params", () => {
      // Create a valid cursor using encodeCursor from pagination
      // A valid cursor would be base64 encoded offset:0:createdAt:{timestamp}
      // For this test, we'll just verify cursor param is passed through parsePaginationParams
      // which will validate it
      const validCursorData = "offset:0:createdAt:" + Date.now();
      const cursor = Buffer.from(validCursorData).toString("base64");
      const params = new URLSearchParams(`cursor=${cursor}`);
      const result = parsePaginationFromRequest(params, 20);
      expect(result.cursor).toBe(cursor);
    });

    it("should use default limit if not provided", () => {
      const params = new URLSearchParams("");
      const result = parsePaginationFromRequest(params, 20);
      expect(result.limit).toBe(20);
    });

    it("should enforce max limit of 100", () => {
      const params = new URLSearchParams("limit=500");
      const result = parsePaginationFromRequest(params, 20);
      expect(result.limit).toBe(100);
    });

    it("should enforce min limit of 1", () => {
      const params = new URLSearchParams("limit=0");
      const result = parsePaginationFromRequest(params, 20);
      expect(result.limit).toBe(1);
    });

    it("should handle custom default limit", () => {
      const params = new URLSearchParams("");
      const result = parsePaginationFromRequest(params, 50);
      expect(result.defaultLimit).toBe(50);
    });
  });

  describe("createListResponse", () => {
    it("should create paginated response", () => {
      const items = [{ id: "1", name: "Item 1" }];
      const result = createListResponse(items, 10, 20, 0);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(items);
      expect(result.pagination.total).toBe(10);
      expect(result.pagination.limit).toBe(20);
    });

    it("should include pagination metadata", () => {
      const items = [{ id: "1" }];
      const result = createListResponse(items, 100, 20, 0);

      expect(result.pagination).toHaveProperty("total");
      expect(result.pagination).toHaveProperty("limit");
      expect(result.pagination).toHaveProperty("offset");
      expect(result.pagination).toHaveProperty("cursor");
      expect(result.pagination).toHaveProperty("hasMore");
    });

    it("should calculate hasMore correctly", () => {
      // hasMore = offset + items.length < total
      // offset=0, items.length=1, total=10 → 0+1 < 10 = true (more items exist)
      const result1 = createListResponse([{ id: "1" }], 10, 20, 0);
      expect(result1.pagination.hasMore).toBe(true);

      // offset=0, items.length=10, total=10 → 0+10 < 10 = false (no more items)
      const result2 = createListResponse(
        Array.from({ length: 10 }, (_, i) => ({ id: String(i) })),
        10,
        20,
        0
      );
      expect(result2.pagination.hasMore).toBe(false);
    });

    it("should include timestamp", () => {
      const result = createListResponse([], 0, 20, 0);
      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe("string");
    });
  });

  describe("validateWorkspaceAccess", () => {
    it("should not throw if workspace ID in access list", () => {
      expect(() => {
        validateWorkspaceAccess("ws-123", ["ws-123", "ws-456"]);
      }).not.toThrow();
    });

    it("should throw ForbiddenError if workspace ID not in list", () => {
      expect(() => {
        validateWorkspaceAccess("ws-999", ["ws-123", "ws-456"]);
      }).toThrow(ForbiddenError);
    });

    it("should throw ForbiddenError if access list is empty", () => {
      expect(() => {
        validateWorkspaceAccess("ws-123", []);
      }).toThrow(ForbiddenError);
    });
  });

  describe("isMethodAllowed", () => {
    it("should return true if method in allowed list", () => {
      const allowed = isMethodAllowed("GET", ["GET", "POST"]);
      expect(allowed).toBe(true);
    });

    it("should return false if method not in allowed list", () => {
      const allowed = isMethodAllowed("DELETE", ["GET", "POST"]);
      expect(allowed).toBe(false);
    });

    it("should be case-sensitive", () => {
      const allowed = isMethodAllowed("get", ["GET", "POST"]);
      expect(allowed).toBe(false);
    });

    it("should handle empty allowed list", () => {
      const allowed = isMethodAllowed("GET", []);
      expect(allowed).toBe(false);
    });
  });

  describe("createErrorResponseObject", () => {
    it("should create error response with correct status", () => {
      const response = createErrorResponseObject(
        400,
        "validation_error",
        "Validation Error",
        "Invalid input",
        "/api/v1/agents",
        "req-123"
      );

      expect(response.status).toBe(400);
    });

    it("should include RFC 9457 error format", () => {
      const response = createErrorResponseObject(
        404,
        "not_found",
        "Not Found",
        "Resource not found",
        "/api/v1/agents/123",
        "req-456"
      );

      expect(response).toHaveProperty("type");
      expect(response).toHaveProperty("title");
      expect(response).toHaveProperty("detail");
      expect(response).toHaveProperty("instance");
      expect(response).toHaveProperty("status");
    });

    it("should include request ID", () => {
      const response = createErrorResponseObject(
        500,
        "internal_error",
        "Internal Error",
        "Something went wrong",
        "/api/v1/agents",
        "req-789"
      );

      expect(response.requestId).toBe("req-789");
    });
  });

  describe("createSuccessResponseObject", () => {
    it("should create success response with data", () => {
      const data = { id: "123", name: "Agent" };
      const response = createSuccessResponseObject(data, null);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
    });

    it("should include success flag", () => {
      const response = createSuccessResponseObject({ id: "1" }, null);

      expect(response.success).toBe(true);
    });

    it("should include timestamp", () => {
      const response = createSuccessResponseObject(null, null);

      expect(response.timestamp).toBeDefined();
      expect(typeof response.timestamp).toBe("string");
    });
  });

  describe("createListResponseObject", () => {
    it("should create list response", () => {
      const items = [{ id: "1" }];
      const response = createListResponseObject(items, 10, 20, 0);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(items);
    });

    it("should include pagination in response", () => {
      const items = [{ id: "1" }];
      const response = createListResponseObject(items, 10, 20, 0);

      expect(response.pagination).toBeDefined();
      expect(response.pagination.total).toBe(10);
    });
  });

  describe("getWorkspaceIdFromUrl", () => {
    it("should extract workspace ID from request URL", () => {
      const url = "http://localhost:3000/api/v1/workspaces/ws-123/agents";

      const workspaceId = getWorkspaceIdFromUrl(url);
      expect(workspaceId).toBe("ws-123");
    });

    it("should throw NotFoundError if no workspace ID in URL", () => {
      const url = "http://localhost:3000/api/health";

      expect(() => {
        getWorkspaceIdFromUrl(url);
      }).toThrow(NotFoundError);
    });

    it("should work with legacy /api/ paths", () => {
      const url = "http://localhost:3000/api/workspaces/ws-456/tasks";

      const workspaceId = getWorkspaceIdFromUrl(url);
      expect(workspaceId).toBe("ws-456");
    });
  });
});
