import { v as convexVal } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { ApiError, wrapConvexHandler } from "../lib/errors";

/**
 * Wiki Backend Functions - Phase 2
 * Convex mutations and queries for the Confluence-style document store
 *
 * All functions follow TDD patterns:
 * - Tests written first in convex/__tests__/wiki.test.ts
 * - Full type safety with Zod validation
 * - Bidirectional denormalization maintained (parentId + childIds)
 * - -scoped queries ensure data isolation
 * - Error handling with ApiError patterns
 *
 * Phase 1: Error standardization - all mutations now use ApiError with request IDs
 */

// ════════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ════════════════════════════════════════════════════════════════════════════════

export interface WikiPage extends Doc<"wikiPages"> {
  workspaceId?: Id<"workspaces">;
  title: string;
  content: string; // Plain markdown
  parentId?: Id<"wikiPages">;
  childIds: Id<"wikiPages">[];
  position: number;
  type: "department" | "page";
  taskIds?: Id<"tasks">[];
  epicId?: Id<"epics">;
  emoji?: string; // Optional emoji icon
  status?: "draft" | "published" | "archived"; // Optional status
  createdBy: string;
  createdByName: string;
  updatedBy: string;
  updatedByName: string;
  createdAt: number;
  updatedAt: number;
}

export interface WikiPageWithChildren extends WikiPage {
  children?: WikiPageWithChildren[];
}

export interface WikiComment extends Doc<"wikiComments"> {
  workspaceId: Id<"workspaces">;
  pageId: Id<"wikiPages">;
  fromId: string;
  fromName: string;
  content: string;
  parentId?: Id<"wikiComments">;
  replyIds: Id<"wikiComments">[];
  createdAt: number;
  editedAt?: number;
}

// Placeholder for WikiPageHistory (not currently implemented - for compatibility)
export interface WikiPageHistory extends Doc<"wikiPages"> {
  workspaceId: Id<"workspaces">;
  title: string;
  content: string;
  version: number;
  savedByName: string;
  savedAt: number;
  createdAt: number;
}

// ════════════════════════════════════════════════════════════════════════════════
// QUERIES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Get full page tree for a workspace
 * Returns departments (root pages) with their nested children
 * Useful for sidebar tree navigation
 */
export const getTree = query({
  args: { workspaceId: convexVal.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    // Get all root-level pages (no parent) for this business
    const allPages = await ctx.db
      .query("wikiPages")
      .withIndex("by_workspace_parent", (q: any) =>
        q.eq("workspaceId", workspaceId).eq("parentId", undefined as any)
      )
      .collect();

    // For each root page, recursively fetch children
    const buildTree = async (parentId: Id<"wikiPages">): Promise<any[]> => {
      const children = await ctx.db
        .query("wikiPages")
        .withIndex("by_workspace_parent", (q: any) =>
          q.eq("workspaceId", workspaceId).eq("parentId", parentId)
        )
        .collect();

      // Sort by position
      children.sort((a: any, b: any) => a.position - b.position);

      // Recursively add grandchildren
      return Promise.all(
        children.map(async (child: any) => ({
          ...child,
          children: await buildTree(child._id),
        }))
      );
    };

    // Sort root pages by position
    const rootPages = allPages.sort((a: any, b: any) => a.position - b.position);

    // Build tree for each root page
    return Promise.all(
      rootPages.map(async (page: any) => ({
        ...page,
        children: await buildTree(page._id as Id<"wikiPages">),
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
 * Get comments for a page (root comments only)
 * Replies are nested within parent comment's replyIds
 */
export const getComments = query({
  args: { pageId: convexVal.id("wikiPages") },
  handler: async (ctx, { pageId }) => {
    const comments = await ctx.db
      .query("wikiComments")
      .withIndex("by_page", (q: any) => q.eq("pageId", pageId))
      .collect();

    // Filter to root comments only (parentId is null)
    return comments
      .filter((c: any) => c.parentId === null)
      .sort((a: any, b: any) => a.createdAt - b.createdAt);
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
    workspaceId: convexVal.id("workspaces"),
    title: convexVal.string(),
    createdBy: convexVal.string(),
    createdByName: convexVal.string(),
  },
  handler: async (ctx, { workspaceId, title, createdBy, createdByName }) => {
    // Get current department count (for position)
    const departments = await ctx.db
      .query("wikiPages")
      .withIndex("by_workspace_type", (q: any) =>
        q.eq("workspaceId", workspaceId).eq("type", "department")
      )
      .collect();

    const position = departments.length;

    // Create the department page
    const pageId = await ctx.db.insert("wikiPages", {
      workspaceId,
      title,
      content: "",
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
    });

    return pageId;
  },
});

/**
 * Create a sub-page under a parent (department or another page)
 */
export const createPage = mutation({
  args: {
    workspaceId: convexVal.id("workspaces"),
    parentId: convexVal.id("wikiPages"),
    title: convexVal.string(),
    content: convexVal.string(),
    createdBy: convexVal.string(),
    createdByName: convexVal.string(),
    taskIds: convexVal.optional(convexVal.array(convexVal.id("tasks"))),
    epicId: convexVal.optional(convexVal.id("epics")),
  },
  handler: wrapConvexHandler(async (
    ctx,
    {
      workspaceId,
      parentId,
      title,
      content,
      createdBy,
      createdByName,
      taskIds,
      epicId,
    }
  ) => {
    // Get parent page
    const parent = await ctx.db.get(parentId);
    if (!parent) {
      throw ApiError.notFound('Parent WikiPage', { parentId });
    }

    // Get current child count (for position)
    const children = await ctx.db
      .query("wikiPages")
      .withIndex("by_workspace_parent", (q: any) =>
        q.eq("workspaceId", workspaceId).eq("parentId", parentId)
      )
      .collect();

    const position = children.length;

    // Create the sub-page
    const pageId = await ctx.db.insert("wikiPages", {
      workspaceId,
      title,
      content,
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
    });

    // Add to parent's childIds
    await ctx.db.patch(parentId, {
      childIds: [...parent.childIds, pageId],
    });

    return pageId;
  }),
});

/**
 * Update page content
 */
export const updatePage = mutation({
  args: {
    pageId: convexVal.id("wikiPages"),
    title: convexVal.string(),
    content: convexVal.string(),
    updatedBy: convexVal.string(),
    updatedByName: convexVal.string(),
    taskIds: convexVal.optional(convexVal.array(convexVal.id("tasks"))),
    epicId: convexVal.optional(convexVal.id("epics")),
  },
  handler: wrapConvexHandler(async (
    ctx,
    {
      pageId,
      title,
      content,
      updatedBy,
      updatedByName,
      taskIds,
      epicId,
    }
  ) => {
    const page = await ctx.db.get(pageId);
    if (!page) {
      throw ApiError.notFound('WikiPage', { pageId });
    }

    // Update the page with new content
    await ctx.db.patch(pageId, {
      title,
      content,
      taskIds,
      epicId,
      updatedBy,
      updatedByName,
      updatedAt: Date.now(),
    });

    return pageId;
  }),
});

/**
 * Helper function to recursively delete a page and all descendants
 */
async function deletePageRecursive(ctx: any, pageId: Id<"wikiPages">) {
  const page = await ctx.db.get(pageId);
  if (!page) {
    throw ApiError.notFound('WikiPage', { pageId });
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

  // Delete the page itself
  await ctx.db.delete(pageId);
}

/**
 * Delete a page and all its descendants recursively
 * Also removes from parent's childIds
 */
export const deletePage = mutation({
  args: { pageId: convexVal.id("wikiPages") },
  handler: wrapConvexHandler(async (ctx, { pageId }) => {
    await deletePageRecursive(ctx, pageId);
    return pageId;
  }),
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
  handler: wrapConvexHandler(async (ctx, { pageId, newParentId, position }) => {
    const page = await ctx.db.get(pageId);
    if (!page) {
      throw ApiError.notFound('WikiPage', { pageId });
    }

    const newParent = await ctx.db.get(newParentId);
    if (!newParent) {
      throw ApiError.notFound('New Parent WikiPage', { newParentId });
    }

    // Remove from old parent
    if (page.parentId) {
      const oldParent = await ctx.db.get(page.parentId);
      if (oldParent) {
        await ctx.db.patch(page.parentId, {
          childIds: oldParent.childIds.filter((id: any) => id !== pageId),
        });
      }
    }

    // Add to new parent at specified position (ensure not already present)
    const newChildIds = newParent.childIds.filter((id: any) => id !== pageId);
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
  }),
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
  handler: wrapConvexHandler(async (ctx, { parentId, orderedChildIds }) => {
    const parent = await ctx.db.get(parentId);
    if (!parent) {
      throw ApiError.notFound('Parent WikiPage', { parentId });
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
  }),
});

/**
 * Add a comment to a page
 * Can be a root comment or a reply to another comment
 */
export const addComment = mutation({
  args: {
    pageId: convexVal.id("wikiPages"),
    workspaceId: convexVal.id("workspaces"),
    fromId: convexVal.string(),
    fromName: convexVal.string(),
    content: convexVal.string(),
    parentId: convexVal.optional(convexVal.id("wikiComments")),
  },
  handler: wrapConvexHandler(async (
    ctx,
    { pageId, workspaceId, fromId, fromName, content, parentId }
  ) => {
    // Create the comment
    const commentId = await ctx.db.insert("wikiComments", {
      workspaceId,
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
  }),
});

/**
 * Helper function to recursively delete a comment and all replies
 */
async function deleteCommentRecursive(ctx: any, commentId: Id<"wikiComments">) {
  const comment = await ctx.db.get(commentId);
  if (!comment) {
    throw ApiError.notFound('WikiComment', { commentId });
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
  handler: wrapConvexHandler(async (ctx, { commentId }) => {
    await deleteCommentRecursive(ctx, commentId);
    return commentId;
  }),
});

