/**
 * v1 Agent Poll Route Tests
 * Tests RFC 9457 compliant agent work polling endpoint
 * Path: GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/poll
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
      pollWork: "agents:pollWork",
    },
  },
}));
jest.mock("@/lib/agent-auth");

import { ConvexHttpClient } from "convex/browser";
import { GET } from "../route";

const mockQuery = jest.fn();
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<
  typeof ConvexHttpClient
>;

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(() => ({
    query: mockQuery,
  } as any));
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
});

describe("GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/poll", () => {
  it("should return pending work with RFC 9457 format", async () => {
    mockQuery.mockResolvedValue({
      _id: "task-123",
      type: "task",
      priority: "high",
      payload: { action: "execute", target: "example" },
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/poll",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    // Validate RFC 9457 structure
    expect(body).toHaveProperty("success");
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("requestId");

    // Validate work data
    expect(body.success).toBe(true);
    expect(body.data.taskId).toBe("task-123");
    expect(body.data.type).toBe("task");
    expect(body.data.priority).toBe("high");
    expect(body.data).toHaveProperty("assignedAt");
  });

  it("should return null when no pending work", async () => {
    mockQuery.mockResolvedValue(null);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/poll",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data).toBeNull();
  });

  it("should support timeout parameter", async () => {
    mockQuery.mockResolvedValue(null);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/poll?timeout=15000",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(200);
  });

  it("should validate timeout range", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/poll?timeout=100000",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body.status).toBe(400);
    expect(body.type).toContain("validation_error");
  });

  it("should reject timeout below minimum (1000ms)", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/poll?timeout=500",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(400);
  });

  it("should support filter parameter", async () => {
    mockQuery.mockResolvedValue(null);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/poll?filter=priority:high",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(200);
    // Verify query was called with filter
    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        filter: "priority:high",
      })
    );
  });

  it("should return 401 when missing authentication", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/poll",
      {
        method: "GET",
        headers: {},
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(401);
    const body = await response.json();

    expect(body.status).toBe(401);
    expect(body.title).toBe("Unauthorized");
  });

  it("should return 404 when workspace ID is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//agents/a1/poll",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "", agentId: "a1" },
    });

    expect(response.status).toBe(404);
    const body = await response.json();

    expect(body.status).toBe(404);
  });

  it("should return 404 when agent ID is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents//poll",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", agentId: "" },
    });

    expect(response.status).toBe(404);
  });

  it("should include X-Request-ID header", async () => {
    mockQuery.mockResolvedValue(null);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/poll",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.headers.get("X-Request-ID")).toBeDefined();
    expect(response.headers.get("X-Request-ID")).toMatch(/^req-/);
  });
});
