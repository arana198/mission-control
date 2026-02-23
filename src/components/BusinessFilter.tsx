"use client";

import React, { useState, useMemo } from "react";
import { useBusiness } from "./BusinessProvider";
import { Search, X } from "lucide-react";

interface BusinessFilterProps {
  onFilterChange?: (businessId: string | null) => void;
}

/**
 * BusinessFilter Component
 * Searchable dropdown filter for global tabs (Workload, Activity, Analytics)
 * Shows all businesses and "All Businesses" option with real-time search
 */
export function BusinessFilter({ onFilterChange }: BusinessFilterProps) {
  const { businesses } = useBusiness();
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter businesses based on search query
  const filteredBusinesses = useMemo(() => {
    if (!searchQuery.trim()) return businesses;
    const query = searchQuery.toLowerCase();
    return businesses.filter(
      (b) =>
        b.name.toLowerCase().includes(query) ||
        (b.emoji && query.includes(b.emoji))
    );
  }, [businesses, searchQuery]);

  const handleSelect = (businessId: string | null) => {
    setSelectedBusinessId(businessId);
    onFilterChange?.(businessId);
    setIsOpen(false);
    setSearchQuery("");
  };

  const selectedLabel =
    selectedBusinessId === null
      ? "All Businesses"
      : businesses.find((b) => b._id === selectedBusinessId)?.name || "All Businesses";

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
                  selectedBusinessId === null
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                }`}
              >
                All Businesses
              </button>

              {filteredBusinesses.length > 0 ? (
                filteredBusinesses.map((business) => (
                  <button
                    key={business._id}
                    onClick={() => handleSelect(business._id)}
                    className={`block w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                      business._id === selectedBusinessId
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <span>{business.emoji}</span>
                    <span className="truncate">{business.name}</span>
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
