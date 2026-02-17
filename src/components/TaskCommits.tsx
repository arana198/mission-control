"use client";

import { useState, useEffect, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { GitBranch, GitCommit, Loader2, RefreshCw } from "lucide-react";

/**
 * GitHub Commits Section - links commits to tasks
 */
export function TaskCommits({ taskId }: { taskId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commits, setCommits] = useState<any[]>([]);

  // Use action to fetch commits (actions can run Node.js for git CLI)
  const getCommitsAction = useAction((api as any).github?.getCommitsForTask);

  const fetchCommits = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await getCommitsAction({ taskId });
      setCommits(result?.commits || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch commits");
    } finally {
      setIsLoading(false);
    }
  }, [getCommitsAction, taskId]);

  useEffect(() => {
    if (taskId) fetchCommits();
  }, [taskId, fetchCommits]);

  const handleRefresh = () => {
    setError(null);
    fetchCommits();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <GitBranch className="w-4 h-4" />
          Commits
          {commits.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              local
            </span>
          )}
        </h3>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          title="Refresh commits"
          aria-label="Refresh commits"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-sm bg-red-500/10 text-red-600">
          {error}
        </div>
      )}

      {commits.length > 0 ? (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {commits.map((commit: any, idx: number) => (
            <div
              key={commit.sha || idx}
              className="p-3 rounded-lg bg-muted"
            >
              <div className="flex items-start gap-2">
                <GitCommit className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {commit.message?.split('\n')[0] || "No message"}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="font-mono">{commit.sha?.slice(0, 7)}</span>
                    <span>•</span>
                    <span>{commit.author || "Unknown"}</span>
                    <span>•</span>
                    <span>{commit.date ? new Date(commit.date).toLocaleDateString() : ""}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm p-4 rounded-lg text-center bg-muted text-muted-foreground">
          No commits linked to this task
          <p className="text-xs mt-1 opacity-70">
            Add ticket IDs (e.g., CORE-01) to task title or tags to link commits
          </p>
        </div>
      )}
    </div>
  );
}
