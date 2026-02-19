/**
 * POST /api/memory/search Tests
 */

import { homedir } from 'os';
import { promises as fs } from 'fs';
import { join } from 'path';

// Mock file system
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

const mockReadFile = fs.readFile as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/memory/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/memory/search", () => {
  it("returns empty results for no query", async () => {
    const { POST } = await import("../search/route");

    const req = makeRequest({});
    const res = await POST(req as any);
    const data = await res.json();

    expect(data.results).toHaveLength(0);
  });

  it("returns empty array for empty query string", async () => {
    const { POST } = await import("../search/route");

    const req = makeRequest({ query: "" });
    const res = await POST(req as any);
    const data = await res.json();

    expect(Array.isArray(data.results)).toBe(true);
  });

  it("accepts query parameter", async () => {
    const { POST } = await import("../search/route");
    mockReadFile.mockResolvedValueOnce("test content");

    const req = makeRequest({ query: "test" });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
  });

  it("accepts optional limit parameter", async () => {
    const { POST } = await import("../search/route");
    mockReadFile.mockResolvedValueOnce("test content");

    const req = makeRequest({ query: "test", limit: 5 });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
  });

  it("returns structured results array", async () => {
    const { POST } = await import("../search/route");
    mockReadFile.mockResolvedValueOnce("test content with keyword");

    const req = makeRequest({ query: "keyword" });
    const res = await POST(req as any);
    const data = await res.json();

    expect(Array.isArray(data.results)).toBe(true);
  });

  it("handles missing MEMORY.md gracefully", async () => {
    const { POST } = await import("../search/route");
    mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

    const req = makeRequest({ query: "test" });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
  });
});
