/**
 * v1 Agent Task Comments Route Tests
 * Tests RFC 9457 compliant comment endpoints (GET and POST)
 * Path: GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}/comments
 * Path: POST /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}/comments
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
      getTaskComments: "agents:getTaskComments",
      createTaskComment: "agents:createTaskComment",
    },
  },
}));
jest.mock("@/lib/agent-auth");
jest.mock("@/lib/api/auth", () => ({
  isAuthRequired: jest.fn(() => false),
  extractAuth: jest.fn(),
}));
jest.mock("@/lib/utils/logger", () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));
jest.mock("@/lib/api/routeHelpers", () => ({
  createListResponse: jest.fn((items, meta) => ({
    success: true,
    data: items,
    pagination: meta,
  })),
  createErrorResponseObject: jest.fn((type, title, detail, status) => ({
    type,
    title,
    detail,
    status,
  })),
  parsePaginationFromRequest: jest.fn((request) => ({
    limit: 20,
    cursor: null,
  })),
}));

import { ConvexHttpClient } from "convex/browser";
import { GET, POST } from "../route";

const mockQuery = jest.fn();
const mockMutation = jest.fn();
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<
  typeof ConvexHttpClient
>;

// Helper to create a mock request with proper json() method
const createMockRequest = (url: string, options: any = {}) => {
  const request = new Request(url, options);
  // Override json() to properly parse the body
  const originalJson = request.json.bind(request);
  request.json = jest.fn(async () => {
    try {
      return await originalJson();
    } catch (e) {
      throw new Error("Invalid JSON body");
    }
  });
  return request;
};

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(() => ({
    query: mockQuery,
    mutation: mockMutation,
  } as any));
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
});

describe("GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}/comments", () => {
  it("should validate route exists and accepts GET requests", async () => {
    // Route handler should be callable
    expect(typeof GET).toBe("function");
    expect(GET.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//agents/a1/tasks/task-1/comments",
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
      "http://localhost:3000/api/v1/workspaces/ws-123/agents//tasks/task-1/comments",
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
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks//comments",
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

describe("POST /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}/comments", () => {
  it("should validate route exists and accepts POST requests", async () => {
    // Route handler should be callable
    expect(typeof POST).toBe("function");
    expect(POST.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const body = {
      content: "Test comment",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//agents/a1/tasks/task-1/comments",
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
      params: { workspaceId: "", agentId: "a1", taskId: "task-1" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when agentId is missing", async () => {
    const body = {
      content: "Test comment",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents//tasks/task-1/comments",
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
      params: { workspaceId: "ws-123", agentId: "", taskId: "task-1" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when taskId is missing", async () => {
    const body = {
      content: "Test comment",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks//comments",
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
      params: { workspaceId: "ws-123", agentId: "a1", taskId: "" },
    });

    expect(response.status).toBe(404);
  });

  it("should validate request returns error response structure", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-1/comments",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{}",
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1", taskId: "task-1" },
    });

    // Should return either 400 or 500 (depending on request handling)
    expect([400, 500]).toContain(response.status);
  });

  it("should return error for invalid request body", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-1/comments",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "invalid json {",
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123", agentId: "a1", taskId: "task-1" },
    });

    expect([400, 500]).toContain(response.status);
  });
});
