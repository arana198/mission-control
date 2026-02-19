/**
 * POST /api/agents/tasks/{taskId}/comment route tests
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    messages: {
      create: "messages:create",
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

import { ConvexHttpClient } from "convex/browser";
import { verifyAgent } from "@/lib/agent-auth";

describe("POST /api/agents/{agentId}/tasks/{taskId}/comments", () => {
  const mockMutation = jest.fn();
  const mockConvex = {
    mutation: mockMutation,
  };

  const mockAgentId = "agent-123";
  const mockAgentKey = "ak_test_key";
  const mockTaskId = "task-456";
  const mockAgent = {
    _id: mockAgentId,
    name: "TestBot",
    role: "Worker",
    status: "active",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
    (ConvexHttpClient as any).mockImplementation(() => mockConvex);
    (verifyAgent as jest.Mock).mockResolvedValue(mockAgent);
  });

  it("adds comment to task with valid credentials", async () => {
    const { POST } = await import("../[agentId]/tasks/[taskId]/comments/route");
    const messageId = "msg-789";
    mockMutation.mockResolvedValueOnce(messageId);

    const request = new Request("http://localhost/api/agents/agent-123/tasks/task-456/comment", {
      method: "POST",
      body: JSON.stringify({
        agentId: mockAgentId,
        agentKey: mockAgentKey,
        taskId: mockTaskId,
        content: "This task needs review",
        mentions: [],
      }),
    });

    const response = await POST(request, { params: { agentId: mockAgentId, taskId: mockTaskId } });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.messageId).toBe(messageId);
  });

  it("adds comment with agent mentions", async () => {
    const { POST } = await import("../[agentId]/tasks/[taskId]/comments/route");
    const messageId = "msg-789";
    mockMutation.mockResolvedValueOnce(messageId);

    const request = new Request("http://localhost/api/agents/agent-123/tasks/task-456/comment", {
      method: "POST",
      body: JSON.stringify({
        agentId: mockAgentId,
        agentKey: mockAgentKey,
        taskId: mockTaskId,
        content: "@agent-2 please review this",
        mentions: ["agent-2"],
      }),
    });

    const response = await POST(request, { params: { agentId: mockAgentId, taskId: mockTaskId } });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(mockMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        mentions: ["agent-2"],
      })
    );
  });

  it("rejects invalid credentials", async () => {
    const { POST } = await import("../[agentId]/tasks/[taskId]/comments/route");
    (verifyAgent as jest.Mock).mockResolvedValueOnce(null);

    const request = new Request("http://localhost/api/agents/agent-123/tasks/task-456/comment", {
      method: "POST",
      body: JSON.stringify({
        agentId: mockAgentId,
        agentKey: "wrong_key",
        taskId: mockTaskId,
        content: "comment",
        mentions: [],
      }),
    });

    const response = await POST(request, { params: { agentId: mockAgentId, taskId: mockTaskId } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it("rejects empty comment", async () => {
    const { POST } = await import("../[agentId]/tasks/[taskId]/comments/route");
    const request = new Request("http://localhost/api/agents/agent-123/tasks/task-456/comment", {
      method: "POST",
      body: JSON.stringify({
        agentId: mockAgentId,
        agentKey: mockAgentKey,
        taskId: mockTaskId,
        content: "",
        mentions: [],
      }),
    });

    const response = await POST(request, { params: { agentId: mockAgentId, taskId: mockTaskId } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("rejects comment exceeding max length", async () => {
    const { POST } = await import("../[agentId]/tasks/[taskId]/comments/route");
    const request = new Request("http://localhost/api/agents/agent-123/tasks/task-456/comment", {
      method: "POST",
      body: JSON.stringify({
        agentId: mockAgentId,
        agentKey: mockAgentKey,
        taskId: mockTaskId,
        content: "x".repeat(5001),
        mentions: [],
      }),
    });

    const response = await POST(request, { params: { agentId: mockAgentId, taskId: mockTaskId } });
    const data = await response.json();

    expect(response.status).toBe(400);
  });

  it("handles bad JSON", async () => {
    const { POST } = await import("../[agentId]/tasks/[taskId]/comments/route");
    const request = new Request("http://localhost/api/agents/agent-123/tasks/task-456/comment", {
      method: "POST",
      body: "not valid json",
    });

    const response = await POST(request, { params: { agentId: mockAgentId, taskId: mockTaskId } });
    const data = await response.json();

    expect(response.status).toBe(400);
  });

  it("accepts Idempotency-Key header for retry support", async () => {
    const { POST } = await import("../[agentId]/tasks/[taskId]/comments/route");
    const messageId = "msg-789";
    const idempotencyKey = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    mockMutation.mockResolvedValueOnce(messageId);

    const request = new Request("http://localhost/api/agents/agent-123/tasks/task-456/comment", {
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        agentId: mockAgentId,
        agentKey: mockAgentKey,
        taskId: mockTaskId,
        content: "This comment has idempotency support",
        mentions: [],
      }),
    });

    const response = await POST(request, { params: { agentId: mockAgentId, taskId: mockTaskId } });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.messageId).toBe(messageId);
    expect(data.data.idempotencyKey).toBe(idempotencyKey);
  });
});
