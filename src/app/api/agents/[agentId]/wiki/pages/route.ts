/**
 * POST /api/agents/{agentId}/wiki/pages
 *
 * Create a wiki page (root page or sub-page)
 *
 * Query params:
 *   agentKey (REQUIRED) - Agent authentication key
 *   businessId (REQUIRED) - Business ID for scoping
 *
 * Request body:
 *   title (REQUIRED) - Page title
 *   content? - Page content (markdown, default: empty string)
 *   parentId? - Parent page ID (for sub-pages)
 *
 * Response: { success: true, pageId: string, page: WikiPage }
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  successResponse,
  handleApiError,
  jsonResponse,
} from "@/lib/utils/apiResponse";
import type { ApiErrorResponse } from "@/lib/utils/apiResponse";
import { createLogger } from "@/lib/utils/logger";
import { verifyAgent } from "@/lib/agent-auth";

const log = createLogger("api:agents:wiki:pages");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(
  request: Request,
  context: any
): Promise<Response> {
  const { agentId } = context.params;
  try {
    // Parse query params
    const url = new URL(request.url);
    const agentKey = url.searchParams.get("agentKey");
    const businessId = url.searchParams.get("businessId");

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

    // Verify agent
    const agent = await verifyAgent(agentId, agentKey);
    if (!agent) {
      return jsonResponse(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Invalid agent credentials" },
        },
        401
      );
    }

    // Parse body
    const body = await request.json();
    const { title, content, parentId } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return jsonResponse(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "title is required and must be non-empty" },
        },
        400
      );
    }

    // Set default content if not provided
    const pageContent = content || "";

    log.info("Agent creating wiki page", {
      agentId,
      businessId,
      title,
      parentId,
      hasContent: !!content,
    });

    let pageId;

    if (parentId) {
      // Create sub-page
      pageId = await convex.mutation(api.wiki.createPage, {
        businessId: businessId as any,
        parentId: parentId as any,
        title: title.trim(),
        content: pageContent,
        createdBy: agentId,
        createdByName: `Agent: ${agent.name}`,
      });

      log.info("Wiki sub-page created by agent", { agentId, pageId, parentId });
    } else {
      // Create root page
      pageId = await convex.mutation(api.wiki.createDepartment, {
        businessId: businessId as any,
        title: title.trim(),
        createdBy: agentId,
        createdByName: `Agent: ${agent.name}`,
      });

      log.info("Wiki root page created by agent", { agentId, pageId });
    }

    return jsonResponse(
      successResponse({
        pageId,
        message: `Wiki page "${title}" created successfully`,
      }),
      201
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}

export async function GET(
  request: Request,
  context: any
): Promise<Response> {
  const { agentId } = context.params;
  try {
    const url = new URL(request.url);
    const agentKey = url.searchParams.get("agentKey");
    const businessId = url.searchParams.get("businessId");

    if (!agentKey || !businessId) {
      return jsonResponse(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "agentKey and businessId are required" },
        },
        400
      );
    }

    // Verify agent
    const agent = await verifyAgent(agentId, agentKey);
    if (!agent) {
      return jsonResponse(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Invalid agent credentials" },
        },
        401
      );
    }

    log.info("Agent fetching wiki tree", { agentId, businessId });

    // Fetch wiki tree for the business
    const tree = await convex.query(api.wiki.getTree, {
      businessId: businessId as any,
    });

    return jsonResponse(
      successResponse({
        pages: tree || [],
        message: "Wiki pages retrieved successfully",
      })
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
