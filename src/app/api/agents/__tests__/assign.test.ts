/**
 * POST /api/agents/tasks/{taskId}/assign route tests (Phase 2)
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    tasks: {
      assign: "tasks:assign",
    },
  },
}));
jest.mock("@/lib/agent-auth");
jest.mock("@/lib/utils/logger", () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

import { POST } from "../tasks/assign/route";
import { ConvexHttpClient } from "convex/browser";
import { verifyAgent } from "@/lib/agent-auth";

describe("POST /api/agents/tasks/{taskId}/assign (Phase 2)", () => {
  const mockMutation = jest.fn();
  const mockConvex = {
    mutation: mockMutation,
  };

  const mockAgent = {
    _id: "agent-123",
    name: "TestBot",
    role: "Worker",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
    (ConvexHttpClient as any).mockImplementation(() => mockConvex);
    (verifyAgent as jest.Mock).mockResolvedValue(mockAgent);
  });

  it("assigns task to single agent", async () => {
    mockMutation.mockResolvedValueOnce({ success: true });

    const request = new Request("http://localhost/api/agents/tasks/task-456/assign", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        assigneeIds: ["agent-200"],
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("assigns task to multiple agents", async () => {
    mockMutation.mockResolvedValueOnce({ success: true });

    const request = new Request("http://localhost/api/agents/tasks/task-456/assign", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        assigneeIds: ["agent-200", "agent-300", "agent-400"],
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("rejects empty assigneeIds", async () => {
    const request = new Request("http://localhost/api/agents/tasks/task-456/assign", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        assigneeIds: [],
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("rejects too many assignees (>10)", async () => {
    const assigneeIds = Array.from({ length: 11 }, (_, i) => `agent-${i}`);
    const request = new Request("http://localhost/api/agents/tasks/task-456/assign", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        assigneeIds,
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    const data = await response.json();

    expect(response.status).toBe(400);
  });

  it("rejects invalid credentials", async () => {
    (verifyAgent as jest.Mock).mockResolvedValueOnce(null);

    const request = new Request("http://localhost/api/agents/tasks/task-456/assign", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "wrong",
        taskId: "task-456",
        assigneeIds: ["agent-200"],
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    expect(response.status).toBe(401);
  });
});
