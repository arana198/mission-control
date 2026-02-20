"use client";

import { useState } from "react";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { WikiEditor } from "./WikiEditor";
import type { WikiPageHistory } from "@/convex/wiki";
import { formatDistanceToNow } from "date-fns";

interface WikiHistoryProps {
  history: WikiPageHistory[];
  currentTitle: string;
  onBack: () => void;
  onRestore: (historyId: string) => void;
}

/**
 * WikiHistory - Version history panel (slide-in from right)
 * Shows version history list and allows restoration
 */
export function WikiHistory({ history, currentTitle, onBack, onRestore }: WikiHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<WikiPageHistory | null>(null);

  return (
    <div className="flex h-full bg-background">
      {/* History list (left side) */}
      <div className="w-64 border-r flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 p-4 border-b sticky top-0 bg-background z-10">
          <button
            onClick={onBack}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold">Version History</h2>
        </div>

        {/* Versions list */}
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No history available</p>
          ) : (
            <div className="space-y-1 p-2">
              {history.map((version) => (
                <button
                  key={version._id}
                  onClick={() => setSelectedVersion(version)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedVersion?._id === version._id
                      ? "bg-primary/10 border-l-2 border-l-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <p className="text-sm font-medium truncate">v{version.version}</p>
                  <p className="text-xs text-muted-foreground">{version.savedByName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(version.savedAt, { addSuffix: true })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Version preview (right side) */}
      <div className="flex-1 flex flex-col">
        {selectedVersion ? (
          <>
            {/* Preview header */}
            <div className="border-b sticky top-0 bg-background z-10">
              <div className="flex items-center justify-between p-4">
                <div>
                  <h3 className="text-lg font-semibold">v{selectedVersion.version}</h3>
                  <p className="text-xs text-muted-foreground">
                    by {selectedVersion.savedByName} on{" "}
                    {new Date(selectedVersion.savedAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => onRestore(selectedVersion._id)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore
                </button>
              </div>
            </div>

            {/* Preview content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold mb-4">{selectedVersion.title}</h2>
                <WikiEditor content={selectedVersion.content} editable={false} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a version to preview
          </div>
        )}
      </div>
    </div>
  );
}
