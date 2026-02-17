"use client";

import { useNotification } from "@/hooks/useNotification";
import { useMutationWithNotification } from "@/hooks/useMutationWithNotification";
import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { 
  X, AlertCircle, CheckCircle, FileText, Bug, Sparkles, Lightbulb,
  Plus, Target, Loader2
} from "lucide-react";

interface CreateTaskModalProps {
  agents: any[];
  epics: any[];
  onClose: () => void;
  onSuccess?: () => void;
}

// Task templates with pre-filled data
const TASK_TEMPLATES = {
  content: {
    icon: FileText,
    title: "SEO Content",
    description: "Create optimized content piece",
    defaultPriority: "P2" as const,
    defaultTime: "M" as const,
    suggestedSubtasks: [
      "Research keywords and competitors",
      "Create outline with H2/H3 structure",
      "Write first draft (1,500-2,000 words)",
      "Add internal links and CTAs",
      "Proofread and optimize for readability"
    ]
  },
  bug: {
    icon: Bug,
    title: "Bug Fix",
    description: "Investigate and resolve reported issue",
    defaultPriority: "P1" as const,
    defaultTime: "S" as const,
    suggestedSubtasks: [
      "Reproduce the issue locally",
      "Identify root cause",
      "Implement fix",
      "Test the fix thoroughly",
      "Deploy to production"
    ]
  },
  feature: {
    icon: Sparkles,
    title: "New Feature",
    description: "Build and ship new functionality",
    defaultPriority: "P1" as const,
    defaultTime: "L" as const,
    suggestedSubtasks: [
      "Write technical specification",
      "Create UI/UX mockups if needed",
      "Implement backend API",
      "Build frontend components",
      "Write tests and documentation"
    ]
  },
  research: {
    icon: Lightbulb,
    title: "Research Task",
    description: "Investigate and document findings",
    defaultPriority: "P2" as const,
    defaultTime: "S" as const,
    suggestedSubtasks: [
      "Define research scope and questions",
      "Gather sources and data",
      "Analyze and synthesize findings",
      "Create summary document",
      "Present recommendations"
    ]
  }
};

const TIME_ESTIMATES = [
  { value: "XS", label: "XS — 1 hour", hours: 1 },
  { value: "S", label: "S — 4 hours", hours: 4 },
  { value: "M", label: "M — 1 day", hours: 8 },
  { value: "L", label: "L — 3 days", hours: 24 },
  { value: "XL", label: "XL — 1 week", hours: 40 },
];

export function CreateTaskModal({ agents, epics, onClose, onSuccess }: CreateTaskModalProps) {
  const notif = useNotification();

  const createTaskMutation = useMutation(api.tasks.createTask);
  const createSubtaskMutation = useMutation(api.tasks.createSubtask);
  const createEpicMutation = useMutation(api.epics.create);

  // Epic creation handler with notifications
  const { execute: execCreateEpic, isLoading: isCreatingEpic } = useMutationWithNotification(
    async (args: any) => createEpicMutation?.(args),
    {
      successMessage: "Epic created",
      onSuccess: (id: any) => {
        setCreatedEpicId(id);
        setShowCreateEpicForm(false);
        setNewEpicTitle("");
        setNewEpicDescription("");
      }
    }
  );

  // Task creation handler with notifications
  const { execute: execCreateTask, isLoading: isSubmitting } = useMutationWithNotification(
    async (args: any) => createTaskMutation?.(args),
    {
      successMessage: "Task created",
      onSuccess: async (taskId: any) => {
        onSuccess?.();
        onClose();
      }
    }
  );

  // Epic creation state
  const [createdEpicId, setCreatedEpicId] = useState<string | null>(null);
  const [showCreateEpicForm, setShowCreateEpicForm] = useState(false);
  const [newEpicTitle, setNewEpicTitle] = useState("");
  const [newEpicDescription, setNewEpicDescription] = useState("");

  // Auto-create default epic if none exist
  useEffect(() => {
    if (epics.length === 0 && !createdEpicId) {
      handleAutoCreateEpic();
    }
  }, [epics.length, createdEpicId]);

  const handleAutoCreateEpic = async () => {
    if (!createEpicMutation) return;
    const lead = agents.find(a => a.level === "lead");
    await execCreateEpic({
      title: "General Tasks",
      description: "Default epic for uncategorized work items. All standalone tasks are assigned here.",
      ownerId: lead?._id
    });
  };

  const handleManualCreateEpic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEpicMutation || !newEpicTitle.trim()) return;
    const lead = agents.find(a => a.level === "lead");
    await execCreateEpic({
      title: newEpicTitle.trim(),
      description: newEpicDescription.trim(),
      ownerId: lead?._id
    });
  };

  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof TASK_TEMPLATES | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"P0" | "P1" | "P2" | "P3">("P2");
  const [timeEstimate, setTimeEstimate] = useState<"XS" | "S" | "M" | "L" | "XL" | null>(null);
  const [dueDate, setDueDate] = useState<string>("");
  const [selectedEpic, setSelectedEpic] = useState<string>("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [includeSubtasks, setIncludeSubtasks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use newly created epic or selected one
  const effectiveEpicId = selectedEpic || createdEpicId;

  // Apply template
  const applyTemplate = (key: keyof typeof TASK_TEMPLATES) => {
    const template = TASK_TEMPLATES[key];
    setSelectedTemplate(key);
    setTitle(template.title);
    setDescription(template.description);
    setPriority(template.defaultPriority);
    setTimeEstimate(template.defaultTime);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!effectiveEpicId) {
      setError("Each task must be associated with an epic. Please select or create an epic.");
      return;
    }

    setError(null);

    if (!createTaskMutation) {
      setError("Backend not connected. Run 'npx convex dev' first.");
      return;
    }

    // Convert due date string to timestamp
    const dueTimestamp = dueDate ? new Date(dueDate).getTime() : undefined;

    // Create main task via centralized handler
    const taskId = await execCreateTask({
      title: title.trim(),
      description: description.trim(),
      priority,
      timeEstimate: timeEstimate || undefined,
      dueDate: dueTimestamp,
      epicId: effectiveEpicId as any,
      assigneeIds: selectedAgents as any,
      source: "user",
      createdBy: "user",
    });

    // Create subtasks if template selected and checkbox checked
    if (selectedTemplate && includeSubtasks && createSubtaskMutation && taskId) {
      const template = TASK_TEMPLATES[selectedTemplate];
      for (const subtaskTitle of template.suggestedSubtasks) {
        try {
          await createSubtaskMutation({
            parentId: taskId,
            title: subtaskTitle,
            description: "",
            priority: priority === "P0" ? "P1" : "P2",
            createdBy: "user",
          });
        } catch (err) {
          // Log but don't block - some subtasks may fail
          console.warn("Failed to create subtask:", subtaskTitle);
        }
      }
    }
  };

  // Show epic creation form if explicitly requested
  if (showCreateEpicForm) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content w-full max-w-lg" onClick={e => e.stopPropagation()}>
          <div className="p-6 border-b flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Create New Epic</h2>
              <p className="text-sm text-muted-foreground">All tasks must belong to an epic</p>
            </div>
            <button onClick={() => setShowCreateEpicForm(false)} className="btn btn-ghost p-2">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleManualCreateEpic} className="p-6 space-y-4">
            <div>
              <label className="label">Epic Title *</label>
              <input
                type="text"
                value={newEpicTitle}
                onChange={(e) => setNewEpicTitle(e.target.value)}
                placeholder="e.g., Q1 Marketing Campaign"
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                value={newEpicDescription}
                onChange={(e) => setNewEpicDescription(e.target.value)}
                placeholder="Strategic objective this epic serves..."
                rows={3}
                className="input resize-none"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button 
                type="button" 
                onClick={() => setShowCreateEpicForm(false)} 
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingEpic || !newEpicTitle.trim()}
                className="btn btn-primary flex-1"
              >
                {isCreatingEpic ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating...</>
                ) : (
                  "Create Epic"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Show loading while auto-creating epic
  if (epics.length === 0 && !createdEpicId && isCreatingEpic) {
    return (
      <div className="modal-overlay">
        <div className="modal-content w-full max-w-lg p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-accent" />
          <h2 className="text-xl font-semibold mb-2">Creating Default Epic...</h2>
          <p className="text-muted-foreground">Setting up your first epic to organize tasks</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Create Task</h2>
            <p className="text-sm text-muted-foreground">
              Tasks must be associated with an epic • Subtasks inherit epic from parent
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Epic Selection - Required */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <label className="label flex items-center gap-2 text-blue-900">
              <Target className="w-4 h-4" />
              Epic *
            </label>
            <div className="flex gap-2 mt-2">
              <select
                value={selectedEpic || createdEpicId || ""}
                onChange={(e) => setSelectedEpic(e.target.value)}
                className="input flex-1"
                required
              >
                <option value="">Select an epic...</option>
                {epics.map((epic) => (
                  <option key={epic._id} value={epic._id}>{epic.title}</option>
                ))}
                {createdEpicId && !epics.find(e => e._id === createdEpicId) && (
                  <option value={createdEpicId}>General Tasks (auto-created)</option>
                )}
              </select>
              <button
                type="button"
                onClick={() => setShowCreateEpicForm(true)}
                className="btn btn-secondary"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {!effectiveEpicId && (
              <p className="text-xs text-blue-700 mt-2">
                Every user story must be associated with an epic. Create one above.
              </p>
            )}
          </div>

          {/* Templates */}
          <div>
            <label className="block text-sm font-medium mb-2">Template (optional)</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(TASK_TEMPLATES).map(([key, template]) => {
                const Icon = template.icon;
                const isSelected = selectedTemplate === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyTemplate(key as keyof typeof TASK_TEMPLATES)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      isSelected 
                        ? "border-blue-500 bg-blue-50" 
                        : "border hover:border-strong hover:bg-muted"
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-2 ${isSelected ? "text-blue-600" : "text-muted-foreground"}`} />
                    <p className="text-sm font-medium">{template.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {template.defaultTime} · {template.defaultPriority}
                    </p>
                  </button>
                );
              })}
            </div>
            {selectedTemplate && (
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={includeSubtasks}
                  onChange={(e) => setIncludeSubtasks(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-muted-foreground">
                  Include {TASK_TEMPLATES[selectedTemplate].suggestedSubtasks.length} subtasks
                  {effectiveEpicId && " (subtasks inherit this epic)"}
                </span>
              </label>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="input"
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, use @agent to mention..."
              rows={3}
              className="input resize-none"
            />
          </div>

          {/* Two column row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium mb-2">Priority</label>
              <div className="flex gap-1">
                {["P0", "P1", "P2", "P3"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p as any)}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                      priority === p
                        ? p === "P0" ? "bg-red-100 text-red-700" :
                          p === "P1" ? "bg-orange-100 text-orange-700" :
                          p === "P2" ? "bg-slate-100 text-slate-700" :
                          "bg-gray-100 text-gray-700"
                        : "bg-muted/50 hover:bg-muted"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Estimate */}
            <div>
              <label className="block text-sm font-medium mb-2">Time Estimate</label>
              <select
                value={timeEstimate || ""}
                onChange={(e) => setTimeEstimate(e.target.value as any || null)}
                className="input"
              >
                <option value="">Select...</option>
                {TIME_ESTIMATES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium mb-2">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input w-auto"
            />
          </div>

          {/* Assignees */}
          <div>
            <label className="block text-sm font-medium mb-2">Assign to</label>
            <div className="flex flex-wrap gap-2">
              {agents.map((agent) => (
                <button
                  key={agent._id}
                  type="button"
                  onClick={() => {
                    if (selectedAgents.includes(agent._id)) {
                      setSelectedAgents(selectedAgents.filter(id => id !== agent._id));
                    } else {
                      setSelectedAgents([...selectedAgents, agent._id]);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full border text-sm transition-colors ${
                    selectedAgents.includes(agent._id)
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border hover:bg-muted"
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[10px] text-white font-bold">
                    {agent.name[0]}
                  </div>
                  {agent.name}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !effectiveEpicId || isSubmitting}
              className="btn btn-primary flex-1"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating...</>
              ) : (
                <><CheckCircle className="w-4 h-4 mr-2" /> Create Task</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
