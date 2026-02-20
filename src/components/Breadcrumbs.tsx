"use client";

import { useRouter } from "next/navigation";
import { useBusiness } from "./BusinessProvider";

interface BreadcrumbsProps {
  tab?: string;
  section?: string;
}

/**
 * Breadcrumb navigation showing user's current location
 * Format: Business Emoji Name > Tab Name > [Optional Section]
 * Business name is clickable and navigates to overview
 */
export function Breadcrumbs({ tab, section }: BreadcrumbsProps) {
  const router = useRouter();
  const { currentBusiness } = useBusiness();

  const formatTabName = (t: string): string => {
    return t
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const handleBusinessClick = () => {
    if (currentBusiness) {
      router.push(`/${currentBusiness.slug}/overview`);
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {currentBusiness && (
        <>
          <button
            onClick={handleBusinessClick}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer group"
            title="Go to overview"
          >
            <span className="group-hover:scale-110 transition-transform">{currentBusiness.emoji}</span>
            <span className="font-medium text-foreground group-hover:underline">{currentBusiness.name}</span>
          </button>
          {tab && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-foreground font-medium">{formatTabName(tab)}</span>
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
