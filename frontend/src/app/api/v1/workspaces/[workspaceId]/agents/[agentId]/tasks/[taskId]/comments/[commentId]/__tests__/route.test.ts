/**
 * v1 Agent Task Comment Detail Route Tests
 * Tests RFC 9457 compliant comment detail endpoints (GET, PUT, DELETE)
 * Path: GET/PUT/DELETE /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}/comments/{commentId}
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
      getTaskComment: "agents:getTaskComment",
      updateTaskComment: "agents:updateTaskComment",
      deleteTaskComment: "agents:deleteTaskComment",
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
  createErrorResponseObject: jest.fn((type, title, detail, status) => ({
    type,
    title,
    detail,
    status,
  })),
}));

import { ConvexHttpClient } from "convex/browser";
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

describe("GET /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}/comments/{commentId}", () => {
  it("should validate route exists and accepts GET requests", async () => {
    // Route handler should be callable
    expect(typeof GET).toBe("function");
    expect(GET.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//agents/a1/tasks/task-1/comments/comment-1",
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
        commentId: "comment-1",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when agentId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents//tasks/task-1/comments/comment-1",
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
        commentId: "comment-1",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when taskId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks//comments/comment-1",
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
        commentId: "comment-1",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when commentId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-1/comments/",
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
        taskId: "task-1",
        commentId: "",
      },
    });

    expect(response.status).toBe(404);
  });
});

describe("PUT /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}/comments/{commentId}", () => {
  it("should validate route exists and accepts PUT requests", async () => {
    // Route handler should be callable
    expect(typeof PUT).toBe("function");
    expect(PUT.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const body = { content: "Updated comment" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//agents/a1/tasks/task-1/comments/comment-1",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: {
        workspaceId: "",
        agentId: "a1",
        taskId: "task-1",
        commentId: "comment-1",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when agentId is missing", async () => {
    const body = { content: "Updated comment" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents//tasks/task-1/comments/comment-1",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: {
        workspaceId: "ws-123",
        agentId: "",
        taskId: "task-1",
        commentId: "comment-1",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when taskId is missing", async () => {
    const body = { content: "Updated comment" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks//comments/comment-1",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: {
        workspaceId: "ws-123",
        agentId: "a1",
        taskId: "",
        commentId: "comment-1",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when commentId is missing", async () => {
    const body = { content: "Updated comment" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-1/comments/",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: {
        workspaceId: "ws-123",
        agentId: "a1",
        taskId: "task-1",
        commentId: "",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should validate request returns error response structure", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-1/comments/comment-1",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{}",
      }
    );

    const response = await PUT(request as any, {
      params: {
        workspaceId: "ws-123",
        agentId: "a1",
        taskId: "task-1",
        commentId: "comment-1",
      },
    });

    // Should return either 400 or 500 (depending on request handling)
    expect([400, 500]).toContain(response.status);
  });
});

describe("DELETE /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}/comments/{commentId}", () => {
  it("should validate route exists and accepts DELETE requests", async () => {
    // Route handler should be callable
    expect(typeof DELETE).toBe("function");
    expect(DELETE.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//agents/a1/tasks/task-1/comments/comment-1",
      {
        method: "DELETE",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await DELETE(request as any, {
      params: {
        workspaceId: "",
        agentId: "a1",
        taskId: "task-1",
        commentId: "comment-1",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when agentId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents//tasks/task-1/comments/comment-1",
      {
        method: "DELETE",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await DELETE(request as any, {
      params: {
        workspaceId: "ws-123",
        agentId: "",
        taskId: "task-1",
        commentId: "comment-1",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when taskId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks//comments/comment-1",
      {
        method: "DELETE",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await DELETE(request as any, {
      params: {
        workspaceId: "ws-123",
        agentId: "a1",
        taskId: "",
        commentId: "comment-1",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when commentId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/agents/a1/tasks/task-1/comments/",
      {
        method: "DELETE",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await DELETE(request as any, {
      params: {
        workspaceId: "ws-123",
        agentId: "a1",
        taskId: "task-1",
        commentId: "",
      },
    });

    expect(response.status).toBe(404);
  });
});
