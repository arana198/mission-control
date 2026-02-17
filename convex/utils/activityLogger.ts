/**
 * Activity Logging Utilities
 * Resolves actor names for consistent activity logging
 */

import { MutationCtx } from "../_generated/server";

/**
 * LOG-01: Resolve actor name from ID
 * Maps system IDs (user, system, jarvis) and agent IDs to human-readable names.
 */
export async function resolveActorName(
  ctx: MutationCtx,
  actorId: string
): Promise<string> {
  // Handle system actors
  if (actorId === "user") return "You";
  if (actorId === "system" || actorId.startsWith("system:")) return "Mission Control";

  // Try to resolve as agent ID
  try {
    const agent = await ctx.db.get(actorId as any);
    if (agent && (agent as any).name) return (agent as any).name;
  } catch {
    // Not a valid Convex ID, fall through
  }

  // Fallback to the raw actor ID
  return actorId;
}
