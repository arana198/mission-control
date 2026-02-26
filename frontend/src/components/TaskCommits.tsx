"use client";

import { useState, useEffect, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { GitBranch, GitCommit, Loader2, RefreshCw, ExternalLink, AlertCircle, Package } from "lucide-react";

/**
 * GitHub Commits Section - links commits to tasks
 * Displays:
 * - GitHub API commits (with links to GitHub)
 * - Agent receipts (commit hashes stored by agents during execution)
 * - Matched ticket IDs as badges
 * - Source badge (github, cache, or local)
 */
export function TaskCommits({ taskId, workspaceId }: { taskId: string; workspaceId?: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commits, setCommits] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<string[]>([]);
  const [matchedTicketIds, setMatchedTicketIds] = useState<string[]>([]);
  const [repo, setRepo] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  // Use action to fetch commits
  const getCommitsAction = useAction((api as any).github?.getCommitsForTask);

  const fetchCommits = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getCommitsAction({ taskId });

      if (result.error) {
        setError(result.error);
        setCommits([]);
        setReceipts([]);
        setMatchedTicketIds([]);
        setRepo(null);
        setSource(null);
      } else {
        setCommits(result?.commits || []);
        setReceipts(result?.receipts || []);
        setMatchedTicketIds(result?.matchedTicketIds || []);
        setRepo(result?.repo || null);
        setSource(result?.source || null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch commits");
      setCommits([]);
      setReceipts([]);
      setMatchedTicketIds([]);
      setRepo(null);
      setSource(null);
    } finally {
      setIsLoading(false);
    }
  }, [getCommitsAction, taskId]);

  useEffect(() => {
    if (taskId) fetchCommits();
  }, [taskId, fetchCommits]);

  const handleRefresh = () => {
    fetchCommits();
  };

  const handleConfigureGitHub = () => {
    if (workspaceId) {
      router.push(`/business-${workspaceId}/settings`);
    }
  };

  const hasContent = commits.length > 0 || receipts.length > 0;
  const totalCount = commits.length + receipts.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <GitBranch className="w-4 h-4" />
          Commits
          {hasContent && (
            <>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {totalCount}
              </span>
              {source && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {source}
                </span>
              )}
            </>
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

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive mb-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium">{error}</p>
              {error.includes("GitHub repo") && workspaceId && (
                <button
                  onClick={handleConfigureGitHub}
                  className="text-xs mt-2 underline hover:opacity-75"
                >
                  Configure GitHub repository in settings →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Matched Ticket IDs */}
      {matchedTicketIds.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1.5">Matched ticket IDs:</p>
          <div className="flex flex-wrap gap-1.5">
            {matchedTicketIds.map((id) => (
              <span
                key={id}
                className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-mono"
              >
                {id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* GitHub Commits */}
      {commits.length > 0 ? (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1.5 font-medium">From GitHub:</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {commits.map((commit: any, idx: number) => (
              <div
                key={commit.fullSha || commit.sha || idx}
                className="p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <GitCommit className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {commit.message?.split('\n')[0] || "No message"}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      {repo && (
                        <a
                          href={`https://github.com/${repo}/commit/${commit.fullSha || commit.sha}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono hover:text-accent flex items-center gap-1"
                        >
                          {commit.sha?.slice(0, 7) || commit.fullSha?.slice(0, 7)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {!repo && (
                        <span className="font-mono">{commit.sha?.slice(0, 7) || commit.fullSha?.slice(0, 7)}</span>
                      )}
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
        </div>
      ) : null}

      {/* Agent Receipts */}
      {receipts.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1.5 font-medium">Agent Execution Receipts:</p>
          <div className="space-y-2">
            {receipts.map((receipt, idx) => (
              <div
                key={receipt || idx}
                className="p-3 rounded-lg bg-warning/10 border border-warning/30"
              >
                <div className="flex items-start gap-2">
                  <Package className="w-4 h-4 mt-0.5 flex-shrink-0 text-warning" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono break-all text-warning">
                      {receipt}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Stored by agent during task execution
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Content State */}
      {!hasContent && !error && (
        <div className="text-sm p-4 rounded-lg text-center bg-muted text-muted-foreground">
          <p>No commits linked to this task</p>
          <p className="text-xs mt-2 opacity-70">
            Add ticket IDs (e.g., CORE-01, MC-001) to task title, tags, or task ID field to link commits
          </p>
        </div>
      )}
    </div>
  );
}
