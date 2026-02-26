/**
 * v1 Agent Detail Route Tests
 * Tests RFC 9457 compliant agent detail, update, and deletion endpoints
 * Path: GET/PUT/DELETE /api/v1/workspaces/{workspaceId}/agents/{agentId}
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
      getAgent: "agents:getAgent",
      updateAgent: "agents:updateAgent",
      deleteAgent: "agents:deleteAgent",
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
  AGENT_LEVEL: {
    LEAD: "lead",
    SPECIALIST: "specialist",
    INTERN: "intern",
  },
}));

import { ConvexHttpClient } from "convex/browser";
import { verifyAgent } from "@/lib/agent-auth";
import { GET, PUT, DELETE } from "../route";

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

describe("GET /api/v1/workspaces/{workspaceId}/agents/{agentId}", () => {
  it("should return agent details with RFC 9457 format", async () => {
    mockQuery.mockResolvedValue({
      _id: "a1",
      name: "jarvis",
      role: "lead",
      level: "lead",
      status: "active",
      capabilities: ["planning"],
      model: "gpt-4",
      personality: "helpful",
      _creationTime: 1234567890,
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1",
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

    // Validate agent data
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("a1");
    expect(body.data.name).toBe("jarvis");
    expect(body.data.level).toBe("lead");
  });

  it("should return 401 when missing authentication", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1",
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

  it("should return 404 when agent not found", async () => {
    mockQuery.mockResolvedValue(null);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/nonexistent",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", agentId: "nonexistent" },
    });

    expect(response.status).toBe(404);
    const body = await response.json();

    expect(body.status).toBe(404);
    expect(body.title).toBe("Not Found");
  });

  it("should return 404 when workspace ID is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//agents/a1",
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
    expect(body.title).toBe("Not Found");
  });

  it("should return 404 when agent ID is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/",
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
    const body = await response.json();

    expect(body.status).toBe(404);
    expect(body.title).toBe("Not Found");
  });

  it("should include X-Request-ID header", async () => {
    mockQuery.mockResolvedValue({
      _id: "a1",
      name: "jarvis",
      role: "lead",
      level: "lead",
      status: "active",
      _creationTime: 1234567890,
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1",
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

describe("PUT /api/v1/workspaces/{workspaceId}/agents/{agentId}", () => {
  it("should update agent and return 200", async () => {
    mockMutation.mockResolvedValue({
      _id: "a1",
      name: "jarvis-updated",
      role: "lead",
      level: "lead",
      status: "active",
    });

    const body = {
      name: "jarvis-updated",
      role: "lead",
      status: "active",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(200);
    const responseBody = await response.json();

    expect(responseBody.success).toBe(true);
    expect(responseBody.data.name).toBe("jarvis-updated");
  });

  it("should return 400 for invalid JSON body", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
        },
        body: "invalid json {",
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body.status).toBe(400);
    expect(body.type).toContain("validation_error");
  });

  it("should return 401 when missing authentication", async () => {
    const body = {
      name: "jarvis-updated",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
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
      name: "jarvis-updated",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/nonexistent",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", agentId: "nonexistent" },
    });

    expect(response.status).toBe(404);
    const responseBody = await response.json();

    expect(responseBody.status).toBe(404);
    expect(responseBody.title).toBe("Not Found");
  });

  it("should include X-Request-ID header in response", async () => {
    mockMutation.mockResolvedValue({
      _id: "a1",
      name: "jarvis-updated",
      role: "lead",
      level: "lead",
      status: "active",
    });

    const body = {
      name: "jarvis-updated",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.headers.get("X-Request-ID")).toBeDefined();
    expect(response.headers.get("X-Request-ID")).toMatch(/^req-/);
  });
});

describe("DELETE /api/v1/workspaces/{workspaceId}/agents/{agentId}", () => {
  it("should delete agent and return 204", async () => {
    mockMutation.mockResolvedValue({ _id: "a1" });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1",
      {
        method: "DELETE",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(204);
  });

  it("should return 401 when missing authentication", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1",
      {
        method: "DELETE",
        headers: {},
      }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(401);
    const body = await response.json();

    expect(body.status).toBe(401);
    expect(body.title).toBe("Unauthorized");
  });

  it("should return 404 when agent not found", async () => {
    mockMutation.mockResolvedValue(null);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/nonexistent",
      {
        method: "DELETE",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", agentId: "nonexistent" },
    });

    expect(response.status).toBe(404);
    const body = await response.json();

    expect(body.status).toBe(404);
    expect(body.title).toBe("Not Found");
  });

  it("should return 404 when workspace ID is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//agents/a1",
      {
        method: "DELETE",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "", agentId: "a1" },
    });

    expect(response.status).toBe(404);
    const body = await response.json();

    expect(body.status).toBe(404);
    expect(body.title).toBe("Not Found");
  });

  it("should include X-Request-ID header in response", async () => {
    mockMutation.mockResolvedValue({ _id: "a1" });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1",
      {
        method: "DELETE",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.headers.get("X-Request-ID")).toBeDefined();
    expect(response.headers.get("X-Request-ID")).toMatch(/^req-/);
  });
});
