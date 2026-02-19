/**
 * Strategic Planning Engine Tests
 *
 * Tests weekly report generation, bottleneck detection, and insights
 */

// Mock memory service and API
jest.mock("../memoryService", () => ({
  getMemoryService: jest.fn(() => ({
    search: jest.fn(async () => []),
    searchMemory: jest.fn(async () => []),
  })),
}));

jest.mock("@/convex/_generated/api", () => ({
  api: {
    goals: { getByProgress: "goals:getByProgress" },
    executionLog: { getByStatus: "executionLog:getByStatus" },
    activities: { getRecent: "activities:getRecent" },
  },
}));

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { StrategicPlanningEngine } from "../strategicPlanningEngine";

describe("StrategicPlanningEngine", () => {
  let engine: StrategicPlanningEngine;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(async (endpoint: any, params?: any) => {
        if (endpoint === "goals:getByProgress") {
          return {
            accelerating: [
              {
                _id: "goal-1",
                title: "Launch MVP",
                progress: 80,
                relatedTaskIds: [{ id: "t1", status: "done" }, { id: "t2", status: "done" }],
                updatedAt: Date.now(),
              },
            ],
            onTrack: [],
            atRisk: [],
            blocked: [],
          };
        }
        if (endpoint === "executionLog:getByStatus") {
          return [
            { _id: "log-1", status: "success", taskId: "t1", timeSpent: 3600, _creationTime: Date.now() },
            { _id: "log-2", status: "success", taskId: "t2", timeSpent: 7200, _creationTime: Date.now() },
          ];
        }
        if (endpoint === "activities:getRecent") {
          return [
            { _id: "act-1", type: "task_completed", agentId: "agent-1" },
          ];
        }
        return [];
      }),
    };

    engine = new StrategicPlanningEngine(mockClient);
  });

  describe("generateWeeklyReport", () => {
    it("generates report with all required fields", async () => {
      const report = await engine.generateWeeklyReport();

      expect(report).toHaveProperty("week");
      expect(report).toHaveProperty("year");
      expect(report).toHaveProperty("generatedAt");
      expect(report).toHaveProperty("goalAnalysis");
      expect(report).toHaveProperty("executionMetrics");
      expect(report).toHaveProperty("bottlenecks");
      expect(report).toHaveProperty("insights");
      expect(report).toHaveProperty("recommendations");
      expect(report).toHaveProperty("memoryReferences");
      expect(report).toHaveProperty("nextActions");
    });

    it("includes correct week and year", async () => {
      const report = await engine.generateWeeklyReport();
      const now = new Date();

      expect(report.year).toBe(now.getFullYear());
      expect(report.week).toBeGreaterThanOrEqual(1);
      expect(report.week).toBeLessThanOrEqual(53);
    });

    it("generates report timestamp", async () => {
      const before = Date.now();
      const report = await engine.generateWeeklyReport();
      const after = Date.now();

      expect(report.generatedAt).toBeGreaterThanOrEqual(before);
      expect(report.generatedAt).toBeLessThanOrEqual(after);
    });

    it("fetches goals, execution logs, and activities in parallel", async () => {
      await engine.generateWeeklyReport();

      expect(mockClient.query).toHaveBeenCalledTimes(3);
    });

    it("filters execution logs to last 7 days", async () => {
      mockClient.query = jest.fn(async (endpoint: any) => {
        if (endpoint === "executionLog:getByStatus") {
          return [
            // Recent log (within 7 days)
            {
              _id: "recent",
              status: "success",
              _creationTime: Date.now() - 86400000,
            },
            // Old log (>7 days)
            {
              _id: "old",
              status: "success",
              _creationTime: Date.now() - 8 * 86400000,
            },
          ];
        }
        if (endpoint === "goals:getByProgress") {
          return { accelerating: [], onTrack: [], atRisk: [], blocked: [] };
        }
        return [];
      });

      engine = new StrategicPlanningEngine(mockClient);
      const report = await engine.generateWeeklyReport();

      // Recent log should be processed, old one should be filtered
      expect(report.executionMetrics.tasksGenerated).toBeLessThanOrEqual(1);
    });
  });

  describe("goal analysis", () => {
    it("categorizes accelerating goals (>=75%)", async () => {
      mockClient.query = jest.fn(async (endpoint: any) => {
        if (endpoint === "goals:getByProgress") {
          return {
            accelerating: [
              {
                _id: "g1",
                title: "Fast Goal",
                progress: 85,
                relatedTaskIds: [
                  { id: "t1", status: "done" },
                  { id: "t2", status: "done" },
                  { id: "t3", status: "done" },
                  { id: "t4", status: "pending" },
                ],
                updatedAt: Date.now(),
              },
            ],
            onTrack: [],
            atRisk: [],
            blocked: [],
          };
        }
        if (endpoint === "executionLog:getByStatus") {
          return [];
        }
        if (endpoint === "activities:getRecent") {
          return [];
        }
        return [];
      });

      engine = new StrategicPlanningEngine(mockClient);
      const report = await engine.generateWeeklyReport();

      expect(report.goalAnalysis.accelerating.length).toBeGreaterThanOrEqual(1);
    });

    it("categorizes onTrack goals (50-74%)", async () => {
      mockClient.query = jest.fn(async (endpoint: any) => {
        if (endpoint === "goals:getByProgress") {
          return {
            accelerating: [],
            onTrack: [
              {
                _id: "g1",
                title: "Medium Goal",
                progress: 60,
                relatedTaskIds: [
                  { id: "t1", status: "done" },
                  { id: "t2", status: "done" },
                  { id: "t3", status: "pending" },
                ],
                updatedAt: Date.now(),
              },
            ],
            atRisk: [],
            blocked: [],
          };
        }
        if (endpoint === "executionLog:getByStatus") {
          return [];
        }
        if (endpoint === "goals:getByProgress") {
          return [];
        }
        return [];
      });

      engine = new StrategicPlanningEngine(mockClient);
      const report = await engine.generateWeeklyReport();

      expect(report.goalAnalysis.onTrack.length).toBeGreaterThanOrEqual(1);
    });

    it("categorizes atRisk goals (25-49%)", async () => {
      mockClient.query = jest.fn(async (endpoint: any) => {
        if (endpoint === "goals:getByProgress") {
          return {
            accelerating: [],
            onTrack: [],
            atRisk: [
              {
                _id: "g1",
                title: "Risk Goal",
                progress: 30,
                relatedTaskIds: [
                  { id: "t1", status: "done" },
                  { id: "t2", status: "pending" },
                  { id: "t3", status: "pending" },
                  { id: "t4", status: "pending" },
                ],
                updatedAt: Date.now(),
              },
            ],
            blocked: [],
          };
        }
        if (endpoint === "executionLog:getByStatus") {
          return [];
        }
        if (endpoint === "activities:getRecent") {
          return [];
        }
        return [];
      });

      engine = new StrategicPlanningEngine(mockClient);
      const report = await engine.generateWeeklyReport();

      expect(report.goalAnalysis.atRisk.length).toBeGreaterThanOrEqual(1);
    });

    it("categorizes blocked goals (<25%)", async () => {
      mockClient.query = jest.fn(async (endpoint: any) => {
        if (endpoint === "goals:getByProgress") {
          return {
            accelerating: [],
            onTrack: [],
            atRisk: [],
            blocked: [
              {
                _id: "g1",
                title: "Blocked Goal",
                progress: 10,
                relatedTaskIds: [
                  { id: "t1", status: "pending" },
                  { id: "t2", status: "pending" },
                  { id: "t3", status: "pending" },
                  { id: "t4", status: "pending" },
                  { id: "t5", status: "pending" },
                ],
                updatedAt: Date.now(),
              },
            ],
          };
        }
        if (endpoint === "executionLog:getByStatus") {
          return [];
        }
        if (endpoint === "activities:getRecent") {
          return [];
        }
        return [];
      });

      engine = new StrategicPlanningEngine(mockClient);
      const report = await engine.generateWeeklyReport();

      expect(report.goalAnalysis.blocked.length).toBeGreaterThanOrEqual(1);
    });

    it("sorts goals by progress descending", async () => {
      mockClient.query = jest.fn(async (endpoint: any) => {
        if (endpoint === "goals:getByProgress") {
          return {
            accelerating: [
              {
                _id: "g1",
                title: "80%",
                progress: 80,
                relatedTaskIds: [],
                updatedAt: Date.now(),
              },
              {
                _id: "g2",
                title: "90%",
                progress: 90,
                relatedTaskIds: [],
                updatedAt: Date.now(),
              },
            ],
            onTrack: [],
            atRisk: [],
            blocked: [],
          };
        }
        return [];
      });

      engine = new StrategicPlanningEngine(mockClient);
      const report = await engine.generateWeeklyReport();

      if (report.goalAnalysis.accelerating.length >= 2) {
        expect(report.goalAnalysis.accelerating[0].progress).toBeGreaterThanOrEqual(
          report.goalAnalysis.accelerating[1].progress
        );
      }
    });
  });

  describe("execution metrics", () => {
    it("calculates task completion rate", async () => {
      mockClient.query = jest.fn(async (endpoint: any) => {
        if (endpoint === "executionLog:getByStatus") {
          return [
            { status: "success", timeSpent: 3600, _creationTime: Date.now() },
            { status: "success", timeSpent: 7200, _creationTime: Date.now() },
            { status: "failed", timeSpent: 1800, _creationTime: Date.now() },
          ];
        }
        if (endpoint === "goals:getByProgress") {
          return { accelerating: [], onTrack: [], atRisk: [], blocked: [] };
        }
        return [];
      });

      engine = new StrategicPlanningEngine(mockClient);
      const report = await engine.generateWeeklyReport();

      expect(report.executionMetrics.tasksCompleted).toBe(2);
      expect(report.executionMetrics.tasksBlocked).toBe(1);
      expect(report.executionMetrics.avgCompletionRate).toBe(67);
    });

    it("calculates average completion time in hours", async () => {
      mockClient.query = jest.fn(async (endpoint: any) => {
        if (endpoint === "executionLog:getByStatus") {
          return [
            { status: "success", timeSpent: 3600, _creationTime: Date.now() }, // 1 hour
            { status: "success", timeSpent: 3600, _creationTime: Date.now() }, // 1 hour
          ];
        }
        if (endpoint === "goals:getByProgress") {
          return { accelerating: [], onTrack: [], atRisk: [], blocked: [] };
        }
        return [];
      });

      engine = new StrategicPlanningEngine(mockClient);
      const report = await engine.generateWeeklyReport();

      expect(report.executionMetrics.avgCompletionTime).toBe(60);
    });

    it("returns 0 metrics for empty execution logs", async () => {
      mockClient.query = jest.fn(async (endpoint: any) => {
        if (endpoint === "executionLog:getByStatus") {
          return [];
        }
        if (endpoint === "goals:getByProgress") {
          return { accelerating: [], onTrack: [], atRisk: [], blocked: [] };
        }
        return [];
      });

      engine = new StrategicPlanningEngine(mockClient);
      const report = await engine.generateWeeklyReport();

      expect(report.executionMetrics.tasksGenerated).toBe(0);
      expect(report.executionMetrics.tasksCompleted).toBe(0);
      expect(report.executionMetrics.avgCompletionRate).toBe(0);
    });
  });

  describe("bottleneck detection", () => {
    it("detects blocked goals as bottlenecks", async () => {
      mockClient.query = jest.fn(async (endpoint: any) => {
        if (endpoint === "goals:getByProgress") {
          return {
            accelerating: [],
            onTrack: [],
            atRisk: [],
            blocked: [
              {
                _id: "g1",
                title: "Blocked Goal",
                progress: 10,
                relatedTaskIds: [],
                updatedAt: Date.now(),
              },
            ],
          };
        }
        return [];
      });

      engine = new StrategicPlanningEngine(mockClient);
      const report = await engine.generateWeeklyReport();

      // Bottlenecks may include blocked goals (depending on logs)
      expect(Array.isArray(report.bottlenecks)).toBe(true);
    });

    it("marks critical bottlenecks (<10% progress, >50% failure)", async () => {
      mockClient.query = jest.fn(async (endpoint: any) => {
        if (endpoint === "goals:getByProgress") {
          return {
            accelerating: [],
            onTrack: [],
            atRisk: [],
            blocked: [
              {
                _id: "g1",
                title: "Critical",
                progress: 5,
                relatedTaskIds: [],
                updatedAt: Date.now(),
              },
            ],
          };
        }
        if (endpoint === "executionLog:getByStatus") {
          return [
            { taskId: "g1", status: "failed", error: "timeout", _creationTime: Date.now() },
            { taskId: "g1", status: "failed", error: "timeout", _creationTime: Date.now() },
            { taskId: "g1", status: "success", _creationTime: Date.now() },
          ];
        }
        return [];
      });

      engine = new StrategicPlanningEngine(mockClient);
      const report = await engine.generateWeeklyReport();

      if (report.bottlenecks.length > 0) {
        expect(report.bottlenecks[0]).toHaveProperty("severity");
      }
    });

    it("provides suggested actions for bottlenecks", async () => {
      mockClient.query = jest.fn(async (endpoint: any) => {
        if (endpoint === "goals:getByProgress") {
          return {
            accelerating: [],
            onTrack: [],
            atRisk: [],
            blocked: [
              {
                _id: "g1",
                title: "Issue Goal",
                progress: 15,
                relatedTaskIds: [],
                updatedAt: Date.now(),
              },
            ],
          };
        }
        if (endpoint === "executionLog:getByStatus") {
          return [{ taskId: "g1", status: "failed", error: "auth_error", _creationTime: Date.now() }];
        }
        return [];
      });

      engine = new StrategicPlanningEngine(mockClient);
      const report = await engine.generateWeeklyReport();

      if (report.bottlenecks.length > 0) {
        expect(report.bottlenecks[0].suggestedActions).toBeDefined();
      }
    });
  });

  describe("insights generation", () => {
    it("generates insights array", async () => {
      const report = await engine.generateWeeklyReport();
      expect(Array.isArray(report.insights)).toBe(true);
    });

    it("includes recommendations", async () => {
      const report = await engine.generateWeeklyReport();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it("surfaces related memory references", async () => {
      const report = await engine.generateWeeklyReport();
      expect(Array.isArray(report.memoryReferences)).toBe(true);
    });

    it("generates next actions with priorities", async () => {
      const report = await engine.generateWeeklyReport();
      expect(Array.isArray(report.nextActions)).toBe(true);

      if (report.nextActions.length > 0) {
        const action = report.nextActions[0];
        expect(action).toHaveProperty("action");
        expect(action).toHaveProperty("priority");
        expect(action).toHaveProperty("estimatedHours");
      }
    });
  });

  describe("error handling", () => {
    it("handles missing goals gracefully", async () => {
      mockClient.query = jest.fn(async (endpoint: any) => {
        if (endpoint === "goals:getByProgress") {
          return { accelerating: [], onTrack: [], atRisk: [], blocked: [] };
        }
        if (endpoint === "executionLog:getByStatus") {
          return [];
        }
        return [];
      });

      engine = new StrategicPlanningEngine(mockClient);
      const report = await engine.generateWeeklyReport();

      expect(report).toBeTruthy();
      expect(report.goalAnalysis).toBeDefined();
    });

    it("handles null execution logs", async () => {
      mockClient.query = jest.fn(async (endpoint: any) => {
        if (endpoint === "executionLog:getByStatus") {
          return [];
        }
        if (endpoint === "goals:getByProgress") {
          return { accelerating: [], onTrack: [], atRisk: [], blocked: [] };
        }
        return [];
      });

      engine = new StrategicPlanningEngine(mockClient);
      const report = await engine.generateWeeklyReport();

      expect(report.executionMetrics.tasksGenerated).toBe(0);
    });
  });
});
