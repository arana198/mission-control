"use client";

import React, { useState } from "react";
import { useBusiness } from "./BusinessProvider";
import { ChevronDown } from "lucide-react";

/**
 * BusinessSelector Component
 * Sidebar dropdown for switching between businesses
 * Shows current business and allows selection of other businesses
 */
export function BusinessSelector() {
  const { currentBusiness, businesses, setCurrentBusiness } = useBusiness();
  const [isOpen, setIsOpen] = useState(false);

  if (!currentBusiness || businesses.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-3 border-b">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{currentBusiness.emoji}</span>
          <div className="text-left">
            <p className="font-semibold text-sm">{currentBusiness.name}</p>
            <p className="text-xs text-muted-foreground">Switch workspace</p>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="mt-2 space-y-1">
          {businesses.map((business) => (
            <button
              key={business._id}
              onClick={() => {
                setCurrentBusiness(business);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                business._id === currentBusiness._id
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              }`}
            >
              <span className="text-lg">{business.emoji}</span>
              <span>{business.name}</span>
              {business.isDefault && (
                <span className="ml-auto text-xs bg-primary/20 px-2 py-1 rounded">Default</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
