/**
 * POST /api/goals/seed-demo Tests
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: { goals: { seedDemoGoals: "goals:seedDemoGoals" } },
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
  return new Request("http://localhost/api/goals/seed-demo", { method: "POST" });
}

describe("POST /api/goals/seed-demo", () => {
  it("seeds demo goals successfully", async () => {
    const { POST } = await import("../seed-demo/route");
    mockMutation.mockResolvedValueOnce({
      created: 3,
      goalIds: ["g1", "g2", "g3"],
    });

    const req = makeRequest();
    const res = await POST(req);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain("Demo goals created");
  });

  it("includes result data in response", async () => {
    const { POST } = await import("../seed-demo/route");
    mockMutation.mockResolvedValueOnce({
      created: 5,
      goalIds: ["g1", "g2", "g3", "g4", "g5"],
    });

    const req = makeRequest();
    const res = await POST(req);

    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(data.data.created).toBe(5);
  });

  it("returns 500 when mutation fails", async () => {
    const { POST } = await import("../seed-demo/route");
    mockMutation.mockRejectedValueOnce(new Error("DB error"));

    const req = makeRequest();
    const res = await POST(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("returns error message from exception", async () => {
    const { POST } = await import("../seed-demo/route");
    mockMutation.mockRejectedValueOnce(new Error("Specific error message"));

    const req = makeRequest();
    const res = await POST(req);

    const data = await res.json();
    expect(data.error).toContain("Specific error message");
  });
});
