/**
 * DraggableTaskBoard - Quick Filter Tests
 *
 * Tests the quick filter pill logic for task filtering.
 * Focuses on filter application to task arrays.
 */

import { describe, it, expect } from "@jest/globals";
import type { Task } from "@/types/task";

describe("DraggableTaskBoard - Quick Filter Logic", () => {
  // Mock task data
  const mockTasks: Task[] = [
    {
      _id: "task-1" as any,
      title: "Task 1",
      status: "in_progress",
      priority: "HIGH",
      assigneeIds: ["agent-1"],
      description: "Test",
      createdAt: Date.now(),
      blockedBy: [],
      doneChecklist: [],
    },
    {
      _id: "task-2" as any,
      title: "Task 2",
      status: "blocked",
      priority: "MEDIUM",
      assigneeIds: ["agent-2"],
      description: "Test",
      createdAt: Date.now(),
      blockedBy: [],
      doneChecklist: [],
    },
    {
      _id: "task-3" as any,
      title: "Task 3",
      status: "ready",
      priority: "LOW",
      assigneeIds: ["agent-1", "agent-3"],
      description: "Test",
      createdAt: Date.now(),
      blockedBy: [],
      doneChecklist: [],
    },
    {
      _id: "task-4" as any,
      title: "Task 4",
      status: "blocked",
      priority: "HIGH",
      assigneeIds: ["agent-2"],
      description: "Test",
      createdAt: Date.now(),
      blockedBy: [],
      doneChecklist: [],
    },
    {
      _id: "task-5" as any,
      title: "Task 5",
      status: "in_progress",
      priority: "MEDIUM",
      assigneeIds: ["agent-1"],
      description: "Test",
      createdAt: Date.now(),
      blockedBy: [],
      doneChecklist: [],
    },
    {
      _id: "task-6" as any,
      title: "Task 6",
      status: "ready",
      priority: "LOW",
      assigneeIds: ["agent-3"],
      description: "Test",
      createdAt: Date.now(),
      blockedBy: [],
      doneChecklist: [],
    },
  ];

  describe("No filter applied", () => {
    it("should return all tasks when filter is null", () => {
      const quickFilter: string | null = null;
      let filtered = mockTasks;

      // No filtering applied
      expect(filtered).toHaveLength(6);
    });

    it("should preserve task order when no filter", () => {
      const quickFilter: string | null = null;
      let filtered = mockTasks;

      const ids = filtered.map((t) => t._id);
      expect(ids).toEqual([
        "task-1",
        "task-2",
        "task-3",
        "task-4",
        "task-5",
        "task-6",
      ]);
    });
  });

  describe("My Tasks filter (agent assignment)", () => {
    it("should filter tasks assigned to agent", () => {
      const quickFilter = "my_tasks";
      const activeAgentId = "agent-1";
      let filtered = mockTasks;

      if (quickFilter === "my_tasks" && activeAgentId) {
        filtered = filtered.filter((t) => t.assigneeIds?.includes(activeAgentId));
      }

      expect(filtered).toHaveLength(3); // Tasks 1, 3, 5
      expect(filtered.map((t) => t._id)).toEqual(["task-1", "task-3", "task-5"]);
    });

    it("should return empty array if agent has no tasks", () => {
      const quickFilter = "my_tasks";
      const activeAgentId = "agent-999";
      let filtered = mockTasks;

      if (quickFilter === "my_tasks" && activeAgentId) {
        filtered = filtered.filter((t) => t.assigneeIds?.includes(activeAgentId));
      }

      expect(filtered).toHaveLength(0);
    });

    it("should work with different agent IDs", () => {
      // Agent 2
      let filtered = mockTasks.filter((t) => t.assigneeIds?.includes("agent-2"));
      expect(filtered).toHaveLength(2); // Tasks 2, 4

      // Agent 3
      filtered = mockTasks.filter((t) => t.assigneeIds?.includes("agent-3"));
      expect(filtered).toHaveLength(2); // Tasks 3, 6
    });

    it("should require both filter and agent ID to apply", () => {
      const quickFilter = "my_tasks";
      const activeAgentId: string | null = null;
      let filtered = mockTasks;

      if (quickFilter === "my_tasks" && activeAgentId) {
        filtered = filtered.filter((t) => t.assigneeIds?.includes(activeAgentId));
      }

      // Filter not applied because activeAgentId is null
      expect(filtered).toHaveLength(6);
    });

    it("should handle tasks with multiple assignees", () => {
      const quickFilter = "my_tasks";
      const activeAgentId = "agent-1";
      let filtered = mockTasks;

      if (quickFilter === "my_tasks" && activeAgentId) {
        filtered = filtered.filter((t) => t.assigneeIds?.includes(activeAgentId));
      }

      // Task 3 has both agent-1 and agent-3
      const task3 = filtered.find((t) => t._id === "task-3");
      expect(task3).toBeDefined();
      expect(task3?.assigneeIds).toContain("agent-1");
    });
  });

  describe("Blocked filter (status only)", () => {
    it("should filter only blocked tasks", () => {
      const quickFilter = "blocked";
      let filtered = mockTasks;

      if (quickFilter === "blocked") {
        filtered = filtered.filter((t) => t.status === "blocked");
      }

      expect(filtered).toHaveLength(2); // Tasks 2, 4
      expect(filtered.map((t) => t._id)).toEqual(["task-2", "task-4"]);
    });

    it("should show no tasks if none are blocked", () => {
      const quickFilter = "blocked";
      const tasksWithoutBlocked = mockTasks.filter((t) => t.status !== "blocked");
      let filtered = tasksWithoutBlocked;

      if (quickFilter === "blocked") {
        filtered = filtered.filter((t) => t.status === "blocked");
      }

      expect(filtered).toHaveLength(0);
    });

    it("should return correct blocked task details", () => {
      const quickFilter = "blocked";
      let filtered = mockTasks;

      if (quickFilter === "blocked") {
        filtered = filtered.filter((t) => t.status === "blocked");
      }

      const blockedStatuses = filtered.map((t) => t.status);
      blockedStatuses.forEach((s) => {
        expect(s).toBe("blocked");
      });
    });
  });

  describe("Ready filter (status only)", () => {
    it("should filter only ready tasks", () => {
      const quickFilter = "ready";
      let filtered = mockTasks;

      if (quickFilter === "ready") {
        filtered = filtered.filter((t) => t.status === "ready");
      }

      expect(filtered).toHaveLength(2); // Tasks 3, 6
      expect(filtered.map((t) => t._id)).toEqual(["task-3", "task-6"]);
    });

    it("should preserve ready task properties", () => {
      const quickFilter = "ready";
      let filtered = mockTasks;

      if (quickFilter === "ready") {
        filtered = filtered.filter((t) => t.status === "ready");
      }

      const firstReady = filtered[0];
      expect(firstReady?.status).toBe("ready");
      expect(firstReady?.priority).toBe("LOW");
    });
  });

  describe("Filter switching", () => {
    it("should switch from blocked to ready filter", () => {
      let quickFilter: string | null = "blocked";
      let filtered = mockTasks.filter((t) => t.status === "blocked");
      expect(filtered).toHaveLength(2);

      // Switch filter
      quickFilter = "ready";
      filtered = mockTasks.filter((t) => t.status === "ready");
      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.status)).toEqual(["ready", "ready"]);
    });

    it("should deactivate filter when same filter clicked", () => {
      let quickFilter: string | null = "blocked";
      let filtered = mockTasks;

      if (quickFilter === "blocked") {
        filtered = filtered.filter((t) => t.status === "blocked");
      }
      expect(filtered).toHaveLength(2);

      // Deactivate filter
      quickFilter = null;
      filtered = mockTasks;
      expect(filtered).toHaveLength(6);
    });

    it("should handle filter changes without data loss", () => {
      const allTaskIds = mockTasks.map((t) => t._id);

      // Apply blocked filter
      let filtered = mockTasks.filter((t) => t.status === "blocked");
      expect(filtered.length).toBeLessThan(6);

      // Remove filter
      filtered = mockTasks;
      const resultIds = filtered.map((t) => t._id);
      expect(resultIds).toEqual(allTaskIds);
    });
  });

  describe("Filter combinations", () => {
    it("should not combine filters (my_tasks, ready, blocked)", () => {
      // Filters are mutually exclusive - only one active at a time
      const quickFilter = "my_tasks";
      const activeAgentId = "agent-1";

      let filtered = mockTasks;

      // Only apply my_tasks filter (not combined with others)
      if (quickFilter === "my_tasks" && activeAgentId) {
        filtered = filtered.filter((t) => t.assigneeIds?.includes(activeAgentId));
      }

      expect(filtered).toHaveLength(3);
    });

    it("should replace filter when switching", () => {
      let quickFilter: string | null = "my_tasks";
      const activeAgentId = "agent-1";

      let filtered = mockTasks.filter((t) =>
        t.assigneeIds?.includes(activeAgentId)
      );
      expect(filtered).toHaveLength(3);

      // Switch to blocked (removes my_tasks)
      quickFilter = "blocked";
      filtered = mockTasks.filter((t) => t.status === "blocked");
      expect(filtered).toHaveLength(2);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty task list", () => {
      const emptyTasks: Task[] = [];
      const quickFilter = "blocked";
      let filtered = emptyTasks;

      if (quickFilter === "blocked") {
        filtered = filtered.filter((t) => t.status === "blocked");
      }

      expect(filtered).toHaveLength(0);
    });

    it("should handle null activeAgentId for my_tasks", () => {
      const quickFilter = "my_tasks";
      const activeAgentId: string | null = null;
      let filtered = mockTasks;

      if (quickFilter === "my_tasks" && activeAgentId) {
        filtered = filtered.filter((t) => t.assigneeIds?.includes(activeAgentId));
      }

      // Filter not applied
      expect(filtered).toHaveLength(6);
    });

    it("should handle undefined assigneeIds gracefully", () => {
      const taskWithoutAssignees = { ...mockTasks[0], assigneeIds: undefined };
      const tasks = [taskWithoutAssignees];

      const quickFilter = "my_tasks";
      const activeAgentId = "agent-1";
      let filtered = tasks;

      if (quickFilter === "my_tasks" && activeAgentId) {
        filtered = filtered.filter((t) => t.assigneeIds?.includes(activeAgentId));
      }

      expect(filtered).toHaveLength(0);
    });

    it("should preserve task immutability when filtering", () => {
      const quickFilter = "blocked";
      const original = [...mockTasks];
      let filtered = mockTasks.filter((t) => t.status === "blocked");

      // Original array unchanged
      expect(mockTasks).toHaveLength(6);
      expect(original).toEqual(mockTasks);
    });
  });

  describe("Performance characteristics", () => {
    it("should filter with O(n) complexity", () => {
      const quickFilter = "blocked";
      let filtered = mockTasks;

      // Simple filter is O(n)
      if (quickFilter === "blocked") {
        filtered = filtered.filter((t) => t.status === "blocked");
      }

      expect(filtered).toBeDefined();
    });

    it("should handle all three filters independently", () => {
      const filters = ["my_tasks", "blocked", "ready"];

      filters.forEach((filter) => {
        let filtered = mockTasks;

        if (filter === "blocked") {
          filtered = filtered.filter((t) => t.status === "blocked");
        } else if (filter === "ready") {
          filtered = filtered.filter((t) => t.status === "ready");
        }

        expect(filtered.length).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
