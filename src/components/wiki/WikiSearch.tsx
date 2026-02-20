"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import type { WikiPage } from "@/convex/wiki";

interface WikiSearchProps {
  isOpen: boolean;
  results: WikiPage[];
  onClose: () => void;
  onSelectPage: (pageId: string) => void;
  onSearch: (query: string) => void;
  allPages: WikiPage[];
}

/**
 * WikiSearch - Cmd+K search overlay
 * Provides full-text search across all wiki pages
 */
export function WikiSearch({
  isOpen,
  results,
  onClose,
  onSelectPage,
  onSearch,
  allPages,
}: WikiSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // Open/close will be handled by parent
      }
      if (!isOpen) return;

      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            onSelectPage(results[selectedIndex]._id);
            onClose();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose, onSelectPage]);

  // Handle search input
  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(0);
    onSearch(value);
  };

  // Build breadcrumb for a page
  const getBreadcrumb = (page: WikiPage): string => {
    const path: string[] = [page.title];
    let currentId = page.parentId;

    while (currentId) {
      const parent = allPages.find((p) => p._id === currentId);
      if (!parent) break;
      path.unshift(parent.title);
      currentId = parent.parentId;
    }

    return path.join(" / ");
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Search dialog */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50">
        <div className="bg-background rounded-lg shadow-lg overflow-hidden border">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search pages..."
              className="flex-1 bg-transparent border-0 focus:outline-none text-lg"
            />
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {results.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {query ? "No pages found" : "Start typing to search..."}
              </div>
            ) : (
              <div className="py-2">
                {results.map((page, index) => (
                  <button
                    key={page._id}
                    onClick={() => {
                      onSelectPage(page._id);
                      onClose();
                    }}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      index === selectedIndex
                        ? "bg-primary/10"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {page.emoji && <span className="text-lg">{page.emoji}</span>}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{page.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {getBreadcrumb(page)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 bg-muted/30 border-t text-xs text-muted-foreground flex justify-between">
            <span>↑↓ to navigate • ⏎ to select • ESC to close</span>
          </div>
        </div>
      </div>
    </>
  );
}
