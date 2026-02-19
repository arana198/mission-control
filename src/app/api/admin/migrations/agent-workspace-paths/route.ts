/**
 * POST /api/admin/migrations/agent-workspace-paths
 *
 * Run migration MIG-05: Add workspace paths to agents
 * This is an admin-only endpoint to run the agent workspace paths migration
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { jsonResponse } from "@/lib/utils/apiResponse";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("api:admin:migrations:agent-workspace-paths");

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const { defaultWorkspacePath = "/Users/arana/.openclaw/workspace" } = body;

    log.info("Running agent workspace paths migration", {
      defaultWorkspacePath,
    });

    // Run migration
    const result = await convex.mutation(api.migrations.migrationAgentWorkspacePaths, {
      defaultWorkspacePath,
    });

    log.info("Migration completed", result);

    return jsonResponse(
      {
        success: true,
        data: {
          updated: result.updated,
          total: result.total,
          message: result.message,
        },
      },
      200
    );
  } catch (error) {
    log.error("Migration failed", { error });
    return jsonResponse(
      {
        success: false,
        error: {
          code: "MIGRATION_ERROR",
          message: error instanceof Error ? error.message : "Migration failed",
        },
      },
      500
    );
  }
}
