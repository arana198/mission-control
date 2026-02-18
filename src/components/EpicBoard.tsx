"use client";

import { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNotification } from "@/hooks/useNotification";
import { useMutationWithNotification } from "@/hooks/useMutationWithNotification";
import {
  Plus, ChevronRight, Target, Clock, CheckCircle2, AlertCircle,
  ArrowLeft, Users, BarChart3, Layers, Calendar, X, AlertTriangle,
  ArrowRight, CheckCircle, Zap, Edit2, Trash2, ChevronDown, ExternalLink, CheckSquare, Loader2
} from "lucide-react";
import { EpicCard } from "./EpicCard";
import { StatCard } from "./StatCard";

interface Epic {
  _id: string;
  title: string;
  description: string;
  status: "planning" | "active" | "completed";
  progress: number;
  taskIds: string[];
  ownerId?: string;
  createdAt: number;
  updatedAt: number;
}

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  epicId?: string;
  assigneeIds: string[];
  timeEstimate?: string;
  dueDate?: number;
  createdAt?: number;
}

interface Agent {
  _id: string;
  name: string;
  role: string;
  level: string;
}

const kanbanStatuses = ["backlog", "ready", "in_progress", "review", "blocked", "done"];

export function EpicBoard({ epics, tasks, agents = [] }: {
  epics: Epic[];
  tasks: Task[];
  agents?: Agent[];
}) {
  const notif = useNotification();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedEpic, setSelectedEpic] = useState<Epic | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showMigration, setShowMigration] = useState(false);

  // Migration mutations
  const migrateTasksMutation = useMutation(api.migrations.migrateTasksToEpic);
  const assignEpicMutation = useMutation(api.migrations.assignEpic);
  const smartAssignMutation = useMutation(api.migrations.smartAssignEpics);

  // Centralized mutation handlers
  const { execute: execSmartAssign, isLoading: isSmartAssigning } = useMutationWithNotification(
    async (args: any) => smartAssignMutation?.(args),
    {
      successMessage: "",
      onSuccess: (result: any) => {
        notif.success(`Smart-assigned ${result.assignedCount} tasks to matching epics`);
      }
    }
  );

  const { execute: execMigrateTasks, isLoading: isMigrating } = useMutationWithNotification(
    async (args: any) => migrateTasksMutation?.(args),
    {
      successMessage: "",
      onSuccess: (result: any) => {
        notif.success(`Migrated ${result.updatedCount} tasks to "${result.epicTitle}"`);
      }
    }
  );

  const { execute: execAssignEpic, isLoading: isAssigningEpic } = useMutationWithNotification(
    async (args: any) => assignEpicMutation?.(args),
    {
      successMessage: "Task assigned to epic"
    }
  );

  // Sort epics
  const sortedEpics = [...epics].sort((a, b) => {
    const statusOrder = { active: 0, planning: 1, completed: 2 };
    return statusOrder[a.status] - statusOrder[b.status] || b.progress - a.progress;
  });

  if (selectedEpic) {
    return (
      <EpicDetailView
        epic={selectedEpic}
        tasks={tasks.filter(t => t.epicId === selectedEpic._id)}
        agents={agents}
        allEpics={epics}
        onBack={() => setSelectedEpic(null)}
        onSelectTask={setSelectedTask}
      />
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Epics & Roadmap</h2>
          <p className="text-sm text-muted-foreground">Strategic initiatives and progress</p>
        </div>
        <button onClick={() => setIsCreating(true)} className="btn btn-primary">
          <Plus className="w-4 h-4 mr-2" /> New Epic
        </button>
      </div>

      {/* Epic Grid */}
      <div className="grid grid-cols-3 gap-4">
        {sortedEpics.map((epic) => (
          <EpicCard
            key={epic._id}
            epic={epic}
            tasks={tasks}
            agents={agents}
            onClick={() => setSelectedEpic(epic)}
          />
        ))}
      </div>

      {sortedEpics.length === 0 && (
        <div className="empty-state py-16">
          <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">No epics yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first epic to group related tasks
          </p>
        </div>
      )}

      {/* Task Preview Modal */}
      {selectedTask && (
        <TaskPreviewModal 
          task={selectedTask} 
          agents={agents} 
          epic={epics.find(e => e._id === selectedTask.epicId)}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Create Modal */}
      {isCreating && (
        <CreateEpicModal agents={agents} onClose={() => setIsCreating(false)} />
      )}
    </div>
  );
}

// Epic Detail View with Progress Dashboard
function EpicDetailView({ epic, tasks, agents, allEpics, onBack, onSelectTask }: {
  epic: Epic;
  tasks: Task[];
  agents: Agent[];
  allEpics: Epic[];
  onBack: () => void;
  onSelectTask: (task: Task) => void;
}) {
  const notif = useNotification();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const owner = agents.find(a => a._id === epic.ownerId);

  // Mutations
  const updateEpicMutation = useMutation(api.migrations.updateEpic);
  const deleteEpicMutation = useMutation(api.migrations.deleteEpic);

  // Centralized mutation handlers
  const { execute: execUpdateEpic, isLoading: isUpdatingEpic } = useMutationWithNotification(
    async (args: any) => updateEpicMutation?.(args),
    {
      successMessage: "Epic updated",
      onSuccess: () => setIsEditing(false)
    }
  );

  const { execute: execDeleteEpic, isLoading: isDeletingEpic } = useMutationWithNotification(
    async (args: any) => deleteEpicMutation?.(args),
    {
      successMessage: "",
      onSuccess: (result: any) => {
        notif.success(`Deleted epic. ${result.tasksAffected} tasks ${result.reassignedCount > 0 ? "reassigned" : "unassigned"}.`);
        onBack();
      }
    }
  );

  // Calculate stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === "done").length;
  const inProgressTasks = tasks.filter(t => t.status === "in_progress").length;
  const blockedTasks = tasks.filter(t => t.status === "blocked").length;

  // Tasks by status
  const tasksByStatus = kanbanStatuses.map(status => ({
    status,
    count: tasks.filter(t => t.status === status).length,
    tasks: tasks.filter(t => t.status === status)
  }));

  // Workload by agent
  const workloadByAgent = useMemo(() => {
    const workload: Record<string, { agent: Agent; tasks: Task[]; totalHours: number }> = {};
    tasks.forEach(task => {
      task.assigneeIds.forEach(agentId => {
        const agent = agents.find(a => a._id === agentId);
        if (agent) {
          if (!workload[agentId]) {
            workload[agentId] = { agent, tasks: [], totalHours: 0 };
          }
          workload[agentId].tasks.push(task);
          // Estimate hours from timeEstimate
          const hours = task.timeEstimate === "XS" ? 1 :
                       task.timeEstimate === "S" ? 4 :
                       task.timeEstimate === "M" ? 8 :
                       task.timeEstimate === "L" ? 24 :
                       task.timeEstimate === "XL" ? 40 : 0;
          workload[agentId].totalHours += hours;
        }
      });
    });
    return Object.values(workload).sort((a, b) => b.totalHours - a.totalHours);
  }, [tasks, agents]);

  // Calculate estimated completion
  const doneCount = tasks.filter(t => t.status === "done").length;
  const notDoneCount = totalTasks - doneCount;
  const velocity = 2; // Assume 2 tasks per day (configurable)
  const daysRemaining = velocity > 0 ? Math.ceil(notDoneCount / velocity) : null;

  const handleUpdate = async (title: string, description: string, status: string) => {
    await execUpdateEpic({ epicId: epic._id, title, description, status, updatedBy: "user" });
  };

  const handleDelete = async (reassignToId: string) => {
    const reassignTo = reassignToId === "none" ? undefined : reassignToId;
    await execDeleteEpic({ epicId: epic._id, reassignTo, deletedBy: "user" });
  };

  return (
    <div className="max-w-6xl">
      {/* Edit Modal */}
      {isEditing && (
        <EditEpicModal 
          epic={epic}
          agents={agents}
          onClose={() => setIsEditing(false)}
          onSave={handleUpdate}
        />
      )}

      {/* Delete Modal */}
      {isDeleting && (
        <DeleteEpicModal 
          epic={epic}
          allEpics={allEpics.filter(e => e._id !== epic._id)}
          onClose={() => setIsDeleting(false)}
          onDelete={handleDelete}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="btn btn-ghost">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Epics
        </button>
        <div className="flex gap-2">
          <button onClick={() => setIsEditing(true)} className="btn btn-secondary">
            <Edit2 className="w-4 h-4 mr-2" /> Edit
          </button>
          <button onClick={() => setIsDeleting(true)} className="btn btn-danger">
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className={`badge ${
            epic.status === "active" ? "badge-status-active" :
            epic.status === "completed" ? "badge-status-completed" :
            "badge-status-planning"
          }`}>
            {epic.status}
          </span>
          {owner && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Users className="w-4 h-4" /> Lead: {owner.name}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold">{epic.title}</h1>
        <p className="text-foreground/80 mt-2">{epic.description || "No description provided."}</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Tasks" value={totalTasks} icon={Layers} />
        <StatCard label="Completed" value={completedTasks} icon={CheckCircle2} color="green" />
        <StatCard label="In Progress" value={inProgressTasks} icon={Clock} color="amber" />
        <StatCard label="Blocked" value={blockedTasks} icon={AlertCircle} color="red" />
        <StatCard 
          label="Progress" 
          value={`${epic.progress}%`} 
          icon={BarChart3} 
          color="blue"
          subtext={daysRemaining ? `~${daysRemaining} days remaining` : undefined}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: Task pipeline */}
        <div className="col-span-2 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4" /> Tasks by Status
          </h3>
          
          {tasksByStatus.map(({ status, count, tasks: statusTasks }) => (
            count > 0 && (
              <div key={status} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className={`badge badge-status-${status}`}>
                    {status.replace("_", " ")}
                  </span>
                  <span className="text-sm text-muted-foreground">{count} tasks</span>
                </div>
                <div className="space-y-2">
                  {statusTasks.map(task => (
                    <div
                      key={task._id}
                      onClick={() => onSelectTask(task)}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm hover:bg-muted transition-colors cursor-pointer group"
                      title="Click to view task details"
                    >
                      <span className="font-medium truncate group-hover:text-blue-600">{task.title}</span>
                      <div className="flex items-center gap-2">
                        {task.timeEstimate && (
                          <span className="badge bg-blue-100 text-blue-700 text-xs">
                            {task.timeEstimate}
                          </span>
                        )}
                        <span className={`badge badge-priority-${task.priority.toLowerCase()} text-xs`}>
                          {task.priority}
                        </span>
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {task.assigneeIds.length > 0 ? (
                          <div className="flex -space-x-1">
                            {task.assigneeIds.slice(0, 3).map(id => {
                              const ag = agents.find(a => a._id === id);
                              return ag ? (
                                <div key={id} className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] text-white border border-white" title={ag.name}>
                                  {ag.name[0]}
                                </div>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>

        {/* Right: Agent Workload */}
        <div>
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Users className="w-4 h-4" /> Team Workload
          </h3>
          <div className="space-y-3">
            {workloadByAgent.map(({ agent, tasks: agentTasks, totalHours }) => (
              <div key={agent._id} className="card p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                    {agent.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">{agent.role}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <p className="font-semibold">{agentTasks.length}</p>
                    <p className="text-xs text-muted-foreground">tasks</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <p className="font-semibold">{totalHours}h</p>
                    <p className="text-xs text-muted-foreground">estimated</p>
                  </div>
                </div>
              </div>
            ))}
            {workloadByAgent.length === 0 && (
              <p className="text-muted-foreground text-sm">No agents assigned to this epic</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Task Preview Modal
function TaskPreviewModal({ task, agents, epic, onClose }: {
  task: Task;
  agents: Agent[];
  epic?: Epic;
  onClose: () => void;
}) {
  const assignees = task.assigneeIds?.map(id => agents.find(a => a._id === id)).filter(Boolean) || [];
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="card rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b flex items-start justify-between">
          <div className="flex flex-wrap gap-2">
            <span className={`badge badge-priority-${task.priority.toLowerCase()}`}>
              {task.priority}
            </span>
            <span className={`badge badge-status-${task.status}`}>
              {task.status.replace("_", " ")}
            </span>
            {isOverdue && (
              <span className="badge bg-red-100 text-red-700">Overdue</span>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-4">
          <h2 className="text-lg font-semibold">{task.title}</h2>
          
          {task.description && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
              <p className="text-sm bg-muted p-3 rounded whitespace-pre-wrap">{task.description}</p>
            </div>
          )}
          
          {epic && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Epic</h3>
              <div className="flex items-center gap-2 text-sm">
                <Target className="w-4 h-4 text-accent" />
                <span className="text-accent">{epic.title}</span>
              </div>
            </div>
          )}
          
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              Assignees ({assignees.length})
            </h3>
            {assignees.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {assignees.map(agent => (
                  <div key={agent?._id} className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm">
                    <div className="w-4 h-4 rounded-full bg-accent flex items-center justify-center text-[10px] text-accent-foreground">
                      {agent?.name[0]}
                    </div>
                    {agent?.name}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Unassigned</span>
            )}
          </div>
          
          {(task.timeEstimate || task.dueDate) && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {task.timeEstimate && (
                <div>
                  <h3 className="font-medium text-muted-foreground mb-1">Estimate</h3>
                  <span className="badge badge-status-ready">{task.timeEstimate}</span>
                </div>
              )}
              {task.dueDate && (
                <div>
                  <h3 className="font-medium text-muted-foreground mb-1">Due Date</h3>
                  <span className={`text-sm ${isOverdue ? "text-red-600 font-medium" : ""}`}>
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          )}
          
          <div className="text-xs text-muted-foreground pt-2 border-t">
            Created {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'N/A'}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t bg-muted">
          <p className="text-xs text-muted-foreground">
            💡 Click on the main task board to edit details and dependencies
          </p>
        </div>
      </div>
    </div>
  );
}

// Create Epic Modal
function CreateEpicModal({ agents, onClose }: { agents: Agent[]; onClose: () => void }) {
  const notif = useNotification();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  let createEpic: any;
  try {
    createEpic = useMutation(api.epics.createEpic);
  } catch (e) {}

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEpic || !title.trim()) return;
    setIsSubmitting(true);
    try {
      await createEpic({ title: title.trim(), description: description.trim(), ownerId: ownerId || undefined });
      onClose();
    } catch (err) {
      notif.error("Failed to create epic");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create Epic</h2>
          <button onClick={onClose} className="btn btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="Epic name..." required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="input resize-none" rows={3} placeholder="What does this epic aim to achieve?" />
          </div>
          <div>
            <label className="label">Lead (optional)</label>
            <select value={ownerId} onChange={e => setOwnerId(e.target.value)} className="input">
              <option value="">No lead assigned</option>
              {agents.filter(a => a.level === "lead" || a.level === "specialist").map(agent => (
                <option key={agent._id} value={agent._id}>{agent.name} — {agent.role}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSubmitting || !title.trim()} className="btn btn-primary flex-1">Create Epic</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Epic Modal
function EditEpicModal({ 
  epic, 
  agents, 
  onClose, 
  onSave 
}: { 
  epic: Epic;
  agents: Agent[];
  onClose: () => void;
  onSave: (title: string, description: string, status: string) => void;
}) {
  const [title, setTitle] = useState(epic.title);
  const [description, setDescription] = useState(epic.description || "");
  const [status, setStatus] = useState(epic.status);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSave(title.trim(), description.trim(), status);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="card rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">Edit Epic</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Title</label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="input" 
              placeholder="Epic name..." 
              required 
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              className="input resize-none min-h-[100px]" 
              placeholder="What does this epic aim to achieve?" 
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Status</label>
            <select 
              value={status} 
              onChange={e => setStatus(e.target.value as any)} 
              className="input"
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary flex-1">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Epic Modal
function DeleteEpicModal({ 
  epic, 
  allEpics, 
  onClose, 
  onDelete 
}: { 
  epic: Epic;
  allEpics: Epic[];
  onClose: () => void;
  onDelete: (reassignToId: string) => void;
}) {
  const [reassignTo, setReassignTo] = useState("none");
  const [isDeleting, setIsDeleting] = useState(false);
  const hasTasks = epic.taskIds && epic.taskIds.length > 0;

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(reassignTo);
    setIsDeleting(false);
  };

  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="card rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertTriangle className="w-6 h-6" />
            <h2 className="text-lg font-semibold">Delete Epic</h2>
          </div>
          
          <p className="text-slate-600 mb-4">
            Are you sure you want to delete <strong>{epic.title}</strong>?
            {hasTasks && (
              <span className="block mt-2 text-amber-600">
                This epic contains {epic.taskIds.length} task{epic.taskIds.length > 1 ? "s" : ""}.
              </span>
            )}
          </p>

          {hasTasks && (
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">
                What should happen to these tasks?
              </label>
              <select 
                value={reassignTo} 
                onChange={e => setReassignTo(e.target.value)} 
                className="input w-full"
              >
                <option value="none">Leave unassigned (orphaned)</option>
                {allEpics.map(otherEpic => (
                  <option key={otherEpic._id} value={otherEpic._id}>
                    Move to: {otherEpic.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button 
              onClick={handleDelete} 
              disabled={isDeleting} 
              className="btn bg-red-600 text-white hover:bg-red-700 flex-1"
            >
              {isDeleting ? "Deleting..." : "Delete Epic"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
