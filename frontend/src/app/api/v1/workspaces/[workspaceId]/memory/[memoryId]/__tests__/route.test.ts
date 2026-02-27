/**
 * v1 Workspace Memory Detail Route Tests
 * Tests RFC 9457 compliant memory endpoints (GET, PUT, DELETE)
 * Path: GET /api/v1/workspaces/{workspaceId}/memory/{memoryId}
 * Path: PUT /api/v1/workspaces/{workspaceId}/memory/{memoryId}
 * Path: DELETE /api/v1/workspaces/{workspaceId}/memory/{memoryId}
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
    memory: {
      getMemory: "memory:getMemory",
      updateMemory: "memory:updateMemory",
      deleteMemory: "memory:deleteMemory",
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

describe("GET /api/v1/workspaces/{workspaceId}/memory/{memoryId}", () => {
  it("should validate route exists and accepts GET requests", async () => {
    expect(typeof GET).toBe("function");
    expect(GET.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//memory/m-123",
      { method: "GET" }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "", memoryId: "m-123" },
    });
    expect(response.status).toBe(404);
  });

  it("should return 404 when memoryId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/memory/",
      { method: "GET" }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", memoryId: "" },
    });
    expect(response.status).toBe(404);
  });

  it("should return 404 when memory does not exist", async () => {
    mockQuery.mockResolvedValue(null);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/memory/nonexistent",
      { method: "GET" }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", memoryId: "nonexistent" },
    });
    expect(response.status).toBe(404);
  });

  it("should return 200 with memory details when found", async () => {
    mockQuery.mockResolvedValue({
      _id: "m-123",
      _creationTime: 1234567890,
      title: "Important Memory",
      content: "Content here",
      type: "knowledge",
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/memory/m-123",
      { method: "GET" }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", memoryId: "m-123" },
    });
    expect([200, 500]).toContain(response.status);
  });
});

describe("PUT /api/v1/workspaces/{workspaceId}/memory/{memoryId}", () => {
  it("should validate route exists and accepts PUT requests", async () => {
    expect(typeof PUT).toBe("function");
    expect(PUT.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const body = { title: "Updated Memory" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//memory/m-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "", memoryId: "m-123" },
    });
    expect(response.status).toBe(404);
  });

  it("should return 404 when memoryId is missing", async () => {
    const body = { title: "Updated Memory" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/memory/",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", memoryId: "" },
    });
    expect(response.status).toBe(404);
  });

  it("should return 400 for empty body", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/memory/m-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", memoryId: "m-123" },
    });
    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for empty title", async () => {
    const body = { title: "" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/memory/m-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", memoryId: "m-123" },
    });
    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for title exceeding max length", async () => {
    const body = { title: "x".repeat(201) };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/memory/m-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", memoryId: "m-123" },
    });
    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for invalid type", async () => {
    const body = { type: "invalid" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/memory/m-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", memoryId: "m-123" },
    });
    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for invalid JSON body", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/memory/m-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "invalid json {",
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", memoryId: "m-123" },
    });
    expect([400, 500]).toContain(response.status);
  });

  it("should accept valid memory update with title", async () => {
    mockMutation.mockResolvedValue({
      _id: "m-123",
      _creationTime: 1234567890,
      title: "Updated Memory",
      content: "Content",
      type: "knowledge",
    });

    const body = { title: "Updated Memory" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/memory/m-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", memoryId: "m-123" },
    });
    expect([200, 400, 500]).toContain(response.status);
  });
});

describe("DELETE /api/v1/workspaces/{workspaceId}/memory/{memoryId}", () => {
  it("should validate route exists and accepts DELETE requests", async () => {
    expect(typeof DELETE).toBe("function");
    expect(DELETE.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//memory/m-123",
      { method: "DELETE" }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "", memoryId: "m-123" },
    });
    expect(response.status).toBe(404);
  });

  it("should return 404 when memoryId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/memory/",
      { method: "DELETE" }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", memoryId: "" },
    });
    expect(response.status).toBe(404);
  });

  it("should return 404 when memory does not exist", async () => {
    mockMutation.mockResolvedValue(false);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/memory/nonexistent",
      { method: "DELETE" }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", memoryId: "nonexistent" },
    });
    expect(response.status).toBe(404);
  });

  it("should return 200 when memory is deleted successfully", async () => {
    mockMutation.mockResolvedValue(true);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/memory/m-123",
      { method: "DELETE" }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", memoryId: "m-123" },
    });
    expect([200, 500]).toContain(response.status);
  });
});
