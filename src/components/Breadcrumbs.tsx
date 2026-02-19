"use client";

import { useBusiness } from "./BusinessProvider";

interface BreadcrumbsProps {
  tab?: string;
  section?: string;
}

/**
 * Breadcrumb navigation showing user's current location
 * Format: Business Emoji Name > Tab Name > [Optional Section]
 */
export function Breadcrumbs({ tab, section }: BreadcrumbsProps) {
  const { currentBusiness } = useBusiness();

  const formatTabName = (t: string): string => {
    return t
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {currentBusiness && (
        <>
          <span className="flex items-center gap-1.5">
            <span>{currentBusiness.emoji}</span>
            <span className="font-medium text-foreground">{currentBusiness.name}</span>
          </span>
          {tab && (
            <>
              <span className="text-muted-foreground">/</span>
              <span>{formatTabName(tab)}</span>
            </>
          )}
          {section && (
            <>
              <span className="text-muted-foreground">/</span>
              <span>{section}</span>
            </>
          )}
        </>
      )}
    </div>
  );
}
