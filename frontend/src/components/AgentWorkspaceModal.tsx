"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { AgentWorkspaceViewer } from "./AgentWorkspaceViewer";

interface AgentWorkspaceModalProps {
  agentId: string;
  agentName: string;
  onClose: () => void;
}

interface WorkspaceData {
  agentName: string;
  rootPath: string;
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  tree?: any;
  lastUpdated: number;
  error?: string;
}

export function AgentWorkspaceModal({
  agentId,
  agentName,
  onClose,
}: AgentWorkspaceModalProps) {
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          agentId,
          maxDepth: "3",
          includeHidden: "false",
        });
        const response = await fetch(
          `/api/agents/workspace/structure?${params}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch workspace structure");
        }

        const data = await response.json();
        setWorkspaceData(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load workspace"
        );
        setWorkspaceData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspace();
  }, [agentId]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{agentName} Workspace</h2>
            <p className="text-xs text-muted-foreground mt-1">
              View files and folder structure
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
              <p className="text-muted-foreground">Loading workspace...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-destructive/10 border border-destructive/30 rounded-lg">
              <h3 className="font-semibold text-destructive mb-2">Error</h3>
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : workspaceData ? (
            <AgentWorkspaceViewer
              agentName={agentName}
              rootPath={workspaceData.rootPath}
              tree={workspaceData.tree}
              totalFiles={workspaceData.totalFiles}
              totalFolders={workspaceData.totalFolders}
              totalSize={workspaceData.totalSize}
              lastUpdated={workspaceData.lastUpdated}
              error={workspaceData.error}
            />
          ) : (
            <div className="p-6 text-center bg-muted rounded-lg">
              <p className="text-muted-foreground">Unable to load workspace</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
