"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Plus, MoreVertical, Folder, FileText } from "lucide-react";
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
  onCreateDepartment: () => void;
  onCreatePage: (parentId: string) => void;
  onDeletePage: (pageId: string) => void;
  onRenamePage: (pageId: string, newTitle: string) => void;
}

/**
 * WikiTree - Left sidebar tree navigation for wiki pages
 * Shows departments and their sub-pages in a collapsible tree structure.
 */
export function WikiTree({
  tree,
  selectedPageId,
  onSelectPage,
  onCreateDepartment,
  onCreatePage,
  onDeletePage,
  onRenamePage,
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
      <div className="h-full flex flex-col items-center justify-center p-4 border-r bg-muted/30">
        <p className="text-sm text-muted-foreground text-center mb-4">
          Create your first department to organize your team's knowledge
        </p>
        <button
          onClick={onCreateDepartment}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Department
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border-r bg-muted/30 overflow-hidden">
      {/* Header with New Department button */}
      <div className="flex items-center justify-between p-3 border-b">
        <span className="text-xs font-semibold text-muted-foreground">DEPARTMENTS</span>
        <button
          onClick={onCreateDepartment}
          className="p-1 rounded hover:bg-muted transition-colors"
          title="New Department"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto">
        <nav className="p-2 space-y-1">
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
            />
          ))}
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
  onCreatePage: (parentId: string) => void;
  onDeletePage: (pageId: string) => void;
  onRenamePage: (pageId: string, newTitle: string) => void;
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
}: TreeNodeWithExpandedProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(page.title);
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

  return (
    <div>
      {/* Node itself */}
      <div
        style={{ paddingLeft: `${level * 16}px` }}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-md group transition-colors ${
          isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted"
        }`}
      >
        {/* Expand/Collapse button */}
        {hasChildren && (
          <button
            onClick={() => onToggleExpanded(page._id)}
            className="p-0.5 hover:bg-muted rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-5" />}

        {/* Icon */}
        {page.type === "department" ? (
          <Folder className="w-4 h-4 text-blue-500 flex-shrink-0" />
        ) : (
          <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
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
            className="flex-1 text-left text-sm font-medium truncate hover:text-foreground transition-colors"
          >
            {page.emoji && <span className="mr-1">{page.emoji}</span>}
            {page.title}
          </button>
        )}

        {/* Menu button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-0.5 opacity-0 group-hover:opacity-100 rounded hover:bg-muted transition-all">
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
