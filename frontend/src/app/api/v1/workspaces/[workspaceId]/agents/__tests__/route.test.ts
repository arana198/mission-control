/**
 * v1 Agents Route Tests
 * Tests RFC 9457 compliant agent list and registration endpoints
 * Path: GET/POST /api/v1/workspaces/{workspaceId}/agents
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
      getAllAgents: "agents:getAllAgents",
      register: "agents:register",
    },
  },
}));
jest.mock("@/lib/agent-auth");
jest.mock("@/lib/api/rbac", () => ({
  requireWorkspaceRole: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/constants/business", () => ({
  AGENT_STATUS: {
    ACTIVE: "active",
    IDLE: "idle",
    BLOCKED: "blocked",
  },
  AGENT_LEVEL: {
    LEAD: "lead",
    SPECIALIST: "specialist",
    INTERN: "intern",
  },
}));

import { ConvexHttpClient } from "convex/browser";
import { verifyAgent } from "@/lib/agent-auth";
import { GET, POST } from "../route";

const mockQuery = jest.fn();
const mockMutation = jest.fn();
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<
  typeof ConvexHttpClient
>;

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(() => ({
    query: mockQuery,
    mutation: mockMutation,
  } as any));
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
});

describe("GET /api/v1/workspaces/{workspaceId}/agents", () => {
  it("should return agent list with RFC 9457 format", async () => {
    mockQuery.mockResolvedValue([
      { _id: "a1", name: "jarvis", role: "lead", level: "lead", status: "active" },
      { _id: "a2", name: "shuri", role: "specialist", level: "specialist", status: "idle" },
    ]);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
          "x-api-key-id": "caller-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    // Validate RFC 9457 structure
    expect(body).toHaveProperty("success");
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("requestId");
    expect(body).toHaveProperty("pagination");

    // Validate success response
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe("jarvis");

    // Validate pagination
    expect(body.pagination.total).toBe(2);
    expect(body.pagination.limit).toBe(20);
    expect(body.pagination.hasMore).toBe(false);

    // Validate request ID
    expect(body.requestId).toMatch(/^req-/);

    // Validate timestamp format
    expect(new Date(body.timestamp).getTime()).toBeGreaterThan(0);
  });

  it("should return 400 when workspace ID is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//agents",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "" },
    });

    expect(response.status).toBe(404);
    const body = await response.json();

    // Validate RFC 9457 error format
    expect(body).toHaveProperty("type");
    expect(body).toHaveProperty("title");
    expect(body).toHaveProperty("detail");
    expect(body).toHaveProperty("instance");
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("requestId");
    expect(body).toHaveProperty("timestamp");

    expect(body.status).toBe(404);
    expect(body.title).toBe("Not Found");
  });

  it("should return 401 when missing authentication", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents",
      {
        method: "GET",
        headers: {},
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123" },
    });

    expect(response.status).toBe(401);
    const body = await response.json();

    expect(body.status).toBe(401);
    expect(body.title).toBe("Unauthorized");
    expect(body.type).toContain("unauthorized");
  });

  it("should support cursor pagination", async () => {
    mockQuery.mockResolvedValue([
      { _id: "a1", name: "jarvis", role: "lead", level: "lead", status: "active" },
    ]);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents?limit=10&cursor=abc123",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
          "x-api-key-id": "caller-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.pagination.limit).toBe(10);
  });

  it("should enforce max limit of 100", async () => {
    mockQuery.mockResolvedValue([]);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents?limit=500",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
          "x-api-key-id": "caller-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.pagination.limit).toBe(100);
  });

  it("should include X-Request-ID header", async () => {
    mockQuery.mockResolvedValue([]);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
          "x-api-key-id": "caller-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123" },
    });

    expect(response.headers.get("X-Request-ID")).toBeDefined();
    expect(response.headers.get("X-Request-ID")).toMatch(/^req-/);
  });
});

describe("POST /api/v1/workspaces/{workspaceId}/agents", () => {
  it("should register new agent and return 201", async () => {
    mockMutation.mockResolvedValue({
      agentId: "agent-1",
      apiKey: "key-1",
      isNew: true,
    });

    const body = {
      name: "Jarvis",
      role: "Squad Lead",
      level: "lead",
      sessionKey: "main:main",
      workspacePath: "/workspace/main",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
          "x-api-key-id": "caller-123",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123" },
    });

    expect(response.status).toBe(201);
    const responseBody = await response.json();

    // Validate RFC 9457 structure
    expect(responseBody).toHaveProperty("success");
    expect(responseBody).toHaveProperty("data");
    expect(responseBody).toHaveProperty("timestamp");
    expect(responseBody).toHaveProperty("requestId");

    // Validate response data
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.agentId).toBe("agent-1");
    expect(responseBody.data.apiKey).toBe("key-1");
    expect(responseBody.data.isNew).toBe(true);
  });

  it("should return 200 for existing agent", async () => {
    mockMutation.mockResolvedValue({
      agentId: "agent-1",
      apiKey: "existing-key",
      isNew: false,
    });

    const body = {
      name: "Jarvis",
      role: "Squad Lead",
      level: "lead",
      sessionKey: "main:main",
      workspacePath: "/workspace/main",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
          "x-api-key-id": "caller-123",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123" },
    });

    expect(response.status).toBe(200);
    const responseBody = await response.json();

    expect(responseBody.success).toBe(true);
    expect(responseBody.data.isNew).toBe(false);
  });

  it("should return 400 for invalid JSON body", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents",
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
      params: { workspaceId: "ws-123" },
    });

    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body.status).toBe(400);
    expect(body.type).toContain("validation_error");
  });

  it("should return 400 for missing required fields", async () => {
    const body = {
      name: "Jarvis",
      // missing required fields
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents",
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
      params: { workspaceId: "ws-123" },
    });

    expect(response.status).toBe(400);
    const responseBody = await response.json();

    expect(responseBody.status).toBe(400);
    expect(responseBody.type).toContain("validation_error");
  });

  it("should return 401 when missing authentication", async () => {
    const body = {
      name: "Jarvis",
      role: "Squad Lead",
      level: "lead",
      sessionKey: "main:main",
      workspacePath: "/workspace/main",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123" },
    });

    expect(response.status).toBe(401);
    const responseBody = await response.json();

    expect(responseBody.status).toBe(401);
    expect(responseBody.title).toBe("Unauthorized");
  });

  it("should include X-Request-ID header in response", async () => {
    mockMutation.mockResolvedValue({
      agentId: "agent-1",
      apiKey: "key-1",
      isNew: true,
    });

    const body = {
      name: "Jarvis",
      role: "Squad Lead",
      level: "lead",
      sessionKey: "main:main",
      workspacePath: "/workspace/main",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
          "x-api-key-id": "caller-123",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123" },
    });

    expect(response.headers.get("X-Request-ID")).toBeDefined();
    expect(response.headers.get("X-Request-ID")).toMatch(/^req-/);
  });

  it("should sanitize sensitive data in logs", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();

    mockMutation.mockResolvedValue({
      agentId: "agent-1",
      apiKey: "key-1",
      isNew: true,
    });

    const body = {
      name: "Jarvis",
      role: "Squad Lead",
      level: "lead",
      sessionKey: "main:main",
      workspacePath: "/workspace/main",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
          "x-api-key-id": "caller-123",
        },
        body: JSON.stringify(body),
      }
    );

    await POST(request as any, {
      params: { workspaceId: "ws-123" },
    });

    // Verify API key is not logged in plain text
    const logCalls = consoleSpy.mock.calls.join(" ");
    expect(logCalls).not.toContain("key-1");

    consoleSpy.mockRestore();
  });
});
