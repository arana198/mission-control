"use client";

import { useEffect, useState } from "react";
import { X, Command, Search, FileText } from "lucide-react";

interface Shortcut {
  keys: string[];
  description: string;
  category: "Navigation" | "Search" | "Actions";
}

const SHORTCUTS: Shortcut[] = [
  {
    keys: ["Cmd/Ctrl", "K"],
    description: "Open command palette and search",
    category: "Search",
  },
  {
    keys: ["?"],
    description: "Show keyboard shortcuts (this menu)",
    category: "Navigation",
  },
  {
    keys: ["Esc"],
    description: "Close modals and dialogs",
    category: "Navigation",
  },
  {
    keys: ["↑", "↓"],
    description: "Navigate search results (in command palette)",
    category: "Navigation",
  },
  {
    keys: ["Enter"],
    description: "Select highlighted result",
    category: "Navigation",
  },
];

const CATEGORIES: ("Navigation" | "Search" | "Actions")[] = [
  "Navigation",
  "Search",
  "Actions",
];

/**
 * Keyboard Shortcuts Help Modal
 * Triggered by pressing '?'
 * Shows all available keyboard shortcuts
 */
export function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsOpen(!isOpen);
      }

      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-background rounded-lg shadow-xl border border-border">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <Command className="w-5 h-5 text-accent" />
              <h2 className="text-xl font-semibold">Keyboard Shortcuts</h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-muted rounded transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-96 overflow-y-auto">
            <div className="space-y-8">
              {CATEGORIES.map((category) => {
                const categoryShortcuts = SHORTCUTS.filter(
                  (s) => s.category === category
                );

                if (categoryShortcuts.length === 0) return null;

                return (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      {category}
                    </h3>
                    <div className="space-y-2">
                      {categoryShortcuts.map((shortcut, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                        >
                          <p className="text-sm">{shortcut.description}</p>
                          <div className="flex items-center gap-1">
                            {shortcut.keys.map((key, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-muted rounded border border-border">
                                  {key}
                                </kbd>
                                {i < shortcut.keys.length - 1 && (
                                  <span className="text-muted-foreground">+</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border bg-muted/30 text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono">Esc</kbd> to close
          </div>
        </div>
      </div>
    </>
  );
}
