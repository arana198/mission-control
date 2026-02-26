/**
 * v1 Agent Rotate Key Route Tests
 * Tests RFC 9457 compliant agent API key rotation endpoint
 * Path: POST /api/v1/workspaces/{workspaceId}/agents/{agentId}/rotate-key
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      status: init?.status || 200,
      headers: {
        get: (key: string) => init?.headers?.[key] || null,
      },
      json: () => Promise.resolve(data),
    })),
  },
}));

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    agents: {
      rotateApiKey: "agents:rotateApiKey",
    },
  },
}));
jest.mock("@/lib/agent-auth");

import { ConvexHttpClient } from "convex/browser";
import { POST } from "../route";

const mockMutation = jest.fn();
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<
  typeof ConvexHttpClient
>;

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(() => ({
    mutation: mockMutation,
  } as any));
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
});

describe("POST /api/v1/workspaces/{workspaceId}/agents/{agentId}/rotate-key", () => {
  it("should rotate API key and return new key", async () => {
    mockMutation.mockResolvedValue({
      agentId: "a1",
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/rotate-key",
      {
        method: "POST",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(200);
    const responseBody = await response.json();

    // Validate RFC 9457 structure
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.agentId).toBe("a1");
    expect(responseBody.data).toHaveProperty("newApiKey");
    expect(responseBody.data).toHaveProperty("oldKeyExpiresAt");
    expect(responseBody.data).toHaveProperty("rotatedAt");

    // Validate new API key format (should be UUID)
    expect(responseBody.data.newApiKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("should allow empty request body", async () => {
    mockMutation.mockResolvedValue({
      agentId: "a1",
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/rotate-key",
      {
        method: "POST",
        headers: {
          authorization: "Bearer token-123",
        },
        body: JSON.stringify({}),
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(200);
    const responseBody = await response.json();

    expect(responseBody.success).toBe(true);
  });

  it("should return 401 when missing authentication", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/rotate-key",
      {
        method: "POST",
        headers: {},
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(401);
    const responseBody = await response.json();

    expect(responseBody.status).toBe(401);
    expect(responseBody.title).toBe("Unauthorized");
  });

  it("should return 404 when agent not found", async () => {
    mockMutation.mockResolvedValue(null);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/nonexistent/rotate-key",
      {
        method: "POST",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123", agentId: "nonexistent" },
    });

    expect(response.status).toBe(404);
    const responseBody = await response.json();

    expect(responseBody.status).toBe(404);
    expect(responseBody.title).toBe("Not Found");
  });

  it("should return 404 when workspace ID is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//agents/a1/rotate-key",
      {
        method: "POST",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "", agentId: "a1" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when agent ID is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents//rotate-key",
      {
        method: "POST",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123", agentId: "" },
    });

    expect(response.status).toBe(404);
  });

  it("should include X-Request-ID header in response", async () => {
    mockMutation.mockResolvedValue({
      agentId: "a1",
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/rotate-key",
      {
        method: "POST",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.headers.get("X-Request-ID")).toBeDefined();
    expect(response.headers.get("X-Request-ID")).toMatch(/^req-/);
  });

  it("should return RFC 9457 compliant response structure", async () => {
    mockMutation.mockResolvedValue({
      agentId: "a1",
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/rotate-key",
      {
        method: "POST",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    const responseBody = await response.json();

    // Validate RFC 9457 structure
    expect(responseBody).toHaveProperty("success");
    expect(responseBody).toHaveProperty("data");
    expect(responseBody).toHaveProperty("timestamp");
    expect(responseBody).toHaveProperty("requestId");

    expect(typeof responseBody.timestamp).toBe("string");
    expect(responseBody.requestId).toMatch(/^req-/);
  });

  it("should provide old key grace period of 24 hours", async () => {
    mockMutation.mockResolvedValue({
      agentId: "a1",
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/rotate-key",
      {
        method: "POST",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    const responseBody = await response.json();
    const oldKeyExpiration = new Date(responseBody.data.oldKeyExpiresAt);
    const now = new Date();
    const diffHours = (oldKeyExpiration.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Should be approximately 24 hours
    expect(diffHours).toBeGreaterThan(23);
    expect(diffHours).toBeLessThanOrEqual(24);
  });
});
