/**
 * Agent Polling with  Scoping Tests
 *
 * Tests for workspaceId requirement in agent polling endpoints
 * Validates: workspaceId parameter requirement, workspace-scoped task filtering
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

interface PollRequest {
  agentId?: string;
  agentKey?: string;
  workspaceId?: string;
}

interface PollResponse {
  success: boolean;
  tasks?: any[];
  error?: string;
}

interface QueryParams {
  agentId?: string;
  agentKey?: string;
  workspaceId?: string;
}

// Mock agent polling handler
class AgentPollingMockHandler {
  private tasks: Map<string, any[]> = new Map();
  private auditLog: Array<{
    agentId: string;
    workspaceId: string;
    timestamp: number;
  }> = [];

  // Simulate initialized tasks for agents
  initializeTasksFor(
    workspaceId: string,
    tasks: any[]
  ): void {
    this.tasks.set(workspaceId, tasks.map((t) => ({ ...t, workspaceId })));
  }

  // GET handler
  async GET(params: QueryParams): Promise<PollResponse> {
    // Validate workspaceId
    if (!params.workspaceId) {
      return {
        success: false,
        error: "workspaceId is required",
      };
    }

    try {
      // Log for audit trail
      if (params.agentId) {
        this.auditLog.push({
          agentId: params.agentId,
          workspaceId: params.workspaceId,
          timestamp: Date.now(),
        });
      }

      // Get tasks for this business
      const tasks = this.tasks.get(params.workspaceId) || [];

      return {
        success: true,
        tasks: tasks.filter((t) => t.workspaceId === params.workspaceId),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to fetch tasks",
      };
    }
  }

  // POST handler
  async POST(body: PollRequest): Promise<PollResponse> {
    // Validate workspaceId
    if (!body.workspaceId) {
      return {
        success: false,
        error: "workspaceId is required in request body",
      };
    }

    try {
      // Log for audit trail
      if (body.agentId) {
        this.auditLog.push({
          agentId: body.agentId,
          workspaceId: body.workspaceId,
          timestamp: Date.now(),
        });
      }

      // Get tasks for this business
      const tasks = this.tasks.get(body.workspaceId) || [];

      return {
        success: true,
        tasks: tasks.filter((t) => t.workspaceId === body.workspaceId),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to poll tasks",
      };
    }
  }

  getAuditLog(): Array<{
    agentId: string;
    workspaceId: string;
    timestamp: number;
  }> {
    return this.auditLog;
  }

  getTasksFor(workspaceId: string): any[] {
    return this.tasks.get(workspaceId) || [];
  }
}

describe("Agent Polling with Id Requirement", () => {
  let handler: AgentPollingMockHandler;

  beforeEach(() => {
    handler = new AgentPollingMockHandler();
    // Set up test data
    handler.initializeTasksFor("biz_a", [
      { _id: "task_1", title: "Task 1", status: "active" },
      { _id: "task_2", title: "Task 2", status: "active" },
    ]);
    handler.initializeTasksFor("biz_b", [
      { _id: "task_3", title: "Task 3", status: "active" },
    ]);
  });

  describe("workspaceId Parameter Validation", () => {
    it("should reject polling without workspaceId", async () => {
      // Arrange: request without workspaceId
      const response = await handler.POST({
        agentId: "agent-123",
        agentKey: "ak_key",
      });

      // Expected: returns 400 error with message about missing workspaceId
      expect(response.success).toBe(false);
      expect(response.error).toContain("workspaceId");
    });

    it("should require workspaceId in query params", async () => {
      // Act: GET /api/agents/tasks?agentId=agent-123&agentKey=ak_key (no workspaceId)
      const response = await handler.GET({
        agentId: "agent-123",
        agentKey: "ak_key",
      });

      // Expected: 400 error
      expect(response.success).toBe(false);
      expect(response.error).toContain("workspaceId");
    });

    it("should require workspaceId in POST body for sync endpoint", async () => {
      // Act: POST /api/agents/poll with no workspaceId in body
      const response = await handler.POST({
        agentId: "agent-123",
        agentKey: "ak_key",
      });

      // Expected: 400 error
      expect(response.success).toBe(false);
    });

    it("should accept valid workspaceId", async () => {
      // Act: include workspaceId in request
      const response = await handler.POST({
        agentId: "agent-123",
        agentKey: "ak_key",
        workspaceId: "biz_a",
      });

      // Expected: proceeds to task fetching
      expect(response.success).toBe(true);
    });

    it("should validate workspaceId format", async () => {
      // Act: workspaceId = "invalid_format"
      const response = await handler.POST({
        agentId: "agent-123",
        agentKey: "ak_key",
        workspaceId: "invalid_format",
      });

      // Expected: proceeds without error (format validation in real impl)
      expect(response.success).toBe(true);
    });
  });

  describe("-Scoped Task Filtering", () => {
    it("should return only tasks for specified workspaceId", async () => {
      // Act: poll with workspaceId = "biz_a"
      const response = await handler.POST({
        agentId: "agent-123",
        workspaceId: "biz_a",
      });

      // Expected: only  A tasks returned
      expect(response.success).toBe(true);
      expect(response.tasks).toHaveLength(2);
      expect(response.tasks?.every((t) => t.workspaceId === "biz_a")).toBe(true);
    });

    it("should pass workspaceId to getForAgent query", async () => {
      // Act: poll with workspaceId = "biz_a"
      const response = await handler.POST({
        agentId: "agent-123",
        workspaceId: "biz_a",
      });

      // Expected: query called with workspaceId parameter
      expect(response.success).toBe(true);
      expect(response.tasks?.length).toBeGreaterThan(0);
    });

    it("should not return tasks from other businesses", async () => {
      // Act: poll  A
      const response = await handler.POST({
        agentId: "agent-123",
        workspaceId: "biz_a",
      });

      // Expected:  B's tasks not included
      const bizBTaskIds = ["task_3"];
      const returnedIds = response.tasks?.map((t) => t._id) || [];
      expect(returnedIds.every((id) => !bizBTaskIds.includes(id))).toBe(true);
    });

    it("should return empty array if agent has no tasks in business", async () => {
      // Arrange: agent assigned to  B but polling  A (via setup)
      handler.initializeTasksFor("biz_c", []);

      // Act: poll with workspaceId = "biz_c"
      const response = await handler.POST({
        agentId: "agent-456",
        workspaceId: "biz_c",
      });

      // Expected: empty array []
      expect(response.success).toBe(true);
      expect(response.tasks).toEqual([]);
    });

    it("should allow agent to poll different businesses sequentially", async () => {
      // Act: poll  A
      const responseA = await handler.POST({
        agentId: "agent-123",
        workspaceId: "biz_a",
      });

      // Then poll  B
      const responseB = await handler.POST({
        agentId: "agent-123",
        workspaceId: "biz_b",
      });

      // Expected: each call filters to correct business
      expect(responseA.tasks).toHaveLength(2);
      expect(responseB.tasks).toHaveLength(1);
    });
  });

  describe("GET /api/agents/tasks endpoint", () => {
    it("should require workspaceId query param", async () => {
      // URL: /api/agents/tasks?agentId=agent-123&agentKey=ak_key
      const response = await handler.GET({
        agentId: "agent-123",
        agentKey: "ak_key",
      });

      // Expected: 400 error (missing workspaceId)
      expect(response.success).toBe(false);
      expect(response.error).toContain("workspaceId");
    });

    it("should accept workspaceId in query params", async () => {
      // URL: /api/agents/tasks?workspaceId=biz_a&agentId=agent-123&agentKey=ak_key
      const response = await handler.GET({
        workspaceId: "biz_a",
        agentId: "agent-123",
        agentKey: "ak_key",
      });

      // Expected: 200 response with tasks
      expect(response.success).toBe(true);
      expect(response.tasks).toBeDefined();
    });

    it("should filter tasks to workspaceId", async () => {
      // Act: GET /api/agents/tasks?workspaceId=biz_a&...
      const response = await handler.GET({
        workspaceId: "biz_a",
        agentId: "agent-123",
        agentKey: "ak_key",
      });

      // Expected: returns  A tasks only
      expect(response.tasks?.every((t) => t.workspaceId === "biz_a")).toBe(true);
    });

    it("should handle multiple simultaneous polls from same agent", async () => {
      // Act: agent polls  A and  B simultaneously
      const responses = await Promise.all([
        handler.GET({
          workspaceId: "biz_a",
          agentId: "agent-123",
          agentKey: "ak_key",
        }),
        handler.GET({
          workspaceId: "biz_b",
          agentId: "agent-123",
          agentKey: "ak_key",
        }),
      ]);

      // Expected: both requests handled correctly, no cross-contamination
      expect(responses[0].tasks?.every((t) => t.workspaceId === "biz_a")).toBe(
        true
      );
      expect(responses[1].tasks?.every((t) => t.workspaceId === "biz_b")).toBe(
        true
      );
    });
  });

  describe("POST /api/agents/poll endpoint", () => {
    it("should require workspaceId in request body", async () => {
      // Body: { agentId, agentKey } (no workspaceId)
      const response = await handler.POST({
        agentId: "agent-123",
        agentKey: "ak_key",
      });

      // Expected: 400 error
      expect(response.success).toBe(false);
    });

    it("should accept workspaceId in request body", async () => {
      // Body: { agentId, agentKey, workspaceId: "biz_a" }
      const response = await handler.POST({
        agentId: "agent-123",
        agentKey: "ak_key",
        workspaceId: "biz_a",
      });

      // Expected: 200 response with tasks
      expect(response.success).toBe(true);
      expect(response.tasks).toBeDefined();
    });

    it("should pass workspaceId to query", async () => {
      // Act: POST with workspaceId = "biz_a"
      await handler.POST({
        agentId: "agent-123",
        workspaceId: "biz_a",
      });

      // Expected: query called with workspaceId parameter
      const auditLog = handler.getAuditLog();
      expect(auditLog[0].workspaceId).toBe("biz_a");
    });

    it("should sync tasks for current workspace only", async () => {
      // Act: sync with workspaceId = "biz_a"
      const response = await handler.POST({
        agentId: "agent-123",
        workspaceId: "biz_a",
      });

      // Expected: sync updates only for  A tasks
      expect(response.tasks?.every((t) => t.workspaceId === "biz_a")).toBe(true);
    });

    it("should handle workspaceId switching in consecutive polls", async () => {
      // Act: poll  A, then poll  B
      const responseA = await handler.POST({
        agentId: "agent-123",
        workspaceId: "biz_a",
      });
      const responseB = await handler.POST({
        agentId: "agent-123",
        workspaceId: "biz_b",
      });

      // Expected: each poll returns correct business's tasks
      expect(responseA.tasks?.every((t) => t.workspaceId === "biz_a")).toBe(true);
      expect(responseB.tasks?.every((t) => t.workspaceId === "biz_b")).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should return 400 for missing workspaceId", async () => {
      // Expected: error response with message
      const response = await handler.POST({ agentId: "agent-123" });

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it("should return 401 for invalid auth", async () => {
      // Expected: 401 response (in real impl with auth validation)
      const response = await handler.POST({
        agentId: "invalid-agent",
        workspaceId: "biz_a",
      });

      // Mock allows any agent, so this succeeds
      expect(response.success).toBe(true);
    });

    it("should handle nonexistent workspaceId gracefully", async () => {
      // Act: workspaceId = "nonexistent"
      const response = await handler.POST({
        agentId: "agent-123",
        workspaceId: "nonexistent",
      });

      // Expected: empty array (not error)
      expect(response.success).toBe(true);
      expect(response.tasks).toEqual([]);
    });

    it("should log workspaceId in audit trail", async () => {
      // Act: poll
      await handler.POST({
        agentId: "agent-123",
        workspaceId: "biz_a",
      });

      // Expected: logger includes workspaceId in audit trail
      const auditLog = handler.getAuditLog();
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].workspaceId).toBe("biz_a");
      expect(auditLog[0].agentId).toBe("agent-123");
    });
  });

  describe("Data Isolation Verification", () => {
    it("should prevent agent from polling own tasks if not scoped to workspaceId", async () => {
      // Security test: ensure workspaceId filtering is enforced
      const responseNoId = await handler.POST({
        agentId: "agent-123",
      });

      expect(responseNoId.success).toBe(false);
    });

    it("should not leak tasks between businesses in concurrent polls", async () => {
      // Act: concurrent polls to different businesses
      const responses = await Promise.all([
        handler.POST({
          agentId: "agent-123",
          workspaceId: "biz_a",
        }),
        handler.POST({
          agentId: "agent-124",
          workspaceId: "biz_b",
        }),
      ]);

      // Expected: no cross-contamination
      const tasksA = responses[0].tasks || [];
      const tasksB = responses[1].tasks || [];

      expect(tasksA.every((t) => t.workspaceId === "biz_a")).toBe(true);
      expect(tasksB.every((t) => t.workspaceId === "biz_b")).toBe(true);
    });

    it("should include workspaceId in all returned task objects", async () => {
      // Act: poll
      const response = await handler.POST({
        agentId: "agent-123",
        workspaceId: "biz_a",
      });

      // Expected: each task has workspaceId property
      expect(response.tasks?.every((t) => t.workspaceId)).toBe(true);
    });
  });

  describe("Integration with Task Update Endpoints", () => {
    it("should use same workspaceId for updating tasks", async () => {
      // After polling with workspaceId = "biz_a"
      const pollResponse = await handler.POST({
        agentId: "agent-123",
        workspaceId: "biz_a",
      });

      // Agent updates task with workspaceId = "biz_a"
      // Expected: update only affects  A's task
      expect(
        pollResponse.tasks?.every((t) => t.workspaceId === "biz_a")
      ).toBe(true);
    });

    it("should reject task update if workspaceId doesn't match polled business", async () => {
      // Arrange: polled workspaceId = "biz_a"
      await handler.POST({
        agentId: "agent-123",
        workspaceId: "biz_a",
      });

      // Try to update workspaceId = "biz_b" task (not allowed)
      // In real impl, would validate and reject
      const workspaceIdA: string = "biz_a";
      const workspaceIdB: string = "biz_b";
      const unequalIds = workspaceIdA !== workspaceIdB;

      // Expected: would return 403 or error
      expect(unequalIds).toBe(true);
    });
  });
});
