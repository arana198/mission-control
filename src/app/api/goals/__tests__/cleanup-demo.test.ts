/**
 * POST /api/goals/cleanup-demo Tests
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: { goals: { archiveDemoGoals: "goals:archiveDemoGoals" } },
}));

import { ConvexHttpClient } from "convex/browser";

const mockMutation = jest.fn();
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<typeof ConvexHttpClient>;

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(() => ({
    mutation: mockMutation,
  } as any));
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
});

function makeRequest(): Request {
  return new Request("http://localhost/api/goals/cleanup-demo", { method: "POST" });
}

describe("POST /api/goals/cleanup-demo", () => {
  it("archives demo goals successfully", async () => {
    const { POST } = await import("../cleanup-demo/route");
    mockMutation.mockResolvedValueOnce({ archived: 3 });

    const req = makeRequest();
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain("Archived");
  });

  it("includes count of archived goals", async () => {
    const { POST } = await import("../cleanup-demo/route");
    mockMutation.mockResolvedValueOnce({ archived: 5 });

    const req = makeRequest();
    const res = await POST(req);

    const data = await res.json();
    expect(data.message).toContain("5");
  });

  it("returns zero when no goals archived", async () => {
    const { POST } = await import("../cleanup-demo/route");
    mockMutation.mockResolvedValueOnce({ archived: 0 });

    const req = makeRequest();
    const res = await POST(req);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain("0");
  });

  it("returns 500 when mutation fails", async () => {
    const { POST } = await import("../cleanup-demo/route");
    mockMutation.mockRejectedValueOnce(new Error("DB error"));

    const req = makeRequest();
    const res = await POST(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("returns error message from exception", async () => {
    const { POST } = await import("../cleanup-demo/route");
    mockMutation.mockRejectedValueOnce(new Error("Cleanup failed"));

    const req = makeRequest();
    const res = await POST(req);

    const data = await res.json();
    expect(data.error).toContain("Cleanup failed");
  });
});
