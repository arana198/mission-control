/**
 * GET /api/agents/{agentId}/wiki/pages/{pageId}
 * PATCH /api/agents/{agentId}/wiki/pages/{pageId}
 *
 * GET: Fetch a specific wiki page
 * PATCH: Update a wiki page (content, title, status, etc.)
 *
 * Query params:
 *   agentKey (REQUIRED) - Agent authentication key
 *   workspaceId (REQUIRED) -  ID for scoping
 *
 * PATCH body:
 *   title? - New page title
 *   content? - New page content (markdown)
 *
 * Response: { success: true, page: WikiPage }
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

const log = createLogger("api:agents:wiki:page-detail");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(
  request: Request,
  context: any
): Promise<Response> {
  const { agentId, pageId } = context.params;
  try {
    const url = new URL(request.url);
    const agentKey = url.searchParams.get("agentKey");
    const workspaceId = url.searchParams.get("workspaceId");

    if (!agentKey || !workspaceId) {
      return jsonResponse(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "agentKey and workspaceId are required" },
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

    log.info("Agent fetching wiki page", { agentId, pageId });

    const page = await convex.query(api.wiki.getPage, {
      pageId: pageId as any,
    });

    if (!page) {
      return jsonResponse(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Wiki page not found" },
        },
        404
      );
    }

    return jsonResponse(successResponse({ page }));
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}

export async function PATCH(
  request: Request,
  context: any
): Promise<Response> {
  const { agentId, pageId } = context.params;
  try {
    const url = new URL(request.url);
    const agentKey = url.searchParams.get("agentKey");
    const workspaceId = url.searchParams.get("workspaceId");

    if (!agentKey || !workspaceId) {
      return jsonResponse(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "agentKey and workspaceId are required" },
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

    const body = await request.json();
    const { title, content } = body;

    // Get current page to preserve fields
    const currentPage = await convex.query(api.wiki.getPage, {
      pageId: pageId as any,
    });

    if (!currentPage) {
      return jsonResponse(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Wiki page not found" },
        },
        404
      );
    }

    log.info("Agent updating wiki page", { agentId, pageId, hasContent: !!content });

    await convex.mutation(api.wiki.updatePage, {
      pageId: pageId as any,
      title: title ?? currentPage.title,
      content: content ?? currentPage.content,
      updatedBy: agentId,
      updatedByName: `Agent: ${agent.name}`,
    });

    const updatedPage = await convex.query(api.wiki.getPage, {
      pageId: pageId as any,
    });

    return jsonResponse(
      successResponse({
        page: updatedPage,
        message: "Wiki page updated successfully",
      })
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
