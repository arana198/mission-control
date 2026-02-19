/**
 * PUT /api/agents/tasks/{taskId}/status route tests
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    tasks: {
      updateStatus: "tasks:updateStatus",
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

import { PATCH as HANDLER } from "../[agentId]/tasks/[taskId]/status/route";
import { ConvexHttpClient } from "convex/browser";
import { verifyAgent } from "@/lib/agent-auth";

describe("PATCH /api/agents/{agentId}/tasks/{taskId}/status", () => {
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

  it("updates task status with valid credentials", async () => {
    mockMutation.mockResolvedValueOnce({ success: true });

    const request = new Request("http://localhost/api/agents/agent-123/tasks/task-456/status", {
      method: "PUT",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        status: "in_progress",
      }),
    });

    const response = await HANDLER(request, { params: { agentId: "agent-123", taskId: "task-456" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("accepts all valid status values", async () => {
    mockMutation.mockResolvedValue({ success: true });

    const statuses = ["backlog", "ready", "in_progress", "review", "blocked", "done"];

    for (const status of statuses) {
      const request = new Request("http://localhost/api/agents/agent-123/tasks/task-456/status", {
        method: "PUT",
        body: JSON.stringify({
          agentId: "agent-123",
          agentKey: "ak_key",
          taskId: "task-456",
          status,
        }),
      });

      const response = await HANDLER(request, { params: { agentId: "agent-123", taskId: "task-456" } });
      expect(response.status).toBe(200);
    }
  });

  it("rejects invalid status", async () => {
    const request = new Request("http://localhost/api/agents/agent-123/tasks/task-456/status", {
      method: "PUT",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        status: "invalid_status",
      }),
    });

    const response = await HANDLER(request, { params: { agentId: "agent-123", taskId: "task-456" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("rejects invalid credentials", async () => {
    (verifyAgent as jest.Mock).mockResolvedValueOnce(null);

    const request = new Request("http://localhost/api/agents/agent-123/tasks/task-456/status", {
      method: "PUT",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "wrong_key",
        taskId: "task-456",
        status: "done",
      }),
    });

    const response = await HANDLER(request, { params: { agentId: "agent-123", taskId: "task-456" } });
    expect(response.status).toBe(401);
  });

  it("handles bad JSON", async () => {
    const request = new Request("http://localhost/api/agents/agent-123/tasks/task-456/status", {
      method: "PUT",
      body: "invalid json",
    });

    const response = await HANDLER(request, { params: { agentId: "agent-123", taskId: "task-456" } });
    expect(response.status).toBe(400);
  });
});
