"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChecklistItem } from "@/types/task";
import { Plus, X, CheckCircle2, AlertCircle } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { useNotification } from "@/hooks/useNotification";

interface DefinitionOfDoneChecklistProps {
  taskId: Id<"tasks">;
  doneChecklist: ChecklistItem[];
  currentUserId: string; // "user" or agentId
  onUpdate?: (checklist: ChecklistItem[]) => void;
}

/**
 * Definition of Done Checklist Component
 * Allows agents to define and track completion criteria for tasks
 */
export function DefinitionOfDoneChecklist({
  taskId,
  doneChecklist,
  currentUserId,
  onUpdate,
}: DefinitionOfDoneChecklistProps) {
  const [newItemText, setNewItemText] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const notif = useNotification();

  // Mutations
  const addItem = useMutation(api.tasks.addChecklistItem);
  const updateItem = useMutation(api.tasks.updateChecklistItem);
  const removeItem = useMutation(api.tasks.removeChecklistItem);

  // Calculate progress
  const completed = doneChecklist.filter((item) => item.completed).length;
  const total = doneChecklist.length;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
  const isAllDone = total > 0 && completed === total;

  // Handle add new item
  const handleAddItem = async () => {
    if (!newItemText.trim()) return;

    try {
      await addItem({
        taskId,
        text: newItemText.trim(),
        addedBy: currentUserId,
      });
      setNewItemText("");
      setIsAdding(false);
    } catch (error: any) {
      notif.error(error?.message || "Failed to add checklist item");
    }
  };

  // Handle toggle item completion
  const handleToggleItem = async (itemId: string, currentCompleted: boolean) => {
    try {
      await updateItem({
        taskId,
        itemId,
        completed: !currentCompleted,
        updatedBy: currentUserId,
      });
    } catch (error: any) {
      notif.error(error?.message || "Failed to update checklist item");
    }
  };

  // Handle remove item
  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeItem({
        taskId,
        itemId,
        removedBy: currentUserId,
      });
    } catch (error: any) {
      notif.error(error?.message || "Failed to remove checklist item");
    }
  };

  // Handle Enter key on input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Definition of Done
        </h3>

        {/* Progress Bar */}
        {total > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">
                {completed} of {total} items complete
              </span>
              <span className="text-xs font-semibold text-accent">
                {progress}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* All Done Banner */}
        {isAllDone && (
          <div className="mb-3 p-3 rounded-lg bg-green-500/10 border border-green-200">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-700">
                  All done! Ready to close.
                </p>
                <p className="text-xs text-green-600 mt-1">
                  All criteria have been completed. You can mark this task as done.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Checklist Items */}
      {total > 0 && (
        <div className="space-y-2">
          {doneChecklist.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 group transition-colors"
            >
              {/* Checkbox */}
              <button
                onClick={() => handleToggleItem(item.id, item.completed)}
                className="flex-shrink-0 mt-1 w-5 h-5 rounded border-2 border-input bg-background flex items-center justify-center hover:border-accent transition-colors"
                aria-label={`Toggle ${item.text}`}
              >
                {item.completed && (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
              </button>

              {/* Item Text */}
              <div className="flex-1 min-w-0 pt-0.5">
                <p
                  className={`text-sm ${
                    item.completed
                      ? "line-through text-muted-foreground"
                      : "text-foreground"
                  }`}
                >
                  {item.text}
                </p>
                {item.completed && item.completedBy && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ✓ Completed by {item.completedBy}
                    {item.completedAt && (
                      <>
                        {" "}
                        on{" "}
                        {new Date(item.completedAt).toLocaleDateString()}
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* Remove Button */}
              <button
                onClick={() => handleRemoveItem(item.id)}
                className="flex-shrink-0 p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove item"
                aria-label={`Remove ${item.text}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {total === 0 && !isAdding && (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground mb-3">
            No criteria defined yet
          </p>
          <button
            onClick={() => setIsAdding(true)}
            className="btn btn-sm btn-secondary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add First Item
          </button>
        </div>
      )}

      {/* Add Item Input */}
      {(isAdding || total === 0) && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a criterion (e.g., 'Unit tests written', 'Documentation updated')"
            className="flex-1 px-3 py-2 text-sm rounded border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            autoFocus
          />
          <button
            onClick={handleAddItem}
            disabled={!newItemText.trim()}
            className="btn btn-sm btn-primary disabled:opacity-50"
            title="Add item (or press Enter)"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add More Button (when items exist but not adding) */}
      {total > 0 && !isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full py-2 text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 rounded hover:bg-muted/50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Another Item
        </button>
      )}
    </div>
  );
}
