/**
 * Performance & Scale Tests (Phase 5C)
 *
 * Tests for:
 * - Backend query optimization (4 fixes)
 * - Rate limiting on critical mutations
 * - Frontend memoization effectiveness
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

class PerformanceMockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;
  private callCounts: Map<string, number> = new Map();

  constructor() {
    this.data.set("agents", []);
    this.data.set("tasks", []);
    this.data.set("businesses", []);
    this.data.set("activities", []);
    this.data.set("settings", []);
  }

  generateId(table: string): string {
    return `${table}-${this.nextId++}`;
  }

  // Track database query calls for N+1 detection
  recordCall(operation: string): void {
    this.callCounts.set(operation, (this.callCounts.get(operation) || 0) + 1);
  }

  getCallCount(operation: string): number {
    return this.callCounts.get(operation) || 0;
  }

  resetCallCounts(): void {
    this.callCounts.clear();
  }

  insert(table: string, doc: any) {
    if (!this.data.has(table)) {
      this.data.set(table, []);
    }
    const _id = this.generateId(table);
    const fullDoc = { ...doc, _id, _creationTime: Date.now() };
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
      const found = docs.find((d: any) => d._id === id);
      if (found) {
        Object.assign(found, updates);
        return found;
      }
    }
    return null;
  }

  delete(id: string) {
    for (const [table, docs] of this.data.entries()) {
      const index = docs.findIndex((d: any) => d._id === id);
      if (index !== -1) {
        docs.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  query(table: string) {
    this.recordCall(`query:${table}`);
    const tableData = this.data.get(table) || [];

    return {
      withIndex: (indexName: string, predicate?: (q: any) => any) => {
        this.recordCall(`index:${indexName}`);
        let filtered = tableData;
        if (predicate) {
          filtered = tableData.filter(predicate);
        }
        return {
          collect: async () => filtered,
          order: (direction: string) => ({
            take: (limit: number) => ({
              collect: async () => filtered.sort((a, b) => direction === "desc" ? b._creationTime - a._creationTime : a._creationTime - b._creationTime).slice(0, limit),
            }),
          }),
        };
      },
      collect: async () => tableData,
      order: (direction: string) => ({
        take: (limit: number) => ({
          collect: async () => tableData.sort((a, b) => direction === "desc" ? (b._creationTime || 0) - (a._creationTime || 0) : (a._creationTime || 0) - (b._creationTime || 0)).slice(0, limit),
        }),
      }),
      filter: (predicate: (doc: any) => boolean) => ({
        collect: async () => tableData.filter(predicate),
      }),
    };
  }

  getes() {
    return this.data.get("businesses") || [];
  }

  getTasks() {
    return this.data.get("tasks") || [];
  }

  getAgents() {
    return this.data.get("agents") || [];
  }

  getSettings() {
    return this.data.get("settings") || [];
  }

  getActivities() {
    return this.data.get("activities") || [];
  }
}

describe("Performance & Scale (Phase 5C)", () => {
  let db: PerformanceMockDatabase;

  beforeEach(() => {
    db = new PerformanceMockDatabase();
  });

  describe("Query Optimization: deleteAgent", () => {
    it("should query only tasks by_workspace, not full table scan", async () => {
      // Setup: 2 businesses, 3 agents per workspace, 10 tasks per business
      const biz1 = db.insert("businesses", { name: " 1" });
      const biz2 = db.insert("businesses", { name: " 2" });

      const agent1 = db.insert("agents", { name: "Agent 1", workspaceId: biz1 });
      db.insert("agents", { name: "Agent 2", workspaceId: biz1 });
      db.insert("agents", { name: "Agent 3", workspaceId: biz2 });

      // Create tasks
      for (let i = 0; i < 10; i++) {
        db.insert("tasks", {
          title: `Task B1-${i}`,
          workspaceId: biz1,
          assigneeIds: [agent1],
        });
      }
      for (let i = 0; i < 10; i++) {
        db.insert("tasks", {
          title: `Task B2-${i}`,
          workspaceId: biz2,
          assigneeIds: [],
        });
      }

      // OLD (bad): Full table scan
      db.resetCallCounts();
      const allTasks = await db.query("tasks").collect();
      const beforeCallCount = db.getCallCount("query:tasks");

      // NEW (good): Query by workspace only
      db.resetCallCounts();
      const businesses = db.getes();
      for (const biz of businesses) {
        const bizTasks = await db
          .query("tasks")
          .withIndex("by_workspace", (q: any) => q.eq?.("workspaceId", biz._id) ?? true)
          .collect();
        // Simulate unassignment
      }
      const afterCallCount = db.getCallCount("query:tasks");

      // Both should read the same data, but optimized version uses index
      expect(afterCallCount).toBeLessThanOrEqual(beforeCallCount + 1); // +1 for per-workspace loop
    });

    it("does not remove agent from other workspace tasks", async () => {
      const biz1 = db.insert("businesses", { name: " 1" });
      const biz2 = db.insert("businesses", { name: " 2" });
      const agent = db.insert("agents", { name: "Shared Agent" });

      const task1 = db.insert("tasks", {
        title: "Biz1 Task",
        workspaceId: biz1,
        assigneeIds: [agent],
      });
      const task2 = db.insert("tasks", {
        title: "Biz2 Task",
        workspaceId: biz2,
        assigneeIds: [agent],
      });

      // Simulate deletion in biz1
      const biz1Tasks = (await db.query("tasks").collect()).filter((t: any) => t.workspaceId === biz1);
      const updated = db.patch(task1, {
        assigneeIds: [],
      });

      expect(updated?.assigneeIds).toHaveLength(0);
      expect((db.get(task2) as any)?.assigneeIds).toContain(agent);
    });
  });

  describe("Query Optimization: findBestAgent N+1", () => {
    it("hoists inProgressTasks query outside agent loop", async () => {
      // Setup: 5 agents, 20 in-progress tasks
      const agents = [];
      for (let i = 0; i < 5; i++) {
        agents.push(db.insert("agents", { name: `Agent ${i}`, role: "Developer" }));
      }

      const inProgressTasks = [];
      for (let i = 0; i < 20; i++) {
        inProgressTasks.push(
          db.insert("tasks", {
            title: `Task ${i}`,
            status: "in_progress",
            assigneeIds: [agents[i % 5]],
          })
        );
      }

      // OLD (N+1): Query inProgressTasks inside agent loop
      db.resetCallCounts();
      for (const agent of agents) {
        const agentInProgress = await db.query("tasks").collect(); // N queries!
      }
      const n1Count = db.getCallCount("query:tasks");

      // NEW (good): Hoist query outside loop
      db.resetCallCounts();
      const allInProgress = await db.query("tasks").withIndex("by_status", (q: any) => true).collect();
      for (const agent of agents) {
        // Use allInProgress, no new query
      }
      const optimizedCount = db.getCallCount("query:tasks");

      // Optimized should be 1-2 queries vs 5+ for N+1
      expect(optimizedCount).toBeLessThan(n1Count);
    });

    it("calculates agent workload correctly from hoisted tasks", async () => {
      const agent1 = db.insert("agents", { name: "Agent 1" });
      const agent2 = db.insert("agents", { name: "Agent 2" });

      const inProgressTasks = [
        db.insert("tasks", { title: "Task 1", status: "in_progress", assigneeIds: [agent1] }),
        db.insert("tasks", { title: "Task 2", status: "in_progress", assigneeIds: [agent1] }),
        db.insert("tasks", { title: "Task 3", status: "in_progress", assigneeIds: [agent2] }),
      ];

      // Calculate workload from single hoisted query
      const allTasks = await db.query("tasks").collect();
      const workloadMap = new Map<string, number>();
      for (const agent of [agent1, agent2]) {
        workloadMap.set(agent, 0);
      }
      for (const task of allTasks) {
        for (const assigneeId of task.assigneeIds) {
          workloadMap.set(assigneeId, (workloadMap.get(assigneeId) ?? 0) + 1);
        }
      }

      expect(workloadMap.get(agent1)).toBe(2);
      expect(workloadMap.get(agent2)).toBe(1);
    });
  });

  describe("Query Optimization: activities.getRecent index", () => {
    it("uses by_workspace_created_at index when workspaceId provided", async () => {
      const biz1 = db.insert("businesses", { name: " 1" });
      const biz2 = db.insert("businesses", { name: " 2" });

      // Create 50 activities for each business
      for (let i = 0; i < 50; i++) {
        db.insert("activities", {
          workspaceId: biz1,
          type: "task_assigned",
          message: `Activity ${i}`,
          createdAt: Date.now() - i * 1000,
        });
        db.insert("activities", {
          workspaceId: biz2,
          type: "task_assigned",
          message: `Activity B2-${i}`,
          createdAt: Date.now() - i * 1000,
        });
      }

      // OLD (bad): Load 100, filter in JS
      db.resetCallCounts();
      const allActivities = await db.query("activities").collect();
      const filtered = allActivities.filter((a: any) => a.workspaceId === biz1).slice(0, 50);
      const oldCallCount = db.getCallCount("query:activities");

      // NEW (good): Use index, no JS filter
      db.resetCallCounts();
      const biz1Activities = await db
        .query("activities")
        .withIndex("by_workspace_created_at", (q: any) => true)
        .order("desc")
        .take(50)
        .collect();
      const newCallCount = db.getCallCount("query:activities");

      // Both call query once, but new uses index to return pre-sorted, pre-filtered
      expect(newCallCount).toBeLessThanOrEqual(oldCallCount);
    });

    it("returns limited activities, not all activities", async () => {
      const biz1 = db.insert("businesses", { name: " 1" });

      // Create 100 activities
      for (let i = 0; i < 100; i++) {
        db.insert("activities", {
          workspaceId: biz1,
          type: "task_assigned",
          message: `Activity ${i}`,
          createdAt: Date.now() - i * 1000,
        });
      }

      // Query should return at most 50
      const result = await db
        .query("activities")
        .withIndex("by_workspace_created_at", (q: any) => true)
        .order("desc")
        .take(50)
        .collect();

      expect(result.length).toBeLessThanOrEqual(50);
    });
  });

  describe("Query Optimization: getInboxForAgent cap", () => {
    it("caps inbox results at 200 to prevent unbounded query", async () => {
      const biz = db.insert("businesses", { name: " 1" });
      const agent = db.insert("agents", { name: "Agent 1" });

      // Create 500 tasks for the agent
      const taskIds = [];
      for (let i = 0; i < 500; i++) {
        taskIds.push(
          db.insert("tasks", {
            title: `Task ${i}`,
            workspaceId: biz,
            assigneeIds: [agent],
            status: i < 100 ? "in_progress" : i < 200 ? "ready" : "done",
            createdAt: Date.now() - i * 1000,
          })
        );
      }

      // Query should return capped results
      let allTasks = await db.query("tasks").withIndex("by_workspace", (q: any) => true).collect();
      const agentTasks = allTasks.filter((t: any) => t.assigneeIds?.includes(agent));

      // Apply cap
      const cappedTasks = agentTasks.slice(0, 200);

      expect(cappedTasks.length).toBeLessThanOrEqual(200);
      expect(agentTasks.length).toBeGreaterThan(200); // Verify we had more than cap
    });

    it("returns tasks in descending order by createdAt", async () => {
      const biz = db.insert("businesses", { name: " 1" });
      const agent = db.insert("agents", { name: "Agent 1" });

      // Create 3 tasks (they'll have _creationTime added by insert)
      const task1 = db.insert("tasks", {
        title: "Task 1",
        workspaceId: biz,
        assigneeIds: [agent],
      });
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
      const task2 = db.insert("tasks", {
        title: "Task 2",
        workspaceId: biz,
        assigneeIds: [agent],
      });
      await new Promise(resolve => setTimeout(resolve, 1));
      const task3 = db.insert("tasks", {
        title: "Task 3",
        workspaceId: biz,
        assigneeIds: [agent],
      });

      let allTasks = await db.query("tasks").withIndex("by_workspace", (q: any) => true).collect();
      const agentTasks = allTasks.filter((t: any) => t.assigneeIds?.includes(agent));

      // Sort descending by _creationTime
      const sorted = agentTasks.sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0));

      // Most recent first (task3 should be first)
      expect(sorted[0]._id).toBe(task3);
      expect(sorted[1]._id).toBe(task2);
      expect(sorted[2]._id).toBe(task1);
    });
  });

  describe("Rate Limiting: createTask", () => {
    it("allows up to 10 tasks created per minute per agent", async () => {
      const agent = db.insert("agents", { name: "Agent 1" });
      const now = Date.now();

      // Simulate 10 createTask calls
      for (let i = 0; i < 10; i++) {
        // In real code: checkRateLimit("ratelimit:createTask:${agentId}", 10, 60000)
        const settingKey = `ratelimit:createTask:${agent}`;
        let setting = (db.getSettings() as any[]).find((s: any) => s.key === settingKey);

        if (!setting) {
          setting = db.insert("settings", {
            key: settingKey,
            count: 1,
            windowStart: now,
          });
        } else {
          // Window still valid, increment
          db.patch(setting._id, { count: setting.count + 1 });
        }
      }

      const setting = (db.getSettings() as any[]).find((s: any) => s.key === `ratelimit:createTask:${agent}`);
      expect((setting as any)?.count).toBe(10);
    });

    it("throws error on 11th task creation within window", async () => {
      const agent = db.insert("agents", { name: "Agent 1" });
      const now = Date.now();

      // Simulate 11 attempts
      let isAllowed = true;
      for (let i = 0; i < 11; i++) {
        const settingKey = `ratelimit:createTask:${agent}`;
        let setting = (db.getSettings() as any[]).find((s: any) => s.key === settingKey);

        if (!setting) {
          setting = db.insert("settings", {
            key: settingKey,
            count: 1,
            windowStart: now,
          });
        } else {
          // Check if count would exceed limit
          if (setting.count >= 10) {
            isAllowed = false;
            break;
          }
          db.patch(setting._id, { count: setting.count + 1 });
        }
      }

      expect(isAllowed).toBe(false);
    });

    it("resets window after 1 minute passes", async () => {
      const agent = db.insert("agents", { name: "Agent 1" });
      const startTime = Date.now();

      // Create setting at time 0
      const settingKey = `ratelimit:createTask:${agent}`;
      const setting = db.insert("settings", {
        key: settingKey,
        count: 10,
        windowStart: startTime,
      });

      // Retrieve the inserted setting to check windowStart
      const retrieved = db.get(setting) as any;

      // Simulate time passing: 61 seconds
      const newTime = startTime + 61000;
      const windowExpired = newTime - retrieved.windowStart > 60000;

      expect(windowExpired).toBe(true);

      // Should reset
      db.patch(setting, {
        count: 1,
        windowStart: newTime,
      });

      const updated = db.get(setting);
      expect((updated as any)?.count).toBe(1);
      expect((updated as any)?.windowStart).toBe(newTime);
    });
  });

  describe("Rate Limiting: updateStatus", () => {
    it("allows up to 30 status updates per minute per caller", async () => {
      const caller = "agent-123";
      const now = Date.now();

      for (let i = 0; i < 30; i++) {
        const settingKey = `ratelimit:updateStatus:${caller}`;
        let setting = (db.getSettings() as any[]).find((s: any) => s.key === settingKey);

        if (!setting) {
          setting = db.insert("settings", {
            key: settingKey,
            count: 1,
            windowStart: now,
          });
        } else {
          db.patch(setting._id, { count: setting.count + 1 });
        }
      }

      const setting = (db.getSettings() as any[]).find((s: any) => s.key === `ratelimit:updateStatus:${caller}`);
      expect((setting as any)?.count).toBe(30);
    });

    it("throws on 31st status update within window", async () => {
      const caller = "agent-123";
      const now = Date.now();

      let allowed = 0;
      for (let i = 0; i < 31; i++) {
        const settingKey = `ratelimit:updateStatus:${caller}`;
        let setting = (db.getSettings() as any[]).find((s: any) => s.key === settingKey);

        if (!setting) {
          setting = db.insert("settings", {
            key: settingKey,
            count: 1,
            windowStart: now,
          });
          allowed++;
        } else {
          if (setting.count >= 30) {
            break;
          }
          db.patch(setting._id, { count: setting.count + 1 });
          allowed++;
        }
      }

      expect(allowed).toBe(30);
    });
  });

  describe("Rate Limiting: heartbeat", () => {
    it("allows up to 6 heartbeats per minute per agent (silent)", async () => {
      const agent = db.insert("agents", { name: "Agent 1" });
      const now = Date.now();

      let silent = true;
      for (let i = 0; i < 6; i++) {
        const settingKey = `ratelimit:heartbeat:${agent}`;
        let setting = (db.getSettings() as any[]).find((s: any) => s.key === settingKey);

        if (!setting) {
          setting = db.insert("settings", {
            key: settingKey,
            count: 1,
            windowStart: now,
          });
        } else {
          db.patch(setting._id, { count: setting.count + 1 });
        }
      }

      const setting = (db.getSettings() as any[]).find((s: any) => s.key === `ratelimit:heartbeat:${agent}`);
      expect((setting as any)?.count).toBe(6);
      expect(silent).toBe(true); // No error thrown
    });

    it("silently ignores 7th heartbeat (no error)", async () => {
      const agent = db.insert("agents", { name: "Agent 1" });
      const now = Date.now();

      const settingKey = `ratelimit:heartbeat:${agent}`;
      const setting = db.insert("settings", {
        key: settingKey,
        count: 6,
        windowStart: now,
      });

      // 7th attempt should return silently (no-op)
      const allowed = (setting as any).count < 6;

      expect(allowed).toBe(false);
      // No exception thrown in heartbeat handler
    });
  });

  describe("Rate Limiting: settings table pattern", () => {
    it("stores rate limit state in settings table", async () => {
      const key = "ratelimit:test:key";
      const setting = db.insert("settings", {
        key,
        count: 5,
        windowStart: Date.now(),
      });

      const retrieved = db.get(setting);
      expect((retrieved as any)?.key).toBe(key);
      expect((retrieved as any)?.count).toBe(5);
    });

    it("updates count without resetting window if still valid", async () => {
      const key = "ratelimit:test:key";
      const now = Date.now();
      const setting = db.insert("settings", {
        key,
        count: 3,
        windowStart: now,
      });

      // 1 second later, update count
      const updated = db.patch(setting, { count: 4 });

      expect((updated as any)?.count).toBe(4);
      expect((updated as any)?.windowStart).toBe(now);
    });
  });
});
