import { v as convexVal } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ApiError, wrapConvexHandler } from "../lib/errors";

/**
 * Document Management
 * Deliverables, research, specs, drafts
 *
 * Phase 1: Error standardization - all mutations now use ApiError with request IDs
 */

// Create document
export const create = mutation({
  args: {
    businessId: convexVal.id("businesses"),  // REQUIRED: business scoping
    title: convexVal.string(),
    content: convexVal.string(),
    type: convexVal.union(
      convexVal.literal("deliverable"),
      convexVal.literal("research"),
      convexVal.literal("protocol"),
      convexVal.literal("spec"),
      convexVal.literal("draft"),
      convexVal.literal("receipt")
    ),
    createdBy: convexVal.string(),
    createdByName: convexVal.string(),
    taskId: convexVal.optional(convexVal.id("tasks")),
  },
  handler: async (ctx, { businessId, title, content, type, createdBy, createdByName, taskId }) => {
    const docId = await ctx.db.insert("documents", {
      businessId,  // ADD: business scoping
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
    businessId: convexVal.id("businesses"),  // REQUIRED: business scoping
    type: convexVal.optional(convexVal.union(
      convexVal.literal("deliverable"),
      convexVal.literal("research"),
      convexVal.literal("protocol"),
      convexVal.literal("spec"),
      convexVal.literal("draft"),
      convexVal.literal("receipt")
    )),
    limit: convexVal.optional(convexVal.number())
  },
  handler: async (ctx, { businessId, type, limit }) => {
    let docs;
    if (type) {
      docs = await ctx.db
        .query("documents")
        .withIndex("by_business", (q: any) => q.eq("businessId", businessId))
        .filter((q: any) => q.eq(q.field("type"), type))
        .order("desc")
        .take(limit || 50);
    } else {
      docs = await ctx.db
        .query("documents")
        .withIndex("by_business", (q: any) => q.eq("businessId", businessId))
        .order("desc")
        .take(limit || 50);
    }

    return docs;
  },
});

// Get document by ID
export const getById = query({
  args: { documentId: convexVal.id("documents") },
  handler: async (ctx, { documentId }) => {
    return await ctx.db.get(documentId);
  },
});

// Update document
export const update = mutation({
  args: {
    documentId: convexVal.id("documents"),
    title: convexVal.optional(convexVal.string()),
    content: convexVal.optional(convexVal.string()),
    updatedBy: convexVal.string(),
  },
  handler: wrapConvexHandler(async (ctx, { documentId, title, content, updatedBy }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc) throw ApiError.notFound('Document', { documentId });

    const updateData: any = {
      updatedAt: Date.now(),
      version: (doc.version || 1) + 1,
    };
    if (title) updateData.title = title;
    if (content) updateData.content = content;

    await ctx.db.patch(documentId, updateData);

    return { success: true };
  }),
});

// Get documents for a task
export const getForTask = query({
  args: { taskId: convexVal.id("tasks") },
  handler: async (ctx, { taskId }) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_task", (q: any) => q.eq("taskId", taskId))
      .order("desc")
      .collect();
  },
});

// Search documents
export const search = query({
  args: { query: convexVal.string(), limit: convexVal.optional(convexVal.number()) },
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
