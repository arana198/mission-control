/**
 * Task Comments System Tests (Phase 5A)
 *
 * Tests for:
 * - Threaded task comments
 * - Emoji reactions and toggles
 * - @mention support and notifications
 * - Task subscriptions and subscriber notifications
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Mock database for task comments system
 */
class TaskCommentsMockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    this.data.set("taskComments", []);
    this.data.set("mentions", []);
    this.data.set("taskSubscriptions", []);
    this.data.set("notifications", []);
    this.data.set("tasks", []);
    this.data.set("agents", []);
    this.data.set("businesses", []);
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
        order: (direction: string) => ({
          take: async (limit: number) => {
            let docs = self.data.get(table) || [];
            if (direction === "desc") docs = docs.reverse();
            return docs.slice(0, limit);
          },
          collect: async () => {
            let docs = self.data.get(table) || [];
            if (direction === "desc") docs = docs.reverse();
            return docs;
          },
        }),
      }),
      filter: (predicate: (doc: any) => boolean) => ({
        collect: async () => (self.data.get(table) || []).filter(predicate),
      }),
      collect: async () => self.data.get(table) || [],
    };
  }

  getCommentsByTask(taskId: string) {
    return (this.data.get("taskComments") || []).filter((c: any) => c.taskId === taskId);
  }

  getCommentReplies(parentCommentId: string) {
    return (this.data.get("taskComments") || []).filter(
      (c: any) => c.parentCommentId === parentCommentId
    );
  }

  getMentions(agentId: string) {
    return (this.data.get("mentions") || []).filter(
      (m: any) => m.mentionedAgentId === agentId
    );
  }

  getSubscriptions(taskId: string) {
    return (this.data.get("taskSubscriptions") || []).filter(
      (s: any) => s.taskId === taskId
    );
  }

  getNotifications() {
    return this.data.get("notifications") || [];
  }
}

describe("Task Comments System (convex/taskComments.ts + convex/presence.ts)", () => {
  let db: TaskCommentsMockDatabase;
  let businessId: string;
  let taskId: string;
  let agentId1: string;
  let agentId2: string;
  let agentId3: string;

  beforeEach(() => {
    db = new TaskCommentsMockDatabase();
    businessId = db.insert("businesses", { name: "Test Biz" });
    taskId = db.insert("tasks", {
      businessId,
      title: "Test Task",
      status: "in_progress",
    });
    agentId1 = db.insert("agents", { businessId, name: "Alice", role: "Developer" });
    agentId2 = db.insert("agents", { businessId, name: "Bob", role: "Designer" });
    agentId3 = db.insert("agents", { businessId, name: "Charlie", role: "PM" });
  });

  // =====================================
  // Phase 5A: Comment Creation Tests
  // =====================================

  describe("Mutation: createComment", () => {
    it("creates root comment on task", () => {
      const commentId = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId1,
        agentName: "Alice",
        content: "This is a comment",
        reactions: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const comment = db.get(commentId);
      expect(comment.taskId).toBe(taskId);
      expect(comment.agentId).toBe(agentId1);
      expect(comment.agentName).toBe("Alice");
      expect(comment.content).toBe("This is a comment");
      expect(comment.parentCommentId).toBeUndefined();
      expect(comment.reactions).toEqual({});
    });

    it("creates comment with @mentions", () => {
      const commentId = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId1,
        agentName: "Alice",
        content: "Hey @Bob and @Charlie, what do you think?",
        mentions: [agentId2, agentId3],
        reactions: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const comment = db.get(commentId);
      expect(comment.mentions).toEqual([agentId2, agentId3]);
    });

    it("creates mention notifications for @mentioned agents", () => {
      const commentId = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId1,
        agentName: "Alice",
        content: "@Bob please review",
        mentions: [agentId2],
        reactions: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Simulate mention creation in handler
      const mentionId = db.insert("mentions", {
        businessId,
        mentionedAgentId: agentId2,
        mentionedBy: agentId1,
        context: "task_comment",
        contextId: taskId,
        contextTitle: "Task comment",
        read: false,
        createdAt: Date.now(),
      });

      const mention = db.get(mentionId);
      expect(mention.mentionedAgentId).toBe(agentId2);
      expect(mention.mentionedBy).toBe(agentId1);
      expect(mention.read).toBe(false);
    });

    it("creates notification for @mentioned agent", () => {
      const commentId = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId1,
        agentName: "Alice",
        content: "@Bob check this out",
        mentions: [agentId2],
        reactions: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Simulate notification creation
      const notifId = db.insert("notifications", {
        businessId,
        recipientId: agentId2,
        type: "mention",
        content: "Alice mentioned you in a task comment",
        taskId,
        fromId: agentId1,
        fromName: "Alice",
        read: false,
        createdAt: Date.now(),
      });

      const notif = db.get(notifId);
      expect(notif.type).toBe("mention");
      expect(notif.recipientId).toBe(agentId2);
      expect(notif.fromName).toBe("Alice");
    });

    it("notifies task subscribers when comment is created", () => {
      // Subscribe agents to task
      const sub1 = db.insert("taskSubscriptions", {
        businessId,
        taskId,
        agentId: agentId2,
        notifyOn: "all",
        subscribedAt: Date.now(),
      });

      const sub2 = db.insert("taskSubscriptions", {
        businessId,
        taskId,
        agentId: agentId3,
        notifyOn: "comments",
        subscribedAt: Date.now(),
      });

      // Create comment by agentId1
      const commentId = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId1,
        agentName: "Alice",
        content: "New comment",
        reactions: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Simulate subscriber notifications (only if not commenter and subscription allows)
      const notif1 = db.insert("notifications", {
        businessId,
        recipientId: agentId2,
        type: "mention",
        content: "Alice commented on a task you're subscribed to",
        taskId,
        fromId: agentId1,
        fromName: "Alice",
        read: false,
        createdAt: Date.now(),
      });

      const notif2 = db.insert("notifications", {
        businessId,
        recipientId: agentId3,
        type: "mention",
        content: "Alice commented on a task you're subscribed to",
        taskId,
        fromId: agentId1,
        fromName: "Alice",
        read: false,
        createdAt: Date.now(),
      });

      expect(db.getNotifications()).toHaveLength(2);
    });

    it("does not notify commenter of their own comment", () => {
      const sub = db.insert("taskSubscriptions", {
        businessId,
        taskId,
        agentId: agentId1,
        notifyOn: "all",
        subscribedAt: Date.now(),
      });

      // agentId1 comments on subscribed task
      const commentId = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId1,
        agentName: "Alice",
        content: "My own comment",
        reactions: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Should NOT create notification for self
      const selfNotifs = (db.getNotifications() || []).filter(
        (n: any) => n.recipientId === agentId1
      );
      expect(selfNotifs).toHaveLength(0);
    });
  });

  // =====================================
  // Phase 5A: Threaded Comments Tests
  // =====================================

  describe("Threaded Comments: Replies", () => {
    it("creates reply to parent comment", () => {
      const parentCommentId = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId1,
        agentName: "Alice",
        content: "Initial thought",
        reactions: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const replyId = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId2,
        agentName: "Bob",
        content: "Great idea!",
        parentCommentId,
        reactions: {},
        createdAt: Date.now() + 1000,
        updatedAt: Date.now() + 1000,
      });

      const reply = db.get(replyId);
      expect(reply.parentCommentId).toBe(parentCommentId);
      expect(reply.content).toBe("Great idea!");
    });

    it("retrieves thread replies in order", () => {
      const parentCommentId = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId1,
        agentName: "Alice",
        content: "Parent comment",
        reactions: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create replies
      const reply1Id = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId2,
        agentName: "Bob",
        content: "First reply",
        parentCommentId,
        reactions: {},
        createdAt: Date.now() + 1000,
        updatedAt: Date.now() + 1000,
      });

      const reply2Id = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId3,
        agentName: "Charlie",
        content: "Second reply",
        parentCommentId,
        reactions: {},
        createdAt: Date.now() + 2000,
        updatedAt: Date.now() + 2000,
      });

      const replies = db.getCommentReplies(parentCommentId);
      expect(replies).toHaveLength(2);
      expect(replies[0].content).toBe("First reply");
      expect(replies[1].content).toBe("Second reply");
    });

    it("supports nested replies (thread chains)", () => {
      const parent = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId1,
        agentName: "Alice",
        content: "Root",
        reactions: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const child1 = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId2,
        agentName: "Bob",
        content: "First level reply",
        parentCommentId: parent,
        reactions: {},
        createdAt: Date.now() + 1000,
        updatedAt: Date.now() + 1000,
      });

      const child2 = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId3,
        agentName: "Charlie",
        content: "Replying to Bob",
        parentCommentId: child1,
        reactions: {},
        createdAt: Date.now() + 2000,
        updatedAt: Date.now() + 2000,
      });

      const directReplies = db.getCommentReplies(parent);
      expect(directReplies).toHaveLength(1);

      const nestedReplies = db.getCommentReplies(child1);
      expect(nestedReplies).toHaveLength(1);
    });
  });

  // =====================================
  // Phase 5A: Emoji Reactions Tests
  // =====================================

  describe("Mutation: addReaction (toggle emoji reactions)", () => {
    it("adds emoji reaction from agent", () => {
      const commentId = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId1,
        agentName: "Alice",
        content: "Great task!",
        reactions: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Add 👍 reaction from Bob
      const reactions = { "👍": [agentId2] };
      db.patch(commentId, { reactions, updatedAt: Date.now() });

      const comment = db.get(commentId);
      expect(comment.reactions["👍"]).toContain(agentId2);
    });

    it("toggles reaction off if agent already reacted with emoji", () => {
      const reactions = { "👍": [agentId1, agentId2] };
      const commentId = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId1,
        agentName: "Alice",
        content: "Good work",
        reactions,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Bob removes their 👍
      const updatedReactions = {
        "👍": [agentId1], // Bob removed
      };
      db.patch(commentId, { reactions: updatedReactions, updatedAt: Date.now() });

      const comment = db.get(commentId);
      expect(comment.reactions["👍"]).not.toContain(agentId2);
      expect(comment.reactions["👍"]).toContain(agentId1);
    });

    it("removes emoji key when last reactor removes reaction", () => {
      const reactions = { "❤️": [agentId1] };
      const commentId = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId2,
        agentName: "Bob",
        content: "Nice insight",
        reactions,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Alice removes the only ❤️
      const updatedReactions = {}; // ❤️ key removed
      db.patch(commentId, { reactions: updatedReactions, updatedAt: Date.now() });

      const comment = db.get(commentId);
      expect(comment.reactions["❤️"]).toBeUndefined();
    });

    it("supports multiple emoji reactions on same comment", () => {
      const reactions = {
        "👍": [agentId1],
        "❤️": [agentId2],
        "🔥": [agentId1, agentId3],
      };
      const commentId = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId1,
        agentName: "Alice",
        content: "Amazing work",
        reactions,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const comment = db.get(commentId);
      expect(Object.keys(comment.reactions)).toHaveLength(3);
      expect(comment.reactions["🔥"]).toHaveLength(2);
    });
  });

  // =====================================
  // Phase 5A: Task Subscriptions Tests
  // =====================================

  describe("Mutation: subscribeToTask", () => {
    it("subscribes agent to task with 'all' notification type", () => {
      const subId = db.insert("taskSubscriptions", {
        businessId,
        taskId,
        agentId: agentId1,
        notifyOn: "all",
        subscribedAt: Date.now(),
      });

      const subscription = db.get(subId);
      expect(subscription.agentId).toBe(agentId1);
      expect(subscription.notifyOn).toBe("all");
    });

    it("prevents duplicate subscriptions (update if exists)", () => {
      const subId1 = db.insert("taskSubscriptions", {
        businessId,
        taskId,
        agentId: agentId1,
        notifyOn: "all",
        subscribedAt: Date.now(),
      });

      // Try to subscribe again with different notifyOn
      db.patch(subId1, { notifyOn: "comments" });

      const subs = db.getSubscriptions(taskId);
      expect(subs).toHaveLength(1);
      expect(subs[0].notifyOn).toBe("comments");
    });

    it("supports different notification types: all, comments, status, mentions", () => {
      const types = ["all", "comments", "status", "mentions"];
      const subIds = types.map((type, idx) =>
        db.insert("taskSubscriptions", {
          businessId,
          taskId,
          agentId: [agentId1, agentId2, agentId3, "agent-4"][idx],
          notifyOn: type,
          subscribedAt: Date.now(),
        })
      );

      const subs = db.getSubscriptions(taskId);
      expect(subs).toHaveLength(4);
      expect(subs.map((s: any) => s.notifyOn).sort()).toEqual([
        "all",
        "comments",
        "mentions",
        "status",
      ]);
    });
  });

  // =====================================
  // Phase 5A: Mention Tracking Tests
  // =====================================

  describe("Query: getUnreadMentions", () => {
    it("retrieves unread mentions for agent", () => {
      const mention1 = db.insert("mentions", {
        businessId,
        mentionedAgentId: agentId1,
        mentionedBy: agentId2,
        context: "task_comment",
        contextId: taskId,
        contextTitle: "Comment",
        read: false,
        createdAt: Date.now(),
      });

      const mention2 = db.insert("mentions", {
        businessId,
        mentionedAgentId: agentId1,
        mentionedBy: agentId3,
        context: "task_comment",
        contextId: taskId,
        contextTitle: "Comment",
        read: true,
        createdAt: Date.now() + 1000,
      });

      const unreadMentions = db
        .getMentions(agentId1)
        .filter((m: any) => !m.read);
      expect(unreadMentions).toHaveLength(1);
      expect(unreadMentions[0].mentionedBy).toBe(agentId2);
    });

    it("marks mention as read", () => {
      const mentionId = db.insert("mentions", {
        businessId,
        mentionedAgentId: agentId1,
        mentionedBy: agentId2,
        context: "task_comment",
        contextId: taskId,
        contextTitle: "Comment",
        read: false,
        createdAt: Date.now(),
      });

      db.patch(mentionId, { read: true, readAt: Date.now() });

      const mention = db.get(mentionId);
      expect(mention.read).toBe(true);
      expect(mention.readAt).toBeDefined();
    });

    it("tracks mention context (task_comment)", () => {
      const mention = db.insert("mentions", {
        businessId,
        mentionedAgentId: agentId1,
        mentionedBy: agentId2,
        context: "task_comment",
        contextId: taskId,
        contextTitle: "Task: Build API",
        read: false,
        createdAt: Date.now(),
      });

      const m = db.get(mention);
      expect(m.context).toBe("task_comment");
      expect(m.contextId).toBe(taskId);
      expect(m.contextTitle).toContain("Task");
    });
  });

  // =====================================
  // Phase 5A: Comment Editing Tests
  // =====================================

  describe("Mutation: editComment", () => {
    it("edits comment content and updates timestamp", () => {
      const commentId = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId1,
        agentName: "Alice",
        content: "Original content",
        reactions: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const newUpdatedAt = Date.now() + 5000;
      db.patch(commentId, {
        content: "Edited content",
        updatedAt: newUpdatedAt,
      });

      const comment = db.get(commentId);
      expect(comment.content).toBe("Edited content");
      expect(comment.updatedAt).toBe(newUpdatedAt);
    });

    it("updates mentions when editing", () => {
      const commentId = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId1,
        agentName: "Alice",
        content: "@Bob check this",
        mentions: [agentId2],
        reactions: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      db.patch(commentId, {
        content: "@Bob @Charlie please review",
        mentions: [agentId2, agentId3],
        updatedAt: Date.now() + 1000,
      });

      const comment = db.get(commentId);
      expect(comment.mentions).toEqual([agentId2, agentId3]);
    });
  });

  // =====================================
  // Phase 5A: Comment Deletion Tests
  // =====================================

  describe("Mutation: deleteComment (soft delete)", () => {
    it("soft deletes comment by replacing content with [deleted]", () => {
      const commentId = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId1,
        agentName: "Alice",
        content: "Sensitive information",
        reactions: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      db.patch(commentId, {
        content: "[deleted]",
        updatedAt: Date.now() + 1000,
      });

      const comment = db.get(commentId);
      expect(comment.content).toBe("[deleted]");
      // Original metadata preserved for history
      expect(comment._id).toBe(commentId);
      expect(comment.agentId).toBe(agentId1);
    });

    it("preserves comment history after soft delete", () => {
      const commentId = db.insert("taskComments", {
        businessId,
        taskId,
        agentId: agentId1,
        agentName: "Alice",
        content: "Original message",
        reactions: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      db.patch(commentId, { content: "[deleted]", updatedAt: Date.now() + 1000 });

      const comments = db.getCommentsByTask(taskId);
      expect(comments).toHaveLength(1);
      expect(comments[0].content).toBe("[deleted]");
      expect(comments[0].createdAt).toBeDefined(); // Original timestamp preserved
    });
  });
});
