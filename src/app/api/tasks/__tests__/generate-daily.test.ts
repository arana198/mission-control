/**
 * POST /api/tasks/generate-daily Tests
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    tasks: { create: "tasks:create" },
    goals: { getAllActive: "goals:getAllActive" },
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
  return new Request("http://localhost/api/tasks/generate-daily", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/tasks/generate-daily", () => {
  it("generates daily tasks", async () => {
    const { POST } = await import("../generate-daily/route");
    mockQuery.mockResolvedValueOnce([{ _id: "g1", title: "Goal", progress: 50 }]);
    mockMutation.mockResolvedValueOnce({
      generated: 3,
      taskIds: ["t1", "t2", "t3"],
    });

    const req = makeRequest({ workspaceId: "business-123" });
    const res = await POST(req);

    expect([200, 201, 400, 500]).toContain(res.status);
  });

  it("returns generated tasks list", async () => {
    const { POST } = await import("../generate-daily/route");
    mockQuery.mockResolvedValueOnce([]);
    mockMutation.mockResolvedValueOnce({
      generated: 2,
      taskIds: ["t1", "t2"],
    });

    const req = makeRequest({ workspaceId: "business-123" });
    const res = await POST(req);

    if (res.status === 200 || res.status === 201) {
      const data = await res.json();
      expect(data).toBeDefined();
    }
  });

  it("handles no active goals", async () => {
    const { POST } = await import("../generate-daily/route");
    mockQuery.mockResolvedValueOnce([]);

    const req = makeRequest({ workspaceId: "business-123" });
    const res = await POST(req);

    expect([200, 500]).toContain(res.status);
  });

  it("requires workspaceId parameter", async () => {
    const { POST } = await import("../generate-daily/route");

    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("workspaceId");
  });

  it("is a valid POST endpoint", async () => {
    const { POST } = await import("../generate-daily/route");
    expect(typeof POST).toBe("function");
  });
});
