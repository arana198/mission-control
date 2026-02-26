/**
 * Admin Mutations
 * Public mutations for administrative operations
 */

import { mutation } from "./_generated/server";

/**
 * Clear all data mutation
 * Deletes all records from all tables (development/testing only)
 * Returns: { success: true, deletedCounts: Record<string, number>, totalRecordsDeleted: number }
 */
export const clearAllData = mutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "tasks", "epics", "messages", "activities", "documents",
      "executionLog", "alerts", "alertRules", "alertEvents", "decisions",
      "strategicReports", "settings", "calendarEvents", "taskComments",
      "mentions", "taskSubscriptions", "presenceIndicators", "taskPatterns",
      "anomalies", "wikiPages", "wikiComments", "notifications",
      "threadSubscriptions", "workspaces", "agents", "keys",
    ] as const;

    const deletedCounts: Record<string, number> = {};

    for (const table of tables) {
      const all = await ctx.db.query(table as any).collect();
      for (const doc of all) {
        await ctx.db.delete(doc._id);
      }
      deletedCounts[table] = all.length;
    }

    return {
      success: true,
      deletedCounts,
      totalRecordsDeleted: Object.values(deletedCounts).reduce((a, b) => a + b, 0),
    };
  },
});
