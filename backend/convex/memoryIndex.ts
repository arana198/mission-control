import { query, mutation } from "./_generated/server";
import { v as convexVal } from "convex/values";

// Get all memory index entries
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("memoryIndex").order("desc").take(100);
  },
});

// Get memory items for a specific entity
export const getByEntity = query({
  args: {
    entityType: convexVal.optional(convexVal.union(
      convexVal.literal("task"),
      convexVal.literal("event"),
      convexVal.literal("note")
    )),
    entityId: convexVal.optional(convexVal.string()),
  },
  handler: async (ctx, args) => {
    const entityType = args.entityType;
    const entityId = args.entityId;
    if (entityType && entityId) {
      return await ctx.db
        .query("memoryIndex")
        .withIndex("by_entity", (indexQuery) =>
          indexQuery.eq("entityType", entityType).eq("entityId", entityId)
        )
        .take(20);
    }
    return [];
  },
});

// Search memories by keyword
export const search = query({
  args: { query: convexVal.string() },
  handler: async (ctx, args) => {
    const allMemories = await ctx.db.query("memoryIndex").take(200);
    const normalizedQuery = args.query.toLowerCase();

    return allMemories.filter(m =>
      m.memoryPath.toLowerCase().includes(normalizedQuery) ||
      m.keywords.some(k => k.toLowerCase().includes(normalizedQuery))
    );
  },
});

// Link a memory to an entity
export const linkMemory = mutation({
  args: {
    entityType: convexVal.union(
      convexVal.literal("task"),
      convexVal.literal("event"),
      convexVal.literal("note")
    ),
    entityId: convexVal.string(),
    memoryPath: convexVal.string(),
    keywords: convexVal.array(convexVal.string()),
    relatedMemoryPaths: convexVal.optional(convexVal.array(convexVal.string())),
  },
  handler: async (ctx, args) => {
    // Check if link already exists
    const existing = await ctx.db
      .query("memoryIndex")
      .withIndex("by_entity", (indexQuery) =>
        indexQuery.eq("entityType", args.entityType).eq("entityId", args.entityId)
      )
      .filter((filterQuery) => filterQuery.eq(filterQuery.field("memoryPath"), args.memoryPath))
      .first();
    
    if (existing) {
      // Update keywords
      const newKeywords = [...new Set([...existing.keywords, ...args.keywords])];
      await ctx.db.patch(existing._id, {
        keywords: newKeywords,
        lastSynced: Date.now(),
      });
      return existing._id;
    }
    
    // Create new link
    return await ctx.db.insert("memoryIndex", {
      ...args,
      relatedMemoryPaths: args.relatedMemoryPaths || [],
      lastSynced: Date.now(),
    });
  },
});

// Unlink a memory from an entity
export const unlinkMemory = mutation({
  args: { id: convexVal.id("memoryIndex") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Get memory paths (grouped)
export const getMemoryPaths = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("memoryIndex").take(500);
    const paths = [...new Set(all.map(m => m.memoryPath))];
    return paths.sort();
  },
});

// Find related memories (by keywords or paths)
export const findRelated = query({
  args: { memoryPath: convexVal.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("memoryIndex").take(200);
    const target = all.find(m => m.memoryPath === args.memoryPath);

    if (!target) return [];

    return all
      .filter(m => m.memoryPath !== args.memoryPath && (
        m.keywords.some(k => target.keywords.includes(k)) ||
        m.relatedMemoryPaths.includes(args.memoryPath)
      ))
      .slice(0, 10);
  },
});

/**
 * FRONTEND COMPATIBILITY ALIASES
 * These aliases map frontend route expectations to actual backend implementations
 * Phase 1: Convex API alignment (1% final verification)
 */

// Alias: listMemory -> getAll
export const listMemory = query({
  handler: async (ctx) => {
    return await ctx.db.query("memoryIndex").take(200);
  },
});

// Alias: getMemory -> getByEntity (or single by ID)
export const getMemory = query({
  args: { memoryId: convexVal.optional(convexVal.id("memoryIndex")) },
  handler: async (ctx, { memoryId }) => {
    if (memoryId) {
      return await ctx.db.get(memoryId);
    }
    return null;
  },
});

// Add: createMemory (missing in original)
export const createMemory = mutation({
  args: {
    entityName: convexVal.string(),
    entityType: convexVal.union(convexVal.literal("task"), convexVal.literal("event"), convexVal.literal("note")),
    content: convexVal.string(),
    entityId: convexVal.optional(convexVal.string()),
    keywords: convexVal.optional(convexVal.array(convexVal.string())),
    memoryPath: convexVal.optional(convexVal.string()),
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
  },
  handler: async (ctx, { entityName, entityType, content, entityId, keywords = [], memoryPath, workspaceId }) => {
    const memoryId = await ctx.db.insert("memoryIndex", {
      entityType,
      entityId: entityId || "",
      keywords,
      memoryPath: memoryPath || `${entityType}/${entityName}`,
      relatedMemoryPaths: [],
      lastSynced: Date.now(),
    });

    return await ctx.db.get(memoryId);
  },
});

// Add: updateMemory (missing in original)
export const updateMemory = mutation({
  args: {
    memoryId: convexVal.id("memoryIndex"),
    content: convexVal.optional(convexVal.string()),
    keywords: convexVal.optional(convexVal.array(convexVal.string())),
  },
  handler: async (ctx, { memoryId, content, keywords }) => {
    const memory = await ctx.db.get(memoryId);
    if (!memory) return null;

    const updates: any = { lastUpdated: Date.now() };
    if (content !== undefined) updates.content = content;
    if (keywords !== undefined) updates.keywords = keywords;

    await ctx.db.patch(memoryId, updates);
    return await ctx.db.get(memoryId);
  },
});

// Add: deleteMemory (missing in original)
export const deleteMemory = mutation({
  args: { memoryId: convexVal.id("memoryIndex") },
  handler: async (ctx, { memoryId }) => {
    const memory = await ctx.db.get(memoryId);
    if (!memory) return { success: false, error: "Memory not found" };

    await ctx.db.delete(memoryId);
    return { success: true, deletedMemoryId: memoryId };
  },
});
