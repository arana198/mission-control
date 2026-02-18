import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Document Management
 * Deliverables, research, specs, drafts
 */

// Create document
export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    type: v.union(
      v.literal("deliverable"),
      v.literal("research"),
      v.literal("protocol"),
      v.literal("spec"),
      v.literal("draft"),
      v.literal("receipt")
    ),
    createdBy: v.string(),
    createdByName: v.string(),
    taskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, { title, content, type, createdBy, createdByName, taskId }) => {
    const docId = await ctx.db.insert("documents", {
      title,
      content,
      type,
      taskId,
      createdBy,
      createdByName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });

    return docId;
  },
});

// Get all documents
export const getAll = query({
  args: {
    type: v.optional(v.union(
      v.literal("deliverable"),
      v.literal("research"),
      v.literal("protocol"),
      v.literal("spec"),
      v.literal("draft"),
      v.literal("receipt")
    )),
    limit: v.optional(v.number())
  },
  handler: async (ctx, { type, limit }) => {
    let docs;
    if (type) {
      docs = await ctx.db
        .query("documents")
        .withIndex("by_type", (q) => q.eq("type", type))
        .order("desc")
        .take(limit || 50);
    } else {
      docs = await ctx.db.query("documents").order("desc").take(limit || 50);
    }

    return docs;
  },
});

// Get document by ID
export const getById = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    return await ctx.db.get(documentId);
  },
});

// Update document
export const update = mutation({
  args: {
    documentId: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    updatedBy: v.string(),
  },
  handler: async (ctx, { documentId, title, content, updatedBy }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc) throw new Error("Document not found");

    const updateData: any = {
      updatedAt: Date.now(),
      version: (doc.version || 1) + 1,
    };
    if (title) updateData.title = title;
    if (content) updateData.content = content;

    await ctx.db.patch(documentId, updateData);

    return { success: true };
  },
});

// Get documents for a task
export const getForTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .order("desc")
      .collect();
  },
});

// Search documents
export const search = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { query, limit }) => {
    const allDocs = await ctx.db.query("documents").take(200);
    const lowerQuery = query.toLowerCase();

    return allDocs
      .filter(
        (doc) =>
          doc.title.toLowerCase().includes(lowerQuery) ||
          doc.content.toLowerCase().includes(lowerQuery)
      )
      .slice(0, limit || 20);
  },
});
