/**
 * POST /api/calendar/create-event Tests
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    calendarEvents: { createHumanEvent: "events:createHumanEvent" },
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
    role: "specialist",
  });
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/calendar/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/calendar/events", () => {
  it("creates calendar event for valid request", async () => {
    const { POST } = await import("../events/route");
    mockMutation.mockResolvedValueOnce("event-1");

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      title: "Daily Standup",
      startTime: now,
      endTime: now + 3600000,
      type: "ai_workflow",
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.eventId).toBe("event-1");
    expect(data.timestamp).toBeDefined();
  });

  it("returns 400 for missing required fields", async () => {
    const { POST } = await import("../events/route");

    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      // Missing title, startTime, endTime, type
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid event type", async () => {
    const { POST } = await import("../events/route");

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      title: "Event",
      startTime: now,
      endTime: now + 3600000,
      type: "invalid_type",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when startTime >= endTime", async () => {
    const { POST } = await import("../events/route");

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      title: "Event",
      startTime: now,
      endTime: now, // Same as startTime
      type: "ai_workflow",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 for invalid credentials", async () => {
    const { POST } = await import("../events/route");
    (verifyAgent as jest.Mock).mockResolvedValueOnce(null);

    const now = Date.now();
    const req = makeRequest({
      agentId: "invalid",
      agentKey: "wrong",
      title: "Event",
      startTime: now,
      endTime: now + 3600000,
      type: "ai_workflow",
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("includes description if provided", async () => {
    const { POST } = await import("../events/route");
    mockMutation.mockResolvedValueOnce("event-1");

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      title: "Event",
      description: "Event description",
      startTime: now,
      endTime: now + 3600000,
      type: "bot_generated",
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockMutation).toHaveBeenCalled();
  });

  it("returns 500 when mutation fails", async () => {
    const { POST } = await import("../events/route");
    mockMutation.mockRejectedValueOnce(new Error("DB error"));

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      title: "Event",
      startTime: now,
      endTime: now + 3600000,
      type: "ai_workflow",
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
