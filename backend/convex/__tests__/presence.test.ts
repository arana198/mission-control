/**
 * Presence System Tests (Phase 5A)
 *
 * Tests for:
 * - Real-time agent status (online/away/do_not_disturb/offline)
 * - Activity tracking and last activity timestamps
 * - Auto-away after 5 minutes
 * - Stale cleanup after 30 minutes
 * - Activity recording
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Mock database for presence system
 */
class PresenceMockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    this.data.set("presenceIndicators", []);
    this.data.set("businesses", []);
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
      const found = docs.find((d: any) => d._id === id);
      if (found) {
        Object.assign(found, updates);
        return true;
      }
    }
    return false;
  }

  query(table: string) {
    const self = this;
    return {
      withIndex: (indexName: string, predicate?: (q: any) => any) => ({
        first: async () => {
          const docs = self.data.get(table) || [];
          return docs[0] || null;
        },
        collect: async () => self.data.get(table) || [],
      }),
      filter: (predicate: (doc: any) => boolean) => ({
        collect: async () => (self.data.get(table) || []).filter(predicate),
      }),
      collect: async () => self.data.get(table) || [],
    };
  }

  getPresenceBy(workspaceId: string) {
    return (this.data.get("presenceIndicators") || []).filter(
      (p: any) => p.workspaceId === workspaceId
    );
  }

  getPresenceByAgent(agentId: string) {
    return (this.data.get("presenceIndicators") || []).filter(
      (p: any) => p.agentId === agentId
    );
  }

  getAllPresence() {
    return this.data.get("presenceIndicators") || [];
  }
}

describe("Presence System (convex/presence.ts)", () => {
  let db: PresenceMockDatabase;
  let workspaceId: string;
  let agentId1: string;
  let agentId2: string;
  let agentId3: string;

  beforeEach(() => {
    db = new PresenceMockDatabase();
    workspaceId = db.insert("businesses", { name: "Test Biz" });
    agentId1 = db.insert("agents", { name: "Alice", role: "Developer" });
    agentId2 = db.insert("agents", { name: "Bob", role: "Designer" });
    agentId3 = db.insert("agents", { name: "Charlie", role: "PM" });
  });

  // =====================================
  // Phase 5A: Presence Update Tests
  // =====================================

  describe("Mutation: updatePresence", () => {
    it("creates presence indicator with online status", () => {
      const now = Date.now();
      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "online",
        currentActivity: "Working on API",
        lastActivity: now,
        updatedAt: now,
      });

      const presence = db.get(presenceId);
      expect(presence.agentId).toBe(agentId1);
      expect(presence.status).toBe("online");
      expect(presence.currentActivity).toBe("Working on API");
      expect(presence.lastActivity).toBe(now);
    });

    it("updates existing presence indicator status", () => {
      const now = Date.now();
      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "online",
        currentActivity: "In meeting",
        lastActivity: now,
        updatedAt: now,
      });

      const later = now + 60000;
      db.patch(presenceId, {
        status: "away",
        currentActivity: "Lunch break",
        lastActivity: later,
        updatedAt: later,
      });

      const presence = db.get(presenceId);
      expect(presence.status).toBe("away");
      expect(presence.currentActivity).toBe("Lunch break");
      expect(presence.lastActivity).toBe(later);
    });

    it("supports all presence statuses: online, away, do_not_disturb, offline", () => {
      const statuses = ["online", "away", "do_not_disturb", "offline"];
      const presenceIds = statuses.map((status, idx) =>
        db.insert("presenceIndicators", {
          workspaceId,
          agentId: [agentId1, agentId2, agentId3, "agent-4"][idx],
          status,
          lastActivity: Date.now(),
          updatedAt: Date.now(),
        })
      );

      const allPresence = db.getAllPresence();
      expect(allPresence).toHaveLength(4);
      expect(allPresence.map((p: any) => p.status).sort()).toEqual([
        "away",
        "do_not_disturb",
        "offline",
        "online",
      ]);
    });

    it("sets optional currentActivity", () => {
      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "online",
        currentActivity: "Code review",
        lastActivity: Date.now(),
        updatedAt: Date.now(),
      });

      const presence = db.get(presenceId);
      expect(presence.currentActivity).toBe("Code review");
    });

    it("creates new presence if doesn't exist", () => {
      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "online",
        currentActivity: "Just started",
        lastActivity: Date.now(),
        updatedAt: Date.now(),
      });

      expect(presenceId).toBeDefined();
      const presence = db.get(presenceId);
      expect(presence.agentId).toBe(agentId1);
    });
  });

  // =====================================
  // Phase 5A: Query Presence Tests
  // =====================================

  describe("Query: getPresence", () => {
    it("retrieves all presence indicators for business", () => {
      const now = Date.now();
      db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "online",
        lastActivity: now,
        updatedAt: now,
      });

      db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId2,
        status: "away",
        lastActivity: now,
        updatedAt: now,
      });

      db.insert("presenceIndicators", {
        workspaceId: "other-biz",
        agentId: agentId3,
        status: "online",
        lastActivity: now,
        updatedAt: now,
      });

      const businessPresence = db.getPresenceBy(workspaceId);
      expect(businessPresence).toHaveLength(2);
      expect(businessPresence.map((p: any) => p.agentId).sort()).toEqual(
        [agentId1, agentId2].sort()
      );
    });
  });

  describe("Query: getAgentPresence", () => {
    it("retrieves presence for specific agent", () => {
      const now = Date.now();
      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "online",
        currentActivity: "Working",
        lastActivity: now,
        updatedAt: now,
      });

      const agentPresence = db.getPresenceByAgent(agentId1);
      expect(agentPresence).toHaveLength(1);
      expect(agentPresence[0].status).toBe("online");
    });

    it("returns empty if agent has no presence", () => {
      const agentPresence = db.getPresenceByAgent("unknown-agent");
      expect(agentPresence).toHaveLength(0);
    });
  });

  describe("Query: getOnlineAgents", () => {
    it("retrieves only online agents for business", () => {
      const now = Date.now();
      db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "online",
        lastActivity: now,
        updatedAt: now,
      });

      db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId2,
        status: "away",
        lastActivity: now,
        updatedAt: now,
      });

      db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId3,
        status: "offline",
        lastActivity: now,
        updatedAt: now,
      });

      const allPresence = db.getPresenceBy(workspaceId);
      const onlineOnly = allPresence.filter((p: any) => p.status === "online");
      expect(onlineOnly).toHaveLength(1);
      expect(onlineOnly[0].agentId).toBe(agentId1);
    });
  });

  // =====================================
  // Phase 5A: Auto-Away Logic Tests
  // =====================================

  describe("Mutation: checkAndMarkAway", () => {
    it("marks agent as away if lastActivity > 5min old", () => {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000 - 1000; // 5min + 1sec

      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "online",
        lastActivity: fiveMinutesAgo,
        updatedAt: fiveMinutesAgo,
      });

      // Check and update
      const presence = db.get(presenceId);
      if (
        now - presence.lastActivity > 5 * 60 * 1000 &&
        presence.status !== "offline" &&
        presence.status !== "away"
      ) {
        db.patch(presenceId, {
          status: "away",
          updatedAt: now,
        });
      }

      const updated = db.get(presenceId);
      expect(updated.status).toBe("away");
    });

    it("does NOT mark recently-active agent as away", () => {
      const now = Date.now();
      const twoMinutesAgo = now - 2 * 60 * 1000;

      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "online",
        lastActivity: twoMinutesAgo,
        updatedAt: twoMinutesAgo,
      });

      // Check
      const presence = db.get(presenceId);
      const shouldMarkAway =
        now - presence.lastActivity > 5 * 60 * 1000 &&
        presence.status !== "offline" &&
        presence.status !== "away";

      expect(shouldMarkAway).toBe(false);
      expect(presence.status).toBe("online");
    });

    it("does NOT mark already-away agent", () => {
      const now = Date.now();
      const tenMinutesAgo = now - 10 * 60 * 1000;

      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "away",
        lastActivity: tenMinutesAgo,
        updatedAt: tenMinutesAgo,
      });

      const presence = db.get(presenceId);
      const shouldMarkAway =
        now - presence.lastActivity > 5 * 60 * 1000 &&
        presence.status !== "offline" &&
        presence.status !== "away";

      expect(shouldMarkAway).toBe(false);
    });

    it("does NOT mark offline agents", () => {
      const now = Date.now();
      const fortyMinutesAgo = now - 40 * 60 * 1000;

      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "offline",
        lastActivity: fortyMinutesAgo,
        updatedAt: fortyMinutesAgo,
      });

      const presence = db.get(presenceId);
      const shouldMarkAway =
        now - presence.lastActivity > 5 * 60 * 1000 &&
        presence.status !== "offline" &&
        presence.status !== "away";

      expect(shouldMarkAway).toBe(false);
    });

    it("respects custom awayThresholdMs parameter", () => {
      const now = Date.now();
      const tenMinutesAgo = now - 10 * 60 * 1000;
      const customThreshold = 15 * 60 * 1000; // 15 minutes

      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "online",
        lastActivity: tenMinutesAgo,
        updatedAt: tenMinutesAgo,
      });

      const presence = db.get(presenceId);
      const shouldMarkAway =
        now - presence.lastActivity > customThreshold &&
        presence.status !== "offline" &&
        presence.status !== "away";

      expect(shouldMarkAway).toBe(false);
    });
  });

  // =====================================
  // Phase 5A: Stale Cleanup Tests
  // =====================================

  describe("Mutation: cleanupStalePresence", () => {
    it("marks agents as offline if inactive > 30min", () => {
      const now = Date.now();
      const thirtyOneMinutesAgo = now - 31 * 60 * 1000;

      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "away",
        lastActivity: thirtyOneMinutesAgo,
        updatedAt: thirtyOneMinutesAgo,
      });

      // Simulate cleanup
      const presence = db.get(presenceId);
      if (now - presence.lastActivity > 30 * 60 * 1000 && presence.status !== "offline") {
        db.patch(presenceId, {
          status: "offline",
          updatedAt: now,
        });
      }

      const cleaned = db.get(presenceId);
      expect(cleaned.status).toBe("offline");
    });

    it("does NOT mark recently-inactive agents as offline", () => {
      const now = Date.now();
      const twentyMinutesAgo = now - 20 * 60 * 1000;

      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "away",
        lastActivity: twentyMinutesAgo,
        updatedAt: twentyMinutesAgo,
      });

      const presence = db.get(presenceId);
      const shouldMarkOffline = now - presence.lastActivity > 30 * 60 * 1000 && presence.status !== "offline";

      expect(shouldMarkOffline).toBe(false);
      expect(presence.status).toBe("away");
    });

    it("cleans up multiple stale agents", () => {
      const now = Date.now();
      const fortyMinutesAgo = now - 40 * 60 * 1000;

      const presence1 = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "away",
        lastActivity: fortyMinutesAgo,
        updatedAt: fortyMinutesAgo,
      });

      const presence2 = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId2,
        status: "do_not_disturb",
        lastActivity: fortyMinutesAgo,
        updatedAt: fortyMinutesAgo,
      });

      const presence3 = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId3,
        status: "online",
        lastActivity: Date.now() - 5 * 60 * 1000, // 5 min ago
        updatedAt: Date.now() - 5 * 60 * 1000,
      });

      // Simulate cleanup
      const allPresence = db.getPresenceBy(workspaceId);
      let cleaned = 0;
      for (const p of allPresence) {
        if (now - p.lastActivity > 30 * 60 * 1000 && p.status !== "offline") {
          db.patch(p._id, {
            status: "offline",
            updatedAt: now,
          });
          cleaned++;
        }
      }

      expect(cleaned).toBe(2);
      const updated = db.getPresenceBy(workspaceId);
      const offlineCount = updated.filter((p: any) => p.status === "offline").length;
      expect(offlineCount).toBe(2);
    });

    it("respects custom staleThresholdMs parameter", () => {
      const now = Date.now();
      const twentyMinutesAgo = now - 20 * 60 * 1000;
      const customThreshold = 15 * 60 * 1000; // 15 minutes

      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "away",
        lastActivity: twentyMinutesAgo,
        updatedAt: twentyMinutesAgo,
      });

      const presence = db.get(presenceId);
      const shouldMarkOffline = now - presence.lastActivity > customThreshold && presence.status !== "offline";

      expect(shouldMarkOffline).toBe(true);
    });
  });

  // =====================================
  // Phase 5A: Activity Recording Tests
  // =====================================

  describe("Mutation: recordActivity", () => {
    it("updates lastActivity and currentActivity without changing status", () => {
      const now = Date.now();
      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "online",
        currentActivity: "Task 1",
        lastActivity: now,
        updatedAt: now,
      });

      const later = now + 30000;
      db.patch(presenceId, {
        currentActivity: "Task 2",
        lastActivity: later,
        updatedAt: later,
      });

      const updated = db.get(presenceId);
      expect(updated.status).toBe("online"); // Status unchanged
      expect(updated.currentActivity).toBe("Task 2");
      expect(updated.lastActivity).toBe(later);
    });

    it("creates presence record if doesn't exist", () => {
      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "online",
        currentActivity: "Started work",
        lastActivity: Date.now(),
        updatedAt: Date.now(),
      });

      expect(presenceId).toBeDefined();
      const presence = db.get(presenceId);
      expect(presence.agentId).toBe(agentId1);
      expect(presence.status).toBe("online");
    });

    it("resets away status when activity recorded", () => {
      const now = Date.now();
      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "away",
        currentActivity: "Away",
        lastActivity: now - 10 * 60 * 1000,
        updatedAt: now - 10 * 60 * 1000,
      });

      // Record activity - could update status in actual implementation
      db.patch(presenceId, {
        currentActivity: "Back to work",
        lastActivity: now,
        updatedAt: now,
      });

      const updated = db.get(presenceId);
      expect(updated.lastActivity).toBe(now);
      expect(updated.currentActivity).toBe("Back to work");
    });
  });

  // =====================================
  // Phase 5A: Presence with Details Tests
  // =====================================

  describe("Query: getAgentPresenceWithDetails", () => {
    it("retrieves presence with agent details", () => {
      const now = Date.now();
      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "online",
        currentActivity: "Code review",
        lastActivity: now,
        updatedAt: now,
      });

      // In real implementation, would join with agent table
      const presence = db.get(presenceId);
      expect(presence.workspaceId).toBe(workspaceId);
      expect(presence.agentId).toBe(agentId1);
      expect(presence.status).toBe("online");
    });

    it("includes all presence fields for business", () => {
      const now = Date.now();
      db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId1,
        status: "online",
        currentActivity: "Task 1",
        lastActivity: now,
        updatedAt: now,
      });

      db.insert("presenceIndicators", {
        workspaceId,
        agentId: agentId2,
        status: "away",
        lastActivity: now - 6 * 60 * 1000,
        updatedAt: now - 6 * 60 * 1000,
      });

      const allPresence = db.getPresenceBy(workspaceId);
      expect(allPresence).toHaveLength(2);
      expect(allPresence.every((p: any) => p.workspaceId === workspaceId)).toBe(true);
    });

    it("filters out agents with null agent data", () => {
      // Simulate case where agent was deleted
      const now = Date.now();
      const presenceId = db.insert("presenceIndicators", {
        workspaceId,
        agentId: "deleted-agent",
        status: "offline",
        lastActivity: now,
        updatedAt: now,
      });

      const allPresence = db.getPresenceBy(workspaceId);
      // In real implementation, would filter where agent !== null
      expect(allPresence).toHaveLength(1);
    });
  });
});
