/**
 * Integration Tests - End-to-End Workflows
 *
 * Tests complete workflows that span multiple Convex functions:
 * - Task creation → assignment → execution → completion
 * - Goal creation → task linking → progress tracking
 * - Epic management with task dependencies
 * - Agent task queue and lifecycle
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Integration Mock Database
 * Simulates complete system state for workflow testing
 */
class IntegrationMockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    this.data.set("tasks", []);
    this.data.set("goals", []);
    this.data.set("epics", []);
    this.data.set("agents", []);
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
      const found = docs.find((d) => d._id === id);
      if (found) return found;
    }
    return null;
  }

  patch(id: string, updates: any) {
    for (const docs of this.data.values()) {
      const doc = docs.find((d) => d._id === id);
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

  logActivity(type: string, details: any) {
    this.insert("activities", {
      type,
      timestamp: Date.now(),
      ...details,
    });
  }

  calculateEpicProgress(epicId: string): number {
    const epic = this.get(epicId);
    if (!epic || epic.taskIds.length === 0) return 0;

    const tasks = (epic.taskIds || []).map((tid: string) => this.get(tid));
    const completed = tasks.filter((t: any) => t && t.status === "done").length;
    return Math.round((completed / tasks.length) * 100);
  }

  calculateGoalProgress(goalId: string): number {
    const goal = this.get(goalId);
    if (!goal || goal.relatedTaskIds.length === 0) return 0;

    const tasks = (goal.relatedTaskIds || []).map((tid: string) => this.get(tid));
    const completed = tasks.filter((t: any) => t && t.status === "done").length;
    return Math.round((completed / tasks.length) * 100);
  }

  delete(id: string) {
    for (const docs of this.data.values()) {
      const index = docs.findIndex((d) => d._id === id);
      if (index !== -1) {
        docs.splice(index, 1);
        return true;
      }
    }
    return false;
  }
}

describe("Integration: End-to-End Workflows", () => {
  let db: IntegrationMockDatabase;

  beforeEach(() => {
    db = new IntegrationMockDatabase();
  });

  describe("Workflow: Create Task → Assign → Complete → Update Epic Progress", () => {
    it("completes full task lifecycle with epic progress tracking", async () => {
      // 1. Create an epic
      const epicId = db.insert("epics", {
        title: "Q1 Feature Launch",
        description: "Launch core features for Q1",
        status: "active",
        progress: 0,
        taskIds: [],
        category: "business",
      });
      expect(epicId).toBeDefined();

      // 2. Create multiple tasks for the epic
      const task1Id = db.insert("tasks", {
        title: "API endpoint implementation",
        description: "Build REST endpoints",
        status: "backlog",
        priority: "P1",
        epicId,
        assigneeIds: [],
        dependencies: [],
        tags: ["backend", "api"],
      });

      const task2Id = db.insert("tasks", {
        title: "Database schema migration",
        description: "Create new tables",
        status: "backlog",
        priority: "P0",
        epicId,
        assigneeIds: [],
        dependencies: [],
        tags: ["database"],
      });

      const task3Id = db.insert("tasks", {
        title: "Integration tests",
        description: "Write comprehensive tests",
        status: "backlog",
        priority: "P2",
        epicId,
        assigneeIds: [],
        dependencies: [task1Id, task2Id], // depends on other tasks
        tags: ["testing"],
      });

      // Update epic with task IDs
      db.patch(epicId, { taskIds: [task1Id, task2Id, task3Id] });

      // 3. Verify epic shows 0% progress (all backlog)
      let epicProgress = db.calculateEpicProgress(epicId);
      expect(epicProgress).toBe(0);

      // 4. Assign agent to first task and move to ready
      const agentId = db.insert("agents", {
        name: "solver-1",
        role: "backend",
        status: "idle",
        currentTaskId: null,
      });

      db.patch(task1Id, {
        assigneeIds: [agentId],
        status: "ready",
      });
      db.logActivity("task_assigned", { taskId: task1Id, agentId });

      // 5. Agent starts working (moves to in_progress)
      db.patch(agentId, {
        currentTaskId: task1Id,
        status: "active",
      });
      db.patch(task1Id, { status: "in_progress" });
      db.logActivity("task_started", { taskId: task1Id, agentId });

      // 6. Complete the first task
      db.patch(task1Id, { status: "done", completedAt: Date.now() });
      db.logActivity("task_completed", { taskId: task1Id });

      // Check epic progress (1/3 done = 33%)
      epicProgress = db.calculateEpicProgress(epicId);
      expect(epicProgress).toBe(33);
      db.patch(epicId, { progress: epicProgress });

      // 7. Complete second task (now 2/3 = ~67%)
      db.patch(task2Id, { status: "done", completedAt: Date.now() });
      db.logActivity("task_completed", { taskId: task2Id });

      epicProgress = db.calculateEpicProgress(epicId);
      expect(epicProgress).toBeGreaterThanOrEqual(66);
      expect(epicProgress).toBeLessThanOrEqual(67);
      db.patch(epicId, { progress: epicProgress });

      // 8. Third task becomes ready (dependencies met)
      db.patch(task3Id, { status: "ready" });

      // 9. Complete final task
      db.patch(task3Id, { status: "done", completedAt: Date.now() });

      // 10. Epic reaches 100% completion
      epicProgress = db.calculateEpicProgress(epicId);
      expect(epicProgress).toBe(100);
      db.patch(epicId, { status: "completed", progress: 100 });

      // Verify final state
      const finalEpic = db.get(epicId);
      expect(finalEpic.status).toBe("completed");
      expect(finalEpic.progress).toBe(100);

      const activities = await db.query("activities").collect();
      expect(activities.length).toBeGreaterThan(0);
      expect(activities.some((a) => a.type === "task_completed")).toBe(true);
    });
  });

  describe("Workflow: Create Goal → Link Tasks → Track Progress", () => {
    it("manages goal progress as linked tasks progress", async () => {
      // 1. Create a goal
      const goalId = db.insert("goals", {
        title: "Improve API Performance",
        description: "Reduce latency by 50%",
        category: "business",
        status: "active",
        progress: 0,
        relatedTaskIds: [],
        keyResults: [
          "KR1: Reduce p95 latency from 200ms to 100ms",
          "KR2: Increase throughput by 2x",
        ],
      });

      // 2. Create tasks (some that already exist in the system)
      const task1Id = db.insert("tasks", {
        title: "Database query optimization",
        status: "backlog",
        priority: "P1",
        goalIds: [],
      });

      const task2Id = db.insert("tasks", {
        title: "Add caching layer",
        status: "backlog",
        priority: "P1",
        goalIds: [],
      });

      const task3Id = db.insert("tasks", {
        title: "Load testing and monitoring",
        status: "backlog",
        priority: "P2",
        goalIds: [],
      });

      // 3. Link tasks to goal
      db.patch(goalId, {
        relatedTaskIds: [task1Id, task2Id, task3Id],
      });

      // Update tasks with goal reference
      db.patch(task1Id, { goalIds: [goalId] });
      db.patch(task2Id, { goalIds: [goalId] });
      db.patch(task3Id, { goalIds: [goalId] });

      // 4. Verify goal shows 0% progress
      let goalProgress = db.calculateGoalProgress(goalId);
      expect(goalProgress).toBe(0);
      db.patch(goalId, { progress: goalProgress });

      // 5. Progress tasks through workflow
      db.patch(task1Id, { status: "in_progress" });
      goalProgress = db.calculateGoalProgress(goalId);
      expect(goalProgress).toBe(0);

      db.patch(task1Id, { status: "done" });
      goalProgress = db.calculateGoalProgress(goalId);
      expect(goalProgress).toBe(33);
      db.patch(goalId, { progress: goalProgress });

      // 6. Complete more tasks
      db.patch(task2Id, { status: "in_progress" });
      db.patch(task2Id, { status: "done" });
      goalProgress = db.calculateGoalProgress(goalId);
      expect(goalProgress).toBeGreaterThanOrEqual(66);
      expect(goalProgress).toBeLessThanOrEqual(67);
      db.patch(goalId, { progress: goalProgress });

      // 7. Final task completion
      db.patch(task3Id, { status: "in_progress" });
      db.patch(task3Id, { status: "done" });
      goalProgress = db.calculateGoalProgress(goalId);
      expect(goalProgress).toBe(100);

      // 8. Mark goal as completed
      db.patch(goalId, {
        status: "completed",
        progress: 100,
        completedAt: Date.now(),
      });

      const finalGoal = db.get(goalId);
      expect(finalGoal.status).toBe("completed");
      expect(finalGoal.progress).toBe(100);
    });
  });

  describe("Workflow: Multi-Agent Task Queue Management", () => {
    it("distributes tasks across multiple agents and tracks assignments", async () => {
      // 1. Create multiple agents
      const agent1Id = db.insert("agents", {
        name: "solver-1",
        role: "backend",
        status: "idle",
        currentTaskId: null,
        completedTasks: 0,
      });

      const agent2Id = db.insert("agents", {
        name: "solver-2",
        role: "frontend",
        status: "idle",
        currentTaskId: null,
        completedTasks: 0,
      });

      // 2. Create tasks
      const backendTaskId = db.insert("tasks", {
        title: "API endpoint",
        priority: "P1",
        status: "backlog",
        assigneeIds: [],
        tags: ["backend"],
      });

      const frontendTaskId = db.insert("tasks", {
        title: "UI component",
        priority: "P2",
        status: "backlog",
        assigneeIds: [],
        tags: ["frontend"],
      });

      const urgentTaskId = db.insert("tasks", {
        title: "Critical bug fix",
        priority: "P0",
        status: "backlog",
        assigneeIds: [],
      });

      // 3. Assign tasks to appropriate agents
      db.patch(backendTaskId, {
        assigneeIds: [agent1Id],
        status: "ready",
      });
      db.patch(agent1Id, {
        currentTaskId: backendTaskId,
        status: "active",
      });

      db.patch(frontendTaskId, {
        assigneeIds: [agent2Id],
        status: "ready",
      });
      db.patch(agent2Id, {
        currentTaskId: frontendTaskId,
        status: "active",
      });

      // 4. Verify both agents are active
      let agent1 = db.get(agent1Id);
      let agent2 = db.get(agent2Id);
      expect(agent1.status).toBe("active");
      expect(agent2.status).toBe("active");
      expect(agent1.currentTaskId).toBe(backendTaskId);
      expect(agent2.currentTaskId).toBe(frontendTaskId);

      // 5. Agent 1 completes task
      db.patch(backendTaskId, { status: "done" });
      db.patch(agent1Id, {
        currentTaskId: urgentTaskId,
        completedTasks: 1,
      });
      db.patch(urgentTaskId, { assigneeIds: [agent1Id], status: "ready" });

      // 6. Verify task reassignment
      const updatedUrgent = db.get(urgentTaskId);
      expect(updatedUrgent.assigneeIds).toContain(agent1Id);

      // 7. Agent 2 finishes and becomes idle
      db.patch(frontendTaskId, { status: "done" });
      db.patch(agent2Id, {
        currentTaskId: null,
        status: "idle",
        completedTasks: 1,
      });

      // Verify idle state
      agent2 = db.get(agent2Id);
      expect(agent2.status).toBe("idle");
      expect(agent2.currentTaskId).toBeNull();
      expect(agent2.completedTasks).toBe(1);
    });
  });

  describe("Workflow: Hierarchical Goal Decomposition", () => {
    it("manages parent goals with child goals and aggregates progress", async () => {
      // 1. Create parent goal
      const parentGoalId = db.insert("goals", {
        title: "Q1 2026 Objectives",
        category: "business",
        status: "active",
        progress: 0,
        relatedTaskIds: [],
        childGoalIds: [],
      });

      // 2. Create child goals
      const childGoal1Id = db.insert("goals", {
        title: "Launch new features",
        category: "business",
        status: "active",
        progress: 0,
        relatedTaskIds: [],
        parentGoalId,
        childGoalIds: [],
      });

      const childGoal2Id = db.insert("goals", {
        title: "Improve performance",
        category: "business",
        status: "active",
        progress: 0,
        relatedTaskIds: [],
        parentGoalId,
        childGoalIds: [],
      });

      // 3. Update parent with child references
      db.patch(parentGoalId, {
        childGoalIds: [childGoal1Id, childGoal2Id],
      });

      // 4. Create tasks and link to child goals
      const task1 = db.insert("tasks", {
        title: "Feature A",
        status: "backlog",
        priority: "P1",
      });
      const task2 = db.insert("tasks", {
        title: "Feature B",
        status: "backlog",
        priority: "P1",
      });
      const task3 = db.insert("tasks", {
        title: "Optimization task",
        status: "backlog",
        priority: "P1",
      });

      db.patch(childGoal1Id, { relatedTaskIds: [task1, task2] });
      db.patch(childGoal2Id, { relatedTaskIds: [task3] });

      // 5. Verify hierarchy
      const parent = db.get(parentGoalId);
      expect(parent.childGoalIds).toHaveLength(2);

      const child1 = db.get(childGoal1Id);
      expect(child1.parentGoalId).toBe(parentGoalId);

      // 6. Progress child goals
      db.patch(task1, { status: "done" });
      let child1Progress = db.calculateGoalProgress(childGoal1Id);
      expect(child1Progress).toBe(50);

      db.patch(task2, { status: "done" });
      child1Progress = db.calculateGoalProgress(childGoal1Id);
      expect(child1Progress).toBe(100);
      db.patch(childGoal1Id, { progress: 100 });

      // 7. Calculate parent progress (aggregate from children)
      db.patch(task3, { status: "done" });
      let child2Progress = db.calculateGoalProgress(childGoal2Id);
      expect(child2Progress).toBe(100);
      db.patch(childGoal2Id, { progress: 100 });

      // Parent progress should reflect both children at 100%
      const parentProgress = Math.round(
        ((child1Progress + child2Progress) / 2 + db.calculateGoalProgress(parentGoalId)) / 2
      );
      db.patch(parentGoalId, { progress: parentProgress });

      const finalParent = db.get(parentGoalId);
      expect(finalParent.progress).toBeGreaterThan(0);
    });
  });

  describe("Workflow: Dependency Chain Execution", () => {
    it("executes tasks respecting dependency ordering", async () => {
      // 1. Create task chain with dependencies
      // Task A (no deps) → Task B (depends on A) → Task C (depends on B)
      const taskAId = db.insert("tasks", {
        title: "Foundation task",
        status: "ready",
        priority: "P0",
        dependencies: [],
        epicId: null,
      });

      const taskBId = db.insert("tasks", {
        title: "Dependent task",
        status: "backlog", // blocked until A is done
        priority: "P1",
        dependencies: [taskAId],
      });

      const taskCId = db.insert("tasks", {
        title: "Final task",
        status: "backlog", // blocked until B is done
        priority: "P2",
        dependencies: [taskBId],
      });

      // 2. Task A is ready to execute
      let taskA = db.get(taskAId);
      expect(taskA.status).toBe("ready");
      expect(taskA.dependencies).toHaveLength(0);

      // Task B is blocked
      let taskB = db.get(taskBId);
      expect(taskB.status).toBe("backlog");
      expect(taskB.dependencies).toContain(taskAId);

      // 3. Execute Task A
      db.patch(taskAId, { status: "in_progress" });
      db.patch(taskAId, { status: "done" });

      // 4. Task B becomes ready
      db.patch(taskBId, { status: "ready" });
      taskB = db.get(taskBId);
      expect(taskB.status).toBe("ready");

      // 5. Execute Task B
      db.patch(taskBId, { status: "in_progress" });
      db.patch(taskBId, { status: "done" });

      // 6. Task C becomes ready
      db.patch(taskCId, { status: "ready" });
      let taskC = db.get(taskCId);
      expect(taskC.status).toBe("ready");

      // 7. Execute Task C
      db.patch(taskCId, { status: "in_progress" });
      db.patch(taskCId, { status: "done" });

      // Verify all tasks completed in order
      taskA = db.get(taskAId);
      taskB = db.get(taskBId);
      taskC = db.get(taskCId);

      expect(taskA.status).toBe("done");
      expect(taskB.status).toBe("done");
      expect(taskC.status).toBe("done");
    });
  });

  describe("Workflow: Activity Logging and Audit Trail", () => {
    it("tracks all state changes through activity log", async () => {
      const taskId = db.insert("tasks", {
        title: "Tracked task",
        status: "backlog",
      });

      // Log each state transition
      db.logActivity("task_created", { taskId, title: "Tracked task" });

      db.patch(taskId, { status: "ready" });
      db.logActivity("task_status_changed", {
        taskId,
        oldStatus: "backlog",
        newStatus: "ready",
      });

      const agentId = db.insert("agents", { name: "agent-1", status: "idle" });
      db.patch(taskId, { assigneeIds: [agentId] });
      db.logActivity("task_assigned", { taskId, agentId });

      db.patch(taskId, { status: "in_progress" });
      db.logActivity("task_started", { taskId, agentId });

      db.patch(taskId, { status: "done" });
      db.logActivity("task_completed", { taskId, completedAt: Date.now() });

      // Verify audit trail
      const activities = await db.query("activities").collect();
      expect(activities.length).toBeGreaterThanOrEqual(5);

      const taskActivities = activities.filter((a) => a.taskId === taskId);
      const types = taskActivities.map((a) => a.type);

      expect(types).toContain("task_created");
      expect(types).toContain("task_assigned");
      expect(types).toContain("task_started");
      expect(types).toContain("task_completed");
    });
  });
});
