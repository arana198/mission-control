"use client";

import { ChevronLeft, Edit2 } from "lucide-react";
import type { WikiPage } from "@/types/wiki";
import { WikiEditor } from "./WikiEditor";

interface WikiPageViewProps {
  page: WikiPage;
  allPages: WikiPage[];
  onEdit: () => void;
  onBack?: () => void;
}

/**
 * WikiPageView - Read-only page viewer for markdown content
 * Shows page content and basic metadata
 */
export function WikiPageView({
  page,
  allPages,
  onEdit,
  onBack,
}: WikiPageViewProps) {
  // Build breadcrumb path
  const breadcrumbPath = buildBreadcrumb(page, allPages);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header with breadcrumb and actions */}
      <div className="border-b sticky top-0 z-10 bg-background">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
                aria-label="Go back to wiki pages"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {breadcrumbPath}
              </p>
              <h1 className="text-2xl font-bold truncate">{page.title}</h1>
            </div>
          </div>

          {/* Edit button */}
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <Edit2 className="w-4 h-4" />
            <span className="hidden sm:inline">Edit</span>
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          <WikiEditor content={page.content} editable={false} />

          {/* Metadata */}
          <div className="mt-12 pt-6 border-t text-xs text-muted-foreground space-y-2">
            <p>
              Created by {page.createdByName} on{" "}
              {new Date(page.createdAt).toLocaleDateString()}
            </p>
            <p>
              Updated by {page.updatedByName} on{" "}
              {new Date(page.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Build breadcrumb path from page hierarchy
 */
function buildBreadcrumb(page: WikiPage, allPages: WikiPage[]): string {
  const path: string[] = [page.title];
  let currentId = page.parentId;

  while (currentId) {
    const parent = allPages.find((p) => p._id === currentId);
    if (!parent) break;
    path.unshift(parent.title);
    currentId = parent.parentId;
  }

  return path.join(" / ");
}
