import {
  RegisterAgentSchema,
  PollAgentSchema,
  CompleteTaskSchema,
  HeartbeatSchema,
  validateAgentInput,
} from "../agentValidators";

describe("agentValidators", () => {
  describe("RegisterAgentSchema", () => {
    it("accepts valid registration input", () => {
      const result = RegisterAgentSchema.safeParse({
        name: "jarvis",
        role: "Squad Lead",
        level: "lead",
        sessionKey: "agent:main:main",
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional fields", () => {
      const result = RegisterAgentSchema.safeParse({
        name: "jarvis",
        role: "Squad Lead",
        level: "lead",
        sessionKey: "agent:main:main",
        capabilities: ["planning", "coding"],
        model: "gpt-4",
        personality: "helpful",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.capabilities).toEqual(["planning", "coding"]);
      }
    });

    it("rejects name below min length", () => {
      const result = RegisterAgentSchema.safeParse({
        name: "j",
        role: "Lead",
        level: "lead",
        sessionKey: "k",
      });
      expect(result.success).toBe(false);
    });

    it("rejects name above max length", () => {
      const result = RegisterAgentSchema.safeParse({
        name: "a".repeat(51),
        role: "Lead",
        level: "lead",
        sessionKey: "k",
      });
      expect(result.success).toBe(false);
    });

    it("rejects name not starting with letter", () => {
      const result = RegisterAgentSchema.safeParse({
        name: "123agent",
        role: "Lead",
        level: "lead",
        sessionKey: "k",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid level enum", () => {
      const result = RegisterAgentSchema.safeParse({
        name: "jarvis",
        role: "Lead",
        level: "god",
        sessionKey: "k",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing required fields", () => {
      const result = RegisterAgentSchema.safeParse({
        name: "jarvis",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("PollAgentSchema", () => {
    it("accepts valid poll input", () => {
      const result = PollAgentSchema.safeParse({
        agentId: "abc123def456",
        agentKey: "ak_abc123_xyz",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty agentKey", () => {
      const result = PollAgentSchema.safeParse({
        agentId: "abc123",
        agentKey: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid agentId format", () => {
      const result = PollAgentSchema.safeParse({
        agentId: "ABC-123_XYZ",  // uppercase and special chars
        agentKey: "ak_x",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing agentKey", () => {
      const result = PollAgentSchema.safeParse({
        agentId: "abc123",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("CompleteTaskSchema", () => {
    it("accepts valid completion input", () => {
      const result = CompleteTaskSchema.safeParse({
        agentId: "abc123",
        agentKey: "ak_x",
        taskId: "def456",
      });
      expect(result.success).toBe(true);
    });

    it("defaults status to done", () => {
      const result = CompleteTaskSchema.safeParse({
        agentId: "abc123",
        agentKey: "ak_x",
        taskId: "def456",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("done");
      }
    });

    it("accepts status review", () => {
      const result = CompleteTaskSchema.safeParse({
        agentId: "abc123",
        agentKey: "ak_x",
        taskId: "def456",
        status: "review",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid status", () => {
      const result = CompleteTaskSchema.safeParse({
        agentId: "abc123",
        agentKey: "ak_x",
        taskId: "def456",
        status: "pending",
      });
      expect(result.success).toBe(false);
    });

    it("accepts optional completionNotes", () => {
      const result = CompleteTaskSchema.safeParse({
        agentId: "abc123",
        agentKey: "ak_x",
        taskId: "def456",
        completionNotes: "Successfully fixed the bug",
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional timeSpent", () => {
      const result = CompleteTaskSchema.safeParse({
        agentId: "abc123",
        agentKey: "ak_x",
        taskId: "def456",
        timeSpent: 30,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative timeSpent", () => {
      const result = CompleteTaskSchema.safeParse({
        agentId: "abc123",
        agentKey: "ak_x",
        taskId: "def456",
        timeSpent: -5,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing taskId", () => {
      const result = CompleteTaskSchema.safeParse({
        agentId: "abc123",
        agentKey: "ak_x",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("HeartbeatSchema", () => {
    it("accepts valid heartbeat", () => {
      const result = HeartbeatSchema.safeParse({
        agentId: "abc123",
        agentKey: "ak_x",
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional currentTaskId", () => {
      const result = HeartbeatSchema.safeParse({
        agentId: "abc123",
        agentKey: "ak_x",
        currentTaskId: "task789",
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional status", () => {
      const result = HeartbeatSchema.safeParse({
        agentId: "abc123",
        agentKey: "ak_x",
        status: "active",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid status value", () => {
      const result = HeartbeatSchema.safeParse({
        agentId: "abc123",
        agentKey: "ak_x",
        status: "zombie",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing agentKey", () => {
      const result = HeartbeatSchema.safeParse({
        agentId: "abc123",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("validateAgentInput", () => {
    it("returns parsed data on success", () => {
      const input = {
        name: "jarvis",
        role: "Lead",
        level: "lead",
        sessionKey: "k",
      };
      const result = validateAgentInput(RegisterAgentSchema, input);
      expect(result.name).toBe("jarvis");
    });

    it("throws ZodError on invalid input", () => {
      const input = {
        name: "j",  // too short
        role: "Lead",
        level: "lead",
        sessionKey: "k",
      };
      expect(() => validateAgentInput(RegisterAgentSchema, input)).toThrow();
    });
  });
});
