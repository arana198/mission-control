import { v as convexVal } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ApiError, wrapConvexHandler } from "../lib/errors";

/**
 * Workflow Management Module
 * CRUD operations for workflows (orchestrated sequences of tasks)
 *
 * Phase 1: Convex API alignment - frontend compatibility layer
 * Note: Full workflow execution engine is in Phase 10
 */

/**
 * List all workflows
 */
export const listWorkflows = query({
  handler: async (ctx) => {
    const workflows = await ctx.db.query("workflows").take(100);
    return workflows.map((wf: any) => ({
      _id: wf._id,
      _creationTime: wf._creationTime,
      name: wf.name || "Untitled Workflow",
      description: wf.description,
      isActive: wf.isActive,
      createdAt: wf.createdAt,
      updatedAt: wf.updatedAt,
    }));
  },
});

/**
 * Get single workflow details
 */
export const getWorkflow = query({
  args: { workflowId: convexVal.id("workflows") },
  handler: async (ctx, { workflowId }) => {
    const workflow = await ctx.db.get(workflowId);
    if (!workflow) return null;

    return {
      _id: workflow._id,
      _creationTime: workflow._creationTime,
      name: workflow.name || "Untitled Workflow",
      description: workflow.description,
      definition: workflow.definition,
      isActive: workflow.isActive,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    };
  },
});

/**
 * Create a new workflow
 * Stores workflow definition and returns the execution record
 */
export const createWorkflow = mutation({
  args: {
    name: convexVal.string(),
    description: convexVal.optional(convexVal.string()),
    definition: convexVal.optional(convexVal.any()),
    workspaceId: convexVal.optional(convexVal.id("workspaces")),
  },
  handler: wrapConvexHandler(async (ctx, { name, description, definition, workspaceId }) => {
    const now = Date.now();

    const workflowId = await ctx.db.insert("workflows", {
      name,
      description: description || "",
      definition: definition || { nodes: [], edges: [] },
      workspaceId: workspaceId || undefined,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const created = await ctx.db.get(workflowId);
    return created;
  }),
});

/**
 * Update workflow definition
 */
export const updateWorkflow = mutation({
  args: {
    workflowId: convexVal.id("workflows"),
    name: convexVal.optional(convexVal.string()),
    description: convexVal.optional(convexVal.string()),
    definition: convexVal.optional(convexVal.any()),
  },
  handler: wrapConvexHandler(async (ctx, { workflowId, name, description, definition }) => {
    const workflow = await ctx.db.get(workflowId);
    if (!workflow) throw ApiError.notFound("Workflow", { workflowId });

    const updates: any = { updatedAt: Date.now() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (definition !== undefined) updates.definition = definition;

    await ctx.db.patch(workflowId, updates);

    const updated = await ctx.db.get(workflowId);
    return updated;
  }),
});

/**
 * Delete a workflow
 */
export const deleteWorkflow = mutation({
  args: { workflowId: convexVal.id("workflows") },
  handler: wrapConvexHandler(async (ctx, { workflowId }) => {
    const workflow = await ctx.db.get(workflowId);
    if (!workflow) throw ApiError.notFound("Workflow", { workflowId });

    await ctx.db.delete(workflowId);

    return { success: true, deletedWorkflowId: workflowId };
  }),
});
