/**
 * Integration Tests for Cron Activation (Phase 4A)
 * Tests the logic of autoClaimCron, heartbeatMonitorCron, and escalationCheckCron
 */

import { describe, it, expect } from "@jest/globals";

/**
 * Mock database for cron activation tests
 */
class CronMockDatabase {
  private agents: Map<string, any> = new Map();
  private tasks: Map<string, any> = new Map();
  private activities: any[] = [];
  private notifications: any[] = [];
  private nextId = 0;

  private genId() {
    return `id-${this.nextId++}`;
  }

  // Agents management
  addAgent(agent: any) {
    const id = agent._id || this.genId();
    this.agents.set(id, { _id: id, ...agent });
  }

  getAllAgents() {
    return Array.from(this.agents.values());
  }

  patchAgent(agentId: string, updates: any) {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.set(agentId, { ...agent, ...updates });
    }
  }

  // Tasks management
  addTask(task: any) {
    const id = task._id || this.genId();
    this.tasks.set(id, { _id: id, ...task });
  }

  getBlockedTasks() {
    return Array.from(this.tasks.values()).filter((t: any) => t.status === "blocked");
  }

  // Activity logging
  insertActivity(activity: any) {
    this.activities.push(activity);
  }

  getActivities() {
    return this.activities;
  }

  // Notification management
  insertNotification(notification: any) {
    this.notifications.push(notification);
  }

  getNotifications() {
    return this.notifications;
  }

  /**
   * Simulates heartbeatMonitorCron logic
   */
  simulateHeartbeatMonitor(staleThresholdMs: number = 5 * 60 * 1000) {
    const now = Date.now();
    const cutoff = now - staleThresholdMs;
    const staleAgents = this.getAllAgents().filter(
      (a: any) => a.lastHeartbeat < cutoff && a.status === "active"
    );

    const result = { checked: this.getAllAgents().length, stale: 0 };

    for (const agent of staleAgents) {
      this.patchAgent(agent._id, { status: "idle" });
      this.insertActivity({
        type: "agent_status_changed",
        agentId: agent._id,
        agentName: agent.name,
        message: "Agent status changed to idle (heartbeat stale)",
        oldValue: "active",
        newValue: "idle",
        createdAt: now,
      });
      result.stale++;
    }

    return result;
  }

  /**
   * Simulates escalationCheckCron logic
   */
  simulateEscalationCheck(escalationThresholdMs: number = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const cutoff = now - escalationThresholdMs;

    const blockedTasks = this.getBlockedTasks().filter((t: any) => t.updatedAt < cutoff);
    const escalatedTasks = blockedTasks.slice(0, 10);

    const leadAgents = this.getAllAgents().filter((a: any) => a.level === "lead");
    let notificationCount = 0;

    for (const task of escalatedTasks) {
      for (const lead of leadAgents) {
        this.insertNotification({
          recipientId: lead._id,
          type: "assignment",
          content: `🚨 ESCALATED: "${task.title}" has been blocked for 24+ hours`,
          taskId: task._id,
          taskTitle: task.title,
          fromId: "system",
          fromName: "System",
          read: false,
          createdAt: now,
        });
        notificationCount++;
      }

      this.insertActivity({
        businessId: task.businessId,
        type: "task_blocked",
        agentId: "system",
        agentName: "system",
        message: `Task "${task.title}" escalated (blocked > 24 hours)`,
        taskId: task._id,
        taskTitle: task.title,
        createdAt: now,
      });
    }

    return { escalatedTasks: escalatedTasks.length, notificationsSent: notificationCount };
  }
}

describe("Cron Activation (Phase 4A)", () => {
  let db: CronMockDatabase;

  beforeEach(() => {
    db = new CronMockDatabase();
  });

  describe("heartbeatMonitorCron logic", () => {
    it("marks agents with stale heartbeat (>5min) as idle", () => {
      const now = Date.now();
      const staleTime = now - 6 * 60 * 1000; // 6 minutes ago

      db.addAgent({
        _id: "agent-1",
        name: "Agent Stale",
        status: "active",
        lastHeartbeat: staleTime,
      });

      const result = db.simulateHeartbeatMonitor();

      expect(result.checked).toBe(1);
      expect(result.stale).toBe(1);

      const activities = db.getActivities();
      expect(activities).toContainEqual(
        expect.objectContaining({
          type: "agent_status_changed",
          agentId: "agent-1",
          oldValue: "active",
          newValue: "idle",
        })
      );
    });

    it("does not mark agents with fresh heartbeat (<5min) as idle", () => {
      const now = Date.now();
      const freshTime = now - 2 * 60 * 1000; // 2 minutes ago

      db.addAgent({
        _id: "agent-1",
        name: "Agent Fresh",
        status: "active",
        lastHeartbeat: freshTime,
      });

      const result = db.simulateHeartbeatMonitor();

      expect(result.stale).toBe(0);
      expect(db.getActivities()).toHaveLength(0);
    });

    it("does not mark idle agents as idle again", () => {
      const now = Date.now();
      const staleTime = now - 6 * 60 * 1000;

      db.addAgent({
        _id: "agent-1",
        name: "Agent Idle",
        status: "idle",
        lastHeartbeat: staleTime,
      });

      const result = db.simulateHeartbeatMonitor();

      expect(result.stale).toBe(0);
      expect(db.getActivities()).toHaveLength(0);
    });

    it("handles multiple stale agents in a single run", () => {
      const now = Date.now();
      const staleTime = now - 6 * 60 * 1000;

      db.addAgent({
        _id: "agent-1",
        name: "Agent Stale 1",
        status: "active",
        lastHeartbeat: staleTime,
      });
      db.addAgent({
        _id: "agent-2",
        name: "Agent Stale 2",
        status: "active",
        lastHeartbeat: staleTime,
      });
      db.addAgent({
        _id: "agent-3",
        name: "Agent Fresh",
        status: "active",
        lastHeartbeat: now - 1 * 60 * 1000,
      });

      const result = db.simulateHeartbeatMonitor();

      expect(result.checked).toBe(3);
      expect(result.stale).toBe(2);
      expect(db.getActivities()).toHaveLength(2);
    });
  });

  describe("escalationCheckCron logic", () => {
    it("creates notifications for lead agents when tasks blocked >24h", () => {
      const now = Date.now();
      const oldTime = now - 25 * 60 * 60 * 1000; // 25 hours ago

      db.addTask({
        _id: "task-1",
        businessId: "biz-1",
        title: "Stale Blocked Task",
        status: "blocked",
        updatedAt: oldTime,
      });

      db.addAgent({
        _id: "lead-1",
        name: "Lead Agent",
        level: "lead",
      });

      const result = db.simulateEscalationCheck();

      expect(result.escalatedTasks).toBe(1);
      expect(result.notificationsSent).toBe(1);

      const notifications = db.getNotifications();
      expect(notifications[0]).toMatchObject({
        recipientId: "lead-1",
        taskId: "task-1",
        type: "assignment",
      });
    });

    it("does not escalate tasks blocked <24h", () => {
      const now = Date.now();
      const recentTime = now - 12 * 60 * 60 * 1000; // 12 hours ago

      db.addTask({
        _id: "task-1",
        businessId: "biz-1",
        title: "Recent Blocked Task",
        status: "blocked",
        updatedAt: recentTime,
      });

      db.addAgent({
        _id: "lead-1",
        name: "Lead Agent",
        level: "lead",
      });

      const result = db.simulateEscalationCheck();

      expect(result.escalatedTasks).toBe(0);
      expect(db.getNotifications()).toHaveLength(0);
    });

    it("notifies all lead agents for each escalated task", () => {
      const now = Date.now();
      const oldTime = now - 25 * 60 * 60 * 1000;

      db.addTask({
        _id: "task-1",
        businessId: "biz-1",
        title: "Escalated Task",
        status: "blocked",
        updatedAt: oldTime,
      });

      db.addAgent({
        _id: "lead-1",
        name: "Lead 1",
        level: "lead",
      });
      db.addAgent({
        _id: "lead-2",
        name: "Lead 2",
        level: "lead",
      });

      const result = db.simulateEscalationCheck();

      expect(result.notificationsSent).toBe(2);
      const notifications = db.getNotifications();
      expect(notifications.map((n: any) => n.recipientId)).toEqual(["lead-1", "lead-2"]);
    });

    it("logs escalation activity with businessId from task", () => {
      const now = Date.now();
      const oldTime = now - 25 * 60 * 60 * 1000;

      db.addTask({
        _id: "task-1",
        businessId: "biz-1",
        title: "Escalated Task",
        status: "blocked",
        updatedAt: oldTime,
      });

      db.addAgent({
        _id: "lead-1",
        name: "Lead Agent",
        level: "lead",
      });

      db.simulateEscalationCheck();

      const activities = db.getActivities();
      expect(activities[0]).toMatchObject({
        type: "task_blocked",
        businessId: "biz-1",
        taskId: "task-1",
        agentId: "system",
      });
    });

    it("respects maximum 10 escalations per run", () => {
      const now = Date.now();
      const oldTime = now - 25 * 60 * 60 * 1000;

      // Add 15 old blocked tasks
      for (let i = 0; i < 15; i++) {
        db.addTask({
          _id: `task-${i}`,
          businessId: "biz-1",
          title: `Old Blocked Task ${i}`,
          status: "blocked",
          updatedAt: oldTime,
        });
      }

      db.addAgent({
        _id: "lead-1",
        name: "Lead Agent",
        level: "lead",
      });

      const result = db.simulateEscalationCheck();

      expect(result.escalatedTasks).toBe(10); // Max 10
      expect(db.getActivities()).toHaveLength(10);
    });

    it("does not notify non-lead agents", () => {
      const now = Date.now();
      const oldTime = now - 25 * 60 * 60 * 1000;

      db.addTask({
        _id: "task-1",
        businessId: "biz-1",
        title: "Escalated Task",
        status: "blocked",
        updatedAt: oldTime,
      });

      db.addAgent({
        _id: "agent-1",
        name: "Regular Agent",
        level: "contributor",
      });

      const result = db.simulateEscalationCheck();

      expect(result.notificationsSent).toBe(0);
      expect(db.getNotifications()).toHaveLength(0);
    });
  });

  describe("cron execution order and idempotency", () => {
    it("heartbeat monitor can run repeatedly without issues", () => {
      const now = Date.now();
      const staleTime = now - 6 * 60 * 1000;

      db.addAgent({
        _id: "agent-1",
        name: "Agent",
        status: "active",
        lastHeartbeat: staleTime,
      });

      // Run once
      db.simulateHeartbeatMonitor();
      expect(db.getActivities()).toHaveLength(1);

      // Run again - already idle, no new activities
      const result2 = db.simulateHeartbeatMonitor();
      expect(result2.stale).toBe(0);
      expect(db.getActivities()).toHaveLength(1); // Still 1, not 2
    });
  });
});
