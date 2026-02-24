"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Agent } from "@/types/agent";
import { HelpCircle, Send, X, Loader2 } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { useNotification } from "@/hooks/useNotification";

interface HelpRequestButtonProps {
  taskId: Id<"tasks">;
  taskStatus: string; // "in_progress", "blocked", etc.
  currentAgentId: string; // "user" or agentId
  currentAgentName: string;
  agents: Agent[];
}

const HELP_REASONS = [
  "Blocked on dependency",
  "Need design input",
  "Technical blocker",
  "Unclear requirements",
  "Out of scope",
  "Other",
];

/**
 * Help Request Button Component
 * Allows agents to escalate when stuck on a task
 */
export function HelpRequestButton({
  taskId,
  taskStatus,
  currentAgentId,
  currentAgentName,
  agents,
}: HelpRequestButtonProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [reason, setReason] = useState("");
  const [context, setContext] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const notif = useNotification();
  const createHelpRequest = useMutation(api.messages.createHelpRequest);

  // Find lead agent
  const leadAgent = agents.find((a) => a.level === "lead");

  // Only render for in_progress or blocked tasks
  const shouldShow = ["in_progress", "blocked"].includes(taskStatus);

  if (!shouldShow) {
    return null;
  }

  const handleSubmit = async () => {
    if (!reason || !leadAgent) return;

    setIsLoading(true);
    try {
      await createHelpRequest({
        taskId,
        fromId: currentAgentId,
        fromName: currentAgentName,
        reason,
        context: context.trim(),
        leadAgentId: leadAgent._id as any,
      });

      // Show success state
      setIsSuccess(true);
      setReason("");
      setContext("");
      setIsAdding(false);

      // Reset after 3 seconds
      setTimeout(() => {
        setIsSuccess(false);
      }, 3000);
    } catch (error: any) {
      notif.error(error?.message || "Failed to create help request");
    } finally {
      setIsLoading(false);
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <div className="p-3 rounded-lg bg-green-500/10 border border-green-200">
        <div className="flex items-center gap-2 text-green-700">
          <HelpCircle className="w-4 h-4" />
          <span className="text-sm font-semibold">Help requested ✓</span>
        </div>
        <p className="text-xs text-green-600 mt-1">
          {leadAgent?.name} has been notified and will assist you.
        </p>
      </div>
    );
  }

  // Form state
  if (isAdding) {
    return (
      <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-muted-foreground">
            What do you need help with?
          </label>
          <button
            onClick={() => {
              setIsAdding(false);
              setReason("");
              setContext("");
            }}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cancel help request"
            disabled={isLoading}
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Reason dropdown */}
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="input text-sm w-full"
          aria-label="Select help reason"
          disabled={isLoading}
        >
          <option value="">Select a reason...</option>
          {HELP_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        {/* Context textarea */}
        <textarea
          value={context}
          onChange={(e) => {
            const newValue = e.target.value;
            if (newValue.length <= 200) {
              setContext(newValue);
            }
          }}
          placeholder="Add context (optional, max 200 characters)"
          className="input text-sm w-full resize-none"
          rows={3}
          aria-label="Add context for help request"
          disabled={isLoading}
          maxLength={200}
        />

        {/* Character count */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {context.length}/200
          </span>

          {/* Lead agent display */}
          {leadAgent && (
            <span className="text-xs text-muted-foreground">
              Escalating to <span className="font-semibold">{leadAgent.name}</span>
            </span>
          )}
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!reason || isLoading}
          className="w-full btn btn-primary btn-sm disabled:opacity-50"
          title="Escalate to lead agent"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Escalating...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Escalate to Lead
            </>
          )}
        </button>
      </div>
    );
  }

  // Default button state
  return (
    <button
      onClick={() => setIsAdding(true)}
      className="w-full btn btn-secondary btn-sm flex items-center justify-center gap-2"
      title="Request help from lead agent"
    >
      <HelpCircle className="w-4 h-4" />
      I'm Stuck
    </button>
  );
}
