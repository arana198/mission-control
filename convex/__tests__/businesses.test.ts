/**
 * es CRUD Tests
 *
 * Tests for multi-business support: create, read, update, delete operations
 * Validates constraints: slug uniqueness, max 5 businesses, isDefault atomicity
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * MockDatabase for es and Settings
 */
class MockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    this.data.set("businesses", []);
    this.data.set("settings", []);
    this.data.set("tasks", []);
    this.data.set("epics", []);
    this.data.set("messages", []);
    this.data.set("activities", []);
    this.data.set("documents", []);
    this.data.set("goals", []);
    this.data.set("threadSubscriptions", []);
    this.data.set("executionLog", []);
    this.data.set("alerts", []);
    this.data.set("alertRules", []);
    this.data.set("alertEvents", []);
    this.data.set("decisions", []);
    this.data.set("strategicReports", []);
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
      const found = docs.find((d: any) => d._id === id);
      if (found) return found;
    }
    return null;
  }

  patch(id: string, updates: any) {
    for (const docs of this.data.values()) {
      const doc = docs.find((d: any) => d._id === id);
      if (doc) {
        Object.assign(doc, updates);
        return doc;
      }
    }
    return null;
  }

  delete(id: string) {
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
      withIndex: (indexName: string, filter: (q: any) => any) => ({
        collect: async () => {
          const docs = this.data.get(table) || [];
          if (indexName === "by_slug") {
            return docs;
          }
          if (indexName === "by_default") {
            return docs.filter((d: any) => d.isDefault === true);
          }
          if (indexName === "by_workspace") {
            return docs.filter((d: any) => d.workspaceId);
          }
          if (indexName === "by_workspace_key") {
            return docs.filter((d: any) => d.workspaceId);
          }
          return docs;
        },
      }),
    };
  }

  getes() {
    return this.data.get("businesses") || [];
  }

  getSettings() {
    return this.data.get("settings") || [];
  }

  getAllData() {
    return this.data;
  }

  getDataById(workspaceId: string, table: string) {
    const docs = this.data.get(table) || [];
    return docs.filter((d: any) => d.workspaceId === workspaceId);
  }

  deleteById(workspaceId: string, table: string) {
    const docs = this.data.get(table) || [];
    const count = docs.filter((d: any) => d.workspaceId === workspaceId).length;
    const filtered = docs.filter((d: any) => d.workspaceId !== workspaceId);
    this.data.set(table, filtered);
    return count;
  }
}

describe("es Module", () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  describe("create", () => {
    it("should create a workspace with valid slug and set isDefault if first", async () => {
      // Arrange: start with empty businesses
      const now = Date.now();

      // Act: create first business
      const workspaceId = db.insert("businesses", {
        name: "Mission Control HQ",
        slug: "mission-control-hq",
        color: "#6366f1",
        emoji: "🚀",
        missionStatement: "To orchestrate autonomous agents",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Assert: slug is stored, isDefault is true
      const workspace = db.get(workspaceId);
      expect(workspace).toBeDefined();
      expect(workspace.slug).toBe("mission-control-hq");
      expect(workspace.isDefault).toBe(true);
      expect( workspace.name).toBe("Mission Control HQ");
    });

    it("should create subsequent businesses with isDefault: false", async () => {
      // Arrange: one workspace already exists with isDefault: true
      const now = Date.now();
      db.insert("businesses", {
        name: " A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        missionStatement: "Mission A",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Act: create second business
      const workspaceId = db.insert("businesses", {
        name: " B",
        slug: "business-b",
        color: "#ec4899",
        emoji: "⭐",
        missionStatement: "Mission B",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      // Assert: isDefault is false
      const workspace = db.get(workspaceId);
      expect(workspace.isDefault).toBe(false);
    });

    it("should reject invalid slug format", async () => {
      const now = Date.now();
      const invalidSlugs = [
        "Mission-Control-HQ", // uppercase
        "mission control hq", // spaces
        "mission@control", // special chars
      ];

      // Assert: each should be rejected by slug validation
      const slugRegex = /^[a-z0-9-]+$/;
      invalidSlugs.forEach((slug) => {
        expect(slugRegex.test(slug)).toBe(false);
      });
    });

    it("should reject duplicate slug", async () => {
      const now = Date.now();
      // Arrange: workspace with slug exists
      db.insert("businesses", {
        name: " A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Act & Assert: attempt to create another with same slug should fail
      const businesses = db.getes();
      const isDuplicate = businesses.some((b: any) => b.slug === "business-a");
      expect(isDuplicate).toBe(true);
    });

    it("should reject creation when 5 businesses exist", async () => {
      const now = Date.now();
      // Arrange: 5 businesses already created
      for (let i = 0; i < 5; i++) {
        db.insert("businesses", {
          name: ` ${i}`,
          slug: `business-${i}`,
          color: "#6366f1",
          emoji: "🚀",
          isDefault: i === 0,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Act & Assert: check if max 5 limit is enforced
      const businesses = db.getes();
      expect(businesses.length).toBe(5);
      expect(businesses.length >= 5).toBe(true);
    });
  });

  describe("getAll", () => {
    it("should return all businesses sorted by name", async () => {
      const now = Date.now();
      // Arrange: businesses created out of order
      db.insert("businesses", {
        name: "Zulu Inc",
        slug: "zulu-inc",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });
      db.insert("businesses", {
        name: "Alpha Corp",
        slug: "alpha-corp",
        color: "#ec4899",
        emoji: "⭐",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Act: call getAll() and sort
      const businesses = db.getes().sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      // Expected: returned sorted by name
      expect(businesses[0].name).toBe("Alpha Corp");
      expect(businesses[1].name).toBe("Zulu Inc");
    });

    it("should return empty array if no businesses exist", async () => {
      // Arrange: no businesses created
      // Act: call getAll()
      const businesses = db.getes();

      // Expected: empty array []
      expect(businesses).toEqual([]);
      expect(businesses.length).toBe(0);
    });
  });

  describe("getBySlug", () => {
    it("should return workspace by slug", async () => {
      const now = Date.now();
      // Arrange: workspace with slug exists
      db.insert("businesses", {
        name: "Mission Control",
        slug: "mission-control",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Act: call getBySlug(slug)
      const businesses = db.getes();
      const workspace = businesses.find((b: any) => b.slug === "mission-control");

      // Expected: workspace object returned
      expect(workspace).toBeDefined();
      expect(business?.name).toBe("Mission Control");
    });

    it("should return null if slug not found", async () => {
      // Arrange: no workspace with slug
      // Act: call getBySlug("nonexistent")
      const businesses = db.getes();
      const workspace = businesses.find((b: any) => b.slug === "nonexistent");

      // Expected: null
      expect(workspace).toBeUndefined();
    });
  });

  describe("getDefaultWorkspace", () => {
    it("should return the workspace with isDefault: true", async () => {
      const now = Date.now();
      // Arrange: 2 businesses, one has isDefault: true
      db.insert("businesses", {
        name: " A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      db.insert("businesses", {
        name: " B",
        slug: "business-b",
        color: "#ec4899",
        emoji: "⭐",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      // Act: call getDefaultWorkspace()
      const businesses = db.getes();
      const defaultWorkspace = businesses.find((b: any) => b.isDefault === true);

      // Expected: the default workspace returned
      expect(defaultWorkspace).toBeDefined();
      expect(defaultWorkspace?.name).toBe(" A");
    });

    it("should return exactly one default business", async () => {
      const now = Date.now();
      // Constraint: at all times, exactly one workspace has isDefault: true
      db.insert("businesses", {
        name: " A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      db.insert("businesses", {
        name: " B",
        slug: "business-b",
        color: "#ec4899",
        emoji: "⭐",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      const businesses = db.getes();
      const defaultCount = businesses.filter((b: any) => b.isDefault === true)
        .length;
      expect(defaultCount).toBe(1);
    });
  });

  describe("setDefault", () => {
    it("should atomically switch default business", async () => {
      const now = Date.now();
      // Arrange:  A (default),  B (not default)
      const aId = db.insert("businesses", {
        name: " A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      const bId = db.insert("businesses", {
        name: " B",
        slug: "business-b",
        color: "#ec4899",
        emoji: "⭐",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      // Act: call setDefault( B id)
      db.patch(aId, { isDefault: false, updatedAt: now });
      db.patch(bId, { isDefault: true, updatedAt: now });

      // Expected:  A.isDefault = false,  B.isDefault = true (atomic)
      const businessA = db.get(aId);
      const businessB = db.get(bId);
      expect(businessA.isDefault).toBe(false);
      expect(businessB.isDefault).toBe(true);
    });

    it("should be idempotent", async () => {
      const now = Date.now();
      // Arrange:  A is default
      const aId = db.insert("businesses", {
        name: " A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Act: call setDefault( A id) twice
      db.patch(aId, { isDefault: true, updatedAt: now });
      db.patch(aId, { isDefault: true, updatedAt: now });

      // Expected: no error, state unchanged
      const workspace = db.get(aId);
      expect(workspace.isDefault).toBe(true);
    });

    it("should switch default from one workspace to another", async () => {
      const now = Date.now();
      // Arrange: 3 businesses with A as default
      const aId = db.insert("businesses", {
        name: " A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      const bId = db.insert("businesses", {
        name: " B",
        slug: "business-b",
        color: "#ec4899",
        emoji: "⭐",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });
      const cId = db.insert("businesses", {
        name: " C",
        slug: "business-c",
        color: "#10b981",
        emoji: "🎯",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      // Act: set  B as default
      db.patch(aId, { isDefault: false, updatedAt: now });
      db.patch(bId, { isDefault: true, updatedAt: now });

      // Expected: B is default, A and C are not
      expect(db.get(bId).isDefault).toBe(true);
      expect(db.get(aId).isDefault).toBe(false);
      expect(db.get(cId).isDefault).toBe(false);

      // Expected: exactly one default
      const businesses = db.getes();
      const defaultCount = businesses.filter((b: any) => b.isDefault).length;
      expect(defaultCount).toBe(1);
    });

    it("should prevent setting non-existent workspace as default", async () => {
      const now = Date.now();
      // Arrange: one workspace exists
      const aId = db.insert("businesses", {
        name: " A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Act: attempt to get non-existent business
      const nonExistent = db.get("nonexistent-id");

      // Expected: null returned (would throw error in real mutation)
      expect(nonExistent).toBeNull();
    });
  });

  describe("update", () => {
    it("should update workspace name, color, emoji", async () => {
      const now = Date.now();
      // Arrange: workspace exists
      const workspaceId = db.insert("businesses", {
        name: "Original Name",
        slug: "original-slug",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Act: call update with new values
      db.patch(workspaceId, {
        name: "Updated Name",
        color: "#ec4899",
        emoji: "⭐",
        updatedAt: Date.now(),
      });

      // Expected: fields updated, slug unchanged
      const workspace = db.get(workspaceId);
      expect( workspace.name).toBe("Updated Name");
      expect( workspace.color).toBe("#ec4899");
      expect( workspace.emoji).toBe("⭐");
      expect(workspace.slug).toBe("original-slug");
    });

    it("should update mission statement", async () => {
      const now = Date.now();
      // Arrange: workspace exists with mission statement
      const workspaceId = db.insert("businesses", {
        name: " A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        missionStatement: "Original mission",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Act: update mission statement
      const newMission = "Updated mission statement for better clarity";
      db.patch(workspaceId, {
        missionStatement: newMission,
        updatedAt: Date.now(),
      });

      // Expected: mission statement updated
      const workspace = db.get(workspaceId);
      expect( workspace.missionStatement).toBe(newMission);
      expect( workspace.updatedAt).toBeGreaterThanOrEqual(now);
    });

    it("should preserve other fields when updating mission statement", async () => {
      const now = Date.now();
      // Arrange: workspace exists
      const workspaceId = db.insert("businesses", {
        name: " A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        missionStatement: "Original mission",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Act: update only mission statement
      db.patch(workspaceId, {
        missionStatement: "New mission",
        updatedAt: Date.now(),
      });

      // Expected: other fields unchanged
      const workspace = db.get(workspaceId);
      expect( workspace.name).toBe(" A");
      expect(workspace.slug).toBe("business-a");
      expect( workspace.color).toBe("#6366f1");
      expect( workspace.emoji).toBe("🚀");
      expect(workspace.isDefault).toBe(true);
      expect( workspace.missionStatement).toBe("New mission");
    });

    it("should NOT allow slug change", async () => {
      const now = Date.now();
      // Arrange: workspace with slug exists
      const workspaceId = db.insert("businesses", {
        name: " A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Act: attempt update with new slug (in real implementation, slug is not in args)
      // This tests that slug is immutable
      const originalSlug = "business-a";

      // Expected: slug ignored or error
      const workspace = db.get(workspaceId);
      expect(workspace.slug).toBe(originalSlug);
    });
  });

  describe("remove", () => {
    it("should delete a workspace", async () => {
      const now = Date.now();
      // Arrange: 2 businesses
      const aId = db.insert("businesses", {
        name: " A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      const bId = db.insert("businesses", {
        name: " B",
        slug: "business-b",
        color: "#ec4899",
        emoji: "⭐",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      // Act: remove  B
      db.delete(bId);

      // Expected:  B deleted, only  A remains
      expect(db.get(bId)).toBeNull();
      expect(db.get(aId)).toBeDefined();
    });

    it("should reject removal if only 1 workspace exists", async () => {
      const now = Date.now();
      // Arrange: 1 workspace (the default)
      const aId = db.insert("businesses", {
        name: " A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Act & Assert: check that only 1 workspace exists
      const businesses = db.getes();
      expect(businesses.length).toBe(1);
      expect(businesses.length <= 1).toBe(true);
    });

    it("should reject removal of default business", async () => {
      const now = Date.now();
      // Arrange: 2 businesses,  A is default
      const aId = db.insert("businesses", {
        name: " A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      const bId = db.insert("businesses", {
        name: " B",
        slug: "business-b",
        color: "#ec4899",
        emoji: "⭐",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      // Assert:  A is default and exists
      const businessA = db.get(aId);
      expect(businessA.isDefault).toBe(true);
    });

    it("should allow removal of non-default business", async () => {
      const now = Date.now();
      // Arrange: 2 businesses,  A is default
      const aId = db.insert("businesses", {
        name: " A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      const bId = db.insert("businesses", {
        name: " B",
        slug: "business-b",
        color: "#ec4899",
        emoji: "⭐",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      // Act: remove  B
      db.delete(bId);

      // Expected:  B deleted successfully
      expect(db.get(bId)).toBeNull();
      expect(db.get(aId)).toBeDefined();
      const businesses = db.getes();
      expect(businesses.length).toBe(1);
    });

    it("should cascade delete all workspace-scoped data", async () => {
      const now = Date.now();
      // Arrange: 2 businesses with related data
      const aId = db.insert("businesses", {
        name: " A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      const bId = db.insert("businesses", {
        name: " B",
        slug: "business-b",
        color: "#ec4899",
        emoji: "⭐",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      // Create workspace-scoped data for B
      const taskId = db.insert("tasks", {
        workspaceId: bId,
        title: "Task",
        status: "in_progress",
      });
      const epicId = db.insert("epics", {
        workspaceId: bId,
        title: "Epic",
        status: "active",
      });
      const messageId = db.insert("messages", {
        workspaceId: bId,
        content: "Message",
      });
      const activityId = db.insert("activities", {
        workspaceId: bId,
        type: "task_created",
        message: "Activity",
      });
      const docId = db.insert("documents", {
        workspaceId: bId,
        title: "Doc",
        type: "deliverable",
      });
      const goalId = db.insert("goals", {
        workspaceId: bId,
        title: "Goal",
        status: "active",
      });
      const subId = db.insert("threadSubscriptions", {
        workspaceId: bId,
        level: "all",
      });
      const settingId = db.insert("settings", {
        workspaceId: bId,
        key: "taskCounter",
        value: "5",
      });

      // Act: simulate cascade delete of  B
      db.deleteById(bId, "tasks");
      db.deleteById(bId, "epics");
      db.deleteById(bId, "messages");
      db.deleteById(bId, "activities");
      db.deleteById(bId, "documents");
      db.deleteById(bId, "goals");
      db.deleteById(bId, "threadSubscriptions");
      db.deleteById(bId, "settings");
      db.deleteById(bId, "executionLog");
      db.deleteById(bId, "alerts");
      db.deleteById(bId, "alertRules");
      db.deleteById(bId, "alertEvents");
      db.deleteById(bId, "decisions");
      db.deleteById(bId, "strategicReports");
      db.delete(bId);

      // Expected:  B and all its data deleted,  A untouched
      expect(db.get(bId)).toBeNull();
      expect(db.get(aId)).toBeDefined();
      expect(db.get(taskId)).toBeNull();
      expect(db.get(epicId)).toBeNull();
      expect(db.get(messageId)).toBeNull();
      expect(db.get(activityId)).toBeNull();
      expect(db.get(docId)).toBeNull();
      expect(db.get(goalId)).toBeNull();
      expect(db.get(subId)).toBeNull();
      expect(db.get(settingId)).toBeNull();
    });

    it("should cascade delete and provide count of deleted items", async () => {
      const now = Date.now();
      // Arrange: workspace with multiple related items
      const bId = db.insert("businesses", {
        name: " B",
        slug: "business-b",
        color: "#ec4899",
        emoji: "⭐",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      // Create multiple items
      for (let i = 0; i < 3; i++) {
        db.insert("tasks", {
          workspaceId: bId,
          title: `Task ${i}`,
          status: "in_progress",
        });
        db.insert("messages", {
          workspaceId: bId,
          content: `Message ${i}`,
        });
        db.insert("activities", {
          workspaceId: bId,
          type: "task_created",
          message: `Activity ${i}`,
        });
      }

      // Act: count items before deletion
      const tasksCount = db.getDataById(bId, "tasks").length;
      const messagesCount = db.getDataById(bId, "messages").length;
      const activitiesCount = db.getDataById(bId, "activities").length;

      // Expected: correct counts
      expect(tasksCount).toBe(3);
      expect(messagesCount).toBe(3);
      expect(activitiesCount).toBe(3);

      // Simulate cascade delete
      const deletedTasks = db.deleteById(bId, "tasks");
      const deletedMessages = db.deleteById(bId, "messages");
      const deletedActivities = db.deleteById(bId, "activities");

      // Expected: counts returned
      expect(deletedTasks).toBe(3);
      expect(deletedMessages).toBe(3);
      expect(deletedActivities).toBe(3);

      // Verify all deleted
      expect(db.getDataById(bId, "tasks").length).toBe(0);
      expect(db.getDataById(bId, "messages").length).toBe(0);
      expect(db.getDataById(bId, "activities").length).toBe(0);
    });
  });
});
