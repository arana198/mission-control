/**
 * Graph Validation Tests
 *
 * Comprehensive test suite for cycle detection and dependency analysis.
 * Tests all scenarios: simple cycles, transitive cycles, self-loops, valid graphs.
 */

import { detectCycle, getTransitiveDependencies, getTransitiveDependents, getCriticalPath } from "../graphValidation";
import { Id } from "../../_generated/dataModel";

/**
 * Mock context builder for testing
 */
class MockDatabase {
  private tasks: Map<string, any> = new Map();

  addTask(id: string, task: any) {
    this.tasks.set(id, task);
  }

  async get(id: Id<"tasks">) {
    return this.tasks.get(id as string);
  }

  async getAllTasks() {
    return Array.from(this.tasks.values());
  }
}

/**
 * Mock Convex context
 */
function createMockCtx(db: MockDatabase) {
  return {
    db: {
      get: (id: Id<"tasks">) => db.get(id),
    },
  };
}

describe("Graph Validation - Cycle Detection", () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  describe("detectCycle - Self-reference", () => {
    it("should detect self-loop (A -> A)", async () => {
      const ctx = createMockCtx(db);
      const taskId = "task-A" as Id<"tasks">;

      db.addTask("task-A", {
        _id: taskId,
        title: "Task A",
        blockedBy: [],
        blocks: [],
      });

      // Self-reference is A -> A (task depends on itself)
      // detectCycle checks if adding A -> A would create cycle
      // It would, since A is already in its own dependency path
      const result = await detectCycle(ctx as any, taskId, taskId);
      expect(result).toBe(true);
    });
  });

  describe("detectCycle - Simple Cycles", () => {
    it("should detect simple 2-node cycle (A -> B -> A)", async () => {
      const ctx = createMockCtx(db);
      const taskA = "task-A" as Id<"tasks">;
      const taskB = "task-B" as Id<"tasks">;

      // Current state: B depends on A
      db.addTask("task-A", {
        _id: taskA,
        title: "Task A",
        blockedBy: [],
        blocks: [taskB],
      });

      db.addTask("task-B", {
        _id: taskB,
        title: "Task B",
        blockedBy: [taskA], // B is blocked by A
        blocks: [],
      });

      // Try to add: A depends on B
      // This would create A -> B -> A (cycle)
      const result = await detectCycle(ctx as any, taskA, taskB);
      expect(result).toBe(true);
    });

    it("should NOT detect cycle if no reverse path exists", async () => {
      const ctx = createMockCtx(db);
      const taskA = "task-A" as Id<"tasks">;
      const taskB = "task-B" as Id<"tasks">;

      // A is independent, B has no dependencies
      db.addTask("task-A", {
        _id: taskA,
        title: "Task A",
        blockedBy: [],
        blocks: [],
      });

      db.addTask("task-B", {
        _id: taskB,
        title: "Task B",
        blockedBy: [],
        blocks: [],
      });

      // Try to add: A depends on B
      // No cycle exists, this is fine
      const result = await detectCycle(ctx as any, taskA, taskB);
      expect(result).toBe(false);
    });
  });

  describe("detectCycle - Transitive Cycles", () => {
    it("should detect transitive 3-node cycle (A -> B -> C -> A)", async () => {
      const ctx = createMockCtx(db);
      const taskA = "task-A" as Id<"tasks">;
      const taskB = "task-B" as Id<"tasks">;
      const taskC = "task-C" as Id<"tasks">;

      // Current chain: C depends on B, B depends on A
      db.addTask("task-A", {
        _id: taskA,
        title: "Task A",
        blockedBy: [],
        blocks: [taskB],
      });

      db.addTask("task-B", {
        _id: taskB,
        title: "Task B",
        blockedBy: [taskA],
        blocks: [taskC],
      });

      db.addTask("task-C", {
        _id: taskC,
        title: "Task C",
        blockedBy: [taskB],
        blocks: [],
      });

      // Try to add: A depends on C
      // This creates A -> B -> C -> A (cycle)
      const result = await detectCycle(ctx as any, taskA, taskC);
      expect(result).toBe(true);
    });

    it("should detect long transitive cycle (A -> B -> C -> D -> A)", async () => {
      const ctx = createMockCtx(db);
      const taskA = "task-A" as Id<"tasks">;
      const taskB = "task-B" as Id<"tasks">;
      const taskC = "task-C" as Id<"tasks">;
      const taskD = "task-D" as Id<"tasks">;

      // Chain: D -> C -> B -> A
      db.addTask("task-A", {
        _id: taskA,
        blockedBy: [],
        blocks: [taskB],
      });

      db.addTask("task-B", {
        _id: taskB,
        blockedBy: [taskA],
        blocks: [taskC],
      });

      db.addTask("task-C", {
        _id: taskC,
        blockedBy: [taskB],
        blocks: [taskD],
      });

      db.addTask("task-D", {
        _id: taskD,
        blockedBy: [taskC],
        blocks: [],
      });

      // Try to add: A depends on D -> creates A -> B -> C -> D -> A
      const result = await detectCycle(ctx as any, taskA, taskD);
      expect(result).toBe(true);
    });
  });

  describe("detectCycle - Multiple Dependencies", () => {
    it("should handle task with multiple blockers", async () => {
      const ctx = createMockCtx(db);
      const taskA = "task-A" as Id<"tasks">;
      const taskB = "task-B" as Id<"tasks">;
      const taskC = "task-C" as Id<"tasks">;

      // B is blocked by both A and C
      db.addTask("task-A", {
        _id: taskA,
        blockedBy: [],
        blocks: [taskB],
      });

      db.addTask("task-B", {
        _id: taskB,
        blockedBy: [taskA, taskC],
        blocks: [],
      });

      db.addTask("task-C", {
        _id: taskC,
        blockedBy: [taskA], // C also depends on A
        blocks: [taskB],
      });

      // Try to add: A depends on B -> cycle through either path
      const result = await detectCycle(ctx as any, taskA, taskB);
      expect(result).toBe(true);
    });

    it("should not detect cycle in diamond dependency", async () => {
      const ctx = createMockCtx(db);
      const taskA = "task-A" as Id<"tasks">;
      const taskB = "task-B" as Id<"tasks">;
      const taskC = "task-C" as Id<"tasks">;
      const taskD = "task-D" as Id<"tasks">;

      // Diamond: D depends on B and C, both depend on A
      // A (top) -> B -> D (bottom), A -> C -> D
      db.addTask("task-A", {
        _id: taskA,
        blockedBy: [],
        blocks: [taskB, taskC],
      });

      db.addTask("task-B", {
        _id: taskB,
        blockedBy: [taskA],
        blocks: [taskD],
      });

      db.addTask("task-C", {
        _id: taskC,
        blockedBy: [taskA],
        blocks: [taskD],
      });

      db.addTask("task-D", {
        _id: taskD,
        blockedBy: [taskB, taskC],
        blocks: [],
      });

      // Try to add a new task E that depends on D
      const taskE = "task-E" as Id<"tasks">;
      db.addTask("task-E", {
        _id: taskE,
        blockedBy: [taskD],
        blocks: [],
      });

      // No cycle should exist
      const result = await detectCycle(ctx as any, taskE, taskA);
      expect(result).toBe(false);
    });
  });

  describe("detectCycle - Edge Cases", () => {
    it("should handle non-existent tasks gracefully", async () => {
      const ctx = createMockCtx(db);
      const taskA = "task-A" as Id<"tasks">;
      const nonExistent = "task-nonexistent" as Id<"tasks">;

      db.addTask("task-A", {
        _id: taskA,
        blockedBy: [nonExistent], // Points to non-existent task
        blocks: [],
      });

      // Should handle gracefully and not crash
      const result = await detectCycle(ctx as any, taskA, nonExistent);
      expect(result).toBe(false);
    });

    it("should handle empty blockedBy arrays", async () => {
      const ctx = createMockCtx(db);
      const taskA = "task-A" as Id<"tasks">;
      const taskB = "task-B" as Id<"tasks">;

      db.addTask("task-A", {
        _id: taskA,
        blockedBy: [],
        blocks: [],
      });

      db.addTask("task-B", {
        _id: taskB,
        blockedBy: [],
        blocks: [],
      });

      const result = await detectCycle(ctx as any, taskA, taskB);
      expect(result).toBe(false);
    });

    it("should handle null/undefined blockedBy", async () => {
      const ctx = createMockCtx(db);
      const taskA = "task-A" as Id<"tasks">;
      const taskB = "task-B" as Id<"tasks">;

      db.addTask("task-A", {
        _id: taskA,
        blockedBy: undefined, // No dependencies
        blocks: [],
      });

      db.addTask("task-B", {
        _id: taskB,
        blockedBy: null,
        blocks: [],
      });

      const result = await detectCycle(ctx as any, taskA, taskB);
      expect(result).toBe(false);
    });
  });
});

describe("Graph Validation - Transitive Dependencies", () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it("should get all transitive dependencies", async () => {
    const ctx = createMockCtx(db);
    const taskA = "task-A" as Id<"tasks">;
    const taskB = "task-B" as Id<"tasks">;
    const taskC = "task-C" as Id<"tasks">;

    // Chain: C depends on B, B depends on A
    db.addTask("task-A", {
      _id: taskA,
      blockedBy: [],
      blocks: [taskB],
    });

    db.addTask("task-B", {
      _id: taskB,
      blockedBy: [taskA],
      blocks: [taskC],
    });

    db.addTask("task-C", {
      _id: taskC,
      blockedBy: [taskB],
      blocks: [],
    });

    const deps = await getTransitiveDependencies(ctx as any, taskC);
    expect(deps).toContain(taskB);
    expect(deps).toContain(taskA);
    expect(deps.length).toBe(2);
  });

  it("should handle task with no dependencies", async () => {
    const ctx = createMockCtx(db);
    const taskA = "task-A" as Id<"tasks">;

    db.addTask("task-A", {
      _id: taskA,
      blockedBy: [],
      blocks: [],
    });

    const deps = await getTransitiveDependencies(ctx as any, taskA);
    expect(deps.length).toBe(0);
  });
});

describe("Graph Validation - Transitive Dependents", () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it("should get all tasks blocked by this task", async () => {
    const ctx = createMockCtx(db);
    const taskA = "task-A" as Id<"tasks">;
    const taskB = "task-B" as Id<"tasks">;
    const taskC = "task-C" as Id<"tasks">;

    // Chain: C depends on B depends on A
    db.addTask("task-A", {
      _id: taskA,
      blockedBy: [],
      blocks: [taskB],
    });

    db.addTask("task-B", {
      _id: taskB,
      blockedBy: [taskA],
      blocks: [taskC],
    });

    db.addTask("task-C", {
      _id: taskC,
      blockedBy: [taskB],
      blocks: [],
    });

    const dependents = await getTransitiveDependents(ctx as any, taskA);
    expect(dependents).toContain(taskB);
    expect(dependents).toContain(taskC);
    expect(dependents.length).toBe(2);
  });
});

describe("Graph Validation - Critical Path", () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it("should find longest dependency chain", async () => {
    const ctx = createMockCtx(db);
    const taskA = "task-A" as Id<"tasks">;
    const taskB = "task-B" as Id<"tasks">;
    const taskC = "task-C" as Id<"tasks">;

    // Chain: C -> B -> A (longest)
    db.addTask("task-A", {
      _id: taskA,
      blockedBy: [],
      blocks: [taskB],
    });

    db.addTask("task-B", {
      _id: taskB,
      blockedBy: [taskA],
      blocks: [taskC],
    });

    db.addTask("task-C", {
      _id: taskC,
      blockedBy: [taskB],
      blocks: [],
    });

    const path = await getCriticalPath(ctx as any, taskC);
    expect(path).toEqual([taskC, taskB, taskA]);
  });

  it("should handle branching paths and pick longest", async () => {
    const ctx = createMockCtx(db);
    const taskA = "task-A" as Id<"tasks">;
    const taskB = "task-B" as Id<"tasks">;
    const taskC = "task-C" as Id<"tasks">;
    const taskD = "task-D" as Id<"tasks">;

    // Diamond with longer path: D -> (C -> B -> A) or (B -> A)
    db.addTask("task-A", {
      _id: taskA,
      blockedBy: [],
      blocks: [taskB, taskC],
    });

    db.addTask("task-B", {
      _id: taskB,
      blockedBy: [taskA],
      blocks: [taskD],
    });

    db.addTask("task-C", {
      _id: taskC,
      blockedBy: [taskA],
      blocks: [taskD],
    });

    db.addTask("task-D", {
      _id: taskD,
      blockedBy: [taskB, taskC],
      blocks: [],
    });

    const path = await getCriticalPath(ctx as any, taskD);
    // Should include D and at least one of the chains
    expect(path[0]).toBe(taskD);
    expect(path.length).toBeGreaterThanOrEqual(2);
  });
});
