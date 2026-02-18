import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
    entityType: v.optional(v.union(
      v.literal("goal"),
      v.literal("task"),
      v.literal("event"),
      v.literal("note")
    )),
    entityId: v.optional(v.string()),
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
  args: { query: v.string() },
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
    entityType: v.union(
      v.literal("goal"),
      v.literal("task"),
      v.literal("event"),
      v.literal("note")
    ),
    entityId: v.string(),
    memoryPath: v.string(),
    keywords: v.array(v.string()),
    relatedMemoryPaths: v.optional(v.array(v.string())),
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
  args: { id: v.id("memoryIndex") },
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
  args: { memoryPath: v.string() },
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
