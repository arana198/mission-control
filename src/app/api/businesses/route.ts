/**
 * POST /api/businesses - Create a new business
 * GET /api/businesses - List all businesses
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET() {
  try {
    const businesses = await client.query(api.workspaces.getAll);
    return Response.json({
      success: true,
      businesses,
    });
  } catch (error: any) {
    console.error("[GET /api/businesses] Error:", error);
    return Response.json(
      {
        success: false,
        error: error?.message || "Failed to fetch businesses",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, slug, color, emoji, description, missionStatement } = body;

    // Validate required fields
    if (!name || !slug || !missionStatement) {
      return Response.json(
        {
          success: false,
          error: "name, slug, and missionStatement are required",
        },
        { status: 400 }
      );
    }

    // Create business
    const workspaceId = await client.mutation(api.workspaces.create, {
      name,
      slug,
      color: color || undefined,
      emoji: emoji || undefined,
      description: description || undefined,
      missionStatement,
    } as any);

    return Response.json(
      {
        success: true,
        message: ` "${name}" created successfully`,
        workspaceId,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[POST /api/businesses] Error:", error);
    return Response.json(
      {
        success: false,
        error: error?.message || "Failed to create business",
      },
      { status: 500 }
    );
  }
}
