"use client";

import { ChevronLeft, Clock, Edit2, Star, Eye } from "lucide-react";
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
  onToggleFavorite?: (pageId: string, userId: string) => void;
  onUpdateStatus?: (pageId: string, status: "draft" | "published" | "archived") => void;
  currentUserId?: string;
}

/**
 * WikiPageView - Read-only page viewer
 * Displays page content, linked tasks, and comments
 * Phase 2: Adds status badge, favorite button, tags display, view count
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
  onToggleFavorite,
  onUpdateStatus,
  currentUserId = "user",
}: WikiPageViewProps) {
  // Build breadcrumb path
  const breadcrumbPath = buildBreadcrumb(page, allPages);

  // Check if current user has favorited this page
  const isFavorited = page.favoritedBy?.includes(currentUserId) ?? false;

  // Get status styling
  const getStatusColor = (status?: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "archived":
        return "bg-muted text-muted-foreground";
      case "draft":
      default:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header with breadcrumb and actions */}
      <div className="border-b sticky top-0 z-10 bg-background">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-3 md:px-4 py-3 gap-3">
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
          <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto">
            {/* Status badge */}
            {page.status && (
              <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(page.status)} flex-shrink-0`}>
                {page.status.charAt(0).toUpperCase() + page.status.slice(1)}
              </span>
            )}

            {/* Favorite button */}
            {onToggleFavorite && (
              <button
                onClick={() => onToggleFavorite(page._id, currentUserId)}
                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                  isFavorited
                    ? "bg-yellow-100 text-yellow-600 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400"
                    : "border border-input hover:bg-muted"
                }`}
                title={isFavorited ? "Remove from favorites" : "Add to favorites"}
              >
                <Star className={`w-4 h-4 ${isFavorited ? "fill-current" : ""}`} />
              </button>
            )}

            <button
              onClick={onShowHistory}
              className="inline-flex items-center gap-1 md:gap-2 px-2 md:px-3 py-2 rounded-lg border border-input hover:bg-muted transition-colors text-xs md:text-sm font-medium flex-1 md:flex-none"
              title="View version history"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </button>
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1 md:gap-2 px-2 md:px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-xs md:text-sm font-medium flex-1 md:flex-none"
            >
              <Edit2 className="w-4 h-4" />
              <span className="hidden sm:inline">Edit</span>
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

          {/* Tags */}
          {page.tags && page.tags.length > 0 && (
            <div className="px-6 py-4 border-t flex flex-wrap gap-2">
              {page.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Metadata */}
          <div className="px-6 py-4 border-t bg-muted/30 text-xs text-muted-foreground space-y-2">
            <p>Updated by {page.updatedByName} on {new Date(page.updatedAt).toLocaleDateString()}</p>

            {/* View and favorite counts - only for published pages */}
            {page.status === "published" && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {page.viewCount !== undefined && (
                  <div className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    <span>{page.viewCount} view{page.viewCount !== 1 ? "s" : ""}</span>
                  </div>
                )}
                {page.favoritedBy && page.favoritedBy.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-500 text-yellow-600" />
                    <span>{page.favoritedBy.length} favorite{page.favoritedBy.length !== 1 ? "s" : ""}</span>
                  </div>
                )}
              </div>
            )}

            {page.taskIds && page.taskIds.length > 0 && (
              <p>Linked tasks: {page.taskIds.length} task(s)</p>
            )}
            {page.epicId && <p>Linked epic: {page.epicId}</p>}
          </div>

          {/* Comments section - only for published pages */}
          {page.status === "published" && (
            <div className="border-t">
              <WikiComments
                comments={comments}
                onAddComment={onAddComment}
                onDeleteComment={onDeleteComment}
                pageId={page._id}
              />
            </div>
          )}
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
