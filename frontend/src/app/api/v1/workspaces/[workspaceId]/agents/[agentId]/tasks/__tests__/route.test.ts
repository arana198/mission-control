/**
 * v1 Agent Tasks Route Tests
 * Tests RFC 9457 compliant agent task list and create endpoints
 * Path: GET/POST /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks
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
      getAgentTasks: "agents:getAgentTasks",
      createAgentTask: "agents:createAgentTask",
    },
  },
}));
jest.mock("@/lib/agent-auth");

import { ConvexHttpClient } from "convex/browser";
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

describe("GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks", () => {
  it("should return task list with pagination", async () => {
    mockQuery.mockResolvedValue([
      {
        _id: "task-1",
        title: "Bug Fix",
        description: "Fix critical bug",
        status: "in_progress",
        priority: "high",
        _creationTime: 1234567890,
      },
      {
        _id: "task-2",
        title: "Feature Request",
        description: "Implement new feature",
        status: "pending",
        priority: "normal",
        _creationTime: 1234567890,
      },
    ]);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks",
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
    expect(body.data).toHaveLength(2);
    expect(body.data[0].title).toBe("Bug Fix");
    expect(body.pagination.total).toBe(2);
  });

  it("should return empty list when no tasks", async () => {
    mockQuery.mockResolvedValue([]);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks",
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

    expect(body.data).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  it("should support status filter", async () => {
    mockQuery.mockResolvedValue([]);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks?status=pending",
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
    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        status: "pending",
      })
    );
  });

  it("should return 401 when missing authentication", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks",
      {
        method: "GET",
        headers: {},
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1" },
    });

    expect(response.status).toBe(401);
  });

  it("should include X-Request-ID header", async () => {
    mockQuery.mockResolvedValue([]);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks",
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

    expect(response.headers.get("X-Request-ID")).toMatch(/^req-/);
  });
});

describe("POST /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks", () => {
  it("should create task and return 201", async () => {
    mockMutation.mockResolvedValue({
      _id: "task-1",
      title: "New Task",
      description: "Task description",
      priority: "high",
    });

    const body = {
      title: "New Task",
      description: "Task description",
      priority: "high",
      dueDate: "2026-03-01",
      tags: ["urgent"],
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks",
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

    expect(response.status).toBe(201);
    const responseBody = await response.json();

    expect(responseBody.success).toBe(true);
    expect(responseBody.data.title).toBe("New Task");
    expect(responseBody.data.priority).toBe("high");
  });

  it("should use default priority if not provided", async () => {
    mockMutation.mockResolvedValue({
      _id: "task-1",
      title: "Task",
      priority: "normal",
    });

    const body = {
      title: "Task without priority",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks",
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

    expect(response.status).toBe(201);
    expect(mockMutation).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        priority: "normal",
      })
    );
  });

  it("should return 400 when title is missing", async () => {
    const body = {
      description: "No title",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks",
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

    expect(responseBody.type).toContain("validation_error");
  });

  it("should return 400 for invalid priority", async () => {
    const body = {
      title: "Task",
      priority: "invalid",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks",
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
  });

  it("should return 400 for invalid JSON", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks",
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
  });

  it("should return 401 when missing authentication", async () => {
    const body = {
      title: "Task",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks",
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
  });

  it("should include X-Request-ID header", async () => {
    mockMutation.mockResolvedValue({
      _id: "task-1",
      title: "Task",
      priority: "normal",
    });

    const body = {
      title: "Task",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks",
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

    expect(response.headers.get("X-Request-ID")).toMatch(/^req-/);
  });
});
