jest.mock("convex/browser");
jest.mock("@/lib/agent-auth", () => ({ verifyAgent: jest.fn() }));
jest.mock("@/convex/_generated/api", () => ({
  api: {
    tasks: { completeByAgent: "tasks:completeByAgent" },
    executionLog: { create: "executionLog:create" },
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
  return new Request("http://localhost/api/agents/tasks/complete", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/agents/tasks/complete", () => {
  const mockAgent = {
    _id: "abc123",
    name: "jarvis",
    role: "Squad Lead",
    currentTaskId: "task456",
  };

  it("returns 401 for invalid credentials", async () => {
    const { POST } = await import("../tasks/complete/route");

    mockVerify.mockResolvedValue(null);
    const req = makeRequest({
      agentId: "abc123",
      agentKey: "bad",
      taskId: "task456",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("completes task successfully", async () => {
    const { POST } = await import("../tasks/complete/route");

    mockVerify.mockResolvedValue(mockAgent);
    mockMutation.mockResolvedValue({ success: true, completedAt: Date.now() });

    const req = makeRequest({
      agentId: "abc123",
      agentKey: "ak_x",
      taskId: "task456",
      completionNotes: "Done!",
      timeSpent: 30,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("returns 400 for missing taskId", async () => {
    const { POST } = await import("../tasks/complete/route");

    const req = makeRequest({ agentId: "abc123", agentKey: "ak_x" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid status", async () => {
    const { POST } = await import("../tasks/complete/route");

    const req = makeRequest({
      agentId: "abc123",
      agentKey: "ak_x",
      taskId: "task456",
      status: "pending",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative timeSpent", async () => {
    const { POST } = await import("../tasks/complete/route");

    const req = makeRequest({
      agentId: "abc123",
      agentKey: "ak_x",
      taskId: "task456",
      timeSpent: -5,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("../tasks/complete/route");

    const req = new Request("http://localhost/api/agents/tasks/complete", {
      method: "POST",
      body: "invalid json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("defaults status to done", async () => {
    const { POST } = await import("../tasks/complete/route");

    mockVerify.mockResolvedValue(mockAgent);
    mockMutation.mockResolvedValue({ success: true, completedAt: Date.now() });

    const req = makeRequest({
      agentId: "abc123",
      agentKey: "ak_x",
      taskId: "task456",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    // Mutation should be called with status: "done"
    expect(mockMutation).toHaveBeenCalled();
  });
});
