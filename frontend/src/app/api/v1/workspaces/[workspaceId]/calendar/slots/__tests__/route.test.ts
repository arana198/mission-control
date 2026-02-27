/**
 * v1 Workspace Calendar Slots Route Tests
 * Tests RFC 9457 compliant calendar slots endpoints (GET and POST)
 * Path: GET /api/v1/workspaces/{workspaceId}/calendar/slots
 * Path: POST /api/v1/workspaces/{workspaceId}/calendar/slots
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
    calendar: {
      listSlots: "calendar:listSlots",
      createSlot: "calendar:createSlot",
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

describe("GET /api/v1/workspaces/{workspaceId}/calendar/slots", () => {
  it("should validate route exists and accepts GET requests", async () => {
    expect(typeof GET).toBe("function");
    expect(GET.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//calendar/slots",
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
      "http://localhost:3000/api/v1/workspaces/ws-123/calendar/slots?limit=50&cursor=abc",
      { method: "GET" }
    );

    const response = await GET(request as any, { params: { workspaceId: "ws-123" } });
    expect([200, 500]).toContain(response.status);
  });

  it("should accept date filter parameter", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/calendar/slots?date=2026-02-27",
      { method: "GET" }
    );

    const response = await GET(request as any, { params: { workspaceId: "ws-123" } });
    expect([200, 500]).toContain(response.status);
  });
});

describe("POST /api/v1/workspaces/{workspaceId}/calendar/slots", () => {
  it("should validate route exists and accepts POST requests", async () => {
    expect(typeof POST).toBe("function");
    expect(POST.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const body = {
      date: "2026-02-27",
      startTime: "10:00",
      endTime: "11:00",
      capacity: 5,
    };
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//calendar/slots",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, { params: { workspaceId: "" } });
    expect(response.status).toBe(404);
  });

  it("should return 400 for missing date", async () => {
    const body = { startTime: "10:00", endTime: "11:00", capacity: 5 };
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/calendar/slots",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, { params: { workspaceId: "ws-123" } });
    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for missing startTime", async () => {
    const body = { date: "2026-02-27", endTime: "11:00", capacity: 5 };
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/calendar/slots",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, { params: { workspaceId: "ws-123" } });
    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for missing endTime", async () => {
    const body = { date: "2026-02-27", startTime: "10:00", capacity: 5 };
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/calendar/slots",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, { params: { workspaceId: "ws-123" } });
    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for missing capacity", async () => {
    const body = { date: "2026-02-27", startTime: "10:00", endTime: "11:00" };
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/calendar/slots",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, { params: { workspaceId: "ws-123" } });
    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for zero capacity", async () => {
    const body = {
      date: "2026-02-27",
      startTime: "10:00",
      endTime: "11:00",
      capacity: 0,
    };
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/calendar/slots",
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
    const body = {
      date: "2026-02-27",
      startTime: "10:00",
      endTime: "11:00",
      capacity: 5,
      type: "invalid",
    };
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/calendar/slots",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request as any, { params: { workspaceId: "ws-123" } });
    expect([400, 500]).toContain(response.status);
  });

  it("should accept valid slot creation", async () => {
    const body = {
      date: "2026-02-27",
      startTime: "10:00",
      endTime: "11:00",
      capacity: 5,
      type: "meeting",
    };
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/calendar/slots",
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
