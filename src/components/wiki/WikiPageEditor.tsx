"use client";

import { useState, useRef, useEffect } from "react";
import { WikiEditor } from "./WikiEditor";
import { ChevronLeft, Check, AlertCircle } from "lucide-react";
import type { WikiPage } from "@/convex/wiki";

interface WikiPageEditorProps {
  page: WikiPage;
  onSave: (data: { title: string; content: string; contentText: string; emoji?: string }) => Promise<void>;
  onCancel: () => void;
  onBack?: () => void;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * WikiPageEditor - Edit mode for a wiki page
 * Features: Auto-save (2s debounce), title/emoji editing, task/epic linking
 */
export function WikiPageEditor({ page, onSave, onCancel, onBack }: WikiPageEditorProps) {
  const [title, setTitle] = useState(page.title);
  const [emoji, setEmoji] = useState(page.emoji || "");
  const [content, setContent] = useState(page.content);
  const [contentText, setContentText] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const hasChanges = title !== page.title || emoji !== (page.emoji || "") || content !== page.content;

  // Auto-save on content changes (2s debounce)
  useEffect(() => {
    if (!hasChanges) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout
    setSaveState("idle");
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [title, emoji, content]);

  const handleSave = async () => {
    try {
      setSaveState("saving");
      await onSave({
        title: title || page.title,
        content,
        contentText,
        emoji: emoji || undefined,
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (error) {
      setSaveState("error");
      console.error("Failed to save page:", error);
    }
  };

  const handleEditorChange = (json: string, text: string) => {
    setContent(json);
    setContentText(text);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b sticky top-0 z-10 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value.substring(0, 2))}
                  placeholder="🎯"
                  maxLength={2}
                  className="w-12 text-2xl text-center bg-transparent border-0 focus:outline-none"
                />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 text-2xl font-bold bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-primary rounded px-2"
                  placeholder="Page title"
                />
              </div>
            </div>
          </div>

          {/* Save status */}
          <div className="flex items-center gap-3 ml-4 flex-shrink-0">
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

            <button
              onClick={onCancel}
              className="px-3 py-2 rounded-lg border border-input hover:bg-muted transition-colors text-sm font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6">
          <WikiEditor
            content={content}
            editable={true}
            onChange={handleEditorChange}
            placeholder="Start typing your page content..."
          />

          {/* Metadata section */}
          <div className="mt-6 p-4 rounded-lg bg-muted/30 border">
            <h3 className="text-sm font-semibold mb-4">Page Properties</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-2">
                  Version: {page.version}
                </label>
              </div>
              {page.taskIds && page.taskIds.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-2">
                    Linked Tasks: {page.taskIds.length}
                  </label>
                </div>
              )}
              {page.epicId && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-2">
                    Linked Epic: {page.epicId}
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
