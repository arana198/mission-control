"use client";

import { useState, useRef, useEffect } from "react";
import { WikiEditor } from "./WikiEditor";
import { ChevronLeft, Check, AlertCircle } from "lucide-react";
import type { WikiPage } from "@/convex/wiki";

interface WikiPageEditorProps {
  page: WikiPage;
  onSave: (data: {
    title: string;
    content: string;
    contentText: string;
    emoji?: string;
    status?: string;
    tags?: string[];
  }, isAutoSave?: boolean) => Promise<void>;
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
  const [status, setStatus] = useState<"draft" | "published" | "archived">(page.status || "draft");
  const [tags, setTags] = useState<string[]>(page.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const hasChanges =
    title !== page.title ||
    emoji !== (page.emoji || "") ||
    content !== page.content ||
    status !== (page.status || "draft") ||
    JSON.stringify(tags) !== JSON.stringify(page.tags || []);

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
      handleSave(true); // Pass true to indicate auto-save
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [title, emoji, content, status, tags]);

  const handleSave = async (isAutoSave = false) => {
    try {
      if (!isAutoSave) {
        setSaveState("saving");
      }
      await onSave({
        title: title || page.title,
        content,
        contentText,
        emoji: emoji || undefined,
        status,
        tags: tags.length > 0 ? tags : undefined,
      }, isAutoSave);
      if (!isAutoSave) {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      }
    } catch (error) {
      setSaveState("error");
      console.error("Failed to save page:", error);
    }
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 10) {
      setTags([...tags, trimmedTag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleEditorChange = (json: string, text: string) => {
    setContent(json);
    setContentText(text);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b sticky top-0 z-10 bg-background">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-3 md:px-4 py-3 gap-3">
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 w-full">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 md:gap-2 w-full">
                <input
                  type="text"
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value.substring(0, 2))}
                  placeholder="🎯"
                  maxLength={2}
                  className="w-10 md:w-12 text-xl md:text-2xl text-center bg-transparent border-0 focus:outline-none flex-shrink-0"
                />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 text-lg md:text-2xl font-bold bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-primary rounded px-2"
                  placeholder="Page title"
                />
              </div>
            </div>
          </div>

          {/* Save status and action buttons */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 w-full md:w-auto">
            <div className="text-xs font-medium flex-1 md:flex-none">
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
              onClick={() => handleSave(false)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Update
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
        <div className="max-w-3xl mx-auto p-3 md:p-6">
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
              {/* Status toggle */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-2">Status</label>
                <div className="flex gap-2">
                  {(["draft", "published", "archived"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        status === s
                          ? "bg-primary text-primary-foreground"
                          : "border border-input hover:bg-muted"
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags input */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-2">
                  Tags ({tags.length}/10)
                </label>
                <div className="space-y-2">
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-muted rounded-full"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Remove tag"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {tags.length < 10 && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        placeholder="Add tag..."
                        className="text-xs px-2 py-1 border border-input rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary flex-1"
                      />
                      <button
                        onClick={handleAddTag}
                        disabled={!tagInput.trim()}
                        className="px-2 py-1 text-xs font-medium border border-input rounded hover:bg-muted disabled:opacity-50 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </div>

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
