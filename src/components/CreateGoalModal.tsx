"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { X, Target, Loader2, AlertCircle } from "lucide-react";
import { useNotification } from "@/hooks/useNotification";

interface CreateGoalModalProps {
  onClose: () => void;
  tasks?: any[];
  onSuccess?: () => void;
}

const GOAL_CATEGORIES = [
  { value: "business", label: "Business" },
  { value: "personal", label: "Personal" },
  { value: "learning", label: "Learning" },
  { value: "health", label: "Health" },
];

export function CreateGoalModal({ onClose, tasks = [], onSuccess }: CreateGoalModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"business" | "personal" | "learning" | "health">("business");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const notif = useNotification();
  const createGoalMutation = useMutation(api.goals.create);
  const linkTaskMutation = useMutation(api.goals.linkTask);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Goal title is required");
      return;
    }

    setIsLoading(true);
    try {
      const goalId = await createGoalMutation({
        title: title.trim(),
        description: description.trim(),
        category,
        deadline: deadline ? new Date(deadline).getTime() : undefined,
        keyResults: [],
        relatedMemoryRefs: [],
      });

      // Link selected tasks to goal
      for (const taskId of selectedTaskIds) {
        await linkTaskMutation({
          goalId,
          taskId: taskId as any,
        });
      }

      notif.success(`Goal "${title}" created with ${selectedTaskIds.length} task(s)`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create goal");
      notif.error(`Failed to create goal: ${err?.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Create New Goal</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Goal Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Launch product feature"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you trying to achieve? Why is this goal important?"
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={isLoading}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value as any)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    category === cat.value
                      ? "bg-blue-500 text-white border-blue-500"
                      : "border-border hover:bg-muted"
                  }`}
                  disabled={isLoading}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium mb-2">Deadline (Optional)</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Related Tasks */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Link Tasks ({selectedTaskIds.length} selected)
            </label>
            <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-muted/30 rounded-lg border border-border">
              {tasks && tasks.length > 0 ? (
                tasks.map((task: any) => (
                  <label
                    key={task._id}
                    className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.includes(task._id)}
                      onChange={() => toggleTaskSelection(task._id)}
                      className="mt-1 w-4 h-4 rounded border-border focus:ring-2"
                      disabled={isLoading}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.priority} • {task.status}
                      </p>
                    </div>
                  </label>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No tasks available
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
              {isLoading ? "Creating..." : "Create Goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
