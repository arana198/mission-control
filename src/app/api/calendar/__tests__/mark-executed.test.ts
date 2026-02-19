/**
 * POST /api/calendar/mark-executed Tests
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    calendarEvents: { markTaskExecuted: "events:markTaskExecuted" },
    activities: { create: "activities:create" },
  },
}));
jest.mock("@/lib/agent-auth");

import { ConvexHttpClient } from "convex/browser";
import { verifyAgent } from "@/lib/agent-auth";

const mockMutation = jest.fn();
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<typeof ConvexHttpClient>;

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(() => ({
    mutation: mockMutation,
  } as any));
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
  (verifyAgent as jest.Mock).mockResolvedValue({
    _id: "agent-1",
    name: "agent1",
  });
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/calendar/mark-executed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/calendar/mark-executed", () => {
  it("marks event as executed with current time", async () => {
    const { POST } = await import("../mark-executed/route");
    mockMutation.mockResolvedValueOnce({});

    const req = makeRequest({
      eventId: "event-1",
      agentId: "agent-1",
      agentKey: "key-1",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("marks event as executed with provided timestamp", async () => {
    const { POST } = await import("../mark-executed/route");
    mockMutation.mockResolvedValueOnce({});

    const now = Date.now();
    const req = makeRequest({
      eventId: "event-1",
      agentId: "agent-1",
      agentKey: "key-1",
      executedAt: now - 3600000, // 1 hour ago
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockMutation).toHaveBeenCalled();
  });

  it("returns 400 for missing required fields", async () => {
    const { POST } = await import("../mark-executed/route");

    const req = makeRequest({
      eventId: "event-1",
      // Missing agentId and agentKey
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid executedAt timestamp", async () => {
    const { POST } = await import("../mark-executed/route");

    const req = makeRequest({
      eventId: "event-1",
      agentId: "agent-1",
      agentKey: "key-1",
      executedAt: "not-a-number",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 for invalid credentials", async () => {
    const { POST } = await import("../mark-executed/route");
    (verifyAgent as jest.Mock).mockResolvedValueOnce(null);

    const req = makeRequest({
      eventId: "event-1",
      agentId: "invalid",
      agentKey: "wrong",
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 500 when mutation fails", async () => {
    const { POST } = await import("../mark-executed/route");
    mockMutation.mockRejectedValueOnce(new Error("DB error"));

    const req = makeRequest({
      eventId: "event-1",
      agentId: "agent-1",
      agentKey: "key-1",
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
