/**
 * PUT /api/agents/{agentId} route tests
 * Agent self-service endpoint for updating profile details
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    agents: {
      updateDetails: "agents:updateDetails",
    },
  },
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

describe("PUT /api/agents/{agentId} (Idempotent Update)", () => {
  const mockMutation = jest.fn();
  const mockConvex = {
    mutation: mockMutation,
  };

  const mockAgent = {
    _id: "agent-123",
    name: "monica-gellar",
    role: "Project Manager",
    level: "specialist",
    workspacePath: "/workspace",
    model: "gpt-4",
    personality: "Professional",
    capabilities: ["management"],
    status: "idle",
  };

  let PUT: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
    (ConvexHttpClient as any).mockImplementation(() => mockConvex);
    // Import route after mocks are set up
    const route = await import("../[agentId]/route");
    PUT = route.PUT;
  });

  describe("Authentication", () => {
    it("accepts Bearer token in Authorization header", async () => {
      mockMutation.mockResolvedValueOnce({
        success: true,
        agent: mockAgent,
        updated: false,
      });

      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: {
          Authorization: "Bearer api-key-123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "gpt-4-turbo" }),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      expect(response.status).toBe(200);
      expect(mockMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ apiKey: "api-key-123" })
      );
    });

    it("accepts apiKey in request body", async () => {
      mockMutation.mockResolvedValueOnce({
        success: true,
        agent: mockAgent,
        updated: false,
      });

      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: "api-key-123",
          model: "gpt-4-turbo",
        }),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      expect(response.status).toBe(200);
      expect(mockMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ apiKey: "api-key-123" })
      );
    });

    it("rejects requests without API key", async () => {
      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4-turbo" }),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("handles invalid credentials from Convex", async () => {
      mockMutation.mockRejectedValueOnce(new Error("Invalid credentials"));

      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: {
          Authorization: "Bearer wrong-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "gpt-4-turbo" }),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe("AUTHENTICATION_ERROR");
    });

    it("handles agent not found", async () => {
      mockMutation.mockRejectedValueOnce(new Error("Agent not found"));

      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: {
          Authorization: "Bearer api-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "gpt-4-turbo" }),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe("NOT_FOUND");
    });
  });

  describe("Partial Updates", () => {
    it("updates workspace path only", async () => {
      mockMutation.mockResolvedValueOnce({
        success: true,
        agent: { ...mockAgent, workspacePath: "/new/path" },
        updated: true,
        updatedFields: ["workspacePath"],
      });

      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: {
          Authorization: "Bearer api-key-123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workspacePath: "/new/path" }),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.updatedFields).toContain("workspacePath");
      expect(data.data.agent.workspacePath).toBe("/new/path");
    });

    it("updates model only", async () => {
      mockMutation.mockResolvedValueOnce({
        success: true,
        agent: { ...mockAgent, model: "claude-3-sonnet" },
        updated: true,
        updatedFields: ["model"],
      });

      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: {
          Authorization: "Bearer api-key-123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "claude-3-sonnet" }),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.updatedFields).toContain("model");
      expect(data.data.agent.model).toBe("claude-3-sonnet");
    });

    it("updates personality only", async () => {
      mockMutation.mockResolvedValueOnce({
        success: true,
        agent: { ...mockAgent, personality: "Friendly and helpful" },
        updated: true,
        updatedFields: ["personality"],
      });

      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: {
          Authorization: "Bearer api-key-123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ personality: "Friendly and helpful" }),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.updatedFields).toContain("personality");
      expect(data.data.agent.personality).toBe("Friendly and helpful");
    });

    it("updates capabilities only", async () => {
      const newCapabilities = ["task-management", "code-review", "documentation"];
      mockMutation.mockResolvedValueOnce({
        success: true,
        agent: { ...mockAgent, capabilities: newCapabilities },
        updated: true,
        updatedFields: ["capabilities"],
      });

      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: {
          Authorization: "Bearer api-key-123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ capabilities: newCapabilities }),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.updatedFields).toContain("capabilities");
      expect(data.data.agent.capabilities).toEqual(newCapabilities);
    });

    it("updates multiple fields at once", async () => {
      mockMutation.mockResolvedValueOnce({
        success: true,
        agent: {
          ...mockAgent,
          workspacePath: "/new/path",
          model: "claude-3-sonnet",
          personality: "Updated personality",
        },
        updated: true,
        updatedFields: ["workspacePath", "model", "personality"],
      });

      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: {
          Authorization: "Bearer api-key-123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspacePath: "/new/path",
          model: "claude-3-sonnet",
          personality: "Updated personality",
        }),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.updated).toBe(true);
      expect(data.data.updatedFields.length).toBe(3);
    });

    it("returns unchanged state when no fields provided", async () => {
      mockMutation.mockResolvedValueOnce({
        success: true,
        agent: mockAgent,
        updated: false,
        updatedFields: [],
      });

      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: {
          Authorization: "Bearer api-key-123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.updated).toBe(false);
      expect(data.data.updatedFields.length).toBe(0);
    });
  });

  describe("Validation", () => {
    it("rejects empty workspace path", async () => {
      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: {
          Authorization: "Bearer api-key-123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workspacePath: "" }),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects model exceeding max length", async () => {
      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: {
          Authorization: "Bearer api-key-123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "a".repeat(101) }),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects personality exceeding max length", async () => {
      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: {
          Authorization: "Bearer api-key-123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ personality: "a".repeat(2001) }),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects capabilities with items exceeding max length", async () => {
      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: {
          Authorization: "Bearer api-key-123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ capabilities: ["valid", "a".repeat(101)] }),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("handles invalid JSON gracefully", async () => {
      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Response Format", () => {
    it("returns consistent response structure on success", async () => {
      mockMutation.mockResolvedValueOnce({
        success: true,
        agent: mockAgent,
        updated: true,
        updatedFields: ["model"],
      });

      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: {
          Authorization: "Bearer api-key-123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "gpt-4-turbo" }),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      const data = await response.json();

      expect(data).toHaveProperty("success", true);
      expect(data).toHaveProperty("data");
      expect(data.data).toHaveProperty("agentId");
      expect(data.data).toHaveProperty("agentName");
      expect(data.data).toHaveProperty("updated");
      expect(data.data).toHaveProperty("updatedFields");
      expect(data.data).toHaveProperty("agent");
      expect(data.data.agent).toHaveProperty("name");
      expect(data.data.agent).toHaveProperty("role");
      expect(data.data.agent).toHaveProperty("level");
      expect(data.data.agent).toHaveProperty("workspacePath");
      expect(data.data.agent).toHaveProperty("model");
      expect(data.data.agent).toHaveProperty("personality");
      expect(data.data.agent).toHaveProperty("capabilities");
      expect(data.data.agent).toHaveProperty("status");
    });

    it("returns error structure on validation failure", async () => {
      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "a".repeat(101) }),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      const data = await response.json();

      expect(data).toHaveProperty("success", false);
      expect(data).toHaveProperty("error");
      expect(data.error).toHaveProperty("code");
      expect(data.error).toHaveProperty("message");
      expect(data.error).toHaveProperty("details");
    });
  });

  describe("Convex Integration", () => {
    it("passes correct parameters to Convex mutation", async () => {
      mockMutation.mockResolvedValueOnce({
        success: true,
        agent: mockAgent,
        updated: true,
        updatedFields: ["model"],
      });

      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: {
          Authorization: "Bearer api-key-123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "gpt-4-turbo" }),
      });

      await PUT(request, { params: { agentId: "agent-123" } });

      expect(mockMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          agentId: "agent-123",
          apiKey: "api-key-123",
          model: "gpt-4-turbo",
          workspacePath: undefined,
          personality: undefined,
          capabilities: undefined,
        })
      );
    });

    it("handles Convex mutation errors", async () => {
      mockMutation.mockRejectedValueOnce(new Error("Database error"));

      const request = new Request("http://localhost/api/agents/agent-123", {
        method: "PUT",
        headers: {
          Authorization: "Bearer api-key-123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "gpt-4-turbo" }),
      });

      const response = await PUT(request, { params: { agentId: "agent-123" } });
      const data = await response.json();

      expect(response.status).toBe(500);
      // handleApiError maps unknown errors to INTERNAL_ERROR
      expect(data.error.code).toBe("INTERNAL_ERROR");
    });
  });
});
