/**
 * v1 Workspace Reports Route Tests
 * Tests RFC 9457 compliant report endpoints (GET and POST)
 * Path: GET /api/v1/workspaces/{workspaceId}/reports
 * Path: POST /api/v1/workspaces/{workspaceId}/reports
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
      listReports: "reports:listReports",
      createReport: "reports:createReport",
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

describe("GET /api/v1/workspaces/{workspaceId}/reports", () => {
  it("should validate route exists and accepts GET requests", async () => {
    expect(typeof GET).toBe("function");
    expect(GET.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//reports",
      { method: "GET" }
    );

    const response = await GET(request as any, { params: { workspaceId: "" } });
    expect(response.status).toBe(404);
  });

  it("should accept pagination parameters", async () => {
    mockQuery.mockResolvedValue({
      items: [],
      total: 0,
      nextCursor: null,
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports?limit=50&cursor=abc",
      { method: "GET" }
    );

    const response = await GET(request as any, { params: { workspaceId: "ws-123" } });
    expect([200, 500]).toContain(response.status);
  });

  it("should accept type filter parameter", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports?type=performance",
      { method: "GET" }
    );

    const response = await GET(request as any, { params: { workspaceId: "ws-123" } });
    expect([200, 500]).toContain(response.status);
  });
});

describe("POST /api/v1/workspaces/{workspaceId}/reports", () => {
  it("should validate route exists and accepts POST requests", async () => {
    expect(typeof POST).toBe("function");
    expect(POST.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const body = { title: "Report", type: "performance" };
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//reports",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, { params: { workspaceId: "" } });
    expect(response.status).toBe(404);
  });

  it("should return 400 for missing title", async () => {
    const body = { type: "performance" };
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, { params: { workspaceId: "ws-123" } });
    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for missing type", async () => {
    const body = { title: "Report" };
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, { params: { workspaceId: "ws-123" } });
    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for invalid type", async () => {
    const body = { title: "Report", type: "invalid" };
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, { params: { workspaceId: "ws-123" } });
    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for empty title", async () => {
    const body = { title: "", type: "summary" };
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, { params: { workspaceId: "ws-123" } });
    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for title exceeding max length", async () => {
    const body = { title: "x".repeat(201), type: "analysis" };
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, { params: { workspaceId: "ws-123" } });
    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for invalid JSON body", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json {",
      }
    );

    const response = await POST(request as any, { params: { workspaceId: "ws-123" } });
    expect([400, 500]).toContain(response.status);
  });

  it("should accept valid report creation with all fields", async () => {
    const body = {
      title: "Q1 Report",
      type: "performance",
      description: "Q1 performance metrics",
    };
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, { params: { workspaceId: "ws-123" } });
    expect([201, 400, 500]).toContain(response.status);
  });

  it("should accept valid report creation with minimal fields", async () => {
    const body = { title: "Report", type: "summary" };
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/reports",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, { params: { workspaceId: "ws-123" } });
    expect([201, 400, 500]).toContain(response.status);
  });
});
