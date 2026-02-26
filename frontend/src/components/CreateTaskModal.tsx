"use client";

import { useNotification } from "@/hooks/useNotification";
import { useMutationWithNotification } from "@/hooks/useMutationWithNotification";
import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ModalWrapper, ModalOverlay, ModalContent } from "./Modal";
import {
  extractPriorityFromText,
  detectEpicFromTitle,
  findLeastLoadedAgent,
  estimateTimeFromDescription,
} from "@/lib/smartDefaults";
import {
  AlertCircle, CheckCircle, FileText, Bug, Sparkles, Lightbulb,
  Plus, Target, Loader2
} from "lucide-react";

interface CreateTaskModalProps {
  agents: any[];
  epics: any[];
  tasks: any[];
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

export function CreateTaskModal({ agents, epics, tasks, onClose, onSuccess }: CreateTaskModalProps) {
  const notif = useNotification();

  const createTaskMutation = useMutation(api.tasks.createTask);
  const createSubtaskMutation = useMutation(api.tasks.createSubtask);
  const createEpicMutation = useMutation(api.epics.createEpic);

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

  // Smart defaults tracking
  const [autoFilledPriority, setAutoFilledPriority] = useState(false);
  const [autoFilledEpic, setAutoFilledEpic] = useState(false);
  const [autoFilledAssignee, setAutoFilledAssignee] = useState(false);
  const [autoFilledTimeEstimate, setAutoFilledTimeEstimate] = useState(false);

  // Auto-create default epic if none exist
  useEffect(() => {
    if (epics.length === 0 && !createdEpicId) {
      handleAutoCreateEpic();
    }
  }, [epics.length, createdEpicId]);

  // Smart defaults: Apply on title change (debounced 300ms)
  useEffect(() => {
    if (!title.trim()) return;
    const timer = setTimeout(() => {
      // Priority: suggest based on keywords
      const suggestedPriority = extractPriorityFromText(title);
      if (suggestedPriority !== "P2") {
        setPriority(suggestedPriority);
        setAutoFilledPriority(true);
      }

      // Epic: suggest based on title match
      if (!selectedEpic && !createdEpicId) {
        const epicId = detectEpicFromTitle(title, epics);
        if (epicId) {
          setSelectedEpic(epicId);
          setAutoFilledEpic(true);
        }
      }

      // Assignee: suggest least-loaded agent
      if (selectedAgents.length === 0) {
        const agentId = findLeastLoadedAgent(agents, tasks);
        if (agentId) {
          setSelectedAgents([agentId]);
          setAutoFilledAssignee(true);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [title, selectedEpic, createdEpicId, selectedAgents, epics, agents, tasks]);

  // Smart defaults: Estimate time from description
  useEffect(() => {
    if (!autoFilledTimeEstimate && !timeEstimate) {
      const suggested = estimateTimeFromDescription(description);
      if (suggested) {
        setTimeEstimate(suggested);
        setAutoFilledTimeEstimate(true);
      }
    }
  }, [description, autoFilledTimeEstimate, timeEstimate]);

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
      <ModalWrapper
        isOpen={true}
        onClose={() => setShowCreateEpicForm(false)}
        title="Create New Epic"
        subtitle="All tasks must belong to an epic"
        className="w-full max-w-lg"
      >
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
      </ModalWrapper>
    );
  }

  // Show loading while auto-creating epic
  if (epics.length === 0 && !createdEpicId && isCreatingEpic) {
    return (
      <ModalWrapper
        isOpen={true}
        onClose={onClose}
        title="Creating Default Epic..."
        className="w-full max-w-lg p-8 text-center"
      >
        <div className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-accent" />
          <p className="text-muted-foreground">Setting up your first epic to organize tasks</p>
        </div>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper
      isOpen={true}
      onClose={onClose}
      title="Create Task"
      subtitle="Tasks must be associated with an epic • Subtasks inherit epic from parent"
      className="w-full max-w-2xl sm:max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Epic Selection - Required */}
          <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
            <label className="label flex items-center gap-2 text-primary">
              <Target className="w-4 h-4" />
              Epic *
              {autoFilledEpic && <span className="text-xs text-primary/80 ml-1">(auto)</span>}
            </label>
            <div className="flex gap-2 mt-2">
              <select
                value={selectedEpic || createdEpicId || ""}
                onChange={(e) => {
                  setSelectedEpic(e.target.value);
                  setAutoFilledEpic(false);
                }}
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
              <p className="text-xs text-primary/90 mt-2">
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
                        ? "border-primary bg-primary/10"
                        : "border hover:border-strong hover:bg-muted"
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
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
              <label className="block text-sm font-medium mb-2">
                Priority
                {autoFilledPriority && <span className="text-xs text-muted-foreground ml-1">(auto)</span>}
              </label>
              <div className="flex gap-1">
                {["P0", "P1", "P2", "P3"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPriority(p as any);
                      setAutoFilledPriority(false);
                    }}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                      priority === p
                        ? p === "P0" ? "bg-destructive/20 text-destructive" :
                          p === "P1" ? "bg-warning/20 text-warning" :
                          p === "P2" ? "bg-primary/20 text-primary" :
                          "bg-muted text-muted-foreground"
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
              <label className="block text-sm font-medium mb-2">
                Time Estimate
                {autoFilledTimeEstimate && <span className="text-xs text-muted-foreground ml-1">(auto)</span>}
              </label>
              <select
                value={timeEstimate || ""}
                onChange={(e) => {
                  setTimeEstimate(e.target.value as any || null);
                  setAutoFilledTimeEstimate(false);
                }}
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
            <label className="block text-sm font-medium mb-2">
              Assign to
              {autoFilledAssignee && <span className="text-xs text-muted-foreground ml-1">(auto)</span>}
            </label>
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
                    setAutoFilledAssignee(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full border text-sm transition-colors ${
                    selectedAgents.includes(agent._id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border hover:bg-muted"
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] text-primary-foreground font-bold">
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
    </ModalWrapper>
  );
}
