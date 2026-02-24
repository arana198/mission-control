/**
 * useFocusTrap Hook
 *
 * Manages focus trap for modals and other overlay components.
 * - Traps Tab/Shift+Tab within container
 * - Closes on Escape key
 * - Returns focus to trigger element on unmount
 * - Auto-focuses first focusable element
 *
 * Usage:
 *   const containerRef = useFocusTrap(isOpen, onClose);
 *   return <div ref={containerRef} role="dialog">...</div>
 */

import { useRef, useEffect } from "react";

const FOCUSABLE_SELECTORS = [
  "button",
  "[href]",
  "input",
  "select",
  "textarea",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export function useFocusTrap(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Store reference to element that triggered the modal
    triggerRef.current = document.activeElement as HTMLElement;

    // Auto-focus first focusable element in modal
    const focusableElements = containerRef.current?.querySelectorAll<HTMLElement>(
      FOCUSABLE_SELECTORS
    );

    if (focusableElements && focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    // Cleanup: return focus to trigger element
    return () => {
      if (triggerRef.current && triggerRef.current.focus) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen]);

  // Handle Tab key cycling and Escape
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape closes modal
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      // Tab cycles focus within modal
      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        containerRef.current!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      );

      if (focusableElements.length === 0) return;

      const activeElement = document.activeElement as HTMLElement;
      const currentIndex = focusableElements.indexOf(activeElement);

      if (event.shiftKey) {
        // Shift+Tab: go to previous
        if (currentIndex === 0) {
          event.preventDefault();
          focusableElements[focusableElements.length - 1].focus();
        }
      } else {
        // Tab: go to next
        if (currentIndex === focusableElements.length - 1) {
          event.preventDefault();
          focusableElements[0].focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return containerRef;
}

/**
 * Alternative: useFocusTrapCallback
 * For scenarios where you need more control over focus management
 */
export function useFocusTrapWithCallback(
  isOpen: boolean,
  onClose: () => void,
  onFocusChange?: (element: HTMLElement) => void
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    triggerRef.current = document.activeElement as HTMLElement;

    const focusableElements = containerRef.current?.querySelectorAll<HTMLElement>(
      FOCUSABLE_SELECTORS
    );

    if (focusableElements && focusableElements.length > 0) {
      focusableElements[0].focus();
      onFocusChange?.(focusableElements[0]);
    }

    return () => {
      if (triggerRef.current && triggerRef.current.focus) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, onFocusChange]);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        containerRef.current!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      );

      if (focusableElements.length === 0) return;

      const activeElement = document.activeElement as HTMLElement;
      const currentIndex = focusableElements.indexOf(activeElement);

      if (event.shiftKey) {
        if (currentIndex === 0) {
          event.preventDefault();
          focusableElements[focusableElements.length - 1].focus();
          onFocusChange?.(focusableElements[focusableElements.length - 1]);
        }
      } else {
        if (currentIndex === focusableElements.length - 1) {
          event.preventDefault();
          focusableElements[0].focus();
          onFocusChange?.(focusableElements[0]);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onFocusChange]);

  return containerRef;
}
