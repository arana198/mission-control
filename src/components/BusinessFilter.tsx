"use client";

import React, { useState } from "react";
import { useBusiness } from "./BusinessProvider";

interface BusinessFilterProps {
  onFilterChange?: (businessId: string | null) => void;
}

/**
 * BusinessFilter Component
 * Dropdown filter for global tabs (Workload, Activity, Analytics)
 * Shows all businesses and "All Businesses" option
 */
export function BusinessFilter({ onFilterChange }: BusinessFilterProps) {
  const { businesses } = useBusiness();
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (businessId: string | null) => {
    setSelectedBusinessId(businessId);
    onFilterChange?.(businessId);
    setIsOpen(false);
  };

  const selectedLabel =
    selectedBusinessId === null
      ? "All Businesses"
      : businesses.find((b) => b._id === selectedBusinessId)?.name || "All Businesses";

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Showing:</span>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-2 rounded-lg border border-input hover:bg-accent transition-colors text-sm font-medium"
        >
          {selectedLabel}
        </button>

        {isOpen && (
          <div className="absolute top-full mt-1 left-0 bg-popover border border-input rounded-lg shadow-lg z-50 w-max">
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

            {businesses.map((business) => (
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
                <span>{business.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
