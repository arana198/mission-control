"use client";

import { useState, Suspense, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useBusiness } from "./BusinessProvider";
import { ChevronDown, AlertCircle } from "lucide-react";

/**
 * Business Selector Component
 *
 * Dropdown for switching between businesses in the sidebar.
 * Displays current business with emoji and name.
 * On selection, navigates to that business's current tab.
 *
 * Keyboard Navigation (WCAG 2.1):
 * - Space/Enter: Open dropdown
 * - Arrow Up/Down: Navigate options
 * - Home/End: Jump to first/last option
 * - Enter: Select highlighted option
 * - Escape: Close dropdown
 */
function BusinessSelectorContent() {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  let currentBusiness, businesses, setCurrentBusiness, isLoading;

  try {
    const context = useBusiness();
    currentBusiness = context.currentBusiness;
    businesses = context.businesses;
    setCurrentBusiness = context.setCurrentBusiness;
    isLoading = context.isLoading;
  } catch (error) {
    console.error("[BusinessSelector] Failed to get context:", error);
    return (
      <div className="w-full px-3 py-2 rounded-lg border border-red-900/30 bg-red-900/10 text-red-400 flex items-center gap-2 text-xs">
        <AlertCircle className="w-3 h-3" />
        <span>Business selector unavailable</span>
      </div>
    );
  }

  // Extract current tab from pathname (last part after /)
  const pathParts = (pathname || "").split("/").filter(Boolean);
  const isGlobalPath = pathParts[0] === "global";
  const currentTab = pathParts[pathParts.length - 1] || "overview";

  // Global tabs that don't belong to a specific business
  const globalTabs = ["agents", "workload", "activity", "calendar", "brain", "bottlenecks", "analytics", "api-docs"];
  const isCurrentTabGlobal = globalTabs.includes(currentTab);

  // Reset highlighted index when opening
  useEffect(() => {
    if (isOpen) {
      const currentIndex = businesses?.findIndex(
        (b: any) => b._id === currentBusiness?._id
      ) ?? 0;
      setHighlightedIndex(Math.max(0, currentIndex));
    }
  }, [isOpen, businesses, currentBusiness]);

  // Handle Escape key globally
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleGlobalEscape);
    return () => window.removeEventListener("keydown", handleGlobalEscape);
  }, [isOpen]);

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!businesses || businesses.length === 0) return;

    if (!isOpen && (e.key === " " || e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % businesses.length);
        break;

      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + businesses.length) % businesses.length);
        break;

      case "Home":
        e.preventDefault();
        setHighlightedIndex(0);
        break;

      case "End":
        e.preventDefault();
        setHighlightedIndex(businesses.length - 1);
        break;

      case "Enter":
      case " ":
        e.preventDefault();
        handleSelectBusiness(businesses[highlightedIndex]);
        break;

      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
        break;

      default:
        break;
    }
  };

  const handleSelectBusiness = (business: any) => {
    if (business._id === currentBusiness?._id) {
      // No-op if selecting same business
      setIsOpen(false);
      return;
    }

    setCurrentBusiness(business);

    // Navigate based on whether we're on a global or business-scoped tab
    if (isGlobalPath || isCurrentTabGlobal) {
      // Stay in global tabs (they're not business-scoped)
      router.push(`/global/${currentTab}`);
    } else {
      // Navigate to the selected business with current business tab
      router.push(`/${business.slug}/${currentTab}`);
    }

    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Selector Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-input bg-background hover:bg-accent/5 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
        disabled={isLoading || !currentBusiness}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select business, current selection: ${currentBusiness?.name || "None"}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {currentBusiness ? (
            <>
              <span className="text-lg">{currentBusiness.emoji}</span>
              <span className="text-sm font-medium truncate text-foreground">
                {currentBusiness.name}
              </span>
            </>
          ) : isLoading ? (
            <>
              <div className="w-4 h-4 rounded bg-muted-foreground/20 animate-pulse" />
              <div className="h-3 bg-muted-foreground/20 rounded flex-1 animate-pulse" />
            </>
          ) : (
            <span className="text-sm text-muted-foreground italic">Select Business</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 z-50 border border-input rounded-lg bg-popover shadow-md"
          role="listbox"
          aria-label="Business options"
        >
          <div className="max-h-60 overflow-y-auto">
            {businesses && businesses.length > 0 ? (
              businesses.map((business: any, index: number) => (
                <button
                  key={business._id}
                  onClick={() => handleSelectBusiness(business)}
                  onKeyDown={handleKeyDown}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                    highlightedIndex === index
                      ? "bg-blue-100 dark:bg-blue-900/30"
                      : "hover:bg-muted text-foreground"
                  } ${
                    business._id === currentBusiness?._id
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-foreground"
                  }`}
                  style={
                    business._id === currentBusiness?._id
                      ? {}
                      : { borderLeftColor: business.color }
                  }
                  role="option"
                  aria-selected={business._id === currentBusiness?._id}
                  tabIndex={highlightedIndex === index ? 0 : -1}
                >
                  <span className="text-lg">{business.emoji}</span>
                  <div className="flex-1 text-left">
                    <div className="font-medium">{business.name}</div>
                    {business.isDefault && (
                      <div className="text-xs opacity-70">Default</div>
                    )}
                  </div>
                  {business._id === currentBusiness?._id && (
                    <span className="text-sm">✓</span>
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No businesses available
              </div>
            )}
          </div>
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

export function BusinessSelector() {
  return (
    <Suspense
      fallback={
        <div className="w-full px-3 py-2 rounded-lg border border-input bg-muted text-muted-foreground animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-muted-foreground/20" />
            <div className="h-3 bg-muted-foreground/20 rounded flex-1" />
          </div>
        </div>
      }
    >
      <BusinessSelectorContent />
    </Suspense>
  );
}
