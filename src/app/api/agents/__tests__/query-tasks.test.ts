/**
 * GET /api/agents/tasks route tests
 */

// Create shared mock instances BEFORE jest.mock calls
let mockQuery: jest.Mock;
let mockMutation: jest.Mock;

jest.mock("convex/browser", () => {
  mockQuery = jest.fn();
  mockMutation = jest.fn();
  return {
    ConvexHttpClient: jest.fn(() => ({
      query: mockQuery,
      mutation: mockMutation,
    })),
  };
});

jest.mock("@/convex/_generated/api", () => ({
  api: {
    tasks: {
      getFiltered: "tasks:getFiltered",
    },
    activities: {
      create: "activities:create",
    },
  },
}));

jest.mock("@/lib/agent-auth");

jest.mock("@/lib/utils/logger", () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

import { handleApiError } from "@/lib/utils/apiResponse";
import { ConvexHttpClient } from "convex/browser";
import { verifyAgent } from "@/lib/agent-auth";

describe("GET /api/agents/{agentId}/tasks", () => {
  let GET: any;
  const mockAgent = {
    _id: "agent-123",
    name: "TestBot",
    role: "Worker",
  };

  const mockTasks = [
    {
      _id: "task-1",
      title: "Task 1",
      status: "in_progress",
      priority: "P0",
      description: "Do something",
      ticketNumber: "MC-001",
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      _id: "task-2",
      title: "Task 2",
      status: "backlog",
      priority: "P1",
      description: "Do something else",
      ticketNumber: "MC-002",
      createdAt: 2000,
      updatedAt: 2000,
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
    (verifyAgent as jest.Mock).mockResolvedValue(mockAgent);
    mockMutation!.mockResolvedValue({ success: true }); // Activity logging succeeds by default
    const route = await import("../[agentId]/tasks/route");
    GET = route.GET;
  });

  it("returns all tasks for agent", async () => {
    mockQuery.mockResolvedValueOnce(mockTasks);

    const url = new URL("http://localhost/api/agents/agent-123/tasks");
    url.searchParams.set("agentKey", "ak_key");
    url.searchParams.set("businessId", "business-123");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123" } });
    const data = await response.json();

    if (response.status !== 200) {
      console.error("Response error:", data);
    }

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.tasks).toHaveLength(2);
  });

  it("filters by status", async () => {
    const filtered = [mockTasks[0]];
    mockQuery.mockResolvedValueOnce(filtered);

    const url = new URL("http://localhost/api/agents/agent-123/tasks");
    url.searchParams.set("agentKey", "ak_key");
    url.searchParams.set("businessId", "business-123");
    url.searchParams.set("status", "in_progress");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.tasks).toHaveLength(1);
  });

  it("filters by priority", async () => {
    const filtered = [mockTasks[0]];
    mockQuery.mockResolvedValueOnce(filtered);

    const url = new URL("http://localhost/api/agents/agent-123/tasks");
    url.searchParams.set("agentKey", "ak_key");
    url.searchParams.set("businessId", "business-123");
    url.searchParams.set("priority", "P0");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.tasks).toHaveLength(1);
  });

  it("filters assignedToMe", async () => {
    const filtered = [mockTasks[0]];
    mockQuery.mockResolvedValueOnce(filtered);

    const url = new URL("http://localhost/api/agents/agent-123/tasks");
    url.searchParams.set("agentKey", "ak_key");
    url.searchParams.set("businessId", "business-123");
    url.searchParams.set("assignedToMe", "true");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123" } });
    const data = await response.json();

    expect(response.status).toBe(200);
  });

  it("applies pagination", async () => {
    mockQuery!.mockResolvedValueOnce(mockTasks);

    const url = new URL("http://localhost/api/agents/agent-123/tasks");
    url.searchParams.set("agentKey", "ak_key");
    url.searchParams.set("businessId", "business-123");
    url.searchParams.set("limit", "1");
    url.searchParams.set("offset", "0");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        limit: 1,
        offset: 0,
      })
    );
  });

  it("rejects invalid credentials", async () => {
    (verifyAgent as jest.Mock).mockResolvedValueOnce(null);

    const url = new URL("http://localhost/api/agents/agent-123/tasks");
    url.searchParams.set("agentKey", "wrong");
    url.searchParams.set("businessId", "business-123");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123" } });

    expect(response.status).toBe(401);
  });

  it("returns error for missing businessId", async () => {
    const url = new URL("http://localhost/api/agents/agent-123/tasks");
    url.searchParams.set("agentKey", "ak_key");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123" } });

    expect(response.status).toBe(400);
  });

  it("returns error for missing businessId", async () => {
    const url = new URL("http://localhost/api/agents/agent-123/tasks");
    url.searchParams.set("agentKey", "ak_key");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123" } });

    expect(response.status).toBe(400);
  });

  it("includes ticketNumber in response", async () => {
    mockQuery.mockResolvedValueOnce(mockTasks);

    const url = new URL("http://localhost/api/agents/agent-123/tasks");
    url.searchParams.set("agentKey", "ak_key");
    url.searchParams.set("businessId", "business-123");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.tasks[0]).toHaveProperty("ticketNumber");
    expect(data.data.tasks[0].ticketNumber).toBe("MC-001");
    expect(data.data.tasks[1].ticketNumber).toBe("MC-002");
  });

  it("includes meta object with count, filters, and pagination", async () => {
    mockQuery.mockResolvedValueOnce(mockTasks);

    const url = new URL("http://localhost/api/agents/agent-123/tasks");
    url.searchParams.set("agentKey", "ak_key");
    url.searchParams.set("businessId", "business-123");
    url.searchParams.set("status", "in_progress");
    url.searchParams.set("priority", "P0");
    url.searchParams.set("limit", "10");
    url.searchParams.set("offset", "0");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.meta).toBeDefined();
    expect(data.data.meta.count).toBe(2);
    expect(data.data.meta.filters).toEqual({
      status: "in_progress",
      priority: "P0",
      assignedTo: undefined,
    });
    expect(data.data.meta.pagination).toEqual({
      limit: 10,
      offset: 0,
    });
  });

  it("logs activity on successful task query", async () => {
    mockQuery.mockResolvedValueOnce(mockTasks);

    const url = new URL("http://localhost/api/agents/agent-123/tasks");
    url.searchParams.set("agentKey", "ak_key");
    url.searchParams.set("businessId", "business-123");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123" } });

    expect(response.status).toBe(200);
    expect(mockMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "tasks_queried",
        agentId: "agent-123",
        agentName: "TestBot",
        agentRole: "Worker",
        message: expect.stringContaining("TestBot queried tasks (2 results)"),
      })
    );
  });

  it("doesn't break response if activity logging fails", async () => {
    mockQuery.mockResolvedValueOnce(mockTasks);
    mockMutation.mockRejectedValueOnce(new Error("Activity logging failed"));

    const url = new URL("http://localhost/api/agents/agent-123/tasks");
    url.searchParams.set("agentKey", "ak_key");
    url.searchParams.set("businessId", "business-123");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123" } });
    const data = await response.json();

    // Should still return 200 even if activity logging fails
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.tasks).toHaveLength(2);
  });

  it("returns empty array when no tasks match filters", async () => {
    mockQuery.mockResolvedValueOnce([]);

    const url = new URL("http://localhost/api/agents/agent-123/tasks");
    url.searchParams.set("agentKey", "ak_key");
    url.searchParams.set("businessId", "business-123");
    url.searchParams.set("status", "done");

    const request = new Request(url.toString());
    const response = await GET(request, { params: { agentId: "agent-123" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.tasks).toEqual([]);
    expect(data.data.meta.count).toBe(0);
  });
});
