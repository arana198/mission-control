/**
 * Authentication Tests
 * Tests Bearer token validation, legacy auth, workspace ID extraction
 */

import {
  extractWorkspaceId,
  validateBearerToken,
  validateLegacyAuth,
  extractAuth,
  isAuthRequired,
  isValidApiKeyFormat,
  InvalidTokenError,
  MissingAuthError,
} from "../auth";

describe("Auth Validation", () => {
  describe("extractWorkspaceId", () => {
    it("should extract workspace ID from /api/v1 path", () => {
      const result = extractWorkspaceId("/api/v1/workspaces/ws-123/agents");

      expect(result.workspaceId).toBe("ws-123");
      expect(result.rest).toBe("/agents");
    });

    it("should extract workspace ID from /api path (legacy)", () => {
      const result = extractWorkspaceId("/api/workspaces/ws-456/tasks");

      expect(result.workspaceId).toBe("ws-456");
      expect(result.rest).toBe("/tasks");
    });

    it("should handle workspace ID with various formats", () => {
      const result1 = extractWorkspaceId("/api/v1/workspaces/workspace-abc/agents");
      expect(result1.workspaceId).toBe("workspace-abc");

      const result2 = extractWorkspaceId("/api/v1/workspaces/123/tasks");
      expect(result2.workspaceId).toBe("123");

      const result3 = extractWorkspaceId("/api/v1/workspaces/ws_123/agents");
      expect(result3.workspaceId).toBe("ws_123");
    });

    it("should handle deep paths", () => {
      const result = extractWorkspaceId("/api/v1/workspaces/ws-1/agents/ag-1/tasks");

      expect(result.workspaceId).toBe("ws-1");
      expect(result.rest).toBe("/agents/ag-1/tasks");
    });

    it("should throw on invalid path format", () => {
      expect(() => extractWorkspaceId("/api/invalid/path")).toThrow(InvalidTokenError);
    });

    it("should throw on missing workspace ID", () => {
      expect(() => extractWorkspaceId("/api/v1/workspaces//agents")).toThrow(InvalidTokenError);
    });

    it("should handle empty rest path", () => {
      const result = extractWorkspaceId("/api/v1/workspaces/ws-123");

      expect(result.workspaceId).toBe("ws-123");
      expect(result.rest).toBe("/");
    });

    it("should throw on empty workspace ID", () => {
      expect(() => extractWorkspaceId("/api/v1/workspaces/   /agents")).toThrow(InvalidTokenError);
    });
  });

  describe("validateBearerToken", () => {
    it("should validate Bearer token format", () => {
      const result = validateBearerToken("Bearer test-api-key-123");

      expect(result.token).toBe("test-api-key-123");
      expect(result.apiKeyId).toBe("test-api-key-123");
    });

    it("should handle bearer with mixed case", () => {
      const result = validateBearerToken("bearer test-key");
      expect(result.token).toBe("test-key");
    });

    it("should handle extra whitespace", () => {
      const result = validateBearerToken("Bearer   test-key  ");

      expect(result.token).toBe("test-key");
    });

    it("should throw on missing auth header", () => {
      expect(() => validateBearerToken()).toThrow(MissingAuthError);
    });

    it("should throw on missing Bearer prefix", () => {
      expect(() => validateBearerToken("test-key-123")).toThrow(InvalidTokenError);
    });

    it("should throw on empty token", () => {
      expect(() => validateBearerToken("Bearer ")).toThrow(InvalidTokenError);
    });

    it("should throw on Bearer with no token", () => {
      expect(() => validateBearerToken("Bearer")).toThrow(InvalidTokenError);
    });

    it("should accept complex token formats", () => {
      const complexToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc123";
      const result = validateBearerToken(`Bearer ${complexToken}`);

      expect(result.token).toBe(complexToken);
    });
  });

  describe("validateLegacyAuth", () => {
    it("should validate legacy auth headers", () => {
      const headers = {
        "x-agent-id": "agent-123",
        "x-agent-key": "api-key-456",
      };

      const result = validateLegacyAuth(headers);

      expect(result.agentId).toBe("agent-123");
      expect(result.apiKey).toBe("api-key-456");
    });

    it("should handle header case insensitivity", () => {
      const headers = {
        "X-Agent-ID": "agent-123",
        "X-Agent-Key": "api-key-456",
      };

      const result = validateLegacyAuth(headers);

      expect(result.agentId).toBe("agent-123");
      expect(result.apiKey).toBe("api-key-456");
    });

    it("should handle array header values", () => {
      const headers = {
        "x-agent-id": ["agent-123", "other"],
        "x-agent-key": ["api-key-456"],
      };

      const result = validateLegacyAuth(headers);

      expect(result.agentId).toBe("agent-123");
      expect(result.apiKey).toBe("api-key-456");
    });

    it("should trim whitespace", () => {
      const headers = {
        "x-agent-id": "  agent-123  ",
        "x-agent-key": "  api-key-456  ",
      };

      const result = validateLegacyAuth(headers);

      expect(result.agentId).toBe("agent-123");
      expect(result.apiKey).toBe("api-key-456");
    });

    it("should throw if x-agent-id is missing", () => {
      const headers = {
        "x-agent-key": "api-key-456",
      };

      expect(() => validateLegacyAuth(headers)).toThrow(MissingAuthError);
    });

    it("should throw if x-agent-key is missing", () => {
      const headers = {
        "x-agent-id": "agent-123",
      };

      expect(() => validateLegacyAuth(headers)).toThrow(MissingAuthError);
    });

    it("should throw if headers are empty", () => {
      expect(() => validateLegacyAuth({})).toThrow(MissingAuthError);
    });

    it("should throw on empty agentId value", () => {
      const headers = {
        "x-agent-id": "",
        "x-agent-key": "api-key",
      };

      expect(() => validateLegacyAuth(headers)).toThrow(InvalidTokenError);
    });

    it("should throw on empty apiKey value", () => {
      const headers = {
        "x-agent-id": "agent-123",
        "x-agent-key": "",
      };

      expect(() => validateLegacyAuth(headers)).toThrow(InvalidTokenError);
    });
  });

  describe("extractAuth", () => {
    it("should extract Bearer token when provided", () => {
      const result = extractAuth("Bearer test-token");

      expect(result.type).toBe("bearer");
      expect((result.value as any).token).toBe("test-token");
    });

    it("should extract legacy auth when Bearer not provided", () => {
      const result = extractAuth(undefined, {
        "x-agent-id": "agent-123",
        "x-agent-key": "api-key",
      });

      expect(result.type).toBe("legacy");
      expect((result.value as any).agentId).toBe("agent-123");
    });

    it("should prefer Bearer over legacy auth", () => {
      const result = extractAuth("Bearer test-token", {
        "x-agent-id": "agent-123",
        "x-agent-key": "api-key",
      });

      expect(result.type).toBe("bearer");
      expect((result.value as any).token).toBe("test-token");
    });

    it("should throw if neither auth method is provided", () => {
      expect(() => extractAuth()).toThrow();
    });

    it("should throw if both auth methods fail", () => {
      expect(() =>
        extractAuth("Invalid header", {
          "x-agent-id": "",
          "x-agent-key": "",
        })
      ).toThrow();
    });

    it("should handle fallback to legacy when Bearer is invalid", () => {
      const result = extractAuth("InvalidBearer", {
        "x-agent-id": "agent-123",
        "x-agent-key": "api-key",
      });

      expect(result.type).toBe("legacy");
    });
  });

  describe("isAuthRequired", () => {
    it("should require auth for /api/v1 routes", () => {
      expect(isAuthRequired("/api/v1/agents")).toBe(true);
    });

    it("should require auth for /api routes", () => {
      expect(isAuthRequired("/api/workspaces/ws-1/agents")).toBe(true);
    });

    it("should not require auth for health check", () => {
      expect(isAuthRequired("/api/health")).toBe(false);
    });

    it("should not require auth for status endpoint", () => {
      expect(isAuthRequired("/api/status")).toBe(false);
    });

    it("should not require auth for docs", () => {
      expect(isAuthRequired("/api/docs")).toBe(false);
    });

    it("should not require auth for openapi.json", () => {
      expect(isAuthRequired("/api/openapi.json")).toBe(false);
    });

    it("should require auth for nested paths", () => {
      expect(isAuthRequired("/api/v1/agents/123/tasks")).toBe(true);
    });
  });

  describe("isValidApiKeyFormat", () => {
    it("should accept valid API key format", () => {
      expect(isValidApiKeyFormat("test-api-key-123")).toBe(true);
      expect(isValidApiKeyFormat("api_key_456")).toBe(true);
      expect(isValidApiKeyFormat("abcdefgh")).toBe(true);
    });

    it("should reject short keys", () => {
      expect(isValidApiKeyFormat("short")).toBe(false);
    });

    it("should reject empty keys", () => {
      expect(isValidApiKeyFormat("")).toBe(false);
    });

    it("should reject non-alphanumeric characters", () => {
      expect(isValidApiKeyFormat("api-key!@#$%")).toBe(false);
    });

    it("should reject null/undefined", () => {
      expect(isValidApiKeyFormat(null as any)).toBe(false);
      expect(isValidApiKeyFormat(undefined as any)).toBe(false);
    });

    it("should accept underscores and dashes", () => {
      expect(isValidApiKeyFormat("api_key-123")).toBe(true);
    });

    it("should accept long keys", () => {
      expect(isValidApiKeyFormat("very-long-api-key-with-many-dashes-and-underscores_123")).toBe(
        true
      );
    });
  });

  describe("Integration scenarios", () => {
    it("should handle complete Bearer auth workflow", () => {
      const authHeader = "Bearer sk-1234567890";
      const token = validateBearerToken(authHeader);

      expect(token.apiKeyId).toBe("sk-1234567890");
      expect(token.token).toBe("sk-1234567890");
    });

    it("should handle complete legacy auth workflow", () => {
      const headers = {
        "x-agent-id": "agent-prod-1",
        "x-agent-key": "key-prod-secure",
      };

      const auth = validateLegacyAuth(headers);

      expect(auth.agentId).toBe("agent-prod-1");
      expect(auth.apiKey).toBe("key-prod-secure");
    });

    it("should extract workspace and validate auth together", () => {
      const pathname = "/api/v1/workspaces/ws-prod/agents";
      const authHeader = "Bearer prod-api-key";

      const workspace = extractWorkspaceId(pathname);
      const token = validateBearerToken(authHeader);

      expect(workspace.workspaceId).toBe("ws-prod");
      expect(token.token).toBe("prod-api-key");
    });

    it("should validate complete request context", () => {
      const pathname = "/api/v1/workspaces/ws-123/agents";
      const headers = {
        authorization: "Bearer api-key-123",
      };

      const workspace = extractWorkspaceId(pathname);
      const auth = extractAuth(headers.authorization, headers);

      expect(workspace.workspaceId).toBe("ws-123");
      expect(auth.type).toBe("bearer");
    });
  });
});
