/**
 * Unit Tests for Pattern Insights Query (Phase 4D)
 * Tests the getPatternInsights query logic
 */

import { describe, it, expect } from "@jest/globals";

/**
 * Mock database for pattern insights tests
 */
class PatternInsightsMockDatabase {
  private activities: any[] = [];

  addActivity(activity: any) {
    this.activities.push(activity);
  }

  getAllActivities() {
    return this.activities;
  }

  /**
   * Simulates getPatternInsights query logic
   */
  getPatternInsights(now: number = Date.now()) {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

    const thisWeekStart = now - sevenDaysMs;
    const lastWeekStart = now - fourteenDaysMs;

    const activitiesThisWeek = this.activities.filter(
      (a: any) => a.createdAt >= thisWeekStart && a.createdAt < now
    );

    const activitiesLastWeek = this.activities.filter(
      (a) =>
        a.createdAt >= lastWeekStart && a.createdAt < thisWeekStart
    );

    // Count task completions
    const completedThisWeek = activitiesThisWeek.filter(
      (a: any) => a.type === "task_completed"
    ).length;

    const completedLastWeek = activitiesLastWeek.filter(
      (a: any) => a.type === "task_completed"
    ).length;

    // Determine velocity trend
    let velocityTrend = "flat";
    const threshold = completedLastWeek * 0.1; // 10% change threshold

    if (completedThisWeek > completedLastWeek + threshold) {
      velocityTrend = "up";
    } else if (completedThisWeek < completedLastWeek - threshold) {
      velocityTrend = "down";
    }

    // Find top agents by activity count
    const agentActivityCounts: Record<string, number> = {};
    activitiesThisWeek.forEach((activity) => {
      if (activity.agentName && activity.agentName !== "system") {
        agentActivityCounts[activity.agentName] =
          (agentActivityCounts[activity.agentName] || 0) + 1;
      }
    });

    const topAgents = Object.entries(agentActivityCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    // Count blocked events
    const blockedEventsCount = activitiesThisWeek.filter(
      (a: any) => a.type === "task_blocked"
    ).length;

    // Generate human-readable patterns
    const patterns: string[] = [];

    if (velocityTrend === "up") {
      patterns.push(
        `Velocity is trending up: ${completedThisWeek} tasks completed this week (vs ${completedLastWeek} last week)`
      );
    } else if (velocityTrend === "down") {
      patterns.push(
        `Velocity is trending down: ${completedThisWeek} tasks completed this week (vs ${completedLastWeek} last week)`
      );
    } else {
      patterns.push(
        `Velocity is stable: ${completedThisWeek} tasks completed this week`
      );
    }

    if (topAgents.length > 0) {
      const topAgentNames = topAgents.map((a: any) => a.name).join(", ");
      patterns.push(`Top contributors this week: ${topAgentNames}`);
    }

    if (blockedEventsCount > 0) {
      patterns.push(
        `${blockedEventsCount} tasks became blocked this week - watch for dependencies`
      );
    } else {
      patterns.push(`No blocked tasks this week - flow is smooth`);
    }

    return {
      patterns,
      velocityTrend,
      completedThisWeek,
      completedLastWeek,
      topAgents,
      activityCounts: {
        thisWeek: activitiesThisWeek.length,
        lastWeek: activitiesLastWeek.length,
        blocked: blockedEventsCount,
      },
    };
  }
}

describe("Pattern Insights (Phase 4D)", () => {
  let db: PatternInsightsMockDatabase;

  beforeEach(() => {
    db = new PatternInsightsMockDatabase();
  });

  describe("getPatternInsights velocity trend detection", () => {
    it("detects up trend when this week > last week (>10% increase)", () => {
      const now = 1000000000000; // Fixed reference time
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
      const oneWeekAgo = now - sevenDaysMs;

      // Add 5 completions last week
      for (let i = 0; i < 5; i++) {
        db.addActivity({
          type: "task_completed",
          agentName: "agent1",
          createdAt: twoWeeksAgo + i * 1000,
        });
      }

      // Add 6 completions this week (20% increase)
      for (let i = 0; i < 6; i++) {
        db.addActivity({
          type: "task_completed",
          agentName: "agent1",
          createdAt: oneWeekAgo + i * 1000,
        });
      }

      const insights = db.getPatternInsights(now);

      expect(insights.velocityTrend).toBe("up");
      expect(insights.completedThisWeek).toBe(6);
      expect(insights.completedLastWeek).toBe(5);
      expect(insights.patterns[0]).toContain("trending up");
    });

    it("detects down trend when this week < last week (>10% decrease)", () => {
      const now = 1000000000000;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
      const oneWeekAgo = now - sevenDaysMs;

      // Add 10 completions last week
      for (let i = 0; i < 10; i++) {
        db.addActivity({
          type: "task_completed",
          agentName: "agent1",
          createdAt: twoWeeksAgo + i * 1000,
        });
      }

      // Add 8 completions this week (20% decrease)
      for (let i = 0; i < 8; i++) {
        db.addActivity({
          type: "task_completed",
          agentName: "agent1",
          createdAt: oneWeekAgo + i * 1000,
        });
      }

      const insights = db.getPatternInsights(now);

      expect(insights.velocityTrend).toBe("down");
      expect(insights.completedThisWeek).toBe(8);
      expect(insights.completedLastWeek).toBe(10);
      expect(insights.patterns[0]).toContain("trending down");
    });

    it("detects flat trend when velocity is stable", () => {
      const now = 1000000000000;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
      const oneWeekAgo = now - sevenDaysMs;

      // Add 10 completions last week
      for (let i = 0; i < 10; i++) {
        db.addActivity({
          type: "task_completed",
          agentName: "agent1",
          createdAt: twoWeeksAgo + i * 1000,
        });
      }

      // Add 10 completions this week (no change)
      for (let i = 0; i < 10; i++) {
        db.addActivity({
          type: "task_completed",
          agentName: "agent1",
          createdAt: oneWeekAgo + i * 1000,
        });
      }

      const insights = db.getPatternInsights(now);

      expect(insights.velocityTrend).toBe("flat");
      expect(insights.patterns[0]).toContain("stable");
    });
  });

  describe("getPatternInsights top agents detection", () => {
    it("returns top 3 agents sorted by activity count", () => {
      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const oneWeekAgo = now - sevenDaysMs;

      // Add activities for different agents
      for (let i = 0; i < 8; i++) {
        db.addActivity({
          type: "task_completed",
          agentName: "alice",
          createdAt: oneWeekAgo + i * 1000,
        });
      }

      for (let i = 0; i < 5; i++) {
        db.addActivity({
          type: "task_completed",
          agentName: "bob",
          createdAt: oneWeekAgo + i * 10000,
        });
      }

      for (let i = 0; i < 3; i++) {
        db.addActivity({
          type: "task_completed",
          agentName: "charlie",
          createdAt: oneWeekAgo + i * 100000,
        });
      }

      for (let i = 0; i < 1; i++) {
        db.addActivity({
          type: "task_completed",
          agentName: "diana",
          createdAt: oneWeekAgo + i * 1000000,
        });
      }

      const insights = db.getPatternInsights(now);

      expect(insights.topAgents).toHaveLength(3);
      expect(insights.topAgents[0].name).toBe("alice");
      expect(insights.topAgents[0].count).toBe(8);
      expect(insights.topAgents[1].name).toBe("bob");
      expect(insights.topAgents[1].count).toBe(5);
      expect(insights.topAgents[2].name).toBe("charlie");
      expect(insights.topAgents[2].count).toBe(3);
      expect(insights.patterns.some(p => p.includes("alice") && p.includes("bob") && p.includes("charlie"))).toBe(true);
    });

    it("excludes system agent from top agents", () => {
      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const oneWeekAgo = now - sevenDaysMs;

      // Add system activities
      for (let i = 0; i < 10; i++) {
        db.addActivity({
          type: "task_completed",
          agentName: "system",
          createdAt: oneWeekAgo + i * 1000,
        });
      }

      // Add agent activities
      for (let i = 0; i < 2; i++) {
        db.addActivity({
          type: "task_completed",
          agentName: "agent1",
          createdAt: oneWeekAgo + i * 10000,
        });
      }

      const insights = db.getPatternInsights(now);

      expect(insights.topAgents).toHaveLength(1);
      expect(insights.topAgents[0].name).toBe("agent1");
    });
  });

  describe("getPatternInsights blocked events detection", () => {
    it("includes blocked event count in patterns", () => {
      const now = 1000000000000;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const oneWeekAgo = now - sevenDaysMs;

      // Add blocked tasks
      for (let i = 0; i < 3; i++) {
        db.addActivity({
          type: "task_blocked",
          agentName: "agent1",
          createdAt: oneWeekAgo + i * 1000,
        });
      }

      const insights = db.getPatternInsights(now);

      expect(insights.activityCounts.blocked).toBe(3);
      expect(insights.patterns.some(p => p.includes("3 tasks became blocked"))).toBe(true);
    });

    it("notes when no blocked tasks occur", () => {
      const now = 1000000000000;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const oneWeekAgo = now - sevenDaysMs;

      // Add only completed tasks
      for (let i = 0; i < 5; i++) {
        db.addActivity({
          type: "task_completed",
          agentName: "agent1",
          createdAt: oneWeekAgo + i * 1000,
        });
      }

      const insights = db.getPatternInsights(now);

      expect(insights.activityCounts.blocked).toBe(0);
      expect(insights.patterns.some(p => p.includes("No blocked tasks this week"))).toBe(true);
    });
  });

  describe("getPatternInsights safe defaults", () => {
    it("returns safe defaults for empty business", () => {
      const now = 1000000000000;
      const insights = db.getPatternInsights(now);

      expect(insights.velocityTrend).toBe("flat");
      expect(insights.completedThisWeek).toBe(0);
      expect(insights.completedLastWeek).toBe(0);
      expect(insights.topAgents).toEqual([]);
      expect(insights.patterns.length).toBeGreaterThan(0);
      expect(insights.activityCounts.thisWeek).toBe(0);
      expect(insights.activityCounts.lastWeek).toBe(0);
    });

    it("handles activities with missing agentName gracefully", () => {
      const now = 1000000000000;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const oneWeekAgo = now - sevenDaysMs;

      // Add activity without agentName
      db.addActivity({
        type: "task_completed",
        createdAt: oneWeekAgo + 1000,
      });

      const insights = db.getPatternInsights(now);

      expect(insights.completedThisWeek).toBe(1);
      expect(insights.topAgents).toEqual([]);
    });
  });
});
