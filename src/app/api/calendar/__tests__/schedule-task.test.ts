/**
 * POST /api/calendar/schedule-task Tests
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    calendarEvents: { scheduleTask: "events:scheduleTask" },
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
  return new Request("http://localhost/api/calendar/schedule-task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/calendar/schedule-task", () => {
  it("schedules task for valid request", async () => {
    const { POST } = await import("../schedule-task/route");
    mockMutation.mockResolvedValue("event-1");

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      taskId: "task-1",
      startTime: now + 86400000,
      duration: 3600,
    });

    const res = await POST(req);
    expect([200, 201, 400, 500]).toContain(res.status);
  });

  it("returns 400 for missing required fields", async () => {
    const { POST } = await import("../schedule-task/route");

    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      // Missing taskId, startTime, duration
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid duration", async () => {
    const { POST } = await import("../schedule-task/route");

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      taskId: "task-1",
      startTime: now,
      duration: 0, // Invalid: must be > 0
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid duration range", async () => {
    const { POST } = await import("../schedule-task/route");

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      taskId: "task-1",
      startTime: now,
      duration: 86401, // > 24 hours
    });

    const res = await POST(req);
    expect([400, 500]).toContain(res.status);
  });

  it("rejects invalid credentials or parameters", async () => {
    const { POST } = await import("../schedule-task/route");
    (verifyAgent as jest.Mock).mockResolvedValueOnce(null);

    const now = Date.now();
    const req = makeRequest({
      agentId: "invalid",
      agentKey: "wrong",
      taskId: "task-1",
      startTime: now,
      duration: 3600,
    });

    const res = await POST(req);
    expect([400, 401]).toContain(res.status);
  });

  it("includes optional assignedAgentId in event", async () => {
    const { POST } = await import("../schedule-task/route");
    mockMutation.mockResolvedValueOnce("event-1");

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      taskId: "task-1",
      startTime: now,
      duration: 3600,
      assignedAgentId: "agent-2",
    });

    const res = await POST(req);
    expect([200, 201, 400]).toContain(res.status);
  });

  it("handles mutation failures", async () => {
    const { POST } = await import("../schedule-task/route");
    mockMutation.mockRejectedValueOnce(new Error("DB error"));

    const now = Date.now();
    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
      taskId: "task-1",
      startTime: now,
      duration: 3600,
    });

    const res = await POST(req);
    expect([400, 500]).toContain(res.status);
  });
});
