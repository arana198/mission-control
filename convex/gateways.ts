import { v as convexVal } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Gateways - Distributed Runtime Management
 *
 * Handles:
 * - Gateway CRUD (create, read, update, delete)
 * - Health status tracking
 * - WebSocket connection configuration storage
 *
 * Gateway connections are managed in Next.js API routes (short-lived)
 * This module stores configuration only
 */

/**
 * Get all gateways for a business
 */
export const getByBusiness = query({
  args: {
    businessId: convexVal.id("businesses"),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query("gateways")
      .withIndex("by_business", (q: any) => q.eq("businessId", args.businessId))
      .collect();
  },
});

/**
 * Get single gateway by ID
 */
export const getById = query({
  args: {
    gatewayId: convexVal.id("gateways"),
  },
  async handler(ctx, args) {
    return await ctx.db.get(args.gatewayId);
  },
});

/**
 * Create a new gateway configuration
 */
export const createGateway = mutation({
  args: {
    businessId: convexVal.id("businesses"),
    name: convexVal.string(),
    url: convexVal.string(), // ws:// or wss://
    token: convexVal.optional(convexVal.string()),
    workspaceRoot: convexVal.string(),
    disableDevicePairing: convexVal.boolean(),
    allowInsecureTls: convexVal.boolean(),
  },
  async handler(ctx, args) {
    // Validate URL format
    if (!args.url.startsWith("ws://") && !args.url.startsWith("wss://")) {
      throw new ConvexError("URL must start with ws:// or wss://");
    }

    // Check if name already exists for this business
    const existing = await ctx.db
      .query("gateways")
      .withIndex("by_business", (q: any) => q.eq("businessId", args.businessId))
      .collect();

    if (existing.some((g) => g.name === args.name)) {
      throw new ConvexError(`Gateway with name "${args.name}" already exists`);
    }

    const gatewayId = await ctx.db.insert("gateways", {
      businessId: args.businessId,
      name: args.name,
      url: args.url,
      token: args.token,
      workspaceRoot: args.workspaceRoot,
      disableDevicePairing: args.disableDevicePairing,
      allowInsecureTls: args.allowInsecureTls,
      lastHealthCheck: undefined,
      isHealthy: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return gatewayId;
  },
});

/**
 * Update gateway configuration
 */
export const updateGateway = mutation({
  args: {
    gatewayId: convexVal.id("gateways"),
    name: convexVal.optional(convexVal.string()),
    url: convexVal.optional(convexVal.string()),
    token: convexVal.optional(convexVal.string()),
    workspaceRoot: convexVal.optional(convexVal.string()),
    disableDevicePairing: convexVal.optional(convexVal.boolean()),
    allowInsecureTls: convexVal.optional(convexVal.boolean()),
  },
  async handler(ctx, args) {
    const gateway = await ctx.db.get(args.gatewayId);
    if (!gateway) {
      throw new ConvexError("Gateway not found");
    }

    // Validate URL if provided
    if (args.url && !args.url.startsWith("ws://") && !args.url.startsWith("wss://")) {
      throw new ConvexError("URL must start with ws:// or wss://");
    }

    // Check for name duplicates
    if (args.name && args.name !== gateway.name) {
      const existing = await ctx.db
        .query("gateways")
        .withIndex("by_business", (q: any) => q.eq("businessId", gateway.businessId))
        .collect();

      if (existing.some((g) => g._id !== args.gatewayId && g.name === args.name)) {
        throw new ConvexError(`Gateway with name "${args.name}" already exists`);
      }
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.url !== undefined) updates.url = args.url;
    if (args.token !== undefined) updates.token = args.token;
    if (args.workspaceRoot !== undefined) updates.workspaceRoot = args.workspaceRoot;
    if (args.disableDevicePairing !== undefined) updates.disableDevicePairing = args.disableDevicePairing;
    if (args.allowInsecureTls !== undefined) updates.allowInsecureTls = args.allowInsecureTls;

    await ctx.db.patch(args.gatewayId, updates);
  },
});

/**
 * Delete gateway (only if no agents are provisioned)
 */
export const deleteGateway = mutation({
  args: {
    gatewayId: convexVal.id("gateways"),
  },
  async handler(ctx, args) {
    const gateway = await ctx.db.get(args.gatewayId);
    if (!gateway) {
      throw new ConvexError("Gateway not found");
    }

    // Check if any agents are using this gateway
    const agents = await ctx.db
      .query("agents")
      .collect();

    const agentsUsingGateway = agents.filter((a) => a.gatewayId === args.gatewayId);
    if (agentsUsingGateway.length > 0) {
      throw new ConvexError(
        `Cannot delete gateway: ${agentsUsingGateway.length} agent(s) are provisioned to it`
      );
    }

    await ctx.db.delete(args.gatewayId);
  },
});

/**
 * Update gateway health status (called by health check endpoint)
 */
export const updateHealthStatus = mutation({
  args: {
    gatewayId: convexVal.id("gateways"),
    isHealthy: convexVal.boolean(),
  },
  async handler(ctx, args) {
    const gateway = await ctx.db.get(args.gatewayId);
    if (!gateway) {
      throw new ConvexError("Gateway not found");
    }

    await ctx.db.patch(args.gatewayId, {
      isHealthy: args.isHealthy,
      lastHealthCheck: Date.now(),
    });
  },
});
