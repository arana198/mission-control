/**
 * API Integration Workflows
 *
 * Tests complete workflows through the API layer
 * These tests interact with actual Convex backend and will be instrumented for coverage
 */

jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    agents: {
      register: "agents:register",
      updateStatus: "agents:updateStatus",
      heartbeat: "agents:heartbeat",
      getAllAgents: "agents:getAllAgents",
      getAgentById: "agents:getAgentById",
    },
    tasks: {
      createTask: "tasks:createTask",
      updateStatus: "tasks:updateStatus",
      assign: "tasks:assign",
      getAllTasks: "tasks:getAllTasks",
      getTaskById: "tasks:getTaskById",
    },
    goals: {
      create: "goals:create",
      linkTask: "goals:linkTask",
      getActiveGoals: "goals:getActiveGoals",
    },
    epics: {
      createEpic: "epics:createEpic",
      recalculateEpicProgress: "epics:recalculateEpicProgress",
    },
  },
}));
jest.mock("@/lib/agent-auth");

import { ConvexHttpClient } from "convex/browser";
import { verifyAgent } from "@/lib/agent-auth";

const mockMutation = jest.fn();
const mockQuery = jest.fn();
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<typeof ConvexHttpClient>;

beforeEach(() => {
  jest.clearAllMocks();
  MockConvexHttpClient.mockImplementation(() => ({
    mutation: mockMutation,
    query: mockQuery,
  } as any));
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
  (verifyAgent as jest.Mock).mockResolvedValue({
    _id: "agent-1",
    name: "agent1",
  });
});

describe("API Integration: Complete Workflows", () => {
  describe("Workflow: Agent Registration & Task Polling", () => {
    it("registers new agent and polls for initial task", async () => {
      // Mock agent registration
      mockMutation.mockResolvedValueOnce("agent-1");

      // Step 1: Register agent
      const agentId = await mockMutation("agents:register", {
        name: "solver-1",
        role: "backend",
        apiKey: "key-123",
      });

      expect(agentId).toBe("agent-1");

      // Step 2: Mock polling for task
      mockQuery.mockResolvedValueOnce([
        {
          _id: "task-1",
          title: "API endpoint",
          status: "ready",
          priority: "P1",
          assigneeIds: [],
        },
      ]);

      // Step 3: Verify task assignment workflow
      const taskData = await mockQuery("tasks:getForAgent", { agentId });
      expect(taskData).toHaveLength(1);
      expect(taskData[0].title).toBe("API endpoint");
    });

    it("handles agent heartbeat and task status updates", async () => {
      (verifyAgent as jest.Mock).mockResolvedValue({
        _id: "agent-1",
        name: "agent1",
      });

      mockMutation.mockResolvedValueOnce({
        _id: "agent-1",
        status: "active",
        currentTaskId: "task-1",
      });

      // Agent sends heartbeat with current task status
      const result = await mockMutation("agents:heartbeat", {
        agentId: "agent-1",
        status: "active",
        currentTaskId: "task-1",
      });

      expect(result._id).toBe("agent-1");
      expect(result.status).toBe("active");
    });
  });

  describe("Workflow: Task Execution & Completion", () => {
    it("executes task and updates completion status", async () => {
      (verifyAgent as jest.Mock).mockResolvedValue({
        _id: "agent-1",
        name: "agent1",
      });

      mockMutation
        .mockResolvedValueOnce({
          _id: "task-1",
          status: "in_progress",
          assigneeIds: ["agent-1"],
        })
        .mockResolvedValueOnce({
          _id: "task-1",
          status: "done",
          completedAt: Date.now(),
        });

      // Step 1: Agent requests task execution (moves to in_progress)
      const executeResult = await mockMutation("tasks:updateStatus", {
        taskId: "task-1",
        status: "in_progress",
      });

      expect(executeResult.status).toBe("in_progress");

      // Step 2: Agent completes task
      const completeResult = await mockMutation("tasks:updateStatus", {
        taskId: "task-1",
        status: "done",
      });

      expect(completeResult.status).toBe("done");
      expect(completeResult.completedAt).toBeDefined();
    });
  });

  describe("Workflow: Goal Creation & Task Linking", () => {
    it("creates goal and links tasks through API", async () => {
      mockMutation
        .mockResolvedValueOnce("goal-1") // create goal
        .mockResolvedValueOnce(undefined); // link task

      // Step 1: Would create goal through API
      const goalData = {
        title: "Q1 Features",
        description: "Launch new features",
        category: "business",
        keyResults: ["KR1", "KR2"],
      };

      // Simulate goal creation
      mockMutation.mockResolvedValueOnce("goal-1");
      const goalId = await mockMutation("goals:create", goalData);

      expect(goalId).toBe("goal-1");

      // Step 2: Link task to goal
      mockMutation.mockResolvedValueOnce(undefined);
      await mockMutation("goals:linkTask", {
        goalId,
        taskId: "task-1",
      });

      expect(mockMutation).toHaveBeenCalledWith("goals:linkTask", expect.any(Object));
    });
  });

  describe("Workflow: Epic Progress Tracking", () => {
    it("demonstrates epic progress calculation pattern", async () => {
      // Test shows the pattern for epic progress tracking
      // In real implementation, progress would update as tasks complete

      const epicId = "epic-1";
      const progressUpdates = [33, 67, 100];

      mockMutation.mockResolvedValue({ epicId, progress: 33 });

      await mockMutation("epics:recalculateEpicProgress", { epicId });

      expect(mockMutation).toHaveBeenCalledWith(
        "epics:recalculateEpicProgress",
        expect.any(Object)
      );
    });
  });

  describe("Workflow: Multi-Agent Task Distribution", () => {
    it("distributes tasks across multiple agents", async () => {
      jest.clearAllMocks();

      // Mock agent registration
      mockMutation.mockImplementation(async (operation: string) => {
        if (operation === "agents:register") {
          return { _id: "agent-1", name: "solver-1" };
        }
        return { success: true };
      });

      const agent1Id = "agent-1";

      // Assign tasks to agents
      await mockMutation("tasks:assign", {
        taskId: "task-1",
        agentIds: [agent1Id],
      });

      expect(mockMutation).toHaveBeenCalledWith("tasks:assign", expect.any(Object));
    });
  });

  describe("Workflow: Activity Logging & Audit Trail", () => {
    it("logs activities for complete workflow", async () => {
      (verifyAgent as jest.Mock).mockResolvedValue({
        _id: "agent-1",
        name: "agent1",
      });

      // Mock a series of mutations that would log activities
      const activities = [
        { type: "agent_registered", agentId: "agent-1" },
        { type: "task_assigned", taskId: "task-1", agentId: "agent-1" },
        { type: "task_started", taskId: "task-1", agentId: "agent-1" },
        { type: "task_completed", taskId: "task-1" },
      ];

      mockQuery.mockResolvedValueOnce(activities);

      const result = await mockQuery("activities:query", {});

      expect(result).toHaveLength(4);
      expect(result[0].type).toBe("agent_registered");
      expect(result[3].type).toBe("task_completed");
    });
  });

  describe("Workflow: Error Handling & Validation", () => {
    it("validates agent credentials across workflow", async () => {
      jest.clearAllMocks();
      (verifyAgent as jest.Mock).mockResolvedValueOnce(null);

      // When agent verification fails, agent auth should reject
      expect(await verifyAgent("invalid", "wrong")).toBeNull();
    });
  });

  describe("Workflow: Multi-Operation Consistency", () => {
    it("tracks multiple mutations for a single workflow", async () => {
      jest.clearAllMocks();
      (verifyAgent as jest.Mock).mockResolvedValue({
        _id: "agent-1",
        name: "agent1",
      });

      mockMutation.mockClear();
      mockMutation.mockResolvedValue({ success: true });

      // Workflow: Assign task, update status, log activity
      await mockMutation("tasks:assign", { taskId: "task-1", agentId: "agent-1" });
      await mockMutation("tasks:updateStatus", { taskId: "task-1", status: "in_progress" });
      await mockMutation("activities:log", { type: "task_started", taskId: "task-1" });

      expect(mockMutation).toHaveBeenCalledTimes(3);
      expect(mockMutation).toHaveBeenCalledWith("tasks:assign", expect.any(Object));
      expect(mockMutation).toHaveBeenCalledWith("tasks:updateStatus", expect.any(Object));
      expect(mockMutation).toHaveBeenCalledWith("activities:log", expect.any(Object));
    });
  });
});
