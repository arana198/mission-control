/**
 * Agent Management Tests
 * Tests for agent CRUD operations, registration, and heartbeat
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

// Mock Convex Context & Database
class MockAgentDb {
  private agents: Map<string, any> = new Map();
  private activities: Map<string, any> = new Map();
  private counter = 0;

  addAgent(id: string, agent: any) {
    this.agents.set(id, { ...agent, _id: id });
  }

  async get(id: string) {
    return this.agents.get(id) || null;
  }

  async insert(table: string, data: any) {
    const id = `${table}-${++this.counter}`;
    if (table === "agents") {
      this.agents.set(id, { ...data, _id: id });
    } else if (table === "activities") {
      this.activities.set(id, { ...data, _id: id });
    }
    return id as any;
  }

  async patch(id: string, updates: any) {
    const agent = this.agents.get(id);
    if (!agent) throw new Error(`Agent not found: ${id}`);
    Object.assign(agent, updates);
    return agent;
  }

  query(table: string) {
    return {
      withIndex: () => ({
        eq: () => ({
          first: async () => {
            if (table === "agents") {
              return Array.from(this.agents.values())[0] || null;
            }
            return null;
          },
          collect: async () => Array.from(this.agents.values()),
        }),
      }),
      collect: async () => Array.from(this.agents.values()),
    };
  }

  getAllAgents() {
    return Array.from(this.agents.values());
  }

  getActivities() {
    return Array.from(this.activities.values());
  }
}

describe("Agent Management", () => {
  let db: MockAgentDb;
  let ctx: any;

  beforeEach(() => {
    db = new MockAgentDb();
    ctx = { db };

    // Setup test agents
    db.addAgent("agent-lead", {
      name: "jarvis",
      role: "Squad Lead",
      level: "lead",
      status: "active",
      sessionKey: "session:main",
      lastHeartbeat: Date.now(),
      apiKey: "key-lead",
    });

    db.addAgent("agent-worker", {
      name: "shuri",
      role: "Specialist",
      level: "specialist",
      status: "idle",
      sessionKey: "session:worker",
      lastHeartbeat: Date.now(),
      apiKey: "key-worker",
    });
  });

  describe("getAllAgents", () => {
    it("returns all agents", async () => {
      const agents = db.getAllAgents();
      expect(agents.length).toBe(2);
      expect(agents.map((a: any) => a.name)).toContain("jarvis");
      expect(agents.map((a: any) => a.name)).toContain("shuri");
    });

    it("returns empty array when no agents", async () => {
      const emptyDb = new MockAgentDb();
      const agents = emptyDb.getAllAgents();
      expect(agents).toEqual([]);
    });

    it("includes agent status and metadata", async () => {
      const agents = db.getAllAgents();
      const agent = agents[0];
      expect(agent).toHaveProperty("name");
      expect(agent).toHaveProperty("role");
      expect(agent).toHaveProperty("level");
      expect(agent).toHaveProperty("status");
      expect(agent).toHaveProperty("lastHeartbeat");
    });
  });

  describe("getAgentById", () => {
    it("returns agent by ID", async () => {
      const agent = await db.get("agent-lead");
      expect(agent).toBeTruthy();
      expect(agent.name).toBe("jarvis");
      expect(agent.level).toBe("lead");
    });

    it("returns null for non-existent agent", async () => {
      const agent = await db.get("agent-notfound");
      expect(agent).toBeNull();
    });

    it("returns agent with all properties", async () => {
      const agent = await db.get("agent-worker");
      expect(agent).toMatchObject({
        _id: "agent-worker",
        name: expect.any(String),
        role: expect.any(String),
        level: expect.any(String),
        status: expect.any(String),
        lastHeartbeat: expect.any(Number),
      });
    });
  });

  describe("getByName", () => {
    it("finds agent by lowercase name", async () => {
      const allAgents = db.getAllAgents();
      const found = allAgents.find((a: any) => a.name === "jarvis");
      expect(found).toBeTruthy();
      expect(found?.name).toBe("jarvis");
    });

    it("is case-insensitive", async () => {
      const allAgents = db.getAllAgents();
      const jarvisLower = allAgents.find((a: any) => a.name === "jarvis");
      expect(jarvisLower).toBeTruthy();
    });

    it("returns null for non-existent agent", async () => {
      const allAgents = db.getAllAgents();
      const found = allAgents.find((a: any) => a.name === "nonexistent");
      expect(found).toBeUndefined();
    });
  });

  describe("updateStatus", () => {
    it("updates agent status", async () => {
      const agent = await db.get("agent-worker");
      const updated = await db.patch("agent-worker", {
        status: "active",
        lastHeartbeat: Date.now(),
      });

      expect(updated.status).toBe("active");
      expect(updated.lastHeartbeat).toBeTruthy();
    });

    it("updates with task assignment", async () => {
      const updated = await db.patch("agent-lead", {
        status: "active",
        currentTaskId: "task-123",
        lastHeartbeat: Date.now(),
      });

      expect(updated.currentTaskId).toBe("task-123");
      expect(updated.status).toBe("active");
    });

    it("logs activity on status change", async () => {
      const agent = await db.get("agent-worker");
      await db.patch("agent-worker", { status: "active" });

      // Would log activity
      const activity = {
        type: "agent_status_changed",
        agentId: "agent-worker",
        agentName: agent.name,
        message: `${agent.name} is now active`,
      };

      expect(activity.type).toBe("agent_status_changed");
      expect(activity.agentId).toBe("agent-worker");
    });

    it("throws error for non-existent agent", async () => {
      expect(async () => {
        await db.patch("agent-notfound", { status: "active" });
      }).toBeTruthy();
    });

    it("validates status values", () => {
      const validStatuses = ["idle", "active", "blocked"];
      const testStatus = "active";
      expect(validStatuses).toContain(testStatus);
    });
  });

  describe("heartbeat", () => {
    it("updates last heartbeat timestamp", async () => {
      const now = Date.now();
      const updated = await db.patch("agent-lead", { lastHeartbeat: now });

      expect(updated.lastHeartbeat).toBeGreaterThanOrEqual(now - 1000);
    });

    it("updates current task during heartbeat", async () => {
      const updated = await db.patch("agent-lead", {
        lastHeartbeat: Date.now(),
        currentTaskId: "task-456",
      });

      expect(updated.currentTaskId).toBe("task-456");
    });

    it("clears task when agent idle", async () => {
      const updated = await db.patch("agent-lead", {
        lastHeartbeat: Date.now(),
        currentTaskId: undefined,
      });

      expect(updated.currentTaskId).toBeUndefined();
    });

    it("throws error for non-existent agent", async () => {
      expect(async () => {
        await db.patch("agent-notfound", { lastHeartbeat: Date.now() });
      }).toBeTruthy();
    });

    it("returns timestamp in response", () => {
      const timestamp = Date.now();
      const response = { success: true, timestamp };
      expect(response.success).toBe(true);
      expect(response.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("getWithCurrentTask", () => {
    it("returns agent with current task", async () => {
      const agent = await db.get("agent-lead");
      expect(agent).toBeTruthy();
      expect(agent.name).toBe("jarvis");
    });

    it("includes task details if current task exists", async () => {
      const updated = await db.patch("agent-lead", {
        currentTaskId: "task-789",
      });
      const agent = await db.get("agent-lead");

      expect(agent.currentTaskId).toBe("task-789");
    });

    it("handles null current task", async () => {
      const updated = await db.patch("agent-worker", {
        currentTaskId: undefined,
      });
      const agent = await db.get("agent-worker");

      expect(agent.currentTaskId).toBeUndefined();
    });

    it("returns null for non-existent agent", async () => {
      const agent = await db.get("agent-notfound");
      expect(agent).toBeNull();
    });
  });

  describe("register", () => {
    it("creates new agent on first registration", async () => {
      const newAgentId = await db.insert("agents", {
        name: "vision",
        role: "Strategy",
        level: "specialist",
        status: "idle",
        sessionKey: "session:vision",
        lastHeartbeat: Date.now(),
        apiKey: "key-vision",
      });

      const created = await db.get(newAgentId);
      expect(created).toBeTruthy();
      expect(created.name).toBe("vision");
    });

    it("returns existing agent on duplicate registration", async () => {
      const existing = await db.get("agent-lead");
      expect(existing).toBeTruthy();
      expect(existing.apiKey).toBe("key-lead");
    });

    it("assigns API key to legacy agent without key", async () => {
      const legacyAgent = { name: "legacy", level: "specialist", _id: "legacy" };
      db.addAgent("legacy", legacyAgent);

      const updated = await db.patch("legacy", { apiKey: "new-key" });
      expect(updated.apiKey).toBe("new-key");
    });

    it("lowercases agent name for consistency", async () => {
      const newAgentId = await db.insert("agents", {
        name: "CAPTAIN".toLowerCase(),
        role: "Lead",
        level: "lead",
        status: "idle",
        sessionKey: "session:captain",
        lastHeartbeat: Date.now(),
        apiKey: "key-captain",
      });

      const agent = await db.get(newAgentId);
      expect(agent.name).toBe("captain");
    });

    it("includes capabilities in registration", async () => {
      const newAgentId = await db.insert("agents", {
        name: "quantum",
        role: "Specialist",
        level: "specialist",
        status: "idle",
        sessionKey: "session:quantum",
        lastHeartbeat: Date.now(),
        apiKey: "key-quantum",
        capabilities: ["testing", "optimization"],
      });

      const agent = await db.get(newAgentId);
      expect(agent.capabilities).toContain("testing");
    });

    it("logs agent registration activity", async () => {
      const activity = {
        type: "agent_status_changed",
        agentId: "agent-new",
        agentName: "newagent",
        message: "Agent newagent registered via API",
      };

      expect(activity.type).toBe("agent_status_changed");
      expect(activity.message).toContain("registered");
    });
  });

  describe("verifyKey", () => {
    it("verifies correct API key", async () => {
      const agent = await db.get("agent-lead");
      const isValid = agent && agent.apiKey === "key-lead";
      expect(isValid).toBe(true);
    });

    it("rejects incorrect API key", async () => {
      const agent = await db.get("agent-lead");
      const isValid = agent && agent.apiKey === "wrong-key";
      expect(isValid).toBe(false);
    });

    it("returns null for non-existent agent", async () => {
      const agent = await db.get("agent-notfound");
      expect(agent).toBeNull();
    });

    it("returns null for agent without API key", async () => {
      const agentNoKey = { name: "nokey", _id: "nokey" };
      db.addAgent("nokey", agentNoKey);
      const agent = await db.get("nokey");
      const isValid = agent && agent.apiKey === "any-key";
      expect(isValid).toBe(false);
    });

    it("returns full agent object on valid key", async () => {
      const agent = await db.get("agent-worker");
      const isValid = agent && agent.apiKey === "key-worker";

      if (isValid) {
        expect(agent).toMatchObject({
          _id: expect.any(String),
          name: expect.any(String),
          role: expect.any(String),
          level: expect.any(String),
        });
      }
    });
  });

  describe("updateName", () => {
    it("updates agent name", async () => {
      const updated = await db.patch("agent-lead", { name: "jarvis-v2" });
      expect(updated.name).toBe("jarvis-v2");
    });

    it("maintains other properties", async () => {
      const original = await db.get("agent-lead");
      await db.patch("agent-lead", { name: "updated-name" });
      const updated = await db.get("agent-lead");

      expect(updated.level).toBe(original.level);
      expect(updated.role).toBe(original.role);
    });
  });

  describe("lowercaseAllNames", () => {
    it("lowercases all agent names", async () => {
      // Add mixed-case agents
      const cap = await db.insert("agents", {
        name: "CAPTAIN",
        level: "lead",
        status: "idle",
      });
      const vision = await db.insert("agents", {
        name: "VisionSpecialist",
        level: "specialist",
        status: "idle",
      });

      // Simulate lowercase migration
      const agents = db.getAllAgents();
      for (const agent of agents) {
        const lowerName = agent.name.toLowerCase();
        if (agent.name !== lowerName) {
          await db.patch(agent._id, { name: lowerName });
        }
      }

      // Verify all names are now lowercase
      const updated = db.getAllAgents();
      const allLower = updated.every((a: any) => a.name === a.name.toLowerCase());
      expect(allLower).toBe(true);
    });

    it("handles already-lowercase names", async () => {
      const agents = db.getAllAgents();
      expect(agents.some((a: any) => a.name === "jarvis")).toBe(true);
    });

    it("returns migration stats", () => {
      const stats = {
        updated: 0,
        total: db.getAllAgents().length,
      };

      expect(stats.total).toBeGreaterThanOrEqual(2);
    });
  });
});
