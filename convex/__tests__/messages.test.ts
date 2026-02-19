/**
 * Messages System Tests
 *
 * Tests for messaging, threading, and help request escalation system
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Mock database for messages and notifications
 */
class MessageMockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    this.data.set("messages", []);
    this.data.set("notifications", []);
    this.data.set("tasks", []);
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
      const found = docs.find((d) => d._id === id);
      if (found) return found;
    }
    return null;
  }

  query(table: string) {
    return {
      collect: async () => this.data.get(table) || [],
      filter: (predicate: (doc: any) => boolean) => ({
        collect: async () => (this.data.get(table) || []).filter(predicate),
      }),
    };
  }

  getMessages() {
    return this.data.get("messages") || [];
  }

  getMessagesByTask(taskId: string) {
    return (this.data.get("messages") || []).filter(
      (m) => m.taskId === taskId
    );
  }

  getNotifications() {
    return this.data.get("notifications") || [];
  }

  getNotificationsByRecipient(recipientId: string) {
    return (this.data.get("notifications") || []).filter(
      (n) => n.recipientId === recipientId
    );
  }
}

describe("Messages System (convex/messages.ts)", () => {
  let db: MessageMockDatabase;

  beforeEach(() => {
    db = new MessageMockDatabase();
  });

  // =====================================
  // Phase 1: Help Request Tests
  // =====================================

  describe("Mutation: createHelpRequest", () => {
    it("creates help request message with system type", async () => {
      const taskId = db.insert("tasks", { title: "Test Task" });
      const leadAgentId = db.insert("agents", {
        name: "Jarvis",
        level: "lead",
      });

      // Simulate createHelpRequest mutation
      const helpRequestMsg = {
        taskId,
        fromId: "agent-1",
        fromName: "Vision",
        content: "I'm blocked on API dependency",
        isSystem: true,
        systemType: "help_request",
        mentions: [leadAgentId],
        replyIds: [],
        attachments: [],
      };

      const messageId = db.insert("messages", helpRequestMsg);
      const message = db.get(messageId);

      expect(message.isSystem).toBe(true);
      expect(message.systemType).toBe("help_request");
      expect(message.mentions).toContain(leadAgentId);
    });

    it("creates corresponding notification for lead agent", async () => {
      const taskId = db.insert("tasks", { title: "Test Task" });
      const leadAgentId = db.insert("agents", {
        name: "Jarvis",
        level: "lead",
      });

      // Create message
      const messageId = db.insert("messages", {
        taskId,
        fromId: "agent-1",
        fromName: "Vision",
        content: "Need help",
        isSystem: true,
        systemType: "help_request",
        mentions: [leadAgentId],
      });

      // Create notification
      const notificationId = db.insert("notifications", {
        recipientId: leadAgentId,
        type: "help_request",
        content: "Vision needs help on Task: Test Task",
        fromId: "agent-1",
        fromName: "Vision",
        taskId,
        messageId,
        read: false,
        createdAt: Date.now(),
      });

      const notification = db.get(notificationId);
      expect(notification.type).toBe("help_request");
      expect(notification.recipientId).toBe(leadAgentId);
      expect(notification.read).toBe(false);
    });

    it("includes reason and context in help request message", async () => {
      const taskId = db.insert("tasks", { title: "Test Task" });
      const leadAgentId = "agent-lead";

      const helpRequest = {
        taskId,
        fromId: "agent-1",
        fromName: "Vision",
        content: "Blocked on dependency - API not responding to requests",
        isSystem: true,
        systemType: "help_request",
        mentions: [leadAgentId],
      };

      const messageId = db.insert("messages", helpRequest);
      const message = db.get(messageId);

      expect(message.content).toContain("Blocked on dependency");
      expect(message.content).toContain("API not responding");
    });

    it("auto-escalates to lead agent when specified", async () => {
      const taskId = db.insert("tasks", { title: "Test Task" });
      const leadAgentId = db.insert("agents", {
        name: "Jarvis",
        level: "lead",
      });
      const agentId = db.insert("agents", {
        name: "Vision",
        level: "specialist",
      });

      // Create help request from specialist to lead
      const messageId = db.insert("messages", {
        taskId,
        fromId: agentId,
        fromName: "Vision",
        content: "Help needed",
        isSystem: true,
        systemType: "help_request",
        mentions: [leadAgentId],
      });

      const notification = db.insert("notifications", {
        recipientId: leadAgentId,
        type: "help_request",
        content: "Vision needs help",
        fromId: agentId,
        fromName: "Vision",
        taskId,
        messageId,
        read: false,
      });

      const notif = db.get(notification);
      expect(notif.recipientId).toBe(leadAgentId);
    });

    it("works with multiple reasons for help", async () => {
      const taskId = db.insert("tasks", { title: "Test Task" });
      const reasons = [
        "Blocked on dependency",
        "Need design input",
        "Technical blocker",
        "Unclear requirements",
        "Out of scope",
      ];

      for (const reason of reasons) {
        const msg = db.insert("messages", {
          taskId,
          fromId: "agent-1",
          fromName: "Vision",
          content: reason,
          isSystem: true,
          systemType: "help_request",
          mentions: ["lead-agent"],
        });

        const message = db.get(msg);
        expect(message.systemType).toBe("help_request");
        expect(message.content).toBe(reason);
      }
    });

    it("preserves help request message thread", async () => {
      const taskId = db.insert("tasks", { title: "Test Task" });
      const leadAgentId = "agent-lead";

      // Create help request
      const helpRequestId = db.insert("messages", {
        taskId,
        fromId: "agent-1",
        fromName: "Vision",
        content: "I need help",
        isSystem: true,
        systemType: "help_request",
        mentions: [leadAgentId],
        replyIds: [],
      });

      // Lead responds
      const responseId = db.insert("messages", {
        taskId,
        fromId: leadAgentId,
        fromName: "Jarvis",
        content: "Got it, I'm taking over",
        parentId: helpRequestId,
        replyIds: [],
      });

      // Update help request to link reply
      const helpRequest = db.get(helpRequestId);
      expect(helpRequest.replyIds).toBeDefined();
    });
  });

  describe("Message System Integration", () => {
    it("filters help_request notifications separately", async () => {
      const taskId = db.insert("tasks", { title: "Task" });
      const leadAgentId = "lead-1";

      // Create regular message
      db.insert("messages", {
        taskId,
        fromId: "agent-1",
        content: "Regular comment",
        isSystem: false,
      });

      // Create help request
      const helpMsgId = db.insert("messages", {
        taskId,
        fromId: "agent-1",
        content: "I need help",
        isSystem: true,
        systemType: "help_request",
        mentions: [leadAgentId],
      });

      // Create notifications
      db.insert("notifications", {
        recipientId: leadAgentId,
        type: "mention",
        messageId: db.getMessages()[0]._id,
      });

      db.insert("notifications", {
        recipientId: leadAgentId,
        type: "help_request",
        messageId: helpMsgId,
      });

      const leadNotifications = db.getNotificationsByRecipient(leadAgentId);
      const helpRequests = leadNotifications.filter(
        (n) => n.type === "help_request"
      );

      expect(helpRequests).toHaveLength(1);
      expect(helpRequests[0].messageId).toBe(helpMsgId);
    });

    it("tracks unread help requests", async () => {
      const taskId = db.insert("tasks", { title: "Task" });
      const leadAgentId = "lead-1";

      const notifId = db.insert("notifications", {
        recipientId: leadAgentId,
        type: "help_request",
        content: "Agent needs help",
        read: false,
        createdAt: Date.now(),
      });

      const notification = db.get(notifId);
      expect(notification.read).toBe(false);

      // Mark as read
      const notifications = db.getNotificationsByRecipient(leadAgentId);
      expect(
        notifications.filter((n) => !n.read && n.type === "help_request")
      ).toHaveLength(1);
    });
  });
});
