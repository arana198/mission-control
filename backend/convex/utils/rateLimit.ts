/**
 * Rate Limiting Utility (Schema-Fixed)
 *
 * Uses settings table to track rate limit windows.
 * Pattern: Store key with value as JSON { count, windowStart }
 * Reset when window expires (now - windowStart > windowMs)
 *
 * SCHEMA FIX: count and windowStart are encoded in the value JSON string,
 * not as direct fields (which aren't in the settings schema).
 */

import { mutation, query } from "../_generated/server";
import { v as convexVal } from "convex/values";

interface RateLimitData {
  count: number;
  windowStart: number;
}

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
    const rateLimitData: RateLimitData = {
      count: 1,
      windowStart: now,
    };
    await ctx.db.insert("settings", {
      key,
      value: JSON.stringify(rateLimitData),
      updatedAt: now,
    });
    return {
      allowed: true,
      remaining: maxCalls - 1,
      resetAt: now + windowMs,
    };
  }

  // Parse the stored rate limit data from JSON
  let rateLimitData: RateLimitData;
  try {
    rateLimitData = JSON.parse(setting.value || "{}");
  } catch {
    // Corrupted data, reset
    rateLimitData = { count: 1, windowStart: now };
  }

  const elapsedMs = now - (rateLimitData.windowStart || now);

  if (elapsedMs > windowMs) {
    // Window expired, reset
    const newData: RateLimitData = {
      count: 1,
      windowStart: now,
    };
    await ctx.db.patch(setting._id, {
      value: JSON.stringify(newData),
      updatedAt: now,
    });
    return {
      allowed: true,
      remaining: maxCalls - 1,
      resetAt: now + windowMs,
    };
  }

  // Still in same window
  if (rateLimitData.count >= maxCalls) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: rateLimitData.windowStart + windowMs,
    };
  }

  // Increment counter
  const updatedData: RateLimitData = {
    count: rateLimitData.count + 1,
    windowStart: rateLimitData.windowStart,
  };
  await ctx.db.patch(setting._id, {
    value: JSON.stringify(updatedData),
    updatedAt: now,
  });

  return {
    allowed: true,
    remaining: maxCalls - (rateLimitData.count + 1),
    resetAt: rateLimitData.windowStart + windowMs,
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

    let rateLimitData: RateLimitData;
    try {
      rateLimitData = JSON.parse(setting.value || "{}");
    } catch {
      return {
        key,
        count: 0,
        windowStart: 0,
        status: "corrupted_data",
      };
    }

    return {
      key,
      count: rateLimitData.count,
      windowStart: rateLimitData.windowStart,
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
