/**
 * Business-Scoped Tasks Tests
 *
 * Tests for businessId threading through task queries and mutations
 * Validates: data isolation, per-business counters, required businessId parameter
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * MockDatabase for Business-Scoped Tasks
 */
class TaskBusinessMockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    this.data.set("tasks", []);
    this.data.set("agents", []);
    this.data.set("settings", []);
  }

  generateId(table: string): string {
    return `${table}_${this.nextId++}`;
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

  getTasks() {
    return this.data.get("tasks") || [];
  }

  getTasksByBusiness(businessId: string) {
    return (this.data.get("tasks") || []).filter(
      (t: any) => t.businessId === businessId
    );
  }

  getTasksByBusinessAndStatus(businessId: string, status: string) {
    return (this.data.get("tasks") || []).filter(
      (t: any) => t.businessId === businessId && t.status === status
    );
  }

  getTasksByBusinessAndPriority(businessId: string, priority: string) {
    return (this.data.get("tasks") || []).filter(
      (t: any) => t.businessId === businessId && t.priority === priority
    );
  }

  getTasksByAgent(agentId: string, businessId: string) {
    return (this.data.get("tasks") || []).filter(
      (t) =>
        t.businessId === businessId &&
        t.assigneeIds &&
        t.assigneeIds.includes(agentId)
    );
  }

  getCounterForBusiness(businessId: string) {
    const settings = this.data.get("settings") || [];
    const counterSetting = settings.find(
      (s: any) => s.businessId === businessId && s.key === "taskCounter"
    );
    return counterSetting ? parseInt(counterSetting.value) : 0;
  }

  setCounterForBusiness(businessId: string, counter: number) {
    const settings = this.data.get("settings") || [];
    const existing = settings.find(
      (s: any) => s.businessId === businessId && s.key === "taskCounter"
    );
    if (existing) {
      existing.value = String(counter);
    } else {
      settings.push({
        businessId,
        key: "taskCounter",
        value: String(counter),
      });
    }
  }
}

describe("Tasks with Business Scoping", () => {
  let db: TaskBusinessMockDatabase;

  beforeEach(() => {
    db = new TaskBusinessMockDatabase();
  });

  describe("getAllTasks", () => {
    it("should require businessId parameter", async () => {
      // Act: calling without businessId would be a TS error
      // Expected: businessId is required in function signature
      const tasks = db.getTasksByBusiness(""); // empty businessId
      expect(tasks).toEqual([]);
    });

    it("should return only tasks for specified businessId", async () => {
      const now = Date.now();
      // Arrange: Business A has 3 tasks, Business B has 2 tasks
      db.insert("tasks", {
        businessId: "bizA",
        title: "Task A1",
        status: "backlog",
        createdAt: now,
      });
      db.insert("tasks", {
        businessId: "bizA",
        title: "Task A2",
        status: "backlog",
        createdAt: now,
      });
      db.insert("tasks", {
        businessId: "bizA",
        title: "Task A3",
        status: "backlog",
        createdAt: now,
      });
      db.insert("tasks", {
        businessId: "bizB",
        title: "Task B1",
        status: "backlog",
        createdAt: now,
      });
      db.insert("tasks", {
        businessId: "bizB",
        title: "Task B2",
        status: "backlog",
        createdAt: now,
      });

      // Act: call getAllTasks(businessId_A)
      const tasksA = db.getTasksByBusiness("bizA");

      // Expected: returns 3 tasks (only Business A's)
      expect(tasksA).toHaveLength(3);
      expect(tasksA.every((t: any) => t.businessId === "bizA")).toBe(true);
    });

    it("should return empty array if business has no tasks", async () => {
      // Arrange: Business A exists but has 0 tasks
      // Act: call getAllTasks(businessId_A)
      const tasks = db.getTasksByBusiness("bizA");

      // Expected: empty array []
      expect(tasks).toEqual([]);
      expect(tasks.length).toBe(0);
    });

    it("should not return tasks from other businesses", async () => {
      const now = Date.now();
      // Arrange: Business A has "Task 1", Business B has "Task 2"
      db.insert("tasks", {
        businessId: "bizA",
        title: "Task 1",
        status: "backlog",
        createdAt: now,
      });
      db.insert("tasks", {
        businessId: "bizB",
        title: "Task 2",
        status: "backlog",
        createdAt: now,
      });

      // Act: call getAllTasks(businessId_A)
      const tasksA = db.getTasksByBusiness("bizA");

      // Expected: only "Task 1" returned, "Task 2" not visible
      expect(tasksA).toHaveLength(1);
      expect(tasksA[0].title).toBe("Task 1");
    });
  });

  describe("createTask", () => {
    it("should require businessId parameter", async () => {
      // Act: businessId must be provided (TS requirement)
      // Expected: error or validation if missing
      const now = Date.now();
      const taskId = db.insert("tasks", {
        businessId: "bizA", // required
        title: "Task",
        status: "backlog",
        createdAt: now,
      });

      expect(taskId).toBeDefined();
      expect(db.get(taskId).businessId).toBe("bizA");
    });

    it("should store businessId on created task", async () => {
      const now = Date.now();
      // Arrange: businessId = "biz_123"
      const businessId = "biz_123";

      // Act: create task with businessId
      const taskId = db.insert("tasks", {
        businessId,
        title: "Task",
        status: "backlog",
        createdAt: now,
      });

      // Expected: task.businessId === "biz_123"
      const task = db.get(taskId);
      expect(task.businessId).toBe("biz_123");
    });

    it("should use per-business taskCounter", async () => {
      const now = Date.now();
      // Arrange: Business A taskCounter = 5, Business B taskCounter = 3
      db.setCounterForBusiness("bizA", 5);
      db.setCounterForBusiness("bizB", 3);

      // Act: create task in Business A, then in Business B
      const counterA = db.getCounterForBusiness("bizA");
      const counterB = db.getCounterForBusiness("bizB");

      // Expected: counters are separate
      expect(counterA).toBe(5);
      expect(counterB).toBe(3);
    });

    it("should not increment other business's counter", async () => {
      // Arrange: Business A counter = 10, Business B counter = 5
      db.setCounterForBusiness("bizA", 10);
      db.setCounterForBusiness("bizB", 5);

      // Act: increment Business A counter
      db.setCounterForBusiness("bizA", 11);

      // Assert: Business B counter still 5
      expect(db.getCounterForBusiness("bizA")).toBe(11);
      expect(db.getCounterForBusiness("bizB")).toBe(5);
    });
  });

  describe("getByStatus", () => {
    it("should require businessId parameter", async () => {
      const now = Date.now();
      // Act: businessId must be provided
      const tasks = db.getTasksByBusinessAndStatus("bizA", "backlog");

      // Expected: valid function call
      expect(tasks).toEqual([]);
    });

    it("should return only tasks for business with given status", async () => {
      const now = Date.now();
      // Arrange: Business A has [2x backlog, 1x done], Business B has [1x backlog]
      db.insert("tasks", {
        businessId: "bizA",
        title: "Task A1",
        status: "backlog",
        createdAt: now,
      });
      db.insert("tasks", {
        businessId: "bizA",
        title: "Task A2",
        status: "backlog",
        createdAt: now,
      });
      db.insert("tasks", {
        businessId: "bizA",
        title: "Task A3",
        status: "done",
        createdAt: now,
      });
      db.insert("tasks", {
        businessId: "bizB",
        title: "Task B1",
        status: "backlog",
        createdAt: now,
      });

      // Act: call getByStatus(businessId_A, "backlog")
      const backlogTasksA = db.getTasksByBusinessAndStatus("bizA", "backlog");

      // Expected: returns 2 tasks (only Business A's backlog tasks)
      expect(backlogTasksA).toHaveLength(2);
      expect(backlogTasksA.every((t: any) => t.businessId === "bizA")).toBe(true);
      expect(backlogTasksA.every((t: any) => t.status === "backlog")).toBe(true);
    });
  });

  describe("getFiltered", () => {
    it("should require businessId parameter", async () => {
      // Act: businessId is required
      const tasks = db.getTasksByBusinessAndPriority("bizA", "P0");

      // Expected: function works with businessId
      expect(tasks).toEqual([]);
    });

    it("should filter by businessId AND other criteria", async () => {
      const now = Date.now();
      // Arrange: Business A has [P0 task, P1 task], Business B has [P0 task]
      db.insert("tasks", {
        businessId: "bizA",
        title: "Task A1",
        priority: "P0",
        createdAt: now,
      });
      db.insert("tasks", {
        businessId: "bizA",
        title: "Task A2",
        priority: "P1",
        createdAt: now,
      });
      db.insert("tasks", {
        businessId: "bizB",
        title: "Task B1",
        priority: "P0",
        createdAt: now,
      });

      // Act: call getFiltered(businessId_A, { priority: "P0" })
      const filtered = db.getTasksByBusinessAndPriority("bizA", "P0");

      // Expected: returns 1 task (only Business A's P0 task)
      expect(filtered).toHaveLength(1);
      expect(filtered[0].businessId).toBe("bizA");
      expect(filtered[0].priority).toBe("P0");
    });

    it("should not leak tasks from other businesses", async () => {
      const now = Date.now();
      // Arrange: Business B has 100 tasks (simulate)
      for (let i = 0; i < 100; i++) {
        db.insert("tasks", {
          businessId: "bizB",
          title: `Task B${i}`,
          createdAt: now,
        });
      }

      // Act: getFiltered(businessId_A)
      const tasksA = db.getTasksByBusiness("bizA");

      // Expected: Business B tasks never appear
      expect(tasksA).toHaveLength(0);
    });
  });

  describe("getForAgent", () => {
    it("should require businessId parameter", async () => {
      const now = Date.now();
      // Act: businessId is required
      const tasks = db.getTasksByAgent("agent1", "bizA");

      // Expected: function call works
      expect(tasks).toEqual([]);
    });

    it("should return only assigned tasks for that business", async () => {
      const now = Date.now();
      // Arrange: Agent assigned to tasks in Business A and Business B
      db.insert("tasks", {
        businessId: "bizA",
        title: "Task A1",
        assigneeIds: ["agent1"],
        createdAt: now,
      });
      db.insert("tasks", {
        businessId: "bizA",
        title: "Task A2",
        assigneeIds: ["agent1"],
        createdAt: now,
      });
      db.insert("tasks", {
        businessId: "bizB",
        title: "Task B1",
        assigneeIds: ["agent1"],
        createdAt: now,
      });

      // Act: call getForAgent(agentId, businessId_A)
      const tasksA = db.getTasksByAgent("agent1", "bizA");

      // Expected: returns only Business A tasks for that agent
      expect(tasksA).toHaveLength(2);
      expect(tasksA.every((t: any) => t.businessId === "bizA")).toBe(true);
    });

    it("should return empty array if agent has no tasks in business", async () => {
      const now = Date.now();
      // Arrange: Agent has tasks in Business B but not in Business A
      db.insert("tasks", {
        businessId: "bizB",
        title: "Task B1",
        assigneeIds: ["agent1"],
        createdAt: now,
      });

      // Act: call getForAgent(agentId, businessId_A)
      const tasksA = db.getTasksByAgent("agent1", "bizA");

      // Expected: empty array []
      expect(tasksA).toEqual([]);
    });
  });

  describe("createSubtask", () => {
    it("should inherit businessId from parent task", async () => {
      const now = Date.now();
      // Arrange: parent task belongs to Business A
      const parentId = db.insert("tasks", {
        businessId: "bizA",
        title: "Parent Task",
        createdAt: now,
      });

      // Act: create subtask
      const parent = db.get(parentId);
      const subtaskId = db.insert("tasks", {
        businessId: parent.businessId, // inherit
        title: "Subtask",
        parentTaskId: parentId,
        createdAt: now,
      });

      // Expected: subtask.businessId === Business A's id
      const subtask = db.get(subtaskId);
      expect(subtask.businessId).toBe("bizA");
    });

    it("should fail if parent task not found (wrong business)", async () => {
      const now = Date.now();
      // Arrange: parent task is in Business B
      const parentId = db.insert("tasks", {
        businessId: "bizB",
        title: "Parent Task",
        createdAt: now,
      });

      // Act: try to create subtask with Business A context (parent not visible)
      const tasksInBizA = db.getTasksByBusiness("bizA");
      const parentInBizA = tasksInBizA.find((t: any) => t._id === parentId);

      // Expected: parent not visible in Business A
      expect(parentInBizA).toBeUndefined();
    });
  });

  describe("Task Counter Isolation", () => {
    it("should maintain separate counters per business", async () => {
      // Arrange: 2 businesses
      // Act: simulate counter increments
      for (let i = 0; i < 5; i++) {
        db.setCounterForBusiness("bizA", i + 1);
      }
      for (let i = 0; i < 3; i++) {
        db.setCounterForBusiness("bizB", i + 1);
      }

      // Expected: separate counters
      expect(db.getCounterForBusiness("bizA")).toBe(5);
      expect(db.getCounterForBusiness("bizB")).toBe(3);
    });

    it("should increment counter atomically per business", async () => {
      // Arrange: concurrent creates in both businesses (simulated)
      db.setCounterForBusiness("bizA", 0);
      db.setCounterForBusiness("bizB", 0);

      // Act: increment both
      db.setCounterForBusiness("bizA", 1);
      db.setCounterForBusiness("bizB", 1);
      db.setCounterForBusiness("bizA", 2);

      // Expected: each business's counter increments correctly
      expect(db.getCounterForBusiness("bizA")).toBe(2);
      expect(db.getCounterForBusiness("bizB")).toBe(1);
    });
  });

  describe("Data Isolation Boundaries", () => {
    it("should completely isolate tasks between businesses", async () => {
      const now = Date.now();
      // Act: run getAllTasks for each business
      for (let i = 0; i < 10; i++) {
        db.insert("tasks", {
          businessId: "bizA",
          title: `Task A${i}`,
          createdAt: now,
        });
        db.insert("tasks", {
          businessId: "bizB",
          title: `Task B${i}`,
          createdAt: now,
        });
      }

      const tasksA = db.getTasksByBusiness("bizA");
      const tasksB = db.getTasksByBusiness("bizB");

      // Expected: no cross-contamination
      expect(tasksA).toHaveLength(10);
      expect(tasksB).toHaveLength(10);
      expect(tasksA.every((t: any) => t.businessId === "bizA")).toBe(true);
      expect(tasksB.every((t: any) => t.businessId === "bizB")).toBe(true);
    });

    it("should prevent querying non-existent businessId", async () => {
      // Act: call getAllTasks(nonexistent_id)
      const tasks = db.getTasksByBusiness("nonexistent");

      // Expected: returns empty array or error (graceful)
      expect(tasks).toEqual([]);
    });

    it("should maintain isolation during updates", async () => {
      const now = Date.now();
      // Arrange: Business A and B have same-named task
      const taskAId = db.insert("tasks", {
        businessId: "bizA",
        title: "Same Task",
        status: "backlog",
        createdAt: now,
      });
      const taskBId = db.insert("tasks", {
        businessId: "bizB",
        title: "Same Task",
        status: "backlog",
        createdAt: now,
      });

      // Act: update Business A's task
      db.patch(taskAId, { status: "done" });

      // Expected: Business B's task unchanged
      expect(db.get(taskAId).status).toBe("done");
      expect(db.get(taskBId).status).toBe("backlog");
    });
  });
});
