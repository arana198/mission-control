/**
 * POST /api/calendar/find-slots Tests
 *
 * Tests calendar slot finding endpoint
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    calendarEvents: {
      findFreeSlots: "calendarEvents:findFreeSlots",
    },
  },
}));
jest.mock("@/lib/agent-auth");

import { ConvexHttpClient } from "convex/browser";
import { verifyAgent } from "@/lib/agent-auth";

const mockQuery = jest.fn();
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<typeof ConvexHttpClient>;

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(() => ({
    query: mockQuery,
  } as any));
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
  (verifyAgent as jest.Mock).mockResolvedValue({
    _id: "agent-1",
    name: "agent1",
  });
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/calendar/find-slots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/calendar/find-slots", () => {
  it("returns available slots for valid request", async () => {
    const { POST } = await import("../find-slots/route");

    const now = Date.now();
    mockQuery.mockResolvedValue([
      { start: now + 3600000, end: now + 7200000, score: 0.9 },
      { start: now + 7200000, end: now + 10800000, score: 0.8 },
    ]);

    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      startDate: now,
      endDate: now + 86400000, // 24 hours
      durationMinutes: 60,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.slots).toHaveLength(2);
  });

  it("returns 400 when missing required fields", async () => {
    const { POST } = await import("../find-slots/route");

    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      startDate: Date.now(),
      // Missing endDate and durationMinutes
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid durationMinutes (zero)", async () => {
    const { POST } = await import("../find-slots/route");

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      startDate: now,
      endDate: now + 86400000,
      durationMinutes: 0,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid durationMinutes (>1440)", async () => {
    const { POST } = await import("../find-slots/route");

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      startDate: now,
      endDate: now + 86400000,
      durationMinutes: 1441, // Over 24 hours
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when startDate >= endDate", async () => {
    const { POST } = await import("../find-slots/route");

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      startDate: now,
      endDate: now, // Same as startDate
      durationMinutes: 60,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 for invalid credentials", async () => {
    const { POST } = await import("../find-slots/route");

    (verifyAgent as jest.Mock).mockResolvedValue(null);
    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-invalid",
      agentKey: "wrong-key",
      startDate: now,
      endDate: now + 86400000,
      durationMinutes: 60,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("supports optional preferences (preferBefore, preferAfter)", async () => {
    const { POST } = await import("../find-slots/route");

    mockQuery.mockResolvedValue([
      { start: Date.now() + 3600000, end: Date.now() + 7200000, score: 0.95 },
    ]);

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      startDate: now,
      endDate: now + 86400000,
      durationMinutes: 60,
      preferBefore: 12, // Prefer before noon
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    // Verify query was called with preferences included
    expect(mockQuery).toHaveBeenCalled();
    const callArgs = mockQuery.mock.calls[0];
    expect(callArgs[1]).toEqual(expect.objectContaining({
      preferBefore: 12,
    }));
  });

  it("returns empty slots array when none available", async () => {
    const { POST } = await import("../find-slots/route");

    mockQuery.mockResolvedValue([]);

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      startDate: now,
      endDate: now + 86400000,
      durationMinutes: 60,
    });

    const res = await POST(req);
    const data = await res.json();
    expect(data.slots).toHaveLength(0);
    expect(data.message).toContain("0 available");
  });

  it("returns 500 when query fails", async () => {
    const { POST } = await import("../find-slots/route");

    mockQuery.mockRejectedValue(new Error("DB error"));

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      startDate: now,
      endDate: now + 86400000,
      durationMinutes: 60,
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
