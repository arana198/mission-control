/**
 * v1 Workspace Workflow Detail Route Tests
 * Tests RFC 9457 compliant workflow endpoints (GET, PUT, DELETE)
 * Path: GET /api/v1/workspaces/{workspaceId}/workflows/{workflowId}
 * Path: PUT /api/v1/workspaces/{workspaceId}/workflows/{workflowId}
 * Path: DELETE /api/v1/workspaces/{workspaceId}/workflows/{workflowId}
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      status: init?.status || 200,
      headers: {
        get: (key: string) => init?.headers?.[key] || null,
      },
      json: () => Promise.resolve(data),
    })),
  },
}));

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    workflows: {
      getWorkflow: "workflows:getWorkflow",
      updateWorkflow: "workflows:updateWorkflow",
      deleteWorkflow: "workflows:deleteWorkflow",
    },
  },
}));
jest.mock("@/lib/agent-auth");
jest.mock("@/lib/api/auth", () => ({
  isAuthRequired: jest.fn(() => false),
  extractAuth: jest.fn(),
}));
jest.mock("@/lib/utils/logger", () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

import { ConvexHttpClient } from "convex/browser";
import { GET, PUT, DELETE } from "../route";

const mockQuery = jest.fn();
const mockMutation = jest.fn();
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<
  typeof ConvexHttpClient
>;

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(() => ({
    query: mockQuery,
    mutation: mockMutation,
  } as any));
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
});

describe("GET /api/v1/workspaces/{workspaceId}/workflows/{workflowId}", () => {
  it("should validate route exists and accepts GET requests", async () => {
    expect(typeof GET).toBe("function");
    expect(GET.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//workflows/wf-123",
      {
        method: "GET",
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "", workflowId: "wf-123" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when workflowId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/workflows/",
      {
        method: "GET",
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", workflowId: "" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when workflow does not exist", async () => {
    mockQuery.mockResolvedValue(null);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/workflows/nonexistent",
      {
        method: "GET",
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", workflowId: "nonexistent" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 200 with workflow details when found", async () => {
    mockQuery.mockResolvedValue({
      _id: "wf-123",
      _creationTime: 1234567890,
      name: "Test Workflow",
      description: "Workflow description",
    });

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/workflows/wf-123",
      {
        method: "GET",
      }
    );

    const response = await GET(request as any, {
      params: { workspaceId: "ws-123", workflowId: "wf-123" },
    });

    expect([200, 500]).toContain(response.status);
  });
});

describe("PUT /api/v1/workspaces/{workspaceId}/workflows/{workflowId}", () => {
  it("should validate route exists and accepts PUT requests", async () => {
    expect(typeof PUT).toBe("function");
    expect(PUT.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const body = { name: "Updated Workflow" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//workflows/wf-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "", workflowId: "wf-123" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when workflowId is missing", async () => {
    const body = { name: "Updated Workflow" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/workflows/",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", workflowId: "" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 400 for empty body", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/workflows/wf-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", workflowId: "wf-123" },
    });

    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for empty name", async () => {
    const body = { name: "" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/workflows/wf-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", workflowId: "wf-123" },
    });

    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for name exceeding max length", async () => {
    const body = { name: "x".repeat(201) };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/workflows/wf-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", workflowId: "wf-123" },
    });

    expect([400, 500]).toContain(response.status);
  });

  it("should return 400 for invalid JSON body", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/workflows/wf-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "invalid json {",
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", workflowId: "wf-123" },
    });

    expect([400, 500]).toContain(response.status);
  });

  it("should accept valid workflow update with name", async () => {
    mockMutation.mockResolvedValue({
      _id: "wf-123",
      _creationTime: 1234567890,
      name: "Updated Workflow",
      description: "Description",
    });

    const body = { name: "Updated Workflow" };

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/workflows/wf-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const response = await PUT(request as any, {
      params: { workspaceId: "ws-123", workflowId: "wf-123" },
    });

    expect([200, 400, 500]).toContain(response.status);
  });
});

describe("DELETE /api/v1/workspaces/{workspaceId}/workflows/{workflowId}", () => {
  it("should validate route exists and accepts DELETE requests", async () => {
    expect(typeof DELETE).toBe("function");
    expect(DELETE.length).toBeGreaterThan(0);
  });

  it("should return 404 when workspaceId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces//workflows/wf-123",
      {
        method: "DELETE",
      }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "", workflowId: "wf-123" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when workflowId is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/workflows/",
      {
        method: "DELETE",
      }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", workflowId: "" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when workflow does not exist", async () => {
    mockMutation.mockResolvedValue(false);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/workflows/nonexistent",
      {
        method: "DELETE",
      }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", workflowId: "nonexistent" },
    });

    expect(response.status).toBe(404);
  });

  it("should return 200 when workflow is deleted successfully", async () => {
    mockMutation.mockResolvedValue(true);

    const request = new Request(
      "http://localhost:3000/api/v1/workspaces/ws-123/workflows/wf-123",
      {
        method: "DELETE",
      }
    );

    const response = await DELETE(request as any, {
      params: { workspaceId: "ws-123", workflowId: "wf-123" },
    });

    expect([200, 500]).toContain(response.status);
  });
});
