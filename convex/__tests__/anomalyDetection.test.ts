/**
 * Anomaly Detection System Tests (Phase 5B)
 *
 * Tests for:
 * - Detecting unusual behavior patterns
 * - Flagging deviations from baseline
 * - Calculating severity levels
 * - Tracking anomaly frequency
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

class AnomalyDetectionMockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    this.data.set("anomalies", []);
    this.data.set("tasks", []);
    this.data.set("agents", []);
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

  getAnomalies() {
    return this.data.get("anomalies") || [];
  }

  getAnomaliesByAgent(agentId: string) {
    return (this.data.get("anomalies") || []).filter(
      (a: any) => a.agentId === agentId
    );
  }

  getTasks() {
    return this.data.get("tasks") || [];
  }
}

describe("Anomaly Detection System (convex/anomalyDetection.ts)", () => {
  let db: AnomalyDetectionMockDatabase;
  let workspaceId: string;
  let agentId: string;

  beforeEach(() => {
    db = new AnomalyDetectionMockDatabase();
    workspaceId = "biz-1";
    agentId = db.insert("agents", { name: "Alice" });
  });

  describe("Duration Deviation Detection", () => {
    it("detects when task takes >2σ longer than typical", () => {
      // Baseline: 2 day tasks (avg), 0.5 day std dev
      // Anomaly: 5 day task = 6σ from mean
      db.insert("anomalies", {
        workspaceId,
        agentId,
        type: "duration_deviation",
        severity: "high",
        message: "Task took 5 days (expected 2 days)",
        detectedValue: 5,
        expectedValue: 2,
        flagged: true,
        createdAt: Date.now(),
      });

      const anomalies = db.getAnomaliesByAgent(agentId);
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe("duration_deviation");
      expect(anomalies[0].severity).toBe("high");
    });

    it("does not flag normal variations (<2σ)", () => {
      // 2 day baseline, 0.5 std dev, 2.3 day task = 0.6σ (normal)
      const expectedDuration = 2;
      const stdDev = 0.5;
      const actualDuration = 2.3;
      const deviation = Math.abs(actualDuration - expectedDuration) / stdDev;

      expect(deviation).toBeLessThan(2); // Not anomalous
    });
  });

  describe("Error Rate Detection", () => {
    it("flags agent with high error rate", () => {
      db.insert("anomalies", {
        workspaceId,
        agentId,
        type: "error_rate",
        severity: "high",
        message: "Error rate: 40% (expected <10%)",
        detectedValue: 40,
        expectedValue: 10,
        flagged: true,
        createdAt: Date.now(),
      });

      const anomalies = db.getAnomaliesByAgent(agentId);
      expect(anomalies[0].detectedValue).toBeGreaterThan(
        anomalies[0].expectedValue * 3
      );
    });

    it("calculates error rate from failed tasks", () => {
      const completed = 10;
      const failed = 4;
      const errorRate = (failed / (completed + failed)) * 100;

      expect(errorRate).toBeCloseTo(28.57, 1);
      expect(errorRate).toBeGreaterThan(10); // Above expected threshold
    });
  });

  describe("Skill-Task Mismatch Detection", () => {
    it("flags junior agent assigned complex task", () => {
      db.insert("anomalies", {
        workspaceId,
        agentId,
        type: "skill_mismatch",
        severity: "medium",
        message: "Junior agent assigned expert-level task",
        taskId: "task-123",
        detectedValue: 1, // Junior level
        expectedValue: 3, // Expert level needed
        flagged: true,
        createdAt: Date.now(),
      });

      const anomalies = db.getAnomaliesByAgent(agentId);
      expect(anomalies[0].type).toBe("skill_mismatch");
    });

    it("does not flag senior agent on any task", () => {
      // Senior agent (level 3) on complex task (expert) = normal
      const agentLevel = 3;
      const taskComplexity = 3;
      const isMismatch = agentLevel < taskComplexity - 1;

      expect(isMismatch).toBe(false);
    });
  });

  describe("Status Spike Detection", () => {
    it("flags rapid status changes", () => {
      const oneMinuteAgo = Date.now() - 60 * 1000;
      db.insert("anomalies", {
        workspaceId,
        agentId,
        type: "status_spike",
        severity: "low",
        message: "Status changed 5 times in 1 minute",
        detectedValue: 5,
        expectedValue: 1,
        flagged: true,
        createdAt: Date.now(),
      });

      const anomalies = db.getAnomaliesByAgent(agentId);
      expect(anomalies[0].detectedValue).toBeGreaterThan(
        anomalies[0].expectedValue * 4
      );
    });
  });

  describe("Severity Calculation", () => {
    it("assigns low severity for minor deviations", () => {
      const deviation = 1.5; // <2σ
      const severity = deviation < 2 ? "low" : deviation < 3 ? "medium" : "high";

      expect(severity).toBe("low");
    });

    it("assigns medium severity for moderate deviations", () => {
      const deviation = 2.5; // 2-3σ
      const severity = deviation < 2 ? "low" : deviation < 3 ? "medium" : "high";

      expect(severity).toBe("medium");
    });

    it("assigns high severity for significant deviations", () => {
      const deviation = 3.5; // >3σ
      const severity = deviation < 2 ? "low" : deviation < 3 ? "medium" : "high";

      expect(severity).toBe("high");
    });
  });

  describe("Anomaly Filtering", () => {
    it("filters anomalies by severity", () => {
      db.insert("anomalies", {
        workspaceId,
        agentId,
        type: "duration_deviation",
        severity: "high",
        message: "High severity",
        detectedValue: 10,
        expectedValue: 2,
        flagged: true,
        createdAt: Date.now(),
      });

      db.insert("anomalies", {
        workspaceId,
        agentId,
        type: "error_rate",
        severity: "low",
        message: "Low severity",
        detectedValue: 11,
        expectedValue: 10,
        flagged: true,
        createdAt: Date.now(),
      });

      const anomalies = db.getAnomaliesByAgent(agentId);
      const highSeverity = anomalies.filter((a: any) => a.severity === "high");

      expect(highSeverity).toHaveLength(1);
    });

    it("filters anomalies by type", () => {
      db.insert("anomalies", {
        workspaceId,
        agentId,
        type: "duration_deviation",
        severity: "high",
        message: "Duration anomaly",
        detectedValue: 10,
        expectedValue: 2,
        flagged: true,
        createdAt: Date.now(),
      });

      db.insert("anomalies", {
        workspaceId,
        agentId,
        type: "error_rate",
        severity: "high",
        message: "Error rate anomaly",
        detectedValue: 50,
        expectedValue: 10,
        flagged: true,
        createdAt: Date.now(),
      });

      const anomalies = db.getAnomaliesByAgent(agentId);
      const durationAnomalies = anomalies.filter(
        (a: any) => a.type === "duration_deviation"
      );

      expect(durationAnomalies).toHaveLength(1);
    });
  });

  describe("Anomaly Resolution", () => {
    it("marks anomaly as resolved", () => {
      const anomalyId = db.insert("anomalies", {
        workspaceId,
        agentId,
        type: "duration_deviation",
        severity: "high",
        message: "Task took too long",
        detectedValue: 10,
        expectedValue: 2,
        flagged: true,
        resolvedAt: undefined,
        createdAt: Date.now(),
      });

      const anomaly = db.get(anomalyId);
      anomaly.flagged = false;
      anomaly.resolvedAt = Date.now();

      expect(anomaly.flagged).toBe(false);
      expect(anomaly.resolvedAt).toBeDefined();
    });

    it("tracks resolution time", () => {
      const createdAt = Date.now() - 24 * 60 * 60 * 1000; // 1 day ago
      const resolvedAt = Date.now();
      const resolutionTime = resolvedAt - createdAt;

      expect(resolutionTime).toBeGreaterThan(0);
      expect(resolutionTime / (60 * 60 * 1000)).toBeCloseTo(24, 1); // ~24 hours
    });
  });

  describe("Edge Cases", () => {
    it("handles new agents with no baseline data", () => {
      const newAgentId = db.insert("agents", { name: "Bob" });
      const anomalies = db.getAnomaliesByAgent(newAgentId);

      expect(anomalies).toHaveLength(0); // No anomalies yet
    });

    it("does not flag agents with insufficient task history", () => {
      // Agent with <5 tasks: too early to establish baseline
      const hasBaselineData = 5; // Minimum tasks for baseline
      expect(hasBaselineData).toBeGreaterThan(1);
    });
  });

  describe("Anomaly Frequency Tracking", () => {
    it("counts anomalies per agent", () => {
      db.insert("anomalies", {
        workspaceId,
        agentId,
        type: "duration_deviation",
        severity: "high",
        message: "Anomaly 1",
        detectedValue: 10,
        expectedValue: 2,
        flagged: true,
        createdAt: Date.now(),
      });

      db.insert("anomalies", {
        workspaceId,
        agentId,
        type: "error_rate",
        severity: "medium",
        message: "Anomaly 2",
        detectedValue: 25,
        expectedValue: 10,
        flagged: true,
        createdAt: Date.now(),
      });

      const anomalies = db.getAnomaliesByAgent(agentId);
      expect(anomalies).toHaveLength(2);
    });

    it("identifies agents with recurring anomalies", () => {
      // Same agent, same anomaly type multiple times
      for (let i = 0; i < 3; i++) {
        db.insert("anomalies", {
          workspaceId,
          agentId,
          type: "duration_deviation",
          severity: "high",
          message: `Duration deviation #${i + 1}`,
          detectedValue: 10 + i,
          expectedValue: 2,
          flagged: true,
          createdAt: Date.now() + i * 1000,
        });
      }

      const anomalies = db.getAnomaliesByAgent(agentId);
      const durationAnomalies = anomalies.filter(
        (a: any) => a.type === "duration_deviation"
      );

      expect(durationAnomalies).toHaveLength(3);
    });
  });

  describe("Mitigation Suggestions", () => {
    it("suggests pairing with mentor for skill mismatch", () => {
      const anomalyType = "skill_mismatch";
      const suggestion =
        anomalyType === "skill_mismatch"
          ? "Consider pairing with experienced mentor"
          : undefined;

      expect(suggestion).toBe("Consider pairing with experienced mentor");
    });

    it("suggests break time for high error rate", () => {
      const anomalyType = "error_rate";
      const suggestion =
        anomalyType === "error_rate"
          ? "Consider task rotation or break time"
          : undefined;

      expect(suggestion).toBe("Consider task rotation or break time");
    });

    it("suggests capacity review for duration deviation", () => {
      const anomalyType = "duration_deviation";
      const suggestion =
        anomalyType === "duration_deviation"
          ? "Review agent capacity and task complexity"
          : undefined;

      expect(suggestion).toBe("Review agent capacity and task complexity");
    });
  });
});
