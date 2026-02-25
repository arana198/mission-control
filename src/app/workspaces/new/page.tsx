"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Building2 } from "lucide-react";

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

export default function NewPage() {
  const router = useRouter();
  const createWorkspace = useMutation(api.workspaces.create);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    slug: "",
    emoji: "🚀",
    color: "#6366f1",
    description: "",
    missionStatement: "",
  });
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

  const handleSubmit = async (e: React.FormEvent) => {
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

      const workspace = await createWorkspace({
        name: formData.name,
        slug: formData.slug,
        emoji: formData.emoji,
        color: formData.color,
        description: formData.description,
        missionStatement: formData.missionStatement,
      });

      // Redirect to the new workspace overview
      router.push(`/${workspace.slug}/overview`);
    } catch (err: any) {
      setError(err?.message || "Failed to create business");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <Building2 className="w-16 h-16 text-primary mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-3">Create Your First Workspace</h1>
          <p className="text-lg text-muted-foreground">
            Set up your workspace and define your mission
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 bg-card border border-border rounded-lg p-8">
          {/* Workspace Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Workspace Name *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={handleNameChange}
              placeholder="e.g., Mission Control HQ"
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Slug */}
          <div>
            <label htmlFor="slug" className="block text-sm font-medium mb-2">
              URL Slug *
            </label>
            <div className="flex items-center">
              <span className="text-muted-foreground mr-2">/</span>
              <input
                id="slug"
                type="text"
                value={formData.slug}
                onChange={handleSlugChange}
                placeholder="auto-generated from name"
                className="flex-1 px-4 py-3 border border-border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          {/* Branding */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="emoji" className="block text-sm font-medium mb-2">
                Emoji
              </label>
              <input
                id="emoji"
                type="text"
                value={formData.emoji}
                onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                maxLength={2}
                className="w-full px-4 py-3 border border-border rounded-lg text-2xl text-center focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="color" className="block text-sm font-medium mb-2">
                Color
              </label>
              <input
                id="color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full px-4 py-3 border border-border rounded-lg h-12 cursor-pointer"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Description
            </label>
            <input
              id="description"
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of your business"
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Mission Statement */}
          <div>
            <label htmlFor="mission" className="block text-sm font-medium mb-2">
              Mission Statement *
            </label>
            <textarea
              id="mission"
              value={formData.missionStatement}
              onChange={(e) => setFormData({ ...formData, missionStatement: e.target.value })}
              placeholder="What problem does your workspace solve? What's your vision?"
              rows={4}
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              required
            />
            <p className="text-xs text-muted-foreground mt-2">
              This helps define your workspace purpose and guides decision-making
            </p>
          </div>

          {/* Preview */}
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                style={{ backgroundColor: formData.color || "#6366f1" }}
              >
                {formData.emoji || "🚀"}
              </div>
              <div>
                <p className="font-semibold">{formData.name || "Workspace Name"}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {formData.slug || "auto-slug"}
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="inline-block animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                Creating...
              </>
            ) : (
              <>
                <Building2 size={18} />
                Create Workspace
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          You can create up to 5 businesses in your workspace
        </div>
      </div>
    </div>
  );
}
