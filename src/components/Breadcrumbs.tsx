"use client";

import { useRouter } from "next/navigation";
import { useWorkspace } from "./WorkspaceProvider";

interface BreadcrumbsProps {
  tab?: string;
  section?: string;
}

/**
 * Breadcrumb navigation showing user's current location
 * Format:  Emoji Name > Tab Name > [Optional Section]
 *  name is clickable and navigates to overview
 */
export function Breadcrumbs({ tab, section }: BreadcrumbsProps) {
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();

  const formatTabName = (t: string): string => {
    return t
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const handleClick = () => {
    if (currentWorkspace) {
      router.push(`/${currentWorkspace.slug}/overview`);
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {currentWorkspace && (
        <>
          <button
            onClick={handleClick}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer group"
            title="Go to overview"
          >
            <span className="group-hover:scale-110 transition-transform">{currentWorkspace.emoji}</span>
            <span className="font-medium text-foreground group-hover:underline">{currentWorkspace.name}</span>
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
