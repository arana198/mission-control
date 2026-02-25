"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Plus, MoreVertical, FileText, BookOpen } from "lucide-react";
import type { WikiPageWithChildren } from "@/convex/wiki";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./DropdownMenu";

interface WikiTreeProps {
  tree: WikiPageWithChildren[];
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
  onCreatePage: (parentId?: string) => void;
  onDeletePage: (pageId: string) => void;
  onRenamePage: (pageId: string, newTitle: string) => void;
  onMovePage: (pageId: string, newParentId: string) => void;
}

/**
 * WikiTree - Left sidebar tree navigation for wiki pages
 * Shows departments and their sub-pages in a collapsible tree structure.
 */
export function WikiTree({
  tree,
  selectedPageId,
  onSelectPage,
  onCreatePage,
  onDeletePage,
  onRenamePage,
  onMovePage,
}: WikiTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(tree.map((dept) => dept._id)) // Departments open by default
  );

  const toggleExpanded = (pageId: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(pageId)) {
      newExpanded.delete(pageId);
    } else {
      newExpanded.add(pageId);
    }
    setExpandedIds(newExpanded);
  };

  if (tree.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <div className="text-3xl mb-3">📝</div>
        <p className="text-xs font-medium text-muted-foreground text-center mb-4">
          No pages yet
        </p>
        <button
          onClick={() => onCreatePage()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Create First Page
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border-r bg-muted/30 overflow-hidden relative">
      {/* Tree content with floating action button */}
      <div className="flex-1 overflow-y-auto overflow-x-visible">
        <nav className="p-3 space-y-1">
          {tree.map((page) => (
            <TreeNodeWithExpanded
              key={page._id}
              page={page}
              level={0}
              expandedIds={expandedIds}
              selectedPageId={selectedPageId}
              onSelect={onSelectPage}
              onToggleExpanded={toggleExpanded}
              onCreatePage={onCreatePage}
              onDeletePage={onDeletePage}
              onRenamePage={onRenamePage}
              onMovePage={onMovePage}
            />
          ))}

          {/* Floating New Page button */}
          <div className="sticky bottom-0 p-3 border-t bg-background/50 flex gap-2">
            <button
              onClick={() => onCreatePage()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
              title="New page"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Page</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}

interface TreeNodeWithExpandedProps {
  page: WikiPageWithChildren;
  level: number;
  expandedIds: Set<string>;
  selectedPageId: string | null;
  onSelect: (pageId: string) => void;
  onToggleExpanded: (pageId: string) => void;
  onCreatePage: (parentId?: string) => void;
  onDeletePage: (pageId: string) => void;
  onRenamePage: (pageId: string, newTitle: string) => void;
  onMovePage: (pageId: string, newParentId: string) => void;
}

function TreeNodeWithExpanded({
  page,
  level,
  expandedIds,
  selectedPageId,
  onSelect,
  onToggleExpanded,
  onCreatePage,
  onDeletePage,
  onRenamePage,
  onMovePage,
}: TreeNodeWithExpandedProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(page.title);
  const [isDragOverThis, setIsDragOverThis] = useState(false);
  const hasChildren = page.children && page.children.length > 0;
  const isExpanded = expandedIds.has(page._id);
  const isSelected = selectedPageId === page._id;

  const handleRename = () => {
    if (newTitle.trim()) {
      onRenamePage(page._id, newTitle);
    } else {
      setNewTitle(page.title);
    }
    setIsRenaming(false);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("pageId", page._id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOverThis(true);
  };

  const handleDragLeave = () => {
    setIsDragOverThis(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOverThis(false);
    const draggedPageId = e.dataTransfer.getData("pageId");
    if (draggedPageId && draggedPageId !== page._id && page._id) {
      onMovePage(draggedPageId, page._id);
    }
  };

  return (
    <div className="relative">
      {/* Connector line for nested items */}
      {level > 0 && (
        <div
          className="absolute top-0 bottom-0 w-px bg-border/50"
          style={{ left: `${level * 20 - 10}px` }}
        />
      )}

      {/* Node itself */}
      <div
        style={{ paddingLeft: `${level * 20}px` }}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg group transition-colors relative ${
          isSelected
            ? "bg-primary/10 text-primary"
            : "hover:bg-muted/60 text-foreground/70 hover:text-foreground"
        } ${isDragOverThis ? "bg-primary/20" : ""}`}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Expand/Collapse button */}
        {hasChildren && (
          <button
            onClick={() => onToggleExpanded(page._id)}
            className="p-0.5 hover:bg-muted rounded transition-colors flex-shrink-0"
            aria-label={isExpanded ? "Collapse page" : "Expand page"}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-4 flex-shrink-0" />}

        {/* Connector dot for leaf pages */}
        {level > 0 && !hasChildren && (
          <div className="w-1 h-1 rounded-full bg-muted-foreground/40 flex-shrink-0" />
        )}

        {/* Icon - BookOpen for pages with children, FileText for leaf pages */}
        {hasChildren ? (
          <BookOpen
            className={`w-4 h-4 flex-shrink-0 ${
              isSelected ? "text-primary" : "text-muted-foreground"
            }`}
          />
        ) : (
          <FileText
            className={`w-4 h-4 flex-shrink-0 ${
              isSelected ? "text-primary" : "text-muted-foreground"
            }`}
          />
        )}

        {/* [DRAFT] status badge - only for drafts */}
        {page.status === "draft" && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warning/10 text-warning flex-shrink-0 ml-auto mr-auto">
            DRAFT
          </span>
        )}

        {/* Title or rename input */}
        {isRenaming ? (
          <input
            autoFocus
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") {
                setNewTitle(page.title);
                setIsRenaming(false);
              }
            }}
            className="flex-1 bg-transparent border-b border-primary outline-none text-sm font-medium"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            onClick={() => onSelect(page._id)}
            className="flex-1 text-left text-sm font-medium truncate transition-colors"
          >
            {page.emoji && <span className="mr-2">{page.emoji}</span>}
            {page.title}
          </button>
        )}

        {/* Inline add child button (Confluence pattern) */}
        {hasChildren && !isRenaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreatePage(page._id);
            }}
            className="p-1 opacity-0 group-hover:opacity-100 rounded hover:bg-muted/60 transition-all flex-shrink-0"
            aria-label={`Add child page to ${page.title}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Menu button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1 opacity-0 group-hover:opacity-100 rounded hover:bg-muted/60 transition-all flex-shrink-0"
              aria-label={`More options for ${page.title}`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsRenaming(true)}>Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreatePage(page._id)}>
              Add sub-page
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDeletePage(page._id)}
              className="text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {page.children!.map((child) => (
            <TreeNodeWithExpanded
              key={child._id}
              page={child}
              level={level + 1}
              expandedIds={expandedIds}
              selectedPageId={selectedPageId}
              onSelect={onSelect}
              onToggleExpanded={onToggleExpanded}
              onCreatePage={onCreatePage}
              onDeletePage={onDeletePage}
              onRenamePage={onRenamePage}
              onMovePage={onMovePage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
