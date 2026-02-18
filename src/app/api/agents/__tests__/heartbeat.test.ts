jest.mock("convex/browser");
jest.mock("@/lib/agent-auth", () => ({ verifyAgent: jest.fn() }));
jest.mock("@/convex/_generated/api", () => ({
  api: {
    agents: {
      heartbeat: "agents:heartbeat",
      updateStatus: "agents:updateStatus",
    },
  },
}));

import { ConvexHttpClient } from "convex/browser";
import { verifyAgent } from "@/lib/agent-auth";

const mockVerify = verifyAgent as jest.Mock;
const mockMutation = jest.fn();
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<
  typeof ConvexHttpClient
>;

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(() => ({
    mutation: mockMutation,
  } as any));
  mockVerify.mockReset();
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/agents/heartbeat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/agents/heartbeat", () => {
  const mockAgent = { _id: "abc123", name: "jarvis" };

  it("returns 401 for invalid credentials", async () => {
    const { POST } = await import("../heartbeat/route");

    mockVerify.mockResolvedValue(null);
    const req = makeRequest({ agentId: "abc123", agentKey: "bad" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns success with serverTime", async () => {
    const { POST } = await import("../heartbeat/route");

    mockVerify.mockResolvedValue(mockAgent);
    mockMutation.mockResolvedValue({ success: true, timestamp: Date.now() });
    const req = makeRequest({ agentId: "abc123", agentKey: "ak_x" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.success).toBe(true);
    expect(data.data.serverTime).toBeDefined();
  });

  it("accepts optional currentTaskId", async () => {
    const { POST } = await import("../heartbeat/route");

    mockVerify.mockResolvedValue(mockAgent);
    mockMutation.mockResolvedValue({ success: true, timestamp: Date.now() });
    const req = makeRequest({
      agentId: "abc123",
      agentKey: "ak_x",
      currentTaskId: "task789",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("accepts optional status", async () => {
    const { POST } = await import("../heartbeat/route");

    mockVerify.mockResolvedValue(mockAgent);
    mockMutation.mockResolvedValue({ success: true, timestamp: Date.now() });
    const req = makeRequest({
      agentId: "abc123",
      agentKey: "ak_x",
      status: "active",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("rejects invalid status", async () => {
    const { POST } = await import("../heartbeat/route");

    const req = makeRequest({
      agentId: "abc123",
      agentKey: "ak_x",
      status: "zombie",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("../heartbeat/route");

    const req = new Request("http://localhost/api/agents/heartbeat", {
      method: "POST",
      body: "invalid json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing agentKey", async () => {
    const { POST } = await import("../heartbeat/route");

    const req = makeRequest({ agentId: "abc123" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
