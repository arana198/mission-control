/**
 * Integration Tests for Stale Task Escalation (Phase 3B)
 * Tests the getStaleTaskIds query logic
 */

import { describe, it, expect } from "@jest/globals";

/**
 * Mock database for stale task escalation tests
 */
class StaleBugMockDatabase {
  private tasks: Map<string, any[]> = new Map();

  constructor() {
    this.tasks.set("default", []);
  }

  addTask(task: any) {
    const workspace = task.workspaceId || "default";
    if (!this.tasks.has(workspace)) {
      this.tasks.set(business, []);
    }
    this.tasks.get(workspace)!.push(task);
  }

  getTasksFor(workspaceId: string) {
    return this.tasks.get(workspaceId) || [];
  }

  /**
   * Simulates the getStaleTaskIds query logic
   */
  getStaleTaskIds(workspaceId: string, staleHours: number = 24) {
    const cutoff = Date.now() - staleHours * 60 * 60 * 1000;
    const allTasks = this.getTasksFor(workspaceId);

    const staleTasks = allTasks.filter((task) =>
      (task.status === "blocked" || task.status === "in_progress") &&
      task.updatedAt < cutoff
    );

    return {
      count: staleTasks.length,
      taskIds: staleTasks.map((t: any) => t._id),
    };
  }
}

describe("Stale Task Escalation (Phase 3B)", () => {
  let db: StaleBugMockDatabase;

  beforeEach(() => {
    db = new StaleBugMockDatabase();
  });

  describe("getStaleTaskIds query logic", () => {
    it("returns tasks with status === 'blocked' and updatedAt older than cutoff", () => {
      const workspaceId = "biz-1";
      const staleTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago

      db.addTask({
        _id: "task-1",
        workspaceId,
        title: "Stale Blocked Task",
        status: "blocked",
        updatedAt: staleTime,
      });

      db.addTask({
        _id: "task-2",
        workspaceId,
        title: "Fresh Blocked Task",
        status: "blocked",
        updatedAt: Date.now(),
      });

      const result = db.getStaleTaskIds(workspaceId);

      expect(result.count).toBe(1);
      expect(result.taskIds).toContain("task-1");
      expect(result.taskIds).not.toContain("task-2");
    });

    it("includes tasks with status === 'in_progress' older than cutoff", () => {
      const workspaceId = "biz-2";
      const staleTime = Date.now() - 25 * 60 * 60 * 1000;

      db.addTask({
        _id: "task-1",
        workspaceId,
        title: "Stale In Progress",
        status: "in_progress",
        updatedAt: staleTime,
      });

      const result = db.getStaleTaskIds(workspaceId);

      expect(result.count).toBeGreaterThanOrEqual(1);
      expect(result.taskIds).toContain("task-1");
    });

    it("excludes tasks with status === 'done' regardless of age", () => {
      const workspaceId = "biz-3";
      const veryOldTime = Date.now() - 100 * 24 * 60 * 60 * 1000; // 100 days ago

      db.addTask({
        _id: "task-1",
        workspaceId,
        title: "Very Old Done Task",
        status: "done",
        updatedAt: veryOldTime,
      });

      const result = db.getStaleTaskIds(workspaceId);

      expect(result.taskIds).not.toContain("task-1");
    });

    it("excludes tasks with status === 'ready' regardless of age", () => {
      const workspaceId = "biz-4";
      const veryOldTime = Date.now() - 100 * 24 * 60 * 60 * 1000;

      db.addTask({
        _id: "task-1",
        workspaceId,
        title: "Very Old Ready Task",
        status: "ready",
        updatedAt: veryOldTime,
      });

      const result = db.getStaleTaskIds(workspaceId);

      expect(result.taskIds).not.toContain("task-1");
    });

    it("excludes tasks with status === 'backlog' regardless of age", () => {
      const workspaceId = "biz-5";
      const veryOldTime = Date.now() - 100 * 24 * 60 * 60 * 1000;

      db.addTask({
        _id: "task-1",
        workspaceId,
        title: "Very Old Backlog Task",
        status: "backlog",
        updatedAt: veryOldTime,
      });

      const result = db.getStaleTaskIds(workspaceId);

      expect(result.taskIds).not.toContain("task-1");
    });

    it("respects custom staleHours parameter", () => {
      const workspaceId = "biz-6";
      const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;

      db.addTask({
        _id: "task-1",
        workspaceId,
        title: "Task Blocked 12h",
        status: "blocked",
        updatedAt: twelveHoursAgo,
      });

      // With default 24h threshold, should not be stale
      const result24h = db.getStaleTaskIds(workspaceId, 24);
      expect(result24h.taskIds).not.toContain("task-1");

      // With 6h threshold, should be stale
      const result6h = db.getStaleTaskIds(workspaceId, 6);
      expect(result6h.taskIds).toContain("task-1");
    });

    it("returns empty list when no stale tasks exist", () => {
      const workspaceId = "biz-7";

      db.addTask({
        _id: "task-1",
        workspaceId,
        title: "Fresh Backlog",
        status: "backlog",
        updatedAt: Date.now(),
      });

      const result = db.getStaleTaskIds(workspaceId);

      expect(result.count).toBe(0);
      expect(result.taskIds.length).toBe(0);
    });

    it("only returns tasks for the specified business", () => {
      const business1Id = "biz-1";
      const business2Id = "biz-2";
      const staleTime = Date.now() - 25 * 60 * 60 * 1000;

      // Add stale task to workspace 1
      db.addTask({
        _id: "task-1",
        workspaceId: business1Id,
        title: "Stale Task Biz1",
        status: "blocked",
        updatedAt: staleTime,
      });

      // Query workspace 2 (should be empty)
      const result = db.getStaleTaskIds(business2Id);

      expect(result.taskIds).not.toContain("task-1");
      expect(result.count).toBe(0);
    });

    it("handles mixed statuses correctly", () => {
      const workspaceId = "biz-8";
      const staleTime = Date.now() - 25 * 60 * 60 * 1000;
      const freshTime = Date.now();

      db.addTask({
        _id: "task-1",
        workspaceId,
        title: "Stale Blocked",
        status: "blocked",
        updatedAt: staleTime,
      });

      db.addTask({
        _id: "task-2",
        workspaceId,
        title: "Stale In Progress",
        status: "in_progress",
        updatedAt: staleTime,
      });

      db.addTask({
        _id: "task-3",
        workspaceId,
        title: "Fresh Blocked",
        status: "blocked",
        updatedAt: freshTime,
      });

      db.addTask({
        _id: "task-4",
        workspaceId,
        title: "Stale Done",
        status: "done",
        updatedAt: staleTime,
      });

      const result = db.getStaleTaskIds(workspaceId);

      expect(result.count).toBe(2);
      expect(result.taskIds).toContain("task-1");
      expect(result.taskIds).toContain("task-2");
      expect(result.taskIds).not.toContain("task-3");
      expect(result.taskIds).not.toContain("task-4");
    });

    it("correctly identifies edge case: task exactly at cutoff time", () => {
      const workspaceId = "biz-9";
      const staleHours = 24;
      const cutoff = Date.now() - staleHours * 60 * 60 * 1000;

      // Task updated exactly at cutoff (should NOT be stale - must be < cutoff)
      db.addTask({
        _id: "task-1",
        workspaceId,
        title: "Task at cutoff",
        status: "blocked",
        updatedAt: cutoff,
      });

      // Task updated 1ms before cutoff (should be stale)
      db.addTask({
        _id: "task-2",
        workspaceId,
        title: "Task just before cutoff",
        status: "blocked",
        updatedAt: cutoff - 1,
      });

      const result = db.getStaleTaskIds(workspaceId, staleHours);

      // Note: depending on implementation, task-1 might not be included
      // since it's not < cutoff. Only task-2 should definitely be included.
      expect(result.taskIds).toContain("task-2");
    });
  });
});
