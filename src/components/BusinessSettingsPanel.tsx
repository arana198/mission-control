"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Settings, Save, CheckCircle, AlertCircle, Type, Trash2, Star, GitBranch } from "lucide-react";
import { useRouter } from "next/navigation";

interface WorkspaceSettingsPanelProps {
  workspaceId: string;
}

export function SettingsPanel({ workspaceId }: SettingsPanelProps) {
  const router = useRouter();
  const [missionStatement, setMissionStatement] = useState("");
  const [ticketPrefix, setTicketPrefix] = useState("");
  const [customTicketPattern, setCustomTicketPattern] = useState("");
  const [githubRepo, setGitHubRepo] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch current business
  const workspace = useQuery(api.workspaces.getWorkspaceById, { workspaceId: workspaceId as any });
  const ticketPrefixSetting = useQuery((api as any).github.getSetting, { key: "ticketPrefix" });
  const ticketPatternSetting = useQuery((api as any).github.getSetting, { key: "ticketPattern" });
  const githubRepoSetting = useQuery((api as any).github.getSetting, { key: "githubRepo" });

  // Auto-derive pattern from prefix
  const derivedPattern = ticketPrefix ? `${ticketPrefix}-\\d+` : "";

  const update = useMutation(api.workspaces.update);
  const setDefaultWorkspace = useMutation(api.workspaces.setDefault);
  const delete = useMutation(api.workspaces.remove);
  const setSettingMutation = useMutation((api as any).github.setSetting);

  // Load current mission statement and GitHub settings
  useEffect(() => {
    if (business?.missionStatement) {
      setMissionStatement( workspace.missionStatement);
    }
  }, [workspace]);

  useEffect(() => {
    if (ticketPrefixSetting !== undefined && ticketPrefixSetting !== null) {
      setTicketPrefix(ticketPrefixSetting);
    }
    if (ticketPatternSetting !== undefined && ticketPatternSetting !== null) {
      setCustomTicketPattern(ticketPatternSetting);
    }
    if (githubRepoSetting !== undefined && githubRepoSetting !== null) {
      setGitHubRepo(githubRepoSetting);
    }
  }, [ticketPrefixSetting, ticketPatternSetting, githubRepoSetting]);

  const handleSave = async () => {
    if (!missionStatement.trim()) {
      setSaveMessage({ type: "error", text: "Mission statement cannot be empty" });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    setIsSaving(true);
    try {
      // Save mission statement
      await update({
        workspaceId: workspaceId as any,
        missionStatement: missionStatement.trim(),
      });

      // Save GitHub and ticket settings
      if (ticketPrefix) {
        await setSettingMutation({ key: "ticketPrefix", value: ticketPrefix });
      }
      // Only save custom pattern if it differs from the auto-derived pattern
      if (customTicketPattern && customTicketPattern !== derivedPattern) {
        await setSettingMutation({ key: "ticketPattern", value: customTicketPattern });
      }
      if (githubRepo) {
        await setSettingMutation({ key: "githubRepo", value: githubRepo });
      }

      setSaveMessage({ type: "success", text: "Settings saved!" });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error: any) {
      setSaveMessage({
        type: "error",
        text: error.message || "Failed to save settings"
      });
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    missionStatement !== (business?.missionStatement || "") ||
    ticketPrefix !== (ticketPrefixSetting || "") ||
    customTicketPattern !== (ticketPatternSetting || "") ||
    githubRepo !== (githubRepoSetting || "");

  const handleSetDefault = async () => {
    if (business?.isDefault) {
      setSaveMessage({
        type: "error",
        text: "This workspace is already the default"
      });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    try {
      await setDefaultWorkspace({
        workspaceId: workspaceId as any,
      });
      setSaveMessage({
        type: "success",
        text: `${business?.name} is now the default business`
      });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error: any) {
      setSaveMessage({
        type: "error",
        text: error.message || "Failed to set workspace as default"
      });
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await delete({
        workspaceId: workspaceId as any,
      });
      setSaveMessage({
        type: "success",
        text: " deleted successfully. Redirecting..."
      });
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (error: any) {
      setSaveMessage({
        type: "error",
        text: error.message || "Failed to delete business"
      });
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold"> Settings</h2>
          <p className="text-sm text-muted-foreground">Configure {business?.name}</p>
        </div>
      </div>

      {/* Mission Statement Section */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Type className="w-5 h-5 text-[var(--accent)]" />
          <h3 className="font-semibold">Mission Statement</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
               Purpose & Problem Being Solved
            </label>
            <textarea
              value={missionStatement}
              onChange={(e) => setMissionStatement(e.target.value)}
              placeholder="What is your workspace mission? What problem are you solving?"
              className="input w-full min-h-32"
            />
            <p className="text-xs text-muted-foreground mt-2">
              This statement guides task creation, agent autonomy, and strategic decisions.
            </p>
          </div>
        </div>
      </div>

      {/* GitHub Integration Section */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch className="w-5 h-5 text-[var(--accent)]" />
          <h3 className="font-semibold">GitHub Integration</h3>
        </div>

        <div className="space-y-4">
          {/* Ticket Prefix */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Ticket Prefix
              <span className="ml-2 text-xs text-muted-foreground">(for auto-numbering)</span>
            </label>
            <input
              type="text"
              value={ticketPrefix}
              onChange={(e) => setTicketPrefix(e.target.value.toUpperCase())}
              placeholder="EPUK"
              maxLength={10}
              className="input w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Prefix for auto-generated ticket numbers on new tasks.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Examples: EPUK → EPUK-001, EPUK-002, ... or CORE → CORE-001, CORE-002, ...
            </p>
          </div>

          {/* Ticket ID Pattern (Auto-derived) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Ticket ID Pattern
              <span className="ml-2 text-xs text-muted-foreground">(auto-derived from prefix)</span>
            </label>
            {ticketPrefix && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 mb-3">
                <p className="text-sm font-mono text-primary">
                  {derivedPattern}
                </p>
                <p className="text-xs text-primary mt-1">
                  Automatically matches: {ticketPrefix}-001, {ticketPrefix}-002, etc.
                </p>
              </div>
            )}
            {!ticketPrefix && (
              <div className="p-3 rounded-lg bg-muted mb-3">
                <p className="text-sm text-muted-foreground">
                  Set a Ticket Prefix above to auto-generate the pattern
                </p>
              </div>
            )}

            <details className="cursor-pointer">
              <summary className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Override with custom pattern (advanced)
              </summary>
              <div className="mt-3">
                <input
                  type="text"
                  value={customTicketPattern}
                  onChange={(e) => setCustomTicketPattern(e.target.value)}
                  placeholder={derivedPattern || "[A-Za-z]+-\\d+"}
                  className="input w-full"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Leave empty to use auto-derived pattern. Use this to match tickets from other systems.
                </p>
                <p className="text-xs text-muted-foreground mt-2">Examples:</p>
                <ul className="text-xs text-muted-foreground mt-1 ml-4 list-disc">
                  <li><code>[A-Z]+-\d+</code> matches CORE-01, PERF-01, PAY-123</li>
                  <li><code>[a-z]+-\d+</code> matches spot-001, epuk-1</li>
                  <li><code>TICKET-\d+</code> matches TICKET-03, TICKET-99</li>
                </ul>
              </div>
            </details>
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
        </div>
      </div>

      {/* Status Message */}
      {saveMessage && (
        <div className={`flex items-center gap-3 p-4 rounded-lg mb-6 ${
          saveMessage.type === "success"
            ? "bg-success/10 text-success"
            : "bg-destructive/10 text-destructive"
        }`}>
          {saveMessage.type === "success" ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm">{saveMessage.text}</span>
        </div>
      )}

      {/* Save Button */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
        {!hasChanges && (
          <span className="text-xs text-muted-foreground flex items-center">
            No changes to save
          </span>
        )}
      </div>

      {/* Set as Default Section */}
      <div className="card p-6 mb-6 border-l-4" style={{ borderLeftColor: '#fbbf24' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Star className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold">Default </h3>
              <p className="text-sm text-muted-foreground">
                {business?.isDefault
                  ? "This is your default business"
                  : "Set this as your default workspace"}
              </p>
            </div>
          </div>
          <button
            onClick={handleSetDefault}
            disabled={business?.isDefault}
            className="btn flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: business?.isDefault ? '#d1d5db' : '#fbbf24',
              color: business?.isDefault ? '#6b7280' : '#000',
            }}
          >
            <Star className="w-4 h-4" fill="currentColor" />
            {business?.isDefault ? "Current Default" : "Set as Default"}
          </button>
        </div>
      </div>

      {/* Danger Zone: Delete  */}
      <div className="card p-6 border-l-4 border-destructive">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="w-5 h-5 text-destructive" />
          <h3 className="font-semibold text-destructive">Danger Zone</h3>
        </div>

        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-3">
            Delete this workspace and all associated data permanently. This action cannot be undone.
          </p>
          <p className="text-xs text-destructive font-medium">
            This will delete: all tasks, epics, messages, documents, goals, and settings for this  workspace.
          </p>
        </div>

        {showDeleteConfirm ? (
          <div className="bg-destructive/10 p-4 rounded-lg mb-4">
            <p className="text-sm font-medium mb-3">
              Are you sure? Type <code className="bg-card px-2 py-1 rounded">{business?.name}</code> to confirm:
            </p>
            <input
              type="text"
              placeholder={business?.name || " name"}
              className="input w-full mb-3"
              id="confirm-business-name"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const input = document.getElementById("confirm-business-name") as HTMLInputElement;
                  if (input?.value === business?.name) {
                    handleDelete();
                  } else {
                    setSaveMessage({
                      type: "error",
                      text: " name does not match"
                    });
                    setTimeout(() => setSaveMessage(null), 3000);
                  }
                }}
                disabled={isDeleting}
                className="btn bg-destructive hover:bg-destructive/90 text-destructive-foreground flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete "}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="btn bg-destructive hover:bg-destructive/90 text-destructive-foreground flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete 
          </button>
        )}
      </div>
    </div>
  );
}
