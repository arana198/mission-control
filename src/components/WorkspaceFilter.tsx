"use client";

import React, { useState, useMemo } from "react";
import { useWorkspace } from "./WorkspaceProvider";
import { Search, X } from "lucide-react";

interface WorkspaceFilterProps {
  onFilterChange?: (workspaceId: string | null) => void;
}

/**
 * WorkspaceFilter Component
 * Searchable dropdown filter for global tabs (Workload, Activity, Analytics)
 * Shows all businesses and "All es" option with real-time search
 */
export function WorkspaceFilter({ onFilterChange }: WorkspaceFilterProps) {
  const { businesses } = useWorkspace();
  const [selectedWorkspaceId, setSelectedId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter businesses based on search query
  const filteredes = useMemo(() => {
    if (!searchQuery.trim()) return workspacees;
    const query = searchQuery.toLowerCase();
    return workspacees.filter(
      (b) =>
        b.name.toLowerCase().includes(query) ||
        (b.emoji && query.includes(b.emoji))
    );
  }, [workspacees, searchQuery]);

  const handleSelect = (workspaceId: string | null) => {
    setSelectedId(workspaceId);
    onFilterChange?.(workspaceId);
    setIsOpen(false);
    setSearchQuery("");
  };

  const selectedLabel =
    selectedWorkspaceId === null
      ? "All es"
      : businesses.find((b) => b._id === selectedWorkspaceId)?.name || "All es";

  return (
    <div className="flex items-center gap-2 w-full md:w-auto">
      <span className="text-sm text-muted-foreground hidden md:inline">Showing:</span>
      <div className="relative flex-1 md:flex-none">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full md:w-auto px-3 py-2 rounded-lg border border-input hover:bg-accent transition-colors text-sm font-medium flex items-center justify-between gap-2"
        >
          <span className="truncate">{selectedLabel}</span>
          <span className="text-xs">▼</span>
        </button>

        {isOpen && (
          <div className="absolute top-full mt-1 left-0 right-0 md:left-0 md:right-auto bg-popover border border-input rounded-lg shadow-lg z-50 w-full md:w-56">
            {/* Search Input */}
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search businesses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-sm rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Options */}
            <div className="max-h-64 overflow-y-auto">
              <button
                onClick={() => handleSelect(null)}
                className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                  selectedWorkspaceId === null
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                }`}
              >
                All es
              </button>

              {filteredes.length > 0 ? (
                filteredes.map((workspace) => (
                  <button
                    key={workspace._id}
                    onClick={() => handleSelect(workspace._id)}
                    className={`block w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                      workspace._id === selectedWorkspaceId
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <span>{ workspace.emoji}</span>
                    <span className="truncate">{ workspace.name}</span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-2 text-sm text-muted-foreground">
                  No businesses found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
