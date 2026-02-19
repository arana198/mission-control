jest.mock("convex/browser");
jest.mock("@/lib/agent-auth", () => ({ verifyAgent: jest.fn() }));
jest.mock("@/convex/_generated/api", () => ({
  api: {
    agents: { heartbeat: "agents:heartbeat" },
    tasks: { getForAgent: "tasks:getForAgent" },
    notifications: {
      getForAgent: "notifications:getForAgent",
      markAllRead: "notifications:markAllRead",
    },
  },
}));

import { ConvexHttpClient } from "convex/browser";
import { verifyAgent } from "@/lib/agent-auth";

const mockVerify = verifyAgent as jest.Mock;
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
  mockVerify.mockReset();
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/agents/poll", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/agents/poll", () => {
  const mockAgent = {
    _id: "abc123",
    name: "jarvis",
    role: "Squad Lead",
    status: "idle",
    level: "lead",
    apiKey: "ak_x",
    sessionKey: "agent:main:main",
    lastHeartbeat: Date.now(),
  };

  it("returns 401 for invalid credentials", async () => {
    const { POST } = await import("../poll/route");

    mockVerify.mockResolvedValue(null);
    const req = makeRequest({ agentId: "abc123", agentKey: "bad_key", businessId: "business-123" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns tasks and notifications on valid credentials", async () => {
    const { POST } = await import("../poll/route");

    mockVerify.mockResolvedValue(mockAgent);
    mockMutation.mockResolvedValue({ success: true, timestamp: Date.now() });
    mockQuery
      .mockResolvedValueOnce([{ _id: "task1", title: "Fix bug" }]) // getForAgent
      .mockResolvedValueOnce([{ _id: "notif1", content: "Hello" }]); // getForAgent notifications

    mockMutation.mockResolvedValueOnce({ marked: 1 }); // markAllRead

    const req = makeRequest({ agentId: "abc123", agentKey: "ak_x", businessId: "business-123" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.assignedTasks).toBeDefined();
    expect(data.data.notifications).toBeDefined();
    expect(data.data.serverTime).toBeDefined();
    expect(data.data.agentProfile).toBeDefined();
  });

  it("returns empty arrays when no tasks or notifications", async () => {
    const { POST } = await import("../poll/route");

    mockVerify.mockResolvedValue(mockAgent);
    mockMutation.mockResolvedValue({ success: true, timestamp: Date.now() });
    mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const req = makeRequest({ agentId: "abc123", agentKey: "ak_x", businessId: "business-123" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.assignedTasks).toEqual([]);
    expect(data.data.notifications).toEqual([]);
  });

  it("returns 400 for missing agentKey", async () => {
    const { POST } = await import("../poll/route");

    const req = makeRequest({ agentId: "abc123", businessId: "business-123" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing businessId", async () => {
    const { POST } = await import("../poll/route");

    const req = makeRequest({ agentId: "abc123", agentKey: "ak_x" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("../poll/route");

    const req = new Request("http://localhost/api/agents/poll", {
      method: "POST",
      body: "invalid json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
