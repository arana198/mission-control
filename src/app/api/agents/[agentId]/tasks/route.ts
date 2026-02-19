/**
 * GET /api/agents/{agentId}/tasks
 *
 * Query tasks with optional filters (status, priority, assignedToMe)
 * Supports pagination via limit and offset
 * Tasks are scoped to a specific business
 *
 * Query params:
 *   agentKey (REQUIRED) - Agent authentication key
 *   businessId (REQUIRED) - Business ID for task scoping
 *   status? - Task status filter
 *   priority? - Task priority filter
 *   assignedToMe? - Filter to tasks assigned to this agent
 *   limit? - Pagination limit (default: 50)
 *   offset? - Pagination offset (default: 0)
 *
 * Response: { tasks[], meta: { count, filters, pagination } }
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  successResponse,
  handleApiError,
  jsonResponse,
  UnauthorizedError,
} from "@/lib/utils/apiResponse";
import { createLogger } from "@/lib/utils/logger";
import { validateAgentTaskInput, QueryTasksSchema } from "@/lib/validators/agentTaskValidators";
import { verifyAgent } from "@/lib/agent-auth";

const log = createLogger("api:agents:tasks:query");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(
  request: Request,
  context: any
): Promise<Response> {
  const { agentId } = context.params;
  try {
    // Parse query params
    const url = new URL(request.url);
    const agentKey = url.searchParams.get("agentKey");
    const businessId = url.searchParams.get("businessId");
    const status = url.searchParams.get("status") || undefined;
    const priority = url.searchParams.get("priority") || undefined;
    const assignedTo = url.searchParams.get("assignedTo") === "me" ? "me" : undefined;
    const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!) : undefined;
    const offset = url.searchParams.get("offset") ? parseInt(url.searchParams.get("offset")!) : undefined;

    // Validate required params
    if (!agentKey) {
      return jsonResponse(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "agentKey query param is required" },
        },
        400
      );
    }

    if (!businessId) {
      return jsonResponse(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "businessId query param is required" },
        },
        400
      );
    }

    const input = validateAgentTaskInput(QueryTasksSchema, {
      agentId,
      agentKey,
      status,
      priority,
      assignedTo,
      limit,
      offset,
    });

    // Verify credentials
    const agent = await verifyAgent(input.agentId, input.agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    // Query tasks with filters (scoped to this business)
    const tasks = await convex.query(api.tasks.getFiltered, {
      businessId: businessId as any,
      agentId: input.agentId as any,
      status: input.status,
      priority: input.priority,
      assignedToMe: input.assignedTo === "me",
      limit: input.limit,
      offset: input.offset,
    });

    // Fire-and-forget activity logging (don't break response if logging fails)
    try {
      await convex.mutation(api.activities.create, {
        businessId: businessId as any,
        type: "tasks_queried",
        agentId: input.agentId,
        agentName: (agent as any).name,
        agentRole: (agent as any).role,
        message: `${(agent as any).name} queried tasks (${tasks.length} result${tasks.length !== 1 ? "s" : ""})${
          status || priority ? ` — filters: ${[status && `status=${status}`, priority && `priority=${priority}`].filter(Boolean).join(", ")}` : ""
        }`,
      });
    } catch (logErr) {
      log.warn("Activity logging failed (non-fatal)", { agentId: input.agentId, businessId });
    }

    log.info("Tasks queried", {
      agentId: input.agentId,
      businessId,
      count: tasks.length,
      filters: { status, priority, assignedTo },
    });

    return jsonResponse(
      successResponse({
        tasks,
        meta: {
          count: tasks.length,
          filters: { status, priority, assignedTo },
          pagination: { limit: input.limit || 50, offset: input.offset || 0 },
        },
      })
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
