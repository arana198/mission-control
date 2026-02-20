"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { WikiTree } from "./WikiTree";
import { WikiPageView } from "./WikiPageView";
import { WikiPageEditor } from "./WikiPageEditor";
import type { WikiPageWithChildren, WikiPage } from "@/convex/wiki";
import type { Id } from "@/convex/_generated/dataModel";

interface WikiDocsProps {
  businessId: string;
}

type ViewMode = "tree" | "view" | "edit";

/**
 * WikiDocs - Main wiki container
 * 2-panel layout: Tree | Page View/Edit
 */
export function WikiDocs({ businessId }: WikiDocsProps) {
  // Router and URL
  const router = useRouter();
  const searchParams = useSearchParams();

  // State management
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const newlyCreatedPageRef = useRef<string | null>(null);
  const urlSyncRef = useRef(false); // Prevent duplicate syncs

  // Convex queries - hooks must be called unconditionally (Rules of Hooks)
  const tree = useQuery(api.wiki.getTree, { businessId: businessId as Id<"businesses"> });
  const selectedPage = useQuery(
    api.wiki.getPage,
    selectedPageId ? { pageId: selectedPageId as Id<"wikiPages"> } : "skip"
  );

  // Flatten tree for search breadcrumb resolution
  const allPages = flattenTree(tree || []);

  // Convex mutations
  const createDepartmentMutation = useMutation(api.wiki.createDepartment);
  const createPageMutation = useMutation(api.wiki.createPage);
  const updatePageMutation = useMutation(api.wiki.updatePage);
  const deletePageMutation = useMutation(api.wiki.deletePage);
  const movePageMutation = useMutation(api.wiki.movePage);
  const reorderPagesMutation = useMutation(api.wiki.reorderPages);

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
              content: "",
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
                onEdit={() => setViewMode("edit")}
                onBack={() => {
                  setSelectedPageId(null);
                  setViewMode("tree");
                }}
              />
            )}

            {viewMode === "edit" && (
              <WikiPageEditor
                page={selectedPage}
                onSave={handleUpdatePage}
                onCancel={() => setViewMode("view")}
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
