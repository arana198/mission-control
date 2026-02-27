/**
 * Frontend RBAC Helpers
 * Validates workspace membership via Convex on every request (no caching).
 *
 * Key design decisions (from CONTEXT.md):
 * - Returns 404 (not 403) when access denied (security through obscurity)
 * - Validates on every request — no caching
 * - No cross-workspace queries
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { NotFoundError } from "./errors";
import { generateRequestId } from "./responses";

export type WorkspaceUserRole = "admin" | "agent" | "collaborator" | "viewer";

export interface WorkspaceRoleContext {
  workspaceId: string;
  userId: string;       // The agent ID (from x-api-key-id header)
  userRole: WorkspaceUserRole;
}

/**
 * Validate that userId is a member of workspaceId with at least requiredRole.
 * Throws NotFoundError (404) on any failure — never 403.
 *
 * @param workspaceId - Convex workspace ID from URL path
 * @param userId - Agent ID from x-api-key-id header
 * @param requiredRole - Minimum required role (default: "viewer")
 * @returns WorkspaceRoleContext with validated membership
 * @throws NotFoundError (404) if workspace doesn't exist or user lacks access
 */
export async function requireWorkspaceRole(
  workspaceId: string,
  userId: string,
  requiredRole: WorkspaceUserRole = "viewer"
): Promise<WorkspaceRoleContext> {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  let hasAccess: boolean;
  try {
    hasAccess = await convex.query(api.organizationMembers.hasAccess, {
      workspaceId: workspaceId as any,
      userId,
      requiredRole,
    });
  } catch (err) {
    // Convex error (invalid ID format, etc.) → treat as 404
    throw new NotFoundError(generateRequestId());
  }

  if (!hasAccess) {
    // 404, not 403 (security through obscurity — per locked decision)
    throw new NotFoundError(generateRequestId());
  }

  return {
    workspaceId,
    userId,
    userRole: requiredRole, // Minimum met — actual role returned separately if needed
  };
}
