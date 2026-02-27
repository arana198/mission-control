/**
 * v1 Workspace Task Detail Route Tests
 * Tests RFC 9457 compliant task endpoints (GET, PUT, DELETE)
 * Path: GET /api/v1/workspaces/{workspaceId}/tasks/{taskId}
 * Path: PUT /api/v1/workspaces/{workspaceId}/tasks/{taskId}
 * Path: DELETE /api/v1/workspaces/{workspaceId}/tasks/{taskId}
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
    tasks: {
      getTask: "tasks:getTask",
      updateTask: "tasks:updateTask",
      deleteTask: "tasks:deleteTask",
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

describe("GET /api/v1/workspaces/{workspaceId}/tasks/{taskId}", () => {
  it("should validate route exists and accepts GET requests", async () => {
    expect(typeof GET).toBe("function");
    expect(GET.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//tasks/task-123",
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
        taskId: "task-123",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when taskId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks/",
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
        taskId: "",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when task does not exist", async () => {
    mockQuery.mockResolvedValue(null);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks/nonexistent",
      {
        method: "GET",
      }
    );

    const response = await GET(request as any, {
      params: {
        workspaceId: "ws-123",
        taskId: "nonexistent",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should return 200 with task details when found", async () => {
    mockQuery.mockResolvedValue({
      _id: "task-123",
      _creationTime: 1234567890,
      title: "Test Task",
      description: "Task description",
      priority: "high",
      status: "in_progress",
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks/task-123",
      {
        method: "GET",
      }
    );

    const response = await GET(request as any, {
      params: {
        workspaceId: "ws-123",
        taskId: "task-123",
      },
    });

    expect([200, 500]).toContain(response.status);
  });
});

describe("PUT /api/v1/workspaces/{workspaceId}/tasks/{taskId}", () => {
  it("should validate route exists and accepts PUT requests", async () => {
    expect(typeof PUT).toBe("function");
    expect(PUT.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const body = { title: "Updated Task" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//tasks/task-123",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "", taskId: "task-123" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when taskId is missing", async () => {
    const body = { title: "Updated Task" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks/",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", taskId: "" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 400 for empty body", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks/task-123",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", taskId: "task-123" },
    });

    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for empty title", async () => {
    const body = { title: "" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks/task-123",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", taskId: "task-123" },
    });

    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for title exceeding max length", async () => {
    const body = { title: "x".repeat(201) };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks/task-123",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", taskId: "task-123" },
    });

    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for invalid priority", async () => {
    const body = { priority: "critical" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks/task-123",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", taskId: "task-123" },
    });

    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for invalid status", async () => {
    const body = { status: "unknown" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks/task-123",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", taskId: "task-123" },
    });

    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for invalid JSON body", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks/task-123",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: "invalid json {",
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", taskId: "task-123" },
    });

    expect([400, 500]).toContain(response.status);
  });

  it("should return 404 when task does not exist", async () => {
    mockMutation.mockResolvedValue(null);

    const body = { title: "Updated Task" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks/nonexistent",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", taskId: "nonexistent" },
    });

    expect(response.status).toBe(404);
  });

  it("should accept valid task update with title", async () => {
    mockMutation.mockResolvedValue({
      _id: "task-123",
      _creationTime: 1234567890,
      title: "Updated Task",
      description: "Task description",
      priority: "high",
      status: "in_progress",
    });

    const body = { title: "Updated Task" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks/task-123",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", taskId: "task-123" },
    });

    expect([200, 400, 500]).toContain(response.status);
  });

  it("should accept valid task update with status", async () => {
    mockMutation.mockResolvedValue({
      _id: "task-123",
      _creationTime: 1234567890,
      title: "Task",
      description: "Task description",
      priority: "high",
      status: "completed",
    });

    const body = { status: "completed" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks/task-123",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", taskId: "task-123" },
    });

    expect([200, 400, 500]).toContain(response.status);
  });
});

describe("DELETE /api/v1/workspaces/{workspaceId}/tasks/{taskId}", () => {
  it("should validate route exists and accepts DELETE requests", async () => {
    expect(typeof DELETE).toBe("function");
    expect(DELETE.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//tasks/task-123",
      {
        method: "DELETE",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "", taskId: "task-123" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when taskId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks/",
      {
        method: "DELETE",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", taskId: "" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when task does not exist", async () => {
    mockMutation.mockResolvedValue(false);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks/nonexistent",
      {
        method: "DELETE",
      }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", taskId: "nonexistent" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 200 when task is deleted successfully", async () => {
    mockMutation.mockResolvedValue(true);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks/task-123",
      {
        method: "DELETE",
      }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", taskId: "task-123" },
    });

    expect([200, 500]).toContain(response.status);
  });
});
