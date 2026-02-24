"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Agent } from "@/types/agent";
import { Task } from "@/types/task";
import { Epic } from "@/types/epic";
import { useNotification } from "@/hooks/useNotification";
import { useMutationWithNotification } from "@/hooks/useMutationWithNotification";
import { EnhancedTaskComments } from "./EnhancedTaskComments";
import { TaskCommits } from "./TaskCommits";
import { ConfirmDialog } from "./ConfirmDialog";
import { DefinitionOfDoneChecklist } from "./DefinitionOfDoneChecklist";
import { HelpRequestButton } from "./HelpRequestButton";
import { DependencyGraph } from "./DependencyGraph";
import { AlertTriangle, Calendar, Target, X, Loader2, ChevronDown } from "lucide-react";
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
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState(task.description || "");
  const [isUpdatingDescription, setIsUpdatingDescription] = useState(false);

  const updateTask = useMutation(api.tasks.update);

  const priorities = ["P0", "P1", "P2", "P3"] as const;
  const statuses = ["backlog", "ready", "in_progress", "review", "blocked", "done"] as const;

  // Subscribe to live task data
  const liveTask = useQuery(api.tasks.getTaskById, { taskId: task._id as any });
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

  const handlePriorityChange = async (newPriority: typeof priorities[number]) => {
    if (!updateTask || newPriority === task.priority) {
      setShowPriorityDropdown(false);
      return;
    }
    setIsUpdatingPriority(true);
    try {
      await updateTask({ id: task._id as any, priority: newPriority as any });
      notif.success(`Priority changed to ${newPriority}`);
      setShowPriorityDropdown(false);
    } catch (err) {
      notif.error("Failed to update priority");
    } finally {
      setIsUpdatingPriority(false);
    }
  };

  const handleStatusChange = async (newStatus: typeof statuses[number]) => {
    if (!updateTask || newStatus === task.status) {
      setShowStatusDropdown(false);
      return;
    }
    setIsUpdatingStatus(true);
    try {
      await updateTask({ id: task._id as any, status: newStatus as any });
      notif.success(`Status changed to ${getStatusLabel(newStatus)}`);
      setShowStatusDropdown(false);
    } catch (err: any) {
      const errorMsg = err?.message || "Failed to update status";
      notif.error(errorMsg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDescriptionChange = async () => {
    if (!updateTask || descriptionValue === task.description) {
      setIsEditingDescription(false);
      return;
    }
    setIsUpdatingDescription(true);
    try {
      await updateTask({ id: task._id as any, description: descriptionValue });
      notif.success("Description updated");
      setIsEditingDescription(false);
    } catch (err) {
      notif.error("Failed to update description");
      setDescriptionValue(task.description || "");
    } finally {
      setIsUpdatingDescription(false);
    }
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
        {/* Clean Header */}
        <div className="p-6 border-b bg-gradient-to-br from-background to-muted/20">
          <div className="flex items-start justify-between mb-3">
            {/* Ticket number - prominent and small */}
            {task.ticketNumber && (
              <span className="font-mono font-bold text-xs tracking-wider text-muted-foreground uppercase">
                {task.ticketNumber}
              </span>
            )}
            {/* Right: Close button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted/50 rounded-lg transition-colors -mr-2"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Title - main focus */}
          <h1 id="task-detail-title" className="text-2xl font-semibold tracking-tight">
            {task.title}
          </h1>
        </div>

        {/* Two-column layout like Jira */}
        <div className="grid grid-cols-3 gap-6 p-6">
          {/* Left column (2/3): Description, Comments, Dependencies */}
          <div className="col-span-2 space-y-6">
            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
                {!isEditingDescription && (
                  <button
                    onClick={() => {
                      setIsEditingDescription(true);
                      setDescriptionValue(task.description || "");
                    }}
                    className="text-xs px-2 py-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="Click to edit"
                  >
                    Edit
                  </button>
                )}
              </div>
              {isEditingDescription ? (
                <div className="space-y-2">
                  <textarea
                    value={descriptionValue}
                    onChange={(e) => setDescriptionValue(e.target.value)}
                    className="w-full p-3 border border-border rounded-lg text-sm min-h-[120px] font-mono"
                    placeholder="Enter task description..."
                    disabled={isUpdatingDescription}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleDescriptionChange}
                      disabled={isUpdatingDescription}
                      className="btn btn-primary text-sm"
                    >
                      {isUpdatingDescription ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          Saving...
                        </>
                      ) : (
                        "Save"
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingDescription(false);
                        setDescriptionValue(task.description || "");
                      }}
                      disabled={isUpdatingDescription}
                      className="btn btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm whitespace-pre-wrap p-4 rounded-lg min-h-[100px] bg-muted hover:bg-muted/80 transition-colors cursor-pointer"
                  onClick={() => {
                    setIsEditingDescription(true);
                    setDescriptionValue(task.description || "");
                  }}
                >
                  {task.description || "No description provided. Click to add one."}
                </div>
              )}
            </div>

            {/* Definition of Done Checklist */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <DefinitionOfDoneChecklist
                taskId={task._id as any}
                doneChecklist={task.doneChecklist ?? []}
                currentUserId="user"
              />
            </div>

            {/* Dependencies - Visualization */}
            <div>
              <div className="mb-4">
                {/* Dependency Graph Visualization */}
                <DependencyGraph
                  task={currentTask}
                  allTasks={tasks}
                  onTaskClick={() => {
                    // Node clicked - in future, could open task in new modal
                    // For now, visualization is the primary feature
                  }}
                />
              </div>

              {/* Add/Remove blockers form */}
              {(blockingTasks.length > 0 || availableBlockers.length > 0) && (
                <div className="pt-4 border-t border-border">
                  <h4 className="text-xs font-medium text-muted-foreground mb-3">
                    Manage Dependencies
                  </h4>

                  {/* Remove blockers */}
                  {blockingTasks.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs mb-2 text-muted-foreground">Remove blocker:</p>
                      <div className="space-y-2">
                        {blockingTasks.map((blocker: any) => (
                          <button
                            key={blocker._id}
                            onClick={() => setBlockerToRemove(blocker._id)}
                            disabled={isRemovingDependency}
                            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-red-50 transition-colors"
                            aria-label={`Remove blocker: ${blocker.title}`}
                          >
                            <span className="text-sm text-muted-foreground">
                              {blocker.title}
                            </span>
                            {isRemovingDependency ? (
                              <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                            ) : (
                              <X className="w-4 h-4 text-red-600" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add blocker */}
                  {availableBlockers.length > 0 && (
                    <div className="flex gap-2">
                      <select
                        value={newBlockerId}
                        onChange={(e) => setNewBlockerId(e.target.value)}
                        className="input text-sm flex-1"
                        aria-label="Select task to block this task"
                      >
                        <option value="">Add blocker...</option>
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
              )}
            </div>

            {/* Comments Section */}
            <EnhancedTaskComments
              taskId={task._id}
              businessId={currentTask?.businessId ?? ""}
              agentId="user"
              agentName="You"
              agents={agents}
            />
          </div>

          {/* Right column (1/3): Epic, Assignees, Details */}
          <div className="space-y-5">
            {/* Metadata Card - organized cleanly */}
            <div className="p-4 rounded-lg border border-border bg-card">
              {/* Priority - Clickable */}
              <div className="mb-4 pb-4 border-b border-border/50">
                <p className="text-xs font-medium text-muted-foreground mb-2">Priority</p>
                <div className="relative">
                  <button
                    onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                    disabled={isUpdatingPriority}
                    className={`w-full badge badge-priority-${task.priority.toLowerCase()} text-sm px-3 py-2 flex items-center justify-between hover:shadow-md transition-all cursor-pointer disabled:opacity-50`}
                    aria-label="Click to change priority"
                  >
                    {isUpdatingPriority ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <span>{task.priority}</span>
                        <ChevronDown className="w-3 h-3 opacity-50" />
                      </>
                    )}
                  </button>
                  {showPriorityDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50">
                      {priorities.map((priority) => (
                        <button
                          key={priority}
                          onClick={() => handlePriorityChange(priority)}
                          disabled={isUpdatingPriority}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                            priority === task.priority ? "font-semibold bg-muted/50" : ""
                          }`}
                        >
                          {priority}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Status - Clickable */}
              <div className="mb-4 pb-4 border-b border-border/50">
                <p className="text-xs font-medium text-muted-foreground mb-2">Status</p>
                <div className="relative">
                  <button
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    disabled={isUpdatingStatus}
                    className={`w-full badge badge-status-${task.status} text-sm px-3 py-2 flex items-center justify-between hover:shadow-md transition-all cursor-pointer disabled:opacity-50`}
                    aria-label="Click to change status"
                  >
                    {isUpdatingStatus ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <span>{getStatusLabel(task.status)}</span>
                        <ChevronDown className="w-3 h-3 opacity-50" />
                      </>
                    )}
                  </button>
                  {showStatusDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50">
                      {statuses.map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(status)}
                          disabled={isUpdatingStatus}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                            status === task.status ? "font-semibold bg-muted/50" : ""
                          }`}
                        >
                          {getStatusLabel(status)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Time Estimate */}
              {task.timeEstimate && (
                <div className="mb-4 pb-4 border-b border-border/50">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Estimate</p>
                  <p className="text-sm font-medium">{task.timeEstimate}</p>
                </div>
              )}

              {/* Epic Selection */}
              <div className="mb-4 pb-4 border-b border-border/50">
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
              </div>

              {/* Dates */}
              <div className="space-y-3">
                {task.dueDate && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Due Date</p>
                    <p className="text-sm">{new Date(task.dueDate).toLocaleDateString()}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Created</p>
                  <p className="text-sm">{task.createdAt ? new Date(task.createdAt).toLocaleDateString() : "Unknown"}</p>
                </div>
              </div>

              {/* Blocked Status */}
              {isBlocked && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">Blocked</span>
                  </div>
                </div>
              )}
            </div>

            {/* Assignees Card */}
            <div className="p-4 rounded-lg border border-border bg-card">
              <label className="text-xs font-medium text-muted-foreground block mb-3">
                Assignees
              </label>
              <div className="space-y-2">
                {task.assigneeIds.length > 0 ? (
                  task.assigneeIds.map((id: string) => {
                    const agent = agents.find((a) => a._id === id);
                    return agent ? (
                      <div
                        key={id}
                        className="flex items-center justify-between p-2 rounded group hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-accent/20 text-accent">
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
                          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-600 rounded transition-all"
                          title="Remove assignee"
                          aria-label={`Remove ${agent.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : null;
                  })
                ) : (
                  <p className="text-sm text-muted-foreground py-2">Unassigned</p>
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
                  className="input text-sm w-full mt-2"
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

            {/* Help Request Button */}
            <div className="p-4 rounded-lg border border-border bg-card">
              <HelpRequestButton
                taskId={task._id as any}
                taskStatus={task.status}
                currentAgentId="user"
                currentAgentName="You"
                agents={agents}
              />
            </div>

            {/* Commits Section - GitHub Integration */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <TaskCommits taskId={task._id} businessId={currentTask?.businessId} />
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
