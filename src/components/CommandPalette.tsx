"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useWorkspace } from "./WorkspaceProvider";
import { Goal } from "@/types/goal";
import { Task } from "@/types/task";
import { Agent } from "@/types/agent";
import { getMemoryService } from "@/lib/services/memoryService";
import { CreateGoalModal } from "@/components/CreateGoalModal";
import {
  Search,
  FileText,
  Target,
  CheckCircle,
  Zap,
  Clock,
  AlertCircle,
  ChevronRight,
  X,
  Loader2,
  BookOpen,
  Layers,
} from "lucide-react";
import clsx from "clsx";

interface SearchResult {
  id: string;
  type: "goal" | "task" | "memory" | "agent" | "document" | "epic" | "wiki";
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  action?: () => void;
}

interface CommandPaletteProps {
  onCreateTask?: () => void;
  onNavigate?: (tab: string) => void;
}

export function CommandPalette({ onCreateTask, onNavigate }: CommandPaletteProps = {}) {
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showCreateGoalModal, setShowCreateGoalModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const memoryService = getMemoryService();
  // Always call hooks - don't conditionally call them (Rules of Hooks)
  const goals = useQuery(api.goals.getActiveGoals, currentWorkspace ? { workspaceId: currentWorkspace._id } as any : "skip");
  const tasks = useQuery(api.tasks.getAllTasks, currentWorkspace ? { workspaceId: currentWorkspace._id } as any : "skip");
  const agents = useQuery(api.agents.getAllAgents);
  const epics = useQuery(api.epics.getAllEpics, currentWorkspace ? { workspaceId: currentWorkspace._id } as any : "skip");
  const wikiTree = useQuery(api.wiki.getTree, currentWorkspace ? { workspaceId: currentWorkspace._id } as any : "skip");

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setSelected(0);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
      if (e.key === "ArrowDown" && open) {
        e.preventDefault();
        setSelected((prev) => (prev + 1) % results.length);
      }
      if (e.key === "ArrowUp" && open) {
        e.preventDefault();
        setSelected((prev) => (prev - 1 + results.length) % results.length);
      }
      if (e.key === "Enter" && open && results[selected]) {
        e.preventDefault();
        results[selected].action?.();
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selected]);

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Flatten nested wiki page tree into a flat array for search
  const flattenWikiPages = (pages: any[]): any[] => {
    return pages.flatMap((p) => [p, ...flattenWikiPages(p.children || [])]);
  };

  // Search logic
  useEffect(() => {
    const search = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      const results: SearchResult[] = [];
      const q = query.toLowerCase();

      // Search goals
      if (goals) {
        const allGoals = (goals as Goal[]) ?? [];
        const matchedGoals = allGoals
          .filter(
            (g) =>
              g.title.toLowerCase().includes(q) ||
              g.description?.toLowerCase().includes(q)
          )
          .slice(0, 3)
          .map((g) => ({
            id: g._id,
            type: "goal" as const,
            title: g.title,
            description: g.description,
            metadata: {
              status: g.status,
              progress: g.progress || 0,
            },
            action: () => {
              router.push(`/${currentWorkspace?.slug}/overview`);
            },
          }));
        results.push(...matchedGoals);
      }

      // Search tasks
      if (tasks) {
        const matchedTasks = (tasks as Task[])
          .filter(
            (t) =>
              t.title.toLowerCase().includes(q) ||
              t.description?.toLowerCase().includes(q)
          )
          .slice(0, 3)
          .map((t) => ({
            id: t._id,
            type: "task" as const,
            title: t.title,
            description: t.description,
            metadata: {
              status: t.status,
              priority: t.priority,
            },
            action: () => {
              router.push(`/${currentWorkspace?.slug}/board?task=${t.ticketNumber || t._id}`);
            },
          }));
        results.push(...matchedTasks);
      }

      // Search memory
      try {
        const memoryResults = await memoryService.searchMemory(q, 3);
        const memoryFormatted = memoryResults.map((m) => ({
          id: m.path,
          type: "memory" as const,
          title: m.path.split("/").pop() || m.path,
          description: m.snippet.slice(0, 80) + "...",
          metadata: {
            relevance: `${(m.relevance * 100).toFixed(0)}%`,
          },
          action: () => {
            router.push(`/global/brain`);
          },
        }));
        results.push(...memoryFormatted);
      } catch (e) {
        // Memory search failed silently
      }

      // Search agents
      if (agents) {
        const matchedAgents = (agents as Agent[])
          .filter((a) => a.name.toLowerCase().includes(q))
          .slice(0, 2)
          .map((a) => ({
            id: a._id,
            type: "agent" as const,
            title: a.name,
            description: a.role,
            metadata: {
              status: a.status,
            },
            action: () => {
              router.push(`/global/agents?agent=${a._id}`);
            },
          }));
        results.push(...matchedAgents);
      }

      // Search epics
      if (epics) {
        const matchedEpics = (epics as any[])
          .filter((e) =>
            e.title.toLowerCase().includes(q) ||
            e.description?.toLowerCase().includes(q)
          )
          .slice(0, 3)
          .map((e) => ({
            id: e._id,
            type: "epic" as const,
            title: e.title,
            description: e.description,
            metadata: { status: e.status },
            action: () => {
              router.push(`/${currentWorkspace?.slug}/epics`);
            },
          }));
        results.push(...matchedEpics);
      }

      // Search wiki pages
      if (wikiTree) {
        const allPages = flattenWikiPages(wikiTree as any[]);
        const matchedPages = allPages
          .filter((p: any) =>
            p.title?.toLowerCase().includes(q)
          )
          .slice(0, 3)
          .map((p: any) => ({
            id: p._id,
            type: "wiki" as const,
            title: p.title,
            description: p.emoji ? `${p.emoji} Wiki page` : "Wiki page",
            metadata: { status: p.status },
            action: () => {
              router.push(`/${currentWorkspace?.slug}/wiki?pageId=${p._id}`);
            },
          }));
        results.push(...matchedPages);
      }

      // Quick actions
      if ("new task".includes(q)) {
        results.push({
          id: "action:new-task",
          type: "task",
          title: "Create new task",
          description: "Add a new task to the backlog",
          action: onCreateTask,
        });
      }

      if ("new goal".includes(q)) {
        results.push({
          id: "action:new-goal",
          type: "goal",
          title: "Create new goal",
          description: "Add a new strategic goal",
          action: () => {
            setShowCreateGoalModal(true);
            setOpen(false);
          },
        });
      }

      setResults(results);
      setSelected(0);
      setLoading(false);
    };

    const timer = setTimeout(search, 300); // Debounce
    return () => clearTimeout(timer);
  }, [query, goals, tasks, agents, epics, wikiTree, memoryService, currentWorkspace, router, onCreateTask]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 px-4 py-2 rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground text-sm flex items-center gap-2 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span>Cmd+K</span>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div
        ref={containerRef}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] pointer-events-none"
      >
        <div className="w-full max-w-2xl pointer-events-auto">
          {/* Search Box */}
          <div className="bg-background border border-border rounded-lg shadow-lg overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-5 h-5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search tasks, epics, agents, goals, wiki... (ESC to close)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="command-results"
                aria-expanded={results.length > 0}
                aria-label="Search palette"
                aria-haspopup="listbox"
              />
              {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-secondary rounded"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto" id="command-results">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground" role="status" aria-live="polite">
                  Searching...
                </div>
              ) : results.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground" role="status" aria-live="polite">
                  {query ? "No results found" : "Start typing to search"}
                </div>
              ) : (
                <div className="divide-y divide-border" role="listbox" aria-label="Search results">
                  {results.map((result, index) => (
                    <button
                      key={result.id}
                      onClick={() => {
                        result.action?.();
                        setOpen(false);
                      }}
                      onMouseMove={() => setSelected(index)}
                      className={clsx(
                        "w-full px-4 py-3 flex items-start gap-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500",
                        index === selected
                          ? "bg-secondary text-foreground"
                          : "hover:bg-secondary/50 text-foreground"
                      )}
                      role="option"
                      aria-selected={index === selected}
                    >
                      {/* Icon */}
                      <div className="pt-0.5">
                        {result.type === "goal" && (
                          <Target className="w-4 h-4 text-primary" />
                        )}
                        {result.type === "task" && (
                          <CheckCircle className="w-4 h-4 text-success" />
                        )}
                        {result.type === "memory" && (
                          <FileText className="w-4 h-4 text-warning" />
                        )}
                        {result.type === "agent" && (
                          <Zap className="w-4 h-4 text-purple-500" />
                        )}
                        {result.type === "epic" && (
                          <Layers className="w-4 h-4 text-indigo-500" />
                        )}
                        {result.type === "wiki" && (
                          <BookOpen className="w-4 h-4 text-teal-500" />
                        )}
                        {result.type === "document" && (
                          <FileText className="w-4 h-4 text-slate-500" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {result.title}
                        </div>
                        {result.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {result.description}
                          </div>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-2 ml-auto pl-2 flex-shrink-0">
                        {result.metadata?.progress !== undefined && (
                          <span className="text-xs bg-secondary px-2 py-1 rounded">
                            {result.metadata.progress}%
                          </span>
                        )}
                        {result.metadata?.status && (
                          <span
                            className={clsx(
                              "text-xs px-2 py-1 rounded",
                              result.metadata.status === "done"
                                ? "bg-success/20 text-success"
                                : result.metadata.status === "blocked"
                                  ? "bg-destructive/20 text-destructive"
                                  : "bg-primary/20 text-primary"
                            )}
                          >
                            {result.metadata.status}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-secondary/30 border-t border-border text-xs text-muted-foreground flex justify-between">
              <div>
                Use <kbd className="px-1.5 py-0.5 bg-background rounded">↑↓</kbd>{" "}
                to navigate,{" "}
                <kbd className="px-1.5 py-0.5 bg-background rounded">Enter</kbd> to
                select
              </div>
              <div>
                <kbd className="px-1.5 py-0.5 bg-background rounded">ESC</kbd> to
                close
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Goal Modal */}
      {showCreateGoalModal && (
        <CreateGoalModal
          tasks={tasks || []}
          onClose={() => setShowCreateGoalModal(false)}
          onSuccess={() => setShowCreateGoalModal(false)}
        />
      )}
    </>
  );
}
