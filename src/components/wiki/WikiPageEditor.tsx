"use client";

import { useState } from "react";
import { WikiEditor } from "./WikiEditor";
import { Check, AlertCircle } from "lucide-react";
import type { WikiPage } from "@/convex/wiki";
import { useNotification } from "@/hooks/useNotification";

interface WikiPageEditorProps {
  page: WikiPage;
  onSave: (data: {
    title: string;
    content: string;
  }) => Promise<void>;
  onCancel: () => void;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * WikiPageEditor - Simple edit mode for a wiki page
 * Just title and markdown content
 */
export function WikiPageEditor({ page, onSave, onCancel }: WikiPageEditorProps) {
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const notif = useNotification();

  const hasChanges = title !== page.title || content !== page.content;

  const handleSave = async () => {
    try {
      setSaveState("saving");
      await onSave({
        title,
        content,
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (error: any) {
      setSaveState("error");
      notif.error(error?.message || "Failed to save page");
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Sticky header with save status and buttons */}
      <div className="border-b sticky top-0 z-10 bg-background">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-xs font-medium">
            {saveState === "saving" && (
              <span className="text-yellow-600 flex items-center gap-1">
                <div className="w-3 h-3 rounded-full border-2 border-yellow-600 border-t-transparent animate-spin" />
                Saving...
              </span>
            )}
            {saveState === "saved" && (
              <span className="text-green-600 flex items-center gap-1">
                <Check className="w-4 h-4" />
                Saved
              </span>
            )}
            {saveState === "error" && (
              <span className="text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Error saving
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saveState === "saving"}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              Save
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-2 rounded-lg border border-input hover:bg-muted transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          {/* Title input */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-4xl font-bold bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 mb-8"
            placeholder="Page title"
          />

          {/* Markdown editor */}
          <WikiEditor
            content={content}
            editable={true}
            onChange={setContent}
            placeholder="Write markdown here..."
          />
        </div>
      </div>
    </div>
  );
}
