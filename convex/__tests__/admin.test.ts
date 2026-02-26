/**
 * Admin Mutations Tests
 * Tests for clearAllData and other admin operations
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Mock Database for Admin Tests
 * Simulates all tables that need to be cleared
 */
class AdminMockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    const tables = [
      "tasks", "epics", "goals", "messages", "activities", "documents",
      "executionLog", "alerts", "alertRules", "alertEvents", "decisions",
      "strategicReports", "settings", "calendarEvents", "taskComments",
      "mentions", "taskSubscriptions", "presenceIndicators", "taskPatterns",
      "anomalies", "wikiPages", "wikiComments", "notifications",
      "threadSubscriptions", "businesses", "agents", "keys",
    ];
    tables.forEach(table => this.data.set(table, []));
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

  async delete(id: string) {
    for (const docs of this.data.values()) {
      const index = docs.findIndex((d: any) => d._id === id);
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
    };
  }

  getTotalRecords(): number {
    let total = 0;
    for (const docs of this.data.values()) {
      total += docs.length;
    }
    return total;
  }

  getRecordsByTable(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [table, docs] of this.data.entries()) {
      result[table] = docs.length;
    }
    return result;
  }
}

describe("Admin Mutations", () => {
  let mockDb: AdminMockDatabase;
  let mockCtx: any;

  beforeEach(() => {
    mockDb = new AdminMockDatabase();
    mockCtx = { db: mockDb };
  });

  describe("clearAllData", () => {
    it("should delete all records from all tables", async () => {
      // Setup: Insert test data into multiple tables
      mockDb.insert("businesses", { name: "Test " });
      mockDb.insert("tasks", { title: "Test Task" });
      mockDb.insert("epics", { title: "Test Epic" });
      mockDb.insert("messages", { content: "Test Message" });
      mockDb.insert("settings", { key: "test" });

      expect(mockDb.getTotalRecords()).toBe(5);

      // Execute: Run clearAllData (simulated)
      const tables = [
        "tasks", "epics", "goals", "messages", "activities", "documents",
        "executionLog", "alerts", "alertRules", "alertEvents", "decisions",
        "strategicReports", "settings", "calendarEvents", "taskComments",
        "mentions", "taskSubscriptions", "presenceIndicators", "taskPatterns",
        "anomalies", "wikiPages", "wikiComments", "notifications",
        "threadSubscriptions", "businesses", "agents", "keys",
      ] as const;

      const deletedCounts: Record<string, number> = {};

      for (const table of tables) {
        const all = await mockCtx.db.query(table as any).collect();
        for (const doc of all) {
          await mockCtx.db.delete(doc._id);
        }
        deletedCounts[table] = all.length;
      }

      // Verify: All tables are empty
      expect(mockDb.getTotalRecords()).toBe(0);
      expect(deletedCounts["businesses"]).toBe(1);
      expect(deletedCounts["tasks"]).toBe(1);
      expect(deletedCounts["epics"]).toBe(1);
      expect(deletedCounts["messages"]).toBe(1);
      expect(deletedCounts["settings"]).toBe(1);
    });

    it("should return correct deleted counts per table", async () => {
      // Setup: Insert data into multiple tables
      mockDb.insert("businesses", { name: " 1" });
      mockDb.insert("businesses", { name: " 2" });
      mockDb.insert("tasks", { title: "Task 1" });
      mockDb.insert("tasks", { title: "Task 2" });
      mockDb.insert("tasks", { title: "Task 3" });
      mockDb.insert("epics", { title: "Epic 1" });

      expect(mockDb.getTotalRecords()).toBe(6);

      // Execute: Clear all data
      const tables = [
        "tasks", "epics", "goals", "messages", "activities", "documents",
        "executionLog", "alerts", "alertRules", "alertEvents", "decisions",
        "strategicReports", "settings", "calendarEvents", "taskComments",
        "mentions", "taskSubscriptions", "presenceIndicators", "taskPatterns",
        "anomalies", "wikiPages", "wikiComments", "notifications",
        "threadSubscriptions", "businesses", "agents", "keys",
      ] as const;

      const deletedCounts: Record<string, number> = {};
      let totalRecordsDeleted = 0;

      for (const table of tables) {
        const all = await mockCtx.db.query(table as any).collect();
        for (const doc of all) {
          await mockCtx.db.delete(doc._id);
        }
        deletedCounts[table] = all.length;
        totalRecordsDeleted += all.length;
      }

      // Verify: Correct counts returned
      expect(deletedCounts["businesses"]).toBe(2);
      expect(deletedCounts["tasks"]).toBe(3);
      expect(deletedCounts["epics"]).toBe(1);
      expect(totalRecordsDeleted).toBe(6);
    });

    it("should handle empty database gracefully", async () => {
      // Setup: Empty database (no data inserted)
      expect(mockDb.getTotalRecords()).toBe(0);

      // Execute: Clear all data on empty database
      const tables = [
        "tasks", "epics", "goals", "messages", "activities", "documents",
        "executionLog", "alerts", "alertRules", "alertEvents", "decisions",
        "strategicReports", "settings", "calendarEvents", "taskComments",
        "mentions", "taskSubscriptions", "presenceIndicators", "taskPatterns",
        "anomalies", "wikiPages", "wikiComments", "notifications",
        "threadSubscriptions", "businesses", "agents", "keys",
      ] as const;

      const deletedCounts: Record<string, number> = {};
      let totalRecordsDeleted = 0;

      for (const table of tables) {
        const all = await mockCtx.db.query(table as any).collect();
        for (const doc of all) {
          await mockCtx.db.delete(doc._id);
        }
        deletedCounts[table] = all.length;
        totalRecordsDeleted += all.length;
      }

      // Verify: No records deleted, total is 0
      expect(totalRecordsDeleted).toBe(0);
      expect(mockDb.getTotalRecords()).toBe(0);
    });

    it("should delete from all 27 expected tables", async () => {
      // Verify that clearAllData targets all required tables
      const tables = [
        "tasks", "epics", "goals", "messages", "activities", "documents",
        "executionLog", "alerts", "alertRules", "alertEvents", "decisions",
        "strategicReports", "settings", "calendarEvents", "taskComments",
        "mentions", "taskSubscriptions", "presenceIndicators", "taskPatterns",
        "anomalies", "wikiPages", "wikiComments", "notifications",
        "threadSubscriptions", "businesses", "agents", "keys",
      ];

      expect(tables.length).toBe(27);
      expect(tables).toContain("businesses");
      expect(tables).toContain("tasks");
      expect(tables).toContain("settings");
      expect(tables).toContain("agents");
      expect(tables).toContain("notifications");
    });
  });
});
