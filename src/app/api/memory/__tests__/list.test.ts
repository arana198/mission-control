/**
 * GET /api/memory/list Tests
 */

jest.mock("fs", () => ({
  promises: {
    readdir: jest.fn(),
  },
}));

import { promises as fs } from "fs";

const mockReaddir = fs.readdir as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

function makeRequest(): Request {
  return new Request("http://localhost/api/memory/list", {
    method: "GET",
  });
}

describe("GET /api/memory/list", () => {
  it("lists memory files", async () => {
    const { GET } = await import("../list/route");
    mockReaddir.mockResolvedValueOnce(["file1.md", "file2.md"]);

    const req = makeRequest();
    const res = await GET();

    expect(res.status).toBe(200);
  });

  it("returns files array", async () => {
    const { GET } = await import("../list/route");
    mockReaddir.mockResolvedValueOnce(["memory.md", "notes.md"]);

    const res = await GET();
    const data = await res.json();

    expect(Array.isArray(data.files)).toBe(true);
  });

  it("filters for markdown files", async () => {
    const { GET } = await import("../list/route");
    mockReaddir.mockResolvedValueOnce(["file.md", "file.txt", "other.md"]);

    const res = await GET();
    const data = await res.json();

    expect(data.files.every((f: string) => f.endsWith(".md"))).toBe(true);
  });

  it("returns empty array on error", async () => {
    const { GET } = await import("../list/route");
    mockReaddir.mockRejectedValueOnce(new Error("ENOENT"));

    const res = await GET();
    const data = await res.json();

    expect(data.files).toEqual([]);
  });
});
