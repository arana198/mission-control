/**
 * v1 Agent Heartbeat Route Tests
 * Tests RFC 9457 compliant agent heartbeat endpoint
 * Path: POST /api/v1/workspaces/{workspaceId}/agents/{agentId}/heartbeat
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      status: init?.status || 200,
      headers: {
        get: (key: string) => init?.headers?.[key] || null,
      },
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(""),
    })),
  },
}));

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    agents: {
      recordHeartbeat: "agents:recordHeartbeat",
    },
  },
}));
jest.mock("@/lib/agent-auth");
jest.mock("@/lib/constants/business", () => ({
  AGENT_STATUS: {
    ACTIVE: "active",
    IDLE: "idle",
    BLOCKED: "blocked",
  },
}));

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

describe("POST /api/v1/workspaces/{workspaceId}/agents/{agentId}/heartbeat", () => {
  it("should record heartbeat and return 200", async () => {
    mockMutation.mockResolvedValue({
      agentId: "a1",
      status: "active",
    });

    const body = {
      status: "active",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/heartbeat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(200);
    const responseBody = await response.json();

    expect(responseBody.success).toBe(true);
    expect(responseBody.data.agentId).toBe("a1");
    expect(responseBody.data.status).toBe("active");
    expect(responseBody.data).toHaveProperty("lastHeartbeat");
    expect(responseBody.data).toHaveProperty("nextHeartbeatIn");
  });

  it("should accept heartbeat without body", async () => {
    mockMutation.mockResolvedValue({
      agentId: "a1",
      status: "active",
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/heartbeat",
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

    expect(responseBody.success).toBe(true);
  });

  it("should record heartbeat with status change", async () => {
    mockMutation.mockResolvedValue({
      agentId: "a1",
      status: "idle",
    });

    const body = {
      status: "idle",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/heartbeat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(200);
    const responseBody = await response.json();

    expect(responseBody.data.status).toBe("idle");
  });

  it("should record heartbeat with metrics", async () => {
    mockMutation.mockResolvedValue({
      agentId: "a1",
      status: "active",
    });

    const body = {
      status: "active",
      metrics: {
        cpuUsage: 45.2,
        memoryUsage: 62.1,
        taskCount: 3,
      },
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/heartbeat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(200);
    // Verify mutation was called with metrics
    expect(mockMutation).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        metrics: body.metrics,
      })
    );
  });

  it("should return 400 for invalid status", async () => {
    const body = {
      status: "invalid_status",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/heartbeat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(400);
    const responseBody = await response.json();

    expect(responseBody.status).toBe(400);
    expect(responseBody.type).toContain("validation_error");
  });

  it("should return 400 for invalid JSON body", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/heartbeat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
        },
        body: "invalid json {",
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(400);
    const responseBody = await response.json();

    expect(responseBody.status).toBe(400);
  });

  it("should return 401 when missing authentication", async () => {
    const body = {
      status: "active",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/heartbeat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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

    const body = {
      status: "active",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/nonexistent/heartbeat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
        },
        body: JSON.stringify(body),
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
    const body = {
      status: "active",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//agents/a1/heartbeat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "", agentId: "a1" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when agent ID is missing", async () => {
    const body = {
      status: "active",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents//heartbeat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
        },
        body: JSON.stringify(body),
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
      status: "active",
    });

    const body = {
      status: "active",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/heartbeat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
        },
        body: JSON.stringify(body),
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
      status: "active",
    });

    const body = {
      status: "active",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/heartbeat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
        },
        body: JSON.stringify(body),
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
});
