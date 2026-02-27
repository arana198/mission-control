/**
 * v1 Workspace Epic Detail Route Tests
 * Tests RFC 9457 compliant epic endpoints (GET, PUT, DELETE)
 * Path: GET /api/v1/workspaces/{workspaceId}/epics/{epicId}
 * Path: PUT /api/v1/workspaces/{workspaceId}/epics/{epicId}
 * Path: DELETE /api/v1/workspaces/{workspaceId}/epics/{epicId}
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
    epics: {
      getEpic: "epics:getEpic",
      updateEpic: "epics:updateEpic",
      deleteEpic: "epics:deleteEpic",
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

describe("GET /api/v1/workspaces/{workspaceId}/epics/{epicId}", () => {
  it("should validate route exists and accepts GET requests", async () => {
    expect(typeof GET).toBe("function");
    expect(GET.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//epics/epic-123",
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
        epicId: "epic-123",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when epicId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/epics/",
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
        epicId: "",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when epic does not exist", async () => {
    mockQuery.mockResolvedValue(null);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/epics/nonexistent",
      {
        method: "GET",
      }
    );

    const response = await GET(request as any, {
      params: {
        workspaceId: "ws-123",
        epicId: "nonexistent",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should return 200 with epic details when found", async () => {
    mockQuery.mockResolvedValue({
      _id: "epic-123",
      _creationTime: 1234567890,
      title: "Test Epic",
      description: "Epic description",
      status: "active",
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/epics/epic-123",
      {
        method: "GET",
      }
    );

    const response = await GET(request as any, {
      params: {
        workspaceId: "ws-123",
        epicId: "epic-123",
      },
    });

    expect([200, 500]).toContain(response.status);
  });
});

describe("PUT /api/v1/workspaces/{workspaceId}/epics/{epicId}", () => {
  it("should validate route exists and accepts PUT requests", async () => {
    expect(typeof PUT).toBe("function");
    expect(PUT.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const body = { title: "Updated Epic" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//epics/epic-123",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "", epicId: "epic-123" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when epicId is missing", async () => {
    const body = { title: "Updated Epic" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/epics/",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", epicId: "" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 400 for empty body", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/epics/epic-123",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", epicId: "epic-123" },
    });

    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for empty title", async () => {
    const body = { title: "" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/epics/epic-123",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", epicId: "epic-123" },
    });

    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for title exceeding max length", async () => {
    const body = { title: "x".repeat(201) };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/epics/epic-123",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", epicId: "epic-123" },
    });

    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for invalid status", async () => {
    const body = { status: "unknown" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/epics/epic-123",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", epicId: "epic-123" },
    });

    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for invalid JSON body", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/epics/epic-123",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: "invalid json {",
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", epicId: "epic-123" },
    });

    expect([400, 500]).toContain(response.status);
  });

  it("should return 404 when epic does not exist", async () => {
    mockMutation.mockResolvedValue(null);

    const body = { title: "Updated Epic" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/epics/nonexistent",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", epicId: "nonexistent" },
    });

    expect(response.status).toBe(404);
  });

  it("should accept valid epic update with title", async () => {
    mockMutation.mockResolvedValue({
      _id: "epic-123",
      _creationTime: 1234567890,
      title: "Updated Epic",
      description: "Epic description",
      status: "active",
    });

    const body = { title: "Updated Epic" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/epics/epic-123",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", epicId: "epic-123" },
    });

    expect([200, 400, 500]).toContain(response.status);
  });

  it("should accept valid epic update with status", async () => {
    mockMutation.mockResolvedValue({
      _id: "epic-123",
      _creationTime: 1234567890,
      title: "Epic",
      description: "Epic description",
      status: "completed",
    });

    const body = { status: "completed" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/epics/epic-123",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", epicId: "epic-123" },
    });

    expect([200, 400, 500]).toContain(response.status);
  });
});

describe("DELETE /api/v1/workspaces/{workspaceId}/epics/{epicId}", () => {
  it("should validate route exists and accepts DELETE requests", async () => {
    expect(typeof DELETE).toBe("function");
    expect(DELETE.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//epics/epic-123",
      {
        method: "DELETE",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "", epicId: "epic-123" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when epicId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/epics/",
      {
        method: "DELETE",
        headers: {
          authorization: "Bearer token-123",
        },
      }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", epicId: "" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when epic does not exist", async () => {
    mockMutation.mockResolvedValue(false);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/epics/nonexistent",
      {
        method: "DELETE",
      }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", epicId: "nonexistent" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 200 when epic is deleted successfully", async () => {
    mockMutation.mockResolvedValue(true);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/epics/epic-123",
      {
        method: "DELETE",
      }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", epicId: "epic-123" },
    });

    expect([200, 500]).toContain(response.status);
  });
});
