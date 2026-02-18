import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge multiple className inputs using clsx and tailwind-merge
 * Idiomatic utility function for combining Tailwind CSS classes with proper conflict resolution
 * @param inputs - CSS class names or objects to merge
 * @returns Merged CSS class string with Tailwind conflicts resolved
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
