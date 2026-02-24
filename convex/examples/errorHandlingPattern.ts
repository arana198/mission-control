/**
 * Error Handling Pattern Examples
 * Demonstrates how to use ApiError and wrapConvexHandler in Convex mutations
 *
 * This file shows the recommended patterns for Phase 1 error standardization.
 * Copy these patterns to update existing mutations throughout the codebase.
 */

import { v as convexVal } from "convex/values";
import { mutation, query } from "../_generated/server";
import { ApiError, ErrorCode, wrapConvexHandler } from "../../lib/errors";
import { generateRequestId } from "../../lib/utils/requestId";

// ─── EXAMPLE 1: Basic Mutation with Error Handling ────────────────────────

export const exampleUpdateAgent = mutation({
  args: {
    agentId: convexVal.id("agents"),
    status: convexVal.union(
      convexVal.literal("idle"),
      convexVal.literal("active"),
      convexVal.literal("blocked")
    ),
  },
  handler: wrapConvexHandler(async (ctx, { agentId, status }) => {
    const agent = await ctx.db.get(agentId);

    // ❌ OLD: throw new Error("Agent not found");
    // ✅ NEW: Use ApiError with standardized code
    if (!agent) {
      throw ApiError.notFound("Agent", { agentId });
    }

    // ❌ OLD: throw new Error("Agent already assigned");
    // ✅ NEW: Use CONFLICT for state mismatches
    if (agent.status === status) {
      throw new ApiError(
        ErrorCode.CONFLICT,
        `Agent already in status: ${status}`,
        {
          currentStatus: agent.status,
          requestedStatus: status,
          agentId,
        }
      );
    }

    await ctx.db.patch(agentId, {
      status,
      lastHeartbeat: Date.now(),
    });

    return {
      success: true,
      agentId,
      status,
      updatedAt: Date.now(),
    };
  }),
});

// ─── EXAMPLE 2: Validation Error ─────────────────────────────────────────

export const exampleCreateBusiness = mutation({
  args: {
    name: convexVal.string(),
    slug: convexVal.string(),
    missionStatement: convexVal.string(),
  },
  handler: wrapConvexHandler(async (ctx, { name, slug, missionStatement }) => {
    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      // ❌ OLD: throw new Error("Invalid slug format. Use only lowercase...");
      // ✅ NEW: Use VALIDATION_ERROR with details
      throw ApiError.validationError(
        "Invalid slug format. Use only lowercase letters, numbers, and hyphens.",
        {
          field: "slug",
          value: slug,
          pattern: "[a-z0-9-]+",
        }
      );
    }

    // Check slug uniqueness
    const existing = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .first();

    if (existing) {
      // ❌ OLD: throw new Error(`Business with slug "${slug}" already exists.`);
      // ✅ NEW: Use CONFLICT error
      throw ApiError.conflict(
        `Business with slug "${slug}" already exists`,
        {
          slug,
          existingBusinessId: existing._id,
        }
      );
    }

    // Check max 5 businesses limit
    const allBusinesses = await ctx.db.query("businesses").collect();
    if (allBusinesses.length >= 5) {
      // ❌ OLD: throw new Error("Maximum 5 businesses allowed per workspace.");
      // ✅ NEW: Use LIMIT_EXCEEDED
      throw ApiError.limitExceeded("Maximum 5 businesses allowed per workspace", {
        limit: 5,
        current: allBusinesses.length,
      });
    }

    const businessId = await ctx.db.insert("businesses", {
      name,
      slug,
      missionStatement,
      isDefault: allBusinesses.length === 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const business = await ctx.db.get(businessId);

    return {
      data: business,
      meta: {
        timestamp: Date.now(),
        requestId: generateRequestId(),
      },
    };
  }),
});

// ─── EXAMPLE 3: Permission Check (FORBIDDEN) ─────────────────────────────

export const exampleUpdateEpic = mutation({
  args: {
    businessId: convexVal.id("businesses"),
    epicId: convexVal.id("epics"),
    title: convexVal.optional(convexVal.string()),
  },
  handler: wrapConvexHandler(async (ctx, { businessId, epicId, title }) => {
    const epic = await ctx.db.get(epicId);

    if (!epic) {
      throw ApiError.notFound("Epic", { epicId });
    }

    // Verify epic belongs to business (multi-tenant safety)
    if (epic.businessId !== businessId) {
      // ❌ OLD: throw new Error("Epic does not belong to this business");
      // ✅ NEW: Use FORBIDDEN for permission issues
      throw ApiError.forbidden("Epic does not belong to this business", {
        epicId,
        businessId,
        actualBusinessId: epic.businessId,
      });
    }

    if (title !== undefined) {
      await ctx.db.patch(epicId, {
        title,
        updatedAt: Date.now(),
      });
    }

    const updated = await ctx.db.get(epicId);

    return {
      data: updated,
      meta: {
        timestamp: Date.now(),
        requestId: generateRequestId(),
      },
    };
  }),
});

// ─── EXAMPLE 4: Query with Proper 404 Handling ──────────────────────────

export const exampleGetTaskById = query({
  args: {
    taskId: convexVal.id("tasks"),
    businessId: convexVal.id("businesses"),
  },
  handler: async (ctx, { taskId, businessId }) => {
    const task = await ctx.db.get(taskId);

    if (!task) {
      throw ApiError.notFound("Task", { taskId });
    }

    // Verify business ownership
    if (task.businessId !== businessId) {
      throw ApiError.forbidden("Task does not belong to this business", {
        taskId,
        businessId,
      });
    }

    return {
      data: task,
      meta: {
        timestamp: Date.now(),
        requestId: generateRequestId(),
      },
    };
  },
});

// ─── EXAMPLE 5: Bulk Operation with Mixed Results ──────────────────────

export const exampleBulkUpdateTasks = mutation({
  args: {
    businessId: convexVal.id("businesses"),
    taskIds: convexVal.array(convexVal.id("tasks")),
    status: convexVal.string(),
  },
  handler: wrapConvexHandler(async (ctx, { businessId, taskIds, status }) => {
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const taskId of taskIds) {
      try {
        const task = await ctx.db.get(taskId);

        if (!task) {
          results.push({
            taskId,
            success: false,
            error: {
              code: ErrorCode.NOT_FOUND,
              message: "Task not found",
            },
          });
          errorCount++;
          continue;
        }

        if (task.businessId !== businessId) {
          results.push({
            taskId,
            success: false,
            error: {
              code: ErrorCode.FORBIDDEN,
              message: "Task does not belong to this business",
            },
          });
          errorCount++;
          continue;
        }

        await ctx.db.patch(taskId, {
          status,
          updatedAt: Date.now(),
        });

        results.push({
          taskId,
          success: true,
          status,
        });
        successCount++;
      } catch (error: any) {
        results.push({
          taskId,
          success: false,
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: error?.message || "Unknown error",
          },
        });
        errorCount++;
      }
    }

    return {
      data: {
        processed: taskIds.length,
        succeeded: successCount,
        failed: errorCount,
        results,
      },
      meta: {
        timestamp: Date.now(),
        requestId: generateRequestId(),
      },
    };
  }),
});

// ─── REFERENCE: Error Code Mapping ──────────────────────────────────────

/**
 * Use these error codes in your mutations:
 *
 * VALIDATION_ERROR (422):
 *   - Input doesn't match schema
 *   - Invalid format (slug, email, etc.)
 *   - Missing required fields
 *   Use: ApiError.validationError(message, details)
 *
 * NOT_FOUND (404):
 *   - Resource doesn't exist
 *   Use: ApiError.notFound(resourceType, details)
 *
 * CONFLICT (409):
 *   - Duplicate resource
 *   - State mismatch (can't transition from A to B)
 *   - Already assigned/claimed
 *   Use: new ApiError(ErrorCode.CONFLICT, message, details)
 *
 * FORBIDDEN (403):
 *   - Business ownership violation
 *   - Permission denied
 *   - Multi-tenant isolation breach
 *   Use: ApiError.forbidden(message, details)
 *
 * LIMIT_EXCEEDED (429):
 *   - Max resources reached (5 businesses, etc.)
 *   - Rate limit hit
 *   Use: ApiError.limitExceeded(message, details)
 *
 * INTERNAL_ERROR (500):
 *   - Unexpected server error
 *   - Database connection failure
 *   Use: ApiError.internal(message, details)
 *
 * SERVICE_UNAVAILABLE (503):
 *   - Temporary failure (retryable)
 *   Use: ApiError.unavailable(message, details)
 */
