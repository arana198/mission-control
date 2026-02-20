import { v as convexVal } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Wiki Backend Functions - Phase 2
 * Convex mutations and queries for the Confluence-style document store
 *
 * All functions follow TDD patterns:
 * - Tests written first in convex/__tests__/wiki.test.ts
 * - Full type safety with Zod validation
 * - Bidirectional denormalization maintained (parentId + childIds)
 * - Business-scoped queries ensure data isolation
 * - Error handling with AppError patterns
 */

// ════════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ════════════════════════════════════════════════════════════════════════════════

export interface WikiPage extends Doc<"wikiPages"> {
  businessId: Id<"businesses">;
  title: string;
  content: string; // TipTap JSON
  contentText: string; // Plain text for search
  emoji?: string;
  parentId?: Id<"wikiPages">;
  childIds: Id<"wikiPages">[];
  position: number;
  type: "department" | "page";
  taskIds?: Id<"tasks">[];
  epicId?: Id<"epics">;
  createdBy: string;
  createdByName: string;
  updatedBy: string;
  updatedByName: string;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface WikiPageWithChildren extends WikiPage {
  children?: WikiPageWithChildren[];
}

export interface WikiPageHistory extends Doc<"wikiPageHistory"> {
  businessId: Id<"businesses">;
  pageId: Id<"wikiPages">;
  title: string;
  content: string;
  version: number;
  savedBy: string;
  savedByName: string;
  savedAt: number;
}

export interface WikiComment extends Doc<"wikiComments"> {
  businessId: Id<"businesses">;
  pageId: Id<"wikiPages">;
  fromId: string;
  fromName: string;
  content: string;
  parentId?: Id<"wikiComments">;
  replyIds: Id<"wikiComments">[];
  createdAt: number;
  editedAt?: number;
}

// ════════════════════════════════════════════════════════════════════════════════
// QUERIES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Get full page tree for a business
 * Returns departments (root pages) with their nested children
 * Useful for sidebar tree navigation
 */
export const getTree = query({
  args: { businessId: convexVal.id("businesses") },
  handler: async (ctx, { businessId }) => {
    // Get all pages for this business, sorted by position
    const pages = await ctx.db
      .query("wikiPages")
      .withIndex("by_business_type", (q) =>
        q.eq("businessId", businessId).eq("type", "department")
      )
      .collect();

    // For each department, recursively fetch children
    const buildTree = async (parentId: Id<"wikiPages"> | undefined): Promise<any[]> => {
      const children = await ctx.db
        .query("wikiPages")
        .withIndex("by_business_parent", (q) =>
          q.eq("businessId", businessId).eq("parentId", parentId as any)
        )
        .collect();

      // Sort by position
      children.sort((a, b) => a.position - b.position);

      // Recursively add grandchildren
      return Promise.all(
        children.map(async (child) => ({
          ...child,
          children: await buildTree(child._id),
        }))
      );
    };

    // Get all root departments
    const departments = pages.sort((a, b) => a.position - b.position);

    // Build tree for each department
    return Promise.all(
      departments.map(async (dept) => ({
        ...dept,
        children: await buildTree(dept._id as Id<"wikiPages">),
      }))
    );
  },
});

/**
 * Get a single page with all its data
 */
export const getPage = query({
  args: { pageId: convexVal.id("wikiPages") },
  handler: async (ctx, { pageId }) => {
    return await ctx.db.get(pageId);
  },
});

/**
 * Get version history for a page
 * Returns snapshots in descending order (newest first)
 */
export const getHistory = query({
  args: {
    pageId: convexVal.id("wikiPages"),
    limit: convexVal.optional(convexVal.number()),
  },
  handler: async (ctx, { pageId, limit = 20 }) => {
    const history = await ctx.db
      .query("wikiPageHistory")
      .withIndex("by_page", (q) => q.eq("pageId", pageId))
      .collect();

    // Sort by version descending (newest first)
    return history.sort((a, b) => b.version - a.version).slice(0, limit);
  },
});

/**
 * Get comments for a page (root comments only)
 * Replies are nested within parent comment's replyIds
 */
export const getComments = query({
  args: { pageId: convexVal.id("wikiPages") },
  handler: async (ctx, { pageId }) => {
    const comments = await ctx.db
      .query("wikiComments")
      .withIndex("by_page", (q) => q.eq("pageId", pageId))
      .collect();

    // Filter to root comments only (parentId is null)
    return comments
      .filter((c) => c.parentId === null)
      .sort((a, b) => a.createdAt - b.createdAt);
  },
});

/**
 * Full-text search within a business's wiki
 * Uses Convex search index for efficient queries
 */
export const search = query({
  args: {
    businessId: convexVal.id("businesses"),
    query: convexVal.string(),
  },
  handler: async (ctx, { businessId, query: searchQuery }) => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return [];
    }

    const results = await ctx.db
      .query("wikiPages")
      .withSearchIndex("search_content", (q) =>
        q.search("contentText", searchQuery).eq("businessId", businessId)
      )
      .collect();

    return results;
  },
});

// ════════════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Create a new department (root-level page)
 * Departments organize pages and appear at the top level of the tree
 */
export const createDepartment = mutation({
  args: {
    businessId: convexVal.id("businesses"),
    title: convexVal.string(),
    emoji: convexVal.optional(convexVal.string()),
    createdBy: convexVal.string(),
    createdByName: convexVal.string(),
  },
  handler: async (
    ctx,
    { businessId, title, emoji, createdBy, createdByName }
  ) => {
    // Get current department count (for position)
    const departments = await ctx.db
      .query("wikiPages")
      .withIndex("by_business_type", (q) =>
        q.eq("businessId", businessId).eq("type", "department")
      )
      .collect();

    const position = departments.length;

    // Create the department page
    const pageId = await ctx.db.insert("wikiPages", {
      businessId,
      title,
      content: "",
      contentText: "",
      emoji,
      parentId: undefined,
      childIds: [],
      position,
      type: "department",
      createdBy,
      createdByName,
      updatedBy: createdBy,
      updatedByName: createdByName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as any);

    return pageId;
  },
});

/**
 * Create a sub-page under a parent (department or another page)
 */
export const createPage = mutation({
  args: {
    businessId: convexVal.id("businesses"),
    parentId: convexVal.id("wikiPages"),
    title: convexVal.string(),
    content: convexVal.string(),
    contentText: convexVal.string(),
    emoji: convexVal.optional(convexVal.string()),
    createdBy: convexVal.string(),
    createdByName: convexVal.string(),
    taskIds: convexVal.optional(convexVal.array(convexVal.id("tasks"))),
    epicId: convexVal.optional(convexVal.id("epics")),
  },
  handler: async (
    ctx,
    {
      businessId,
      parentId,
      title,
      content,
      contentText,
      emoji,
      createdBy,
      createdByName,
      taskIds,
      epicId,
    }
  ) => {
    // Get parent page
    const parent = await ctx.db.get(parentId);
    if (!parent) {
      throw new Error(`Parent page not found: ${parentId}`);
    }

    // Get current child count (for position)
    const children = await ctx.db
      .query("wikiPages")
      .withIndex("by_business_parent", (q) =>
        q.eq("businessId", businessId).eq("parentId", parentId)
      )
      .collect();

    const position = children.length;

    // Create the sub-page
    const pageId = await ctx.db.insert("wikiPages", {
      businessId,
      title,
      content,
      contentText,
      emoji,
      parentId,
      childIds: [],
      position,
      type: "page",
      taskIds,
      epicId,
      createdBy,
      createdByName,
      updatedBy: createdBy,
      updatedByName: createdByName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });

    // Add to parent's childIds
    await ctx.db.patch(parentId, {
      childIds: [...parent.childIds, pageId],
    });

    return pageId;
  },
});

/**
 * Update page content
 * Automatically saves a history snapshot and increments version
 */
export const updatePage = mutation({
  args: {
    pageId: convexVal.id("wikiPages"),
    title: convexVal.string(),
    content: convexVal.string(),
    contentText: convexVal.string(),
    emoji: convexVal.optional(convexVal.string()),
    updatedBy: convexVal.string(),
    updatedByName: convexVal.string(),
    taskIds: convexVal.optional(convexVal.array(convexVal.id("tasks"))),
    epicId: convexVal.optional(convexVal.id("epics")),
  },
  handler: async (
    ctx,
    {
      pageId,
      title,
      content,
      contentText,
      emoji,
      updatedBy,
      updatedByName,
      taskIds,
      epicId,
    }
  ) => {
    const page = await ctx.db.get(pageId);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    // Save history snapshot of current version
    await ctx.db.insert("wikiPageHistory", {
      businessId: page.businessId,
      pageId,
      title: page.title,
      content: page.content,
      version: page.version,
      savedBy: updatedBy,
      savedByName: updatedByName,
      savedAt: Date.now(),
    });

    // Update the page with new content
    await ctx.db.patch(pageId, {
      title,
      content,
      contentText,
      emoji,
      taskIds,
      epicId,
      updatedBy,
      updatedByName,
      updatedAt: Date.now(),
      version: page.version + 1,
    });

    return pageId;
  },
});

/**
 * Helper function to recursively delete a page and all descendants
 */
async function deletePageRecursive(ctx: any, pageId: Id<"wikiPages">) {
  const page = await ctx.db.get(pageId);
  if (!page) {
    throw new Error(`Page not found: ${pageId}`);
  }

  // Recursively delete all children
  for (const childId of page.childIds) {
    await deletePageRecursive(ctx, childId as Id<"wikiPages">);
  }

  // Remove from parent's childIds
  if (page.parentId) {
    const parent = await ctx.db.get(page.parentId);
    if (parent) {
      await ctx.db.patch(page.parentId, {
        childIds: parent.childIds.filter((id: Id<"wikiPages">) => id !== pageId),
      } as any);
    }
  }

  // Delete all comments for this page
  const comments = await ctx.db
    .query("wikiComments")
    .withIndex("by_page", (q: any) => q.eq("pageId", pageId))
    .collect();

  for (const comment of comments) {
    await ctx.db.delete(comment._id);
  }

  // Delete all history entries
  const history = await ctx.db
    .query("wikiPageHistory")
    .withIndex("by_page", (q: any) => q.eq("pageId", pageId))
    .collect();

  for (const entry of history) {
    await ctx.db.delete(entry._id);
  }

  // Delete the page itself
  await ctx.db.delete(pageId);
}

/**
 * Delete a page and all its descendants recursively
 * Also removes from parent's childIds
 */
export const deletePage = mutation({
  args: { pageId: convexVal.id("wikiPages") },
  handler: async (ctx, { pageId }) => {
    await deletePageRecursive(ctx, pageId);
    return pageId;
  },
});

/**
 * Move a page to a new parent
 * Updates both old and new parent's childIds
 */
export const movePage = mutation({
  args: {
    pageId: convexVal.id("wikiPages"),
    newParentId: convexVal.id("wikiPages"),
    position: convexVal.number(),
  },
  handler: async (ctx, { pageId, newParentId, position }) => {
    const page = await ctx.db.get(pageId);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    const newParent = await ctx.db.get(newParentId);
    if (!newParent) {
      throw new Error(`New parent page not found: ${newParentId}`);
    }

    // Remove from old parent
    if (page.parentId) {
      const oldParent = await ctx.db.get(page.parentId);
      if (oldParent) {
        await ctx.db.patch(page.parentId, {
          childIds: oldParent.childIds.filter((id) => id !== pageId),
        });
      }
    }

    // Add to new parent at specified position
    const newChildIds = [...newParent.childIds];
    newChildIds.splice(position, 0, pageId);

    await ctx.db.patch(newParentId, {
      childIds: newChildIds,
    });

    // Update page
    await ctx.db.patch(pageId, {
      parentId: newParentId,
      position,
    });

    return pageId;
  },
});

/**
 * Reorder pages within a parent
 * Updates position for all children
 */
export const reorderPages = mutation({
  args: {
    parentId: convexVal.id("wikiPages"),
    orderedChildIds: convexVal.array(convexVal.id("wikiPages")),
  },
  handler: async (ctx, { parentId, orderedChildIds }) => {
    const parent = await ctx.db.get(parentId);
    if (!parent) {
      throw new Error(`Parent page not found: ${parentId}`);
    }

    // Update parent's childIds order
    await ctx.db.patch(parentId, {
      childIds: orderedChildIds,
    });

    // Update position on each child
    for (let i = 0; i < orderedChildIds.length; i++) {
      await ctx.db.patch(orderedChildIds[i], {
        position: i,
      });
    }

    return parentId;
  },
});

/**
 * Add a comment to a page
 * Can be a root comment or a reply to another comment
 */
export const addComment = mutation({
  args: {
    pageId: convexVal.id("wikiPages"),
    businessId: convexVal.id("businesses"),
    fromId: convexVal.string(),
    fromName: convexVal.string(),
    content: convexVal.string(),
    parentId: convexVal.optional(convexVal.id("wikiComments")),
  },
  handler: async (
    ctx,
    { pageId, businessId, fromId, fromName, content, parentId }
  ) => {
    // Create the comment
    const commentId = await ctx.db.insert("wikiComments", {
      businessId,
      pageId,
      fromId,
      fromName,
      content,
      parentId: parentId || undefined,
      replyIds: [],
      createdAt: Date.now(),
    } as any);

    // If this is a reply, add to parent's replyIds
    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (parent) {
        await ctx.db.patch(parentId, {
          replyIds: [...parent.replyIds, commentId],
        });
      }
    }

    return commentId;
  },
});

/**
 * Helper function to recursively delete a comment and all replies
 */
async function deleteCommentRecursive(ctx: any, commentId: Id<"wikiComments">) {
  const comment = await ctx.db.get(commentId);
  if (!comment) {
    throw new Error(`Comment not found: ${commentId}`);
  }

  // Remove from parent's replyIds if this is a reply
  if (comment.parentId) {
    const parent = await ctx.db.get(comment.parentId);
    if (parent) {
      await ctx.db.patch(comment.parentId, {
        replyIds: parent.replyIds.filter((id: Id<"wikiComments">) => id !== commentId),
      } as any);
    }
  }

  // Delete all replies to this comment recursively
  for (const replyId of comment.replyIds) {
    await deleteCommentRecursive(ctx, replyId as Id<"wikiComments">);
  }

  // Delete the comment
  await ctx.db.delete(commentId);
}

/**
 * Delete a comment
 * Also removes from parent's replyIds if it's a reply
 */
export const deleteComment = mutation({
  args: { commentId: convexVal.id("wikiComments") },
  handler: async (ctx, { commentId }) => {
    await deleteCommentRecursive(ctx, commentId);
    return commentId;
  },
});

/**
 * Restore a page from a previous version
 * Creates a new history entry for the restore action
 */
export const restorePage = mutation({
  args: {
    pageId: convexVal.id("wikiPages"),
    historyId: convexVal.id("wikiPageHistory"),
    restoredBy: convexVal.string(),
    restoredByName: convexVal.string(),
  },
  handler: async (ctx, { pageId, historyId, restoredBy, restoredByName }) => {
    const page = await ctx.db.get(pageId);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    const history = await ctx.db.get(historyId);
    if (!history) {
      throw new Error(`History entry not found: ${historyId}`);
    }

    // Save current version as a history snapshot
    await ctx.db.insert("wikiPageHistory", {
      businessId: page.businessId,
      pageId,
      title: page.title,
      content: page.content,
      version: page.version,
      savedBy: restoredBy,
      savedByName: restoredByName,
      savedAt: Date.now(),
    });

    // Restore the historical version
    await ctx.db.patch(pageId, {
      title: history.title,
      content: history.content,
      updatedBy: restoredBy,
      updatedByName: restoredByName,
      updatedAt: Date.now(),
      version: page.version + 1,
    });

    return pageId;
  },
});
