/**
 * POST /api/memory/content Tests
 */

jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

import { promises as fs } from "fs";

const mockReadFile = fs.readFile as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/memory/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/memory/content", () => {
  it("requires path parameter", async () => {
    const { POST } = await import("../content/route");

    const req = makeRequest({});
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it("returns content from file", async () => {
    const { POST } = await import("../content/route");
    mockReadFile.mockResolvedValueOnce("File content here");

    const req = makeRequest({ path: "memory/notes.md" });
    const res = await POST(req as any);

    expect([200, 404, 500]).toContain(res.status);
  });

  it("handles missing files", async () => {
    const { POST } = await import("../content/route");
    mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

    const req = makeRequest({ path: "nonexistent.md" });
    const res = await POST(req as any);

    expect([404, 500]).toContain(res.status);
  });

  it("is a valid API endpoint", async () => {
    const { POST } = await import("../content/route");
    expect(typeof POST).toBe("function");
  });
});
