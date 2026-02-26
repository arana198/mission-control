/**
 * Cursor Pagination Tests
 * Tests base64 encoding/decoding, expiration, and pagination responses
 */

import {
  encodeCursor,
  decodeCursor,
  isCursorExpired,
  validateCursor,
  CursorError,
  normalizeLimit,
  createPaginatedResponse,
  parsePaginationParams,
  testCursorRoundTrip,
} from "../pagination";

// Mock Date for testing expiration
const mockDate = new Date("2026-02-26T12:00:00Z");
const mockTimestamp = mockDate.getTime();

describe("Cursor Pagination", () => {
  describe("encodeCursor", () => {
    it("should encode offset to base64 cursor", () => {
      const cursor = encodeCursor(20, mockDate);
      expect(cursor).toMatch(/^[A-Za-z0-9+/=]+$/); // Valid base64
    });

    it("should include offset in encoded cursor", () => {
      const cursor = encodeCursor(42, mockDate);
      const decoded = Buffer.from(cursor, "base64").toString("utf8");
      expect(decoded).toContain("offset:42");
    });

    it("should use current timestamp by default", () => {
      const before = Date.now();
      const cursor = encodeCursor(10);
      const after = Date.now();

      expect(cursor).toBeDefined();
      expect(cursor).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it("should handle offset of 0", () => {
      const cursor = encodeCursor(0, mockDate);
      const decoded = decodeCursor(cursor);
      expect(decoded.offset).toBe(0);
    });

    it("should handle large offsets", () => {
      const largeOffset = 1000000;
      const cursor = encodeCursor(largeOffset, mockDate);
      const decoded = decodeCursor(cursor);
      expect(decoded.offset).toBe(largeOffset);
    });
  });

  describe("decodeCursor", () => {
    it("should decode valid base64 cursor", () => {
      const cursor = encodeCursor(20, mockDate);
      const decoded = decodeCursor(cursor);

      expect(decoded.offset).toBe(20);
      expect(decoded.createdAt).toBe(mockTimestamp);
    });

    it("should throw on invalid base64", () => {
      expect(() => decodeCursor("invalid-base64!!!")).toThrow(CursorError);
    });

    it("should throw on malformed cursor format", () => {
      const invalidCursor = Buffer.from("invalid:format").toString("base64");
      expect(() => decodeCursor(invalidCursor)).toThrow(CursorError);
    });

    it("should throw on non-numeric offset", () => {
      const invalidCursor = Buffer.from("offset:abc:createdAt:123").toString("base64");
      expect(() => decodeCursor(invalidCursor)).toThrow(CursorError);
    });

    it("should throw on non-numeric timestamp", () => {
      const invalidCursor = Buffer.from("offset:20:createdAt:abc").toString("base64");
      expect(() => decodeCursor(invalidCursor)).toThrow(CursorError);
    });

    it("should round-trip correctly", () => {
      const offset = 50;
      const encoded = encodeCursor(offset, mockDate);
      const decoded = decodeCursor(encoded);

      expect(decoded.offset).toBe(offset);
      expect(decoded.createdAt).toBe(mockTimestamp);
    });
  });

  describe("isCursorExpired", () => {
    it("should return false for fresh cursor", () => {
      const now = new Date();
      const cursor = encodeCursor(10, now);
      const expired = isCursorExpired(cursor, 300); // 5 minutes

      expect(expired).toBe(false);
    });

    it("should return true for expired cursor", () => {
      // Create cursor from 6 minutes ago
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      const cursor = encodeCursor(10, sixMinutesAgo);
      const expired = isCursorExpired(cursor, 300); // 5 minutes

      expect(expired).toBe(true);
    });

    it("should respect custom expiration time", () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const cursor = encodeCursor(10, twoMinutesAgo);

      // Should not expire with 5 minute window
      expect(isCursorExpired(cursor, 300)).toBe(false);

      // Should expire with 1 minute window
      expect(isCursorExpired(cursor, 60)).toBe(true);
    });

    it("should return true for invalid cursor", () => {
      const invalid = "not-a-valid-cursor";
      const expired = isCursorExpired(invalid);

      expect(expired).toBe(true);
    });

    it("should return true for malformed cursor", () => {
      const malformed = Buffer.from("broken:data").toString("base64");
      const expired = isCursorExpired(malformed);

      expect(expired).toBe(true);
    });
  });

  describe("validateCursor", () => {
    it("should validate fresh cursor", () => {
      const now = new Date();
      const cursor = encodeCursor(20, now);
      const decoded = validateCursor(cursor);

      expect(decoded.offset).toBe(20);
    });

    it("should throw on expired cursor", () => {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      const cursor = encodeCursor(10, sixMinutesAgo);

      expect(() => validateCursor(cursor, 300)).toThrow(CursorError);
      expect(() => validateCursor(cursor, 300)).toThrow(/expired/i);
    });

    it("should throw on invalid cursor", () => {
      expect(() => validateCursor("invalid")).toThrow(CursorError);
    });

    it("should throw with message about cursor expiration", () => {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      const cursor = encodeCursor(10, sixMinutesAgo);

      try {
        validateCursor(cursor);
        fail("Should have thrown");
      } catch (err) {
        expect((err as CursorError).message).toContain("Cursor expired");
      }
    });
  });

  describe("normalizeLimit", () => {
    it("should use default limit if not provided", () => {
      expect(normalizeLimit()).toBe(20);
    });

    it("should cap limit at maximum", () => {
      expect(normalizeLimit(200)).toBe(100);
      expect(normalizeLimit(1000)).toBe(100);
    });

    it("should enforce minimum of 1", () => {
      expect(normalizeLimit(0)).toBe(1);
      expect(normalizeLimit(-10)).toBe(1);
    });

    it("should pass through valid limits", () => {
      expect(normalizeLimit(25)).toBe(25);
      expect(normalizeLimit(50)).toBe(50);
      expect(normalizeLimit(100)).toBe(100);
    });

    it("should handle edge case limits", () => {
      expect(normalizeLimit(1)).toBe(1);
      expect(normalizeLimit(100)).toBe(100);
    });
  });

  describe("createPaginatedResponse", () => {
    it("should create paginated response with hasMore=true", () => {
      const items = [1, 2, 3];
      const response = createPaginatedResponse(items, 100, 20, 0);

      expect(response.items).toEqual(items);
      expect(response.pagination.total).toBe(100);
      expect(response.pagination.hasMore).toBe(true);
    });

    it("should create paginated response with hasMore=false", () => {
      const items = [1, 2, 3];
      const response = createPaginatedResponse(items, 3, 20, 0);

      expect(response.pagination.hasMore).toBe(false);
    });

    it("should include cursor information", () => {
      const response = createPaginatedResponse([1, 2], 100, 20, 0);

      expect(response.pagination.cursor).toBeDefined();
      expect(response.pagination.nextCursor).toBeDefined();
    });

    it("should generate nextCursor only if hasMore", () => {
      const response1 = createPaginatedResponse([1, 2], 100, 20, 0);
      expect(response1.pagination.nextCursor).not.toBeNull();

      const response2 = createPaginatedResponse([1, 2], 2, 20, 0);
      expect(response2.pagination.nextCursor).toBeNull();
    });

    it("should normalize limit", () => {
      const response = createPaginatedResponse([1], 100, 200, 0);
      expect(response.pagination.limit).toBe(100); // Capped at max
    });

    it("should handle empty results", () => {
      const response = createPaginatedResponse([], 0, 20, 0);

      expect(response.items).toEqual([]);
      expect(response.pagination.hasMore).toBe(false);
      expect(response.pagination.nextCursor).toBeNull();
    });

    it("should handle offset calculations", () => {
      const response1 = createPaginatedResponse([1, 2], 100, 20, 0);
      expect(response1.pagination.offset).toBe(0);

      const response2 = createPaginatedResponse([1, 2], 100, 20, 40);
      expect(response2.pagination.offset).toBe(40);
    });
  });

  describe("parsePaginationParams", () => {
    it("should parse limit parameter", () => {
      const params = parsePaginationParams(50);
      expect(params.limit).toBe(50);
    });

    it("should parse cursor parameter", () => {
      const cursor = encodeCursor(20, new Date());
      const params = parsePaginationParams(20, cursor);
      expect(params.offset).toBe(20);
    });

    it("should use default limit if not provided", () => {
      const params = parsePaginationParams();
      expect(params.limit).toBe(20);
    });

    it("should use offset 0 if no cursor", () => {
      const params = parsePaginationParams(20);
      expect(params.offset).toBe(0);
    });

    it("should throw on invalid cursor", () => {
      expect(() => parsePaginationParams(20, "invalid")).toThrow(CursorError);
    });

    it("should throw on expired cursor", () => {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      const cursor = encodeCursor(20, sixMinutesAgo);

      expect(() => parsePaginationParams(20, cursor)).toThrow(CursorError);
    });

    it("should normalize limit", () => {
      const params1 = parsePaginationParams(200);
      expect(params1.limit).toBe(100);

      const params2 = parsePaginationParams(0);
      expect(params2.limit).toBe(1);
    });
  });

  describe("testCursorRoundTrip", () => {
    it("should pass for valid offset", () => {
      expect(testCursorRoundTrip(42)).toBe(true);
    });

    it("should pass for zero offset", () => {
      expect(testCursorRoundTrip(0)).toBe(true);
    });

    it("should pass for large offset", () => {
      expect(testCursorRoundTrip(1000000)).toBe(true);
    });

    it("should use default offset if not provided", () => {
      expect(testCursorRoundTrip()).toBe(true);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle pagination workflow", () => {
      // First page
      const response1 = createPaginatedResponse(
        Array.from({ length: 20 }, (_, i) => i),
        100,
        20,
        0
      );

      expect(response1.pagination.hasMore).toBe(true);
      expect(response1.pagination.nextCursor).not.toBeNull();

      // Parse next cursor
      const nextParams = parsePaginationParams(20, response1.pagination.nextCursor!);
      expect(nextParams.offset).toBe(20);

      // Second page
      const response2 = createPaginatedResponse(
        Array.from({ length: 20 }, (_, i) => i + 20),
        100,
        20,
        20
      );

      expect(response2.pagination.offset).toBe(20);
      expect(response2.pagination.hasMore).toBe(true);
    });

    it("should handle last page correctly", () => {
      // Last page with fewer items
      const lastPage = createPaginatedResponse(
        Array.from({ length: 15 }, (_, i) => i + 85),
        100,
        20,
        85
      );

      expect(lastPage.pagination.hasMore).toBe(false);
      expect(lastPage.pagination.nextCursor).toBeNull();
    });

    it("should handle cursor expiration in pagination", () => {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      const expiredCursor = encodeCursor(20, sixMinutesAgo);

      expect(() => parsePaginationParams(20, expiredCursor)).toThrow(/expired/i);
    });

    it("should handle various limit values in pagination", () => {
      const items = Array.from({ length: 50 }, (_, i) => i);

      const response1 = createPaginatedResponse(items, 200, 25, 0);
      expect(response1.pagination.limit).toBe(25);
      expect(response1.pagination.hasMore).toBe(true);

      const response2 = createPaginatedResponse(items, 200, 100, 0);
      expect(response2.pagination.limit).toBe(100);
      expect(response2.pagination.hasMore).toBe(true);

      const response3 = createPaginatedResponse(items, 50, 50, 0);
      expect(response3.pagination.hasMore).toBe(false);
    });
  });
});
