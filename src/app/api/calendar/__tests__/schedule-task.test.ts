/**
 * POST /api/tasks/{taskId}/calendar-events Tests
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    calendarEvents: { scheduleTaskEvent: "events:scheduleTaskEvent" },
    tasks: { getTaskById: "tasks:getTaskById" },
    activities: { create: "activities:create" },
  },
}));
jest.mock("@/lib/agent-auth");

import { ConvexHttpClient } from "convex/browser";
import { verifyAgent } from "@/lib/agent-auth";

const mockMutation = jest.fn();
const mockQuery = jest.fn();
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<typeof ConvexHttpClient>;

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(() => ({
    mutation: mockMutation,
    query: mockQuery,
  } as any));
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
  (verifyAgent as jest.Mock).mockResolvedValue({
    _id: "agent-1",
    name: "agent1",
    role: "specialist",
  });
  mockQuery.mockResolvedValue({ businessId: "business-1" });
});

function makeRequest(body: unknown, taskId: string = "task-1"): Request {
  return new Request(`http://localhost/api/tasks/${taskId}/calendar-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/tasks/{taskId}/calendar-events", () => {
  it("schedules task for valid request", async () => {
    const { POST } = await import("../../tasks/[taskId]/calendar-events/route");
    mockMutation.mockResolvedValue("event-1");

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      startTime: now + 86400000,
      durationHours: 1,
    }, "task-1");

    const res = await POST(req, { params: { taskId: "task-1" } });
    expect(res.status).toBe(201);
  });

  it("returns 400 for missing required fields", async () => {
    const { POST } = await import("../../tasks/[taskId]/calendar-events/route");

    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      // Missing startTime, durationHours
    }, "task-1");

    const res = await POST(req, { params: { taskId: "task-1" } });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid duration", async () => {
    const { POST } = await import("../../tasks/[taskId]/calendar-events/route");

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      startTime: now,
      durationHours: 0, // Invalid: must be > 0
    }, "task-1");

    const res = await POST(req, { params: { taskId: "task-1" } });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid duration range", async () => {
    const { POST } = await import("../../tasks/[taskId]/calendar-events/route");

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      startTime: now,
      durationHours: 25, // > 24 hours
    }, "task-1");

    const res = await POST(req, { params: { taskId: "task-1" } });
    expect(res.status).toBe(400);
  });

  it("rejects invalid credentials or parameters", async () => {
    const { POST } = await import("../../tasks/[taskId]/calendar-events/route");
    (verifyAgent as jest.Mock).mockResolvedValueOnce(null);

    const now = Date.now();
    const req = makeRequest({
      agentId: "invalid",
      agentKey: "wrong",
      startTime: now,
      durationHours: 1,
    }, "task-1");

    const res = await POST(req, { params: { taskId: "task-1" } });
    expect(res.status).toBe(401);
  });

  it("schedules task with activity logging", async () => {
    const { POST } = await import("../../tasks/[taskId]/calendar-events/route");
    mockMutation.mockResolvedValueOnce("event-1");

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      startTime: now,
      durationHours: 2,
    }, "task-1");

    const res = await POST(req, { params: { taskId: "task-1" } });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.eventId).toBe("event-1");
  });

  it("handles mutation failures", async () => {
    const { POST } = await import("../../tasks/[taskId]/calendar-events/route");
    mockMutation.mockRejectedValueOnce(new Error("DB error"));

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      startTime: now,
      durationHours: 1,
    }, "task-1");

    const res = await POST(req, { params: { taskId: "task-1" } });
    expect(res.status).toBe(500);
  });
});
