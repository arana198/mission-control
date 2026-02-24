import { query, mutation, action } from "./_generated/server";
import { v as convexVal } from "convex/values";
import { api } from "./_generated/api";
import { extractTicketIds } from "./utils/ticketId";

/**
 * GitHub Integration - Commit Linking
 * Fetches commits and matches against ticket patterns
 */

// Default pattern - matches CORE-01, PERF-01, spot-001, EPUK-1, etc.
const DEFAULT_TICKET_PATTERN = "[A-Za-z]+-\\d+";

/**
 * Internal: fetch commits from local git (using spawnSync to avoid shell injection)
 */
async function fetchLocalCommitsInternal(repoPath: string, limit: number): Promise<any[]> {
  try {
    const { spawnSync } = await import("child_process");
    const result = spawnSync("git",
      ["log", `--oneline`, `-${limit}`, `--format=%H|%s|%an|%ai`],
      { cwd: repoPath, encoding: "utf-8" }
    );

    if (result.error || result.status !== 0) {
      return [];
    }

    const output = result.stdout || "";
    return output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line: string) => {
        const [sha, message, author, date] = line.split("|");
        return { sha: sha.slice(0, 7), fullSha: sha, message, author, date };
      });
  } catch {
    return [];
  }
}

/**
 * Save settings value
 * Supports both global (no businessId) and business-scoped (with businessId)
 */
export const setSetting = mutation({
  args: {
    key: convexVal.string(),
    value: convexVal.string(),
    businessId: convexVal.optional(convexVal.id("businesses")),
  },
  handler: async (ctx, { key, value, businessId }) => {
    let existing;

    if (businessId) {
      // Business-scoped setting
      existing = await ctx.db
        .query("settings")
        .withIndex("by_business_key", (indexQuery: any) =>
          indexQuery.eq("businessId", businessId).eq("key", key)
        )
        .first();
    } else {
      // Global setting (no businessId)
      const allMatching = await ctx.db
        .query("settings")
        .withIndex("by_key", (indexQuery: any) => indexQuery.eq("key", key))
        .collect();
      existing = allMatching.find((s: any) => !s.businessId);
    }

    if (existing) {
      await ctx.db.patch(existing._id, { value, updatedAt: Date.now() });
      return existing._id;
    } else {
      return await ctx.db.insert("settings", {
        key,
        value,
        businessId: businessId || undefined,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Get setting value
 * Supports both global (no businessId) and business-scoped (with businessId)
 */
export const getSetting = query({
  args: {
    key: convexVal.string(),
    businessId: convexVal.optional(convexVal.id("businesses")),
  },
  handler: async (ctx, { key, businessId }) => {
    let setting;

    if (businessId) {
      // Business-scoped setting
      setting = await ctx.db
        .query("settings")
        .withIndex("by_business_key", (indexQuery: any) =>
          indexQuery.eq("businessId", businessId).eq("key", key)
        )
        .first();
    } else {
      // Global setting (no businessId)
      const allMatching = await ctx.db
        .query("settings")
        .withIndex("by_key", (indexQuery: any) => indexQuery.eq("key", key))
        .collect();
      setting = allMatching.find((s: any) => !s.businessId);
    }

    return setting?.value || null;
  },
});

/**
 * Get ticket pattern (with default fallback)
 */
export const getTicketPattern = query({
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q: any) => q.eq("key", "ticketPattern"))
      .first();
    return setting?.value || DEFAULT_TICKET_PATTERN;
  },
});

/**
 * Fetch commits from GitHub API
 * GH-01: Robust JSON parsing with error handling
 * GH-02: Commit message caching to reduce API calls
 * GH-03: Rate limiting to prevent hitting API limits
 */
export const fetchGitHubCommits: any = action({
  args: {
    repo: convexVal.optional(convexVal.string()),
    limit: convexVal.optional(convexVal.number()),
    skipCache: convexVal.optional(convexVal.boolean()),
  },
  handler: async (ctx, { repo, limit = 50, skipCache = false }) => {
    // Get repo from settings if not provided
    if (!repo) {
      const setting = await ctx.runQuery(api.github.getSetting, { key: "githubRepo" });
      repo = setting || undefined;
    }

    if (!repo) {
      return { error: "No GitHub repo configured. Set via settings table." };
    }

    // Validate repo format to prevent shell injection: must be "owner/repo"
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)) {
      return { error: "Invalid repo format. Must be 'owner/repo'." };
    }

    // GH-03: Check rate limit - enforce minimum 2 seconds between API calls
    const rateLimitKey = "github_last_api_call";
    const lastCallStr = await ctx.runQuery(api.github.getSetting, { key: rateLimitKey });
    const lastCall = lastCallStr ? parseInt(lastCallStr) : 0;
    const timeSinceLastCall = Date.now() - lastCall;
    const minIntervalMs = 2000; // 2 second minimum between API calls

    if (timeSinceLastCall < minIntervalMs && !skipCache) {
      // Within rate limit window, return cached result if available
      const cacheKey = `github_commits_${repo}_${limit}`;
      const cached = await ctx.runQuery(api.github.getSetting, { key: cacheKey });
      if (cached) {
        try {
          const cacheEntry = JSON.parse(cached);
          return { commits: cacheEntry.commits, source: "cache", fromCache: true, rateLimited: true };
        } catch {
          // Fall through to fetch
        }
      }
      return { error: `Rate limited. Please wait ${Math.ceil((minIntervalMs - timeSinceLastCall) / 1000)}s before retrying.`, rateLimited: true };
    }

    // GH-02: Check cache first (5-minute TTL)
    const cacheKey = `github_commits_${repo}_${limit}`;
    if (!skipCache) {
      const cached = await ctx.runQuery(api.github.getSetting, { key: cacheKey });
      if (cached) {
        try {
          const cacheEntry = JSON.parse(cached);
          if (Date.now() - cacheEntry.timestamp < 5 * 60 * 1000) {
            return { commits: cacheEntry.commits, source: "cache", fromCache: true };
          }
        } catch {
          // Invalid cache, continue to fetch
        }
      }
    }

    try {
      const { spawnSync } = await import("child_process");
      const jqFilter = '.[] | {sha: .sha, message: .commit.message, author: .commit.author.name, date: .commit.author.date}';
      const result = spawnSync("gh",
        ["api", `repos/${repo}/commits`, "--jq", jqFilter, "--limit", String(limit)],
        { encoding: "utf-8" }
      );

      if (result.error || result.status !== 0) {
        return { error: "Failed to fetch from GitHub API" };
      }

      const output = result.stdout || "";
      const commits: any[] = [];

      // GH-01: Parse JSON objects line by line to handle incomplete output
      const lines = output.split("\n").filter((l: string) => l.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          commits.push(parsed);
        } catch {
          // Skip invalid JSON lines instead of failing entire request
          continue;
        }
      }

      // GH-02: Cache the result
      await ctx.runMutation(api.github.setSetting, {
        key: cacheKey,
        value: JSON.stringify({ commits, timestamp: Date.now() }),
      });

      // GH-03: Update last API call timestamp
      await ctx.runMutation(api.github.setSetting, {
        key: rateLimitKey,
        value: String(Date.now()),
      });

      return { commits, source: "github", fromCache: false };
    } catch (e) {
      return { error: "Failed to fetch from GitHub API" };
    }
  },
});

/**
 * Fetch commits from local git
 */
export const fetchLocalCommits: any = action({
  args: {
    repoPath: convexVal.optional(convexVal.string()),
    limit: convexVal.optional(convexVal.number()),
  },
  handler: async (ctx, { repoPath, limit = 50 }) => {
    const path = repoPath || process.cwd();
    const commits = await fetchLocalCommitsInternal(path, limit);
    return { commits, source: "local" };
  },
});

/**
 * Get commits for a task - fetches from GitHub API and filters by ticket ID
 * Uses task title, tags, and ticketNumber to find matching commits
 */
export const getCommitsForTask: any = action({
  args: {
    taskId: convexVal.id("tasks"),
    limit: convexVal.optional(convexVal.number()),
  },
  handler: async (ctx, { taskId, limit = 20 }) => {
    // Get task
    const task = await ctx.runQuery(api.tasks.getTaskById, { taskId });
    if (!task) {
      return { commits: [], receipts: [], error: "Task not found" };
    }

    // Extract ticket IDs from task title, tags, and ticketNumber
    // Get ticket prefix and custom pattern from settings
    const ticketPrefix = await ctx.runQuery((api as any).github.getSetting, { key: "ticketPrefix", businessId: (task as any).businessId });
    const customPattern = await ctx.runQuery((api as any).github.getSetting, { key: "ticketPattern", businessId: (task as any).businessId });

    // Derive pattern from prefix if no custom pattern is set
    let pattern = DEFAULT_TICKET_PATTERN;
    if (customPattern) {
      pattern = customPattern;
    } else if (ticketPrefix) {
      pattern = `${ticketPrefix}-\\d+`;
    }

    const ticketIds: string[] = [];

    // From title
    ticketIds.push(...extractTicketIds(task.title, pattern));

    // From tags
    for (const tag of task.tags || []) {
      ticketIds.push(...extractTicketIds(tag, pattern));
    }

    // From ticketNumber (e.g., "MC-001") - add directly
    if (task.ticketNumber) {
      const normalized = task.ticketNumber.toUpperCase();
      if (!ticketIds.includes(normalized)) {
        ticketIds.push(normalized);
      }
    }

    // Remove duplicates
    const uniqueTicketIds = [...new Set(ticketIds)];

    if (uniqueTicketIds.length === 0) {
      return {
        commits: [],
        receipts: task.receipts || [],
        matchedTicketIds: [],
        message: "No ticket ID on task",
      };
    }

    // Get GitHub repo from settings
    const repo = await ctx.runQuery(api.github.getSetting, { key: "githubRepo" });
    if (!repo) {
      return {
        commits: [],
        receipts: task.receipts || [],
        matchedTicketIds: uniqueTicketIds,
        error: "No GitHub repo configured. Configure in business settings.",
      };
    }

    // Fetch commits from GitHub API
    const result = await ctx.runAction((api as any).github.fetchGitHubCommits, {
      repo,
      limit: 100,
    });

    if (result.error) {
      return {
        commits: [],
        receipts: task.receipts || [],
        matchedTicketIds: uniqueTicketIds,
        error: result.error,
      };
    }

    // Filter commits that mention any ticket ID
    const matched = (result.commits || [])
      .filter((c: any) => {
        const txt = (c.message || "").toLowerCase();
        return uniqueTicketIds.some((id) => txt.includes(id.toLowerCase()));
      })
      .slice(0, limit);

    return {
      commits: matched,
      receipts: task.receipts || [],
      source: result.source || "github",
      matchedTicketIds: uniqueTicketIds,
      repo,
      fromCache: result.fromCache,
    };
  },
});
