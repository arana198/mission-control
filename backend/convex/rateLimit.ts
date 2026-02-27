/**
 * Rate Limiting Module
 * Token bucket implementation for per-API-key quota tracking
 */

import { mutation, query } from "./_generated/server";
import { v as convexVal } from "convex/values";
import { RateLimitState, RateLimitCheckResult } from "./types";

const DEFAULT_TOKENS_PER_HOUR = 1000;
const DEFAULT_TOKENS_PER_DAY = 10000;
const ADMIN_TOKENS_PER_HOUR = 5000;
const ADMIN_TOKENS_PER_DAY = 50000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calculate refilled tokens based on elapsed time
 * Uses token bucket algorithm: refill rate based on time passed since last reset
 */
function calculateRefillTokens(
  currentTokens: number,
  tokensPerHour: number,
  tokensPerDay: number,
  hourlyResetAt: number,
  dailyResetAt: number,
  now: number
): {
  refilled: number;
  newHourlyResetAt: number;
  newDailyResetAt: number;
} {
  let refilled = currentTokens;
  let newHourlyResetAt = hourlyResetAt;
  let newDailyResetAt = dailyResetAt;

  // Check if hourly reset should happen
  if (now >= hourlyResetAt) {
    refilled = tokensPerHour;
    newHourlyResetAt = now + HOUR_MS;
  }

  // Check if daily reset should happen (hard cap)
  if (now >= dailyResetAt) {
    refilled = Math.min(tokensPerDay, refilled);
    newDailyResetAt = now + DAY_MS;
  }

  return {
    refilled,
    newHourlyResetAt,
    newDailyResetAt,
  };
}

/**
 * Check rate limit and decrement tokens
 * Implements token bucket: returns whether request is allowed and remaining quota
 */
export const checkAndDecrement = mutation({
  args: {
    apiKeyId: convexVal.string(),
    roleTier: convexVal.optional(
      convexVal.union(
        convexVal.literal("admin"),
        convexVal.literal("standard")
      )
    ),
  },
  handler: async (ctx, { apiKeyId, roleTier }): Promise<RateLimitCheckResult> => {
    const now = Date.now();
    const { db } = ctx;

    // Look up existing quota record
    const existing = await db
      .query("apiKeyQuota")
      .withIndex("by_api_key", (q) => q.eq("apiKeyId", apiKeyId))
      .first();

    let record: RateLimitState;

    if (!existing) {
      // Initialize new quota record (first request for this API key)
      // Use role-based limits: admin tier gets higher limits
      const tokensPerHour = roleTier === "admin" ? ADMIN_TOKENS_PER_HOUR : DEFAULT_TOKENS_PER_HOUR;
      const tokensPerDay = roleTier === "admin" ? ADMIN_TOKENS_PER_DAY : DEFAULT_TOKENS_PER_DAY;

      record = {
        apiKeyId,
        tokensRemaining: tokensPerHour - 1, // Use 1 token for this request
        tokensPerHour,
        tokensPerDay,
        hourlyResetAt: now + HOUR_MS,
        dailyResetAt: now + DAY_MS,
        createdAt: now,
        updatedAt: now,
      };

      // Save new record
      await db.insert("apiKeyQuota", {
        apiKeyId: record.apiKeyId,
        tokensRemaining: record.tokensRemaining,
        tokensPerHour: record.tokensPerHour,
        tokensPerDay: record.tokensPerDay,
        hourlyResetAt: record.hourlyResetAt,
        dailyResetAt: record.dailyResetAt,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });

      return {
        allowed: true,
        remaining: record.tokensRemaining,
        resetAt: record.hourlyResetAt,
      };
    }

    // Apply refill based on elapsed time
    const { refilled, newHourlyResetAt, newDailyResetAt } = calculateRefillTokens(
      existing.tokensRemaining,
      existing.tokensPerHour,
      existing.tokensPerDay,
      existing.hourlyResetAt,
      existing.dailyResetAt,
      now
    );

    // Decrement for current request
    const tokensAfterDecrement = refilled - 1;
    const allowed = tokensAfterDecrement >= 0;

    // Update the record atomically
    await db.patch(existing._id, {
      tokensRemaining: Math.max(0, tokensAfterDecrement),
      hourlyResetAt: newHourlyResetAt,
      dailyResetAt: newDailyResetAt,
      updatedAt: now,
    });

    return {
      allowed,
      remaining: Math.max(0, tokensAfterDecrement),
      resetAt: newHourlyResetAt,
    };
  },
});

/**
 * Get current quota status (for monitoring/debugging)
 */
export const getQuotaStatus = query({
  args: { apiKeyId: convexVal.string() },
  handler: async (ctx, { apiKeyId }): Promise<RateLimitState | null> => {
    const { db } = ctx;

    const record = await db
      .query("apiKeyQuota")
      .withIndex("by_api_key", (q) => q.eq("apiKeyId", apiKeyId))
      .first();

    if (!record) {
      return null;
    }

    return {
      apiKeyId: record.apiKeyId,
      tokensRemaining: record.tokensRemaining,
      tokensPerHour: record.tokensPerHour,
      tokensPerDay: record.tokensPerDay,
      hourlyResetAt: record.hourlyResetAt,
      dailyResetAt: record.dailyResetAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  },
});
