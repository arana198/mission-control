/**
 * GET /api/agents/tasks route tests
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    tasks: {
      getFiltered: "tasks:getFiltered",
    },
  },
}));
jest.mock("@/lib/agent-auth");
jest.mock("@/lib/utils/logger");

import { GET } from "../tasks/route";
import { ConvexHttpClient } from "convex/browser";
import { verifyAgent } from "@/lib/agent-auth";

describe("GET /api/agents/tasks", () => {
  const mockQuery = jest.fn();
  const mockConvex = {
    query: mockQuery,
  };

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
    },
    {
      _id: "task-2",
      title: "Task 2",
      status: "backlog",
      priority: "P1",
      description: "Do something else",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
    (ConvexHttpClient as any).mockImplementation(() => mockConvex);
    (verifyAgent as jest.Mock).mockResolvedValue(mockAgent);
  });

  it("returns all tasks for agent", async () => {
    mockQuery.mockResolvedValueOnce(mockTasks);

    const url = new URL("http://localhost/api/agents/tasks");
    url.searchParams.set("agentId", "agent-123");
    url.searchParams.set("agentKey", "ak_key");

    const request = new Request(url.toString());
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.tasks).toHaveLength(2);
  });

  it("filters by status", async () => {
    const filtered = [mockTasks[0]];
    mockQuery.mockResolvedValueOnce(filtered);

    const url = new URL("http://localhost/api/agents/tasks");
    url.searchParams.set("agentId", "agent-123");
    url.searchParams.set("agentKey", "ak_key");
    url.searchParams.set("status", "in_progress");

    const request = new Request(url.toString());
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.tasks).toHaveLength(1);
  });

  it("filters by priority", async () => {
    const filtered = [mockTasks[0]];
    mockQuery.mockResolvedValueOnce(filtered);

    const url = new URL("http://localhost/api/agents/tasks");
    url.searchParams.set("agentId", "agent-123");
    url.searchParams.set("agentKey", "ak_key");
    url.searchParams.set("priority", "P0");

    const request = new Request(url.toString());
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.tasks).toHaveLength(1);
  });

  it("filters assignedToMe", async () => {
    const filtered = [mockTasks[0]];
    mockQuery.mockResolvedValueOnce(filtered);

    const url = new URL("http://localhost/api/agents/tasks");
    url.searchParams.set("agentId", "agent-123");
    url.searchParams.set("agentKey", "ak_key");
    url.searchParams.set("assignedToMe", "true");

    const request = new Request(url.toString());
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
  });

  it("applies pagination", async () => {
    mockConvex.query.mockResolvedValueOnce(mockTasks);

    const url = new URL("http://localhost/api/agents/tasks");
    url.searchParams.set("agentId", "agent-123");
    url.searchParams.set("agentKey", "ak_key");
    url.searchParams.set("limit", "1");
    url.searchParams.set("offset", "0");

    const request = new Request(url.toString());
    const response = await GET(request);
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

    const url = new URL("http://localhost/api/agents/tasks");
    url.searchParams.set("agentId", "agent-123");
    url.searchParams.set("agentKey", "wrong");

    const request = new Request(url.toString());
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns error for missing agentId", async () => {
    const url = new URL("http://localhost/api/agents/tasks");
    url.searchParams.set("agentKey", "ak_key");

    const request = new Request(url.toString());
    const response = await GET(request);

    expect(response.status).toBe(400);
  });
});
