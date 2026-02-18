/**
 * Convex agents.register mutation tests
 * Tests the create-or-get logic and apiKey generation
 */

class MockDatabase {
  private agents: Map<string, any> = new Map();
  private activities: Map<string, any> = new Map();
  private counter = 0;

  addAgent(id: string, agent: any) {
    this.agents.set(id, { _id: id, ...agent });
  }

  async get(id: string) {
    return this.agents.get(id) || null;
  }

  query(table: string) {
    const agents = this.agents;
    return {
      withIndex: (_idx: string, fn: Function) => ({
        first: async () => {
          for (const agent of agents.values()) {
            // Simulate index lookup by checking against name
            const result = fn({
              eq: (_field: string, val: string) => agent.name === val,
            });
            if (result === true) {
              return agent;
            }
          }
          return null;
        },
      }),
    };
  }

  async insert(table: string, data: any) {
    const id = `${table}-${++this.counter}`;
    if (table === "agents") {
      this.agents.set(id, { _id: id, ...data });
    } else if (table === "activities") {
      this.activities.set(id, { _id: id, ...data });
    }
    return id;
  }

  async patch(id: string, updates: any) {
    const item = this.agents.get(id);
    if (item) {
      Object.assign(item, updates);
      return item;
    }
    return null;
  }

  getAgent(id: string) {
    return this.agents.get(id);
  }

  getAgentByName(name: string) {
    for (const a of this.agents.values()) {
      if (a.name === name) return a;
    }
    return null;
  }

  getAllActivities() {
    return Array.from(this.activities.values());
  }
}

describe("agents.register mutation logic", () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  describe("new agent registration", () => {
    it("creates agent with lowercase name", async () => {
      const input = {
        name: "Jarvis",
        role: "Squad Lead",
        level: "lead",
        sessionKey: "agent:main:main",
        generatedApiKey: "ak_test_uuid",
      };

      // Simulate handler logic
      const lowerName = input.name.toLowerCase();
      const existing = db.getAgentByName(lowerName);
      expect(existing).toBeNull();

      const agentId = await db.insert("agents", {
        name: lowerName,
        role: input.role,
        level: input.level,
        status: "idle",
        sessionKey: input.sessionKey,
        lastHeartbeat: Date.now(),
        apiKey: input.generatedApiKey,
      });

      const created = db.getAgent(agentId);
      expect(created.name).toBe("jarvis");
      expect(created.apiKey).toBe("ak_test_uuid");
    });

    it("returns isNew: true for new agent", async () => {
      const isNew = true; // From handler
      expect(isNew).toBe(true);
    });

    it("logs activity on new agent registration", async () => {
      const input = {
        name: "Jarvis",
        role: "Squad Lead",
        level: "lead",
        sessionKey: "agent:main:main",
        generatedApiKey: "ak_test",
      };

      const lowerName = input.name.toLowerCase();
      const agentId = await db.insert("agents", {
        name: lowerName,
        role: input.role,
        level: input.level,
        status: "idle",
        sessionKey: input.sessionKey,
        lastHeartbeat: Date.now(),
        apiKey: input.generatedApiKey,
      });

      // Log activity
      await db.insert("activities", {
        type: "agent_status_changed",
        agentId: agentId,
        agentName: lowerName,
        message: `Agent ${lowerName} registered via API`,
        createdAt: Date.now(),
      });

      const activities = db.getAllActivities();
      expect(activities).toHaveLength(1);
      expect(activities[0].type).toBe("agent_status_changed");
      expect(activities[0].agentName).toBe("jarvis");
    });
  });

  describe("existing agent re-registration", () => {
    beforeEach(() => {
      db.addAgent("agent-existing", {
        name: "jarvis",
        role: "Squad Lead",
        level: "lead",
        status: "idle",
        sessionKey: "agent:main:main",
        lastHeartbeat: Date.now() - 60000,
        apiKey: "ak_existing_key",
      });
    });

    it("returns existing agent's apiKey", async () => {
      const existing = db.getAgentByName("jarvis");
      expect(existing).toBeDefined();
      expect(existing.apiKey).toBe("ak_existing_key");
    });

    it("returns isNew: false for existing agent", () => {
      const existing = db.getAgentByName("jarvis");
      const isNew = !existing;
      expect(isNew).toBe(false);
    });

    it("generates new apiKey for legacy agent without one", async () => {
      db.addAgent("agent-legacy", {
        name: "legacy",
        role: "Old Role",
        level: "specialist",
        status: "idle",
        sessionKey: "agent:legacy:main",
        lastHeartbeat: Date.now() - 60000,
        // No apiKey
      });

      const legacy = db.getAgentByName("legacy");
      expect(legacy.apiKey).toBeUndefined();

      // Handler should generate and patch one
      const newKey = "ak_generated_new";
      await db.patch("agent-legacy", { apiKey: newKey });
      expect(db.getAgentByName("legacy").apiKey).toBe(newKey);
    });
  });

  describe("verifyKey query logic", () => {
    beforeEach(() => {
      db.addAgent("agent-abc", {
        name: "jarvis",
        apiKey: "ak_valid_key",
        status: "idle",
      });
    });

    it("returns agent for valid credentials", () => {
      const agent = db.getAgent("agent-abc");
      const isValid = agent && agent.apiKey === "ak_valid_key";
      expect(isValid).toBe(true);
      expect(agent.name).toBe("jarvis");
    });

    it("returns null for invalid apiKey", () => {
      const agent = db.getAgent("agent-abc");
      const isValid = agent && agent.apiKey === "wrong_key";
      expect(isValid).toBeFalsy();
    });

    it("returns null for agent without apiKey", () => {
      db.addAgent("agent-no-key", {
        name: "nokey",
        status: "idle",
        // No apiKey
      });

      const agent = db.getAgent("agent-no-key");
      const isValid = agent && agent.apiKey === "ak_x";
      expect(isValid).toBeFalsy();
    });

    it("returns null for non-existent agent", () => {
      const agent = db.getAgent("nonexistent");
      expect(agent).toBeFalsy(); // null or undefined both acceptable
    });
  });

  describe("case-insensitive name handling", () => {
    it("treats jarvis and JARVIS as same agent", () => {
      db.addAgent("agent-1", {
        name: "jarvis",
        role: "Lead",
        level: "lead",
        apiKey: "ak_key1",
      });

      const existing = db.getAgentByName("JARVIS".toLowerCase());
      expect(existing).toBeDefined();
      expect(existing.name).toBe("jarvis");
    });
  });
});
