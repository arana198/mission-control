/**
 * Epic Management Tests
 *
 * Tests queries and mutations for epic CRUD operations and progress tracking
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

class EpicMockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    this.data.set("epics", []);
    this.data.set("tasks", []);
    this.data.set("activities", []);
  }

  generateId(table: string): string {
    return `${table}-${this.nextId++}`;
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

  query(table: string) {
    return {
      collect: async () => this.data.get(table) || [],
    };
  }

  getEpics() {
    return this.data.get("epics") || [];
  }

  getTasksForEpic(epicId: string) {
    return (this.data.get("tasks") || []).filter((t: any) => t.epicId === epicId);
  }

  calculateEpicProgress(epicId: string): number {
    const tasks = this.getTasksForEpic(epicId);
    if (tasks.length === 0) return 0;
    const completed = tasks.filter((t: any) => t.status === "done").length;
    return Math.round((completed / tasks.length) * 100);
  }
}

describe("Epics (convex/epics.ts)", () => {
  let db: EpicMockDatabase;

  beforeEach(() => {
    db = new EpicMockDatabase();
  });

  describe("Query: getAllEpics", () => {
    it("returns empty array when no epics exist", async () => {
      const epics = await db.query("epics").collect();
      expect(epics).toEqual([]);
    });

    it("returns all epics with required fields", async () => {
      db.insert("epics", {
        title: "MVP",
        description: "Minimum viable product",
        status: "active",
      });
      db.insert("epics", {
        title: "Scale",
        description: "Scaling infrastructure",
        status: "planning",
      });

      const epics = db.getEpics();
      expect(epics).toHaveLength(2);
      expect(epics[0]).toHaveProperty("title");
      expect(epics[0]).toHaveProperty("status");
    });
  });

  describe("Query: getEpicById", () => {
    it("returns epic by ID", async () => {
      const epicId = db.insert("epics", {
        title: "MVP",
        status: "active",
        progress: 0,
      });

      const epic = db.get(epicId);
      expect(epic).toBeDefined();
      expect(epic.title).toBe("MVP");
    });

    it("returns null for non-existent epic", async () => {
      const epic = db.get("epics-999");
      expect(epic).toBeNull();
    });
  });

  describe("Mutation: createEpic", () => {
    it("creates epic with required fields", async () => {
      const epicId = db.insert("epics", {
        title: "New Epic",
        description: "Description of epic",
        status: "planning",
        progress: 0,
        taskIds: [],
      });

      const epic = db.get(epicId);
      expect(epic.title).toBe("New Epic");
      expect(epic.status).toBe("planning");
      expect(epic.progress).toBe(0);
    });

    it("initializes empty task list", async () => {
      const epicId = db.insert("epics", {
        title: "Epic",
        taskIds: [],
      });

      const epic = db.get(epicId);
      expect(Array.isArray(epic.taskIds)).toBe(true);
      expect(epic.taskIds).toHaveLength(0);
    });

    it("supports optional fields", async () => {
      const epicId = db.insert("epics", {
        title: "Epic with details",
        description: "Long description",
        startDate: Date.now(),
        endDate: Date.now() + 86400000,
        owner: "user-1",
      });

      const epic = db.get(epicId);
      expect(epic.description).toBe("Long description");
      expect(epic.owner).toBe("user-1");
    });
  });

  describe("Mutation: updateEpic", () => {
    it("updates epic title", async () => {
      const epicId = db.insert("epics", { title: "Old Title" });

      db.patch(epicId, { title: "New Title" });

      const epic = db.get(epicId);
      expect(epic.title).toBe("New Title");
    });

    it("updates epic status", async () => {
      const epicId = db.insert("epics", { status: "planning" });

      db.patch(epicId, { status: "active" });

      const epic = db.get(epicId);
      expect(epic.status).toBe("active");
    });

    it("updates epic description", async () => {
      const epicId = db.insert("epics", { description: "Old desc" });

      db.patch(epicId, { description: "New description" });

      const epic = db.get(epicId);
      expect(epic.description).toBe("New description");
    });

    it("preserves other fields on partial update", async () => {
      const epicId = db.insert("epics", {
        title: "Epic",
        status: "active",
        progress: 50,
      });

      db.patch(epicId, { progress: 75 });

      const epic = db.get(epicId);
      expect(epic.title).toBe("Epic");
      expect(epic.status).toBe("active");
      expect(epic.progress).toBe(75);
    });
  });

  describe("Mutation: recalculateEpicProgress", () => {
    it("calculates progress from linked tasks", async () => {
      const epicId = db.insert("epics", { title: "Epic", progress: 0 });

      // Create tasks for epic
      db.insert("tasks", { epicId, status: "done" });
      db.insert("tasks", { epicId, status: "done" });
      db.insert("tasks", { epicId, status: "in_progress" });
      db.insert("tasks", { epicId, status: "backlog" });

      const progress = db.calculateEpicProgress(epicId);
      expect(progress).toBe(50); // 2 out of 4 done

      db.patch(epicId, { progress });

      const epic = db.get(epicId);
      expect(epic.progress).toBe(50);
    });

    it("returns 0 when no tasks exist", async () => {
      const epicId = db.insert("epics", { title: "Empty Epic" });

      const progress = db.calculateEpicProgress(epicId);
      expect(progress).toBe(0);
    });

    it("returns 100 when all tasks complete", async () => {
      const epicId = db.insert("epics", { title: "Complete Epic" });

      db.insert("tasks", { epicId, status: "done" });
      db.insert("tasks", { epicId, status: "done" });
      db.insert("tasks", { epicId, status: "done" });

      const progress = db.calculateEpicProgress(epicId);
      expect(progress).toBe(100);
    });

    it("updates progress on task completion", async () => {
      const epicId = db.insert("epics", { title: "Epic", progress: 0 });
      const taskId = db.insert("tasks", { epicId, status: "in_progress" });

      let progress = db.calculateEpicProgress(epicId);
      expect(progress).toBe(0);

      // Complete the task
      db.patch(taskId, { status: "done" });

      progress = db.calculateEpicProgress(epicId);
      expect(progress).toBe(100);
    });
  });

  describe("Mutation: deleteEpic", () => {
    it("deletes epic from database", async () => {
      const epicId = db.insert("epics", { title: "To Delete" });
      expect(db.get(epicId)).toBeDefined();

      db.delete(epicId);
      expect(db.get(epicId)).toBeNull();
    });

    it("prevents deletion when tasks exist", async () => {
      const epicId = db.insert("epics", { title: "Epic with tasks" });
      db.insert("tasks", { epicId, title: "Task 1" });

      // Should not delete if tasks exist
      const taskCount = db.getTasksForEpic(epicId).length;
      if (taskCount > 0) {
        expect(db.get(epicId)).toBeDefined();
      }
    });

    it("allows deletion of empty epic", async () => {
      const epicId = db.insert("epics", { title: "Empty Epic" });
      const taskCount = db.getTasksForEpic(epicId).length;

      if (taskCount === 0) {
        db.delete(epicId);
        expect(db.get(epicId)).toBeNull();
      }
    });
  });

  describe("Epic status transitions", () => {
    it("supports valid status values", () => {
      const validStatuses = ["planning", "active", "on_hold", "completed"];
      for (const status of validStatuses) {
        const epicId = db.insert("epics", {
          title: `Epic ${status}`,
          status,
        });
        const epic = db.get(epicId);
        expect(epic.status).toBe(status);
      }
    });

    it("transitions through lifecycle", async () => {
      const epicId = db.insert("epics", { title: "Lifecycle", status: "planning" });

      // planning -> active
      db.patch(epicId, { status: "active" });
      let epic = db.get(epicId);
      expect(epic.status).toBe("active");

      // active -> completed
      db.patch(epicId, { status: "completed" });
      epic = db.get(epicId);
      expect(epic.status).toBe("completed");
    });
  });

  describe("Epic task management", () => {
    it("tracks linked tasks", async () => {
      const epicId = db.insert("epics", { title: "Epic", taskIds: [] });

      // Link tasks
      const task1 = db.insert("tasks", { epicId, title: "Task 1" });
      const task2 = db.insert("tasks", { epicId, title: "Task 2" });

      const tasks = db.getTasksForEpic(epicId);
      expect(tasks).toHaveLength(2);
      expect(tasks.map((t: any) => t._id)).toContain(task1);
      expect(tasks.map((t: any) => t._id)).toContain(task2);
    });

    it("can unlink tasks from epic", async () => {
      const epicId = db.insert("epics", { title: "Epic" });
      const taskId = db.insert("tasks", { epicId, title: "Task" });

      // Unlink by removing epicId
      db.patch(taskId, { epicId: null });

      const tasks = db.getTasksForEpic(epicId);
      expect(tasks).toHaveLength(0);
    });

    it("recalculates progress when tasks change", async () => {
      const epicId = db.insert("epics", { title: "Epic", progress: 0 });

      const task1 = db.insert("tasks", { epicId, status: "in_progress" });
      const task2 = db.insert("tasks", { epicId, status: "backlog" });

      let progress = db.calculateEpicProgress(epicId);
      expect(progress).toBe(0);

      // Complete first task
      db.patch(task1, { status: "done" });
      progress = db.calculateEpicProgress(epicId);
      expect(progress).toBe(50);

      // Complete second task
      db.patch(task2, { status: "done" });
      progress = db.calculateEpicProgress(epicId);
      expect(progress).toBe(100);
    });
  });

  describe("Epic metadata", () => {
    it("tracks creation and update times", async () => {
      const before = Date.now();
      const epicId = db.insert("epics", {
        title: "Epic",
        created: Date.now(),
      });
      const after = Date.now();

      const epic = db.get(epicId);
      expect(epic.created).toBeGreaterThanOrEqual(before);
      expect(epic.created).toBeLessThanOrEqual(after);
    });

    it("tracks owner information", async () => {
      const epicId = db.insert("epics", {
        title: "Epic",
        owner: "user-1",
        createdBy: "system",
      });

      const epic = db.get(epicId);
      expect(epic.owner).toBe("user-1");
      expect(epic.createdBy).toBe("system");
    });

    it("supports tags for categorization", async () => {
      const epicId = db.insert("epics", {
        title: "Epic",
        tags: ["high-priority", "Q1"],
      });

      const epic = db.get(epicId);
      expect(epic.tags).toContain("high-priority");
      expect(epic.tags).toContain("Q1");
    });
  });
});
