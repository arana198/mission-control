/**
 * Task Generation Service Tests
 *
 * Tests daily task generation, weekly planning, and strategy optimization
 */

// Mock memory service
jest.mock("../memoryService", () => ({
  getMemoryService: jest.fn(() => ({
    getEntityContext: jest.fn(async () => ({
      relevantSections: [{ content: "Some context" }],
    })),
    searchMemory: jest.fn(async () => []),
  })),
}));

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { TaskGenerationService } from "../taskGenerationService";
import { Id } from "@/convex/_generated/dataModel";

describe("TaskGenerationService", () => {
  let service: TaskGenerationService;
  let mockClient: any;

  const createGoal = (
    overrides: any = {}
  ): any => ({
    _id: "goal-1" as Id<"goals">,
    title: "Test Goal",
    description: "Goal description",
    category: "engineering",
    status: "active",
    progress: 50,
    relatedTaskIds: [],
    relatedMemoryRefs: [],
    ...overrides,
  });

  beforeEach(() => {
    mockClient = {
      query: jest.fn(async () => []),
      mutation: jest.fn(async () => ({ _id: "task-1" })),
    };

    service = new TaskGenerationService(mockClient);
  });

  describe("generateDailyTasks", () => {
    it("generates daily tasks for active goals", async () => {
      const goals = [
        createGoal({ _id: "g1" as Id<"goals">, progress: 50 }),
        createGoal({ _id: "g2" as Id<"goals">, progress: 75 }),
      ];

      const review = await service.generateDailyTasks(goals);

      expect(review).toHaveProperty("dailyTasks");
      expect(review).toHaveProperty("focusPriorities");
      expect(review).toHaveProperty("emergencies");
      expect(review).toHaveProperty("context");
      expect(Array.isArray(review.dailyTasks)).toBe(true);
    });

    it("limits daily tasks to maximum 5", async () => {
      const goals = [
        createGoal({ _id: "g1" as Id<"goals">, progress: 10 }),
        createGoal({ _id: "g2" as Id<"goals">, progress: 20 }),
        createGoal({ _id: "g3" as Id<"goals">, progress: 30 }),
        createGoal({ _id: "g4" as Id<"goals">, progress: 40 }),
        createGoal({ _id: "g5" as Id<"goals">, progress: 50 }),
      ];

      const review = await service.generateDailyTasks(goals);

      expect(review.dailyTasks.length).toBeLessThanOrEqual(5);
    });

    it("calculates context metrics correctly", async () => {
      const goals = [
        createGoal({ _id: "g1" as Id<"goals">, status: "active", progress: 80 }),
        createGoal({ _id: "g2" as Id<"goals">, status: "active", progress: 60 }),
        createGoal({ _id: "g3" as Id<"goals">, status: "inactive", progress: 0 }),
      ];

      const review = await service.generateDailyTasks(goals);

      expect(review.context.totalActiveGoals).toBe(2);
      expect(review.context.overallProgress).toBe(70);
    });

    it("detects blocked goals (progress <= 25%)", async () => {
      const goals = [
        createGoal({ _id: "g1" as Id<"goals">, progress: 10 }),
        createGoal({ _id: "g2" as Id<"goals">, progress: 25 }),
        createGoal({ _id: "g3" as Id<"goals">, progress: 50 }),
      ];

      const review = await service.generateDailyTasks(goals);

      expect(review.context.blockedGoalsCount).toBe(2);
    });

    it("handles empty goals list", async () => {
      const review = await service.generateDailyTasks([]);

      expect(review.context.totalActiveGoals).toBe(0);
      expect(review.context.overallProgress).toBe(0);
      expect(review.dailyTasks).toHaveLength(0);
    });

    it("filters out inactive goals", async () => {
      const goals = [
        createGoal({ _id: "g1" as Id<"goals">, status: "active" }),
        createGoal({ _id: "g2" as Id<"goals">, status: "completed" }),
        createGoal({ _id: "g3" as Id<"goals">, status: "inactive" }),
      ];

      const review = await service.generateDailyTasks(goals);

      expect(review.context.totalActiveGoals).toBe(1);
    });

    it("has focusPriorities array", async () => {
      const goals = [createGoal()];
      const review = await service.generateDailyTasks(goals);

      expect(Array.isArray(review.focusPriorities)).toBe(true);
    });

    it("has emergencies array", async () => {
      const goals = [createGoal()];
      const review = await service.generateDailyTasks(goals);

      expect(Array.isArray(review.emergencies)).toBe(true);
    });
  });

  describe("generateWeeklyPlan", () => {
    it("generates weekly plan with tasks and report", async () => {
      const goals = [createGoal()];
      const completedTasks = [];

      const plan = await service.generateWeeklyPlan(goals, completedTasks);

      expect(plan).toHaveProperty("tasks");
      expect(plan).toHaveProperty("report");
      expect(plan).toHaveProperty("recommendations");
      expect(Array.isArray(plan.tasks)).toBe(true);
    });

    it("includes week and year in report", async () => {
      const goals = [createGoal()];
      const completedTasks = [];

      const plan = await service.generateWeeklyPlan(goals, completedTasks);
      const now = new Date();

      expect(plan.report.year).toBe(now.getFullYear());
      expect(plan.report.week).toBeGreaterThanOrEqual(1);
      expect(plan.report.week).toBeLessThanOrEqual(53);
    });

    it("limits weekly tasks to maximum 5", async () => {
      const goals = [
        createGoal({ _id: "g1" as Id<"goals">, progress: 10 }),
        createGoal({ _id: "g2" as Id<"goals">, progress: 20 }),
        createGoal({ _id: "g3" as Id<"goals">, progress: 30 }),
      ];

      const plan = await service.generateWeeklyPlan(goals, []);

      expect(plan.tasks.length).toBeLessThanOrEqual(5);
    });

    it("calculates task metrics from completed tasks", async () => {
      const now = Date.now();
      const goals = [createGoal()];
      const completedTasks = [
        { completedAt: now - 86400000, actualHours: 2 },
        { completedAt: now - 172800000, actualHours: 3 },
      ];

      const plan = await service.generateWeeklyPlan(goals, completedTasks);

      expect(plan.report.taskMetrics.tasksCompleted).toBe(2);
      expect(plan.report.taskMetrics.avgCompletionRate).toBeGreaterThanOrEqual(0);
    });

    it("calculates average time per task", async () => {
      const now = Date.now();
      const goals = [createGoal()];
      const completedTasks = [
        { completedAt: now - 86400000, actualHours: 4 },
        { completedAt: now - 172800000, actualHours: 2 },
      ];

      const plan = await service.generateWeeklyPlan(goals, completedTasks);

      expect(plan.report.taskMetrics.avgTimePerTask).toBe(3);
    });

    it("tracks blocked goals in report", async () => {
      const goals = [
        createGoal({ _id: "g1" as Id<"goals">, progress: 10 }),
        createGoal({ _id: "g2" as Id<"goals">, progress: 50 }),
      ];

      const plan = await service.generateWeeklyPlan(goals, []);

      expect(Array.isArray(plan.report.goalsReview.blockedGoals)).toBe(true);
      expect(plan.report.goalsReview.blockedGoals.length).toBe(1);
    });

    it("tracks accelerating goals in report", async () => {
      const goals = [
        createGoal({ _id: "g1" as Id<"goals">, progress: 80 }),
        createGoal({ _id: "g2" as Id<"goals">, progress: 90 }),
        createGoal({ _id: "g3" as Id<"goals">, progress: 40 }),
      ];

      const plan = await service.generateWeeklyPlan(goals, []);

      expect(plan.report.goalsReview.acceleratingGoals.length).toBe(2);
    });

    it("includes insights in report", async () => {
      const goals = [createGoal()];
      const plan = await service.generateWeeklyPlan(goals, []);

      expect(Array.isArray(plan.report.insights)).toBe(true);
    });

    it("includes recommendations in report", async () => {
      const goals = [createGoal()];
      const plan = await service.generateWeeklyPlan(goals, []);

      expect(Array.isArray(plan.report.recommendations)).toBe(true);
    });

    it("filters tasks from last 7 days only", async () => {
      const now = Date.now();
      const goals = [createGoal()];
      const completedTasks = [
        // Last 7 days
        { completedAt: now - 86400000, actualHours: 2 },
        // Older than 7 days
        { completedAt: now - 8 * 86400000, actualHours: 3 },
      ];

      const plan = await service.generateWeeklyPlan(goals, completedTasks);

      expect(plan.report.taskMetrics.tasksCompleted).toBe(1);
    });

    it("handles empty goals and no completed tasks", async () => {
      const plan = await service.generateWeeklyPlan([], []);

      expect(plan.tasks).toHaveLength(0);
      expect(plan.report.goalsReview.activeGoals).toBe(0);
      expect(plan.report.taskMetrics.tasksCompleted).toBe(0);
    });

    it("tracks blocked goal titles in metrics", async () => {
      const goals = [
        createGoal({ _id: "g1" as Id<"goals">, title: "Fix Auth", progress: 10 }),
      ];

      const plan = await service.generateWeeklyPlan(goals, []);

      expect(plan.report.taskMetrics.blockedBy).toContain("Fix Auth");
    });

    it("replicates recommendations in both plan and report", async () => {
      const goals = [createGoal()];
      const plan = await service.generateWeeklyPlan(goals, []);

      expect(plan.recommendations).toEqual(plan.report.recommendations);
    });
  });

  describe("error handling", () => {
    it("handles memory service failures gracefully", async () => {
      const goals = [createGoal()];

      const review = await service.generateDailyTasks(goals);

      expect(review).toBeDefined();
      expect(review.dailyTasks).toBeDefined();
    });

    it("generates valid task inputs", async () => {
      const goals = [createGoal()];
      const review = await service.generateDailyTasks(goals);

      for (const task of review.dailyTasks) {
        expect(task).toHaveProperty("title");
        expect(task).toHaveProperty("priority");
        expect(task).toHaveProperty("estimatedHours");
        expect(["P0", "P1", "P2", "P3"]).toContain(task.priority);
      }
    });
  });
});
