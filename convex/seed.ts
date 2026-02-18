import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Database Seeding
 * Initialize the 10-agent squad with lowercase names
 */

const AGENTS: any[] = [];

// Helper function to seed agents (shared logic)
async function seedAgentsHandler(ctx: any) {
  // Delete all existing agents
  const existing = await ctx.db.query("agents").collect();
  for (const agent of existing) {
    await ctx.db.delete(agent._id);
  }
  
  // Insert fresh lowercase agents (only fields in schema)
  for (const agent of AGENTS) {
    await ctx.db.insert("agents", {
      ...agent,
      lastHeartbeat: Date.now(),
    });
  }
  
  return { agents: AGENTS.length, message: "Agents re-seeded with lowercase names" };
}

// Clear and re-seed agents with lowercase names
export const seedAgents = mutation({
  args: {},
  handler: seedAgentsHandler,
});

// Seed all data
export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    await seedAgentsHandler(ctx);
    return { agents: AGENTS.length, message: "Database re-seeded with lowercase names" };
  },
});
