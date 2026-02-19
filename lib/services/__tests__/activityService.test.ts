/**
 * Activity Service Tests
 *
 * Tests activity logging functions with mock database
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  logActivity,
  logTaskCreated,
  logTaskCompleted,
  logTaskAssigned,
  logTaskStatusChanged,
  logTaskBlocked,
  logAgentStatusChanged,
  logEpicCreated,
  logDependencyAdded,
  logCommentAdded,
  logMention,
} from "../activityService";
import { ACTIVITY_TYPE } from "@/lib/constants/business";

describe("ActivityService", () => {
  let mockCtx: any;
  let mockDb: any;

  beforeEach(() => {
    // Create mock database
    mockDb = {
      entities: new Map(),
      get: jest.fn(async (id: string) => {
        return mockDb.entities.get(id) || null;
      }),
      insert: jest.fn(async (table: string, data: any) => {
        const id = `${table}-${Date.now()}`;
        mockDb.entities.set(id, { ...data, _id: id });
        return id;
      }),
    };

    mockCtx = { db: mockDb };

    // Setup test entities
    mockDb.entities.set("agent-1", { _id: "agent-1", name: "Jarvis" });
    mockDb.entities.set("task-1", { _id: "task-1", title: "Fix login bug" });
    mockDb.entities.set("epic-1", { _id: "epic-1", title: "Platform upgrade" });
  });

  describe("logActivity", () => {
    it("logs activity with required fields", async () => {
      const result = await logActivity(mockCtx, ACTIVITY_TYPE.TASK_CREATED, "agent-1", {
        taskId: "task-1",
        message: "Created task: Fix login bug",
      });

      expect(result).toBeTruthy();
      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          type: ACTIVITY_TYPE.TASK_CREATED,
          agentId: "agent-1",
          agentName: "Jarvis",
          taskTitle: "Fix login bug",
          message: "Created task: Fix login bug",
          createdAt: expect.any(Number),
        })
      );
    });

    it("fetches agent name from database", async () => {
      await logActivity(mockCtx, ACTIVITY_TYPE.TASK_CREATED, "agent-1", {
        taskId: "task-1",
        message: "Test",
      });

      expect(mockDb.get).toHaveBeenCalledWith("agent-1");
    });

    it("fetches task title from database", async () => {
      await logActivity(mockCtx, ACTIVITY_TYPE.TASK_UPDATED, "agent-1", {
        taskId: "task-1",
        message: "Updated task",
      });

      expect(mockDb.get).toHaveBeenCalledWith("task-1");
    });

    it("fetches epic title from database", async () => {
      await logActivity(mockCtx, ACTIVITY_TYPE.EPIC_CREATED, "agent-1", {
        epicId: "epic-1",
        message: "Created epic",
      });

      expect(mockDb.get).toHaveBeenCalledWith("epic-1");
    });

    it("handles missing agent gracefully", async () => {
      await logActivity(mockCtx, ACTIVITY_TYPE.TASK_CREATED, "agent-notfound", {
        taskId: "task-1",
        message: "Test",
      });

      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          agentName: "Unknown",
        })
      );
    });

    it("handles system agent", async () => {
      await logActivity(mockCtx, ACTIVITY_TYPE.TASK_CREATED, "system", {
        taskId: "task-1",
        message: "System created task",
      });

      expect(mockDb.get).not.toHaveBeenCalledWith("system");
      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          agentId: "system",
          agentName: "Unknown",
        })
      );
    });

    it("includes oldValue and newValue if provided", async () => {
      await logActivity(mockCtx, ACTIVITY_TYPE.TASK_UPDATED, "agent-1", {
        taskId: "task-1",
        message: "Status changed",
        oldValue: "backlog",
        newValue: "ready",
      });

      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          oldValue: "backlog",
          newValue: "ready",
        })
      );
    });

    it("adds timestamp to activity", async () => {
      const before = Date.now();
      await logActivity(mockCtx, ACTIVITY_TYPE.TASK_CREATED, "agent-1", {
        taskId: "task-1",
        message: "Test",
      });
      const after = Date.now();

      const call = mockDb.insert.mock.calls[0][1];
      expect(call.createdAt).toBeGreaterThanOrEqual(before);
      expect(call.createdAt).toBeLessThanOrEqual(after);
    });
  });

  describe("logTaskCreated", () => {
    it("logs task creation with correct type", async () => {
      await logTaskCreated(mockCtx, "task-1", "Fix login bug", "agent-1");

      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          type: ACTIVITY_TYPE.TASK_CREATED,
          taskId: "task-1",
          message: "Created task: Fix login bug",
        })
      );
    });

    it("uses creator as agentId", async () => {
      await logTaskCreated(mockCtx, "task-1", "New task", "agent-1");

      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          agentId: "agent-1",
        })
      );
    });
  });

  describe("logTaskCompleted", () => {
    it("logs task completion", async () => {
      await logTaskCompleted(mockCtx, "task-1", "Fix login bug", "agent-1");

      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          type: ACTIVITY_TYPE.TASK_COMPLETED,
          taskId: "task-1",
          message: "Completed task: Fix login bug",
        })
      );
    });
  });

  describe("logTaskAssigned", () => {
    it("logs single assignee", async () => {
      await logTaskAssigned(mockCtx, "task-1", "Fix bug", ["Alice"], "agent-1");

      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          type: ACTIVITY_TYPE.TASK_ASSIGNED,
          message: 'Assigned "Fix bug" to Alice',
        })
      );
    });

    it("logs multiple assignees", async () => {
      await logTaskAssigned(
        mockCtx,
        "task-1",
        "Fix bug",
        ["Alice", "Bob"],
        "agent-1"
      );

      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          message: 'Assigned "Fix bug" to Alice, Bob',
        })
      );
    });

    it("uses assignedBy as agentId", async () => {
      await logTaskAssigned(mockCtx, "task-1", "Task", ["Alice"], "agent-lead");

      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          agentId: "agent-lead",
        })
      );
    });
  });

  describe("logTaskStatusChanged", () => {
    it("logs status transition", async () => {
      await logTaskStatusChanged(
        mockCtx,
        "task-1",
        "Fix bug",
        "backlog",
        "ready",
        "agent-1"
      );

      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          type: ACTIVITY_TYPE.TASK_UPDATED,
          message: 'Task "Fix bug" moved from backlog to ready',
          oldValue: "backlog",
          newValue: "ready",
        })
      );
    });

    it("includes both old and new status", async () => {
      await logTaskStatusChanged(
        mockCtx,
        "task-1",
        "Task",
        "in_progress",
        "review",
        "agent-1"
      );

      const call = mockDb.insert.mock.calls[0][1];
      expect(call.oldValue).toBe("in_progress");
      expect(call.newValue).toBe("review");
    });
  });

  describe("logTaskBlocked", () => {
    it("logs task being blocked", async () => {
      await logTaskBlocked(
        mockCtx,
        "task-1",
        "Feature",
        "Waiting for API design",
        "agent-1"
      );

      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          type: ACTIVITY_TYPE.TASK_BLOCKED,
          message: 'Task "Feature" blocked: Waiting for API design',
        })
      );
    });
  });

  describe("logAgentStatusChanged", () => {
    it("logs agent status transition", async () => {
      await logAgentStatusChanged(mockCtx, "agent-1", "idle", "active");

      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          type: ACTIVITY_TYPE.AGENT_STATUS_CHANGED,
          agentId: "agent-1",
          message: "Status changed from idle to active",
          oldValue: "idle",
          newValue: "active",
        })
      );
    });
  });

  describe("logEpicCreated", () => {
    it("logs epic creation", async () => {
      await logEpicCreated(mockCtx, "epic-1", "Platform upgrade", "agent-1");

      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          type: ACTIVITY_TYPE.EPIC_CREATED,
          epicId: "epic-1",
          message: "Created epic: Platform upgrade",
        })
      );
    });

    it("uses createdBy as agentId", async () => {
      await logEpicCreated(mockCtx, "epic-1", "Epic", "agent-lead");

      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          agentId: "agent-lead",
        })
      );
    });
  });

  describe("logDependencyAdded", () => {
    it("logs dependency creation", async () => {
      await logDependencyAdded(
        mockCtx,
        "task-1",
        "Fix login",
        "Setup auth service",
        "agent-1"
      );

      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          type: ACTIVITY_TYPE.DEPENDENCY_ADDED,
          taskId: "task-1",
          message: 'Added dependency: "Fix login" blocked by "Setup auth service"',
        })
      );
    });
  });

  describe("logCommentAdded", () => {
    it("logs comment on task", async () => {
      await logCommentAdded(mockCtx, "task-1", "Fix bug", "Alice");

      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          type: ACTIVITY_TYPE.COMMENT_ADDED,
          taskId: "task-1",
          message: 'Commented on task: "Fix bug"',
          agentId: "Alice",
        })
      );
    });
  });

  describe("logMention", () => {
    it("logs mention in task", async () => {
      await logMention(mockCtx, "task-1", "Fix bug", "Alice", "agent-1");

      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          type: ACTIVITY_TYPE.MENTION,
          taskId: "task-1",
          message: '@Alice mentioned in "Fix bug"',
          agentId: "agent-1",
        })
      );
    });
  });

  describe("error handling", () => {
    it("handles database errors gracefully", async () => {
      mockDb.get = jest.fn(async () => {
        throw new Error("Database error");
      });

      // Should not throw, just log error
      const result = await logActivity(mockCtx, ACTIVITY_TYPE.TASK_CREATED, "agent-1", {
        taskId: "task-1",
        message: "Test",
      });

      expect(result).toBeTruthy();
    });

    it("continues with partial data on fetch failure", async () => {
      mockDb.get = jest.fn(async (id: string) => {
        if (id === "agent-1") throw new Error("Agent fetch failed");
        return mockDb.entities.get(id);
      });

      await logActivity(mockCtx, ACTIVITY_TYPE.TASK_CREATED, "agent-1", {
        taskId: "task-1",
        message: "Test",
      });

      expect(mockDb.insert).toHaveBeenCalledWith(
        "activities",
        expect.objectContaining({
          agentName: "Unknown", // Failed fetch, defaults to Unknown
          taskTitle: "Fix login bug", // Successful fetch
        })
      );
    });
  });

  describe("activity type consistency", () => {
    it("uses correct activity type for each function", async () => {
      const scenarios = [
        [logTaskCreated, ACTIVITY_TYPE.TASK_CREATED, ["task-1", "Title", "agent"]],
        [logTaskCompleted, ACTIVITY_TYPE.TASK_COMPLETED, ["task-1", "Title", "agent"]],
        [logTaskAssigned, ACTIVITY_TYPE.TASK_ASSIGNED, ["task-1", "Title", ["Alice"], "agent"]],
        [logTaskStatusChanged, ACTIVITY_TYPE.TASK_UPDATED, ["task-1", "Title", "old", "new", "agent"]],
        [logTaskBlocked, ACTIVITY_TYPE.TASK_BLOCKED, ["task-1", "Title", "reason", "agent"]],
        [logAgentStatusChanged, ACTIVITY_TYPE.AGENT_STATUS_CHANGED, ["agent-1", "old", "new"]],
        [logEpicCreated, ACTIVITY_TYPE.EPIC_CREATED, ["epic-1", "Title", "agent"]],
        [logDependencyAdded, ACTIVITY_TYPE.DEPENDENCY_ADDED, ["task-1", "Title", "DepTitle", "agent"]],
        [logCommentAdded, ACTIVITY_TYPE.COMMENT_ADDED, ["task-1", "Title", "Author"]],
        [logMention, ACTIVITY_TYPE.MENTION, ["task-1", "Title", "MentionedName", "agent"]],
      ];

      for (const [fn, expectedType, args] of scenarios) {
        mockDb.insert.mockClear();
        // @ts-ignore
        await fn(mockCtx, ...args);
        expect(mockDb.insert).toHaveBeenCalledWith(
          "activities",
          expect.objectContaining({
            type: expectedType,
          })
        );
      }
    });
  });
});
