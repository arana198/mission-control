/**
 * GET /api/epics/list Tests
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: { epics: { getAllEpics: "epics:getAllEpics" } },
}));

import { ConvexHttpClient } from "convex/browser";

const mockQuery = jest.fn();
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<typeof ConvexHttpClient>;

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(() => ({ query: mockQuery } as any));
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
});

function makeRequest(businessId: string = "test-business-id"): Request {
  const url = `http://localhost/api/epics/list?businessId=${businessId}`;
  return new Request(url, { method: "GET" });
}

describe("GET /api/epics/list", () => {
  it("returns epics list (no auth required)", async () => {
    const { GET } = await import("../list/route");
    mockQuery.mockResolvedValue([
      { _id: "e1", title: "MVP", status: "active", progress: 50, taskIds: [] },
      { _id: "e2", title: "Scale", status: "planning", progress: 0, taskIds: [] },
    ]);
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.epics).toHaveLength(2);
    expect(data.epics[0].title).toBe("MVP");
  });

  it("includes taskCount in response", async () => {
    const { GET } = await import("../list/route");
    mockQuery.mockResolvedValue([
      { _id: "e1", title: "Epic", status: "active", progress: 50, taskIds: ["t1", "t2"] },
    ]);
    const req = makeRequest();
    const res = await GET(req);
    const data = await res.json();
    expect(data.epics[0].taskCount).toBe(2);
  });

  it("returns empty list when no epics exist", async () => {
    const { GET } = await import("../list/route");
    mockQuery.mockResolvedValue([]);
    const req = makeRequest();
    const res = await GET(req);
    const data = await res.json();
    expect(data.epics).toHaveLength(0);
    expect(data.message).toContain("0 epic");
  });

  it("returns 500 when query fails", async () => {
    const { GET } = await import("../list/route");
    mockQuery.mockRejectedValue(new Error("DB error"));
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
