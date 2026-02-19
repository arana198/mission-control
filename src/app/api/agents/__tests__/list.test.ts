/**
 * GET /api/agents/list Tests
 *
 * Tests agent list endpoint used for @ mentions
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    agents: {
      getAllAgents: "agents:getAllAgents",
    },
  },
}));
jest.mock("@/lib/agent-auth");

import { ConvexHttpClient } from "convex/browser";
import { verifyAgent } from "@/lib/agent-auth";

const mockQuery = jest.fn();
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<typeof ConvexHttpClient>;

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(() => ({
    query: mockQuery,
  } as any));
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
  (verifyAgent as jest.Mock).mockResolvedValue({
    _id: "agent-1",
    name: "jarvis",
  });
});

function makeRequest(params: Record<string, string>): Request {
  const url = new URL("http://localhost/api/agents/list");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new Request(url, { method: "GET" });
}

describe("GET /api/agents/list", () => {
  it("returns agent list for authenticated agent", async () => {
    const { GET } = await import("../list/route");

    mockQuery.mockResolvedValue([
      { _id: "a1", name: "jarvis", role: "lead", level: "lead", status: "active" },
      { _id: "a2", name: "shuri", role: "specialist", level: "specialist", status: "idle" },
    ]);

    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.agents).toHaveLength(2);
    expect(data.data.agents[0].name).toBe("jarvis");
  });

  it("returns 400 when missing agentId", async () => {
    const { GET } = await import("../list/route");

    const req = makeRequest({ agentKey: "key-1" });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when missing agentKey", async () => {
    const { GET } = await import("../list/route");

    const req = makeRequest({ agentId: "agent-1" });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 for invalid agent credentials", async () => {
    const { GET } = await import("../list/route");

    (verifyAgent as jest.Mock).mockResolvedValue(null);
    const req = makeRequest({
      agentId: "agent-invalid",
      agentKey: "wrong-key",
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("sanitizes agent data removing sensitive fields", async () => {
    const { GET } = await import("../list/route");

    mockQuery.mockResolvedValue([
      {
        _id: "a1",
        name: "jarvis",
        role: "lead",
        level: "lead",
        status: "active",
        apiKey: "secret",
        lastHeartbeat: 123456,
      },
    ]);

    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
    });

    const res = await GET(req);
    const data = await res.json();
    expect(data.data.agents[0].apiKey).toBeUndefined();
    expect(data.data.agents[0].lastHeartbeat).toBeUndefined();
  });

  it("returns empty list when no agents exist", async () => {
    const { GET } = await import("../list/route");

    mockQuery.mockResolvedValue([]);

    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
    });

    const res = await GET(req);
    const data = await res.json();
    expect(data.data.agents).toHaveLength(0);
  });

  it("includes all required fields in agent objects", async () => {
    const { GET } = await import("../list/route");

    mockQuery.mockResolvedValue([
      { _id: "a1", name: "agent1", role: "role1", level: "lead", status: "active" },
    ]);

    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
    });

    const res = await GET(req);
    const data = await res.json();
    const agent = data.data.agents[0];
    expect(agent).toHaveProperty("id");
    expect(agent).toHaveProperty("name");
    expect(agent).toHaveProperty("role");
    expect(agent).toHaveProperty("level");
    expect(agent).toHaveProperty("status");
  });

  it("returns 500 when query fails", async () => {
    const { GET } = await import("../list/route");

    mockQuery.mockRejectedValue(new Error("DB error"));

    const req = makeRequest({
      agentId: "agent-1",
      agentKey: "key-1",
    });

    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
