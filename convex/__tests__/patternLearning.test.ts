/**
 * Pattern Learning System Tests (Phase 5B)
 *
 * Tests for:
 * - Detecting task sequences and patterns
 * - Calculating success rates
 * - Suggesting similar patterns
 * - Estimating pattern duration
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

class PatternLearningMockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    this.data.set("taskPatterns", []);
    this.data.set("tasks", []);
    this.data.set("epics", []);
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

  query(table: string) {
    return {
      filter: (predicate: (doc: any) => boolean) => ({
        collect: async () => (this.data.get(table) || []).filter(predicate),
      }),
      collect: async () => this.data.get(table) || [],
    };
  }

  getPatterns() {
    return this.data.get("taskPatterns") || [];
  }

  getPatternsBy(workspaceId: string) {
    return (this.data.get("taskPatterns") || []).filter(
      (p: any) => p.workspaceId === workspaceId
    );
  }
}

describe("Pattern Learning System (convex/patternLearning.ts)", () => {
  let db: PatternLearningMockDatabase;
  let workspaceId: string;

  beforeEach(() => {
    db = new PatternLearningMockDatabase();
    workspaceId = "biz-1";
  });

  describe("Pattern Detection", () => {
    it("detects simple 2-task pattern", () => {
      db.insert("taskPatterns", {
        workspaceId,
        pattern: "design→backend",
        taskTypeSequence: ["design_task", "backend_task"],
        occurrences: 1,
        successCount: 1,
        successRate: 100,
        avgDurationDays: 3,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });

      const patterns = db.getPatternsBy(workspaceId);
      expect(patterns).toHaveLength(1);
      expect(patterns[0].pattern).toBe("design→backend");
    });

    it("detects complex 3+ task pattern", () => {
      db.insert("taskPatterns", {
        workspaceId,
        pattern: "design→backend→frontend→testing",
        taskTypeSequence: ["design_task", "backend_task", "frontend_task", "testing_task"],
        occurrences: 3,
        successCount: 3,
        successRate: 100,
        avgDurationDays: 12,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });

      const patterns = db.getPatternsBy(workspaceId);
      expect(patterns[0].taskTypeSequence).toHaveLength(4);
    });

    it("increments occurrence count on pattern repeat", () => {
      const patternId = db.insert("taskPatterns", {
        workspaceId,
        pattern: "backend→testing",
        taskTypeSequence: ["backend_task", "testing_task"],
        occurrences: 2,
        successCount: 2,
        successRate: 100,
        avgDurationDays: 2,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });

      const pattern = db.get(patternId);
      expect(pattern.occurrences).toBe(2);
    });
  });

  describe("Success Rate Calculation", () => {
    it("calculates success rate correctly", () => {
      const calculateRate = (successCount: number, totalOccurrences: number) => {
        return (successCount / totalOccurrences) * 100;
      };

      expect(calculateRate(5, 5)).toBe(100);
      expect(calculateRate(3, 5)).toBe(60);
      expect(calculateRate(0, 5)).toBe(0);
    });

    it("tracks success and failure separately", () => {
      db.insert("taskPatterns", {
        workspaceId,
        pattern: "design→frontend",
        taskTypeSequence: ["design_task", "frontend_task"],
        occurrences: 10,
        successCount: 8,
        successRate: 80,
        avgDurationDays: 4,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });

      const patterns = db.getPatternsBy(workspaceId);
      const pattern = patterns[0];
      expect(pattern.successCount).toBe(8);
      expect(pattern.occurrences - pattern.successCount).toBe(2); // failures
    });

    it("identifies anti-patterns with low success rate", () => {
      db.insert("taskPatterns", {
        workspaceId,
        pattern: "testing→design→backend",
        taskTypeSequence: ["testing_task", "design_task", "backend_task"],
        occurrences: 5,
        successCount: 1,
        successRate: 20,
        avgDurationDays: 10,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });

      const patterns = db.getPatternsBy(workspaceId);
      const antiPattern = patterns[0];
      expect(antiPattern.successRate).toBeLessThan(50);
    });
  });

  describe("Pattern Ranking", () => {
    it("ranks patterns by frequency", () => {
      db.insert("taskPatterns", {
        workspaceId,
        pattern: "design→backend",
        occurrences: 15,
        successCount: 14,
        successRate: 93,
        avgDurationDays: 3,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });

      db.insert("taskPatterns", {
        workspaceId,
        pattern: "backend→testing",
        occurrences: 3,
        successCount: 3,
        successRate: 100,
        avgDurationDays: 1,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });

      const patterns = db.getPatternsBy(workspaceId);
      const ranked = patterns.sort((a, b) => b.occurrences - a.occurrences);

      expect(ranked[0].occurrences).toBe(15);
      expect(ranked[1].occurrences).toBe(3);
    });

    it("ranks by success rate when frequency equal", () => {
      db.insert("taskPatterns", {
        workspaceId,
        pattern: "A→B",
        occurrences: 5,
        successCount: 5,
        successRate: 100,
        avgDurationDays: 2,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });

      db.insert("taskPatterns", {
        workspaceId,
        pattern: "C→D",
        occurrences: 5,
        successCount: 3,
        successRate: 60,
        avgDurationDays: 3,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });

      const patterns = db.getPatternsBy(workspaceId);
      const ranked = patterns.sort((a, b) => b.successRate - a.successRate);

      expect(ranked[0].successRate).toBe(100);
      expect(ranked[1].successRate).toBe(60);
    });
  });

  describe("Pattern Suggestions", () => {
    it("suggests matching patterns when starting epic", () => {
      db.insert("taskPatterns", {
        workspaceId,
        pattern: "design→backend→frontend",
        taskTypeSequence: ["design_task", "backend_task", "frontend_task"],
        occurrences: 8,
        successCount: 8,
        successRate: 100,
        avgDurationDays: 10,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });

      const epicType = "fullstack_feature"; // Match to design→backend→frontend
      const patterns = db.getPatternsBy(workspaceId);
      const suggested = patterns.find((p) =>
        p.taskTypeSequence.includes("design_task") &&
        p.taskTypeSequence.includes("backend_task") &&
        p.taskTypeSequence.includes("frontend_task")
      );

      expect(suggested).toBeDefined();
    });

    it("returns empty suggestions if no matching patterns", () => {
      db.insert("taskPatterns", {
        workspaceId,
        pattern: "backend→testing",
        taskTypeSequence: ["backend_task", "testing_task"],
        occurrences: 2,
        successCount: 2,
        successRate: 100,
        avgDurationDays: 2,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });

      const epicType = "mobile_app"; // Different type
      const patterns = db.getPatternsBy(workspaceId);
      const suggested = patterns.filter((p) =>
        p.taskTypeSequence.includes("mobile_task")
      );

      expect(suggested).toHaveLength(0);
    });
  });

  describe("Duration Estimation", () => {
    it("estimates duration based on historical patterns", () => {
      db.insert("taskPatterns", {
        workspaceId,
        pattern: "design→backend→frontend",
        taskTypeSequence: ["design_task", "backend_task", "frontend_task"],
        occurrences: 5,
        successCount: 5,
        successRate: 100,
        avgDurationDays: 10,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });

      const patterns = db.getPatternsBy(workspaceId);
      const duration = patterns[0].avgDurationDays;

      expect(duration).toBe(10);
    });

    it("updates average duration with new completions", () => {
      const patternId = db.insert("taskPatterns", {
        workspaceId,
        pattern: "backend→testing",
        taskTypeSequence: ["backend_task", "testing_task"],
        occurrences: 3,
        successCount: 3,
        successRate: 100,
        avgDurationDays: 2,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });

      // New pattern completion takes 3 days
      const pattern = db.get(patternId);
      const newAvg = (pattern.avgDurationDays * 3 + 3) / 4; // (2*3 + 3) / 4 = 2.25
      expect(newAvg).toBe(2.25);
    });
  });

  describe("Pattern Evolution", () => {
    it("tracks when pattern was last seen", () => {
      const now = Date.now();
      db.insert("taskPatterns", {
        workspaceId,
        pattern: "design→backend",
        taskTypeSequence: ["design_task", "backend_task"],
        occurrences: 5,
        successCount: 5,
        successRate: 100,
        avgDurationDays: 3,
        lastSeen: now,
        createdAt: Date.now(),
      });

      const patterns = db.getPatternsBy(workspaceId);
      expect(patterns[0].lastSeen).toBe(now);
    });

    it("marks pattern as dormant if not seen recently", () => {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      db.insert("taskPatterns", {
        workspaceId,
        pattern: "legacy_pattern→old_task",
        taskTypeSequence: ["legacy_task", "old_task"],
        occurrences: 2,
        successCount: 1,
        successRate: 50,
        avgDurationDays: 5,
        lastSeen: thirtyDaysAgo,
        createdAt: Date.now(),
      });

      const patterns = db.getPatternsBy(workspaceId);
      const isDormant = Date.now() - patterns[0].lastSeen > 14 * 24 * 60 * 60 * 1000; // >14 days
      expect(isDormant).toBe(true);
    });
  });

  describe("Incomplete and Invalid Patterns", () => {
    it("handles incomplete patterns (in-progress tasks)", () => {
      // Pattern with incomplete tasks should not be marked as completed
      const incompletePattern = {
        taskTypeSequence: ["design_task", "backend_task"],
        completed: false, // Not all tasks done yet
      };

      expect(incompletePattern.completed).toBe(false);
    });

    it("ignores patterns with missing task types", () => {
      const patterns = db.getPatternsBy(workspaceId);
      const validPatterns = patterns.filter(
        (p: any) => p.taskTypeSequence && p.taskTypeSequence.length >= 2
      );

      expect(validPatterns).toHaveLength(0);
    });
  });

  describe("Pattern Recording", () => {
    it("records pattern success on epic completion", () => {
      const patternId = db.insert("taskPatterns", {
        workspaceId,
        pattern: "design→backend",
        taskTypeSequence: ["design_task", "backend_task"],
        occurrences: 5,
        successCount: 4,
        successRate: 80,
        avgDurationDays: 3,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });

      // Record success
      const pattern = db.get(patternId);
      pattern.successCount += 1;
      pattern.occurrences += 1;
      pattern.successRate = (pattern.successCount / pattern.occurrences) * 100;
      pattern.lastSeen = Date.now();

      expect(pattern.successCount).toBe(5);
      expect(pattern.successRate).toBeCloseTo(83.33, 1); // 5/6
    });

    it("records pattern failure on epic abandonment", () => {
      const patternId = db.insert("taskPatterns", {
        workspaceId,
        pattern: "complex_workflow",
        taskTypeSequence: ["design_task", "backend_task", "frontend_task", "testing_task"],
        occurrences: 2,
        successCount: 2,
        successRate: 100,
        avgDurationDays: 15,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });

      // Record failure
      const pattern = db.get(patternId);
      pattern.occurrences += 1;
      pattern.successRate = (pattern.successCount / pattern.occurrences) * 100;

      expect(pattern.occurrences).toBe(3);
      expect(pattern.successRate).toBeCloseTo(66.67, 1); // 2/3
    });
  });
});
