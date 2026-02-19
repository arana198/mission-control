jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    agents: {
      register: "agents:register",
      getByName: "agents:getByName",
    },
  },
}));

import { ConvexHttpClient } from "convex/browser";

const mockMutation = jest.fn();
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<
  typeof ConvexHttpClient
>;

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(() => ({
    mutation: mockMutation,
  } as any));
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/agents", () => {
  it("returns 201 with agentId and apiKey for new agent", async () => {
    // Import here after mocks are setup
    const { POST } = await import("../route");

    mockMutation.mockResolvedValue({
      agentId: "abc123",
      apiKey: "ak_new_12345",
      isNew: true,
    });

    const req = makeRequest({
      name: "jarvis",
      role: "Squad Lead",
      level: "lead",
      sessionKey: "agent:main:main",
      workspacePath: "/Users/arana/.openclaw/workspace",
    });

    const res = await POST(req, { params: { agentId: "agent-123", taskId: "task-456" } });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.agentId).toBe("abc123");
    expect(data.data.apiKey).toBeDefined();
    expect(data.data.isNew).toBe(true);
  });

  it("returns 200 with existing agent data (not new)", async () => {
    const { POST } = await import("../route");

    mockMutation.mockResolvedValue({
      agentId: "abc123",
      apiKey: "ak_existing_key",
      isNew: false,
    });

    const req = makeRequest({
      name: "jarvis",
      role: "Squad Lead",
      level: "lead",
      sessionKey: "agent:main:main",
      workspacePath: "/Users/arana/.openclaw/workspace",
    });

    const res = await POST(req, { params: { agentId: "agent-123", taskId: "task-456" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.isNew).toBe(false);
  });

  it("returns 400 for missing required fields", async () => {
    const { POST } = await import("../route");

    const req = makeRequest({ name: "jarvis" }); // Missing role, level, sessionKey
    const res = await POST(req, { params: { agentId: "agent-123", taskId: "task-456" } });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("returns 400 for invalid level", async () => {
    const { POST } = await import("../route");

    const req = makeRequest({
      name: "jarvis",
      role: "Lead",
      level: "god",
      sessionKey: "k",
    });
    const res = await POST(req, { params: { agentId: "agent-123", taskId: "task-456" } });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid name (starts with number)", async () => {
    const { POST } = await import("../route");

    const req = makeRequest({
      name: "1jarvis",
      role: "Lead",
      level: "lead",
      sessionKey: "k",
    });
    const res = await POST(req, { params: { agentId: "agent-123", taskId: "task-456" } });
    expect(res.status).toBe(400);
  });

  it("returns 500 when Convex mutation fails", async () => {
    const { POST } = await import("../route");

    mockMutation.mockRejectedValue(new Error("DB error"));
    const req = makeRequest({
      name: "jarvis",
      role: "Lead",
      level: "lead",
      sessionKey: "k",
      workspacePath: "/Users/arana/.openclaw/workspace",
    });
    const res = await POST(req, { params: { agentId: "agent-123", taskId: "task-456" } });
    expect(res.status).toBe(500);
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("../route");

    const req = new Request("http://localhost/api/agents/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    });
    const res = await POST(req, { params: { agentId: "agent-123", taskId: "task-456" } });
    expect(res.status).toBe(400);
  });
});
