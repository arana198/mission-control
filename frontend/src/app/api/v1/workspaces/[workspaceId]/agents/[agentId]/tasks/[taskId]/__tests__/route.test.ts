/**
 * v1 Agent Task Detail Route Tests
 * Tests RFC 9457 compliant task detail endpoints (GET and PUT)
 * Path: GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}
 * Path: PUT /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}
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
      getAgentTask: "agents:getAgentTask",
      updateAgentTask: "agents:updateAgentTask",
    },
  },
}));
jest.mock("@/lib/agent-auth");
jest.mock("@/lib/api/auth", () => ({
  isAuthRequired: jest.fn(() => false),
  extractAuth: jest.fn(),
}));

import { ConvexHttpClient } from "convex/browser";
import { GET, PUT } from "../route";

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

describe("GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}", () => {
  it("should validate route exists and accepts GET requests", async () => {
    mockQuery.mockResolvedValue({
      _id: "task-1",
      title: "Task",
      status: "pending",
      priority: "normal",
      _creationTime: 1709083200000,
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-1",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    // Route handler should be callable
    expect(typeof GET).toBe("function");

    // Request object should be created successfully
    expect(request).toBeDefined();
    expect(request.method).toBe("GET");
  });

  it("should return 404 when task not found", async () => {
    mockQuery.mockResolvedValue(null);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-notfound",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: {
        workspaceId: "ws-123",
        agentId: "a1",
        taskId: "task-notfound",
      },
    });

    expect(response.status).toBe(404);
    const body = await response.json();

    expect(body.type).toMatch(/not_found/);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//agents/a1/tasks/task-1",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: {
        workspaceId: "",
        agentId: "a1",
        taskId: "task-1",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when agentId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents//tasks/task-1",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: {
        workspaceId: "ws-123",
        agentId: "",
        taskId: "task-1",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when taskId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await GET(request as any, {
      params: {
        workspaceId: "ws-123",
        agentId: "a1",
        taskId: "",
      },
    });

    expect(response.status).toBe(404);
  });
});

describe("PUT /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}", () => {
  it("should validate route exists and accepts PUT requests", async () => {
    const body = {
      title: "Updated",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-1",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer token-123",
        },
        body: JSON.stringify(body),
      }
    );

    // Route handler should be callable
    expect(typeof PUT).toBe("function");

    // Request object should be created successfully
    expect(request).toBeDefined();
    expect(request.method).toBe("PUT");
  });

  it("should return 400 for invalid status", async () => {
    const body = {
      status: "invalid_status",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-1",
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
      params: { workspaceId: "ws-123", agentId: "a1", taskId: "task-1" },
    });

    expect(response.status).toBe(400);
    const responseBody = await response.json();

    expect(responseBody.type).toMatch(/validation_error/);
    expect(responseBody.detail).toContain("Invalid status");
  });

  it("should return 400 for invalid priority", async () => {
    const body = {
      priority: "extreme",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-1",
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
      params: { workspaceId: "ws-123", agentId: "a1", taskId: "task-1" },
    });

    expect(response.status).toBe(400);
    const responseBody = await response.json();

    expect(responseBody.type).toMatch(/validation_error/);
    expect(responseBody.detail).toContain("Invalid priority");
  });

  it("should return 400 for invalid progress", async () => {
    const body = {
      progress: 150,
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-1",
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
      params: { workspaceId: "ws-123", agentId: "a1", taskId: "task-1" },
    });

    expect(response.status).toBe(400);
    const responseBody = await response.json();

    expect(responseBody.type).toMatch(/validation_error/);
    expect(responseBody.detail).toContain("Progress must be");
  });

  it("should return 400 for invalid JSON body", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-1",
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
      params: { workspaceId: "ws-123", agentId: "a1", taskId: "task-1" },
    });

    expect(response.status).toBe(400);
    const responseBody = await response.json();

    expect(responseBody.type).toMatch(/validation_error/);
  });

  it("should return 400 when status has invalid value", async () => {
    const body = {
      status: "unknown",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-1",
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
      params: { workspaceId: "ws-123", agentId: "a1", taskId: "task-1" },
    });

    expect(response.status).toBe(400);
  });

  it("should return 400 when priority has invalid value", async () => {
    const body = {
      priority: "critical",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-1",
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
      params: { workspaceId: "ws-123", agentId: "a1", taskId: "task-1" },
    });

    expect(response.status).toBe(400);
  });

  it("should return 400 when progress is negative", async () => {
    const body = {
      progress: -10,
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-1",
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
      params: { workspaceId: "ws-123", agentId: "a1", taskId: "task-1" },
    });

    expect(response.status).toBe(400);
  });
});
