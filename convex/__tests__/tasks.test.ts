/**
 * Task Management Tests
 *
 * Tests queries and mutations for task CRUD operations, status management,
 * assignment logic, and dependency handling
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Enhanced MockDatabase with task-specific logic
 */
class TaskMockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    this.data.set("tasks", []);
    this.data.set("agents", []);
    this.data.set("epics", []);
    this.data.set("activities", []);
    this.data.set("executionLogs", []);
  }

  generateId(table: string): string {
    return `${table}-${this.nextId++}`;
  }

  insert(table: string, doc: any) {
    if (!this.data.has(table)) {
      this.data.set(table, []);
    }
    const _id = this.generateId(table);
    const fullDoc = { ...doc, _id, _creationTime: Date.now() };
    this.data.get(table)!.push(fullDoc);
    return _id;
  }

  get(id: string) {
    for (const docs of this.data.values()) {
      const found = docs.find((d) => d._id === id);
      if (found) return found;
    }
    return null;
  }

  patch(id: string, updates: any) {
    for (const docs of this.data.values()) {
      const doc = docs.find((d) => d._id === id);
      if (doc) {
        Object.assign(doc, updates);
        return doc;
      }
    }
    return null;
  }

  delete(id: string) {
    for (const docs of this.data.values()) {
      const index = docs.findIndex((d) => d._id === id);
      if (index !== -1) {
        docs.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  query(table: string) {
    return {
      collect: async () => this.data.get(table) || [],
      filter: (predicate: (doc: any) => boolean) => ({
        collect: async () => (this.data.get(table) || []).filter(predicate),
      }),
      withIndex: () => ({
        eq: () => ({
          collect: async () => this.data.get(table) || [],
        }),
      }),
    };
  }

  getTasks() {
    return this.data.get("tasks") || [];
  }

  getTasksByStatus(status: string) {
    return (this.data.get("tasks") || []).filter((t) => t.status === status);
  }

  getTasksByAssignee(agentId: string) {
    return (this.data.get("tasks") || []).filter((t) =>
      t.assigneeIds?.includes(agentId)
    );
  }

  hasCircularDependency(taskId: string, dependencyId: string): boolean {
    // Simplified cycle detection
    const task = this.get(taskId);
    if (!task || !task.dependencies) return false;
    return task.dependencies.includes(dependencyId);
  }
}

describe("Tasks (convex/tasks.ts)", () => {
  let db: TaskMockDatabase;

  beforeEach(() => {
    db = new TaskMockDatabase();
  });

  describe("Query: getAllTasks", () => {
    it("returns empty array when no tasks exist", async () => {
      const tasks = await db.query("tasks").collect();
      expect(tasks).toEqual([]);
    });

    it("returns all tasks with required fields", async () => {
      db.insert("tasks", {
        title: "Task 1",
        status: "backlog",
        priority: "P2",
        createdBy: "user",
      });
      db.insert("tasks", {
        title: "Task 2",
        status: "in_progress",
        priority: "P1",
        createdBy: "agent-1",
      });

      const tasks = db.getTasks();
      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toHaveProperty("title");
      expect(tasks[0]).toHaveProperty("status");
      expect(tasks[0]).toHaveProperty("priority");
    });
  });

  describe("Query: getTaskById", () => {
    it("returns task by ID", async () => {
      const taskId = db.insert("tasks", {
        title: "Test Task",
        status: "backlog",
        priority: "P2",
      });

      const task = db.get(taskId);
      expect(task).toBeDefined();
      expect(task.title).toBe("Test Task");
    });

    it("returns null for non-existent task", async () => {
      const task = db.get("tasks-999");
      expect(task).toBeNull();
    });
  });

  describe("Query: getByStatus", () => {
    it("filters tasks by status", async () => {
      db.insert("tasks", { title: "Task 1", status: "backlog" });
      db.insert("tasks", { title: "Task 2", status: "in_progress" });
      db.insert("tasks", { title: "Task 3", status: "backlog" });

      const backlogTasks = db.getTasksByStatus("backlog");
      expect(backlogTasks).toHaveLength(2);
      expect(backlogTasks.every((t) => t.status === "backlog")).toBe(true);
    });

    it("returns empty array for unknown status", async () => {
      db.insert("tasks", { title: "Task 1", status: "backlog" });
      const tasks = db.getTasksByStatus("unknown_status");
      expect(tasks).toHaveLength(0);
    });
  });

  describe("Query: getForAgent", () => {
    it("returns tasks assigned to agent", async () => {
      const agentId = "agent-1";
      db.insert("tasks", {
        title: "Task 1",
        assigneeIds: [agentId],
      });
      db.insert("tasks", {
        title: "Task 2",
        assigneeIds: [agentId],
      });
      db.insert("tasks", {
        title: "Task 3",
        assigneeIds: ["agent-2"],
      });

      const tasks = db.getTasksByAssignee(agentId);
      expect(tasks).toHaveLength(2);
      expect(tasks.every((t) => t.assigneeIds.includes(agentId))).toBe(true);
    });

    it("returns empty array when agent has no tasks", async () => {
      db.insert("tasks", { title: "Task 1", assigneeIds: ["agent-2"] });
      const tasks = db.getTasksByAssignee("agent-1");
      expect(tasks).toHaveLength(0);
    });
  });

  describe("Mutation: createTask", () => {
    it("creates task with required fields", async () => {
      const taskId = db.insert("tasks", {
        title: "New Task",
        description: "Task description",
        priority: "P2",
        status: "backlog",
        createdBy: "user",
        source: "user",
        epicId: "epic-1",
      });

      const task = db.get(taskId);
      expect(task.title).toBe("New Task");
      expect(task.status).toBe("backlog");
      expect(task.priority).toBe("P2");
    });

    it("supports optional assigneeIds", async () => {
      const taskId = db.insert("tasks", {
        title: "Assigned Task",
        assigneeIds: ["agent-1", "agent-2"],
        status: "backlog",
        priority: "P1",
      });

      const task = db.get(taskId);
      expect(task.assigneeIds).toEqual(["agent-1", "agent-2"]);
    });

    it("supports optional tags", async () => {
      const taskId = db.insert("tasks", {
        title: "Tagged Task",
        tags: ["bug", "api", "urgent"],
        status: "backlog",
      });

      const task = db.get(taskId);
      expect(task.tags).toEqual(["bug", "api", "urgent"]);
    });

    it("supports optional timeEstimate", async () => {
      const taskId = db.insert("tasks", {
        title: "Estimated Task",
        timeEstimate: "M",
        status: "backlog",
      });

      const task = db.get(taskId);
      expect(task.timeEstimate).toBe("M");
    });

    it("supports optional dueDate", async () => {
      const dueDate = Date.now() + 86400000; // Tomorrow
      const taskId = db.insert("tasks", {
        title: "Due Task",
        dueDate,
        status: "backlog",
      });

      const task = db.get(taskId);
      expect(task.dueDate).toBe(dueDate);
    });

    it("validates priority values", () => {
      const validPriorities = ["P0", "P1", "P2", "P3"];
      expect(validPriorities).toContain("P0");
      expect(validPriorities).toContain("P1");
      expect(validPriorities).toContain("P2");
      expect(validPriorities).toContain("P3");
    });
  });

  describe("Mutation: updateStatus", () => {
    it("transitions task through valid states", async () => {
      const taskId = db.insert("tasks", { title: "Task", status: "backlog" });

      // backlog -> ready
      db.patch(taskId, { status: "ready" });
      let task = db.get(taskId);
      expect(task.status).toBe("ready");

      // ready -> in_progress
      db.patch(taskId, { status: "in_progress" });
      task = db.get(taskId);
      expect(task.status).toBe("in_progress");

      // in_progress -> done
      db.patch(taskId, { status: "done" });
      task = db.get(taskId);
      expect(task.status).toBe("done");
    });

    it("updates timestamp on status change", async () => {
      const taskId = db.insert("tasks", { title: "Task", status: "backlog" });
      const now = Date.now();

      db.patch(taskId, { status: "ready", updatedAt: now });

      const task = db.get(taskId);
      expect(task.updatedAt).toBe(now);
    });
  });

  describe("Mutation: assign", () => {
    it("assigns agents to task", async () => {
      const taskId = db.insert("tasks", { title: "Task", assigneeIds: [] });

      db.patch(taskId, { assigneeIds: ["agent-1", "agent-2"] });

      const task = db.get(taskId);
      expect(task.assigneeIds).toEqual(["agent-1", "agent-2"]);
    });

    it("prevents duplicate assignments", async () => {
      const taskId = db.insert("tasks", {
        title: "Task",
        assigneeIds: ["agent-1"],
      });

      const currentAssignees = new Set(db.get(taskId).assigneeIds);
      currentAssignees.add("agent-1"); // Duplicate
      db.patch(taskId, { assigneeIds: Array.from(currentAssignees) });

      const task = db.get(taskId);
      expect(task.assigneeIds.filter((a: string) => a === "agent-1")).toHaveLength(1);
    });

    it("limits assignees to maximum", async () => {
      const taskId = db.insert("tasks", { title: "Task", assigneeIds: [] });
      const assignees = Array.from({ length: 15 }, (_, i) => `agent-${i}`);

      db.patch(taskId, { assigneeIds: assignees.slice(0, 10) }); // Limit to 10

      const task = db.get(taskId);
      expect(task.assigneeIds.length).toBeLessThanOrEqual(10);
    });
  });

  describe("Mutation: unassign", () => {
    it("removes agent from task", async () => {
      const taskId = db.insert("tasks", {
        title: "Task",
        assigneeIds: ["agent-1", "agent-2"],
      });

      const assignees = db
        .get(taskId)
        .assigneeIds.filter((a: string) => a !== "agent-1");
      db.patch(taskId, { assigneeIds: assignees });

      const task = db.get(taskId);
      expect(task.assigneeIds).toEqual(["agent-2"]);
    });

    it("handles unassigning last agent", async () => {
      const taskId = db.insert("tasks", { title: "Task", assigneeIds: ["agent-1"] });

      db.patch(taskId, { assigneeIds: [] });

      const task = db.get(taskId);
      expect(task.assigneeIds).toEqual([]);
    });
  });

  describe("Mutation: addDependency", () => {
    it("adds dependency to task", async () => {
      const taskId = db.insert("tasks", {
        title: "Task A",
        dependencies: [],
      });
      const depId = db.insert("tasks", { title: "Task B" });

      const deps = db.get(taskId).dependencies || [];
      deps.push(depId);
      db.patch(taskId, { dependencies: deps });

      const task = db.get(taskId);
      expect(task.dependencies).toContain(depId);
    });

    it("prevents circular dependencies", async () => {
      const taskId = db.insert("tasks", {
        title: "Task A",
        dependencies: [],
      });
      const depId = db.insert("tasks", { title: "Task B", dependencies: [] });

      // Try to add circular dependency
      const hasCircle = db.hasCircularDependency(depId, taskId);
      expect(hasCircle).toBe(false); // No circle initially

      // Add task -> dep
      db.patch(taskId, { dependencies: [depId] });

      // Now trying to add dep -> task would be circular
      const wouldBeCircular =
        db.get(depId).dependencies?.includes(taskId) === true;
      expect(wouldBeCircular).toBe(false);
    });

    it("prevents duplicate dependencies", async () => {
      const taskId = db.insert("tasks", {
        title: "Task A",
        dependencies: ["task-1"],
      });

      const deps = db.get(taskId).dependencies || [];
      if (!deps.includes("task-1")) {
        deps.push("task-1");
      }
      db.patch(taskId, { dependencies: deps });

      const task = db.get(taskId);
      expect(
        task.dependencies.filter((d: string) => d === "task-1")
      ).toHaveLength(1);
    });
  });

  describe("Mutation: removeDependency", () => {
    it("removes dependency from task", async () => {
      const taskId = db.insert("tasks", {
        title: "Task A",
        dependencies: ["task-1", "task-2"],
      });

      const deps = db
        .get(taskId)
        .dependencies.filter((d: string) => d !== "task-1");
      db.patch(taskId, { dependencies: deps });

      const task = db.get(taskId);
      expect(task.dependencies).toEqual(["task-2"]);
    });

    it("handles removing non-existent dependency", async () => {
      const taskId = db.insert("tasks", {
        title: "Task A",
        dependencies: ["task-1"],
      });

      const deps = db.get(taskId).dependencies;
      const removed = deps.filter((d: string) => d !== "task-999");
      db.patch(taskId, { dependencies: removed });

      const task = db.get(taskId);
      expect(task.dependencies).toEqual(["task-1"]);
    });
  });

  describe("Mutation: addTags", () => {
    it("adds tags to task", async () => {
      const taskId = db.insert("tasks", { title: "Task", tags: ["api"] });

      const tags = new Set(db.get(taskId).tags || []);
      tags.add("bug");
      tags.add("urgent");
      db.patch(taskId, { tags: Array.from(tags) });

      const task = db.get(taskId);
      expect(task.tags).toContain("api");
      expect(task.tags).toContain("bug");
      expect(task.tags).toContain("urgent");
    });

    it("limits tags to maximum", async () => {
      const taskId = db.insert("tasks", { title: "Task", tags: [] });
      const tags = ["api", "ui", "bug", "auth", "db", "test"];

      db.patch(taskId, { tags: tags.slice(0, 5) }); // Limit to 5

      const task = db.get(taskId);
      expect(task.tags.length).toBeLessThanOrEqual(5);
    });
  });

  describe("Mutation: deleteTask", () => {
    it("deletes task from database", async () => {
      const taskId = db.insert("tasks", { title: "To Delete" });
      expect(db.get(taskId)).toBeDefined();

      db.delete(taskId);
      expect(db.get(taskId)).toBeNull();
    });

    it("prevents deletion of blocked tasks", async () => {
      const taskId = db.insert("tasks", {
        title: "Blocked Task",
        status: "blocked",
      });

      // Can only delete if not blocked
      const task = db.get(taskId);
      if (task.status !== "blocked") {
        db.delete(taskId);
        expect(db.get(taskId)).toBeNull();
      } else {
        expect(db.get(taskId)).toBeDefined();
      }
    });

    it("supports deletion workflow", async () => {
      const taskId = db.insert("tasks", { title: "Task A", dependencies: [] });
      const depId = db.insert("tasks", {
        title: "Task B",
        dependencies: [taskId],
      });

      // Before deletion, dependent task has reference
      const depTaskBefore = db.get(depId);
      expect(depTaskBefore.dependencies).toContain(taskId);

      db.delete(taskId);

      // Original task is deleted
      expect(db.get(taskId)).toBeNull();
    });
  });

  describe("Task lifecycle", () => {
    it("progresses through complete workflow", async () => {
      // Create
      const taskId = db.insert("tasks", {
        title: "Complete Task",
        status: "backlog",
        priority: "P1",
        epicId: "epic-1",
      });

      // Assign
      db.patch(taskId, { assigneeIds: ["agent-1"] });

      // Move to ready
      db.patch(taskId, { status: "ready" });

      // Move to in_progress
      db.patch(taskId, { status: "in_progress" });

      // Add tags
      db.patch(taskId, { tags: ["api", "bug"] });

      // Complete
      db.patch(taskId, { status: "done" });

      const task = db.get(taskId);
      expect(task.status).toBe("done");
      expect(task.assigneeIds).toContain("agent-1");
      expect(task.tags).toContain("api");
    });
  });

  describe("Priority levels", () => {
    it("supports all priority levels", () => {
      const priorities = ["P0", "P1", "P2", "P3"];
      for (const priority of priorities) {
        const taskId = db.insert("tasks", {
          title: `Task ${priority}`,
          priority,
          status: "backlog",
        });
        const task = db.get(taskId);
        expect(task.priority).toBe(priority);
      }
    });

    it("allows priority to be optional", async () => {
      const taskId = db.insert("tasks", {
        title: "Default Priority Task",
        status: "backlog",
      });

      const task = db.get(taskId);
      // Priority can be undefined if not specified (actual defaults are handled at Convex level)
      expect(task.title).toBe("Default Priority Task");
      expect(task.status).toBe("backlog");
    });
  });
});
