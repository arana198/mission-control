import { v } from "convex/values";
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
    const workflows = await ctx.db.query("executions").take(100);
    return workflows.map((wf: any) => ({
      _id: wf._id,
      _creationTime: wf._creationTime,
      name: wf.workflowName || "Untitled Workflow",
      status: wf.status,
      createdAt: wf.createdAt,
      updatedAt: wf.updatedAt,
    }));
  },
});

/**
 * Get single workflow details
 */
export const getWorkflow = query({
  args: { workflowId: v.id("executions") },
  handler: async (ctx, { workflowId }) => {
    const workflow = await ctx.db.get(workflowId);
    if (!workflow) return null;

    return {
      _id: workflow._id,
      _creationTime: workflow._creationTime,
      name: workflow.workflowName || "Untitled Workflow",
      status: workflow.status,
      definition: workflow.definition,
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
    name: v.string(),
    definition: v.optional(v.any()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: wrapConvexHandler(async (ctx, { name, definition, workspaceId }) => {
    const now = Date.now();

    const workflowId = await ctx.db.insert("executions", {
      workflowName: name,
      definition: definition || { nodes: [], edges: [] },
      workspaceId: workspaceId || null,
      status: "pending",
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
    workflowId: v.id("executions"),
    name: v.optional(v.string()),
    definition: v.optional(v.any()),
  },
  handler: wrapConvexHandler(async (ctx, { workflowId, name, definition }) => {
    const workflow = await ctx.db.get(workflowId);
    if (!workflow) throw ApiError.notFound("Workflow", { workflowId });

    const updates: any = { updatedAt: Date.now() };
    if (name !== undefined) updates.workflowName = name;
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
  args: { workflowId: v.id("executions") },
  handler: wrapConvexHandler(async (ctx, { workflowId }) => {
    const workflow = await ctx.db.get(workflowId);
    if (!workflow) throw ApiError.notFound("Workflow", { workflowId });

    await ctx.db.delete(workflowId);

    return { success: true, deletedWorkflowId: workflowId };
  }),
});
