/**
 * POST /api/memory/context Tests
 */

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/memory/context", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/memory/context", () => {
  it("returns context structure", async () => {
    const { POST } = await import("../context/route");

    const req = makeRequest({ entityName: "goal-1", type: "goal" });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("relevantSections");
    expect(data).toHaveProperty("relatedGoals");
  });

  it("returns empty context arrays", async () => {
    const { POST } = await import("../context/route");

    const req = makeRequest({ entityName: "test" });
    const res = await POST(req as any);

    const data = await res.json();
    expect(Array.isArray(data.relevantSections)).toBe(true);
    expect(Array.isArray(data.relatedGoals)).toBe(true);
  });

  it("accepts entity parameters", async () => {
    const { POST } = await import("../context/route");

    const req = makeRequest({
      entityName: "Implement Auth",
      type: "task",
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it("is a valid endpoint", async () => {
    const { POST } = await import("../context/route");
    expect(typeof POST).toBe("function");
  });
});
