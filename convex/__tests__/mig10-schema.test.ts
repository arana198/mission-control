/**
 * MIG-10: Schema Optimizations Tests
 *
 * Tests for Phase 1 schema changes:
 * - tasks: add "by_ticket_number" index (["businessId", "ticketNumber"])
 * - calendarEvents: add optional businessId field + "by_business" index
 * - taskSubscriptions: add "by_business" index
 * - Backfill calendarEvents.businessId from related tasks
 *
 * Tests verify:
 * - Index functionality (queries return correct results)
 * - Backfill idempotency (safe to run multiple times)
 * - Data integrity (no data lost during backfill)
 * - Graceful handling of edge cases (records without taskId, etc.)
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * MockDatabase for MIG-10 Schema Tests
 * Simulates Convex database with index support for schema change testing
 */
class SchemaMockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    this.data.set("businesses", []);
    this.data.set("tasks", []);
    this.data.set("calendarEvents", []);
    this.data.set("taskSubscriptions", []);
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

  query(table: string) {
    return {
      collect: async () => this.data.get(table) || [],
      withIndex: (indexName: string, filterFn?: (q: any) => any) => {
        return {
          collect: async () => this._queryWithIndex(table, indexName, filterFn),
          first: async () => {
            const results = await this._queryWithIndex(
              table,
              indexName,
              filterFn
            );
            return results.length > 0 ? results[0] : null;
          },
        };
      },
    };
  }

  private _queryWithIndex(table: string, indexName: string, filterFn?: any) {
    const docs = this.data.get(table) || [];

    if (indexName === "by_ticket_number") {
      // Simulate by_ticket_number index: ["businessId", "ticketNumber"]
      // filterFn would be q => q.eq("businessId", bid).eq("ticketNumber", tktNum)
      if (filterFn) {
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
      return docs;
    }

    if (indexName === "by_business") {
      // Simulate by_business index: ["businessId"]
      if (filterFn) {
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
      return docs;
    }

    return docs;
  }

  getData(table: string) {
    return this.data.get(table) || [];
  }

  // Helper: Simulate the MIG-10 backfill operation
  async backfillCalendarEventsBusinessId() {
    const events = this.data.get("calendarEvents") || [];
    let backfilled = 0;
    for (const event of events) {
      if (event.businessId) continue; // idempotent skip
      if (event.taskId) {
        const task = this.get(event.taskId);
        if (task && task.businessId) {
          this.patch(event._id, { businessId: task.businessId });
          backfilled++;
        }
      }
    }
    return backfilled;
  }
}

describe("MIG-10: Schema Optimizations", () => {
  let db: SchemaMockDatabase;

  beforeEach(() => {
    db = new SchemaMockDatabase();
  });

  describe("Phase 1A: tasks by_ticket_number index", () => {
    it("should create tasks with ticketNumber and query by by_ticket_number index", async () => {
      // Arrange: create a business and task with ticketNumber
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const taskId = db.insert("tasks", {
        businessId,
        title: "Test Task",
        description: "Test",
        ticketNumber: "TEST-001",
        status: "ready",
        priority: "P1",
        createdBy: "user1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Act: query by_ticket_number index
      const results = await db
        .query("tasks")
        .withIndex("by_ticket_number", (q) =>
          q.eq("businessId", businessId).eq("ticketNumber", "TEST-001")
        )
        .collect();

      // Assert: found exactly one task with that ticket number
      expect(results.length).toBe(1);
      expect(results[0]._id).toBe(taskId);
      expect(results[0].ticketNumber).toBe("TEST-001");
    });

    it("should distinguish between different ticket numbers in same business", async () => {
      // Arrange: two tasks with different ticket numbers
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
        ticketNumber: "TEST-001",
        status: "ready",
        priority: "P1",
        createdBy: "user1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      db.insert("tasks", {
        businessId,
        title: "Task 2",
        description: "Test",
        ticketNumber: "TEST-002",
        status: "ready",
        priority: "P1",
        createdBy: "user1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Act: query for TEST-001
      const results = await db
        .query("tasks")
        .withIndex("by_ticket_number", (q) =>
          q.eq("businessId", businessId).eq("ticketNumber", "TEST-001")
        )
        .collect();

      // Assert: only TEST-001 found
      expect(results.length).toBe(1);
      expect(results[0].ticketNumber).toBe("TEST-001");
    });

    it("should isolate ticket numbers across businesses", async () => {
      // Arrange: two businesses with same ticket number
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
        title: "Task in B1",
        description: "Test",
        ticketNumber: "TASK-001",
        status: "ready",
        priority: "P1",
        createdBy: "user1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      db.insert("tasks", {
        businessId: business2,
        title: "Task in B2",
        description: "Test",
        ticketNumber: "TASK-001",
        status: "ready",
        priority: "P1",
        createdBy: "user1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Act: query for TASK-001 in business1
      const results = await db
        .query("tasks")
        .withIndex("by_ticket_number", (q) =>
          q.eq("businessId", business1).eq("ticketNumber", "TASK-001")
        )
        .collect();

      // Assert: only task from business1 returned
      expect(results.length).toBe(1);
      expect(results[0].title).toBe("Task in B1");
    });
  });

  describe("Phase 1B: calendarEvents businessId backfill", () => {
    it("should backfill calendarEvents.businessId from related task", async () => {
      // Arrange: business, task, and calendar event without businessId
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

      const eventId = db.insert("calendarEvents", {
        taskId,
        title: "Important Meeting",
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        timezone: "UTC",
        type: "task_scheduled",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // Note: no businessId yet (before backfill)
      });

      // Act: simulate MIG-10 backfill
      const backfilled = await db.backfillCalendarEventsBusinessId();

      // Assert: event now has businessId from task
      const event = db.get(eventId);
      expect(event.businessId).toBe(businessId);
      expect(backfilled).toBe(1);
    });

    it("should be idempotent — skip already-backfilled records", async () => {
      // Arrange: already-backfilled calendar event
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const taskId = db.insert("tasks", {
        businessId,
        title: "Meeting",
        description: "Test",
        status: "ready",
        priority: "P1",
        createdBy: "user1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const eventId = db.insert("calendarEvents", {
        taskId,
        title: "Meeting",
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        timezone: "UTC",
        type: "task_scheduled",
        businessId, // already backfilled
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Act: run backfill again
      const backfilled = await db.backfillCalendarEventsBusinessId();

      // Assert: no additional records backfilled (idempotent)
      expect(backfilled).toBe(0);
      const event = db.get(eventId);
      expect(event.businessId).toBe(businessId); // still correct
    });

    it("should skip calendar events without taskId", async () => {
      // Arrange: calendar event with no taskId (e.g., free time block)
      const eventId = db.insert("calendarEvents", {
        title: "Team Standup",
        startTime: Date.now(),
        endTime: Date.now() + 1800000,
        timezone: "UTC",
        type: "team_meeting",
        // no taskId
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Act: run backfill
      const backfilled = await db.backfillCalendarEventsBusinessId();

      // Assert: event has no businessId (skipped gracefully)
      const event = db.get(eventId);
      expect(event.businessId).toBeUndefined();
      expect(backfilled).toBe(0);
    });

    it("should backfill multiple events in one pass", async () => {
      // Arrange: business with 3 tasks and 3 events
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const taskIds = [];
      for (let i = 0; i < 3; i++) {
        taskIds.push(
          db.insert("tasks", {
            businessId,
            title: `Task ${i}`,
            description: "Test",
            status: "ready",
            priority: "P1",
            createdBy: "user1",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })
        );
      }

      for (let i = 0; i < 3; i++) {
        db.insert("calendarEvents", {
          taskId: taskIds[i],
          title: `Event ${i}`,
          startTime: Date.now(),
          endTime: Date.now() + 3600000,
          timezone: "UTC",
          type: "task_scheduled",
          // no businessId
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      // Act: backfill all
      const backfilled = await db.backfillCalendarEventsBusinessId();

      // Assert: all 3 backfilled
      expect(backfilled).toBe(3);
      const events = db.getData("calendarEvents");
      events.forEach((event: any) => {
        expect(event.businessId).toBe(businessId);
      });
    });
  });

  describe("Phase 1C: taskSubscriptions by_business index", () => {
    it("should create taskSubscriptions and query by by_business index", async () => {
      // Arrange: business, task, subscription
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const taskId = db.insert("tasks", {
        businessId,
        title: "Test Task",
        description: "Test",
        status: "ready",
        priority: "P1",
        createdBy: "user1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const subId = db.insert("taskSubscriptions", {
        businessId,
        taskId,
        agentId: "agent1",
        notifyOn: "status_change",
        subscribedAt: Date.now(),
      });

      // Act: query by_business index
      const results = await db
        .query("taskSubscriptions")
        .withIndex("by_business", (q) => q.eq("businessId", businessId))
        .collect();

      // Assert: found exactly one subscription
      expect(results.length).toBe(1);
      expect(results[0]._id).toBe(subId);
      expect(results[0].businessId).toBe(businessId);
    });

    it("should isolate subscriptions across businesses", async () => {
      // Arrange: two businesses with subscriptions
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

      const task1 = db.insert("tasks", {
        businessId: business1,
        title: "Task 1",
        description: "Test",
        status: "ready",
        priority: "P1",
        createdBy: "user1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const task2 = db.insert("tasks", {
        businessId: business2,
        title: "Task 2",
        description: "Test",
        status: "ready",
        priority: "P1",
        createdBy: "user1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      db.insert("taskSubscriptions", {
        businessId: business1,
        taskId: task1,
        agentId: "agent1",
        notifyOn: "status_change",
        subscribedAt: Date.now(),
      });

      db.insert("taskSubscriptions", {
        businessId: business2,
        taskId: task2,
        agentId: "agent2",
        notifyOn: "status_change",
        subscribedAt: Date.now(),
      });

      // Act: query for business1 subscriptions
      const results = await db
        .query("taskSubscriptions")
        .withIndex("by_business", (q) => q.eq("businessId", business1))
        .collect();

      // Assert: only business1 subscription returned
      expect(results.length).toBe(1);
      expect(results[0].businessId).toBe(business1);
      expect(results[0].agentId).toBe("agent1");
    });

    it("should return empty if no subscriptions for business", async () => {
      // Arrange: business with no subscriptions
      const businessId = db.insert("businesses", {
        name: "Test Business",
        slug: "test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Act: query by_business index for empty business
      const results = await db
        .query("taskSubscriptions")
        .withIndex("by_business", (q) => q.eq("businessId", businessId))
        .collect();

      // Assert: empty array
      expect(results).toEqual([]);
      expect(results.length).toBe(0);
    });
  });

  describe("Phase 1: Integration (all 3 index changes together)", () => {
    it("should have all 3 indexes functional in single pass", async () => {
      // Arrange: full scenario with all schema changes
      const businessId = db.insert("businesses", {
        name: "Full Test Business",
        slug: "full-test-business",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Task with ticket
      const taskId = db.insert("tasks", {
        businessId,
        title: "Feature: Add Dashboard",
        description: "Implement dashboard",
        ticketNumber: "FEAT-042",
        status: "ready",
        priority: "P1",
        createdBy: "user1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Calendar event (will be backfilled)
      const eventId = db.insert("calendarEvents", {
        taskId,
        title: "Feature: Add Dashboard",
        startTime: Date.now(),
        endTime: Date.now() + 7200000,
        timezone: "UTC",
        type: "task_scheduled",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Subscription
      const subId = db.insert("taskSubscriptions", {
        businessId,
        taskId,
        agentId: "agent_alice",
        notifyOn: "status_change",
        subscribedAt: Date.now(),
      });

      // Act 1: Find task by ticket number
      const taskByTicket = await db
        .query("tasks")
        .withIndex("by_ticket_number", (q) =>
          q.eq("businessId", businessId).eq("ticketNumber", "FEAT-042")
        )
        .first();

      // Act 2: Backfill calendar event
      const backfilled = await db.backfillCalendarEventsBusinessId();

      // Act 3: Find subscriptions by business
      const subs = await db
        .query("taskSubscriptions")
        .withIndex("by_business", (q) => q.eq("businessId", businessId))
        .collect();

      // Assert: all three operations work
      expect(taskByTicket).toBeDefined();
      expect(taskByTicket._id).toBe(taskId);
      expect(taskByTicket.ticketNumber).toBe("FEAT-042");

      expect(backfilled).toBe(1);
      const event = db.get(eventId);
      expect(event.businessId).toBe(businessId);

      expect(subs.length).toBe(1);
      expect(subs[0]._id).toBe(subId);
    });
  });
});
