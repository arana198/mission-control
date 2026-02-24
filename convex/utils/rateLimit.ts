/**
 * Rate Limiting Utility
 *
 * Uses settings table to track rate limit windows.
 * Pattern: Store key with { count, windowStart }
 * Reset when window expires (now - windowStart > windowMs)
 */

import { mutation, query } from "../_generated/server";
import { v as convexVal } from "convex/values";

/**
 * Check if action is allowed under rate limit
 * @param ctx Convex context
 * @param key Unique rate limit key (e.g., "ratelimit:createTask:${agentId}")
 * @param maxCalls Max calls allowed in window
 * @param windowMs Window duration in milliseconds
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export async function checkRateLimit(
  ctx: any,
  key: string,
  maxCalls: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();

  // Try to find existing rate limit entry
  const settings = await ctx.db
    .query("settings")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .collect();

  const setting = (settings as any[])[0];

  if (!setting) {
    // First call in this window
    await ctx.db.insert("settings", {
      key,
      count: 1,
      windowStart: now,
    });
    return {
      allowed: true,
      remaining: maxCalls - 1,
      resetAt: now + windowMs,
    };
  }

  const elapsedMs = now - (setting.windowStart || now);

  if (elapsedMs > windowMs) {
    // Window expired, reset
    await ctx.db.patch(setting._id, {
      count: 1,
      windowStart: now,
    });
    return {
      allowed: true,
      remaining: maxCalls - 1,
      resetAt: now + windowMs,
    };
  }

  // Still in same window
  if (setting.count >= maxCalls) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: setting.windowStart + windowMs,
    };
  }

  // Increment counter
  await ctx.db.patch(setting._id, {
    count: setting.count + 1,
  });

  return {
    allowed: true,
    remaining: maxCalls - (setting.count + 1),
    resetAt: setting.windowStart + windowMs,
  };
}

/**
 * Mutation wrapper to check rate limit and throw on exceed
 * Use for createTask, updateStatus, etc.
 */
export async function enforceRateLimit(
  ctx: any,
  key: string,
  maxCalls: number,
  windowMs: number,
  errorMessage?: string
): Promise<void> {
  const { allowed } = await checkRateLimit(ctx, key, maxCalls, windowMs);

  if (!allowed) {
    throw new Error(
      errorMessage || `Rate limit exceeded. Max ${maxCalls} calls per ${windowMs / 1000}s`
    );
  }
}

/**
 * Silent rate limit check (no error, returns boolean)
 * Use for heartbeat and non-critical operations
 */
export async function checkRateLimitSilent(
  ctx: any,
  key: string,
  maxCalls: number,
  windowMs: number
): Promise<boolean> {
  const { allowed } = await checkRateLimit(ctx, key, maxCalls, windowMs);
  return allowed;
}

/**
 * Get rate limit status for monitoring
 */
export const getRateLimitStatus = query({
  args: {
    key: convexVal.string(),
  },
  handler: async (ctx, { key }) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q: any) => q.eq("key", key))
      .collect();

    const setting = (settings as any[])[0];

    if (!setting) {
      return {
        key,
        count: 0,
        windowStart: 0,
        status: "no_limit_recorded",
      };
    }

    return {
      key,
      count: setting.count,
      windowStart: setting.windowStart,
      status: "active",
    };
  },
});

/**
 * Clear rate limit for a key (admin use)
 */
export const clearRateLimit = mutation({
  args: {
    key: convexVal.string(),
  },
  handler: async (ctx, { key }) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q: any) => q.eq("key", key))
      .collect();

    const setting = (settings as any[])[0];

    if (setting) {
      await ctx.db.delete(setting._id);
      return { success: true, deleted: key };
    }

    return { success: false, deleted: null };
  },
});
