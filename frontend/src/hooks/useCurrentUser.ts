"use client";

import { useEffect, useState } from "react";

/**
 * useCurrentUser Hook
 *
 * Generates and persists a local user UUID in localStorage.
 * On first visit: generates UUID v4 and stores as "mc:userId"
 * On subsequent visits: retrieves stored UUID
 *
 * Falls back to "local-user" during SSR (no localStorage in server context)
 *
 * Returns:
 * - userId: string — persistent local user identifier
 * - isLoading: boolean — true while checking localStorage
 */
export function useCurrentUser(): { userId: string; isLoading: boolean } {
  const [userId, setUserId] = useState<string>("local-user");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Generate or retrieve userId from localStorage
    const stored = localStorage.getItem("mc:userId");

    if (stored) {
      setUserId(stored);
    } else {
      // Generate new UUID v4
      const newUserId = generateUUID();
      localStorage.setItem("mc:userId", newUserId);
      setUserId(newUserId);
    }

    setIsLoading(false);
  }, []);

  return { userId, isLoading };
}

/**
 * Generate a UUID v4
 * https://datatracker.ietf.org/doc/html/rfc4122#section-4.4
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
