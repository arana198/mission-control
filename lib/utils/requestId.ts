/**
 * Request ID Generation Utility
 * Generates unique, traceable request IDs for all API operations
 *
 * Format: req_<timestamp>_<random>
 * Example: req_1708788000123_a7k3x9m2
 */

/**
 * Generate a unique request ID for tracing
 * Format: req_<timestamp>_<random>
 */
export function generateRequestId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${random}`;
}

/**
 * Extract timestamp from a request ID
 * Useful for debugging and understanding request age
 */
export function getRequestIdAge(requestId: string): number {
  const match = requestId.match(/^req_(\d+)_/);
  if (!match) return -1;

  const timestamp = parseInt(match[1], 10);
  return Date.now() - timestamp;
}

/**
 * Validate format of a request ID
 */
export function isValidRequestId(requestId: string): boolean {
  return /^req_\d+_[a-z0-9]+$/.test(requestId);
}
