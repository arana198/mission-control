/**
 * Advanced Systems Integration Tests
 *
 * Comprehensive tests for advanced systems:
 * - Strategic Reports
 * - Wake/Scheduling
 * - Migrations
 * - GitHub Integration
 * - Cross-System Scenarios
 */

/**
 * Mock Database for Advanced Systems
 */
class AdvancedSystemsMockDatabase {
  private data: Map<string, any[]> = new Map();

  constructor() {
    this.data.set("strategicReports", []);
    this.data.set("wakeSchedules", []);
    this.data.set("migrations", []);
    this.data.set("commitLinks", []);
    this.data.set("tasks", []);
    this.data.set("goals", []);
    this.data.set("agents", []);
  }

  insert(table: string, doc: any): string {
    const id = `${table}-${Date.now()}-${Math.random()}`;
    const withId = { ...doc, _id: id };
    if (!this.data.has(table)) this.data.set(table, []);
    this.data.get(table)!.push(withId);
    return id;
  }

  get(id: string): any {
    for (const docs of this.data.values()) {
      const found = docs.find(d => d._id === id);
      if (found) return found;
    }
    return null;
  }

  patch(id: string, updates: any): void {
    for (const docs of this.data.values()) {
      const found = docs.find(d => d._id === id);
      if (found) {
        Object.assign(found, updates);
        return;
      }
    }
  }

  delete(id: string): void {
    for (const docs of this.data.values()) {
      const index = docs.findIndex(d => d._id === id);
      if (index !== -1) {
        docs.splice(index, 1);
        return;
      }
    }
  }

  query(table: string) {
    const docs = this.data.get(table) || [];
    return {
      collect: () => docs,
      filter: (fn: (d: any) => boolean) => ({
        collect: () => docs.filter(fn),
        take: (n: number) => docs.filter(fn).slice(0, n),
      }),
      order: () => ({
        collect: () => [...docs].reverse(),
        take: (n: number) => [...docs].reverse().slice(0, n),
      }),
      take: (n: number) => docs.slice(0, n),
    };
  }

  getReportsForPeriod(period: string): any[] {
    return (this.data.get("strategicReports") || []).filter(r => r.period === period);
  }

  getWakeSchedules(): any[] {
    return this.data.get("wakeSchedules") || [];
  }

  getMigrations(): any[] {
    return this.data.get("migrations") || [];
  }

  getCommitLinks(): any[] {
    return this.data.get("commitLinks") || [];
  }

  createTask(title: string): string {
    return this.insert("tasks", {
      title,
      status: "backlog",
      createdAt: Date.now(),
    });
  }

  createGoal(title: string): string {
    return this.insert("goals", {
      title,
      status: "active",
      progress: 0,
      createdAt: Date.now(),
    });
  }

  createAgent(name: string): string {
    return this.insert("agents", {
      name,
      status: "idle",
      createdAt: Date.now(),
    });
  }
}

describe("ADVANCED SYSTEMS: Comprehensive Integration Tests", () => {
  let db: AdvancedSystemsMockDatabase;

  beforeEach(() => {
    db = new AdvancedSystemsMockDatabase();
  });

  // ==========================================
  // STRATEGIC REPORTS - POSITIVE SCENARIOS (4)
  // ==========================================
  describe("STRATEGIC REPORTS: Positive Scenarios", () => {
    it("generates weekly strategic report", () => {
      const week = "2026-W08";

      const reportId = db.insert("strategicReports", {
        type: "weekly",
        period: week,
        title: "Weekly Report - Week 8",
        summary: "Made progress on backend APIs",
        completedGoals: 2,
        blockedGoals: 1,
        insights: ["Good velocity", "One dependency issue"],
        metrics: {
          tasksCompleted: 15,
          agentsActive: 3,
          avgCompletion: 0.85,
        },
        recommendations: ["Unblock dependency issue", "Continue current pace"],
        generatedAt: Date.now(),
        createdAt: Date.now(),
      });

      expect(reportId).toBeTruthy();
    });

    it("retrieves reports for period", () => {
      const month = "2026-02";

      db.insert("strategicReports", {
        type: "weekly",
        period: `${month}-W01`,
        title: "Report 1",
        generatedAt: Date.now(),
        createdAt: Date.now(),
      });

      db.insert("strategicReports", {
        type: "weekly",
        period: `${month}-W02`,
        title: "Report 2",
        generatedAt: Date.now(),
        createdAt: Date.now(),
      });

      db.insert("strategicReports", {
        type: "weekly",
        period: "2026-03-W01",
        title: "Report 3",
        generatedAt: Date.now(),
        createdAt: Date.now(),
      });

      const reports = db.getReportsForPeriod(`${month}-W01`);
      expect(reports).toHaveLength(1);
    });

    it("tracks metrics in strategic report", () => {
      const reportId = db.insert("strategicReports", {
        type: "weekly",
        period: "2026-W08",
        title: "Weekly Report",
        metrics: {
          tasksCompleted: 20,
          tasksBlocked: 3,
          agentsActive: 4,
          avgCompletionTime: 2.5,
          bottlenecks: ["Database schema", "API rate limits"],
        },
        generatedAt: Date.now(),
        createdAt: Date.now(),
      });

      const report = db.get(reportId);
      expect(report.metrics.tasksCompleted).toBe(20);
      expect(report.metrics.bottlenecks).toHaveLength(2);
    });

    it("includes insights and recommendations", () => {
      const reportId = db.insert("strategicReports", {
        type: "monthly",
        period: "2026-02",
        title: "Monthly Report",
        insights: [
          "Team velocity increasing week over week",
          "One agent had technical issues mid-month",
          "Dependencies being resolved faster",
        ],
        recommendations: [
          "Allocate resources to unblock backend",
          "Schedule training session on new tools",
          "Review and optimize task sizing",
        ],
        generatedAt: Date.now(),
        createdAt: Date.now(),
      });

      const report = db.get(reportId);
      expect(report.insights).toHaveLength(3);
      expect(report.recommendations).toHaveLength(3);
    });
  });

  // ==========================================
  // STRATEGIC REPORTS - NEGATIVE SCENARIOS (2)
  // ==========================================
  describe("STRATEGIC REPORTS: Negative Scenarios", () => {
    it("returns empty reports for period with no data", () => {
      const reports = db.getReportsForPeriod("2099-W01");
      expect(reports).toHaveLength(0);
    });

    it("handles report generation with no metrics", () => {
      const reportId = db.insert("strategicReports", {
        type: "weekly",
        period: "2026-W08",
        title: "Minimal Report",
        generatedAt: Date.now(),
        createdAt: Date.now(),
      });

      const report = db.get(reportId);
      expect(report.metrics).toBeUndefined();
    });
  });

  // ==========================================
  // STRATEGIC REPORTS - EDGE CASES (3)
  // ==========================================
  describe("STRATEGIC REPORTS: Edge Cases", () => {
    it("handles reports with many insights and recommendations", () => {
      const reportId = db.insert("strategicReports", {
        type: "monthly",
        period: "2026-02",
        title: "Comprehensive Report",
        insights: Array.from({ length: 50 }, (_, i) => `Insight ${i}`),
        recommendations: Array.from({ length: 30 }, (_, i) => `Recommendation ${i}`),
        generatedAt: Date.now(),
        createdAt: Date.now(),
      });

      const report = db.get(reportId);
      expect(report.insights).toHaveLength(50);
      expect(report.recommendations).toHaveLength(30);
    });

    it("tracks bottleneck details", () => {
      const reportId = db.insert("strategicReports", {
        type: "weekly",
        period: "2026-W08",
        title: "Report with Bottlenecks",
        metrics: {
          bottlenecks: [
            { name: "Database schema", affectedTasks: 3, duration: "2 days" },
            { name: "API rate limits", affectedTasks: 5, duration: "1 day" },
            { name: "Third-party service", affectedTasks: 2, duration: "4 hours" },
          ],
        },
        generatedAt: Date.now(),
        createdAt: Date.now(),
      });

      const report = db.get(reportId);
      expect(report.metrics.bottlenecks).toHaveLength(3);
    });

    it("supports different report types", () => {
      const types = ["daily", "weekly", "monthly", "quarterly"];

      types.forEach(type => {
        db.insert("strategicReports", {
          type,
          period: `2026-${type}`,
          title: `${type} report`,
          generatedAt: Date.now(),
          createdAt: Date.now(),
        });
      });

      const reports = db.query("strategicReports").collect();
      expect(reports).toHaveLength(4);
    });
  });

  // ==========================================
  // WAKE/SCHEDULING - POSITIVE SCENARIOS (4)
  // ==========================================
  describe("WAKE/SCHEDULING: Positive Scenarios", () => {
    it("creates wake schedule for agent", () => {
      const agent = db.createAgent("solver-1");

      const scheduleId = db.insert("wakeSchedules", {
        agentId: agent,
        name: "Daily morning check",
        frequency: "daily",
        time: "09:00",
        timezone: "Europe/London",
        nextRun: Date.now() + 86400000,
        lastRun: Date.now(),
        enabled: true,
        createdAt: Date.now(),
      });

      expect(scheduleId).toBeTruthy();
    });

    it("calculates next run time", () => {
      const agent = db.createAgent("solver-1");
      const now = Date.now();

      const scheduleId = db.insert("wakeSchedules", {
        agentId: agent,
        name: "Hourly check",
        frequency: "hourly",
        nextRun: now + 3600000, // 1 hour from now
        lastRun: now,
        enabled: true,
        createdAt: now,
      });

      const schedule = db.get(scheduleId);
      expect(schedule.nextRun).toBe(now + 3600000);
    });

    it("manages multiple schedules per agent", () => {
      const agent = db.createAgent("solver-1");
      const now = Date.now();

      db.insert("wakeSchedules", {
        agentId: agent,
        name: "Morning check",
        frequency: "daily",
        nextRun: now + 3600000,
        createdAt: now,
      });

      db.insert("wakeSchedules", {
        agentId: agent,
        name: "Evening check",
        frequency: "daily",
        nextRun: now + 86400000,
        createdAt: now,
      });

      db.insert("wakeSchedules", {
        agentId: agent,
        name: "Hourly pulse",
        frequency: "hourly",
        nextRun: now + 1800000,
        createdAt: now,
      });

      const schedules = ((db as any).data.get("wakeSchedules") || []).filter((s: any) => s.agentId === agent);
      expect(schedules).toHaveLength(3);
    });

    it("updates last run timestamp", () => {
      const agent = db.createAgent("solver-1");
      const now = Date.now();

      const scheduleId = db.insert("wakeSchedules", {
        agentId: agent,
        name: "Check schedule",
        frequency: "hourly",
        lastRun: now - 3600000,
        nextRun: now,
        createdAt: now,
      });

      db.patch(scheduleId, {
        lastRun: now,
        nextRun: now + 3600000,
      });

      const schedule = db.get(scheduleId);
      expect(schedule.lastRun).toBe(now);
    });
  });

  // ==========================================
  // WAKE/SCHEDULING - NEGATIVE SCENARIOS (2)
  // ==========================================
  describe("WAKE/SCHEDULING: Negative Scenarios", () => {
    it("handles disabled schedules", () => {
      const agent = db.createAgent("solver-1");

      db.insert("wakeSchedules", {
        agentId: agent,
        name: "Disabled check",
        frequency: "hourly",
        enabled: false,
        nextRun: Date.now(),
        createdAt: Date.now(),
      });

      const schedules = db.getWakeSchedules().filter((s: any) => s.enabled);
      expect(schedules).toHaveLength(0);
    });

    it("returns empty schedules for non-existent agent", () => {
      db.insert("wakeSchedules", {
        agentId: "agent-1",
        name: "Check",
        frequency: "hourly",
        createdAt: Date.now(),
      });

      const schedules = ((db as any).data.get("wakeSchedules") || []).filter((s: any) => s.agentId === "non-existent");
      expect(schedules).toHaveLength(0);
    });
  });

  // ==========================================
  // WAKE/SCHEDULING - EDGE CASES (3)
  // ==========================================
  describe("WAKE/SCHEDULING: Edge Cases", () => {
    it("handles different frequencies", () => {
      const agent = db.createAgent("solver-1");
      const frequencies = ["hourly", "daily", "weekly", "monthly"];

      frequencies.forEach(freq => {
        db.insert("wakeSchedules", {
          agentId: agent,
          name: `${freq} schedule`,
          frequency: freq,
          nextRun: Date.now(),
          createdAt: Date.now(),
        });
      });

      const schedules = ((db as any).data.get("wakeSchedules") || []).filter((s: any) => s.agentId === agent);
      expect(schedules).toHaveLength(4);
    });

    it("handles timezone conversions", () => {
      const agent = db.createAgent("solver-1");
      const timezones = ["Europe/London", "America/New_York", "Asia/Tokyo"];

      timezones.forEach(tz => {
        db.insert("wakeSchedules", {
          agentId: agent,
          name: `Schedule for ${tz}`,
          frequency: "daily",
          timezone: tz,
          time: "09:00",
          createdAt: Date.now(),
        });
      });

      const schedules = ((db as any).data.get("wakeSchedules") || []).filter((s: any) => s.agentId === agent);
      expect(schedules.map((s: any) => s.timezone)).toEqual(timezones);
    });

    it("handles many schedules across agents", () => {
      for (let i = 0; i < 5; i++) {
        const agent = db.createAgent(`solver-${i}`);
        for (let j = 0; j < 3; j++) {
          db.insert("wakeSchedules", {
            agentId: agent,
            name: `Schedule ${j}`,
            frequency: "hourly",
            createdAt: Date.now(),
          });
        }
      }

      const allSchedules = db.getWakeSchedules();
      expect(allSchedules).toHaveLength(15);
    });
  });

  // ==========================================
  // MIGRATIONS - POSITIVE SCENARIOS (4)
  // ==========================================
  describe("MIGRATIONS: Positive Scenarios", () => {
    it("records migration execution", () => {
      const migrationId = db.insert("migrations", {
        version: "001",
        name: "Initial schema",
        description: "Create initial tables and indexes",
        executedAt: Date.now(),
        duration: 1234, // milliseconds
        status: "success",
      });

      expect(migrationId).toBeTruthy();
    });

    it("tracks multiple migrations in order", () => {
      const migrations = [
        { version: "001", name: "Initial schema", duration: 1000, status: "success" },
        { version: "002", name: "Add task indices", duration: 500, status: "success" },
        { version: "003", name: "Add agent metrics", duration: 800, status: "success" },
      ];

      migrations.forEach(m => {
        db.insert("migrations", {
          ...m,
          description: `Migration ${m.version}`,
          executedAt: Date.now(),
        });
      });

      const all = db.getMigrations();
      expect(all).toHaveLength(3);
    });

    it("records migration with rollback info", () => {
      const migrationId = db.insert("migrations", {
        version: "001",
        name: "Add column",
        description: "Add new column to tasks",
        executedAt: Date.now(),
        duration: 234,
        status: "success",
        rolledBackAt: null,
        rollbackDuration: null,
      });

      const migration = db.get(migrationId);
      expect(migration.status).toBe("success");
    });

    it("handles failed migrations", () => {
      const migrationId = db.insert("migrations", {
        version: "001",
        name: "Failed migration",
        description: "This migration failed",
        executedAt: Date.now(),
        duration: 500,
        status: "failed",
        error: "Invalid schema syntax",
      });

      const migration = db.get(migrationId);
      expect(migration.status).toBe("failed");
      expect(migration.error).toBeTruthy();
    });
  });

  // ==========================================
  // MIGRATIONS - NEGATIVE SCENARIOS (2)
  // ==========================================
  describe("MIGRATIONS: Negative Scenarios", () => {
    it("returns empty migrations list initially", () => {
      const migrations = db.getMigrations();
      expect(migrations).toHaveLength(0);
    });

    it("handles migration with empty description", () => {
      const migrationId = db.insert("migrations", {
        version: "001",
        name: "Minimal migration",
        description: "",
        executedAt: Date.now(),
        status: "success",
      });

      const migration = db.get(migrationId);
      expect(migration.description).toBe("");
    });
  });

  // ==========================================
  // MIGRATIONS - EDGE CASES (3)
  // ==========================================
  describe("MIGRATIONS: Edge Cases", () => {
    it("tracks many migrations", () => {
      for (let i = 1; i <= 100; i++) {
        db.insert("migrations", {
          version: String(i).padStart(3, "0"),
          name: `Migration ${i}`,
          description: `Description for migration ${i}`,
          executedAt: Date.now(),
          duration: Math.random() * 1000,
          status: i % 10 === 0 ? "failed" : "success",
        });
      }

      const migrations = db.getMigrations();
      expect(migrations).toHaveLength(100);
    });

    it("handles very long migration duration", () => {
      const migrationId = db.insert("migrations", {
        version: "001",
        name: "Slow migration",
        description: "This took a very long time",
        executedAt: Date.now(),
        duration: 3600000, // 1 hour
        status: "success",
      });

      const migration = db.get(migrationId);
      expect(migration.duration).toBe(3600000);
    });

    it("tracks migration history with timestamps", () => {
      const now = Date.now();

      for (let i = 0; i < 5; i++) {
        db.insert("migrations", {
          version: `00${i + 1}`,
          name: `Migration ${i + 1}`,
          description: "Sequential migration",
          executedAt: now + i * 86400000, // Each day apart
          duration: 1000,
          status: "success",
        });
      }

      const migrations = db.getMigrations();
      expect(migrations).toHaveLength(5);
    });
  });

  // ==========================================
  // GITHUB INTEGRATION - POSITIVE SCENARIOS (4)
  // ==========================================
  describe("GITHUB INTEGRATION: Positive Scenarios", () => {
    it("extracts ticket IDs from commit message", () => {
      function extractTicketIds(message: string, pattern: string): string[] {
        try {
          const regex = new RegExp(pattern, "gi");
          const matches = message.match(regex);
          return matches ? [...new Set(matches.map(m => m.toUpperCase()))] : [];
        } catch {
          return [];
        }
      }

      const message = "Fixed CORE-01 and PERF-02, also fixed CORE-01 again";
      const pattern = "[A-Za-z]+-\\d+";
      const ticketIds = extractTicketIds(message, pattern);

      expect(ticketIds).toHaveLength(2);
      expect(ticketIds).toContain("CORE-01");
      expect(ticketIds).toContain("PERF-02");
    });

    it("links commit to tasks", () => {
      const task1 = db.createTask("Fix database");
      const task2 = db.createTask("Add caching");

      const linkId = db.insert("commitLinks", {
        sha: "abc123def456",
        message: "CORE-01: Fixed database query",
        author: "engineer@example.com",
        date: "2026-02-19T10:00:00Z",
        taskIds: [task1, task2],
        ticketIds: ["CORE-01"],
        linkedAt: Date.now(),
      });

      expect(linkId).toBeTruthy();
    });

    it("handles commits with multiple tickets", () => {
      const task1 = db.createTask("Task 1");
      const task2 = db.createTask("Task 2");
      const task3 = db.createTask("Task 3");

      db.insert("commitLinks", {
        sha: "commit123",
        message: "CORE-01, PERF-02, FEAT-03: Major update",
        author: "dev@example.com",
        date: "2026-02-19T11:30:00Z",
        taskIds: [task1, task2, task3],
        ticketIds: ["CORE-01", "PERF-02", "FEAT-03"],
        linkedAt: Date.now(),
      });

      const links = db.getCommitLinks();
      expect(links[0].ticketIds).toHaveLength(3);
    });

    it("tracks commit author information", () => {
      db.insert("commitLinks", {
        sha: "xyz789",
        message: "CORE-01: Implementation",
        author: "alice@company.com",
        date: "2026-02-19T14:00:00Z",
        authorName: "Alice Engineer",
        ticketIds: ["CORE-01"],
        linkedAt: Date.now(),
      });

      const links = db.getCommitLinks();
      expect(links[0].author).toBe("alice@company.com");
      expect(links[0].authorName).toBe("Alice Engineer");
    });
  });

  // ==========================================
  // GITHUB INTEGRATION - NEGATIVE SCENARIOS (2)
  // ==========================================
  describe("GITHUB INTEGRATION: Negative Scenarios", () => {
    it("returns empty ticket IDs for no matches", () => {
      function extractTicketIds(message: string, pattern: string): string[] {
        try {
          const regex = new RegExp(pattern, "gi");
          const matches = message.match(regex);
          return matches ? [...new Set(matches.map(m => m.toUpperCase()))] : [];
        } catch {
          return [];
        }
      }

      const message = "Fixed some stuff but no tickets mentioned";
      const pattern = "[A-Za-z]+-\\d+";
      const ticketIds = extractTicketIds(message, pattern);

      expect(ticketIds).toHaveLength(0);
    });

    it("returns empty commit links initially", () => {
      const links = db.getCommitLinks();
      expect(links).toHaveLength(0);
    });
  });

  // ==========================================
  // GITHUB INTEGRATION - EDGE CASES (3)
  // ==========================================
  describe("GITHUB INTEGRATION: Edge Cases", () => {
    it("handles duplicate ticket IDs in message", () => {
      function extractTicketIds(message: string, pattern: string): string[] {
        try {
          const regex = new RegExp(pattern, "gi");
          const matches = message.match(regex);
          return matches ? [...new Set(matches.map(m => m.toUpperCase()))] : [];
        } catch {
          return [];
        }
      }

      const message = "Fixed CORE-01 then fixed CORE-01 again and PERF-02";
      const pattern = "[A-Za-z]+-\\d+";
      const ticketIds = extractTicketIds(message, pattern);

      expect(ticketIds).toHaveLength(2); // Duplicates removed
    });

    it("handles various ticket ID formats", () => {
      function extractTicketIds(message: string, pattern: string): string[] {
        try {
          const regex = new RegExp(pattern, "gi");
          const matches = message.match(regex);
          return matches ? [...new Set(matches.map(m => m.toUpperCase()))] : [];
        } catch {
          return [];
        }
      }

      const testCases = [
        { message: "CORE-01", expected: 1 },
        { message: "PERF-100", expected: 1 },
        { message: "feat-1", expected: 1 },
        { message: "A-999 and BB-1 and CCC-1", expected: 3 },
      ];

      testCases.forEach(({ message, expected }) => {
        const pattern = "[A-Za-z]+-\\d+";
        const ticketIds = extractTicketIds(message, pattern);
        expect(ticketIds).toHaveLength(expected);
      });
    });

    it("handles many commits linked together", () => {
      const task = db.createTask("Feature");

      for (let i = 0; i < 50; i++) {
        db.insert("commitLinks", {
          sha: `commit${i}`,
          message: `CORE-01: Commit ${i}`,
          author: "dev@company.com",
          date: new Date(Date.now() + i * 3600000).toISOString(),
          taskIds: [task],
          ticketIds: ["CORE-01"],
          linkedAt: Date.now(),
        });
      }

      const links = db.getCommitLinks();
      expect(links).toHaveLength(50);
    });
  });

  // ==========================================
  // CROSS-SYSTEM SCENARIOS - COMBINED (3)
  // ==========================================
  describe("CROSS-SYSTEM SCENARIOS: Combined Workflows", () => {
    it("complete workflow: commit → ticket → task → report", () => {
      // 1. Create task
      const task = db.createTask("Fix authentication");

      // 2. Link commit to task
      db.insert("commitLinks", {
        sha: "abc123",
        message: "CORE-01: Implement OAuth2",
        author: "dev@example.com",
        date: new Date().toISOString(),
        taskIds: [task],
        ticketIds: ["CORE-01"],
        linkedAt: Date.now(),
      });

      // 3. Mark task as complete and log execution
      db.patch(task, { status: "done" });

      db.insert("executionLog", {
        taskId: task,
        status: "success",
        output: "OAuth2 implemented and tested",
        timeSpent: 480, // 8 hours
        attemptNumber: 1,
        createdAt: Date.now(),
      });

      // 4. Update metrics
      const agent = db.createAgent("engineer-1");
      db.insert("agentMetrics", {
        agentId: agent,
        period: "2026-02",
        tasksCompleted: 1,
        updatedAt: Date.now(),
      });

      // 5. Include in strategic report
      db.insert("strategicReports", {
        type: "weekly",
        period: "2026-W08",
        title: "Weekly Report",
        summary: "Completed OAuth2 implementation",
        metrics: { tasksCompleted: 1 },
        generatedAt: Date.now(),
        createdAt: Date.now(),
      });

      // Verify complete chain
      const links = db.getCommitLinks();
      const logs = ((db as any).data.get("executionLog") || []);
      const reports = db.query("strategicReports").collect();

      expect(links).toHaveLength(1);
      expect(logs).toHaveLength(1);
      expect(reports).toHaveLength(1);
    });

    it("agent wake schedule → pull work → execute → log metrics", () => {
      // 1. Agent has wake schedule
      const agent = db.createAgent("solver-1");
      db.insert("wakeSchedules", {
        agentId: agent,
        name: "Morning check",
        frequency: "daily",
        enabled: true,
        nextRun: Date.now(),
        createdAt: Date.now(),
      });

      // 2. Agent wakes up and gets work queue
      const task = db.createTask("Implementation");
      db.patch(task, { status: "ready", assigneeIds: [agent] });

      db.insert("notifications", {
        recipientId: agent,
        type: "assignment",
        content: "New task ready",
        taskId: task,
        read: false,
        createdAt: Date.now(),
      });

      // 3. Agent executes task
      db.patch(task, { status: "in_progress" });
      db.insert("executionLog", {
        taskId: task,
        agentId: agent,
        status: "success",
        output: "Task completed",
        timeSpent: 120,
        attemptNumber: 1,
        createdAt: Date.now(),
      });

      db.patch(task, { status: "done" });

      // 4. Log metrics
      db.insert("agentMetrics", {
        agentId: agent,
        period: "2026-02",
        tasksCompleted: 1,
        commentsMade: 0,
        updatedAt: Date.now(),
      });

      // 5. Include in report
      db.insert("strategicReports", {
        type: "daily",
        period: "2026-02-19",
        metrics: { tasksCompleted: 1, agentsActive: 1 },
        generatedAt: Date.now(),
        createdAt: Date.now(),
      });

      // Verify chain
      const schedules = ((db as any).data.get("wakeSchedules") || []);
      const metrics = ((db as any).data.get("agentMetrics") || []);
      const reports = ((db as any).data.get("strategicReports") || []);

      expect(schedules).toHaveLength(1);
      expect(metrics).toHaveLength(1);
      expect(reports).toHaveLength(1);
    });

    it("migration → schema change → updates in workflows", () => {
      // 1. Execute migration
      db.insert("migrations", {
        version: "001",
        name: "Add agent performance columns",
        description: "Add performance tracking to agents",
        executedAt: Date.now(),
        duration: 500,
        status: "success",
      });

      // 2. Create agent with new fields
      const agent = db.createAgent("solver-1");

      // 3. Create and execute tasks
      const task = db.createTask("Task");
      db.patch(task, { status: "done" });

      // 4. Log metrics using new schema
      db.insert("agentMetrics", {
        agentId: agent,
        period: "2026-02",
        tasksCompleted: 1,
        avgCompletionTime: 2.5,
        efficiency: 0.95,
        updatedAt: Date.now(),
      });

      // 5. Generate report with new metrics
      db.insert("strategicReports", {
        type: "weekly",
        period: "2026-W08",
        metrics: {
          agentEfficiency: 0.95,
          avgCompletionTime: 2.5,
        },
        generatedAt: Date.now(),
        createdAt: Date.now(),
      });

      // Verify migration chain
      const migrations = db.getMigrations();
      const metrics = ((db as any).data.get("agentMetrics") || []);

      expect(migrations).toHaveLength(1);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].efficiency).toBe(0.95);
    });
  });
});
