"use client";

import { ChevronLeft, Clock, Edit2 } from "lucide-react";
import { WikiEditor } from "./WikiEditor";
import { WikiComments } from "./WikiComments";
import type { WikiPage, WikiComment } from "@/convex/wiki";

interface WikiPageViewProps {
  page: WikiPage;
  allPages: WikiPage[];
  comments: WikiComment[];
  onEdit: () => void;
  onShowHistory: () => void;
  onBack?: () => void;
  onAddComment: (content: string, parentId?: string) => void;
  onDeleteComment: (commentId: string) => void;
}

/**
 * WikiPageView - Read-only page viewer
 * Displays page content, linked tasks, and comments
 */
export function WikiPageView({
  page,
  allPages,
  comments,
  onEdit,
  onShowHistory,
  onBack,
  onAddComment,
  onDeleteComment,
}: WikiPageViewProps) {
  // Build breadcrumb path
  const breadcrumbPath = buildBreadcrumb(page, allPages);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header with breadcrumb and actions */}
      <div className="border-b sticky top-0 z-10 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">{breadcrumbPath}</p>
              <h1 className="text-2xl font-bold truncate">
                {page.emoji && <span className="mr-2">{page.emoji}</span>}
                {page.title}
              </h1>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            <button
              onClick={onShowHistory}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-input hover:bg-muted transition-colors text-sm font-medium"
              title="View version history"
            >
              <Clock className="w-4 h-4" />
              History
            </button>
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {/* Page content */}
          <div className="p-6">
            <WikiEditor content={page.content} editable={false} />
          </div>

          {/* Metadata */}
          <div className="px-6 py-4 border-t bg-muted/30 text-xs text-muted-foreground space-y-1">
            <p>Updated by {page.updatedByName} on {new Date(page.updatedAt).toLocaleDateString()}</p>
            {page.taskIds && page.taskIds.length > 0 && (
              <p>Linked tasks: {page.taskIds.length} task(s)</p>
            )}
            {page.epicId && <p>Linked epic: {page.epicId}</p>}
          </div>

          {/* Comments section */}
          <div className="border-t">
            <WikiComments
              comments={comments}
              onAddComment={onAddComment}
              onDeleteComment={onDeleteComment}
              pageId={page._id}
            />
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
