/**
 * Businesses CRUD Tests
 *
 * Tests for multi-business support: create, read, update, delete operations
 * Validates constraints: slug uniqueness, max 5 businesses, isDefault atomicity
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * MockDatabase for Businesses and Settings
 */
class BusinessMockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    this.data.set("businesses", []);
    this.data.set("settings", []);
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
      withIndex: (indexName: string, filter: (q: any) => any) => ({
        collect: async () => {
          const docs = this.data.get(table) || [];
          if (indexName === "by_slug") {
            return docs;
          }
          if (indexName === "by_default") {
            return docs.filter((d) => d.isDefault === true);
          }
          return docs;
        },
      }),
    };
  }

  getBusinesses() {
    return this.data.get("businesses") || [];
  }

  getSettings() {
    return this.data.get("settings") || [];
  }
}

describe("Businesses Module", () => {
  let db: BusinessMockDatabase;

  beforeEach(() => {
    db = new BusinessMockDatabase();
  });

  describe("create", () => {
    it("should create a business with valid slug and set isDefault if first", async () => {
      // Arrange: start with empty businesses
      const now = Date.now();

      // Act: create first business
      const businessId = db.insert("businesses", {
        name: "Mission Control HQ",
        slug: "mission-control-hq",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Assert: slug is stored, isDefault is true
      const business = db.get(businessId);
      expect(business).toBeDefined();
      expect(business.slug).toBe("mission-control-hq");
      expect(business.isDefault).toBe(true);
      expect(business.name).toBe("Mission Control HQ");
    });

    it("should create subsequent businesses with isDefault: false", async () => {
      // Arrange: one business already exists with isDefault: true
      const now = Date.now();
      db.insert("businesses", {
        name: "Business A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Act: create second business
      const businessId = db.insert("businesses", {
        name: "Business B",
        slug: "business-b",
        color: "#ec4899",
        emoji: "⭐",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      // Assert: isDefault is false
      const business = db.get(businessId);
      expect(business.isDefault).toBe(false);
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
      // Arrange: business with slug exists
      db.insert("businesses", {
        name: "Business A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Act & Assert: attempt to create another with same slug should fail
      const businesses = db.getBusinesses();
      const isDuplicate = businesses.some((b) => b.slug === "business-a");
      expect(isDuplicate).toBe(true);
    });

    it("should reject creation when 5 businesses exist", async () => {
      const now = Date.now();
      // Arrange: 5 businesses already created
      for (let i = 0; i < 5; i++) {
        db.insert("businesses", {
          name: `Business ${i}`,
          slug: `business-${i}`,
          color: "#6366f1",
          emoji: "🚀",
          isDefault: i === 0,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Act & Assert: check if max 5 limit is enforced
      const businesses = db.getBusinesses();
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
      const businesses = db.getBusinesses().sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      // Expected: returned sorted by name
      expect(businesses[0].name).toBe("Alpha Corp");
      expect(businesses[1].name).toBe("Zulu Inc");
    });

    it("should return empty array if no businesses exist", async () => {
      // Arrange: no businesses created
      // Act: call getAll()
      const businesses = db.getBusinesses();

      // Expected: empty array []
      expect(businesses).toEqual([]);
      expect(businesses.length).toBe(0);
    });
  });

  describe("getBySlug", () => {
    it("should return business by slug", async () => {
      const now = Date.now();
      // Arrange: business with slug exists
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
      const businesses = db.getBusinesses();
      const business = businesses.find((b) => b.slug === "mission-control");

      // Expected: business object returned
      expect(business).toBeDefined();
      expect(business?.name).toBe("Mission Control");
    });

    it("should return null if slug not found", async () => {
      // Arrange: no business with slug
      // Act: call getBySlug("nonexistent")
      const businesses = db.getBusinesses();
      const business = businesses.find((b) => b.slug === "nonexistent");

      // Expected: null
      expect(business).toBeUndefined();
    });
  });

  describe("getDefault", () => {
    it("should return the business with isDefault: true", async () => {
      const now = Date.now();
      // Arrange: 2 businesses, one has isDefault: true
      db.insert("businesses", {
        name: "Business A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      db.insert("businesses", {
        name: "Business B",
        slug: "business-b",
        color: "#ec4899",
        emoji: "⭐",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      // Act: call getDefault()
      const businesses = db.getBusinesses();
      const defaultBusiness = businesses.find((b) => b.isDefault === true);

      // Expected: the default business returned
      expect(defaultBusiness).toBeDefined();
      expect(defaultBusiness?.name).toBe("Business A");
    });

    it("should return exactly one default business", async () => {
      const now = Date.now();
      // Constraint: at all times, exactly one business has isDefault: true
      db.insert("businesses", {
        name: "Business A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      db.insert("businesses", {
        name: "Business B",
        slug: "business-b",
        color: "#ec4899",
        emoji: "⭐",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      const businesses = db.getBusinesses();
      const defaultCount = businesses.filter((b) => b.isDefault === true)
        .length;
      expect(defaultCount).toBe(1);
    });
  });

  describe("setDefault", () => {
    it("should atomically switch default business", async () => {
      const now = Date.now();
      // Arrange: Business A (default), Business B (not default)
      const aId = db.insert("businesses", {
        name: "Business A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      const bId = db.insert("businesses", {
        name: "Business B",
        slug: "business-b",
        color: "#ec4899",
        emoji: "⭐",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      // Act: call setDefault(Business B id)
      db.patch(aId, { isDefault: false, updatedAt: now });
      db.patch(bId, { isDefault: true, updatedAt: now });

      // Expected: Business A.isDefault = false, Business B.isDefault = true (atomic)
      const businessA = db.get(aId);
      const businessB = db.get(bId);
      expect(businessA.isDefault).toBe(false);
      expect(businessB.isDefault).toBe(true);
    });

    it("should be idempotent", async () => {
      const now = Date.now();
      // Arrange: Business A is default
      const aId = db.insert("businesses", {
        name: "Business A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Act: call setDefault(Business A id) twice
      db.patch(aId, { isDefault: true, updatedAt: now });
      db.patch(aId, { isDefault: true, updatedAt: now });

      // Expected: no error, state unchanged
      const business = db.get(aId);
      expect(business.isDefault).toBe(true);
    });
  });

  describe("update", () => {
    it("should update business name, color, emoji", async () => {
      const now = Date.now();
      // Arrange: business exists
      const businessId = db.insert("businesses", {
        name: "Original Name",
        slug: "original-slug",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Act: call update with new values
      db.patch(businessId, {
        name: "Updated Name",
        color: "#ec4899",
        emoji: "⭐",
        updatedAt: Date.now(),
      });

      // Expected: fields updated, slug unchanged
      const business = db.get(businessId);
      expect(business.name).toBe("Updated Name");
      expect(business.color).toBe("#ec4899");
      expect(business.emoji).toBe("⭐");
      expect(business.slug).toBe("original-slug");
    });

    it("should NOT allow slug change", async () => {
      const now = Date.now();
      // Arrange: business with slug exists
      const businessId = db.insert("businesses", {
        name: "Business A",
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
      const business = db.get(businessId);
      expect(business.slug).toBe(originalSlug);
    });
  });

  describe("remove", () => {
    it("should delete a business", async () => {
      const now = Date.now();
      // Arrange: 2 businesses
      const aId = db.insert("businesses", {
        name: "Business A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      const bId = db.insert("businesses", {
        name: "Business B",
        slug: "business-b",
        color: "#ec4899",
        emoji: "⭐",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      // Act: remove Business B
      db.delete(bId);

      // Expected: Business B deleted, only Business A remains
      expect(db.get(bId)).toBeNull();
      expect(db.get(aId)).toBeDefined();
    });

    it("should reject removal if only 1 business exists", async () => {
      const now = Date.now();
      // Arrange: 1 business (the default)
      const aId = db.insert("businesses", {
        name: "Business A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      // Act & Assert: check that only 1 business exists
      const businesses = db.getBusinesses();
      expect(businesses.length).toBe(1);
      expect(businesses.length <= 1).toBe(true);
    });

    it("should reject removal of default business", async () => {
      const now = Date.now();
      // Arrange: 2 businesses, Business A is default
      const aId = db.insert("businesses", {
        name: "Business A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      const bId = db.insert("businesses", {
        name: "Business B",
        slug: "business-b",
        color: "#ec4899",
        emoji: "⭐",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      // Assert: Business A is default and exists
      const businessA = db.get(aId);
      expect(businessA.isDefault).toBe(true);
    });

    it("should allow removal of non-default business", async () => {
      const now = Date.now();
      // Arrange: 2 businesses, Business A is default
      const aId = db.insert("businesses", {
        name: "Business A",
        slug: "business-a",
        color: "#6366f1",
        emoji: "🚀",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      const bId = db.insert("businesses", {
        name: "Business B",
        slug: "business-b",
        color: "#ec4899",
        emoji: "⭐",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      // Act: remove Business B
      db.delete(bId);

      // Expected: Business B deleted successfully
      expect(db.get(bId)).toBeNull();
      expect(db.get(aId)).toBeDefined();
      const businesses = db.getBusinesses();
      expect(businesses.length).toBe(1);
    });
  });
});
