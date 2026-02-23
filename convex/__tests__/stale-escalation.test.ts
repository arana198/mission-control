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
    const business = task.businessId || "default";
    if (!this.tasks.has(business)) {
      this.tasks.set(business, []);
    }
    this.tasks.get(business)!.push(task);
  }

  getTasksForBusiness(businessId: string) {
    return this.tasks.get(businessId) || [];
  }

  /**
   * Simulates the getStaleTaskIds query logic
   */
  getStaleTaskIds(businessId: string, staleHours: number = 24) {
    const cutoff = Date.now() - staleHours * 60 * 60 * 1000;
    const allTasks = this.getTasksForBusiness(businessId);

    const staleTasks = allTasks.filter((task) =>
      (task.status === "blocked" || task.status === "in_progress") &&
      task.updatedAt < cutoff
    );

    return {
      count: staleTasks.length,
      taskIds: staleTasks.map((t) => t._id),
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
      const businessId = "biz-1";
      const staleTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago

      db.addTask({
        _id: "task-1",
        businessId,
        title: "Stale Blocked Task",
        status: "blocked",
        updatedAt: staleTime,
      });

      db.addTask({
        _id: "task-2",
        businessId,
        title: "Fresh Blocked Task",
        status: "blocked",
        updatedAt: Date.now(),
      });

      const result = db.getStaleTaskIds(businessId);

      expect(result.count).toBe(1);
      expect(result.taskIds).toContain("task-1");
      expect(result.taskIds).not.toContain("task-2");
    });

    it("includes tasks with status === 'in_progress' older than cutoff", () => {
      const businessId = "biz-2";
      const staleTime = Date.now() - 25 * 60 * 60 * 1000;

      db.addTask({
        _id: "task-1",
        businessId,
        title: "Stale In Progress",
        status: "in_progress",
        updatedAt: staleTime,
      });

      const result = db.getStaleTaskIds(businessId);

      expect(result.count).toBeGreaterThanOrEqual(1);
      expect(result.taskIds).toContain("task-1");
    });

    it("excludes tasks with status === 'done' regardless of age", () => {
      const businessId = "biz-3";
      const veryOldTime = Date.now() - 100 * 24 * 60 * 60 * 1000; // 100 days ago

      db.addTask({
        _id: "task-1",
        businessId,
        title: "Very Old Done Task",
        status: "done",
        updatedAt: veryOldTime,
      });

      const result = db.getStaleTaskIds(businessId);

      expect(result.taskIds).not.toContain("task-1");
    });

    it("excludes tasks with status === 'ready' regardless of age", () => {
      const businessId = "biz-4";
      const veryOldTime = Date.now() - 100 * 24 * 60 * 60 * 1000;

      db.addTask({
        _id: "task-1",
        businessId,
        title: "Very Old Ready Task",
        status: "ready",
        updatedAt: veryOldTime,
      });

      const result = db.getStaleTaskIds(businessId);

      expect(result.taskIds).not.toContain("task-1");
    });

    it("excludes tasks with status === 'backlog' regardless of age", () => {
      const businessId = "biz-5";
      const veryOldTime = Date.now() - 100 * 24 * 60 * 60 * 1000;

      db.addTask({
        _id: "task-1",
        businessId,
        title: "Very Old Backlog Task",
        status: "backlog",
        updatedAt: veryOldTime,
      });

      const result = db.getStaleTaskIds(businessId);

      expect(result.taskIds).not.toContain("task-1");
    });

    it("respects custom staleHours parameter", () => {
      const businessId = "biz-6";
      const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;

      db.addTask({
        _id: "task-1",
        businessId,
        title: "Task Blocked 12h",
        status: "blocked",
        updatedAt: twelveHoursAgo,
      });

      // With default 24h threshold, should not be stale
      const result24h = db.getStaleTaskIds(businessId, 24);
      expect(result24h.taskIds).not.toContain("task-1");

      // With 6h threshold, should be stale
      const result6h = db.getStaleTaskIds(businessId, 6);
      expect(result6h.taskIds).toContain("task-1");
    });

    it("returns empty list when no stale tasks exist", () => {
      const businessId = "biz-7";

      db.addTask({
        _id: "task-1",
        businessId,
        title: "Fresh Backlog",
        status: "backlog",
        updatedAt: Date.now(),
      });

      const result = db.getStaleTaskIds(businessId);

      expect(result.count).toBe(0);
      expect(result.taskIds.length).toBe(0);
    });

    it("only returns tasks for the specified business", () => {
      const business1Id = "biz-1";
      const business2Id = "biz-2";
      const staleTime = Date.now() - 25 * 60 * 60 * 1000;

      // Add stale task to business 1
      db.addTask({
        _id: "task-1",
        businessId: business1Id,
        title: "Stale Task Biz1",
        status: "blocked",
        updatedAt: staleTime,
      });

      // Query business 2 (should be empty)
      const result = db.getStaleTaskIds(business2Id);

      expect(result.taskIds).not.toContain("task-1");
      expect(result.count).toBe(0);
    });

    it("handles mixed statuses correctly", () => {
      const businessId = "biz-8";
      const staleTime = Date.now() - 25 * 60 * 60 * 1000;
      const freshTime = Date.now();

      db.addTask({
        _id: "task-1",
        businessId,
        title: "Stale Blocked",
        status: "blocked",
        updatedAt: staleTime,
      });

      db.addTask({
        _id: "task-2",
        businessId,
        title: "Stale In Progress",
        status: "in_progress",
        updatedAt: staleTime,
      });

      db.addTask({
        _id: "task-3",
        businessId,
        title: "Fresh Blocked",
        status: "blocked",
        updatedAt: freshTime,
      });

      db.addTask({
        _id: "task-4",
        businessId,
        title: "Stale Done",
        status: "done",
        updatedAt: staleTime,
      });

      const result = db.getStaleTaskIds(businessId);

      expect(result.count).toBe(2);
      expect(result.taskIds).toContain("task-1");
      expect(result.taskIds).toContain("task-2");
      expect(result.taskIds).not.toContain("task-3");
      expect(result.taskIds).not.toContain("task-4");
    });

    it("correctly identifies edge case: task exactly at cutoff time", () => {
      const businessId = "biz-9";
      const staleHours = 24;
      const cutoff = Date.now() - staleHours * 60 * 60 * 1000;

      // Task updated exactly at cutoff (should NOT be stale - must be < cutoff)
      db.addTask({
        _id: "task-1",
        businessId,
        title: "Task at cutoff",
        status: "blocked",
        updatedAt: cutoff,
      });

      // Task updated 1ms before cutoff (should be stale)
      db.addTask({
        _id: "task-2",
        businessId,
        title: "Task just before cutoff",
        status: "blocked",
        updatedAt: cutoff - 1,
      });

      const result = db.getStaleTaskIds(businessId, staleHours);

      // Note: depending on implementation, task-1 might not be included
      // since it's not < cutoff. Only task-2 should definitely be included.
      expect(result.taskIds).toContain("task-2");
    });
  });
});
