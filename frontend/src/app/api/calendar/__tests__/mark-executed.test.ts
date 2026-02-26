/**
 * PUT /api/calendar/events/{eventId} Tests
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

function makeRequest(body: unknown, eventId: string = "event-1"): Request {
  return new Request(`http://localhost/api/calendar/events/${eventId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/calendar/events/{eventId}", () => {
  it("marks event as executed with current time", async () => {
    const { PUT } = await import("../events/[eventId]/route");
    mockMutation.mockResolvedValueOnce({});

    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
    }, "event-1");

    const res = await PUT(req, { params: { eventId: "event-1" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("marks event as executed with provided timestamp", async () => {
    const { PUT } = await import("../events/[eventId]/route");
    mockMutation.mockResolvedValueOnce({});

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      executedAt: now - 3600000, // 1 hour ago
    }, "event-1");

    const res = await PUT(req, { params: { eventId: "event-1" } });
    expect(res.status).toBe(200);
    expect(mockMutation).toHaveBeenCalled();
  });

  it("returns 400 for missing required fields", async () => {
    const { PUT } = await import("../events/[eventId]/route");

    const req = makeRequest({
      // Missing agentId and agentKey
    }, "event-1");

    const res = await PUT(req, { params: { eventId: "event-1" } });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid executedAt timestamp", async () => {
    const { PUT } = await import("../events/[eventId]/route");

    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      executedAt: "not-a-number",
    }, "event-1");

    const res = await PUT(req, { params: { eventId: "event-1" } });
    expect(res.status).toBe(400);
  });

  it("returns 401 for invalid credentials", async () => {
    const { PUT } = await import("../events/[eventId]/route");
    (verifyAgent as jest.Mock).mockResolvedValueOnce(null);

    const req = makeRequest({
      agentId: "invalid",
      agentKey: "wrong",
    }, "event-1");

    const res = await PUT(req, { params: { eventId: "event-1" } });
    expect(res.status).toBe(401);
  });

  it("returns 500 when mutation fails", async () => {
    const { PUT } = await import("../events/[eventId]/route");
    mockMutation.mockRejectedValueOnce(new Error("DB error"));

    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
    }, "event-1");

    const res = await PUT(req, { params: { eventId: "event-1" } });
    expect(res.status).toBe(500);
  });
});
