/**
 * Agent Validators Tests
 *
 * Tests for:
 * - RegisterAgentSchema
 * - UpdateAgentSchema
 * - PollAgentSchema
 * - Other agent input schemas
 */

import {
  RegisterAgentSchema,
  UpdateAgentSchema,
  PollAgentSchema,
} from "../agentValidators";

describe("agentValidators", () => {
  describe("RegisterAgentSchema", () => {
    it("accepts valid registration input", () => {
      const input = {
        name: "test-agent",
        role: "Frontend Developer",
        level: "specialist",
        sessionKey: "key123",
        workspacePath: "/workspace/test",
      };
      const result = RegisterAgentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts optional fields", () => {
      const input = {
        name: "test-agent",
        role: "Developer",
        level: "lead",
        sessionKey: "key123",
        workspacePath: "/workspace/test",
        capabilities: ["typescript", "react"],
        model: "gpt-4",
        personality: "professional",
      };
      const result = RegisterAgentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects name below min length", () => {
      const input = {
        name: "a",
        role: "Developer",
        level: "intern",
        sessionKey: "key123",
        workspacePath: "/workspace/test",
      };
      const result = RegisterAgentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects name above max length", () => {
      const input = {
        name: "a".repeat(51),
        role: "Developer",
        level: "intern",
        sessionKey: "key123",
        workspacePath: "/workspace/test",
      };
      const result = RegisterAgentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects name not starting with letter", () => {
      const input = {
        name: "123-agent",
        role: "Developer",
        level: "specialist",
        sessionKey: "key123",
        workspacePath: "/workspace/test",
      };
      const result = RegisterAgentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects invalid level enum", () => {
      const input = {
        name: "test-agent",
        role: "Developer",
        level: "invalid",
        sessionKey: "key123",
        workspacePath: "/workspace/test",
      };
      const result = RegisterAgentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects missing required fields", () => {
      const input = {
        name: "test-agent",
        role: "Developer",
        // Missing level, sessionKey, workspacePath
      };
      const result = RegisterAgentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects empty workspace path", () => {
      const input = {
        name: "test-agent",
        role: "Developer",
        level: "lead",
        sessionKey: "key123",
        workspacePath: "",
      };
      const result = RegisterAgentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("UpdateAgentSchema", () => {
    it("accepts update with all fields", () => {
      const input = {
        agentId: "agent123",
        apiKey: "key456",
        workspacePath: "/new/workspace",
        model: "gpt-4-turbo",
        personality: "updated personality",
        capabilities: ["python", "javascript"],
      };
      const result = UpdateAgentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts update with only agentId and apiKey", () => {
      const input = {
        agentId: "agent123",
        apiKey: "key456",
      };
      const result = UpdateAgentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts partial updates", () => {
      const input = {
        agentId: "agent123",
        apiKey: "key456",
        workspacePath: "/new/workspace",
      };
      const result = UpdateAgentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts update with model only", () => {
      const input = {
        agentId: "agent123",
        apiKey: "key456",
        model: "gpt-4",
      };
      const result = UpdateAgentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts update with personality only", () => {
      const input = {
        agentId: "agent123",
        apiKey: "key456",
        personality: "helpful and professional",
      };
      const result = UpdateAgentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts update with capabilities only", () => {
      const input = {
        agentId: "agent123",
        apiKey: "key456",
        capabilities: ["task-management", "code-review"],
      };
      const result = UpdateAgentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects missing agentId", () => {
      const input = {
        apiKey: "key456",
        workspacePath: "/new/workspace",
      };
      const result = UpdateAgentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects missing apiKey", () => {
      const input = {
        agentId: "agent123",
        workspacePath: "/new/workspace",
      };
      const result = UpdateAgentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects empty workspacePath when provided", () => {
      const input = {
        agentId: "agent123",
        apiKey: "key456",
        workspacePath: "",
      };
      const result = UpdateAgentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects overly long model string", () => {
      const input = {
        agentId: "agent123",
        apiKey: "key456",
        model: "a".repeat(101),
      };
      const result = UpdateAgentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects overly long personality string", () => {
      const input = {
        agentId: "agent123",
        apiKey: "key456",
        personality: "a".repeat(2001),
      };
      const result = UpdateAgentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("PollAgentSchema", () => {
    it("accepts valid poll input", () => {
      const input = {
        agentId: "agent123",
        agentKey: "key456",
      };
      const result = PollAgentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects empty agentKey", () => {
      const input = {
        agentId: "agent123",
        agentKey: "",
      };
      const result = PollAgentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects invalid agentId format", () => {
      const input = {
        agentId: "not-valid-id-format!",
        agentKey: "key456",
      };
      const result = PollAgentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects missing agentKey", () => {
      const input = {
        agentId: "agent123",
      };
      const result = PollAgentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
