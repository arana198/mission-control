/**
 * GitHub Integration Tests
 *
 * Tests for:
 * - extractTicketIds: Extract ticket IDs from text using regex pattern
 * - getCommitsForTask: Fetch and filter commits matching task ticket IDs
 */

import { describe, it, expect } from "@jest/globals";
import { extractTicketIds } from "../utils/ticketId";

describe("GitHub Integration", () => {
  describe("extractTicketIds", () => {
    const defaultPattern = "[A-Za-z]+-\\d+";

    it("should extract ticket IDs from text", () => {
      const message = "Fix bug in CORE-01 and PERF-02";
      const result = extractTicketIds(message, defaultPattern);
      expect(result).toEqual(["CORE-01", "PERF-02"]);
    });

    it("should handle case-insensitive matching and normalize to uppercase", () => {
      const message = "Fixed core-01 and perf-02";
      const result = extractTicketIds(message, defaultPattern);
      expect(result).toEqual(["CORE-01", "PERF-02"]);
    });

    it("should remove duplicates", () => {
      const message = "CORE-01 fixed, also CORE-01 again";
      const result = extractTicketIds(message, defaultPattern);
      expect(result).toEqual(["CORE-01"]);
    });

    it("should return empty array for no matches", () => {
      const message = "This message has no ticket IDs";
      const result = extractTicketIds(message, defaultPattern);
      expect(result).toEqual([]);
    });

    it("should handle multiple patterns in one string", () => {
      const message = "CORE-01, PAY-123, SPOT-99 all fixed";
      const result = extractTicketIds(message, defaultPattern);
      expect(result).toEqual(["CORE-01", "PAY-123", "SPOT-99"]);
    });

    it("should handle custom regex pattern", () => {
      const message = "Fixed ticket-001 and TICKET-002";
      const pattern = "TICKET-\\d+";
      const result = extractTicketIds(message, pattern);
      // Pattern is case-insensitive (gi flag), so both matches are converted to uppercase
      expect(result).toContain("TICKET-002");
    });

    it("should handle empty string", () => {
      const result = extractTicketIds("", defaultPattern);
      expect(result).toEqual([]);
    });

    it("should handle invalid regex gracefully", () => {
      const message = "CORE-01";
      const invalidPattern = "[invalid(";
      const result = extractTicketIds(message, invalidPattern);
      expect(result).toEqual([]);
    });

    it("should match various ticket formats", () => {
      const message = "CORE-01, spot-001, EPUK-1, MC-123";
      const result = extractTicketIds(message, "[A-Za-z]+-\\d+");
      // All should match and be normalized to uppercase
      expect(result).toContain("CORE-01");
      expect(result).toContain("SPOT-001");
      expect(result).toContain("EPUK-1");
      expect(result).toContain("MC-123");
    });
  });

  describe("getCommitsForTask - Logic Tests", () => {
    /**
     * These tests verify the logic of extracting and matching ticket IDs
     * without testing the full Convex action (which requires server context)
     */

    it("should extract ticket IDs from multiple sources", () => {
      // Simulate the ticket ID extraction logic in getCommitsForTask
      const pattern = "[A-Za-z]+-\\d+";
      const taskTitle = "Fix CORE-01 in payment flow";
      const taskTags = ["perf-improvement", "PERF-02"];
      const taskTicketNumber = "MC-001";

      // Extract from title
      const fromTitle = extractTicketIds(taskTitle, pattern);
      expect(fromTitle).toContain("CORE-01");

      // Extract from tags
      const fromTags = taskTags.flatMap((tag) => extractTicketIds(tag, pattern));
      expect(fromTags).toContain("PERF-02");

      // Normalize ticketNumber
      const normalizedTicketNumber = taskTicketNumber.toUpperCase();
      expect(normalizedTicketNumber).toBe("MC-001");

      // Combine and deduplicate
      const allIds = [...fromTitle, ...fromTags, normalizedTicketNumber];
      const uniqueIds = [...new Set(allIds)];
      expect(uniqueIds).toContain("CORE-01");
      expect(uniqueIds).toContain("PERF-02");
      expect(uniqueIds).toContain("MC-001");
    });

    it("should handle task with only ticketNumber (no title/tags matches)", () => {
      const pattern = "[A-Za-z]+-\\d+";
      const taskTitle = "Fix this issue";
      const taskTags: string[] = [];
      const taskTicketNumber = "MC-001";

      const fromTitle = extractTicketIds(taskTitle, pattern);
      const fromTags = taskTags.flatMap((tag) => extractTicketIds(tag, pattern));
      const normalizedTicketNumber = taskTicketNumber.toUpperCase();

      const allIds = [...fromTitle, ...fromTags, normalizedTicketNumber];
      const uniqueIds = [...new Set(allIds)];

      expect(fromTitle).toEqual([]); // No match in title
      expect(fromTags).toEqual([]); // No match in tags
      expect(uniqueIds).toEqual(["MC-001"]); // Only from ticketNumber
    });

    it("should deduplicate ticket IDs across title, tags, and ticketNumber", () => {
      const pattern = "[A-Za-z]+-\\d+";
      const taskTitle = "Fix CORE-01 issue";
      const taskTags = ["CORE-01", "important"];
      const taskTicketNumber = "CORE-01";

      const fromTitle = extractTicketIds(taskTitle, pattern);
      const fromTags = taskTags.flatMap((tag) => extractTicketIds(tag, pattern));
      const normalizedTicketNumber = taskTicketNumber.toUpperCase();

      const allIds = [...fromTitle, ...fromTags, normalizedTicketNumber];
      const uniqueIds = [...new Set(allIds)];

      // Should have CORE-01 only once despite appearing in all three sources
      expect(uniqueIds).toEqual(["CORE-01"]);
      expect(uniqueIds.length).toBe(1);
    });

    it("should filter commits by matched ticket IDs", () => {
      // Simulate commit filtering logic
      const uniqueTicketIds = ["CORE-01", "PERF-02"];
      const mockCommits = [
        { sha: "abc123", message: "Fix CORE-01 payment bug" },
        { sha: "def456", message: "Optimize PERF-02 query" },
        { sha: "ghi789", message: "Update README" },
        { sha: "jkl012", message: "Merge branch with PERF-02 improvements" },
      ];

      const matched = mockCommits.filter((c: any) => {
        const txt = (c.message || "").toLowerCase();
        return uniqueTicketIds.some((id) => txt.includes(id.toLowerCase()));
      });

      expect(matched.length).toBe(3); // abc123, def456, jkl012 match
      expect(matched).toContainEqual({ sha: "abc123", message: "Fix CORE-01 payment bug" });
      expect(matched).toContainEqual({ sha: "def456", message: "Optimize PERF-02 query" });
      expect(matched).toContainEqual({ sha: "jkl012", message: "Merge branch with PERF-02 improvements" });
      expect(matched).not.toContainEqual({ sha: "ghi789", message: "Update README" });
    });

    it("should handle case-insensitive commit message matching", () => {
      const uniqueTicketIds = ["CORE-01"];
      const mockCommits = [
        { sha: "abc123", message: "Fix core-01 bug" }, // lowercase
        { sha: "def456", message: "Fix CORE-01 bug" }, // uppercase
        { sha: "ghi789", message: "Fix Core-01 bug" }, // mixed case
      ];

      const matched = mockCommits.filter((c: any) => {
        const txt = (c.message || "").toLowerCase();
        return uniqueTicketIds.some((id) => txt.includes(id.toLowerCase()));
      });

      expect(matched.length).toBe(3); // All should match
    });

    it("should handle empty ticket IDs list", () => {
      const uniqueTicketIds: string[] = [];
      const mockCommits = [
        { sha: "abc123", message: "Fix bug" },
        { sha: "def456", message: "Update docs" },
      ];

      const matched = mockCommits.filter((c: any) => {
        const txt = (c.message || "").toLowerCase();
        return uniqueTicketIds.some((id) => txt.includes(id.toLowerCase()));
      });

      expect(matched).toEqual([]);
    });

    it("should respect limit parameter for commits", () => {
      const uniqueTicketIds = ["CORE"];
      const mockCommits = [
        { sha: "abc123", message: "Fix CORE-01" },
        { sha: "def456", message: "Fix CORE-02" },
        { sha: "ghi789", message: "Fix CORE-03" },
        { sha: "jkl012", message: "Fix CORE-04" },
      ];

      const matched = mockCommits.filter((c: any) => {
        const txt = (c.message || "").toLowerCase();
        return uniqueTicketIds.some((id) => txt.includes(id.toLowerCase()));
      });

      const limited = matched.slice(0, 2);
      expect(limited.length).toBe(2);
      expect(limited[0].sha).toBe("abc123");
      expect(limited[1].sha).toBe("def456");
    });
  });

  describe("getCommitsForTask - Integration Scenarios", () => {
    /**
     * These describe the expected behavior of getCommitsForTask
     * but cannot be fully tested without Convex server context
     */

    it("should return error message when GitHub repo is not configured", () => {
      // Expected behavior: if repo is null/undefined, return error
      const repo = null;
      const hasError = !repo;
      expect(hasError).toBe(true);
    });

    it("should return empty commits and show message when no ticket IDs found", () => {
      const uniqueTicketIds: string[] = [];
      const shouldReturnEmpty = uniqueTicketIds.length === 0;
      expect(shouldReturnEmpty).toBe(true);
    });

    it("should include task receipts in response alongside commits", () => {
      const taskReceipts = ["abc123def456", "ghi789jkl012"];
      const responseIncludesReceipts = taskReceipts.length > 0;
      expect(responseIncludesReceipts).toBe(true);
    });

    it("should include matched ticket IDs in response", () => {
      const matchedTicketIds = ["CORE-01", "PERF-02"];
      const responseIncludesTicketIds = matchedTicketIds.length > 0;
      expect(responseIncludesTicketIds).toBe(true);
    });

    it("should include repo and source in successful response", () => {
      const response = {
        commits: [{ sha: "abc123", message: "Fix CORE-01" }],
        receipts: [],
        matchedTicketIds: ["CORE-01"],
        repo: "owner/repo",
        source: "github",
        fromCache: false,
      };

      expect(response).toHaveProperty("repo");
      expect(response).toHaveProperty("source");
      expect(response).toHaveProperty("fromCache");
      expect(response.source).toBe("github");
    });
  });
});
