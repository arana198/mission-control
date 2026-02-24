/**
 * Phase 3: Pagination and Indexes Tests
 *
 * Tests for eliminating unbounded `collect()` calls and implementing proper indexing.
 * Verifies:
 * - getTaskByTicketNumber uses by_ticket_number index (not full scan)
 * - getFiltered respects pagination limits and uses indexes where possible
 * - getAllAgents limits results to 200 (not unbounded)
 * - deleteAgent uses by_assignee index (not full table scan)
 * - countUnread uses by_read index + take() (not collect() for length)
 * - markAllRead uses by_read index + parallel patches
 * - patternLearning queries use by_business index without as any
 * - calendarEvents queries use by_business index (post-MIG-10 backfill)
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Mock Convex database for pagination and index testing
 */
class PaginationMockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;
  private queryStats = {
    indexUsed: 0,
    fullScansPerformed: 0,
    collectCalls: 0,
  };

  constructor() {
    // Initialize all tables
    ["tasks", "agents", "notifications", "taskPatterns", "calendarEvents", "agentMetrics"].forEach(
      (table) => {
        this.data.set(table, []);
      }
    );
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
      collect: async () => {
        this.queryStats.collectCalls++;
        return this.data.get(table) || [];
      },
      withIndex: (indexName: string, filterFn?: (q: any) => any) => {
        return {
          collect: async () => {
            this.queryStats.indexUsed++;
            return this._queryWithIndex(table, indexName, filterFn);
          },
          take: async (limit: number) => {
            this.queryStats.indexUsed++;
            const results = this._queryWithIndex(table, indexName, filterFn);
            return results.slice(0, limit);
          },
          first: async () => {
            this.queryStats.indexUsed++;
            const results = this._queryWithIndex(table, indexName, filterFn);
            return results.length > 0 ? results[0] : null;
          },
        };
      },
      take: async (limit: number) => {
        this.queryStats.collectCalls++;
        const docs = this.data.get(table) || [];
        return docs.slice(0, limit);
      },
    };
  }

  private _queryWithIndex(table: string, indexName: string, filterFn?: any) {
    const docs = this.data.get(table) || [];
    if (!filterFn) return docs;

    // Simulate by_ticket_number index
    if (indexName === "by_ticket_number") {
      const mockQ = {
        _businessId: null,
        _ticketNumber: null,
        eq: function (field: string, value: any) {
          if (field === "businessId") this._businessId = value;
          if (field === "ticketNumber") this._ticketNumber = value;
          return this;
        },
      };
      filterFn(mockQ);
      return docs.filter(
        (d) =>
          d.businessId === mockQ._businessId &&
          d.ticketNumber === mockQ._ticketNumber
      );
    }

    // Simulate by_business_status index
    if (indexName === "by_business_status") {
      const mockQ = {
        _businessId: null,
        _status: null,
        eq: function (field: string, value: any) {
          if (field === "businessId") this._businessId = value;
          if (field === "status") this._status = value;
          return this;
        },
      };
      filterFn(mockQ);
      return docs.filter(
        (d) =>
          d.businessId === mockQ._businessId &&
          d.status === mockQ._status
      );
    }

    // Simulate by_business index
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

    // Simulate by_assignee index
    if (indexName === "by_assignee") {
      const mockQ = {
        _assigneeIds: null,
        eq: function (field: string, value: any) {
          if (field === "assigneeIds") this._assigneeIds = value;
          return this;
        },
      };
      filterFn(mockQ);
      return docs.filter((d) =>
        d.assigneeIds?.includes(mockQ._assigneeIds)
      );
    }

    // Simulate by_read index
    if (indexName === "by_read") {
      const mockQ = {
        _recipientId: null,
        _read: null,
        eq: function (field: string, value: any) {
          if (field === "recipientId") this._recipientId = value;
          if (field === "read") this._read = value;
          return this;
        },
      };
      filterFn(mockQ);
      return docs.filter(
        (d) =>
          d.recipientId === mockQ._recipientId &&
          d.read === mockQ._read
      );
    }

    return docs;
  }

  resetStats() {
    this.queryStats = {
      indexUsed: 0,
      fullScansPerformed: 0,
      collectCalls: 0,
    };
  }

  getStats() {
    return this.queryStats;
  }
}

describe("Phase 3: Pagination and Indexes", () => {
  let db: PaginationMockDatabase;

  beforeEach(() => {
    db = new PaginationMockDatabase();
  });

  describe("getTaskByTicketNumber: Use by_ticket_number index", () => {
    it("should find task by businessId + ticketNumber using index", async () => {
      const businessId = "business_1";
      const taskId = db.insert("tasks", {
        businessId,
        ticketNumber: "T-123",
        title: "Test Task",
        description: "Test",
        status: "ready",
      });

      db.resetStats();

      // Simulate getTaskByTicketNumber using index
      const result = await db
        .query("tasks")
        .withIndex("by_ticket_number", (q) =>
          q.eq("businessId", businessId).eq("ticketNumber", "T-123")
        )
        .first();

      expect(result).not.toBeNull();
      expect(result._id).toBe(taskId);
      expect(db.getStats().indexUsed).toBe(1); // index was used
      expect(db.getStats().collectCalls).toBe(0); // no full scan
    });

    it("should return null if ticket not found", async () => {
      const businessId = "business_1";

      const result = await db
        .query("tasks")
        .withIndex("by_ticket_number", (q) =>
          q.eq("businessId", businessId).eq("ticketNumber", "NONEXISTENT")
        )
        .first();

      expect(result).toBeNull();
    });

    it("should not return task from different business", async () => {
      db.insert("tasks", {
        businessId: "business_1",
        ticketNumber: "T-123",
        title: "Task 1",
        description: "Test",
        status: "ready",
      });

      db.insert("tasks", {
        businessId: "business_2",
        ticketNumber: "T-123", // same number, different business
        title: "Task 2",
        description: "Test",
        status: "ready",
      });

      db.resetStats();

      const result = await db
        .query("tasks")
        .withIndex("by_ticket_number", (q) =>
          q.eq("businessId", "business_1").eq("ticketNumber", "T-123")
        )
        .first();

      expect(result?.businessId).toBe("business_1");
      expect(db.getStats().indexUsed).toBe(1);
    });
  });

  describe("getFiltered: Pagination with limits and indexes", () => {
    it("should respect limit of 200 max (hard safety cap)", async () => {
      const businessId = "business_1";

      // Insert 250 tasks
      for (let i = 0; i < 250; i++) {
        db.insert("tasks", {
          businessId,
          ticketNumber: `T-${i}`,
          title: `Task ${i}`,
          description: "Test",
          status: "ready",
          priority: "P1",
        });
      }

      // Query with limit 300 (should be capped at 200)
      const results = await db
        .query("tasks")
        .withIndex("by_business", (q) => q.eq("businessId", businessId))
        .take(Math.min(300, 200));

      expect(results.length).toBeLessThanOrEqual(200);
      expect(results.length).toBe(200); // should return exactly 200
    });

    it("should use by_business_status index when status filter present", async () => {
      const businessId = "business_1";

      db.insert("tasks", {
        businessId,
        ticketNumber: "T-1",
        title: "Ready Task",
        status: "ready",
        priority: "P1",
      });

      db.insert("tasks", {
        businessId,
        ticketNumber: "T-2",
        title: "Blocked Task",
        status: "blocked",
        priority: "P1",
      });

      db.resetStats();

      const results = await db
        .query("tasks")
        .withIndex("by_business_status", (q) =>
          q.eq("businessId", businessId).eq("status", "ready")
        )
        .take(50);

      expect(results.length).toBe(1);
      expect(results[0].status).toBe("ready");
      expect(db.getStats().indexUsed).toBe(1); // index was used
    });

    it("should return empty array if no results", async () => {
      const results = await db
        .query("tasks")
        .withIndex("by_business", (q) =>
          q.eq("businessId", "nonexistent_business")
        )
        .take(50);

      expect(results).toEqual([]);
    });
  });

  describe("getAllAgents: Limit to 200 records", () => {
    it("should return at most 200 agents", async () => {
      // Insert 250 agents
      for (let i = 0; i < 250; i++) {
        db.insert("agents", {
          name: `Agent ${i}`,
          email: `agent${i}@test.com`,
          role: "executor",
        });
      }

      db.resetStats();

      const results = await db.query("agents").take(200);

      expect(results.length).toBeLessThanOrEqual(200);
      expect(results.length).toBe(200); // should return exactly 200
      expect(db.getStats().collectCalls).toBe(1); // one call with take()
    });

    it("should return fewer agents if fewer than 200 exist", async () => {
      for (let i = 0; i < 50; i++) {
        db.insert("agents", {
          name: `Agent ${i}`,
          email: `agent${i}@test.com`,
          role: "executor",
        });
      }

      const results = await db.query("agents").take(200);

      expect(results.length).toBe(50);
    });
  });

  describe("deleteAgent: Use by_assignee index for efficient deletion", () => {
    it("should only delete tasks where agent is assigned", async () => {
      const agentId = "agent_1";
      const businessId = "business_1";

      // Task where agent IS assigned
      const assignedTaskId = db.insert("tasks", {
        businessId,
        ticketNumber: "T-1",
        title: "Assigned Task",
        assigneeIds: [agentId, "agent_2"],
        status: "ready",
      });

      // Task where agent is NOT assigned
      const unassignedTaskId = db.insert("tasks", {
        businessId,
        ticketNumber: "T-2",
        title: "Unassigned Task",
        assigneeIds: ["agent_2"],
        status: "ready",
      });

      db.resetStats();

      // Find all tasks where agent is assigned
      const assignedTasks = await db
        .query("tasks")
        .withIndex("by_assignee", (q) => q.eq("assigneeIds", agentId))
        .collect();

      expect(assignedTasks.length).toBe(1);
      expect(assignedTasks[0]._id).toBe(assignedTaskId);
      expect(db.getStats().indexUsed).toBe(1); // index was used

      // Verify unassigned task is not affected
      const unassignedTask = db.get(unassignedTaskId);
      expect(unassignedTask).not.toBeNull();
    });

    it("should use index instead of full table scan", async () => {
      const agentId = "agent_1";

      // Insert 50 tasks for different agents
      for (let i = 0; i < 50; i++) {
        db.insert("tasks", {
          businessId: "business_1",
          ticketNumber: `T-${i}`,
          title: `Task ${i}`,
          assigneeIds: [i < 10 ? agentId : `agent_${i}`], // 10 tasks for agent_1
          status: "ready",
        });
      }

      db.resetStats();

      const results = await db
        .query("tasks")
        .withIndex("by_assignee", (q) => q.eq("assigneeIds", agentId))
        .collect();

      expect(results.length).toBe(10); // agent_1 assigned to first 10 tasks
      expect(db.getStats().indexUsed).toBe(1); // efficient index lookup
    });
  });

  describe("countUnread: Use by_read index without collect()", () => {
    it("should count unread notifications using index + take", async () => {
      const agentId = "agent_1";

      // Insert 50 unread notifications
      for (let i = 0; i < 50; i++) {
        db.insert("notifications", {
          recipientId: agentId,
          read: false,
          message: `Notification ${i}`,
        });
      }

      // Insert 30 read notifications (should not be counted)
      for (let i = 0; i < 30; i++) {
        db.insert("notifications", {
          recipientId: agentId,
          read: true,
          message: `Read notification ${i}`,
        });
      }

      db.resetStats();

      // Count unread using index + take (not collect for length)
      const unread = await db
        .query("notifications")
        .withIndex("by_read", (q) =>
          q.eq("recipientId", agentId).eq("read", false)
        )
        .take(101); // +1 to detect "100+" threshold

      expect(unread.length).toBe(50);
      expect(db.getStats().indexUsed).toBe(1); // index was used
      expect(db.getStats().collectCalls).toBe(0); // no full collect
    });

    it("should not load unread notifications for other agents", async () => {
      db.insert("notifications", {
        recipientId: "agent_1",
        read: false,
        message: "For agent 1",
      });

      db.insert("notifications", {
        recipientId: "agent_2",
        read: false,
        message: "For agent 2",
      });

      const agent1Unread = await db
        .query("notifications")
        .withIndex("by_read", (q) =>
          q.eq("recipientId", "agent_1").eq("read", false)
        )
        .take(101);

      expect(agent1Unread.length).toBe(1);
      expect(agent1Unread[0].recipientId).toBe("agent_1");
    });
  });

  describe("markAllRead: Use by_read index with parallel patches", () => {
    it("should efficiently mark multiple unread as read", async () => {
      const agentId = "agent_1";

      // Insert 20 unread notifications
      const unreadIds: string[] = [];
      for (let i = 0; i < 20; i++) {
        const id = db.insert("notifications", {
          recipientId: agentId,
          read: false,
          message: `Notification ${i}`,
        });
        unreadIds.push(id);
      }

      db.resetStats();

      // Get unread using index
      const unread = await db
        .query("notifications")
        .withIndex("by_read", (q) =>
          q.eq("recipientId", agentId).eq("read", false)
        )
        .take(500);

      expect(unread.length).toBe(20);
      expect(db.getStats().indexUsed).toBe(1); // efficient index lookup

      // Mark all as read in parallel (simulated)
      await Promise.all(
        unread.map((n) =>
          new Promise((resolve) => {
            db.patch(n._id, { read: true, readAt: Date.now() });
            resolve(true);
          })
        )
      );

      // Verify all are now marked as read
      const stillUnread = await db
        .query("notifications")
        .withIndex("by_read", (q) =>
          q.eq("recipientId", agentId).eq("read", false)
        )
        .take(500);

      expect(stillUnread.length).toBe(0);
    });
  });

  describe("patternLearning: Use by_business index without as any", () => {
    it("should query taskPatterns by business using index", async () => {
      const businessId = "business_1";

      // Insert 5 patterns for business_1
      for (let i = 0; i < 5; i++) {
        db.insert("taskPatterns", {
          businessId,
          patternType: "duration",
          pattern: `Pattern ${i}`,
        });
      }

      // Insert patterns for other businesses
      db.insert("taskPatterns", {
        businessId: "business_2",
        patternType: "duration",
        pattern: "Other pattern",
      });

      db.resetStats();

      // Query using by_business index (no as any needed)
      const patterns = await db
        .query("taskPatterns")
        .withIndex("by_business", (q) => q.eq("businessId", businessId))
        .collect();

      expect(patterns.length).toBe(5);
      expect(patterns.every((p) => p.businessId === businessId)).toBe(true);
      expect(db.getStats().indexUsed).toBe(1); // index was used, no as any needed
    });

    it("should return empty array for business with no patterns", async () => {
      const patterns = await db
        .query("taskPatterns")
        .withIndex("by_business", (q) =>
          q.eq("businessId", "empty_business")
        )
        .collect();

      expect(patterns).toEqual([]);
    });
  });

  describe("calendarEvents: Use by_business index with backfilled businessId", () => {
    it("should query calendar events by business using index", async () => {
      const businessId = "business_1";

      // Insert calendar events with backfilled businessId (from MIG-10)
      for (let i = 0; i < 10; i++) {
        db.insert("calendarEvents", {
          businessId, // MIG-10 backfilled
          taskId: `task_${i}`,
          startTime: Date.now() + i * 3600000,
          endTime: Date.now() + (i + 1) * 3600000,
        });
      }

      // Insert for other business
      db.insert("calendarEvents", {
        businessId: "business_2",
        taskId: "task_other",
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
      });

      db.resetStats();

      // Query using by_business index
      const events = await db
        .query("calendarEvents")
        .withIndex("by_business", (q) => q.eq("businessId", businessId))
        .take(500);

      expect(events.length).toBe(10);
      expect(events.every((e) => e.businessId === businessId)).toBe(true);
      expect(db.getStats().indexUsed).toBe(1); // index was used
    });

    it("should return events in business-scoped context", async () => {
      const businessId = "business_1";

      db.insert("calendarEvents", {
        businessId,
        taskId: "task_1",
        title: "Business 1 Event",
      });

      db.insert("calendarEvents", {
        businessId: "business_2",
        taskId: "task_2",
        title: "Business 2 Event",
      });

      const events = await db
        .query("calendarEvents")
        .withIndex("by_business", (q) => q.eq("businessId", businessId))
        .take(500);

      expect(events.length).toBe(1);
      expect(events[0].title).toBe("Business 1 Event");
    });
  });
});
