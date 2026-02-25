"use client";

import { useState } from "react";
import {
  CheckSquare,
  MoveVertical,
  Users,
  X,
} from "lucide-react";
import { getStatusLabel } from "./Badge";

interface BulkActionBarProps {
  bulkMode: boolean;
  selectedTasks: Set<string>;
  filteredTasks: any[];
  agents: any[];
  onToggleBulkMode: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkMove: (status: string) => void;
  onBulkAssign: (agentId: string | null) => void;
}

export function BulkActionBar({
  bulkMode,
  selectedTasks,
  filteredTasks,
  agents,
  onToggleBulkMode,
  onSelectAll,
  onClearSelection,
  onBulkMove,
  onBulkAssign,
}: BulkActionBarProps) {
  const [bulkActionMenu, setBulkActionMenu] = useState<"move" | "assign" | null>(
    null
  );

  const selectedCount = selectedTasks.size;
  const allSelected =
    selectedCount === filteredTasks.length && filteredTasks.length > 0;

  return (
    <div className="card p-4 mb-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onToggleBulkMode}
          className={`btn ${bulkMode ? "btn-primary" : "btn-secondary"}`}
          aria-label={bulkMode ? "Exit bulk select mode" : "Enter bulk select mode"}
          aria-pressed={bulkMode}
        >
          <CheckSquare className="w-4 h-4" />
          Bulk Select
        </button>

        {bulkMode && (
          <>
            <button
              onClick={onSelectAll}
              className="btn btn-secondary"
              aria-label={allSelected ? "Deselect all tasks" : "Select all tasks"}
            >
              {allSelected ? "Deselect All" : "Select All"}
            </button>

            {selectedCount > 0 && (
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                {selectedCount} selected
              </span>
            )}

            {selectedCount > 0 && (
              <div className="relative">
                <button
                  onClick={() =>
                    setBulkActionMenu(
                      bulkActionMenu === "move" ? null : "move"
                    )
                  }
                  className="btn btn-secondary"
                  aria-label="Move selected tasks to a different status"
                  aria-expanded={bulkActionMenu === "move"}
                  aria-haspopup="menu"
                >
                  <MoveVertical className="w-4 h-4" />
                  Move To
                </button>
                {bulkActionMenu === "move" && (
                  <div className="absolute top-full mt-2 left-0 bg-surface border rounded-lg shadow-lg z-10 min-w-[160px]">
                    {[
                      "backlog",
                      "ready",
                      "in_progress",
                      "review",
                      "blocked",
                      "done",
                    ].map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          onBulkMove(status);
                          setBulkActionMenu(null);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-muted text-sm"
                      >
                        {getStatusLabel(status)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedCount > 0 && (
              <div className="relative">
                <button
                  onClick={() =>
                    setBulkActionMenu(
                      bulkActionMenu === "assign" ? null : "assign"
                    )
                  }
                  className="btn btn-secondary"
                  aria-label="Assign selected tasks to an agent"
                  aria-expanded={bulkActionMenu === "assign"}
                  aria-haspopup="menu"
                >
                  <Users className="w-4 h-4" />
                  Assign To
                </button>
                {bulkActionMenu === "assign" && (
                  <div className="absolute top-full mt-2 left-0 bg-surface border rounded-lg shadow-lg z-10 min-w-[180px] max-h-64 overflow-y-auto">
                    {agents.map((agent) => (
                      <button
                        key={agent._id}
                        onClick={() => {
                          onBulkAssign(agent._id);
                          setBulkActionMenu(null);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-muted text-sm flex items-center gap-2"
                      >
                        <span>{agent.emoji}</span>
                        <span>{agent.name}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        onBulkAssign(null);
                        setBulkActionMenu(null);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-muted text-sm border-t"
                    >
                      Unassign
                    </button>
                  </div>
                )}
              </div>
            )}

            {selectedCount > 0 && (
              <button
                onClick={onClearSelection}
                className="btn btn-ghost"
                aria-label="Clear all selected tasks"
              >
                <X className="w-4 h-4" />
                Clear Selection
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
