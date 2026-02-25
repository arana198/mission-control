"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Trash2, Star, Plus } from "lucide-react";

interface WorkspaceFormData {
  name: string;
  slug: string;
  emoji: string;
  color: string;
  description: string;
  missionStatement: string;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export default function esPage() {
  const router = useRouter();
  const businesses = useQuery(api.workspaces.getAll);
  const createWorkspace = useMutation(api.workspaces.create);
  const removeWorkspace = useMutation(api.workspaces.remove);
  const setDefaultWorkspace = useMutation(api.workspaces.setDefault);
  const clearAllDataMutation = useMutation(api.admin.clearAllData);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<WorkspaceFormData>({
    name: "",
    slug: "",
    emoji: "🚀",
    color: "#6366f1",
    description: "",
    missionStatement: "",
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData({
      ...formData,
      name,
      slug: generateSlug(name),
    });
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!formData.name.trim()) {
        setError(" name is required");
        return;
      }
      if (!formData.slug.trim()) {
        setError("Slug is required");
        return;
      }
      if (!formData.missionStatement.trim()) {
        setError("Mission statement is required");
        return;
      }

      await createWorkspace({
        name: formData.name,
        slug: formData.slug,
        emoji: formData.emoji,
        color: formData.color,
        description: formData.description,
        missionStatement: formData.missionStatement,
      });

      // Reset form
      setFormData({
        name: "",
        slug: "",
        emoji: "🚀",
        color: "#6366f1",
        description: "",
        missionStatement: "",
      });
      setShowCreateForm(false);
      // Redirect to first workspace
      if (businesses && businesses.length > 0) {
        router.push(`/${businesses[0].slug}/overview`);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to create business");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (workspaceId: string) => {
    try {
      await removeWorkspace({ workspaceId });
      setDeleteConfirmId(null);
    } catch (err: any) {
      setError(err?.message || "Failed to delete business");
    }
  };

  const handleSetDefault = async (workspaceId: string) => {
    try {
      await setDefaultWorkspace({ workspaceId });
    } catch (err: any) {
      setError(err?.message || "Failed to set default business");
    }
  };

  const handleClearAllData = async () => {
    if (deleteAllConfirmText !== "DELETE") {
      setError("Type 'DELETE' to confirm");
      return;
    }

    try {
      setIsSubmitting(true);
      await clearAllDataMutation();
      setShowDeleteAllConfirm(false);
      setDeleteAllConfirmText("");
      setError(null);
      // Redirect to empty state
      router.push("/");
    } catch (err: any) {
      setError(err?.message || "Failed to clear all data");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (businesses === undefined) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto py-8">
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Workspace Management</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus size={18} />
          Create Workspace
        </button>
      </div>

      {/* Create Workspace Form */}
      {showCreateForm && (
        <div className="mb-8 p-6 border border-border rounded-lg bg-card">
          <h2 className="text-xl font-semibold mb-4">Create New </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Workspace Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={handleNameChange}
                  placeholder="e.g., Mission Control HQ"
                  className="w-full px-3 py-2 border border-border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Slug *</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={handleSlugChange}
                  placeholder="auto-generated from name"
                  className="w-full px-3 py-2 border border-border rounded-lg font-mono text-sm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Emoji</label>
                <input
                  type="text"
                  value={formData.emoji}
                  onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                  maxLength={2}
                  className="w-full px-3 py-2 border border-border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Color</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg h-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the business"
                className="w-full px-3 py-2 border border-border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Mission Statement *</label>
              <textarea
                value={formData.missionStatement}
                onChange={(e) => setFormData({ ...formData, missionStatement: e.target.value })}
                placeholder="What problem does this workspace solve?"
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg"
                required
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? "Creating..." : "Create Workspace"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Workspaces List */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Workspaces ({businesses?.length || 0})</h2>
        {!businesses || businesses.length === 0 ? (
          <p className="text-muted-foreground">No workspaces yet. Create one to get started.</p>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {businesses.map((business: any) => (
              <div
                key={business._id}
                className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-xl"
                      style={{ backgroundColor: business.color || "#6366f1" }}
                    >
                      {business.emoji || "🚀"}
                    </div>
                    <div>
                      <h3 className="font-semibold">{business.name}</h3>
                      <p className="text-sm text-muted-foreground font-mono">{business.slug}</p>
                    </div>
                  </div>
                  {business.isDefault && (
                    <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
                      Default
                    </span>
                  )}
                </div>

                {business.description && (
                  <p className="text-sm text-muted-foreground mb-3">{business.description}</p>
                )}

                <p className="text-xs text-muted-foreground mb-4">
                  Last updated: {new Date(business.updatedAt).toLocaleDateString()}
                </p>

                <div className="flex gap-2">
                  {!business.isDefault && (
                    <button
                      onClick={() => handleSetDefault(business._id)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      <Star size={16} />
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteConfirmId(business._id)}
                    disabled={business.isDefault}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>

                {/* Delete Confirmation */}
                {deleteConfirmId === business._id && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                    <p className="font-medium text-red-900 mb-2">Delete "{business.name}"?</p>
                    <p className="text-red-700 mb-3">This action cannot be undone.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="flex-1 px-3 py-1 text-sm border border-red-200 rounded hover:bg-red-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(business._id)}
                        className="flex-1 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="p-6 border-2 border-red-200 rounded-lg bg-red-50">
        <h2 className="text-lg font-semibold text-red-900 mb-2">Danger Zone</h2>
        <p className="text-red-700 mb-4">
          Delete all data from all tables. This cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteAllConfirm(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Delete All Data
        </button>

        {showDeleteAllConfirm && (
          <div className="mt-4 p-4 bg-white border border-red-200 rounded">
            <p className="font-medium mb-3">
              Type <span className="font-mono bg-gray-100 px-2 py-1 rounded">DELETE</span> to confirm
            </p>
            <input
              type="text"
              value={deleteAllConfirmText}
              onChange={(e) => setDeleteAllConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-3 py-2 border border-border rounded-lg mb-3 font-mono"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteAllConfirm(false);
                  setDeleteAllConfirmText("");
                }}
                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllData}
                disabled={deleteAllConfirmText !== "DELETE" || isSubmitting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Deleting..." : "Delete All Data"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
