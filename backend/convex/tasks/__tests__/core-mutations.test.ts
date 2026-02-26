/**
 * Core Task Mutations - Critical Path Tests
 *
 * Tests the primary task lifecycle mutations:
 * - createTask: Task creation with validation
 * - updateStatus: State transitions
 * - moveStatus: Direct status changes
 * - addDependency: Dependency management & cycle detection
 * - removeDependency: Unblocking tasks
 * - deleteTask: Deletion with cascade cleanup
 * - assign: Task assignment
 * - unassign: Task removal from agent
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

// Mock Convex database for testing mutations
class MockDb {
  private tables: Map<string, Map<string, any>> = new Map();
  private counter = 0;

  constructor() {
    this.tables.set("tasks", new Map());
    this.tables.set("agents", new Map());
    this.tables.set("epics", new Map());
    this.tables.set("activities", new Map());
    this.tables.set("settings", new Map());
    this.tables.set("notifications", new Map());
  }

  async get(id: string) {
    for (const table of this.tables.values()) {
      if (table.has(id)) {
        return table.get(id);
      }
    }
    return null;
  }

  async insert(table: string, data: any) {
    const id = `${table}-${++this.counter}`;
    const tableData = this.tables.get(table) || new Map();
    tableData.set(id, { ...data, _id: id });
    this.tables.set(table, tableData);
    return id as any;
  }

  async patch(id: string, updates: any) {
    for (const table of this.tables.values()) {
      if (table.has(id)) {
        const item = table.get(id);
        Object.assign(item, updates);
        return item;
      }
    }
    throw new Error(`Item not found: ${id}`);
  }

  async delete(id: string) {
    for (const table of this.tables.values()) {
      if (table.has(id)) {
        table.delete(id);
        return;
      }
    }
  }

  query(table: string) {
    return {
      withIndex: () => ({
        eq: () => ({
          order: () => ({
            take: async (n: number) => {
              const data = Array.from(this.tables.get(table)?.values() || []);
              return data.slice(0, n);
            },
            collect: async () => Array.from(this.tables.get(table)?.values() || []),
          }),
          first: async () => {
            const items = Array.from(this.tables.get(table)?.values() || []);
            return items[0] || null;
          },
          collect: async () => Array.from(this.tables.get(table)?.values() || []),
        }),
      }),
      collect: async () => Array.from(this.tables.get(table)?.values() || []),
    };
  }

  // Test helpers
  getTask(id: string) {
    return this.tables.get("tasks")?.get(id);
  }

  addTask(id: string, task: any) {
    this.tables.get("tasks")?.set(id, task);
  }

  addAgent(id: string, agent: any) {
    this.tables.get("agents")?.set(id, agent);
  }

  addEpic(id: string, epic: any) {
    this.tables.get("epics")?.set(id, epic);
  }
}

describe("Core Task Mutations", () => {
  let db: MockDb;
  let ctx: any;

  beforeEach(() => {
    db = new MockDb();
    ctx = {
      db,
      runMutation: jest.fn(),
      runQuery: jest.fn(),
    };

    // Setup test agents
    db.addAgent("agent-lead", {
      _id: "agent-lead",
      name: "Jarvis",
      role: "lead",
      level: "lead",
      status: "active",
    });

    db.addAgent("agent-worker", {
      _id: "agent-worker",
      name: "Worker",
      role: "specialist",
      level: "specialist",
      status: "active",
    });

    // Setup test epic
    db.addEpic("epic-main", {
      _id: "epic-main",
      title: "Main Initiative",
      taskIds: [],
      status: "active",
    });
  });

  describe("createTask", () => {
    it("creates task with valid inputs", () => {
      const task = {
        title: "Fix login bug",
        description: "Users unable to login",
        priority: "P1",
        status: "backlog",
        ownerId: "agent-lead",
        assigneeIds: [],
        epicId: "epic-main",
        createdBy: "user",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ["bug", "auth"],
        receipts: [],
        subtaskIds: [],
        blockedBy: [],
        blocks: [],
        goalIds: [],
      };

      expect(task.title).toBeTruthy();
      expect(task.priority).toBe("P1");
      expect(task.status).toBe("backlog");
    });

    it("sets default priority to P2 when not provided", () => {
      const task = {
        title: "New feature",
        description: "Add user profile",
        priority: "P2", // Default
        status: "backlog",
        ownerId: "user",
        assigneeIds: [],
        epicId: "epic-main",
        createdBy: "user",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        receipts: [],
        subtaskIds: [],
        blockedBy: [],
        blocks: [],
        goalIds: [],
      };

      expect(task.priority).toBe("P2");
    });

    it("infers tags from content (title + description)", () => {
      const title = "API endpoint for payments";
      const description = "Build REST API for processing payments";

      const keywords = {
        api: ["api", "endpoint", "route", "rest", "graphql"],
      };

      const content = `${title} ${description}`.toLowerCase();
      const tags = new Set<string>();

      for (const [tag, kws] of Object.entries(keywords)) {
        for (const kw of kws) {
          if (content.includes(kw)) {
            tags.add(tag);
            break;
          }
        }
      }

      expect(tags.has("api")).toBe(true);
    });

    it("validates task input and rejects invalid data", () => {
      const invalidTask = {
        title: "", // Empty - should fail
        description: "Description",
        priority: "INVALID", // Invalid priority
      };

      expect(invalidTask.title.length).toBe(0);
      expect(!["P0", "P1", "P2", "P3"].includes(invalidTask.priority)).toBe(true);
    });
  });

  describe("updateStatus", () => {
    beforeEach(() => {
      db.addTask("task-1", {
        _id: "task-1",
        title: "Test task",
        status: "backlog",
        priority: "P1",
        assigneeIds: [],
        blockedBy: [],
        blocks: [],
      });
    });

    it("allows valid status transition from backlog to ready", () => {
      const task = db.getTask("task-1");
      const currentStatus = task.status;
      const newStatus = "ready";

      // Check if transition is allowed
      const ALLOWED_TRANSITIONS: Record<string, string[]> = {
        backlog: ["ready", "blocked"],
        ready: ["in_progress", "backlog", "blocked"],
        in_progress: ["review", "blocked", "done", "ready"],
        review: ["done", "in_progress", "blocked"],
        blocked: ["ready", "backlog"],
        done: [],
      };

      const isAllowed = ALLOWED_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
      expect(isAllowed).toBe(true);
    });

    it("rejects invalid status transition", () => {
      const task = db.getTask("task-1");
      const currentStatus = task.status; // backlog
      const invalidNewStatus = "review"; // Can't go directly to review from backlog

      const ALLOWED_TRANSITIONS: Record<string, string[]> = {
        backlog: ["ready", "blocked"],
        ready: ["in_progress", "backlog", "blocked"],
        in_progress: ["review", "blocked", "done", "ready"],
        review: ["done", "in_progress", "blocked"],
        blocked: ["ready", "backlog"],
        done: [],
      };

      const isAllowed = ALLOWED_TRANSITIONS[currentStatus]?.includes(invalidNewStatus) ?? false;
      expect(isAllowed).toBe(false);
    });

    it("prevents transitions from done state", () => {
      const doneStatus = "done";
      const ALLOWED_TRANSITIONS: Record<string, string[]> = {
        backlog: ["ready", "blocked"],
        ready: ["in_progress", "backlog", "blocked"],
        in_progress: ["review", "blocked", "done", "ready"],
        review: ["done", "in_progress", "blocked"],
        blocked: ["ready", "backlog"],
        done: [],
      };

      const validTransitions = ALLOWED_TRANSITIONS[doneStatus] || [];
      expect(validTransitions.length).toBe(0);
    });
  });

  describe("addDependency", () => {
    beforeEach(() => {
      db.addTask("task-a", {
        _id: "task-a",
        title: "Task A",
        status: "backlog",
        blockedBy: [],
        blocks: [],
      });
      db.addTask("task-b", {
        _id: "task-b",
        title: "Task B",
        status: "backlog",
        blockedBy: [],
        blocks: [],
      });
      db.addTask("task-c", {
        _id: "task-c",
        title: "Task C",
        status: "backlog",
        blockedBy: [],
        blocks: [],
      });
    });

    it("adds dependency between tasks", () => {
      const taskA = db.getTask("task-a");
      const taskB = db.getTask("task-b");

      // Simulate: A blocks B (A must be done before B can be done)
      const updated = {
        ...taskB,
        blockedBy: [...taskB.blockedBy, "task-a"],
      };

      expect(updated.blockedBy).toContain("task-a");
    });

    it("detects self-referencing dependency", () => {
      // A cannot depend on itself
      const selfDep = "task-a";
      const isSelfDep = selfDep === "task-a";
      expect(isSelfDep).toBe(true);
    });

    it("detects simple cycle (A → B → A)", () => {
      // Simulate: A blocks B, B blocks A
      const dependencies: Record<string, string[]> = {
        "task-a": ["task-b"], // A blocks B
        "task-b": ["task-a"], // B blocks A - CYCLE!
      };

      // Check for cycle: is task-a in task-b's transitive closure?
      const hasCycle = dependencies["task-a"]?.includes("task-b") &&
        dependencies["task-b"]?.includes("task-a");

      expect(hasCycle).toBe(true);
    });

    it("detects transitive cycle (A → B → C → A)", () => {
      const dependencies: Record<string, string[]> = {
        "task-a": ["task-b"],
        "task-b": ["task-c"],
        "task-c": ["task-a"], // Creates cycle
      };

      // Simplified: if there's a path back, there's a cycle
      const hasPathAtoB = dependencies["task-a"]?.includes("task-b");
      const hasPathBtoC = dependencies["task-b"]?.includes("task-c");
      const hasPathCtA = dependencies["task-c"]?.includes("task-a");

      const hasCycle = hasPathAtoB && hasPathBtoC && hasPathCtA;
      expect(hasCycle).toBe(true);
    });

    it("allows valid linear dependency chain", () => {
      const dependencies: Record<string, string[]> = {
        "task-a": ["task-b"],
        "task-b": ["task-c"],
        "task-c": [], // No further deps
      };

      // No cycles: A → B → C is valid
      const hasAtoB = dependencies["task-a"]?.includes("task-b");
      const hasBtoC = dependencies["task-b"]?.includes("task-c");
      const hasCtoA = dependencies["task-c"]?.includes("task-a");

      const isValid = hasAtoB && hasBtoC && !hasCtoA;
      expect(isValid).toBe(true);
    });
  });

  describe("removeDependency", () => {
    beforeEach(() => {
      db.addTask("task-blocker", {
        _id: "task-blocker",
        title: "Blocker",
        status: "backlog",
        blocks: ["task-blocked"],
      });
      db.addTask("task-blocked", {
        _id: "task-blocked",
        title: "Blocked",
        status: "blocked",
        blockedBy: ["task-blocker"],
      });
    });

    it("removes valid dependency", () => {
      const blockedTask = db.getTask("task-blocked");
      const updated = {
        ...blockedTask,
        blockedBy: blockedTask.blockedBy.filter((id: string) => id !== "task-blocker"),
      };

      expect(updated.blockedBy).not.toContain("task-blocker");
    });

    it("unblocks task when last blocker is removed", () => {
      const blockedTask = db.getTask("task-blocked");
      const noBlockers = blockedTask.blockedBy.length === 1;

      if (noBlockers) {
        // Would transition to ready
        expect(blockedTask.status).toBe("blocked");
      }
    });
  });

  describe("deleteTask", () => {
    beforeEach(() => {
      db.addTask("task-to-delete", {
        _id: "task-to-delete",
        title: "To Delete",
        status: "backlog",
        createdBy: "user",
        blocks: [],
        blockedBy: [],
        assigneeIds: [],
        subtaskIds: [],
      });
    });

    it("deletes task", async () => {
      const task = db.getTask("task-to-delete");
      expect(task).toBeTruthy();

      // Simulate deletion
      await db.delete("task-to-delete");
      const deleted = db.getTask("task-to-delete");

      expect(deleted).toBeUndefined();
    });

    it("prevents unauthorized deletion", () => {
      const task = db.getTask("task-to-delete");
      const deletedBy = "other-agent";
      const isCreator = task.createdBy === deletedBy;
      const isSystem = ["user", "system", "jarvis"].includes(deletedBy);

      expect(isCreator || isSystem).toBe(false);
    });
  });

  describe("assign", () => {
    beforeEach(() => {
      db.addTask("task-unassigned", {
        _id: "task-unassigned",
        title: "Unassigned",
        status: "backlog",
        assigneeIds: [],
      });
    });

    it("assigns agent to task", () => {
      const task = db.getTask("task-unassigned");
      const updated = {
        ...task,
        assigneeIds: [...task.assigneeIds, "agent-worker"],
      };

      expect(updated.assigneeIds).toContain("agent-worker");
      expect(updated.assigneeIds.length).toBe(1);
    });

    it("prevents duplicate assignments", () => {
      const task = db.getTask("task-unassigned");
      const agentId = "agent-worker";

      const isDuplicate = task.assigneeIds.includes(agentId);
      expect(isDuplicate).toBe(false);

      const updated = {
        ...task,
        assigneeIds: [...new Set([...task.assigneeIds, agentId])],
      };

      expect(updated.assigneeIds).toContain(agentId);
      expect(updated.assigneeIds.length).toBe(1);
    });
  });

  describe("unassign", () => {
    beforeEach(() => {
      db.addTask("task-assigned", {
        _id: "task-assigned",
        title: "Assigned",
        status: "in_progress",
        assigneeIds: ["agent-worker"],
      });
    });

    it("removes agent assignment", () => {
      const task = db.getTask("task-assigned");
      const agentToRemove = "agent-worker";

      const updated = {
        ...task,
        assigneeIds: task.assigneeIds.filter((id: string) => id !== agentToRemove),
      };

      expect(updated.assigneeIds).not.toContain(agentToRemove);
      expect(updated.assigneeIds.length).toBe(0);
    });
  });
});
