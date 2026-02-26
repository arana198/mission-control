/**
 * Cursor-Based Pagination
 * Base64 encoded cursors with 5-minute expiration
 */

export interface DecodedCursor {
  offset: number;
  createdAt: number; // Timestamp in ms
}

export interface PaginationRequest {
  limit?: number;
  cursor?: string;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  cursor: string;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export class CursorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CursorError";
  }
}

// Constants
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const CURSOR_EXPIRATION_SECONDS = 300; // 5 minutes

/**
 * Encode offset and timestamp to base64 cursor
 * Format: base64("offset:{offset}:createdAt:{timestamp}")
 *
 * @param offset The current offset
 * @param createdAt Optional timestamp (defaults to now)
 * @returns Base64 encoded cursor
 */
export function encodeCursor(offset: number, createdAt: Date = new Date()): string {
  const timestamp = createdAt.getTime();
  const cursorData = `offset:${offset}:createdAt:${timestamp}`;
  return Buffer.from(cursorData).toString("base64");
}

/**
 * Decode base64 cursor and extract offset and creation time
 * Returns: { offset: number, createdAt: number }
 *
 * @param cursor Base64 encoded cursor
 * @returns Decoded cursor object
 * @throws CursorError if cursor format is invalid
 */
export function decodeCursor(cursor: string): DecodedCursor {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const parts = decoded.split(":");

    if (parts.length !== 4 || parts[0] !== "offset" || parts[2] !== "createdAt") {
      throw new CursorError("Invalid cursor format");
    }

    const offset = parseInt(parts[1], 10);
    const createdAt = parseInt(parts[3], 10);

    if (isNaN(offset) || isNaN(createdAt)) {
      throw new CursorError("Invalid cursor format");
    }

    return { offset, createdAt };
  } catch (err) {
    if (err instanceof CursorError) {
      throw err;
    }
    throw new CursorError("Invalid cursor format");
  }
}

/**
 * Check if a cursor has expired (older than maxAgeSecs)
 *
 * @param cursor Base64 encoded cursor
 * @param maxAgeSecs Maximum age in seconds (default 300 = 5 minutes)
 * @returns true if cursor is expired, false otherwise
 */
export function isCursorExpired(cursor: string, maxAgeSecs: number = CURSOR_EXPIRATION_SECONDS): boolean {
  try {
    const { createdAt } = decodeCursor(cursor);
    const now = Date.now();
    const ageMs = now - createdAt;
    const ageSecs = ageMs / 1000;

    return ageSecs > maxAgeSecs;
  } catch {
    // Invalid cursor is treated as expired
    return true;
  }
}

/**
 * Validate cursor: decode and check expiration
 * Throws CursorError if invalid or expired
 *
 * @param cursor Base64 encoded cursor
 * @param maxAgeSecs Maximum age in seconds (default 300)
 * @returns Decoded cursor object
 * @throws CursorError if cursor is invalid or expired
 */
export function validateCursor(
  cursor: string,
  maxAgeSecs: number = CURSOR_EXPIRATION_SECONDS
): DecodedCursor {
  const decoded = decodeCursor(cursor); // Will throw if invalid

  if (isCursorExpired(cursor, maxAgeSecs)) {
    throw new CursorError("Cursor expired. Please restart pagination from the beginning.");
  }

  return decoded;
}

/**
 * Normalize limit to be between 1 and MAX_LIMIT
 *
 * @param limit Requested limit
 * @returns Normalized limit
 */
export function normalizeLimit(limit?: number): number {
  if (limit === undefined || limit === null) return DEFAULT_LIMIT;
  if (limit <= 0) return 1;
  if (limit > MAX_LIMIT) return MAX_LIMIT;
  return limit;
}

/**
 * Create a paginated response with cursors
 *
 * @param items Array of items to return
 * @param total Total count of items available
 * @param limit Items per page
 * @param offset Current offset
 * @returns Paginated response with cursor information
 */
export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  limit: number,
  offset: number
): PaginatedResponse<T> {
  const normalizedLimit = normalizeLimit(limit);
  const currentOffset = Math.max(0, offset);
  const hasMore = currentOffset + items.length < total;

  // Current cursor (based on current offset)
  const cursor = encodeCursor(currentOffset);

  // Next cursor (for fetching next page)
  let nextCursor: string | null = null;
  if (hasMore) {
    const nextOffset = currentOffset + items.length;
    nextCursor = encodeCursor(nextOffset);
  }

  return {
    items,
    pagination: {
      total,
      limit: normalizedLimit,
      offset: currentOffset,
      cursor,
      nextCursor,
      hasMore,
    },
  };
}

/**
 * Parse pagination parameters from request
 * Validates and normalizes limit and cursor
 *
 * @param limit Requested limit (1-100, default 20)
 * @param cursor Optional cursor for pagination
 * @returns { offset, limit } for database query
 * @throws CursorError if cursor is invalid or expired
 */
export function parsePaginationParams(
  limit?: number,
  cursor?: string
): { offset: number; limit: number } {
  const normalizedLimit = normalizeLimit(limit);
  let offset = 0;

  if (cursor) {
    try {
      const decoded = validateCursor(cursor);
      offset = decoded.offset;
    } catch (err) {
      // Re-throw cursor errors
      if (err instanceof CursorError) {
        throw err;
      }
      throw new CursorError("Invalid pagination parameters");
    }
  }

  return { offset, limit: normalizedLimit };
}

/**
 * Validate cursor exists in a set of encoded cursors
 * Useful for ensuring cursors haven't been tampered with
 *
 * @param cursor The cursor to validate
 * @param validCursors Set of valid cursor values (usually from previous responses)
 * @returns true if cursor is valid
 */
export function isValidCursor(cursor: string, validCursors: Set<string>): boolean {
  return validCursors.has(cursor);
}

/**
 * Round-trip test: encode then decode
 * Ensures cursor encoding/decoding consistency
 *
 * @param offset Test offset
 * @returns true if round-trip succeeds
 */
export function testCursorRoundTrip(offset: number = 42): boolean {
  try {
    const encoded = encodeCursor(offset);
    const decoded = decodeCursor(encoded);
    return decoded.offset === offset;
  } catch {
    return false;
  }
}
