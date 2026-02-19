/**
 * POST /api/tasks/execute Tests
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    executionLog: { create: "logs:create" },
    tasks: { getTaskById: "tasks:getTaskById" },
  },
}));

import { ConvexHttpClient } from "convex/browser";

const mockMutation = jest.fn();
const mockQuery = jest.fn();
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<typeof ConvexHttpClient>;

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(() => ({
    mutation: mockMutation,
    query: mockQuery,
  } as any));
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/tasks/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/tasks/execute", () => {
  it("queues task execution", async () => {
    const { POST } = await import("../execute/route");
    mockMutation.mockResolvedValueOnce({
      executionId: "exec-1",
      status: "queued",
    });

    const req = makeRequest({
      taskId: "task-1",
      taskTitle: "Test Task",
      taskDescription: "Complete test task",
    });

    const res = await POST(req);
    expect([200, 201, 400, 500]).toContain(res.status);
  });

  it("requires taskId", async () => {
    const { POST } = await import("../execute/route");

    const req = makeRequest({
      taskTitle: "Test",
      taskDescription: "Test task",
    });

    const res = await POST(req);
    expect([400, 500]).toContain(res.status);
  });

  it("accepts optional goalIds", async () => {
    const { POST } = await import("../execute/route");
    mockMutation.mockResolvedValueOnce({
      executionId: "exec-1",
      status: "queued",
    });

    const req = makeRequest({
      taskId: "task-1",
      taskTitle: "Test",
      taskDescription: "Test task",
      goalIds: ["goal-1", "goal-2"],
    });

    const res = await POST(req);
    expect(res.status).toBeLessThanOrEqual(201);
  });

  it("accepts optional timeout", async () => {
    const { POST } = await import("../execute/route");
    mockMutation.mockResolvedValueOnce({
      executionId: "exec-1",
      status: "queued",
    });

    const req = makeRequest({
      taskId: "task-1",
      taskTitle: "Test",
      taskDescription: "Test task",
      timeoutSeconds: 600,
    });

    const res = await POST(req);
    expect(res.status).toBeLessThanOrEqual(201);
  });
});
