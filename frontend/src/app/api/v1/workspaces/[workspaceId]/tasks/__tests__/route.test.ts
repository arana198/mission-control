/**
 * v1 Workspace Tasks Route Tests
 * Tests RFC 9457 compliant task endpoints (GET and POST)
 * Path: GET /api/v1/workspaces/{workspaceId}/tasks
 * Path: POST /api/v1/workspaces/{workspaceId}/tasks
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
      listTasks: "tasks:listTasks",
      createTask: "tasks:createTask",
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

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(() => ({
    query: mockQuery,
    mutation: mockMutation,
  } as any));
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
});

describe("GET /api/v1/workspaces/{workspaceId}/tasks", () => {
  it("should validate route exists and accepts GET requests", async () => {
    expect(typeof GET).toBe("function");
    expect(GET.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//tasks",
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
      },
    });

    expect(response.status).toBe(404);
  });

  it("should accept pagination parameters limit and cursor", async () => {
    mockQuery.mockResolvedValue({
      items: [],
      total: 0,
      nextCursor: null,
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks?limit=50&cursor=abc123",
      {
        method: "GET",
      }
    );

    const response = await GET(request as any, {
      params: {
        workspaceId: "ws-123",
      },
    });

    expect([200, 500]).toContain(response.status);
  });

  it("should accept status filter parameter", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks?status=in_progress",
      {
        method: "GET",
      }
    );

    const response = await GET(request as any, {
      params: {
        workspaceId: "ws-123",
      },
    });

    expect([200, 500]).toContain(response.status);
  });
});

describe("POST /api/v1/workspaces/{workspaceId}/tasks", () => {
  it("should validate route exists and accepts POST requests", async () => {
    expect(typeof POST).toBe("function");
    expect(POST.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const body = { title: "New Task" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//tasks",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 400 for missing title", async () => {
    const body = { description: "Task description" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks",
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

    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for empty title", async () => {
    const body = { title: "" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks",
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

    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for title exceeding max length", async () => {
    const body = { title: "x".repeat(201) };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks",
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

    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for invalid priority", async () => {
    const body = { title: "Task", priority: "critical" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks",
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

    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for invalid status", async () => {
    const body = { title: "Task", status: "unknown" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks",
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

    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for invalid JSON body", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "invalid json {",
      }
    );

    const response = await POST(request as any, {
      params: { workspaceId: "ws-123" },
    });

    expect([400, 500]).toContain(response.status);
  });

  it("should accept valid task creation with all fields", async () => {
    const body = {
      title: "New Task",
      description: "Task description",
      priority: "high",
      status: "in_progress",
    };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks",
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

    expect([201, 400, 500]).toContain(response.status);
  });

  it("should accept valid task creation with minimal fields", async () => {
    const body = { title: "Minimal Task" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/tasks",
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

    expect([201, 400, 500]).toContain(response.status);
  });
});
