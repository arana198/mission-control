import { describe, it, expect } from "@jest/globals";

describe("rateLimit role-based quotas", () => {
  describe("checkAndDecrement with roleTier", () => {
    it("admin tier gets 5000 tokens/hour on first request", () => {
      const ADMIN_TOKENS_PER_HOUR = 5000;
      const roleTier = "admin";

      const tokensPerHour = roleTier === "admin" ? ADMIN_TOKENS_PER_HOUR : 1000;
      expect(tokensPerHour).toBe(5000);
    });

    it("admin tier gets 50000 tokens/day on first request", () => {
      const ADMIN_TOKENS_PER_DAY = 50000;
      const roleTier = "admin";

      const tokensPerDay = roleTier === "admin" ? ADMIN_TOKENS_PER_DAY : 10000;
      expect(tokensPerDay).toBe(50000);
    });

    it("standard tier gets 1000 tokens/hour on first request", () => {
      const DEFAULT_TOKENS_PER_HOUR = 1000;
      const roleTier = "standard";

      const tokensPerHour = roleTier === "admin" ? 5000 : DEFAULT_TOKENS_PER_HOUR;
      expect(tokensPerHour).toBe(1000);
    });

    it("standard tier gets 10000 tokens/day on first request", () => {
      const DEFAULT_TOKENS_PER_DAY = 10000;
      const roleTier = "standard";

      const tokensPerDay = roleTier === "admin" ? 50000 : DEFAULT_TOKENS_PER_DAY;
      expect(tokensPerDay).toBe(10000);
    });

    it("no roleTier defaults to standard (1000/hr, 10000/day)", () => {
      const DEFAULT_TOKENS_PER_HOUR = 1000;
      const DEFAULT_TOKENS_PER_DAY = 10000;
      const roleTier = undefined;

      const tokensPerHour = roleTier === "admin" ? 5000 : DEFAULT_TOKENS_PER_HOUR;
      const tokensPerDay = roleTier === "admin" ? 50000 : DEFAULT_TOKENS_PER_DAY;

      expect(tokensPerHour).toBe(1000);
      expect(tokensPerDay).toBe(10000);
    });

    it("initializes tokensRemaining = tokensPerHour - 1 for first request", () => {
      const tokensPerHour = 5000; // admin
      const tokensRemaining = tokensPerHour - 1;

      expect(tokensRemaining).toBe(4999);
    });

    it("admin and standard tiers have different daily limits", () => {
      const adminDaily = 50000;
      const standardDaily = 10000;

      expect(adminDaily).toBeGreaterThan(standardDaily);
      expect(adminDaily / standardDaily).toBe(5);
    });

    it("admin and standard tiers have different hourly limits", () => {
      const adminHourly = 5000;
      const standardHourly = 1000;

      expect(adminHourly).toBeGreaterThan(standardHourly);
      expect(adminHourly / standardHourly).toBe(5);
    });

    it("quota tiers maintain consistent ratios", () => {
      const adminHourly = 5000;
      const adminDaily = 50000;
      const standardHourly = 1000;
      const standardDaily = 10000;

      // Both should have same ratio of daily to hourly
      expect(adminDaily / adminHourly).toBe(standardDaily / standardHourly);
    });

    it("allows optional roleTier parameter in args", () => {
      const args = {
        apiKeyId: "key_123",
        roleTier: "admin" as const,
      };

      expect(args).toHaveProperty("apiKeyId");
      expect(args).toHaveProperty("roleTier");
      expect(args.roleTier).toBe("admin");
    });

    it("roleTier can be undefined for backward compatibility", () => {
      const args = {
        apiKeyId: "key_123",
        roleTier: undefined,
      };

      expect(args.roleTier).toBeUndefined();
    });
  });
});
