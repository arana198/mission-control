/**
 * Ticket ID Extraction Utility
 * Pure function to extract ticket IDs from text using regex patterns
 */

/**
 * Extract ticket IDs from text using pattern
 * @param message - Text to search
 * @param pattern - Regex pattern (e.g., "[A-Za-z]+-\\d+")
 * @returns Array of unique uppercase ticket IDs
 */
export function extractTicketIds(message: string, pattern: string): string[] {
  try {
    const regex = new RegExp(pattern, "gi");
    const matches = message.match(regex);
    return matches ? [...new Set(matches.map((m: string) => m.toUpperCase()))] : [];
  } catch {
    return [];
  }
}
