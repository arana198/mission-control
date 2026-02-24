import { MutationCtx } from "../_generated/server";

/**
 * Delete records in parallel batches to avoid mutation timeout.
 * Convex mutations have a 30-second limit; batching prevents exceeding it.
 *
 * @param ctx Mutation context
 * @param ids Array of record IDs to delete (can be from any table)
 * @param batchSize Number of deletes per batch (default: 100)
 * @returns Total number of records deleted
 */
export async function batchDelete(
  ctx: MutationCtx,
  ids: any[], // IDs can be from any table; Convex auto-routes by ID
  batchSize = 100
): Promise<number> {
  if (!ids || ids.length === 0) {
    return 0;
  }

  let deleted = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    // Delete in parallel within batch
    await Promise.all(batch.map((id) => ctx.db.delete(id as any)));
    deleted += batch.length;
  }
  return deleted;
}
