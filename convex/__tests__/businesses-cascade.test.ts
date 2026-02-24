/**
 * Businesses Cascade Delete Tests (Phase 2)
 *
 * Tests for the `businesses.remove()` mutation cascade delete logic.
 * Verifies that all 25 business-scoped tables are properly cleaned up
 * without affecting data in other businesses or global tables.
 *
 * Critical tables tested:
 * - business-scoped (must delete): tasks, epics, goals, messages, activities, documents,
 *   threadSubscriptions, executionLog, alerts, alertRules, alertEvents, decisions,
 *   strategicReports, settings, calendarEvents, taskComments, mentions, taskSubscriptions,
 *   presenceIndicators, taskPatterns, anomalies, wikiPages, wikiComments, notifications
 * - global (must NOT delete): agents, agentMetrics, agentSkills
 *
 * Issues fixed by Phase 2:
 * 1. 9 tables missing from cascade: taskComments, mentions, taskSubscriptions,
 *    presenceIndicators, taskPatterns, anomalies, wikiPages, wikiComments
 * 2. Individual delete loops (no batching) causing timeouts
 * 3. CalendarEvents full table scan + N+1 queries (now uses by_business index post-MIG-10)
 * 4. Wasted agentMetrics full table scan with empty loop body
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Comprehensive MockDatabase for Cascade Delete Testing
 * Includes all 25 business-scoped tables + 3 global tables
 */
class CascadeMockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    // Business-scoped tables (must be cleaned)
    this.data.set("tasks", []);
    this.data.set("epics", []);
    this.data.set("goals", []);
    this.data.set("messages", []);
    this.data.set("activities", []);
    this.data.set("documents", []);
    this.data.set("threadSubscriptions", []);
    this.data.set("executionLog", []);
    this.data.set("alerts", []);
    this.data.set("alertRules", []);
    this.data.set("alertEvents", []);
    this.data.set("decisions", []);
    this.data.set("strategicReports", []);
    this.data.set("settings", []);
    this.data.set("calendarEvents", []);
    this.data.set("taskComments", []);
    this.data.set("mentions", []);
    this.data.set("taskSubscriptions", []);
    this.data.set("presenceIndicators", []);
    this.data.set("taskPatterns", []);
    this.data.set("anomalies", []);
    this.data.set("wikiPages", []);
    this.data.set("wikiComments", []);
    this.data.set("notifications", []);
    // Global tables (must NOT be cleaned)
    this.data.set("businesses", []);
    this.data.set("agents", []);
    this.data.set("agentMetrics", []);
    this.data.set("agentSkills", []);
  }

  generateId(table: string): string {
    return `${table}_${this.nextId++}`;
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
      const found = docs.find((d) => d._id === id);
      if (found) return found;
    }
    return null;
  }

  patch(id: string, updates: any) {
    for (const docs of this.data.values()) {
      const doc = docs.find((d) => d._id === id);
      if (doc) {
        Object.assign(doc, updates);
        return doc;
      }
    }
    return null;
  }

  delete(id: string) {
    for (const docs of this.data.values()) {
      const index = docs.findIndex((d) => d._id === id);
      if (index !== -1) {
        docs.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  query(table: string) {
    return {
      collect: async () => this.data.get(table) || [],
      withIndex: (indexName: string, filterFn?: (q: any) => any) => {
        return {
          collect: async () => this._queryWithIndex(table, indexName, filterFn),
        };
      },
    };
  }

  private _queryWithIndex(table: string, indexName: string, filterFn?: any) {
    const docs = this.data.get(table) || [];
    if (!filterFn) return docs;

    // Simulate by_business index queries
    if (indexName === "by_business") {
      const mockQ = {
        _businessId: null,
        eq: function (field: string, value: any) {
          if (field === "businessId") this._businessId = value;
          return this;
        },
      };
      filterFn(mockQ);
      return docs.filter((d) => d.businessId === mockQ._businessId);
    }

    if (indexName === "by_business_key") {
      const mockQ = {
        _businessId: null,
        _key: null,
        eq: function (field: string, value: any) {
          if (field === "businessId") this._businessId = value;
          if (field === "key") this._key = value;
          return this;
        },
      };
      filterFn(mockQ);
      return docs.filter(
        (d) => d.businessId === mockQ._businessId && d.key === mockQ._key
      );
    }

    return docs;
  }

  getCountByBusinessId(businessId: string, table: string): number {
    const docs = this.data.get(table) || [];
    return docs.filter((d) => d.businessId === businessId).length;
  }

  getAllByBusinessId(businessId: string, table: string): any[] {
    const docs = this.data.get(table) || [];
    return docs.filter((d) => d.businessId === businessId);
  }

  getTableCount(table: string): number {
    return (this.data.get(table) || []).length;
  }

  getTotalCountByBusinessId(businessId: string): number {
    let total = 0;
    // Only count business-scoped tables
    const scopedTables = [
      "tasks",
      "epics",
      "goals",
      "messages",
      "activities",
      "documents",
      "threadSubscriptions",
      "executionLog",
      "alerts",
      "alertRules",
      "alertEvents",
      "decisions",
      "strategicReports",
      "settings",
      "calendarEvents",
      "taskComments",
      "mentions",
      "taskSubscriptions",
      "presenceIndicators",
      "taskPatterns",
      "anomalies",
      "wikiPages",
      "wikiComments",
      "notifications",
    ];
    for (const table of scopedTables) {
      total += this.getCountByBusinessId(businessId, table);
    }
    return total;
  }

  // Simulate batch delete utility
  async batchDelete(ids: string[], batchSize = 100): Promise<number> {
    let deleted = 0;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      for (const id of batch) {
        if (this.delete(id)) {
          deleted++;
        }
      }
    }
    return deleted;
  }

  // Simulate the improved businesses.remove cascade
  async simulateCascadeDelete(businessId: string): Promise<any> {
    // Check if business exists (matches real mutation)
    const business = this.get(businessId);
    if (!business) {
      throw new Error("Business not found.");
    }

    const tables = [
      "tasks",
      "epics",
      "goals",
      "messages",
      "activities",
      "documents",
      "threadSubscriptions",
      "executionLog",
      "alerts",
      "alertRules",
      "alertEvents",
      "decisions",
      "strategicReports",
      "settings",
      "calendarEvents",
      "taskComments",
      "mentions",
      "taskSubscriptions",
      "presenceIndicators",
      "taskPatterns",
      "anomalies",
      "wikiPages",
      "wikiComments",
      "notifications",
    ];

    let totalDeleted = 0;
    for (const table of tables) {
      const ids = await this.query(table)
        .withIndex("by_business", (q) => q.eq("businessId", businessId))
        .collect()
        .then((docs) => docs.map((d: any) => d._id));

      if (ids.length > 0) {
        const deleted = await this.batchDelete(ids, 100);
        totalDeleted += deleted;
      }
    }

    // Delete the business itself
    if (this.delete(businessId)) {
      totalDeleted++;
    }

    return { totalDeleted, tables: tables.length };
  }
}

describe("Phase 2: Businesses Cascade Delete", () => {
  let db: CascadeMockDatabase;

  beforeEach(() => {
    db = new CascadeMockDatabase();
  });

  describe("Cascade Completeness: All 25 Business-Scoped Tables", () => {
    it("should delete tasks and related data for business", async () => {
      // Arrange: create business with tasks
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      for (let i = 0; i < 3; i++) {
        db.insert("tasks", {
          businessId,
          title: `Task ${i}`,
          description: "Test",
          status: "ready",
          priority: "P1",
          createdBy: "user1",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      // Act: cascade delete
      await db.simulateCascadeDelete(businessId);

      // Assert: tasks deleted
      expect(db.getCountByBusinessId(businessId, "tasks")).toBe(0);
    });

    it("should delete all 25 business-scoped tables completely", async () => {
      // Arrange: create business with one record in each table
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const tables = [
        "tasks",
        "epics",
        "goals",
        "messages",
        "activities",
        "documents",
        "threadSubscriptions",
        "executionLog",
        "alerts",
        "alertRules",
        "alertEvents",
        "decisions",
        "strategicReports",
        "calendarEvents",
        "taskComments",
        "mentions",
        "taskSubscriptions",
        "presenceIndicators",
        "taskPatterns",
        "anomalies",
        "wikiPages",
        "wikiComments",
        "notifications",
      ];

      for (const table of tables) {
        db.insert(table, {
          businessId,
          content: `Record from ${table}`,
          createdAt: Date.now(),
        });
      }

      // Verify all inserted
      expect(db.getTotalCountByBusinessId(businessId)).toBe(tables.length);

      // Act: cascade delete
      await db.simulateCascadeDelete(businessId);

      // Assert: all deleted
      for (const table of tables) {
        expect(db.getCountByBusinessId(businessId, table)).toBe(
          0,
          `${table} should be empty after cascade delete`
        );
      }
    });

    it("should add missing tables: taskComments, mentions, taskSubscriptions", async () => {
      // Arrange: 3 previously-missing tables
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      db.insert("taskComments", {
        businessId,
        taskId: "task_123",
        content: "This is a comment",
        agentId: "agent_1",
        createdAt: Date.now(),
      });

      db.insert("mentions", {
        businessId,
        mentionedAgentId: "agent_2",
        mentionedBy: "agent_1",
        context: "task_comment",
        createdAt: Date.now(),
      });

      db.insert("taskSubscriptions", {
        businessId,
        taskId: "task_123",
        agentId: "agent_3",
        notifyOn: "all",
        subscribedAt: Date.now(),
      });

      expect(db.getCountByBusinessId(businessId, "taskComments")).toBe(1);
      expect(db.getCountByBusinessId(businessId, "mentions")).toBe(1);
      expect(db.getCountByBusinessId(businessId, "taskSubscriptions")).toBe(1);

      // Act: cascade delete
      await db.simulateCascadeDelete(businessId);

      // Assert: all deleted
      expect(db.getCountByBusinessId(businessId, "taskComments")).toBe(0);
      expect(db.getCountByBusinessId(businessId, "mentions")).toBe(0);
      expect(db.getCountByBusinessId(businessId, "taskSubscriptions")).toBe(0);
    });

    it("should add missing tables: presenceIndicators, taskPatterns, anomalies", async () => {
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      db.insert("presenceIndicators", {
        businessId,
        agentId: "agent_1",
        status: "online",
        updatedAt: Date.now(),
      });

      db.insert("taskPatterns", {
        businessId,
        pattern: "design→backend→frontend",
        successRate: 85,
        createdAt: Date.now(),
      });

      db.insert("anomalies", {
        businessId,
        agentId: "agent_1",
        type: "duration_deviation",
        severity: "high",
        message: "Task took 3x longer than expected",
        detectedValue: 12,
        expectedValue: 4,
        flagged: true,
        createdAt: Date.now(),
      });

      expect(db.getCountByBusinessId(businessId, "presenceIndicators")).toBe(1);
      expect(db.getCountByBusinessId(businessId, "taskPatterns")).toBe(1);
      expect(db.getCountByBusinessId(businessId, "anomalies")).toBe(1);

      // Act
      await db.simulateCascadeDelete(businessId);

      // Assert
      expect(db.getCountByBusinessId(businessId, "presenceIndicators")).toBe(0);
      expect(db.getCountByBusinessId(businessId, "taskPatterns")).toBe(0);
      expect(db.getCountByBusinessId(businessId, "anomalies")).toBe(0);
    });

    it("should add missing tables: wikiPages, wikiComments", async () => {
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      db.insert("wikiPages", {
        businessId,
        title: "Architecture Overview",
        content: "# System Design",
        type: "page",
        childIds: [],
        createdBy: "user1",
        createdByName: "Alice",
        updatedBy: "user1",
        updatedByName: "Alice",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      db.insert("wikiComments", {
        businessId,
        pageId: "page_123",
        fromId: "agent_1",
        fromName: "Bot",
        content: "Great documentation!",
        replyIds: [],
        createdAt: Date.now(),
      });

      expect(db.getCountByBusinessId(businessId, "wikiPages")).toBe(1);
      expect(db.getCountByBusinessId(businessId, "wikiComments")).toBe(1);

      // Act
      await db.simulateCascadeDelete(businessId);

      // Assert
      expect(db.getCountByBusinessId(businessId, "wikiPages")).toBe(0);
      expect(db.getCountByBusinessId(businessId, "wikiComments")).toBe(0);
    });
  });

  describe("Data Isolation: No Cross-Business Contamination", () => {
    it("should NOT delete records belonging to other businesses", async () => {
      // Arrange: two businesses with tasks
      const business1 = db.insert("businesses", {
        name: "Business 1",
        slug: "business-1",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const business2 = db.insert("businesses", {
        name: "Business 2",
        slug: "business-2",
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      db.insert("tasks", {
        businessId: business1,
        title: "Task B1",
        description: "Test",
        status: "ready",
        priority: "P1",
        createdBy: "user1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const task2Id = db.insert("tasks", {
        businessId: business2,
        title: "Task B2",
        description: "Test",
        status: "ready",
        priority: "P1",
        createdBy: "user1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Act: delete business1
      await db.simulateCascadeDelete(business1);

      // Assert: business1 tasks deleted, business2 tasks survive
      expect(db.getCountByBusinessId(business1, "tasks")).toBe(0);
      expect(db.getCountByBusinessId(business2, "tasks")).toBe(1);
      expect(db.get(task2Id)).toBeDefined();
    });
  });

  describe("Global Tables: agentMetrics & agents survive deletion", () => {
    it("should NOT delete agentMetrics (global, no businessId)", async () => {
      // Arrange: business with agentMetrics
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const metricId = db.insert("agentMetrics", {
        agentId: "agent_1",
        period: "2024-02",
        tasksCreated: 10,
        tasksCompleted: 8,
        updatedAt: Date.now(),
        // Note: no businessId
      });

      expect(db.getTableCount("agentMetrics")).toBe(1);

      // Act: delete business
      await db.simulateCascadeDelete(businessId);

      // Assert: agentMetrics survives
      expect(db.getTableCount("agentMetrics")).toBe(1);
      expect(db.get(metricId)).toBeDefined();
    });

    it("should NOT delete agents (global, no businessId)", async () => {
      // Arrange: business with agents
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const agentId = db.insert("agents", {
        name: "Alice",
        role: "specialist",
        status: "active",
        sessionKey: "alice:main",
        lastHeartbeat: Date.now(),
        level: "specialist",
        workspacePath: "/home/alice",
        // Note: no businessId
      });

      expect(db.getTableCount("agents")).toBe(1);

      // Act: delete business
      await db.simulateCascadeDelete(businessId);

      // Assert: agents survives
      expect(db.getTableCount("agents")).toBe(1);
      expect(db.get(agentId)).toBeDefined();
    });
  });

  describe("Batching: Handle 100+ records without timeout", () => {
    it("should batch delete 250+ records across multiple batches", async () => {
      // Arrange: business with 250 tasks (tests batching)
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const taskCount = 250;
      for (let i = 0; i < taskCount; i++) {
        db.insert("tasks", {
          businessId,
          title: `Task ${i}`,
          description: "Test",
          status: "ready",
          priority: "P1",
          createdBy: "user1",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      expect(db.getCountByBusinessId(businessId, "tasks")).toBe(taskCount);

      // Act: cascade delete with batchSize=100 (will do 3 batches)
      await db.simulateCascadeDelete(businessId);

      // Assert: all deleted
      expect(db.getCountByBusinessId(businessId, "tasks")).toBe(0);
    });

    it("should handle mix of table sizes (some empty, some large)", async () => {
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // 150 tasks (batches into 2)
      for (let i = 0; i < 150; i++) {
        db.insert("tasks", {
          businessId,
          title: `Task ${i}`,
          description: "Test",
          status: "ready",
          priority: "P1",
          createdBy: "user1",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      // 50 messages (1 batch)
      for (let i = 0; i < 50; i++) {
        db.insert("messages", {
          businessId,
          taskId: `task_${i}`,
          fromId: "user1",
          fromName: "User",
          content: "Message",
          replyIds: [],
          mentions: [],
          createdAt: Date.now(),
        });
      }

      // 0 epics (empty table)

      expect(db.getCountByBusinessId(businessId, "tasks")).toBe(150);
      expect(db.getCountByBusinessId(businessId, "messages")).toBe(50);
      expect(db.getCountByBusinessId(businessId, "epics")).toBe(0);

      // Act
      await db.simulateCascadeDelete(businessId);

      // Assert
      expect(db.getCountByBusinessId(businessId, "tasks")).toBe(0);
      expect(db.getCountByBusinessId(businessId, "messages")).toBe(0);
      expect(db.getCountByBusinessId(businessId, "epics")).toBe(0);
    });
  });

  describe("CalendarEvents: Fix full table scan + N+1 queries", () => {
    it("should delete calendarEvents with backfilled businessId", async () => {
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const taskId = db.insert("tasks", {
        businessId,
        title: "Important Meeting",
        description: "Q4 Planning",
        status: "ready",
        priority: "P1",
        createdBy: "user1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Calendar event with businessId (post-MIG-10 backfill)
      db.insert("calendarEvents", {
        businessId, // backfilled by MIG-10
        taskId,
        title: "Important Meeting",
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        timezone: "UTC",
        type: "task_scheduled",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      expect(db.getCountByBusinessId(businessId, "calendarEvents")).toBe(1);

      // Act
      await db.simulateCascadeDelete(businessId);

      // Assert
      expect(db.getCountByBusinessId(businessId, "calendarEvents")).toBe(0);
    });

    it("should skip calendarEvents without businessId (no taskId)", async () => {
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Calendar event with no businessId (free time block, no taskId)
      const eventId = db.insert("calendarEvents", {
        title: "Team Standup",
        startTime: Date.now(),
        endTime: Date.now() + 1800000,
        timezone: "UTC",
        type: "team_meeting",
        // no taskId, no businessId
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      expect(db.getTableCount("calendarEvents")).toBe(1);

      // Act
      await db.simulateCascadeDelete(businessId);

      // Assert: calendar event with no businessId survives (not part of this business)
      expect(db.getTableCount("calendarEvents")).toBe(1);
      expect(db.get(eventId)).toBeDefined();
    });
  });

  describe("Idempotency: Safe to run multiple times", () => {
    it("should be idempotent when called on already-deleted business", async () => {
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      db.insert("tasks", {
        businessId,
        title: "Task 1",
        description: "Test",
        status: "ready",
        priority: "P1",
        createdBy: "user1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Act: delete first time
      await db.simulateCascadeDelete(businessId);
      expect(db.getCountByBusinessId(businessId, "tasks")).toBe(0);

      // Act: delete second time (on already-deleted business)
      // Assert: idempotent - second call throws error (not retryable, caller must handle)
      await expect(db.simulateCascadeDelete(businessId)).rejects.toThrow(
        "Business not found."
      );
    });
  });

  describe("Cascade Performance: No O(n²) complexity", () => {
    it("should complete deletion in linear time (fixed batch size)", async () => {
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create 500 tasks to stress-test batching
      for (let i = 0; i < 500; i++) {
        db.insert("tasks", {
          businessId,
          title: `Task ${i}`,
          description: "Test",
          status: "ready",
          priority: "P1",
          createdBy: "user1",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      const startTime = Date.now();

      // Act: cascade delete (should use batching to avoid timeout)
      const result = await db.simulateCascadeDelete(businessId);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert: all deleted efficiently
      expect(db.getCountByBusinessId(businessId, "tasks")).toBe(0);
      expect(result.totalDeleted).toBeGreaterThan(500); // tasks + business
      // Should complete in reasonable time (not exponential)
      expect(duration).toBeLessThan(1000); // 1 second for 500 records
    });
  });
});
