"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Settings, Save, CheckCircle, AlertCircle, Type, Trash2, Star } from "lucide-react";
import { useRouter } from "next/navigation";

interface BusinessSettingsPanelProps {
  businessId: string;
}

export function BusinessSettingsPanel({ businessId }: BusinessSettingsPanelProps) {
  const router = useRouter();
  const [missionStatement, setMissionStatement] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch current business
  const business = useQuery(api.businesses.getById, { businessId: businessId as any });
  const updateBusiness = useMutation(api.businesses.update);
  const setDefaultBusiness = useMutation(api.businesses.setDefault);
  const deleteBusiness = useMutation(api.businesses.remove);

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

  const handleSetDefault = async () => {
    if (business?.isDefault) {
      setSaveMessage({
        type: "error",
        text: "This business is already the default"
      });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    try {
      await setDefaultBusiness({
        businessId: businessId as any,
      });
      setSaveMessage({
        type: "success",
        text: `${business?.name} is now the default business`
      });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error: any) {
      setSaveMessage({
        type: "error",
        text: error.message || "Failed to set business as default"
      });
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleDeleteBusiness = async () => {
    setIsDeleting(true);
    try {
      await deleteBusiness({
        businessId: businessId as any,
      });
      setSaveMessage({
        type: "success",
        text: "Business deleted successfully. Redirecting..."
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
            <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Star className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-semibold">Default Business</h3>
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

      {/* Danger Zone: Delete Business */}
      <div className="card p-6 border-l-4 border-red-500">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="w-5 h-5 text-red-600" />
          <h3 className="font-semibold text-red-600">Danger Zone</h3>
        </div>

        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-3">
            Delete this business and all associated data permanently. This action cannot be undone.
          </p>
          <p className="text-xs text-red-600 font-medium">
            This will delete: all tasks, epics, messages, documents, goals, and settings for this business.
          </p>
        </div>

        {showDeleteConfirm ? (
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-4">
            <p className="text-sm font-medium mb-3">
              Are you sure? Type <code className="bg-white dark:bg-black px-2 py-1 rounded">{business?.name}</code> to confirm:
            </p>
            <input
              type="text"
              placeholder={business?.name || "Business name"}
              className="input w-full mb-3"
              id="confirm-business-name"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const input = document.getElementById("confirm-business-name") as HTMLInputElement;
                  if (input?.value === business?.name) {
                    handleDeleteBusiness();
                  } else {
                    setSaveMessage({
                      type: "error",
                      text: "Business name does not match"
                    });
                    setTimeout(() => setSaveMessage(null), 3000);
                  }
                }}
                disabled={isDeleting}
                className="btn bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Business"}
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
            className="btn bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Business
          </button>
        )}
      </div>
    </div>
  );
}
