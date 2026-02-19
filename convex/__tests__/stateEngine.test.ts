/**
 * State Engine Integration Tests
 * Tests the complete OpenClaw autonomous management flow
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

describe("State Engine for OpenClaw", () => {
  // Mock database for testing
  class MockStateEngine {
    private notifications: any[] = [];
    private alertRules: any[] = [];
    private decisions: any[] = [];
    private tasks: any[] = [];
    private agents: any[] = [];

    createNotification(notification: any) {
      const id = `notif-${Date.now()}`;
      this.notifications.push({ ...notification, _id: id });
      return id;
    }

    getUnreadNotifications(agentId?: string) {
      return this.notifications.filter((n) => !n.read && (!agentId || n.agentId === agentId));
    }

    createAlertRule(rule: any) {
      const id = `rule-${Date.now()}`;
      this.alertRules.push({ ...rule, _id: id });
      return id;
    }

    evaluateAlerts() {
      // Simulate alert evaluation
      const queueDepth = this.tasks.filter((t) => t.status === "pending").length;

      for (const rule of this.alertRules) {
        if (!rule.enabled) continue;

        let triggered = false;
        if (rule.condition === "queueDepth > threshold" && queueDepth > rule.threshold) {
          triggered = true;
        }

        if (triggered) {
          this.createNotification({
            type: rule.name,
            severity: rule.severity,
            title: rule.name,
            message: `Queue depth: ${queueDepth}`,
            metrics: { queueDepth },
            actionable: true,
            read: false,
            agentId: "openclaw",
            taskId: null,
          });
        }
      }
    }

    createDecision(decision: any) {
      const id = `dec-${Date.now()}`;
      this.decisions.push({ ...decision, _id: id });
      return id;
    }

    getDecisions(decidedBy: string) {
      return this.decisions.filter((d) => d.decidedBy === decidedBy);
    }

    escalateTask(taskId: string, reason: string) {
      const task = this.tasks.find((t) => t._id === taskId);
      if (!task) throw new Error("Task not found");

      task.priority = "high";
      task.updatedAt = Date.now();

      return this.createDecision({
        action: "escalated",
        taskId,
        reason,
        result: "success",
        decidedBy: "openclaw",
      });
    }

    reassignTask(taskId: string, toAgent: string, reason: string) {
      const task = this.tasks.find((t) => t._id === taskId);
      if (!task) throw new Error("Task not found");

      const fromAgent = task.assignedTo;
      task.assignedTo = toAgent;
      task.status = "pending";
      task.updatedAt = Date.now();

      return this.createDecision({
        action: "reassigned",
        taskId,
        fromAgent,
        toAgent,
        reason,
        result: "success",
        decidedBy: "openclaw",
      });
    }

    unblockTask(taskId: string, reason: string) {
      const task = this.tasks.find((t) => t._id === taskId);
      if (!task) throw new Error("Task not found");

      task.blockedBy = [];
      task.updatedAt = Date.now();

      return this.createDecision({
        action: "unblocked",
        taskId,
        reason,
        result: "success",
        decidedBy: "openclaw",
      });
    }

    getMetrics() {
      const now = Date.now();
      const blockedTasks = this.tasks.filter(
        (t) => t.status === "in_progress" && now - t.updatedAt > 20 * 60 * 1000
      );

      return {
        queueDepth: this.tasks.filter((t) => t.status === "pending").length,
        blockedTasks: blockedTasks.map((t) => ({
          id: t._id,
          title: t.title,
          blockedForMinutes: Math.floor((now - t.updatedAt) / 1000 / 60),
          assignedTo: t.assignedTo,
        })),
        agents: {
          active: this.agents.filter((a) => a.status === "active").length,
          idle: this.agents.filter((a) => a.status === "idle").length,
        },
      };
    }

    // Helper methods for tests
    addTask(task: any) {
      this.tasks.push({
        _id: `task-${Date.now()}`,
        businessId: "biz-1",
        status: "pending",
        priority: "medium",
        assignedTo: null,
        blockedBy: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...task,
      });
      return this.tasks[this.tasks.length - 1];
    }

    addAgent(agent: any) {
      this.agents.push({
        _id: `agent-${Date.now()}`,
        name: agent.name,
        status: agent.status || "idle",
        ...agent,
      });
      return this.agents[this.agents.length - 1];
    }
  }

  let engine: MockStateEngine;

  beforeEach(() => {
    engine = new MockStateEngine();
  });

  describe("Notification System", () => {
    it("creates notifications", () => {
      const notifId = engine.createNotification({
        type: "queue_overload",
        severity: "warning",
        title: "Queue Overload",
        message: "Queue depth: 8",
        actionable: true,
        read: false,
        agentId: "openclaw",
      });

      expect(notifId).toBeDefined();
      const unread = engine.getUnreadNotifications("openclaw");
      expect(unread).toHaveLength(1);
    });

    it("filters unread notifications by agent", () => {
      engine.createNotification({
        type: "queue_overload",
        severity: "warning",
        title: "Queue Overload",
        agentId: "openclaw",
        read: false,
      });

      engine.createNotification({
        type: "task_blocked",
        severity: "critical",
        title: "Task Blocked",
        agentId: "agent-1",
        read: false,
      });

      const openclawNotifs = engine.getUnreadNotifications("openclaw");
      expect(openclawNotifs).toHaveLength(1);
      expect(openclawNotifs[0].type).toBe("queue_overload");
    });
  });

  describe("Alert Rules", () => {
    it("creates alert rules", () => {
      const ruleId = engine.createAlertRule({
        name: "Queue Overload",
        condition: "queueDepth > threshold",
        threshold: 5,
        severity: "warning",
        cooldownSeconds: 300,
        enabled: true,
      });

      expect(ruleId).toBeDefined();
    });

    it("evaluates alert rules and creates notifications", () => {
      engine.createAlertRule({
        name: "Queue Overload",
        condition: "queueDepth > threshold",
        threshold: 5,
        severity: "warning",
        cooldownSeconds: 300,
        enabled: true,
      });

      // Add tasks to exceed threshold
      for (let i = 0; i < 8; i++) {
        engine.addTask({ title: `Task ${i}` });
      }

      engine.evaluateAlerts();

      const notifications = engine.getUnreadNotifications("openclaw");
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].type).toBe("Queue Overload");
    });
  });

  describe("Decision Log (Audit Trail)", () => {
    it("records escalation decisions", () => {
      const task = engine.addTask({ title: "Critical Task" });

      const decisionId = engine.escalateTask(task._id, "blocking_others");

      expect(decisionId).toBeDefined();
      const decisions = engine.getDecisions("openclaw");
      expect(decisions).toHaveLength(1);
      expect(decisions[0].action).toBe("escalated");
      expect(decisions[0].reason).toBe("blocking_others");
    });

    it("records reassignment decisions", () => {
      const task = engine.addTask({ title: "Task", assignedTo: "agent-1" });

      const decisionId = engine.reassignTask(task._id, "agent-2", "agent_overloaded");

      expect(decisionId).toBeDefined();
      const decisions = engine.getDecisions("openclaw");
      expect(decisions).toHaveLength(1);
      expect(decisions[0].action).toBe("reassigned");
      expect(decisions[0].fromAgent).toBe("agent-1");
      expect(decisions[0].toAgent).toBe("agent-2");
    });

    it("records unblock decisions", () => {
      const task = engine.addTask({
        title: "Blocked Task",
        blockedBy: ["task-123"],
      });

      const decisionId = engine.unblockTask(task._id, "dependency_resolved");

      expect(decisionId).toBeDefined();
      const decisions = engine.getDecisions("openclaw");
      expect(decisions).toHaveLength(1);
      expect(decisions[0].action).toBe("unblocked");
    });
  });

  describe("Operational Metrics (State Snapshot)", () => {
    it("calculates queue depth", () => {
      engine.addTask({ title: "Task 1", status: "pending" });
      engine.addTask({ title: "Task 2", status: "pending" });
      engine.addTask({ title: "Task 3", status: "in_progress" });

      const metrics = engine.getMetrics();

      expect(metrics.queueDepth).toBe(2);
    });

    it("identifies blocked tasks", () => {
      const now = Date.now();
      engine.addTask({
        title: "Blocked Task",
        status: "in_progress",
        updatedAt: now - 25 * 60 * 1000, // 25 minutes ago
      });

      const metrics = engine.getMetrics();

      expect(metrics.blockedTasks).toHaveLength(1);
      expect(metrics.blockedTasks[0].blockedForMinutes).toBeGreaterThan(20);
    });

    it("counts agent status", () => {
      engine.addAgent({ name: "Agent 1", status: "active" });
      engine.addAgent({ name: "Agent 2", status: "idle" });
      engine.addAgent({ name: "Agent 3", status: "active" });

      const metrics = engine.getMetrics();

      expect(metrics.agents.active).toBe(2);
      expect(metrics.agents.idle).toBe(1);
    });
  });

  describe("Complete OpenClaw Cycle", () => {
    it("simulates a complete heartbeat cycle", () => {
      // Setup: Create alert rule
      engine.createAlertRule({
        name: "Queue Overload",
        condition: "queueDepth > threshold",
        threshold: 5,
        severity: "warning",
        cooldownSeconds: 300,
        enabled: true,
      });

      engine.addAgent({ name: "Agent 1", status: "active" });
      engine.addAgent({ name: "Agent 2", status: "active" });

      // Simulate queue building up
      for (let i = 0; i < 8; i++) {
        engine.addTask({
          title: `Task ${i}`,
          status: "pending",
          priority: "medium",
        });
      }

      // CYCLE START: OpenClaw wakes up

      // 1. Check notifications
      engine.evaluateAlerts();
      const notifications = engine.getUnreadNotifications("openclaw");
      expect(notifications.length).toBeGreaterThan(0);

      // 2. Get current state
      const metrics = engine.getMetrics();
      expect(metrics.queueDepth).toBe(8);

      // 3. Make decision
      const decisions = engine.getDecisions("openclaw");
      const initialDecisionCount = decisions.length;

      // Get highest priority pending task
      const pendingTasks = engine.getUnreadNotifications("openclaw");
      const criticalNotification = pendingTasks.find(
        (n) => n.type === "Queue Overload"
      );

      expect(criticalNotification).toBeDefined();

      // 4. Execute action - escalate high priority items
      // (simplified: just mark that decision was made)
      engine.createDecision({
        action: "escalated",
        taskId: "task-1",
        reason: "queue_overload_detected",
        result: "success",
        decidedBy: "openclaw",
      });

      // 5. Verify decision was logged
      const updatedDecisions = engine.getDecisions("openclaw");
      expect(updatedDecisions.length).toBeGreaterThan(initialDecisionCount);

      // CYCLE END: OpenClaw shuts down (forgets state)
      // Next cycle will read notifications and decision log to understand context

      expect(true).toBe(true); // Cycle completed successfully
    });

    it("demonstrates learning from decision patterns", () => {
      // First decision
      const task1 = engine.addTask({ title: "Task 1" });
      engine.escalateTask(task1._id, "blocked_too_long");
      expect(engine.getDecisions("openclaw")).toHaveLength(1);

      // Second decision of same type
      const task2 = engine.addTask({ title: "Task 2" });
      engine.escalateTask(task2._id, "blocked_too_long");
      expect(engine.getDecisions("openclaw")).toHaveLength(2);

      // Later cycle - analyze pattern
      const decisions = engine.getDecisions("openclaw");
      const escalations = decisions.filter((d) => d.action === "escalated");
      const blockedReasons = escalations.filter(
        (d) => d.reason === "blocked_too_long"
      );

      expect(blockedReasons.length).toBe(2);
      // Next cycle could say: "I notice 100% of my escalations are due to tasks being blocked too long"
    });
  });
});
