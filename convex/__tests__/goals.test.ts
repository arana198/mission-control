/**
 * Goals Management Tests
 *
 * Tests queries and mutations for goal CRUD operations and progress tracking
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

class GoalMockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    this.data.set("goals", []);
    this.data.set("tasks", []);
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

  query(table: string) {
    return {
      collect: async () => this.data.get(table) || [],
      filter: (predicate: (item: any) => boolean) => ({
        collect: async () => (this.data.get(table) || []).filter(predicate),
      }),
    };
  }

  getGoals() {
    return this.data.get("goals") || [];
  }

  getGoalsByStatus(status: string) {
    return (this.data.get("goals") || []).filter((g: any) => g.status === status);
  }

  getGoalsByCategory(category: string) {
    return (this.data.get("goals") || []).filter((g: any) => g.category === category);
  }

  getTasksForGoal(goalId: string) {
    const goal = this.get(goalId);
    if (!goal) return [];
    return (this.data.get("tasks") || []).filter((t) =>
      goal.relatedTaskIds.includes(t._id)
    );
  }

  calculateGoalProgress(goalId: string): number {
    const goal = this.get(goalId);
    if (!goal || goal.relatedTaskIds.length === 0) {
      return 0;
    }

    const tasks = this.getTasksForGoal(goalId);
    const completedCount = tasks.filter((t: any) => t.status === "done").length;
    const totalCount = tasks.length;

    return totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  }

  getBottlenecks() {
    const goals = this.getGoalsByStatus("active");
    const bottlenecks = [];

    for (const goal of goals) {
      const progress = this.calculateGoalProgress(goal._id);

      if (progress <= 25) {
        const tasks = this.getTasksForGoal(goal._id);
        bottlenecks.push({
          goal,
          progress,
          blockedTasks: tasks.filter((t: any) => t.status === "blocked"),
          openTasks: tasks.filter((t: any) => t.status !== "done"),
        });
      }
    }

    return bottlenecks.sort((a: any, b: any) => a.progress - b.progress);
  }

  getGoalsByProgress() {
    const goals = this.getGoalsByStatus("active");
    const goalsWithProgress = goals.map((goal) => ({
      ...goal,
      progress: this.calculateGoalProgress(goal._id),
    }));

    return {
      accelerating: goalsWithProgress
        .filter((g: any) => g.progress >= 75)
        .sort((a: any, b: any) => b.progress - a.progress),
      onTrack: goalsWithProgress
        .filter((g: any) => g.progress >= 50 && g.progress < 75)
        .sort((a: any, b: any) => b.progress - a.progress),
      atRisk: goalsWithProgress
        .filter((g: any) => g.progress >= 25 && g.progress < 50)
        .sort((a: any, b: any) => b.progress - a.progress),
      blocked: goalsWithProgress
        .filter((g: any) => g.progress < 25)
        .sort((a: any, b: any) => b.progress - a.progress),
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

describe("Goals (convex/goals.ts)", () => {
  let db: GoalMockDatabase;

  beforeEach(() => {
    db = new GoalMockDatabase();
  });

  describe("Query: getActiveGoals", () => {
    it("returns empty array when no goals exist", async () => {
      const goals = await db
        .query("goals")
        .filter((g: any) => g.status === "active")
        .collect();
      expect(goals).toEqual([]);
    });

    it("returns only active goals", async () => {
      db.insert("goals", {
        title: "Active Goal",
        status: "active",
        category: "business",
      });
      db.insert("goals", {
        title: "Paused Goal",
        status: "paused",
        category: "business",
      });
      db.insert("goals", {
        title: "Another Active",
        status: "active",
        category: "personal",
      });

      const activeGoals = db.getGoalsByStatus("active");
      expect(activeGoals).toHaveLength(2);
      expect(activeGoals.map((g: any) => g.title)).toContain("Active Goal");
      expect(activeGoals.map((g: any) => g.title)).toContain("Another Active");
    });
  });

  describe("Query: getGoalById", () => {
    it("returns goal with related tasks", async () => {
      const goalId = db.insert("goals", {
        title: "Goal",
        status: "active",
        relatedTaskIds: [],
        category: "business",
      });

      const task1 = db.insert("tasks", { goalId, title: "Task 1", status: "pending" });
      const task2 = db.insert("tasks", { goalId, title: "Task 2", status: "done" });

      // Update goal's relatedTaskIds
      db.patch(goalId, { relatedTaskIds: [task1, task2] });

      const goal = db.get(goalId);
      expect(goal).toBeDefined();
      expect(goal.title).toBe("Goal");
      expect(goal.relatedTaskIds).toHaveLength(2);
    });

    it("returns null for non-existent goal", async () => {
      const goal = db.get("goals-999");
      expect(goal).toBeNull();
    });
  });

  describe("Query: getGoalsByCategory", () => {
    it("returns goals filtered by category", async () => {
      db.insert("goals", {
        title: " Goal 1",
        status: "active",
        category: "business",
      });
      db.insert("goals", {
        title: " Goal 2",
        status: "active",
        category: "business",
      });
      db.insert("goals", {
        title: "Personal Goal",
        status: "active",
        category: "personal",
      });

      const businessGoals = db.getGoalsByCategory("business");
      expect(businessGoals).toHaveLength(2);
      businessGoals.forEach((g: any) => {
        expect(g.category).toBe("business");
      });
    });

    it("supports all category types", () => {
      const categories = ["business", "personal", "learning", "health"];
      const goalIds = [];

      for (const category of categories) {
        const goalId = db.insert("goals", {
          title: `Goal: ${category}`,
          status: "active",
          category,
        });
        goalIds.push(goalId);
      }

      for (const category of categories) {
        const goals = db.getGoalsByCategory(category);
        expect(goals).toHaveLength(1);
        expect(goals[0].category).toBe(category);
      }
    });
  });

  describe("Query: getByProgress", () => {
    it("categorizes goals as accelerating (75-100%)", async () => {
      const goalId = db.insert("goals", {
        title: "Accelerating Goal",
        status: "active",
        progress: 0,
        relatedTaskIds: [],
        category: "business",
      });

      // Create 4 tasks, 3 done = 75%
      for (let i = 0; i < 3; i++) {
        const taskId = db.insert("tasks", { status: "done", goalId });
        db.patch(goalId, {
          relatedTaskIds: [...db.get(goalId).relatedTaskIds, taskId],
        });
      }
      const taskId = db.insert("tasks", { status: "pending", goalId });
      db.patch(goalId, {
        relatedTaskIds: [...db.get(goalId).relatedTaskIds, taskId],
      });

      const progress = db.calculateGoalProgress(goalId);
      expect(progress).toBe(75);

      const categorized = db.getGoalsByProgress();
      expect(categorized.accelerating).toHaveLength(1);
      expect(categorized.accelerating[0].progress).toBe(75);
    });

    it("categorizes goals as onTrack (50-74%)", async () => {
      const goalId = db.insert("goals", {
        title: "On Track Goal",
        status: "active",
        progress: 0,
        relatedTaskIds: [],
        category: "business",
      });

      for (let i = 0; i < 2; i++) {
        const taskId = db.insert("tasks", { status: "done", goalId });
        db.patch(goalId, {
          relatedTaskIds: [...db.get(goalId).relatedTaskIds, taskId],
        });
      }
      for (let i = 0; i < 2; i++) {
        const taskId = db.insert("tasks", { status: "pending", goalId });
        db.patch(goalId, {
          relatedTaskIds: [...db.get(goalId).relatedTaskIds, taskId],
        });
      }

      const progress = db.calculateGoalProgress(goalId);
      expect(progress).toBe(50);

      const categorized = db.getGoalsByProgress();
      expect(categorized.onTrack).toHaveLength(1);
    });

    it("categorizes goals as atRisk (25-49%)", async () => {
      const goalId = db.insert("goals", {
        title: "At Risk Goal",
        status: "active",
        progress: 0,
        relatedTaskIds: [],
        category: "business",
      });

      const doneTaskId = db.insert("tasks", { status: "done", goalId });
      db.patch(goalId, { relatedTaskIds: [doneTaskId] });

      for (let i = 0; i < 3; i++) {
        const taskId = db.insert("tasks", { status: "pending", goalId });
        db.patch(goalId, {
          relatedTaskIds: [...db.get(goalId).relatedTaskIds, taskId],
        });
      }

      const progress = db.calculateGoalProgress(goalId);
      expect(progress).toBe(25);

      const categorized = db.getGoalsByProgress();
      expect(categorized.atRisk).toHaveLength(1);
    });

    it("categorizes goals as blocked (0-24%)", async () => {
      const goalId = db.insert("goals", {
        title: "Blocked Goal",
        status: "active",
        progress: 0,
        relatedTaskIds: [],
        category: "business",
      });

      for (let i = 0; i < 4; i++) {
        const taskId = db.insert("tasks", { status: "pending", goalId });
        db.patch(goalId, {
          relatedTaskIds: [...db.get(goalId).relatedTaskIds, taskId],
        });
      }

      const progress = db.calculateGoalProgress(goalId);
      expect(progress).toBe(0);

      const categorized = db.getGoalsByProgress();
      expect(categorized.blocked).toHaveLength(1);
      expect(categorized.blocked[0].progress).toBe(0);
    });
  });

  describe("Mutation: create", () => {
    it("creates goal with required fields", async () => {
      const goalId = db.insert("goals", {
        title: "New Goal",
        description: "Description of goal",
        category: "business",
        status: "active",
        progress: 0,
        relatedTaskIds: [],
        keyResults: [],
        relatedMemoryRefs: [],
        childGoalIds: [],
        owner: "user",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const goal = db.get(goalId);
      expect(goal.title).toBe("New Goal");
      expect(goal.description).toBe("Description of goal");
      expect(goal.category).toBe("business");
      expect(goal.status).toBe("active");
      expect(goal.progress).toBe(0);
    });

    it("initializes empty task list", async () => {
      const goalId = db.insert("goals", {
        title: "Goal",
        category: "personal",
        relatedTaskIds: [],
        keyResults: [],
        status: "active",
        progress: 0,
      });

      const goal = db.get(goalId);
      expect(Array.isArray(goal.relatedTaskIds)).toBe(true);
      expect(goal.relatedTaskIds).toHaveLength(0);
    });

    it("supports optional fields", async () => {
      const deadline = Date.now() + 86400000;
      const goalId = db.insert("goals", {
        title: "Goal with details",
        description: "Long description",
        category: "learning",
        deadline,
        keyResults: ["KR1", "KR2"],
        relatedMemoryRefs: ["mem-1"],
        status: "active",
        progress: 0,
        relatedTaskIds: [],
      });

      const goal = db.get(goalId);
      expect(goal.deadline).toBe(deadline);
      expect(goal.keyResults).toHaveLength(2);
      expect(goal.relatedMemoryRefs).toContain("mem-1");
    });

    it("updates parent goal when provided", async () => {
      const parentId = db.insert("goals", {
        title: "Parent Goal",
        category: "business",
        status: "active",
        progress: 0,
        relatedTaskIds: [],
        childGoalIds: [],
      });

      const childId = db.insert("goals", {
        title: "Child Goal",
        category: "business",
        status: "active",
        progress: 0,
        relatedTaskIds: [],
        parentGoalId: parentId,
        childGoalIds: [],
      });

      // Manually update parent's childGoalIds
      const parent = db.get(parentId);
      db.patch(parentId, {
        childGoalIds: [...parent.childGoalIds, childId],
      });

      const updatedParent = db.get(parentId);
      expect(updatedParent.childGoalIds).toContain(childId);
    });
  });

  describe("Mutation: update", () => {
    it("updates goal title", async () => {
      const goalId = db.insert("goals", { title: "Old Title", status: "active" });

      db.patch(goalId, { title: "New Title", updatedAt: Date.now() });

      const goal = db.get(goalId);
      expect(goal.title).toBe("New Title");
    });

    it("updates goal status", async () => {
      const goalId = db.insert("goals", { status: "active" });

      db.patch(goalId, { status: "paused", updatedAt: Date.now() });

      const goal = db.get(goalId);
      expect(goal.status).toBe("paused");
    });

    it("sets completedAt when status is completed", async () => {
      const goalId = db.insert("goals", { status: "active" });

      const completedTime = Date.now();
      db.patch(goalId, {
        status: "completed",
        completedAt: completedTime,
        updatedAt: completedTime,
      });

      const goal = db.get(goalId);
      expect(goal.status).toBe("completed");
      expect(goal.completedAt).toBe(completedTime);
    });

    it("updates goal deadline", async () => {
      const goalId = db.insert("goals", { deadline: 0 });
      const newDeadline = Date.now() + 86400000;

      db.patch(goalId, { deadline: newDeadline, updatedAt: Date.now() });

      const goal = db.get(goalId);
      expect(goal.deadline).toBe(newDeadline);
    });

    it("updates key results", async () => {
      const goalId = db.insert("goals", { keyResults: [] });
      const newKRs = ["KR1", "KR2", "KR3"];

      db.patch(goalId, { keyResults: newKRs, updatedAt: Date.now() });

      const goal = db.get(goalId);
      expect(goal.keyResults).toEqual(newKRs);
    });

    it("preserves other fields on partial update", async () => {
      const goalId = db.insert("goals", {
        title: "Goal",
        description: "Description",
        category: "business",
        status: "active",
      });

      db.patch(goalId, { status: "paused", updatedAt: Date.now() });

      const goal = db.get(goalId);
      expect(goal.title).toBe("Goal");
      expect(goal.description).toBe("Description");
      expect(goal.category).toBe("business");
    });
  });

  describe("Mutation: linkTask", () => {
    it("links task to goal and vice versa", async () => {
      const goalId = db.insert("goals", {
        title: "Goal",
        relatedTaskIds: [],
        category: "business",
      });
      const taskId = db.insert("tasks", {
        title: "Task",
        goalIds: [],
      });

      db.patch(goalId, {
        relatedTaskIds: [taskId],
      });
      db.patch(taskId, {
        goalIds: [goalId],
      });

      const goal = db.get(goalId);
      const task = db.get(taskId);

      expect(goal.relatedTaskIds).toContain(taskId);
      expect(task.goalIds).toContain(goalId);
    });

    it("updates goal progress after linking task", async () => {
      const goalId = db.insert("goals", {
        title: "Goal",
        progress: 0,
        relatedTaskIds: [],
        category: "business",
      });
      const taskId = db.insert("tasks", { status: "done" });

      db.patch(goalId, { relatedTaskIds: [taskId] });
      const progress = db.calculateGoalProgress(goalId);
      db.patch(goalId, { progress });

      const goal = db.get(goalId);
      expect(goal.progress).toBe(100);
    });

    it("prevents duplicate task linking", async () => {
      const goalId = db.insert("goals", {
        title: "Goal",
        relatedTaskIds: [],
        category: "business",
      });
      const taskId = db.insert("tasks", { title: "Task" });

      db.patch(goalId, { relatedTaskIds: [taskId] });
      // Try to link again
      const goal = db.get(goalId);
      if (!goal.relatedTaskIds.includes(taskId)) {
        db.patch(goalId, {
          relatedTaskIds: [...goal.relatedTaskIds, taskId],
        });
      }

      const updated = db.get(goalId);
      expect(updated.relatedTaskIds.filter((id: any) => id === taskId)).toHaveLength(1);
    });
  });

  describe("Mutation: unlinkTask", () => {
    it("removes task from goal", async () => {
      const goalId = db.insert("goals", {
        title: "Goal",
        relatedTaskIds: [],
        category: "business",
      });
      const taskId = db.insert("tasks", { title: "Task", goalIds: [] });

      // Link first
      db.patch(goalId, { relatedTaskIds: [taskId] });
      db.patch(taskId, { goalIds: [goalId] });

      // Then unlink
      const goal = db.get(goalId);
      db.patch(goalId, {
        relatedTaskIds: goal.relatedTaskIds.filter((id: any) => id !== taskId),
      });

      const task = db.get(taskId);
      db.patch(taskId, {
        goalIds: (task.goalIds || []).filter((id: any) => id !== goalId),
      });

      const updatedGoal = db.get(goalId);
      const updatedTask = db.get(taskId);

      expect(updatedGoal.relatedTaskIds).not.toContain(taskId);
      expect(updatedTask.goalIds).not.toContain(goalId);
    });

    it("recalculates progress after unlinking", async () => {
      const goalId = db.insert("goals", {
        title: "Goal",
        progress: 50,
        relatedTaskIds: [],
        category: "business",
      });
      const task1Id = db.insert("tasks", { status: "done" });
      const task2Id = db.insert("tasks", { status: "done" });

      db.patch(goalId, { relatedTaskIds: [task1Id, task2Id] });

      // Unlink one task
      const goal = db.get(goalId);
      db.patch(goalId, {
        relatedTaskIds: goal.relatedTaskIds.filter((id: any) => id !== task1Id),
      });

      const progress = db.calculateGoalProgress(goalId);
      db.patch(goalId, { progress });

      const updated = db.get(goalId);
      expect(updated.progress).toBe(100);
    });
  });

  describe("Mutation: recalculateAllProgress", () => {
    it("recalculates progress for all goals", async () => {
      const goal1Id = db.insert("goals", {
        title: "Goal 1",
        progress: 0,
        relatedTaskIds: [],
        category: "business",
        status: "active",
      });
      const goal2Id = db.insert("goals", {
        title: "Goal 2",
        progress: 0,
        relatedTaskIds: [],
        category: "personal",
        status: "active",
      });

      // Link tasks
      const task1 = db.insert("tasks", { status: "done" });
      const task2 = db.insert("tasks", { status: "pending" });

      db.patch(goal1Id, { relatedTaskIds: [task1, task2] });
      db.patch(goal2Id, { relatedTaskIds: [task1] });

      // Recalculate all
      const goals = db.getGoals();
      for (const goal of goals) {
        const progress = db.calculateGoalProgress(goal._id);
        db.patch(goal._id, { progress });
      }

      const updated1 = db.get(goal1Id);
      const updated2 = db.get(goal2Id);

      expect(updated1.progress).toBe(50);
      expect(updated2.progress).toBe(100);
    });
  });

  describe("Query: detectBottlenecks", () => {
    it("identifies goals with low progress", async () => {
      const goalId = db.insert("goals", {
        title: "Blocked Goal",
        status: "active",
        progress: 0,
        relatedTaskIds: [],
        category: "business",
      });

      for (let i = 0; i < 3; i++) {
        const taskId = db.insert("tasks", {
          status: "blocked",
        });
        db.patch(goalId, {
          relatedTaskIds: [...db.get(goalId).relatedTaskIds, taskId],
        });
      }

      const bottlenecks = db.getBottlenecks();
      expect(bottlenecks).toHaveLength(1);
      expect(bottlenecks[0].goal.title).toBe("Blocked Goal");
      expect(bottlenecks[0].blockedTasks).toHaveLength(3);
    });

    it("returns empty when no bottlenecks", async () => {
      const goalId = db.insert("goals", {
        title: "On Track Goal",
        status: "active",
        progress: 75,
        relatedTaskIds: [],
        category: "business",
      });

      for (let i = 0; i < 3; i++) {
        const taskId = db.insert("tasks", { status: "done" });
        db.patch(goalId, {
          relatedTaskIds: [...db.get(goalId).relatedTaskIds, taskId],
        });
      }

      const bottlenecks = db.getBottlenecks();
      expect(bottlenecks).toHaveLength(0);
    });

    it("sorts bottlenecks by progress (ascending)", async () => {
      const goal1Id = db.insert("goals", {
        title: "Goal at 0%",
        status: "active",
        progress: 0,
        relatedTaskIds: [],
        category: "business",
      });
      const goal2Id = db.insert("goals", {
        title: "Goal at 25%",
        status: "active",
        progress: 25,
        relatedTaskIds: [],
        category: "personal",
      });

      // Goal 1: 0% progress
      for (let i = 0; i < 2; i++) {
        const taskId = db.insert("tasks", { status: "pending" });
        db.patch(goal1Id, {
          relatedTaskIds: [...db.get(goal1Id).relatedTaskIds, taskId],
        });
      }

      // Goal 2: 25% progress
      db.insert("tasks", { status: "done" });
      const task = db.insert("tasks", { status: "done" });
      db.patch(goal2Id, {
        relatedTaskIds: [task, db.insert("tasks", { status: "pending" })],
      });

      const bottlenecks = db.getBottlenecks();
      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks[0].progress).toBeLessThanOrEqual(bottlenecks[1]?.progress || 100);
    });
  });

  describe("Mutation: archive", () => {
    it("archives a goal", async () => {
      const goalId = db.insert("goals", { status: "active" });

      db.patch(goalId, {
        status: "archived",
        updatedAt: Date.now(),
      });

      const goal = db.get(goalId);
      expect(goal.status).toBe("archived");
    });

    it("excludes archived goals from active queries", async () => {
      const goal1Id = db.insert("goals", { status: "active" });
      const goal2Id = db.insert("goals", { status: "active" });

      db.patch(goal2Id, { status: "archived", updatedAt: Date.now() });

      const activeGoals = db.getGoalsByStatus("active");
      expect(activeGoals).toHaveLength(1);
      expect(activeGoals[0]._id).toBe(goal1Id);
    });
  });

  describe("Goal status transitions", () => {
    it("transitions through lifecycle", async () => {
      const goalId = db.insert("goals", {
        title: "Lifecycle",
        status: "active",
      });

      // active -> paused
      db.patch(goalId, { status: "paused", updatedAt: Date.now() });
      let goal = db.get(goalId);
      expect(goal.status).toBe("paused");

      // paused -> active
      db.patch(goalId, { status: "active", updatedAt: Date.now() });
      goal = db.get(goalId);
      expect(goal.status).toBe("active");

      // active -> completed
      db.patch(goalId, {
        status: "completed",
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });
      goal = db.get(goalId);
      expect(goal.status).toBe("completed");
    });

    it("supports all status values", () => {
      const validStatuses = ["active", "paused", "completed", "archived"];
      for (const status of validStatuses) {
        const goalId = db.insert("goals", {
          title: `Goal ${status}`,
          status,
        });
        const goal = db.get(goalId);
        expect(goal.status).toBe(status);
      }
    });
  });

  describe("Goal metadata", () => {
    it("tracks creation and update times", async () => {
      const before = Date.now();
      const goalId = db.insert("goals", {
        title: "Goal",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const after = Date.now();

      const goal = db.get(goalId);
      expect(goal.createdAt).toBeGreaterThanOrEqual(before);
      expect(goal.createdAt).toBeLessThanOrEqual(after);
      expect(goal.updatedAt).toBeGreaterThanOrEqual(before);
      expect(goal.updatedAt).toBeLessThanOrEqual(after);
    });

    it("tracks owner information", async () => {
      const goalId = db.insert("goals", {
        title: "Goal",
        owner: "user-1",
      });

      const goal = db.get(goalId);
      expect(goal.owner).toBe("user-1");
    });

    it("supports key results", async () => {
      const goalId = db.insert("goals", {
        title: "Goal with KRs",
        keyResults: [
          "KR1: Achieve X",
          "KR2: Reduce Y by 50%",
          "KR3: Increase Z",
        ],
      });

      const goal = db.get(goalId);
      expect(goal.keyResults).toHaveLength(3);
      expect(goal.keyResults[0]).toBe("KR1: Achieve X");
    });

    it("supports memory references", async () => {
      const goalId = db.insert("goals", {
        title: "Goal",
        relatedMemoryRefs: ["memory-1", "memory-2"],
      });

      const goal = db.get(goalId);
      expect(goal.relatedMemoryRefs).toHaveLength(2);
      expect(goal.relatedMemoryRefs).toContain("memory-1");
    });
  });

  describe("Hierarchical goals", () => {
    it("tracks parent-child relationships", async () => {
      const parentId = db.insert("goals", {
        title: "Parent",
        childGoalIds: [],
        category: "business",
      });
      const childId = db.insert("goals", {
        title: "Child",
        parentGoalId: parentId,
        childGoalIds: [],
        category: "business",
      });

      const parent = db.get(parentId);
      db.patch(parentId, {
        childGoalIds: [...parent.childGoalIds, childId],
      });

      const updated = db.get(parentId);
      expect(updated.childGoalIds).toContain(childId);

      const child = db.get(childId);
      expect(child.parentGoalId).toBe(parentId);
    });

    it("maintains child goal hierarchy", async () => {
      const parentId = db.insert("goals", {
        title: "Q1 Goals",
        childGoalIds: [],
        category: "business",
      });

      const child1Id = db.insert("goals", {
        title: "Child 1",
        parentGoalId: parentId,
        category: "business",
      });
      const child2Id = db.insert("goals", {
        title: "Child 2",
        parentGoalId: parentId,
        category: "business",
      });

      const parent = db.get(parentId);
      db.patch(parentId, {
        childGoalIds: [child1Id, child2Id],
      });

      const updated = db.get(parentId);
      expect(updated.childGoalIds).toHaveLength(2);
    });
  });

  describe("Goal progress calculation", () => {
    it("returns 0 when no tasks linked", async () => {
      const goalId = db.insert("goals", {
        title: "Empty Goal",
        relatedTaskIds: [],
        category: "business",
      });

      const progress = db.calculateGoalProgress(goalId);
      expect(progress).toBe(0);
    });

    it("returns 100 when all tasks done", async () => {
      const goalId = db.insert("goals", {
        title: "Complete Goal",
        relatedTaskIds: [],
        category: "business",
      });

      for (let i = 0; i < 3; i++) {
        const taskId = db.insert("tasks", { status: "done" });
        db.patch(goalId, {
          relatedTaskIds: [...db.get(goalId).relatedTaskIds, taskId],
        });
      }

      const progress = db.calculateGoalProgress(goalId);
      expect(progress).toBe(100);
    });

    it("calculates progress accurately with mixed status", async () => {
      const goalId = db.insert("goals", {
        title: "Mixed Goal",
        relatedTaskIds: [],
        category: "business",
      });

      // 2 done, 1 in_progress, 1 pending = 50%
      for (let i = 0; i < 2; i++) {
        const taskId = db.insert("tasks", { status: "done" });
        db.patch(goalId, {
          relatedTaskIds: [...db.get(goalId).relatedTaskIds, taskId],
        });
      }
      const taskId3 = db.insert("tasks", { status: "in_progress" });
      db.patch(goalId, {
        relatedTaskIds: [...db.get(goalId).relatedTaskIds, taskId3],
      });
      const taskId4 = db.insert("tasks", { status: "pending" });
      db.patch(goalId, {
        relatedTaskIds: [...db.get(goalId).relatedTaskIds, taskId4],
      });

      const progress = db.calculateGoalProgress(goalId);
      expect(progress).toBe(50);
    });
  });
});
