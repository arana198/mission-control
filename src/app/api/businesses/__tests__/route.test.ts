/**
 * POST /api/businesses Tests
 * GET /api/businesses Tests
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: { businesses: { getAll: "businesses:getAll", create: "businesses:create" } },
}));

import { ConvexHttpClient } from "convex/browser";

const mockQuery = jest.fn();
const mockMutation = jest.fn();
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<
  typeof ConvexHttpClient
>;

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(
    () =>
      ({
        query: mockQuery,
        mutation: mockMutation,
      } as any)
  );
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
});

describe("GET /api/businesses", () => {
  it("returns list of all businesses", async () => {
    const { GET } = await import("../route");
    mockQuery.mockResolvedValue([
      {
        _id: "b1",
        name: "Mission Control HQ",
        slug: "mission-control-hq",
        isDefault: true,
      },
      {
        _id: "b2",
        name: "Project Alpha",
        slug: "project-alpha",
        isDefault: false,
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.businesses).toHaveLength(2);
    expect(data.businesses[0].name).toBe("Mission Control HQ");
  });

  it("returns empty list when no businesses exist", async () => {
    const { GET } = await import("../route");
    mockQuery.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.businesses).toHaveLength(0);
  });

  it("returns 500 on query error", async () => {
    const { GET } = await import("../route");
    mockQuery.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.success).toBe(false);
  });
});

describe("POST /api/businesses", () => {
  it("creates a new business with required fields", async () => {
    const { POST } = await import("../route");
    mockMutation.mockResolvedValue("business-id-123");

    const req = new Request("http://localhost/api/businesses", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Business",
        slug: "test-business",
        missionStatement: "To solve real problems",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain("Test Business");
    expect(data.businessId).toBe("business-id-123");
  });

  it("creates business with optional fields", async () => {
    const { POST } = await import("../route");
    mockMutation.mockResolvedValue("business-id-456");

    const req = new Request("http://localhost/api/businesses", {
      method: "POST",
      body: JSON.stringify({
        name: "Acme Corp",
        slug: "acme-corp",
        color: "blue",
        emoji: "🏢",
        description: "Acme Corporation",
        missionStatement: "To deliver quality solutions",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("returns 400 when name is missing", async () => {
    const { POST } = await import("../route");

    const req = new Request("http://localhost/api/businesses", {
      method: "POST",
      body: JSON.stringify({
        slug: "test-business",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("name");
  });

  it("returns 400 when slug is missing", async () => {
    const { POST } = await import("../route");

    const req = new Request("http://localhost/api/businesses", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Business",
        missionStatement: "To solve problems",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("slug");
  });

  it("returns 400 when missionStatement is missing", async () => {
    const { POST } = await import("../route");

    const req = new Request("http://localhost/api/businesses", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Business",
        slug: "test-business",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("missionStatement");
  });

  it("returns 500 on mutation error", async () => {
    const { POST } = await import("../route");
    mockMutation.mockRejectedValue(new Error("Slug already exists"));

    const req = new Request("http://localhost/api/businesses", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Business",
        slug: "test-business",
        missionStatement: "Test mission",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.success).toBe(false);
  });
});
