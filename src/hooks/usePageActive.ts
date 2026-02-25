/**
 * usePageActive Hook
 * Detects if the page/tab is visible and focused
 *
 * Pauses all polling intervals when the tab is hidden or not focused
 * to prevent unnecessary network calls and connection exhaustion when
 * users have multiple tabs open.
 *
 * Returns true when:
 * - Document is visible (visibilitychange event not "hidden")
 * - AND window has focus (blur/focus events)
 */

import { useState, useEffect } from 'react';

interface UsePageActiveReturn {
  isActive: boolean;
}

export function usePageActive(): UsePageActiveReturn {
  const [isActive, setIsActive] = useState<boolean>(() => {
    // Initial state: check if page is visible and focused
    if (typeof document === 'undefined') {
      return true; // SSR safety
    }
    return !document.hidden;
  });

  useEffect(() => {
    // Handle visibility change (tab switch)
    const handleVisibilityChange = () => {
      setIsActive(!document.hidden);
    };

    // Handle window blur (loses focus)
    const handleBlur = () => {
      setIsActive(false);
    };

    // Handle window focus (gains focus)
    const handleFocus = () => {
      // Check visibility again when regaining focus
      setIsActive(!document.hidden);
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return { isActive };
}
