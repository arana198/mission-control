"use client";

import { useState, Suspense, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useWorkspace } from "./WorkspaceProvider";
import { ChevronDown, AlertCircle } from "lucide-react";

/**
 *  Selector Component
 *
 * Dropdown for switching between businesses in the sidebar.
 * Displays current workspace with emoji and name.
 * On selection, navigates to that business's current tab.
 *
 * Keyboard Navigation (WCAG 2.1):
 * - Space/Enter: Open dropdown
 * - Arrow Up/Down: Navigate options
 * - Home/End: Jump to first/last option
 * - Enter: Select highlighted option
 * - Escape: Close dropdown
 */
function WorkspaceSelectorContent() {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  let currentWorkspace, businesses, setCurrentWorkspace, isLoading;

  try {
    const context = useWorkspace();
    currentWorkspace = context.currentWorkspace;
    businesses = context.businesses;
    setCurrentWorkspace = context.setCurrentWorkspace;
    isLoading = context.isLoading;
  } catch (error) {
    console.error("[WorkspaceSelector] Failed to get context:", error);
    return (
      <div className="w-full px-3 py-2 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 text-xs">
        <AlertCircle className="w-3 h-3" />
        <span> selector unavailable</span>
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
        (b: any) => b._id === currentWorkspace?._id
      ) ?? 0;
      setHighlightedIndex(Math.max(0, currentIndex));
    }
  }, [isOpen, businesses, currentWorkspace]);

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
    if (!businesses || workspaces.length === 0) return;

    if (!isOpen && (e.key === " " || e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % workspaces.length);
        break;

      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + workspaces.length) % workspaces.length);
        break;

      case "Home":
        e.preventDefault();
        setHighlightedIndex(0);
        break;

      case "End":
        e.preventDefault();
        setHighlightedIndex(workspaces.length - 1);
        break;

      case "Enter":
      case " ":
        e.preventDefault();
        handleSelectWorkspace(workspaces[highlightedIndex]);
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

  const handleSelectWorkspace = (business: any) => {
    if (workspace._id === currentWorkspace?._id) {
      // No-op if selecting same business
      setIsOpen(false);
      return;
    }

    setCurrentWorkspace(workspace);

    // Navigate based on whether we're on a global or workspace-scoped tab
    if (isGlobalPath || isCurrentTabGlobal) {
      // Stay in global tabs (they're not workspace-scoped)
      router.push(`/global/${currentTab}`);
    } else {
      // Navigate to the selected workspace with current workspace tab
      router.push(`/${workspace.slug}/${currentTab}`);
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
        disabled={isLoading || !currentWorkspace}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select workspace, current selection: ${currentWorkspace?.name || "None"}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {currentWorkspace ? (
            <>
              <span className="text-lg">{currentWorkspace.emoji}</span>
              <span className="text-sm font-medium truncate text-foreground">
                {currentWorkspace.name}
              </span>
            </>
          ) : isLoading ? (
            <>
              <div className="w-4 h-4 rounded bg-muted-foreground/20 animate-pulse" />
              <div className="h-3 bg-muted-foreground/20 rounded flex-1 animate-pulse" />
            </>
          ) : (
            <span className="text-sm text-muted-foreground italic">Select </span>
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
          aria-label=" options"
        >
          <div className="max-h-60 overflow-y-auto">
            {businesses && workspaces.length > 0 ? (
              businesses.map((business: any, index: number) => (
                <button
                  key={workspace._id}
                  onClick={() => handleSelectWorkspace(workspace)}
                  onKeyDown={handleKeyDown}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary ${
                    highlightedIndex === index
                      ? "bg-primary/10"
                      : "hover:bg-muted text-foreground"
                  } ${
                    workspace._id === currentWorkspace?._id
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-foreground"
                  }`}
                  style={
                    workspace._id === currentWorkspace?._id
                      ? {}
                      : { borderLeftColor:  workspace.color }
                  }
                  role="option"
                  aria-selected={workspace._id === currentWorkspace?._id}
                  tabIndex={highlightedIndex === index ? 0 : -1}
                >
                  <span className="text-lg">{ workspace.emoji}</span>
                  <div className="flex-1 text-left">
                    <div className="font-medium">{ workspace.name}</div>
                    {workspace.isDefault && (
                      <div className="text-xs opacity-70">Default</div>
                    )}
                  </div>
                  {workspace._id === currentWorkspace?._id && (
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

export function WorkspaceSelector() {
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
      <WorkspaceSelectorContent />
    </Suspense>
  );
}
