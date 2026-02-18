/**
 * POST /api/agents/tasks/{taskId}/update route tests (Phase 2)
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    tasks: {
      update: "tasks:update",
    },
  },
}));
jest.mock("@/lib/agent-auth");
jest.mock("@/lib/utils/logger");

import { POST } from "../tasks/update/route";
import { ConvexHttpClient } from "convex/browser";
import { verifyAgent } from "@/lib/agent-auth";

describe("POST /api/agents/tasks/{taskId}/update (Phase 2)", () => {
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

  it("updates task title", async () => {
    mockMutation.mockResolvedValueOnce({ success: true });

    const request = new Request("http://localhost/api/agents/tasks/task-456/update", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        title: "Updated Title",
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("updates task description", async () => {
    mockMutation.mockResolvedValueOnce({ success: true });

    const request = new Request("http://localhost/api/agents/tasks/task-456/update", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        description: "New description for the task",
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    const data = await response.json();

    expect(response.status).toBe(200);
  });

  it("updates task priority", async () => {
    mockMutation.mockResolvedValueOnce({ success: true });

    const request = new Request("http://localhost/api/agents/tasks/task-456/update", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        priority: "P0",
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    const data = await response.json();

    expect(response.status).toBe(200);
  });

  it("updates task dueDate", async () => {
    mockMutation.mockResolvedValueOnce({ success: true });

    const futureDate = Date.now() + 86400000; // 24 hours from now
    const request = new Request("http://localhost/api/agents/tasks/task-456/update", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        dueDate: futureDate,
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    const data = await response.json();

    expect(response.status).toBe(200);
  });

  it("updates multiple fields at once", async () => {
    mockMutation.mockResolvedValueOnce({ success: true });

    const request = new Request("http://localhost/api/agents/tasks/task-456/update", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        title: "New Title",
        description: "New Description",
        priority: "P1",
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    const data = await response.json();

    expect(response.status).toBe(200);
  });

  it("rejects title shorter than 3 chars", async () => {
    const request = new Request("http://localhost/api/agents/tasks/task-456/update", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        title: "ab",
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    const data = await response.json();

    expect(response.status).toBe(400);
  });

  it("rejects description shorter than 10 chars", async () => {
    const request = new Request("http://localhost/api/agents/tasks/task-456/update", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        description: "short",
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    const data = await response.json();

    expect(response.status).toBe(400);
  });

  it("rejects invalid priority", async () => {
    const request = new Request("http://localhost/api/agents/tasks/task-456/update", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        priority: "P99",
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    expect(response.status).toBe(400);
  });

  it("rejects invalid credentials", async () => {
    (verifyAgent as jest.Mock).mockResolvedValueOnce(null);

    const request = new Request("http://localhost/api/agents/tasks/task-456/update", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "wrong",
        taskId: "task-456",
        title: "New Title",
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    expect(response.status).toBe(401);
  });
});
