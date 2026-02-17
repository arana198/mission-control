"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMutationWithNotification } from "@/hooks/useMutationWithNotification";
import {
  Settings, GitBranch, Save, RefreshCw, CheckCircle, AlertCircle,
  Info, Zap
} from "lucide-react";

export function SettingsPanel() {
  const [ticketPattern, setTicketPattern] = useState("");
  const [githubRepo, setGitHubRepo] = useState("");
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch current settings
  const ticketPatternSetting = useQuery((api as any).github.getSetting, { key: "ticketPattern" });
  const githubRepoSetting = useQuery((api as any).github.getSetting, { key: "githubRepo" });

  const setSettingMutation = useMutation((api as any).github.setSetting);

  // Centralized mutation handler with notifications
  const { execute: execSetSetting, isLoading: isSaving } = useMutationWithNotification(
    async (args: any) => setSettingMutation?.(args),
    {
      successMessage: "Settings saved!",
      onSuccess: () => {
        setSaveMessage({ type: "success", text: "Settings saved!" });
        setTimeout(() => setSaveMessage(null), 3000);
      }
    }
  );

  // Load current values
  useEffect(() => {
    if (ticketPatternSetting !== undefined && ticketPatternSetting !== null) {
      setTicketPattern(ticketPatternSetting);
    }
    if (githubRepoSetting !== undefined && githubRepoSetting !== null) {
      setGitHubRepo(githubRepoSetting);
    }
  }, [ticketPatternSetting, githubRepoSetting]);

  const handleSave = async () => {
    setSaveMessage(null);

    try {
      await execSetSetting({ key: "ticketPattern", value: ticketPattern });
      if (githubRepo) {
        await execSetSetting({ key: "githubRepo", value: githubRepo });
      }
    } catch (e: any) {
      setSaveMessage({ type: "error", text: e.message || "Failed to save" });
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <Settings className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground">Configure Mission Control</p>
        </div>
      </div>

      {/* GitHub Integration Section */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch className="w-5 h-5 text-[var(--accent)]" />
          <h3 className="font-semibold">GitHub Integration</h3>
        </div>
        
        <div className="space-y-4">
          {/* Ticket Pattern */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Ticket ID Pattern
              <span className="ml-2 text-xs text-muted-foreground">(regex)</span>
            </label>
            <input
              type="text"
              value={ticketPattern}
              onChange={(e) => setTicketPattern(e.target.value)}
              placeholder="[A-Za-z]+-\d+"
              className="input w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Matches ticket IDs in commit messages. Examples:
            </p>
            <ul className="text-xs text-muted-foreground mt-1 ml-4 list-disc">
              <li><code>[A-Z]+-\d+</code> matches CORE-01, PERF-01, PAY-123</li>
              <li><code>[a-z]+-\d+</code> matches spot-001, epuk-1</li>
              <li><code>TICKET-\d+</code> matches TICKET-03, TICKET-99</li>
            </ul>
          </div>

          {/* GitHub Repo */}
          <div>
            <label className="block text-sm font-medium mb-2">
              GitHub Repository
              <span className="ml-2 text-xs text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              value={githubRepo}
              onChange={(e) => setGitHubRepo(e.target.value)}
              placeholder="owner/repo"
              className="input w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              e.g., arana198/mission-control. Leave empty to use local git.
            </p>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn btn-primary flex items-center gap-2"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Settings
            </button>
            
            {saveMessage && (
              <span className={`flex items-center gap-1 text-sm ${
                saveMessage.type === "success" ? "text-green-600" : "text-red-600"
              }`}>
                {saveMessage.type === "success" ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {saveMessage.text}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="card p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">How it works</p>
            <p>Commits are matched against tasks by extracting ticket IDs from commit messages. 
            Add ticket IDs (like CORE-01) to your task titles or tags to link commits.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
