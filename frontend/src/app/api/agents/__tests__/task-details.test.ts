/**
 * GET /api/agents/tasks/{taskId} route tests
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    tasks: {
      getWithDetails: "tasks:getWithDetails",
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

import { GET } from "../[agentId]/tasks/[taskId]/route";
import { ConvexHttpClient } from "convex/browser";
import { verifyAgent } from "@/lib/agent-auth";

describe("GET /api/agents/{agentId}/tasks/{taskId}", () => {
  const mockQuery = jest.fn();
  const mockConvex = {
    query: mockQuery,
  };

  const mockAgent = {
    _id: "agent-123",
    name: "TestBot",
    role: "Worker",
  };

  const mockTask = {
    _id: "task-456",
    title: "Task Title",
    description: "Task description",
    status: "in_progress",
    priority: "P0",
    assigneeIds: ["agent-123"],
    tags: ["bug", "urgent"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
    (ConvexHttpClient as any).mockImplementation(() => mockConvex);
    (verifyAgent as jest.Mock).mockResolvedValue(mockAgent);
  });

  it("returns task details with valid credentials", async () => {
    mockQuery.mockResolvedValueOnce(mockTask);

    const url = new URL("http://localhost/api/agents/agent-123/tasks/task-456");
    url.searchParams.set("agentKey", "ak_key");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123", taskId: "task-456" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.task._id).toBe("task-456");
    expect(data.data.task.title).toBe("Task Title");
  });

  it("returns full task object with all fields", async () => {
    mockQuery.mockResolvedValueOnce(mockTask);

    const url = new URL("http://localhost/api/agents/agent-123/tasks/task-456");
    url.searchParams.set("agentKey", "ak_key");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123", taskId: "task-456" } });
    const data = await response.json();

    expect(data.data.task).toMatchObject({
      _id: "task-456",
      title: expect.any(String),
      description: expect.any(String),
      status: expect.any(String),
      priority: expect.any(String),
      assigneeIds: expect.any(Array),
      tags: expect.any(Array),
    });
  });

  it("rejects invalid credentials", async () => {
    (verifyAgent as jest.Mock).mockResolvedValueOnce(null);

    const url = new URL("http://localhost/api/agents/agent-123/tasks/task-456");
    url.searchParams.set("agentKey", "wrong");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123", taskId: "task-456" } });

    expect(response.status).toBe(401);
  });

  it("returns 404 for non-existent task", async () => {
    mockQuery.mockResolvedValueOnce(null);

    const url = new URL("http://localhost/api/agents/agent-123/tasks/nonexistent");
    url.searchParams.set("agentKey", "ak_key");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123", taskId: "nonexistent" } });

    expect(response.status).toBe(404);
  });

  it("returns error for missing agentKey", async () => {
    const url = new URL("http://localhost/api/agents/agent-123/tasks/task-456");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123", taskId: "task-456" } });

    expect(response.status).toBe(400);
  });
});
