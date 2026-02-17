"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Agent } from "@/types/agent";
import { Task } from "@/types/task";
import { Epic } from "@/types/epic";
import { useNotification } from "@/hooks/useNotification";
import { useMutationWithNotification } from "@/hooks/useMutationWithNotification";
import { TaskComments } from "./TaskComments";
import { TaskCommits } from "./TaskCommits";
import { ConfirmDialog } from "./ConfirmDialog";
import { AlertTriangle, Calendar, Target, X, Loader2 } from "lucide-react";
import { getPriorityBadgeClass, getStatusLabel } from "./Badge";

/**
 * Task Detail Modal with Jira-Style Layout
 */
export function TaskDetailModal({
  task,
  agents,
  epics,
  tasks,
  onClose,
  addDependency,
  removeDependency
}: {
  task: Task;
  agents: Agent[];
  epics: Epic[];
  tasks: Task[];
  onClose: () => void;
  addDependency?: any;
  removeDependency?: any;
}) {
  const notif = useNotification();
  const [newBlockerId, setNewBlockerId] = useState("");
  const [blockerToRemove, setBlockerToRemove] = useState<string | null>(null);

  const updateTask = useMutation(api.tasks.update);

  // Subscribe to live task data
  const liveTask = useQuery(api.tasks.getById, { id: task._id as any });
  const currentTask = liveTask ?? task;

  // Find blocking tasks
  const blockingTasks = task.blockedBy?.map((id: string) => tasks.find(t => t._id === id)).filter(Boolean) || [];
  const blockingThis = tasks.filter(t => t.blockedBy?.includes(task._id)) || [];

  // Available tasks to block (not self, not already blocked)
  const availableBlockers = tasks.filter(t =>
    t._id !== task._id &&
    !task.blockedBy?.includes(t._id) &&
    t.status !== "done"
  );

  // Use centralized mutation handler for dependency management
  const { execute: execAddDependency, isLoading: isAddingDependency } = useMutationWithNotification(
    async (args: any) => addDependency?.(args),
    {
      successMessage: "Dependency added",
      errorMap: {
        "CIRCULAR_DEPENDENCY": "Cannot add dependency: This would create a circular reference",
        "cannot block itself": "A task cannot block itself",
      },
      onSuccess: () => setNewBlockerId(""),
    }
  );

  const { execute: execRemoveDependency, isLoading: isRemovingDependency } = useMutationWithNotification(
    async (args: any) => removeDependency?.(args),
    {
      successMessage: "Dependency removed",
    }
  );

  const addBlocker = async () => {
    if (!newBlockerId || !addDependency) return;
    await execAddDependency({
      taskId: task._id,
      blockedByTaskId: newBlockerId,
      addedBy: "user",
    });
  };

  const removeBlocker = async (blockerId: string) => {
    if (!removeDependency) return;
    setBlockerToRemove(null);
    await execRemoveDependency({
      taskId: task._id,
      blockedByTaskId: blockerId,
      removedBy: "user",
    });
  };

  const isBlocked = blockingTasks.some((t: any) => t.status !== "done");

  const currentEpic = epics.find((e) => e._id === task.epicId);

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-detail-title"
    >
      <div
        className="modal-content w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Jira-Style Header Row */}
        <div className="p-6 border-b">
          <div className="flex items-start justify-between mb-4">
            {/* Left: Key metadata */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Priority - prominent badge */}
              <span className={`badge badge-priority-${task.priority.toLowerCase()} text-sm px-3 py-1`}>
                {task.priority}
              </span>
              {/* Status - prominent badge */}
              <span className={`badge badge-status-${task.status} text-sm px-3 py-1`}>
                {getStatusLabel(task.status)}
              </span>
              {isBlocked && (
                <span className="badge bg-amber-500/10 text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  Blocked
                </span>
              )}
              {task.timeEstimate && (
                <span className="badge bg-muted text-muted-foreground flex items-center gap-1">
                  ⏱ {task.timeEstimate}
                </span>
              )}
            </div>
            {/* Right: Close button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Title */}
          <h1 id="task-detail-title" className="text-xl font-semibold">
            {task.title}
          </h1>
        </div>

        {/* Two-column layout like Jira */}
        <div className="grid grid-cols-3 gap-6 p-6">
          {/* Left column (2/3): Description, Comments, Dependencies */}
          <div className="col-span-2 space-y-6">
            {/* Description */}
            <div>
              <h3 className="text-sm font-medium mb-2 text-muted-foreground">Description</h3>
              <div className="text-sm whitespace-pre-wrap p-4 rounded-lg min-h-[100px] bg-muted">
                {task.description || "No description provided."}
              </div>
            </div>

            {/* Dependencies */}
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="w-4 h-4" />
                Dependencies
              </h3>

              {/* Blocked by */}
              <div className="mb-4">
                <p className="text-xs mb-2 text-muted-foreground">This task is blocked by:</p>
                {blockingTasks.length > 0 ? (
                  <div className="space-y-2">
                    {blockingTasks.map((blocker: any) => (
                      <div
                        key={blocker._id}
                        className="flex items-center justify-between p-2 rounded-lg"
                        style={{ background: blocker.status === "done" ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)" }}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`badge badge-status-${blocker.status} text-xs`}>
                            {getStatusLabel(blocker.status)}
                          </span>
                          <span className="text-sm">{blocker.title}</span>
                        </div>
                        <button
                          onClick={() => setBlockerToRemove(blocker._id)}
                          disabled={isRemovingDependency}
                          className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                          aria-label={`Remove blocker: ${blocker.title}`}
                        >
                          {isRemovingDependency ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No blockers</p>
                )}

                {/* Add blocker */}
                {availableBlockers.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    <select
                      value={newBlockerId}
                      onChange={(e) => setNewBlockerId(e.target.value)}
                      className="input text-sm flex-1"
                      aria-label="Select task to block this task"
                    >
                      <option value="">Select task that blocks this...</option>
                      {availableBlockers.map(t => (
                        <option key={t._id} value={t._id}>{t.title}</option>
                      ))}
                    </select>
                    <button
                      onClick={addBlocker}
                      disabled={!newBlockerId || isAddingDependency}
                      className="btn btn-secondary text-sm"
                      aria-label="Add dependency"
                    >
                      {isAddingDependency && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                      {isAddingDependency ? "Adding..." : "Add"}
                    </button>
                  </div>
                )}
              </div>

              {/* Blocking others */}
              {blockingThis.length > 0 && (
                <div>
                  <p className="text-xs mb-2 text-muted-foreground">This task is blocking:</p>
                  <div className="space-y-2">
                    {blockingThis.map((blocked: any) => (
                      <div
                        key={blocked._id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted"
                      >
                        <span className={`badge badge-status-${blocked.status} text-xs`}>
                          {getStatusLabel(blocked.status)}
                        </span>
                        <span className="text-sm">{blocked.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Comments Section */}
            <TaskComments taskId={task._id} agents={agents} />

            {/* Commits Section - GitHub Integration */}
            <TaskCommits taskId={task._id} />
          </div>

          {/* Right column (1/3): Epic, Assignees, Details */}
          <div className="space-y-6">
            {/* Epic - Jira Style */}
            <div className="p-3 rounded-lg bg-muted">
              <label className="text-xs font-medium block mb-2 text-muted-foreground">
                Epic
              </label>
              <select
                value={task.epicId || ""}
                onChange={async (e) => {
                  const newEpicId = e.target.value;
                  if (!newEpicId || !updateTask) return;
                  try {
                    await updateTask({ id: task._id as any, epicId: newEpicId as any });
                    notif.success("Epic updated");
                  } catch (err) {
                    notif.error("Failed to update epic");
                  }
                }}
                className="input text-sm w-full"
                aria-label="Select epic"
              >
                <option value="">None</option>
                {epics.map((epic) => (
                  <option key={epic._id} value={epic._id}>{epic.title}</option>
                ))}
              </select>
              {currentEpic && (
                <div className="flex items-center gap-2 mt-2 p-2 rounded text-xs bg-blue-500/10">
                  <Target className="w-3 h-3 text-accent" />
                  <span className="text-accent">{currentEpic.title}</span>
                </div>
              )}
            </div>

            {/* Assignees - Jira Style */}
            <div className="p-3 rounded-lg bg-muted">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Assignees
                </label>
              </div>
              <div className="space-y-2">
                {task.assigneeIds.length > 0 ? (
                  task.assigneeIds.map((id: string) => {
                    const agent = agents.find((a) => a._id === id);
                    return agent ? (
                      <div
                        key={id}
                        className="flex items-center justify-between p-2 rounded-lg group bg-surface"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs bg-accent text-accent-foreground">
                            {agent.name[0]}
                          </div>
                          <span className="text-sm">{agent.name}</span>
                        </div>
                        <button
                          onClick={async () => {
                            if (!updateTask) return;
                            const newAssignees = task.assigneeIds.filter((aId: string) => aId !== id);
                            try {
                              await updateTask({ id: task._id as any, assigneeIds: newAssignees as any });
                              notif.success("Assignee removed");
                            } catch (err) {
                              notif.error("Failed to remove assignee");
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:opacity-100 rounded transition-all"
                          title="Remove assignee"
                          aria-label={`Remove ${agent.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : null;
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">Unassigned</p>
                )}

                {/* Add assignee */}
                <select
                  value=""
                  onChange={async (e) => {
                    const agentId = e.target.value;
                    if (!agentId || !updateTask) return;
                    if (task.assigneeIds.includes(agentId)) {
                      notif.warning("Agent already assigned");
                      return;
                    }
                    const newAssignees = [...task.assigneeIds, agentId];
                    try {
                      await updateTask({ id: task._id as any, assigneeIds: newAssignees as any });
                      notif.success("Assignee added");
                    } catch (err) {
                      notif.error("Failed to add assignee");
                    }
                    e.target.value = "";
                  }}
                  className="input text-sm w-full"
                  aria-label="Add assignee"
                >
                  <option value="">+ Add assignee...</option>
                  {agents
                    .filter(a => !task.assigneeIds.includes(a._id))
                    .map((agent) => (
                      <option key={agent._id} value={agent._id}>{agent.name}</option>
                    ))}
                </select>
              </div>
            </div>

            {/* Due Date - Jira Style */}
            {task.dueDate && (
              <div className="p-3 rounded-lg bg-muted">
                <label className="text-xs font-medium block mb-1 text-muted-foreground">
                  Due Date
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-accent" />
                  <span className="text-sm">{new Date(task.dueDate).toLocaleDateString()}</span>
                </div>
              </div>
            )}

            {/* Created date */}
            <div className="p-3 rounded-lg bg-muted">
              <label className="text-xs font-medium block mb-1 text-muted-foreground">
                Created
              </label>
              <span className="text-sm">
                {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : "Unknown"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation dialog for removing blocker */}
      {blockerToRemove && (
        <ConfirmDialog
          title="Remove Blocker?"
          description="Are you sure you want to remove this blocking dependency? The task may no longer be blocked."
          confirmLabel="Remove"
          cancelLabel="Keep"
          variant="destructive"
          isLoading={isRemovingDependency}
          onConfirm={() => removeBlocker(blockerToRemove)}
          onCancel={() => setBlockerToRemove(null)}
        />
      )}
    </div>
  );
}
