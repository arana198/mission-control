"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Settings, Save, CheckCircle, AlertCircle, Type } from "lucide-react";

interface BusinessSettingsPanelProps {
  businessId: string;
}

export function BusinessSettingsPanel({ businessId }: BusinessSettingsPanelProps) {
  const [missionStatement, setMissionStatement] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch current business
  const business = useQuery(api.businesses.getById, { businessId: businessId as any });
  const updateBusiness = useMutation(api.businesses.update);

  // Load current mission statement
  useEffect(() => {
    if (business?.missionStatement) {
      setMissionStatement(business.missionStatement);
    }
  }, [business]);

  const handleSave = async () => {
    if (!missionStatement.trim()) {
      setSaveMessage({ type: "error", text: "Mission statement cannot be empty" });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    setIsSaving(true);
    try {
      await updateBusiness({
        businessId: businessId as any,
        missionStatement: missionStatement.trim(),
      });
      setSaveMessage({ type: "success", text: "Mission statement updated!" });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error: any) {
      setSaveMessage({
        type: "error",
        text: error.message || "Failed to save mission statement"
      });
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = missionStatement !== (business?.missionStatement || "");

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <Settings className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Business Settings</h2>
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
              Business Purpose & Problem Being Solved
            </label>
            <textarea
              value={missionStatement}
              onChange={(e) => setMissionStatement(e.target.value)}
              placeholder="What is your business mission? What problem are you solving?"
              className="input w-full min-h-32"
            />
            <p className="text-xs text-muted-foreground mt-2">
              This statement guides task creation, agent autonomy, and strategic decisions.
            </p>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {saveMessage && (
        <div className={`flex items-center gap-3 p-4 rounded-lg mb-6 ${
          saveMessage.type === "success"
            ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
            : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
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
      <div className="flex gap-3">
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
    </div>
  );
}
