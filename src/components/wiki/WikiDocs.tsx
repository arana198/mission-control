"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
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
  // State management
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Convex queries
  const tree = useQuery(api.wiki.getTree, { businessId: businessId as Id<"businesses"> });
  const selectedPage = selectedPageId
    ? useQuery(api.wiki.getPage, { pageId: selectedPageId as Id<"wikiPages"> })
    : null;
  const pageHistory = selectedPageId
    ? useQuery(api.wiki.getHistory, { pageId: selectedPageId as Id<"wikiPages"> })
    : [];
  const pageComments = selectedPageId
    ? useQuery(api.wiki.getComments, { pageId: selectedPageId as Id<"wikiPages"> })
    : [];
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

  // Handle Cmd+K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handlers
  const handleCreateDepartment = useCallback(async () => {
    try {
      const pageId = await createDepartmentMutation({
        businessId: businessId as Id<"businesses">,
        title: "New Department",
        createdBy: "user",
        createdByName: "User",
      });
      setSelectedPageId(pageId);
      setViewMode("edit");
    } catch (error) {
      console.error("Failed to create department:", error);
    }
  }, [businessId, createDepartmentMutation]);

  const handleCreatePage = useCallback(
    async (parentId: string) => {
      try {
        const pageId = await createPageMutation({
          businessId: businessId as Id<"businesses">,
          parentId: parentId as Id<"wikiPages">,
          title: "New Page",
          content: JSON.stringify({ type: "doc", content: [] }),
          contentText: "",
          createdBy: "user",
          createdByName: "User",
        });
        setSelectedPageId(pageId);
        setViewMode("edit");
      } catch (error) {
        console.error("Failed to create page:", error);
      }
    },
    [businessId, createPageMutation]
  );

  const handleUpdatePage = useCallback(
    async (data: {
      title: string;
      content: string;
      contentText: string;
      emoji?: string;
    }) => {
      if (!selectedPageId) return;

      try {
        await updatePageMutation({
          pageId: selectedPageId as Id<"wikiPages">,
          title: data.title,
          content: data.content,
          contentText: data.contentText,
          emoji: data.emoji,
          updatedBy: "user",
          updatedByName: "User",
        });
        setViewMode("view");
      } catch (error) {
        console.error("Failed to update page:", error);
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
        if (page) {
          await updatePageMutation({
            pageId: pageId as Id<"wikiPages">,
            title: newTitle,
            content: page.content,
            contentText: page.contentText,
            updatedBy: "user",
            updatedByName: "User",
          });
        }
      } catch (error) {
        console.error("Failed to rename page:", error);
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

  // Render empty state
  if (tree && tree.length === 0 && !selectedPageId) {
    return (
      <div className="h-full flex items-center justify-center">
        <button
          onClick={handleCreateDepartment}
          className="px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
        >
          Create your first department
        </button>
      </div>
    );
  }

  // Main layout: Tree | Content | Side panel
  return (
    <div className="flex flex-col md:flex-row h-full bg-background">
      {/* Left: Tree navigation (250px) - hidden on mobile unless showing sidebar */}
      <div className="hidden md:flex w-full md:w-64 border-r border-b md:border-b-0 overflow-hidden flex-col">
        {tree && (
          <WikiTree
            tree={tree}
            selectedPageId={selectedPageId}
            onSelectPage={(pageId) => {
              setSelectedPageId(pageId);
              setViewMode("view");
            }}
            onCreateDepartment={handleCreateDepartment}
            onCreatePage={handleCreatePage}
            onDeletePage={handleDeletePage}
            onRenamePage={handleRenamePage}
          />
        )}
      </div>

      {/* Center/Right: Content area */}
      <div className="flex-1 overflow-hidden flex flex-col w-full">
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
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a page to view
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
