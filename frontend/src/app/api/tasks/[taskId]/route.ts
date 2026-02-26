/**
 * PATCH /api/tasks/{taskId}
 *
 * Unified endpoint for task state changes and actions.
 * Consolidates 8 operations into a single resource mutation endpoint.
 *
 * Action discriminator in request body determines operation:
 * - action: "assign" | "complete" | "update-status" | "update-tags"
 *   (require agent auth via agentKey)
 * - action: "escalate" | "reassign" | "unblock" | "mark-executed"
 *   (state-engine actions, require decidedBy field)
 *
 * Request: { action, agentKey?, ... action-specific fields }
 * Response: { success, timestamp, ... }
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  successResponse,
  handleApiError,
  jsonResponse,
  UnauthorizedError,
} from "@/lib/utils/apiResponse";
import { createLogger } from "@/lib/utils/logger";
import { verifyAgent } from "@/lib/agent-auth";

const log = createLogger("api:tasks:patch");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function PATCH(
  request: Request,
  context: any
): Promise<Response> {
  const { taskId } = context.params;

  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return jsonResponse(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid JSON" },
        },
        400
      );
    }

    const { action } = body;
    if (!action) {
      return jsonResponse(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Missing action field" },
        },
        400
      );
    }

    // Route to appropriate handler based on action discriminator
    switch (action) {
      case "assign":
        return handleAssign(body, taskId);
      case "complete":
        return handleComplete(body, taskId);
      case "update-status":
        return handleUpdateStatus(body, taskId);
      case "update-tags":
        return handleUpdateTags(body, taskId);
      case "escalate":
        return handleEscalate(body, taskId);
      case "reassign":
        return handleReassign(body, taskId);
      case "unblock":
        return handleUnblock(body, taskId);
      case "mark-executed":
        return handleMarkExecuted(body, taskId);
      default:
        return jsonResponse(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: `Unknown action: ${action}`,
            },
          },
          400
        );
    }
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}

/**
 * Assign task to one or more agents
 */
async function handleAssign(body: any, taskId: string): Promise<Response> {
  try {
    const { agentKey, agentId, assigneeIds } = body;

    if (!agentKey) {
      return jsonResponse(
        { success: false, error: { code: "AUTH_ERROR", message: "Missing agentKey" } },
        401
      );
    }

    if (!assigneeIds || !Array.isArray(assigneeIds)) {
      return jsonResponse(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "assigneeIds must be an array" },
        },
        400
      );
    }

    // Verify credentials
    const agent = await verifyAgent(agentId, agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    // Assign task to agents
    await convex.mutation(api.tasks.assign, {
      taskId: taskId as any,
      assigneeIds: assigneeIds as any,
      assignedBy: agentId as any,
    });

    log.info("Task assigned", { agentId, taskId, assigneeIds });
    return jsonResponse(successResponse({ success: true }), 200);
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}

/**
 * Complete task from agent perspective
 */
async function handleComplete(body: any, taskId: string): Promise<Response> {
  try {
    const { agentKey, agentId, completionNotes, timeSpent, status } = body;

    if (!agentKey) {
      return jsonResponse(
        { success: false, error: { code: "AUTH_ERROR", message: "Missing agentKey" } },
        401
      );
    }

    // Verify credentials
    const agent = await verifyAgent(agentId, agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    const completedAt = Date.now();

    // Call mutation to complete task
    const result = await convex.mutation(api.tasks.completeByAgent, {
      taskId: taskId as Id<"tasks">,
      agentId: agentId as Id<"agents">,
      completionNotes: completionNotes || "",
      timeTracked: timeSpent || 0,
      status: (status as "done" | "review") || "done",
    });

    // TODO: Phase 6A - Replace with proper executions table logging
    // Create execution log entry (disabled - Phase 6A implementation)
    // await convex.mutation(api.executionLog.create, { ... });

    log.info("Task completed", { agentId, taskId });
    return jsonResponse(
      successResponse({
        success: true,
        taskId,
        completedAt,
      })
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}

/**
 * Update task status
 */
async function handleUpdateStatus(body: any, taskId: string): Promise<Response> {
  try {
    const { agentKey, agentId, status } = body;

    if (!agentKey) {
      return jsonResponse(
        { success: false, error: { code: "AUTH_ERROR", message: "Missing agentKey" } },
        401
      );
    }

    if (!status) {
      return jsonResponse(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Missing status field" },
        },
        400
      );
    }

    // Verify credentials
    const agent = await verifyAgent(agentId, agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    // Update task status
    await convex.mutation(api.tasks.updateStatus, {
      taskId: taskId as any,
      status,
      updatedBy: agentId as any,
    });

    log.info("Task status updated", { agentId, taskId, status });
    return jsonResponse(successResponse({ success: true }), 200);
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}

/**
 * Update task tags
 */
async function handleUpdateTags(body: any, taskId: string): Promise<Response> {
  try {
    const { agentKey, agentId, tags, tagsToAdd, tagsToRemove, action = "add" } = body;

    if (!agentKey) {
      return jsonResponse(
        { success: false, error: { code: "AUTH_ERROR", message: "Missing agentKey" } },
        401
      );
    }

    // Verify credentials
    const agent = await verifyAgent(agentId, agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    // Update tags (support both array and add/remove formats)
    let tagsToUpdate: string[] = [];
    let updateAction: "add" | "remove" = action;

    if (tags && Array.isArray(tags)) {
      tagsToUpdate = tags;
      updateAction = action || "add";
    } else if (tagsToAdd) {
      tagsToUpdate = tagsToAdd;
      updateAction = "add";
    } else if (tagsToRemove) {
      tagsToUpdate = tagsToRemove;
      updateAction = "remove";
    } else {
      return jsonResponse(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Provide tags, tagsToAdd, or tagsToRemove" },
        },
        400
      );
    }

    // Update tags
    await convex.mutation(api.tasks.addTags, {
      taskId: taskId as any,
      tags: tagsToUpdate,
      action: updateAction,
      updatedBy: agentId,
    });

    log.info("Task tags updated", { agentId, taskId, action: updateAction, count: tagsToUpdate.length });
    return jsonResponse(successResponse({ success: true }), 200);
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}

/**
 * Escalate task to P0
 */
async function handleEscalate(body: any, taskId: string): Promise<Response> {
  try {
    const { workspaceId, reason, decidedBy } = body;

    if (!workspaceId || !reason || !decidedBy) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required fields: workspaceId, reason, decidedBy",
          },
        },
        400
      );
    }

    const result = await convex.mutation(api.actions.escalateTask, {
      taskId: taskId as any,
      reason,
      decidedBy,
    });

    log.info("Task escalated", { taskId, reason, decidedBy });
    return jsonResponse(
      successResponse({
        action: "escalated",
        ...result,
      })
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}

/**
 * Reassign task
 */
async function handleReassign(body: any, taskId: string): Promise<Response> {
  try {
    const { toAgent, newAssignee, reason, decidedBy, fromAgent } = body;
    const assignTo = toAgent || newAssignee;

    if (!assignTo || !reason || !decidedBy) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required fields: toAgent (or newAssignee), reason, decidedBy",
          },
        },
        400
      );
    }

    const result = await convex.mutation(api.actions.reassignTask, {
      taskId: taskId as any,
      toAgent: assignTo,
      fromAgent,
      reason,
      decidedBy,
    });

    log.info("Task reassigned", { taskId, toAgent: assignTo, decidedBy });
    return jsonResponse(
      successResponse({
        action: "reassigned",
        ...result,
      })
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}

/**
 * Unblock task
 */
async function handleUnblock(body: any, taskId: string): Promise<Response> {
  try {
    const { reason, decidedBy } = body;

    if (!reason || !decidedBy) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required fields: reason, decidedBy",
          },
        },
        400
      );
    }

    const result = await convex.mutation(api.actions.unblockTask, {
      taskId: taskId as any,
      reason,
      decidedBy,
    });

    log.info("Task unblocked", { taskId, decidedBy });
    return jsonResponse(
      successResponse({
        action: "unblocked",
        ...result,
      })
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}

/**
 * Mark task as executed
 */
async function handleMarkExecuted(body: any, taskId: string): Promise<Response> {
  try {
    const { outcome, reason, decidedBy } = body;
    const executionOutcome = outcome || reason || "";

    if (!executionOutcome || !decidedBy) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required fields: outcome (or reason), decidedBy",
          },
        },
        400
      );
    }

    const result = await convex.mutation(api.actions.markExecuted, {
      taskId: taskId as any,
      outcome: executionOutcome,
      decidedBy,
    });

    log.info("Task marked executed", { taskId, decidedBy });
    return jsonResponse(
      successResponse({
        action: "mark-executed",
        ...result,
      })
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
