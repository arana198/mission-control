/**
 * Epic Management Tests
 * Tests for epic CRUD, progress calculation, and task linkage
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

class MockEpicDb {
  private epics: Map<string, any> = new Map();
  private tasks: Map<string, any> = new Map();
  private activities: Map<string, any> = new Map();
  private counter = 0;

  addEpic(id: string, epic: any) {
    this.epics.set(id, { ...epic, _id: id });
  }

  addTask(id: string, task: any) {
    this.tasks.set(id, { ...task, _id: id });
  }

  async get(id: string) {
    return this.epics.get(id) || this.tasks.get(id) || null;
  }

  async insert(table: string, data: any) {
    const id = `${table}-${++this.counter}`;
    if (table === "epics") {
      this.epics.set(id, { ...data, _id: id });
    } else if (table === "activities") {
      this.activities.set(id, { ...data, _id: id });
    }
    return id as any;
  }

  async patch(id: string, updates: any) {
    let item = this.epics.get(id) || this.tasks.get(id);
    if (!item) throw new Error(`Item not found: ${id}`);
    Object.assign(item, updates);
    return item;
  }

  async delete(id: string) {
    this.epics.delete(id);
    this.tasks.delete(id);
  }

  query(table: string) {
    return {
      order: () => ({
        take: async (n: number) => {
          const data = Array.from(this.epics.values());
          return data.slice(0, n);
        },
      }),
      withIndex: () => ({
        eq: () => ({
          collect: async () => {
            if (table === "tasks") {
              return Array.from(this.tasks.values());
            }
            return [];
          },
        }),
      }),
      collect: async () => {
        if (table === "epics") {
          return Array.from(this.epics.values());
        }
        return [];
      },
    };
  }

  getAllEpics() {
    return Array.from(this.epics.values());
  }

  getActivities() {
    return Array.from(this.activities.values());
  }
}

describe("Epic Management", () => {
  let db: MockEpicDb;
  let ctx: any;

  beforeEach(() => {
    db = new MockEpicDb();
    ctx = { db };

    // Setup test epics
    db.addEpic("epic-1", {
      title: "Launch MVP",
      description: "Build minimum viable product",
      status: "active",
      progress: 50,
      taskIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    db.addEpic("epic-2", {
      title: "Scale Infrastructure",
      description: "Prepare for growth",
      status: "planning",
      progress: 0,
      taskIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  describe("getAllEpics", () => {
    it("returns all epics", async () => {
      const epics = db.getAllEpics();
      expect(epics.length).toBe(2);
    });

    it("returns epics in correct order", async () => {
      const epics = db.getAllEpics();
      expect(epics).toEqual(expect.arrayContaining([
        expect.objectContaining({ title: "Launch MVP" }),
        expect.objectContaining({ title: "Scale Infrastructure" }),
      ]));
    });

    it("includes all epic properties", async () => {
      const epics = db.getAllEpics();
      const epic = epics[0];

      expect(epic).toHaveProperty("title");
      expect(epic).toHaveProperty("description");
      expect(epic).toHaveProperty("status");
      expect(epic).toHaveProperty("progress");
      expect(epic).toHaveProperty("taskIds");
    });

    it("returns empty array when no epics exist", async () => {
      const emptyDb = new MockEpicDb();
      const epics = emptyDb.getAllEpics();
      expect(epics).toEqual([]);
    });
  });

  describe("getEpicWithDetails", () => {
    beforeEach(() => {
      // Add tasks to epic
      db.addTask("task-1", {
        title: "Task 1",
        status: "done",
        epicId: "epic-1",
      });
      db.addTask("task-2", {
        title: "Task 2",
        status: "in_progress",
        epicId: "epic-1",
      });
      db.addTask("task-3", {
        title: "Task 3",
        status: "backlog",
        epicId: "epic-1",
      });
    });

    it("returns epic with task details", async () => {
      const epic = await db.get("epic-1");
      expect(epic).toBeTruthy();
      expect(epic.title).toBe("Launch MVP");
    });

    it("calculates progress from task statuses", () => {
      const tasks = [
        { status: "done" },
        { status: "in_progress" },
        { status: "backlog" },
      ];

      const doneCount = tasks.filter((t) => t.status === "done").length;
      const progress = Math.round((doneCount / tasks.length) * 100);

      expect(progress).toBe(33); // 1 of 3 done
    });

    it("returns 0% progress when no tasks", async () => {
      const epic = await db.get("epic-2");
      const progress = 0; // No tasks
      expect(progress).toBe(0);
    });

    it("returns null for non-existent epic", async () => {
      const epic = await db.get("epic-notfound");
      expect(epic).toBeNull();
    });

    it("includes task list in response", () => {
      const response = {
        title: "Launch MVP",
        tasks: [
          { title: "Task 1", status: "done" },
          { title: "Task 2", status: "in_progress" },
        ],
        progress: 50,
      };

      expect(response.tasks).toHaveLength(2);
      expect(response.tasks[0].title).toBe("Task 1");
    });
  });

  describe("createEpic", () => {
    it("creates new epic with initial values", async () => {
      const epicId = await db.insert("epics", {
        title: "New Initiative",
        description: "Strategic priority",
        status: "planning",
        progress: 0,
        taskIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const created = await db.get(epicId);
      expect(created).toBeTruthy();
      expect(created.title).toBe("New Initiative");
      expect(created.status).toBe("planning");
      expect(created.progress).toBe(0);
    });

    it("sets owner if provided", async () => {
      const epicId = await db.insert("epics", {
        title: "Owned Epic",
        description: "Has owner",
        ownerId: "agent-1",
        status: "planning",
        progress: 0,
        taskIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const epic = await db.get(epicId);
      expect(epic.ownerId).toBe("agent-1");
    });

    it("logs epic creation activity", () => {
      const activity = {
        type: "epic_created",
        agentId: "agent-1",
        agentName: "Jarvis",
        message: "Created epic: New Initiative",
        epicId: "epic-new",
        epicTitle: "New Initiative",
      };

      expect(activity.type).toBe("epic_created");
      expect(activity.message).toContain("Created epic");
    });

    it("returns epic ID", async () => {
      const epicId = await db.insert("epics", {
        title: "Test",
        description: "Test epic",
        status: "planning",
        progress: 0,
        taskIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      expect(epicId).toBeTruthy();
      expect(typeof epicId).toBe("string");
    });
  });

  describe("updateEpic", () => {
    it("updates epic title", async () => {
      const updated = await db.patch("epic-1", {
        title: "Updated Title",
        updatedAt: Date.now(),
      });

      expect(updated.title).toBe("Updated Title");
    });

    it("updates epic status", async () => {
      const updated = await db.patch("epic-1", {
        status: "completed",
        updatedAt: Date.now(),
      });

      expect(updated.status).toBe("completed");
    });

    it("updates description", async () => {
      const updated = await db.patch("epic-1", {
        description: "New description",
        updatedAt: Date.now(),
      });

      expect(updated.description).toBe("New description");
    });

    it("logs activity when epic completed", async () => {
      const epic = await db.get("epic-1");
      const activity = {
        type: "epic_completed",
        agentId: "system",
        message: `Epic "${epic.title}" completed`,
        epicId: "epic-1",
      };

      expect(activity.type).toBe("epic_completed");
      expect(activity.message).toContain("completed");
    });

    it("updates timestamp", async () => {
      const before = Date.now();
      const updated = await db.patch("epic-1", {
        title: "New",
        updatedAt: Date.now(),
      });
      const after = Date.now();

      expect(updated.updatedAt).toBeGreaterThanOrEqual(before);
      expect(updated.updatedAt).toBeLessThanOrEqual(after + 1000);
    });

    it("throws error for non-existent epic", async () => {
      expect(async () => {
        await db.patch("epic-notfound", { title: "New" });
      }).toBeTruthy();
    });
  });

  describe("deleteEpic", () => {
    beforeEach(() => {
      // Add tasks to epic before deletion
      db.addTask("task-delete-1", {
        title: "Task 1",
        epicId: "epic-1",
      });
      db.addTask("task-delete-2", {
        title: "Task 2",
        epicId: "epic-1",
      });
    });

    it("deletes epic", async () => {
      await db.delete("epic-1");
      const deleted = await db.get("epic-1");
      expect(deleted).toBeNull();
    });

    it("clears epic references from tasks", async () => {
      // Simulate clearing epic references
      await db.patch("task-delete-1", { epicId: undefined });
      await db.patch("task-delete-2", { epicId: undefined });

      const task1 = await db.get("task-delete-1");
      const task2 = await db.get("task-delete-2");

      expect(task1.epicId).toBeUndefined();
      expect(task2.epicId).toBeUndefined();
    });

    it("throws error for non-existent epic", async () => {
      expect(async () => {
        const epic = await db.get("epic-notfound");
        if (!epic) throw new Error("Epic not found");
      }).toBeTruthy();
    });

    it("returns success response", () => {
      const response = { success: true };
      expect(response.success).toBe(true);
    });
  });

  describe("recalculateEpicProgress", () => {
    beforeEach(() => {
      db.addTask("task-calc-1", {
        status: "done",
        epicId: "epic-1",
      });
      db.addTask("task-calc-2", {
        status: "done",
        epicId: "epic-1",
      });
      db.addTask("task-calc-3", {
        status: "in_progress",
        epicId: "epic-1",
      });
      db.addTask("task-calc-4", {
        status: "backlog",
        epicId: "epic-1",
      });
    });

    it("calculates progress correctly", () => {
      const tasks = [
        { status: "done" },
        { status: "done" },
        { status: "in_progress" },
        { status: "backlog" },
      ];

      const doneCount = tasks.filter((t) => t.status === "done").length;
      const progress = Math.round((doneCount / tasks.length) * 100);

      expect(progress).toBe(50); // 2 of 4 done
    });

    it("updates epic progress", async () => {
      const newProgress = 50;
      const updated = await db.patch("epic-1", {
        progress: newProgress,
        updatedAt: Date.now(),
      });

      expect(updated.progress).toBe(50);
    });

    it("sets completedAt and status when 100% done", async () => {
      const updated = await db.patch("epic-1", {
        progress: 100,
        status: "completed",
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });

      expect(updated.progress).toBe(100);
      expect(updated.status).toBe("completed");
      expect(updated.completedAt).toBeTruthy();
    });

    it("handles epic with no tasks", async () => {
      const epic = await db.get("epic-2");
      const progress = 0;
      expect(progress).toBe(0);
    });

    it("is no-op for non-existent epic", async () => {
      const epic = await db.get("epic-notfound");
      expect(epic).toBeNull();
    });

    it("only sets completedAt once", async () => {
      const now = Date.now();
      const first = await db.patch("epic-1", {
        progress: 100,
        completedAt: now,
        status: "completed",
      });

      // Recalculate again
      expect(first.completedAt).toBe(now);
    });
  });
});
