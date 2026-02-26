"use client";

import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Folder, File, Clock, HardDrive } from "lucide-react";
import { formatFileSize, getFileIcon, getFileExtension } from "@/lib/validators/agentWorkspaceValidators";
import { formatDistanceToNow } from "date-fns";

interface FileItem {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size?: number;
  modified?: number;
  extension?: string;
  isHidden?: boolean;
  children?: FileItem[];
  fileCount?: number;
  folderCount?: number;
}

interface WorkspaceViewerProps {
  agentName: string;
  rootPath: string;
  tree?: FileItem;
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  lastUpdated: number;
  error?: string;
}

/**
 * File/Folder tree node component
 */
function FileTreeNode({
  item,
  level = 0,
}: {
  item: FileItem;
  level?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Expand first 2 levels

  const hasChildren =
    item.type === "directory" && item.children && item.children.length > 0;

  const icon = getFileIcon(item.name, item.type);

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 px-2 hover:bg-muted rounded"
        style={{ paddingLeft: `${level * 20}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hover:bg-accent rounded p-0.5"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="w-4" />
        )}

        <span className="text-lg">{icon}</span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.name}</p>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap">
          {item.type === "directory" ? (
            <span>
              {item.fileCount || 0} {item.fileCount === 1 ? "file" : "files"}
            </span>
          ) : (
            item.size && <span>{formatFileSize(item.size)}</span>
          )}

          {item.modified && (
            <span>
              {formatDistanceToNow(new Date(item.modified), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      {isExpanded && hasChildren && (
        <div>
          {item.children!.map((child, idx) => (
            <FileTreeNode key={idx} item={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Agent Workspace Viewer Component
 * Displays folder structure and file details
 */
export function AgentWorkspaceViewer({
  agentName,
  rootPath,
  tree,
  totalFiles,
  totalFolders,
  totalSize,
  lastUpdated,
  error,
}: WorkspaceViewerProps) {
  const [expandAll, setExpandAll] = useState(false);

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 border border-destructive/30 rounded-lg">
        <h3 className="font-semibold text-destructive mb-2">
          Could not load workspace
        </h3>
        <p className="text-sm text-destructive/90">{error}</p>
        <p className="text-xs text-destructive/80 mt-2 font-mono">{rootPath}</p>
      </div>
    );
  }

  if (!tree || totalFiles === 0) {
    return (
      <div className="p-6 text-center bg-muted rounded-lg">
        <Folder className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
        <p className="text-muted-foreground">
          No files in workspace yet
        </p>
        <p className="text-xs text-muted-foreground mt-1">{rootPath}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="bg-muted p-4 rounded-lg">
        <h3 className="font-semibold mb-3">{agentName} Workspace</h3>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="flex items-center gap-2">
            <File className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Files</p>
              <p className="font-medium">{totalFiles}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Folders</p>
              <p className="font-medium">{totalFolders}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total Size</p>
              <p className="font-medium">{formatFileSize(totalSize)}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
          </p>
          <button
            onClick={() => setExpandAll(!expandAll)}
            className="text-xs px-2 py-1 rounded bg-background hover:bg-accent transition-colors"
          >
            {expandAll ? "Collapse All" : "Expand All"}
          </button>
        </div>
      </div>

      {/* File tree */}
      <div className="border rounded-lg p-4 bg-background overflow-auto max-h-96">
        {tree && <FileTreeNode item={tree} level={0} />}
      </div>

      {/* Footer info */}
      <p className="text-xs text-muted-foreground font-mono break-all">
        Path: {rootPath}
      </p>
    </div>
  );
}
