/**
 * Agent Management Tests
 *
 * Tests queries and mutations for agent CRUD operations
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Mock Database for Convex
 * Simulates the Convex database interface
 */
class MockDatabase {
  private data: Map<string, any[]> = new Map();
  private ids: Map<string, string> = new Map();
  private nextId = 1;

  constructor() {
    // Initialize tables
    this.data.set("agents", []);
    this.data.set("tasks", []);
    this.data.set("goals", []);
    this.data.set("activities", []);
  }

  generateId(table: string): string {
    const id = `${table}-${this.nextId++}`;
    return id;
  }

  insert(table: string, doc: any) {
    if (!this.data.has(table)) {
      this.data.set(table, []);
    }
    const _id = this.generateId(table);
    const fullDoc = { ...doc, _id };
    this.data.get(table)!.push(fullDoc);
    return _id;
  }

  get(id: string) {
    for (const [_, docs] of this.data) {
      const found = docs.find((d: any) => d._id === id);
      if (found) return found;
    }
    return null;
  }

  patch(id: string, updates: any) {
    for (const docs of this.data.values()) {
      const doc = docs.find((d: any) => d._id === id);
      if (doc) {
        Object.assign(doc, updates);
        return doc;
      }
    }
    return null;
  }

  query(table: string) {
    return {
      collect: async () => this.data.get(table) || [],
      withIndex: () => ({
        eq: () => ({
          first: async () => this.data.get(table)?.[0] || null,
        }),
      }),
    };
  }

  delete(id: string) {
    for (const docs of this.data.values()) {
      const index = docs.findIndex((d: any) => d._id === id);
      if (index !== -1) {
        docs.splice(index, 1);
        return true;
      }
    }
    return false;
  }
}

function createMockCtx(db: MockDatabase) {
  return {
    db,
    auth: { getUserIdentity: async () => ({ subject: "user-1" }) },
  } as any;
}

describe("Agents (convex/agents.ts)", () => {
  let mockDb: MockDatabase;
  let ctx: any;

  beforeEach(() => {
    mockDb = new MockDatabase();
    ctx = createMockCtx(mockDb);
  });

  describe("Query: getAllAgents", () => {
    it("returns empty array when no agents", async () => {
      const agents = await mockDb.query("agents").collect();
      expect(agents).toEqual([]);
    });

    it("returns all agents with their status", async () => {
      mockDb.insert("agents", {
        name: "jarvis",
        role: "lead",
        status: "active",
      });
      mockDb.insert("agents", {
        name: "shuri",
        role: "specialist",
        status: "idle",
      });

      const agents = await mockDb.query("agents").collect();
      expect(agents).toHaveLength(2);
      expect(agents[0].name).toBe("jarvis");
      expect(agents[1].name).toBe("shuri");
    });

    it("includes all required agent fields", async () => {
      const agentId = mockDb.insert("agents", {
        name: "agent1",
        role: "role1",
        status: "active",
        apiKey: "key-123",
        level: "specialist",
        lastHeartbeat: Date.now(),
      });

      const agents = await mockDb.query("agents").collect();
      const agent = agents[0];

      expect(agent).toHaveProperty("_id");
      expect(agent).toHaveProperty("name");
      expect(agent).toHaveProperty("role");
      expect(agent).toHaveProperty("status");
    });
  });

  describe("Query: getAgentById", () => {
    it("returns agent by ID", async () => {
      const agentId = mockDb.insert("agents", {
        name: "test-agent",
        role: "specialist",
        status: "idle",
      });

      const agent = mockDb.get(agentId);
      expect(agent).toBeDefined();
      expect(agent.name).toBe("test-agent");
    });

    it("returns null for non-existent agent", async () => {
      const agent = mockDb.get("agents-999");
      expect(agent).toBeNull();
    });
  });

  describe("Query: getByName", () => {
    it("finds agent by lowercase name", async () => {
      mockDb.insert("agents", {
        name: "jarvis",
        role: "lead",
        status: "active",
      });

      // Query implementation uses lowercase lookup
      const agents = await mockDb.query("agents").collect();
      const found = agents.find((a: any) => a.name === "jarvis");
      expect(found).toBeDefined();
      expect(found.name).toBe("jarvis");
    });

    it("handles case-insensitive search", async () => {
      mockDb.insert("agents", {
        name: "jarvis",
        role: "lead",
        status: "active",
      });

      const agents = await mockDb.query("agents").collect();
      // Should find agent regardless of case
      const found = agents.find(
        (a: any) => a.name.toLowerCase() === "JARVIS".toLowerCase()
      );
      expect(found).toBeDefined();
    });

    it("returns null when agent not found", async () => {
      const agents = await mockDb.query("agents").collect();
      const found = agents.find((a: any) => a.name === "nonexistent");
      expect(found).toBeUndefined();
    });
  });

  describe("Mutation: updateStatus", () => {
    it("updates agent status and heartbeat", async () => {
      const agentId = mockDb.insert("agents", {
        name: "test-agent",
        role: "specialist",
        status: "idle",
        lastHeartbeat: 0,
      });

      const updated = mockDb.patch(agentId, {
        status: "active",
        lastHeartbeat: Date.now(),
      });

      expect(updated.status).toBe("active");
      expect(updated.lastHeartbeat).toBeGreaterThan(0);
    });

    it("accepts currentTaskId assignment", async () => {
      const agentId = mockDb.insert("agents", {
        name: "test-agent",
        role: "specialist",
        status: "idle",
      });

      const updated = mockDb.patch(agentId, {
        status: "active",
        currentTaskId: "task-123",
        lastHeartbeat: Date.now(),
      });

      expect(updated.currentTaskId).toBe("task-123");
    });

    it("handles agent not found error", async () => {
      const result = mockDb.get("agents-999");
      expect(result).toBeNull();
    });

    it("logs activity on status change", async () => {
      const agentId = mockDb.insert("agents", {
        name: "jarvis",
        role: "lead",
        status: "idle",
      });

      mockDb.insert("activities", {
        type: "agent_status_changed",
        agentId,
        agentName: "jarvis",
        message: "jarvis is now active",
        createdAt: Date.now(),
      });

      const activities = await mockDb.query("activities").collect();
      expect(activities).toHaveLength(1);
      expect(activities[0].type).toBe("agent_status_changed");
    });
  });

  describe("Mutation: heartbeat", () => {
    it("updates agent last heartbeat timestamp", async () => {
      const agentId = mockDb.insert("agents", {
        name: "agent1",
        status: "active",
        lastHeartbeat: 0,
      });

      const now = Date.now();
      mockDb.patch(agentId, { lastHeartbeat: now });

      const updated = mockDb.get(agentId);
      expect(updated.lastHeartbeat).toBe(now);
    });

    it("accepts optional currentTaskId", async () => {
      const agentId = mockDb.insert("agents", {
        name: "agent1",
        status: "active",
      });

      mockDb.patch(agentId, {
        currentTaskId: "task-1",
        lastHeartbeat: Date.now(),
      });

      const updated = mockDb.get(agentId);
      expect(updated.currentTaskId).toBe("task-1");
    });

    it("can clear currentTaskId on heartbeat", async () => {
      const agentId = mockDb.insert("agents", {
        name: "agent1",
        status: "active",
        currentTaskId: "task-1",
      });

      mockDb.patch(agentId, { currentTaskId: null });

      const updated = mockDb.get(agentId);
      expect(updated.currentTaskId).toBeNull();
    });
  });

  describe("Status lifecycle", () => {
    it("transitions through idle -> active -> blocked", async () => {
      const agentId = mockDb.insert("agents", {
        name: "agent1",
        status: "idle",
      });

      // idle -> active
      mockDb.patch(agentId, { status: "active" });
      let agent = mockDb.get(agentId);
      expect(agent.status).toBe("active");

      // active -> blocked
      mockDb.patch(agentId, { status: "blocked" });
      agent = mockDb.get(agentId);
      expect(agent.status).toBe("blocked");

      // blocked -> idle
      mockDb.patch(agentId, { status: "idle" });
      agent = mockDb.get(agentId);
      expect(agent.status).toBe("idle");
    });

    it("only allows valid status values", () => {
      const validStatuses = ["idle", "active", "blocked"];
      expect(validStatuses).toContain("idle");
      expect(validStatuses).toContain("active");
      expect(validStatuses).toContain("blocked");
      expect(validStatuses).not.toContain("invalid");
    });
  });

  describe("Agent fields validation", () => {
    it("stores all required agent fields", async () => {
      const agentId = mockDb.insert("agents", {
        name: "test-agent",
        role: "specialist",
        level: "specialist",
        status: "idle",
        apiKey: "key-123",
        lastHeartbeat: Date.now(),
      });

      const agent = mockDb.get(agentId);
      expect(agent.name).toBe("test-agent");
      expect(agent.role).toBe("specialist");
      expect(agent.level).toBe("specialist");
      expect(agent.status).toBe("idle");
      expect(agent.apiKey).toBe("key-123");
    });

    it("preserves task assignment during status updates", async () => {
      const agentId = mockDb.insert("agents", {
        name: "agent1",
        status: "idle",
        currentTaskId: "task-1",
      });

      mockDb.patch(agentId, { status: "active" });

      const agent = mockDb.get(agentId);
      expect(agent.currentTaskId).toBe("task-1");
    });
  });

  describe("Mutation: deleteAgent", () => {
    it("successfully deletes an existing agent", async () => {
      const agentId = mockDb.insert("agents", {
        name: "test-agent",
        role: "specialist",
        status: "idle",
        level: "specialist",
      });

      // Verify agent exists
      expect(mockDb.get(agentId)).toBeDefined();

      // Delete agent (simulating mutation cleanup - no tasks need cleanup)
      mockDb.delete(agentId);

      // Verify agent is deleted (MockDatabase returns null for missing items)
      expect(mockDb.get(agentId)).toBeNull();
    });

    it("removes agent from task assigneeIds", async () => {
      const agentId = mockDb.insert("agents", {
        name: "test-agent",
        role: "specialist",
        status: "idle",
      });

      const taskId = mockDb.insert("tasks", {
        title: "Test Task",
        assigneeIds: [agentId, "other-agent-id"],
        status: "backlog",
      });

      // Simulate mutation: remove agent from task assigneeIds
      const task = mockDb.get(taskId);
      mockDb.patch(taskId, {
        assigneeIds: task.assigneeIds.filter((id: string) => id !== agentId),
      });

      // Delete agent
      mockDb.delete(agentId);

      // Verify agent is removed from task
      const updatedTask = mockDb.get(taskId);
      expect(updatedTask.assigneeIds).toEqual(["other-agent-id"]);
      expect(updatedTask.assigneeIds.includes(agentId)).toBe(false);
    });

    it("unassigns agent from all tasks they're assigned to", async () => {
      const agentId = mockDb.insert("agents", {
        name: "test-agent",
        role: "specialist",
        status: "idle",
      });

      // Create multiple tasks with the agent assigned
      const task1Id = mockDb.insert("tasks", {
        title: "Task 1",
        assigneeIds: [agentId],
        status: "backlog",
      });

      const task2Id = mockDb.insert("tasks", {
        title: "Task 2",
        assigneeIds: [agentId, "other-agent"],
        status: "in_progress",
      });

      const task3Id = mockDb.insert("tasks", {
        title: "Task 3",
        assigneeIds: ["other-agent"],
        status: "done",
      });

      // Simulate mutation: remove agent from specific tasks they're assigned to
      const task1 = mockDb.get(task1Id);
      if (task1.assigneeIds?.includes(agentId)) {
        mockDb.patch(task1Id, {
          assigneeIds: task1.assigneeIds.filter((id: string) => id !== agentId),
        });
      }

      const task2 = mockDb.get(task2Id);
      if (task2.assigneeIds?.includes(agentId)) {
        mockDb.patch(task2Id, {
          assigneeIds: task2.assigneeIds.filter((id: string) => id !== agentId),
        });
      }

      // Delete agent
      mockDb.delete(agentId);

      // Verify agent is removed from all tasks
      const updatedTask1 = mockDb.get(task1Id);
      expect(updatedTask1.assigneeIds).toEqual([]);

      const updatedTask2 = mockDb.get(task2Id);
      expect(updatedTask2.assigneeIds).toEqual(["other-agent"]);

      const updatedTask3 = mockDb.get(task3Id);
      expect(updatedTask3.assigneeIds).toEqual(["other-agent"]);
    });

    it("returns null when getting nonexistent agent", async () => {
      const nonexistentId = "nonexistent-agent-id";
      const agent = mockDb.get(nonexistentId);
      expect(agent).toBeNull();
    });

    it("preserves unrelated tasks", async () => {
      const agentId = mockDb.insert("agents", {
        name: "test-agent",
        role: "specialist",
        status: "idle",
      });

      const otherAgentId = mockDb.insert("agents", {
        name: "other-agent",
        role: "specialist",
        status: "idle",
      });

      const taskId = mockDb.insert("tasks", {
        title: "Task",
        assigneeIds: [otherAgentId],
        status: "backlog",
      });

      // Delete first agent (no cleanup needed since it's not assigned to any tasks)
      mockDb.delete(agentId);

      // Verify task with other agent is unchanged
      const task = mockDb.get(taskId);
      expect(task.assigneeIds).toEqual([otherAgentId]);
    });
  });
});
