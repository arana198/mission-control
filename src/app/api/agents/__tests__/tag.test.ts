/**
 * POST /api/agents/tasks/{taskId}/tag route tests
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    tasks: {
      addTags: "tasks:addTags",
    },
  },
}));
jest.mock("@/lib/agent-auth");
jest.mock("@/lib/utils/logger");

import { POST } from "../tasks/tag/route";
import { ConvexHttpClient } from "convex/browser";
import { verifyAgent } from "@/lib/agent-auth";

describe("POST /api/agents/tasks/{taskId}/tag", () => {
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

  it("adds tag to task", async () => {
    mockMutation.mockResolvedValueOnce({ success: true, tags: ["bug", "urgent"] });

    const request = new Request("http://localhost/api/agents/tasks/task-456/tag", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        tags: ["urgent"],
        action: "add",
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("removes tag from task", async () => {
    mockMutation.mockResolvedValueOnce({ success: true, tags: ["bug"] });

    const request = new Request("http://localhost/api/agents/tasks/task-456/tag", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        tags: ["urgent"],
        action: "remove",
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("rejects empty tags array", async () => {
    const request = new Request("http://localhost/api/agents/tasks/task-456/tag", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        tags: [],
        action: "add",
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("rejects invalid action", async () => {
    const request = new Request("http://localhost/api/agents/tasks/task-456/tag", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "ak_key",
        taskId: "task-456",
        tags: ["bug"],
        action: "invalid",
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    expect(response.status).toBe(400);
  });

  it("rejects invalid credentials", async () => {
    (verifyAgent as jest.Mock).mockResolvedValueOnce(null);

    const request = new Request("http://localhost/api/agents/tasks/task-456/tag", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-123",
        agentKey: "wrong",
        taskId: "task-456",
        tags: ["bug"],
        action: "add",
      }),
    });

    const response = await POST(request, { params: { taskId: "task-456" } });
    expect(response.status).toBe(401);
  });
});
