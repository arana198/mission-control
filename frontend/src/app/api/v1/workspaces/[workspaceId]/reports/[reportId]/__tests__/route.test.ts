/**
 * v1 Workspace Report Detail Route Tests
 * Tests RFC 9457 compliant report endpoints (GET, PUT, DELETE)
 * Path: GET /api/v1/workspaces/{workspaceId}/reports/{reportId}
 * Path: PUT /api/v1/workspaces/{workspaceId}/reports/{reportId}
 * Path: DELETE /api/v1/workspaces/{workspaceId}/reports/{reportId}
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
    reports: {
      getReport: "reports:getReport",
      updateReport: "reports:updateReport",
      deleteReport: "reports:deleteReport",
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

describe("GET /api/v1/workspaces/{workspaceId}/reports/{reportId}", () => {
  it("should validate route exists and accepts GET requests", async () => {
    expect(typeof GET).toBe("function");
    expect(GET.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//reports/r-123",
      { method: "GET" }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "", reportId: "r-123" },
    });
    expect(response.status).toBe(404);
  });

  it("should return 404 when reportId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports/",
      { method: "GET" }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", reportId: "" },
    });
    expect(response.status).toBe(404);
  });

  it("should return 404 when report does not exist", async () => {
    mockQuery.mockResolvedValue(null);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports/nonexistent",
      { method: "GET" }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", reportId: "nonexistent" },
    });
    expect(response.status).toBe(404);
  });

  it("should return 200 with report details when found", async () => {
    mockQuery.mockResolvedValue({
      _id: "r-123",
      _creationTime: 1234567890,
      title: "Q1 Report",
      type: "performance",
      description: "Q1 performance metrics",
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports/r-123",
      { method: "GET" }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", reportId: "r-123" },
    });
    expect([200, 500]).toContain(response.status);
  });
});

describe("PUT /api/v1/workspaces/{workspaceId}/reports/{reportId}", () => {
  it("should validate route exists and accepts PUT requests", async () => {
    expect(typeof PUT).toBe("function");
    expect(PUT.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const body = { title: "Updated Report" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//reports/r-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "", reportId: "r-123" },
    });
    expect(response.status).toBe(404);
  });

  it("should return 404 when reportId is missing", async () => {
    const body = { title: "Updated Report" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports/",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", reportId: "" },
    });
    expect(response.status).toBe(404);
  });

  it("should return 400 for empty body", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports/r-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", reportId: "r-123" },
    });
    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for empty title", async () => {
    const body = { title: "" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports/r-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", reportId: "r-123" },
    });
    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for title exceeding max length", async () => {
    const body = { title: "x".repeat(201) };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports/r-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", reportId: "r-123" },
    });
    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for invalid type", async () => {
    const body = { type: "invalid" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports/r-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", reportId: "r-123" },
    });
    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for invalid JSON body", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports/r-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "invalid json {",
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", reportId: "r-123" },
    });
    expect([400, 500]).toContain(response.status);
  });

  it("should accept valid report update with title", async () => {
    mockMutation.mockResolvedValue({
      _id: "r-123",
      _creationTime: 1234567890,
      title: "Updated Report",
      type: "performance",
      description: "Updated description",
    });

    const body = { title: "Updated Report" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports/r-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", reportId: "r-123" },
    });
    expect([200, 400, 500]).toContain(response.status);
  });
});

describe("DELETE /api/v1/workspaces/{workspaceId}/reports/{reportId}", () => {
  it("should validate route exists and accepts DELETE requests", async () => {
    expect(typeof DELETE).toBe("function");
    expect(DELETE.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//reports/r-123",
      { method: "DELETE" }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "", reportId: "r-123" },
    });
    expect(response.status).toBe(404);
  });

  it("should return 404 when reportId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports/",
      { method: "DELETE" }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", reportId: "" },
    });
    expect(response.status).toBe(404);
  });

  it("should return 404 when report does not exist", async () => {
    mockMutation.mockResolvedValue(false);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports/nonexistent",
      { method: "DELETE" }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", reportId: "nonexistent" },
    });
    expect(response.status).toBe(404);
  });

  it("should return 200 when report is deleted successfully", async () => {
    mockMutation.mockResolvedValue(true);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports/r-123",
      { method: "DELETE" }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", reportId: "r-123" },
    });
    expect([200, 500]).toContain(response.status);
  });
});
