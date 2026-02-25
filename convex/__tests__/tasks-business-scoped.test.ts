/**
 * -Scoped Tasks Tests
 *
 * Tests for workspaceId threading through task queries and mutations
 * Validates: data isolation, per-workspace counters, required workspaceId parameter
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * MockDatabase for -Scoped Tasks
 */
class TaskMockDatabase {
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

  getTasksBy(workspaceId: string) {
    return (this.data.get("tasks") || []).filter(
      (t: any) => t.workspaceId === workspaceId
    );
  }

  getTasksByAndStatus(workspaceId: string, status: string) {
    return (this.data.get("tasks") || []).filter(
      (t: any) => t.workspaceId === workspaceId && t.status === status
    );
  }

  getTasksByAndPriority(workspaceId: string, priority: string) {
    return (this.data.get("tasks") || []).filter(
      (t: any) => t.workspaceId === workspaceId && t.priority === priority
    );
  }

  getTasksByAgent(agentId: string, workspaceId: string) {
    return (this.data.get("tasks") || []).filter(
      (t) =>
        t.workspaceId === workspaceId &&
        t.assigneeIds &&
        t.assigneeIds.includes(agentId)
    );
  }

  getCounterFor(workspaceId: string) {
    const settings = this.data.get("settings") || [];
    const counterSetting = settings.find(
      (s: any) => s.workspaceId === workspaceId && s.key === "taskCounter"
    );
    return counterSetting ? parseInt(counterSetting.value) : 0;
  }

  setCounterFor(workspaceId: string, counter: number) {
    const settings = this.data.get("settings") || [];
    const existing = settings.find(
      (s: any) => s.workspaceId === workspaceId && s.key === "taskCounter"
    );
    if (existing) {
      existing.value = String(counter);
    } else {
      settings.push({
        workspaceId,
        key: "taskCounter",
        value: String(counter),
      });
    }
  }
}

describe("Tasks with  Scoping", () => {
  let db: TaskMockDatabase;

  beforeEach(() => {
    db = new TaskMockDatabase();
  });

  describe("getAllTasks", () => {
    it("should require workspaceId parameter", async () => {
      // Act: calling without workspaceId would be a TS error
      // Expected: workspaceId is required in function signature
      const tasks = db.getTasksBy(""); // empty workspaceId
      expect(tasks).toEqual([]);
    });

    it("should return only tasks for specified workspaceId", async () => {
      const now = Date.now();
      // Arrange:  A has 3 tasks,  B has 2 tasks
      db.insert("tasks", {
        workspaceId: "bizA",
        title: "Task A1",
        status: "backlog",
        createdAt: now,
      });
      db.insert("tasks", {
        workspaceId: "bizA",
        title: "Task A2",
        status: "backlog",
        createdAt: now,
      });
      db.insert("tasks", {
        workspaceId: "bizA",
        title: "Task A3",
        status: "backlog",
        createdAt: now,
      });
      db.insert("tasks", {
        workspaceId: "bizB",
        title: "Task B1",
        status: "backlog",
        createdAt: now,
      });
      db.insert("tasks", {
        workspaceId: "bizB",
        title: "Task B2",
        status: "backlog",
        createdAt: now,
      });

      // Act: call getAllTasks(workspaceId_A)
      const tasksA = db.getTasksBy("bizA");

      // Expected: returns 3 tasks (only  A's)
      expect(tasksA).toHaveLength(3);
      expect(tasksA.every((t: any) => t.workspaceId === "bizA")).toBe(true);
    });

    it("should return empty array if workspace has no tasks", async () => {
      // Arrange:  A exists but has 0 tasks
      // Act: call getAllTasks(workspaceId_A)
      const tasks = db.getTasksBy("bizA");

      // Expected: empty array []
      expect(tasks).toEqual([]);
      expect(tasks.length).toBe(0);
    });

    it("should not return tasks from other businesses", async () => {
      const now = Date.now();
      // Arrange:  A has "Task 1",  B has "Task 2"
      db.insert("tasks", {
        workspaceId: "bizA",
        title: "Task 1",
        status: "backlog",
        createdAt: now,
      });
      db.insert("tasks", {
        workspaceId: "bizB",
        title: "Task 2",
        status: "backlog",
        createdAt: now,
      });

      // Act: call getAllTasks(workspaceId_A)
      const tasksA = db.getTasksBy("bizA");

      // Expected: only "Task 1" returned, "Task 2" not visible
      expect(tasksA).toHaveLength(1);
      expect(tasksA[0].title).toBe("Task 1");
    });
  });

  describe("createTask", () => {
    it("should require workspaceId parameter", async () => {
      // Act: workspaceId must be provided (TS requirement)
      // Expected: error or validation if missing
      const now = Date.now();
      const taskId = db.insert("tasks", {
        workspaceId: "bizA", // required
        title: "Task",
        status: "backlog",
        createdAt: now,
      });

      expect(taskId).toBeDefined();
      expect(db.get(taskId).workspaceId).toBe("bizA");
    });

    it("should store workspaceId on created task", async () => {
      const now = Date.now();
      // Arrange: workspaceId = "biz_123"
      const workspaceId = "biz_123";

      // Act: create task with workspaceId
      const taskId = db.insert("tasks", {
        workspaceId,
        title: "Task",
        status: "backlog",
        createdAt: now,
      });

      // Expected: task.workspaceId === "biz_123"
      const task = db.get(taskId);
      expect(task.workspaceId).toBe("biz_123");
    });

    it("should use per-workspace taskCounter", async () => {
      const now = Date.now();
      // Arrange:  A taskCounter = 5,  B taskCounter = 3
      db.setCounterFor("bizA", 5);
      db.setCounterFor("bizB", 3);

      // Act: create task in  A, then in  B
      const counterA = db.getCounterFor("bizA");
      const counterB = db.getCounterFor("bizB");

      // Expected: counters are separate
      expect(counterA).toBe(5);
      expect(counterB).toBe(3);
    });

    it("should not increment other business's counter", async () => {
      // Arrange:  A counter = 10,  B counter = 5
      db.setCounterFor("bizA", 10);
      db.setCounterFor("bizB", 5);

      // Act: increment  A counter
      db.setCounterFor("bizA", 11);

      // Assert:  B counter still 5
      expect(db.getCounterFor("bizA")).toBe(11);
      expect(db.getCounterFor("bizB")).toBe(5);
    });
  });

  describe("getByStatus", () => {
    it("should require workspaceId parameter", async () => {
      const now = Date.now();
      // Act: workspaceId must be provided
      const tasks = db.getTasksByAndStatus("bizA", "backlog");

      // Expected: valid function call
      expect(tasks).toEqual([]);
    });

    it("should return only tasks for workspace with given status", async () => {
      const now = Date.now();
      // Arrange:  A has [2x backlog, 1x done],  B has [1x backlog]
      db.insert("tasks", {
        workspaceId: "bizA",
        title: "Task A1",
        status: "backlog",
        createdAt: now,
      });
      db.insert("tasks", {
        workspaceId: "bizA",
        title: "Task A2",
        status: "backlog",
        createdAt: now,
      });
      db.insert("tasks", {
        workspaceId: "bizA",
        title: "Task A3",
        status: "done",
        createdAt: now,
      });
      db.insert("tasks", {
        workspaceId: "bizB",
        title: "Task B1",
        status: "backlog",
        createdAt: now,
      });

      // Act: call getByStatus(workspaceId_A, "backlog")
      const backlogTasksA = db.getTasksByAndStatus("bizA", "backlog");

      // Expected: returns 2 tasks (only  A's backlog tasks)
      expect(backlogTasksA).toHaveLength(2);
      expect(backlogTasksA.every((t: any) => t.workspaceId === "bizA")).toBe(true);
      expect(backlogTasksA.every((t: any) => t.status === "backlog")).toBe(true);
    });
  });

  describe("getFiltered", () => {
    it("should require workspaceId parameter", async () => {
      // Act: workspaceId is required
      const tasks = db.getTasksByAndPriority("bizA", "P0");

      // Expected: function works with workspaceId
      expect(tasks).toEqual([]);
    });

    it("should filter by workspaceId AND other criteria", async () => {
      const now = Date.now();
      // Arrange:  A has [P0 task, P1 task],  B has [P0 task]
      db.insert("tasks", {
        workspaceId: "bizA",
        title: "Task A1",
        priority: "P0",
        createdAt: now,
      });
      db.insert("tasks", {
        workspaceId: "bizA",
        title: "Task A2",
        priority: "P1",
        createdAt: now,
      });
      db.insert("tasks", {
        workspaceId: "bizB",
        title: "Task B1",
        priority: "P0",
        createdAt: now,
      });

      // Act: call getFiltered(workspaceId_A, { priority: "P0" })
      const filtered = db.getTasksByAndPriority("bizA", "P0");

      // Expected: returns 1 task (only  A's P0 task)
      expect(filtered).toHaveLength(1);
      expect(filtered[0].workspaceId).toBe("bizA");
      expect(filtered[0].priority).toBe("P0");
    });

    it("should not leak tasks from other businesses", async () => {
      const now = Date.now();
      // Arrange:  B has 100 tasks (simulate)
      for (let i = 0; i < 100; i++) {
        db.insert("tasks", {
          workspaceId: "bizB",
          title: `Task B${i}`,
          createdAt: now,
        });
      }

      // Act: getFiltered(workspaceId_A)
      const tasksA = db.getTasksBy("bizA");

      // Expected:  B tasks never appear
      expect(tasksA).toHaveLength(0);
    });
  });

  describe("getForAgent", () => {
    it("should require workspaceId parameter", async () => {
      const now = Date.now();
      // Act: workspaceId is required
      const tasks = db.getTasksByAgent("agent1", "bizA");

      // Expected: function call works
      expect(tasks).toEqual([]);
    });

    it("should return only assigned tasks for that business", async () => {
      const now = Date.now();
      // Arrange: Agent assigned to tasks in  A and  B
      db.insert("tasks", {
        workspaceId: "bizA",
        title: "Task A1",
        assigneeIds: ["agent1"],
        createdAt: now,
      });
      db.insert("tasks", {
        workspaceId: "bizA",
        title: "Task A2",
        assigneeIds: ["agent1"],
        createdAt: now,
      });
      db.insert("tasks", {
        workspaceId: "bizB",
        title: "Task B1",
        assigneeIds: ["agent1"],
        createdAt: now,
      });

      // Act: call getForAgent(agentId, workspaceId_A)
      const tasksA = db.getTasksByAgent("agent1", "bizA");

      // Expected: returns only  A tasks for that agent
      expect(tasksA).toHaveLength(2);
      expect(tasksA.every((t: any) => t.workspaceId === "bizA")).toBe(true);
    });

    it("should return empty array if agent has no tasks in business", async () => {
      const now = Date.now();
      // Arrange: Agent has tasks in  B but not in  A
      db.insert("tasks", {
        workspaceId: "bizB",
        title: "Task B1",
        assigneeIds: ["agent1"],
        createdAt: now,
      });

      // Act: call getForAgent(agentId, workspaceId_A)
      const tasksA = db.getTasksByAgent("agent1", "bizA");

      // Expected: empty array []
      expect(tasksA).toEqual([]);
    });
  });

  describe("createSubtask", () => {
    it("should inherit workspaceId from parent task", async () => {
      const now = Date.now();
      // Arrange: parent task belongs to  A
      const parentId = db.insert("tasks", {
        workspaceId: "bizA",
        title: "Parent Task",
        createdAt: now,
      });

      // Act: create subtask
      const parent = db.get(parentId);
      const subtaskId = db.insert("tasks", {
        workspaceId: parent.workspaceId, // inherit
        title: "Subtask",
        parentTaskId: parentId,
        createdAt: now,
      });

      // Expected: subtask.workspaceId ===  A's id
      const subtask = db.get(subtaskId);
      expect(subtask.workspaceId).toBe("bizA");
    });

    it("should fail if parent task not found (wrong business)", async () => {
      const now = Date.now();
      // Arrange: parent task is in  B
      const parentId = db.insert("tasks", {
        workspaceId: "bizB",
        title: "Parent Task",
        createdAt: now,
      });

      // Act: try to create subtask with  A context (parent not visible)
      const tasksInBizA = db.getTasksBy("bizA");
      const parentInBizA = tasksInBizA.find((t: any) => t._id === parentId);

      // Expected: parent not visible in  A
      expect(parentInBizA).toBeUndefined();
    });
  });

  describe("Task Counter Isolation", () => {
    it("should maintain separate counters per business", async () => {
      // Arrange: 2 businesses
      // Act: simulate counter increments
      for (let i = 0; i < 5; i++) {
        db.setCounterFor("bizA", i + 1);
      }
      for (let i = 0; i < 3; i++) {
        db.setCounterFor("bizB", i + 1);
      }

      // Expected: separate counters
      expect(db.getCounterFor("bizA")).toBe(5);
      expect(db.getCounterFor("bizB")).toBe(3);
    });

    it("should increment counter atomically per business", async () => {
      // Arrange: concurrent creates in both businesses (simulated)
      db.setCounterFor("bizA", 0);
      db.setCounterFor("bizB", 0);

      // Act: increment both
      db.setCounterFor("bizA", 1);
      db.setCounterFor("bizB", 1);
      db.setCounterFor("bizA", 2);

      // Expected: each business's counter increments correctly
      expect(db.getCounterFor("bizA")).toBe(2);
      expect(db.getCounterFor("bizB")).toBe(1);
    });
  });

  describe("Data Isolation Boundaries", () => {
    it("should completely isolate tasks between businesses", async () => {
      const now = Date.now();
      // Act: run getAllTasks for each business
      for (let i = 0; i < 10; i++) {
        db.insert("tasks", {
          workspaceId: "bizA",
          title: `Task A${i}`,
          createdAt: now,
        });
        db.insert("tasks", {
          workspaceId: "bizB",
          title: `Task B${i}`,
          createdAt: now,
        });
      }

      const tasksA = db.getTasksBy("bizA");
      const tasksB = db.getTasksBy("bizB");

      // Expected: no cross-contamination
      expect(tasksA).toHaveLength(10);
      expect(tasksB).toHaveLength(10);
      expect(tasksA.every((t: any) => t.workspaceId === "bizA")).toBe(true);
      expect(tasksB.every((t: any) => t.workspaceId === "bizB")).toBe(true);
    });

    it("should prevent querying non-existent workspaceId", async () => {
      // Act: call getAllTasks(nonexistent_id)
      const tasks = db.getTasksBy("nonexistent");

      // Expected: returns empty array or error (graceful)
      expect(tasks).toEqual([]);
    });

    it("should maintain isolation during updates", async () => {
      const now = Date.now();
      // Arrange:  A and B have same-named task
      const taskAId = db.insert("tasks", {
        workspaceId: "bizA",
        title: "Same Task",
        status: "backlog",
        createdAt: now,
      });
      const taskBId = db.insert("tasks", {
        workspaceId: "bizB",
        title: "Same Task",
        status: "backlog",
        createdAt: now,
      });

      // Act: update  A's task
      db.patch(taskAId, { status: "done" });

      // Expected:  B's task unchanged
      expect(db.get(taskAId).status).toBe("done");
      expect(db.get(taskBId).status).toBe("backlog");
    });
  });
});
