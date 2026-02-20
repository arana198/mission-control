"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { WikiTree } from "./WikiTree";
import { WikiPageView } from "./WikiPageView";
import { WikiPageEditor } from "./WikiPageEditor";
import { WikiHistory } from "./WikiHistory";
import { WikiSearch } from "./WikiSearch";
import type { WikiPageWithChildren, WikiPage, WikiComment, WikiPageHistory } from "@/convex/wiki";
import type { Id } from "@/convex/_generated/dataModel";

interface WikiDocsProps {
  businessId: string;
}

type ViewMode = "tree" | "view" | "edit" | "history";

/**
 * WikiDocs - Main wiki container
 * 3-panel layout: Tree | Page View/Edit | History/Search
 */
export function WikiDocs({ businessId }: WikiDocsProps) {
  // Router and URL
  const router = useRouter();
  const searchParams = useSearchParams();

  // State management
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const newlyCreatedPageRef = useRef<string | null>(null);
  const urlSyncRef = useRef(false); // Prevent duplicate syncs

  // Convex queries - hooks must be called unconditionally (Rules of Hooks)
  const tree = useQuery(api.wiki.getTree, { businessId: businessId as Id<"businesses"> });
  const selectedPage = useQuery(
    api.wiki.getPage,
    selectedPageId ? { pageId: selectedPageId as Id<"wikiPages"> } : "skip"
  );
  const pageHistory = useQuery(
    api.wiki.getHistory,
    selectedPageId ? { pageId: selectedPageId as Id<"wikiPages"> } : "skip"
  );
  const pageComments = useQuery(
    api.wiki.getComments,
    selectedPageId ? { pageId: selectedPageId as Id<"wikiPages"> } : "skip"
  );
  const searchResults = useQuery(api.wiki.search, { businessId: businessId as Id<"businesses">, query: searchQuery });

  // Flatten tree for search breadcrumb resolution
  const allPages = flattenTree(tree || []);

  // Convex mutations
  const createDepartmentMutation = useMutation(api.wiki.createDepartment);
  const createPageMutation = useMutation(api.wiki.createPage);
  const updatePageMutation = useMutation(api.wiki.updatePage);
  const deletePageMutation = useMutation(api.wiki.deletePage);
  const movePageMutation = useMutation(api.wiki.movePage);
  const reorderPagesMutation = useMutation(api.wiki.reorderPages);
  const addCommentMutation = useMutation(api.wiki.addComment);
  const deleteCommentMutation = useMutation(api.wiki.deleteComment);
  const restorePageMutation = useMutation(api.wiki.restorePage);
  // Phase 2: Confluence-like features
  const toggleFavoriteMutation = useMutation(api.wiki.toggleFavorite);
  const updatePageStatusMutation = useMutation(api.wiki.updatePageStatus);
  const incrementViewCountMutation = useMutation(api.wiki.incrementViewCount);

  // Initialize from URL on first client load
  useEffect(() => {
    if (!searchParams || urlSyncRef.current) return;
    const pageIdFromUrl = searchParams.get("page");
    if (pageIdFromUrl) {
      setSelectedPageId(pageIdFromUrl);
      urlSyncRef.current = true;
    }
  }, [searchParams]);

  // Sync URL when selectedPageId changes (but not on initialization)
  useEffect(() => {
    if (!urlSyncRef.current || !searchParams) return;

    const currentPageInUrl = searchParams.get("page");
    if (selectedPageId !== currentPageInUrl) {
      const params = new URLSearchParams(searchParams.toString());
      if (selectedPageId) {
        params.set("page", selectedPageId);
      } else {
        params.delete("page");
      }
      router.push(`?${params.toString()}`, { scroll: false });
    }
  }, [selectedPageId, searchParams, router]);

  // Handle Cmd+K to open search (only if not in editor)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're typing in an input or editor
      const target = e.target as HTMLElement;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.contentEditable === "true" ||
        target?.closest("[contenteditable=true]");

      if (!isTyping && (e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        setShowSearch(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Handlers
  const handleCreatePage = useCallback(
    async (parentId?: string) => {
      try {
        const pageId = parentId
          ? // Create as sub-page
            await createPageMutation({
              businessId: businessId as Id<"businesses">,
              parentId: parentId as Id<"wikiPages">,
              title: "New Page",
              content: JSON.stringify({ type: "doc", content: [] }),
              contentText: "",
              createdBy: "user",
              createdByName: "User",
            })
          : // Create as root page (department)
            await createDepartmentMutation({
              businessId: businessId as Id<"businesses">,
              title: "New Page",
              createdBy: "user",
              createdByName: "User",
            });

        if (pageId) {
          newlyCreatedPageRef.current = pageId;
          setSelectedPageId(pageId);
          setViewMode("edit");
        }
      } catch (error) {
        console.error("Failed to create page:", error);
        alert("Failed to create page. Please try again.");
      }
    },
    [businessId, createPageMutation, createDepartmentMutation]
  );

  const handleUpdatePage = useCallback(
    async (data: {
      title: string;
      content: string;
      contentText: string;
      emoji?: string;
      status?: string;
      tags?: string[];
    }, isAutoSave?: boolean) => {
      if (!selectedPageId) {
        console.error("No page selected for update");
        throw new Error("No page selected for update");
      }

      try {
        await updatePageMutation({
          pageId: selectedPageId as Id<"wikiPages">,
          title: data.title || "Untitled",
          content: data.content,
          contentText: data.contentText,
          emoji: data.emoji,
          status: data.status as "draft" | "published" | "archived" | undefined,
          tags: data.tags,
          updatedBy: "user",
          updatedByName: "User",
        });
        // Only exit edit view on manual save, not auto-save
        if (!isAutoSave) {
          setViewMode("view");
        }
      } catch (error) {
        console.error("Failed to update page:", error);
        if (!isAutoSave) {
          alert("Failed to save page. Please try again.");
        }
        throw error;
      }
    },
    [selectedPageId, updatePageMutation]
  );

  const handleDeletePage = useCallback(
    async (pageId: string) => {
      try {
        await deletePageMutation({ pageId: pageId as Id<"wikiPages"> });
        if (selectedPageId === pageId) {
          setSelectedPageId(null);
          setViewMode("tree");
        }
      } catch (error) {
        console.error("Failed to delete page:", error);
      }
    },
    [selectedPageId, deletePageMutation]
  );

  const handleRenamePage = useCallback(
    async (pageId: string, newTitle: string) => {
      try {
        const page = allPages.find((p) => p._id === pageId);
        if (!page) {
          console.error("Page not found for rename:", pageId);
          alert("Page not found. Please refresh and try again.");
          return;
        }
        if (!newTitle || newTitle.trim() === "") {
          alert("Please enter a valid title.");
          return;
        }
        await updatePageMutation({
          pageId: pageId as Id<"wikiPages">,
          title: newTitle.trim(),
          content: page.content,
          contentText: page.contentText,
          updatedBy: "user",
          updatedByName: "User",
        });
      } catch (error) {
        console.error("Failed to rename page:", error);
        alert("Failed to rename page. Please try again.");
      }
    },
    [allPages, updatePageMutation]
  );

  const handleAddComment = useCallback(
    async (content: string, parentId?: string) => {
      if (!selectedPageId) return;

      try {
        await addCommentMutation({
          pageId: selectedPageId as Id<"wikiPages">,
          businessId: businessId as Id<"businesses">,
          fromId: "user",
          fromName: "User",
          content,
          parentId: parentId ? (parentId as Id<"wikiComments">) : undefined,
        });
      } catch (error) {
        console.error("Failed to add comment:", error);
      }
    },
    [selectedPageId, businessId, addCommentMutation]
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      try {
        await deleteCommentMutation({ commentId: commentId as Id<"wikiComments"> });
      } catch (error) {
        console.error("Failed to delete comment:", error);
      }
    },
    [deleteCommentMutation]
  );

  const handleRestorePage = useCallback(
    async (historyId: string) => {
      if (!selectedPageId) return;

      try {
        await restorePageMutation({
          pageId: selectedPageId as Id<"wikiPages">,
          historyId: historyId as Id<"wikiPageHistory">,
          restoredBy: "user",
          restoredByName: "User",
        });
        setViewMode("view");
      } catch (error) {
        console.error("Failed to restore page:", error);
      }
    },
    [selectedPageId, restorePageMutation]
  );

  // Phase 2: Confluence-like features
  const handleToggleFavorite = useCallback(
    async (pageId: string, userId: string) => {
      try {
        await toggleFavoriteMutation({ pageId: pageId as Id<"wikiPages">, userId });
      } catch (error) {
        console.error("Failed to toggle favorite:", error);
      }
    },
    [toggleFavoriteMutation]
  );

  const handleUpdateStatus = useCallback(
    async (pageId: string, status: "draft" | "published" | "archived") => {
      try {
        await updatePageStatusMutation({
          pageId: pageId as Id<"wikiPages">,
          status,
          updatedBy: "user",
          updatedByName: "User",
        });
      } catch (error) {
        console.error("Failed to update page status:", error);
      }
    },
    [updatePageStatusMutation]
  );

  const handleIncrementViewCount = useCallback(
    async (pageId: string) => {
      try {
        await incrementViewCountMutation({ pageId: pageId as Id<"wikiPages"> });
      } catch (error) {
        console.error("Failed to increment view count:", error);
      }
    },
    [incrementViewCountMutation]
  );

  const handleMovePage = useCallback(
    async (pageId: string, newParentId: string) => {
      try {
        // Calculate position - add to end of new parent's children
        // Using tree structure to count children accurately
        const findChildCount = (pages: WikiPageWithChildren[], parentId: string): number => {
          for (const page of pages) {
            if (page._id === parentId) {
              return page.children?.length ?? 0;
            }
            if (page.children) {
              const count = findChildCount(page.children, parentId);
              if (count !== -1) return count;
            }
          }
          return -1;
        };

        const position = findChildCount(tree || [], newParentId);

        await movePageMutation({
          pageId: pageId as Id<"wikiPages">,
          newParentId: newParentId as Id<"wikiPages">,
          position: Math.max(0, position),
        });
      } catch (error) {
        console.error("Failed to move page:", error);
        alert("Failed to move page. Please try again.");
      }
    },
    [movePageMutation, tree]
  );

  // Call incrementViewCount when page is selected and shown in view mode
  // Only increment for published pages (not drafts/archived)
  useEffect(() => {
    if (selectedPageId && viewMode === "view" && selectedPage && selectedPage.status === "published") {
      // Don't increment if this page was just created
      if (newlyCreatedPageRef.current === selectedPageId) {
        newlyCreatedPageRef.current = null;
        return;
      }
      handleIncrementViewCount(selectedPageId);
    }
  }, [selectedPageId, viewMode, selectedPage, handleIncrementViewCount]);

  // Render empty state
  if (tree && tree.length === 0 && !selectedPageId) {
    return (
      <div className="h-full flex items-center justify-center">
        <button
          onClick={() => handleCreatePage()}
          className="px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
        >
          Create your first page
        </button>
      </div>
    );
  }

  // Main layout: Tree | Content | Side panel
  return (
    <div className="flex h-full bg-background">
      {/* Left: Tree navigation - always visible */}
      <div className="w-64 border-r flex flex-col flex-shrink-0">
        {/* Tree content with scrolling */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {tree && (
            <WikiTree
              tree={tree}
              selectedPageId={selectedPageId}
              onSelectPage={(pageId) => {
                setSelectedPageId(pageId);
                setViewMode("view");
              }}
              onCreatePage={handleCreatePage}
              onDeletePage={handleDeletePage}
              onRenamePage={handleRenamePage}
              onMovePage={handleMovePage}
            />
          )}
        </div>
      </div>

      {/* Center/Right: Content area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {selectedPage && (
          <>
            {viewMode === "view" && (
              <WikiPageView
                page={selectedPage}
                allPages={allPages}
                comments={pageComments || []}
                onEdit={() => setViewMode("edit")}
                onShowHistory={() => setViewMode("history")}
                onBack={() => {
                  setSelectedPageId(null);
                  setViewMode("tree");
                }}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
                onToggleFavorite={handleToggleFavorite}
                onUpdateStatus={handleUpdateStatus}
                currentUserId="user"
              />
            )}

            {viewMode === "edit" && (
              <WikiPageEditor
                page={selectedPage}
                onSave={handleUpdatePage}
                onCancel={() => setViewMode("view")}
                onBack={() => {
                  setViewMode("view");
                }}
              />
            )}

            {viewMode === "history" && (
              <WikiHistory
                history={pageHistory || []}
                currentTitle={selectedPage.title}
                onBack={() => setViewMode("view")}
                onRestore={handleRestorePage}
              />
            )}
          </>
        )}

        {!selectedPage && viewMode === "tree" && (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4 px-6">
            <div className="text-7xl">📖</div>
            <div className="text-center space-y-2">
              <p className="text-xl font-semibold text-foreground">Welcome to Wiki</p>
              <p className="text-sm max-w-md">Select a page from the left sidebar to view or edit its content. Create your first page to get started!</p>
            </div>
          </div>
        )}
      </div>

      {/* Search overlay */}
      <WikiSearch
        isOpen={showSearch}
        results={searchResults || []}
        onClose={() => setShowSearch(false)}
        onSelectPage={(pageId) => {
          setSelectedPageId(pageId);
          setViewMode("view");
          setShowSearch(false);
        }}
        onSearch={setSearchQuery}
        allPages={allPages}
      />
    </div>
  );
}

/**
 * Flatten tree structure for search/breadcrumb resolution
 */
function flattenTree(tree: WikiPageWithChildren[]): WikiPage[] {
  const result: WikiPage[] = [];

  const traverse = (pages: WikiPageWithChildren[]) => {
    pages.forEach((page) => {
      // Add the page (excluding children field for WikiPage type)
      const { children, ...pageData } = page;
      result.push(pageData as WikiPage);

      // Recursively add children
      if (children && children.length > 0) {
        traverse(children);
      }
    });
  };

  traverse(tree);
  return result;
}
