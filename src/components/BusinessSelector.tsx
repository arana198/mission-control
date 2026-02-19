"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useBusiness } from "./BusinessProvider";
import { ChevronDown } from "lucide-react";

/**
 * Business Selector Component
 * 
 * Dropdown for switching between businesses in the sidebar.
 * Displays current business with emoji and name.
 * On selection, navigates to that business's current tab.
 */
export function BusinessSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { currentBusiness, businesses, setCurrentBusiness } = useBusiness();

  // Extract current tab from pathname (last part after /)
  const pathParts = (pathname || "").split("/").filter(Boolean);
  const currentTab = pathParts[pathParts.length - 1] || "overview";

  const handleSelectBusiness = (business: any) => {
    if (business._id === currentBusiness?._id) {
      // No-op if selecting same business
      setIsOpen(false);
      return;
    }

    setCurrentBusiness(business);
    // Navigate to the selected business with current tab
    router.push(`/${business.slug}/${currentTab}`);
    setIsOpen(false);
  };

  if (!currentBusiness) {
    return null;
  }

  return (
    <div className="relative">
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-input bg-background hover:bg-accent/5 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{currentBusiness.emoji}</span>
          <span className="text-sm font-medium truncate text-foreground">
            {currentBusiness.name}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 border border-input rounded-lg bg-popover shadow-md">
          <div className="max-h-60 overflow-y-auto">
            {businesses && businesses.length > 0 ? (
              businesses.map((business: any) => (
                <button
                  key={business._id}
                  onClick={() => handleSelectBusiness(business)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    business._id === currentBusiness._id
                      ? "bg-accent text-accent-foreground font-medium"
                      : "hover:bg-muted text-foreground"
                  }`}
                  style={
                    business._id === currentBusiness._id
                      ? {}
                      : { borderLeftColor: business.color }
                  }
                >
                  <span className="text-lg">{business.emoji}</span>
                  <div className="flex-1 text-left">
                    <div className="font-medium">{business.name}</div>
                    {business.isDefault && (
                      <div className="text-xs opacity-70">Default</div>
                    )}
                  </div>
                  {business._id === currentBusiness._id && (
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
