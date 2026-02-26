/**
 * v1 Agent Task Detail Route Tests
 * Tests RFC 9457 compliant task detail endpoint
 * Path: GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}
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
      getTask: "agents:getTask",
    },
  },
}));
jest.mock("@/lib/agent-auth");
jest.mock("@/lib/api/auth");

import { ConvexHttpClient } from "convex/browser";
import { extractAuth } from "@/lib/api/auth";
import { UnauthorizedError } from "@/lib/api/errors";
import { GET } from "../route";

const mockQuery = jest.fn();
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<
  typeof ConvexHttpClient
>;

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(() => ({
    query: mockQuery,
    mutation: jest.fn(),
  } as any));
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";

  // Default: extractAuth throws for empty headers
  (extractAuth as jest.Mock).mockImplementation((authHeader: string) => {
    if (!authHeader) {
      throw new UnauthorizedError("Missing authorization header");
    }
  });
});

describe("GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}", () => {
  it("should return task detail with RFC 9457 format", async () => {
    const now = new Date();
    mockQuery.mockResolvedValue({
      _id: "task-123",
      _creationTime: now.getTime(),
      agentId: "a1",
      title: "Build feature X",
      description: "Implement new API endpoint",
      status: "in-progress",
      priority: "high",
      progress: 65,
      updatedAt: now.getTime(),
      dueDate: new Date(now.getTime() + 86400000).getTime(),
      metrics: {
        startedAt: now.getTime(),
        duration: 3600,
        tokens: 15000,
        cost: 0.25,
      },
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-123",
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
        taskId: "task-123",
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    // Validate RFC 9457 structure
    expect(body).toHaveProperty("success");
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("requestId");

    // Validate success response
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("task-123");
    expect(body.data.title).toBe("Build feature X");
    expect(body.data.status).toBe("in-progress");
    expect(body.data.priority).toBe("high");
    expect(body.data.progress).toBe(65);

    // Validate metrics
    expect(body.data.metrics).toBeDefined();
    expect(body.data.metrics.duration).toBe(3600);
    expect(body.data.metrics.tokens).toBe(15000);

    // Validate request ID
    expect(body.requestId).toMatch(/^req-/);

    // Validate timestamp format
    expect(new Date(body.timestamp).getTime()).toBeGreaterThan(0);
  });

  it("should return 404 when task not found", async () => {
    mockQuery.mockResolvedValue(null);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/nonexistent",
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
        taskId: "nonexistent",
      },
    });

    expect(response.status).toBe(404);
    const body = await response.json();

    expect(body.type).toMatch(/not_found/);
    expect(body.status).toBe(404);
    expect(body.title).toBe("Not Found");
    expect(body.requestId).toMatch(/^req-/);
  });

  it("should return 404 when workspace ID is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//agents/a1/tasks/task-123",
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
        taskId: "task-123",
      },
    });

    expect(response.status).toBe(404);
    const body = await response.json();

    expect(body.status).toBe(404);
    expect(body.title).toBe("Not Found");
  });

  it("should return 404 when agent ID is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents//tasks/task-123",
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
        taskId: "task-123",
      },
    });

    expect(response.status).toBe(404);
    const body = await response.json();

    expect(body.status).toBe(404);
  });

  it("should return 404 when task ID is missing", async () => {
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
    const body = await response.json();

    expect(body.status).toBe(404);
  });

  it("should handle tasks without optional fields", async () => {
    mockQuery.mockResolvedValue({
      _id: "task-456",
      _creationTime: new Date().getTime(),
      agentId: "a1",
      title: "Simple task",
      description: "No extra fields",
      status: "pending",
      priority: "low",
      progress: 0,
      updatedAt: new Date().getTime(),
      // No dueDate, no metrics
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-456",
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
        taskId: "task-456",
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data.dueDate).toBeUndefined();
    expect(body.data.metrics).toBeUndefined();
    expect(body.data.progress).toBe(0);
  });

  it("should include X-Request-ID header in response", async () => {
    mockQuery.mockResolvedValue({
      _id: "task-789",
      _creationTime: new Date().getTime(),
      agentId: "a1",
      title: "Test task",
      description: "For header validation",
      status: "completed",
      priority: "medium",
      progress: 100,
      updatedAt: new Date().getTime(),
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-789",
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
        taskId: "task-789",
      },
    });

    expect(response.headers.get("X-Request-ID")).toMatch(/^req-/);
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("should validate query is called with correct parameters", async () => {
    mockQuery.mockResolvedValue({
      _id: "task-999",
      _creationTime: new Date().getTime(),
      agentId: "a1",
      title: "Query validation test",
      description: "Ensure correct params passed",
      status: "pending",
      priority: "high",
      progress: 25,
      updatedAt: new Date().getTime(),
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-999",
      {
        method: "GET",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    await GET(request as any, {
      params: {
        workspaceId: "ws-123",
        agentId: "a1",
        taskId: "task-999",
      },
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        taskId: "task-999",
        agentId: "a1",
      })
    );
  });
});
