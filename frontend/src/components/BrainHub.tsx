"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useWorkspace } from "./WorkspaceProvider";
import {
  Brain, Search, FileText, Calendar, Target, Users,
  Clock, Tag, Filter, BookOpen, Database, Zap,
  ChevronRight, ArrowUpRight, Star, TrendingUp,
  BarChart3, MessageSquare, CheckCircle2, AlertCircle,
  Lightbulb, Archive, Folder, Link, Plus, X,
  Download, Trash2, ExternalLink, RefreshCw,
  Edit3, Copy, Check, Save
} from "lucide-react";
import { KnowledgeCard } from "./KnowledgeCard";
import { KnowledgeDetailPanel } from "./KnowledgeDetailPanel";
import { StatCard } from "./StatCard";
import { exportKnowledgeAsJSON, exportKnowledgeAsMarkdown, downloadBlob } from "@/lib/knowledgeExport";

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  createdAt: number;
  assigneeIds: string[];
  epicId?: string;
}

interface Activity {
  _id: string;
  type: string;
  message: string;
  agentName?: string;
  taskTitle?: string;
  createdAt: number;
}

interface KnowledgeItem {
  id: string;
  type: "memory" | "task" | "activity" | "pattern" | "insight";
  title: string;
  content: string;
  date: Date;
  tags: string[];
  connections: string[];
  importance: number;
  entityId?: string;
  entityType?: string;
}

export function BrainHub({ tasks, activities }: { tasks: Task[]; activities: Activity[] }) {
  const { currentWorkspace } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Modal state - moved to parent to avoid conditional hook calls
  const [addModalState, setAddModalState] = useState({ title: "", content: "", tags: "", importance: 3, linkToTask: "", memoryPath: "" });
  const [archiveModalState, setArchiveModalState] = useState({ daysOld: 30, archived: 0 });

  // Fetch memory index from Convex
  const memoryLinks = useQuery(api.memoryIndex.getAll);
  const memoryPaths = useQuery(api.memoryIndex.getMemoryPaths);
  const searchResults = useQuery(api.memoryIndex.search, { query: searchQuery || "" });

  // Fetch latest strategic report - always call hook, conditionally return data
  const latestReport = useQuery(api.strategicReports.getLatest,
    currentWorkspace ? { workspaceId: currentWorkspace._id as Id<"workspaces"> } : "skip"
  );

  // Always call mutations at component level (never conditionally)
  const linkMemory = useMutation(api.memoryIndex.linkMemory);

  // Generate knowledge items from tasks, activities, and patterns
  const knowledgeItems: KnowledgeItem[] = [
    // Memory index entries (from database)
    ...(memoryLinks || []).map((link) => ({
      id: `memory-${link._id}`,
      type: "memory" as const,
      title: link.memoryPath.split('/').pop() || link.memoryPath,
      content: `Linked to ${link.entityType}: ${link.entityId}`,
      date: new Date(link.lastSynced),
      tags: link.keywords,
      connections: link.relatedMemoryPaths,
      importance: 4,
      entityId: link.entityId,
      entityType: link.entityType
    })),
    
    // Task insights
    ...tasks.slice(0, 10).map((task) => ({
      id: `task-${task._id}`,
      type: "task" as const,
      title: task.title,
      content: task.description || "No description available",
      date: new Date(task.createdAt),
      tags: [task.status, task.priority, "task"],
      connections: task.assigneeIds,
      importance: task.priority === "P0" ? 5 : task.priority === "P1" ? 4 : 3,
      entityId: task._id,
      entityType: "task"
    })),
    
    // Activity patterns
    ...activities.slice(0, 15).map((activity) => ({
      id: `activity-${activity._id}`,
      type: "activity" as const,
      title: `${activity.type.replace('_', ' ')} by ${activity.agentName}`,
      content: activity.message,
      date: new Date(activity.createdAt),
      tags: [activity.type, activity.agentName || "system", "activity"],
      connections: [],
      importance: 2
    })),

    // Strategic reports
    ...(latestReport ? [{
      id: `report-w${latestReport.week}`,
      type: "insight" as const,
      title: `Weekly Strategic Report (Week ${latestReport.week}, ${latestReport.year})`,
      content: `Latest strategic analysis from week ${latestReport.week}. Check bottleneck analysis and recommendations in report.`,
      date: new Date(latestReport.createdAt),
      tags: ["strategic", "weekly-report", "analysis"],
      connections: ["strategy", "insights", "planning"],
      importance: 5
    }] : []),

  ];

  // Filter knowledge items
  const filteredItems = knowledgeItems.filter(item => {
    const matchesSearch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = selectedFilter === "all" || item.type === selectedFilter;
    
    return matchesSearch && matchesFilter;
  }).sort((a, b) => b.importance - a.importance || b.date.getTime() - a.date.getTime());

  // Statistics
  const stats = {
    totalMemories: knowledgeItems.filter(i => i.type === "memory").length,
    totalTasks: tasks.length,
    totalActivities: activities.length,
    totalInsights: knowledgeItems.filter(i => i.type === "insight").length,
    totalPatterns: knowledgeItems.filter(i => i.type === "pattern").length,
    recentItems: knowledgeItems.filter(i => {
      const daysDiff = (Date.now() - i.date.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    }).length
  };

  // Export handlers
  const handleExportJSON = () => {
    const exportItems = knowledgeItems.map(item => ({
      type: item.type,
      title: item.title,
      content: item.content,
      importance: item.importance,
      timestamp: item.date.getTime(),
      tags: item.tags || [],
    }));
    const blob = exportKnowledgeAsJSON(exportItems);
    downloadBlob(blob, `brain-export-${new Date().toISOString().split('T')[0]}.json`);
    setShowExportModal(false);
  };

  const handleExportMarkdown = () => {
    const exportItems = knowledgeItems.map(item => ({
      type: item.type,
      title: item.title,
      content: item.content,
      importance: item.importance,
      timestamp: item.date.getTime(),
      tags: item.tags || [],
    }));
    const blob = exportKnowledgeAsMarkdown(exportItems);
    downloadBlob(blob, `brain-export-${new Date().toISOString().split('T')[0]}.md`);
    setShowExportModal(false);
  };

  const handleCopyToClipboard = () => {
    const data = JSON.stringify(knowledgeItems, null, 2);
    navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddMemory = async () => {
    if (!addModalState.title || !addModalState.content) return;

    const keywords = addModalState.tags.split(',').map(t => t.trim()).filter(Boolean);

    if (addModalState.linkToTask && addModalState.memoryPath) {
      await linkMemory({
        entityType: "task",
        entityId: addModalState.linkToTask,
        memoryPath: addModalState.memoryPath,
        keywords: [...keywords, addModalState.title.toLowerCase()],
      });
    }

    // Reset modal state
    setAddModalState({ title: "", content: "", tags: "", importance: 3, linkToTask: "", memoryPath: "" });
    setShowAddModal(false);
  };

  const handleArchive = () => {
    const allGoals = Object.values(knowledgeItems).flat() as any[];
    const oldItems = knowledgeItems.filter(item => {
      const daysDiff = (Date.now() - item.date.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff > archiveModalState.daysOld;
    });
    setArchiveModalState(prev => ({ ...prev, archived: oldItems.length }));
  };

  return (
    <div className="max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold mb-1 flex items-center gap-3">
            <Brain className="w-7 h-7 text-purple-600" />
            Second Brain
          </h2>
          <p className="text-muted-foreground">
            Your knowledge repository of memories, insights, tasks, and patterns
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary" onClick={() => setShowExportModal(true)}>
            <Download className="w-4 h-4 mr-2" />
            Export Knowledge
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Memory
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-6 gap-4">
        <StatCard
          label="Memories"
          value={stats.totalMemories}
          icon={BookOpen}
          color="text-primary"
        />
        <StatCard
          label="Tasks"
          value={stats.totalTasks}
          icon={Target}
          color="text-success"
        />
        <StatCard
          label="Activities"
          value={stats.totalActivities}
          icon={BarChart3}
          color="text-warning"
        />
        <StatCard
          label="Insights"
          value={stats.totalInsights}
          icon={Lightbulb}
          color="text-purple-500"
        />
        <StatCard
          label="Patterns"
          value={stats.totalPatterns}
          icon={TrendingUp}
          color="text-pink-500"
        />
        <StatCard
          label="This Week"
          value={stats.recentItems}
          icon={RefreshCw}
          color="text-cyan-500"
        />
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Knowledge Items List */}
        <div className="col-span-3 space-y-4">
          {/* Search and Filters */}
          <div className="card p-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search memories, tasks, insights..."
                  className="input pl-10"
                  aria-label="Search memories, tasks, and insights"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  className="input w-40"
                  aria-label="Filter knowledge items by type"
                >
                  <option value="all">All Items</option>
                  <option value="memory">Memories</option>
                  <option value="task">Tasks</option>
                  <option value="activity">Activities</option>
                  <option value="pattern">Patterns</option>
                  <option value="insight">Insights</option>
                </select>
              </div>
            </div>
          </div>

          {/* Knowledge Items */}
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <KnowledgeCard 
                key={item.id} 
                item={item} 
                onClick={() => setSelectedItem(item)}
              />
            ))}
            {filteredItems.length === 0 && (
              <div className="card p-8 text-center">
                <Database className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {knowledgeItems.length === 0
                    ? "No knowledge entries yet. Patterns will emerge as agents complete tasks and activities accumulate."
                    : "No knowledge items found matching your criteria"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {selectedItem ? (
            <KnowledgeDetailPanel 
              item={selectedItem} 
              onClose={() => setSelectedItem(null)}
              memoryPaths={memoryPaths || []}
            />
          ) : (
            <div className="card p-4">
              <div className="text-center">
                <Brain className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-semibold mb-2">Knowledge Explorer</h3>
                <p className="text-sm text-muted-foreground">
                  Select an item to explore connections and details
                </p>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button 
                className="w-full btn btn-secondary text-sm justify-start"
                onClick={() => setShowExportModal(true)}
              >
                <FileText className="w-4 h-4 mr-2" />
                Export Summary
              </button>
              <button 
                className="w-full btn btn-secondary text-sm justify-start"
                onClick={() => {
                  if (selectedItem) {
                    // Find related by searching for tags
                    const tags = selectedItem.tags.join(' ');
                    setSearchQuery(tags);
                  } else {
                    setSearchQuery("");
                  }
                }}
              >
                <Link className="w-4 h-4 mr-2" />
                Find Connections
              </button>
              <button 
                className="w-full btn btn-secondary text-sm justify-start"
                onClick={() => setShowArchiveModal(true)}
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive Old
              </button>
            </div>
          </div>

          {/* Memory Paths */}
          {memoryPaths && memoryPaths.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Folder className="w-4 h-4" />
                Memory Files
              </h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {memoryPaths.slice(0, 10).map((path) => (
                  <div key={path} className="text-xs p-1.5 bg-muted/50 rounded truncate">
                    {path}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Add Memory Modal */}
      {showAddModal && (
        <AddMemoryModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddMemory}
          tasks={tasks}
          memoryPaths={memoryPaths || []}
          state={addModalState}
          setState={setAddModalState}
        />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal 
          onClose={() => setShowExportModal(false)}
          onExportJSON={handleExportJSON}
          onExportMarkdown={handleExportMarkdown}
          onCopy={handleCopyToClipboard}
          copied={copied}
        />
      )}

      {/* Archive Modal */}
      {showArchiveModal && (
        <ArchiveModal
          onClose={() => setShowArchiveModal(false)}
          knowledgeItems={knowledgeItems}
          state={archiveModalState}
          setState={setArchiveModalState}
          onArchive={handleArchive}
        />
      )}
    </div>
  );
}

// Add Memory Modal Component
function AddMemoryModal({
  onClose,
  onSubmit,
  tasks,
  memoryPaths,
  state,
  setState,
}: {
  onClose: () => void;
  onSubmit: () => Promise<void>;
  tasks: Task[];
  memoryPaths: string[];
  state: { title: string; content: string; tags: string; importance: number; linkToTask: string; memoryPath: string };
  setState: (state: any) => void;
}) {
  const handleSubmit = async () => {
    await onSubmit();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 cursor-pointer" onClick={onClose}>
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Memory
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
            aria-label="Close add memory modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="memory-title" className="text-sm font-medium mb-1 block">Title</label>
            <input
              id="memory-title"
              type="text"
              value={state.title}
              onChange={(e) => setState({ ...state, title: e.target.value })}
              placeholder="Memory title..."
              className="input w-full"
            />
          </div>

          <div>
            <label htmlFor="memory-content" className="text-sm font-medium mb-1 block">Content</label>
            <textarea
              id="memory-content"
              value={state.content}
              onChange={(e) => setState({ ...state, content: e.target.value })}
              placeholder="Describe this memory..."
              className="input w-full h-24"
            />
          </div>

          <div>
            <label htmlFor="memory-tags" className="text-sm font-medium mb-1 block">Tags (comma-separated)</label>
            <input
              id="memory-tags"
              type="text"
              value={state.tags}
              onChange={(e) => setState({ ...state, tags: e.target.value })}
              placeholder="architecture, decisions, ui..."
              className="input w-full"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Importance</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  onClick={() => setState({ ...state, importance: i })}
                  className={`p-1 ${i <= state.importance ? "text-warning" : "text-muted-foreground"}`}
                >
                  <Star className={`w-5 h-5 ${i <= state.importance ? "fill-amber-500" : ""}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <label htmlFor="link-task" className="font-medium mb-2 block">Link to Task (optional)</label>
            <select
              id="link-task"
              value={state.linkToTask}
              onChange={(e) => setState({ ...state, linkToTask: e.target.value })}
              className="input w-full mb-2"
              aria-label="Select a task to link to this memory"
            >
              <option value="">Select a task...</option>
              {tasks.map((task) => (
                <option key={task._id} value={task._id}>
                  {task.title}
                </option>
              ))}
            </select>

            {state.linkToTask && (
              <>
                <label htmlFor="memory-file" className="font-medium mb-2 block text-sm">Memory File</label>
                <select
                  id="memory-file"
                  value={state.memoryPath}
                  onChange={(e) => setState({ ...state, memoryPath: e.target.value })}
                  className="input w-full"
                  aria-label="Select memory file to link"
                >
                  <option value="">Select memory file...</option>
                  {memoryPaths.map((path) => (
                    <option key={path} value={path}>
                      {path}
                    </option>
                  ))}
                  <option value="MEMORY.md">MEMORY.md</option>
                </select>
              </>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!state.title || !state.content}
            className="btn btn-primary flex-1"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Memory
          </button>
        </div>
      </div>
    </div>
  );
}

// Export Modal Component
function ExportModal({ 
  onClose, 
  onExportJSON, 
  onExportMarkdown,
  onCopy,
  copied 
}: { 
  onClose: () => void;
  onExportJSON: () => void;
  onExportMarkdown: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 cursor-pointer" onClick={onClose}>
      <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Knowledge
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
            aria-label="Close export knowledge modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-3">
          <button 
            onClick={onExportJSON}
            className="w-full btn btn-secondary justify-start p-4 h-auto"
          >
            <div className="text-left">
              <p className="font-medium">Export as JSON</p>
              <p className="text-xs text-muted-foreground">Full data for backup or import</p>
            </div>
          </button>
          
          <button 
            onClick={onExportMarkdown}
            className="w-full btn btn-secondary justify-start p-4 h-auto"
          >
            <div className="text-left">
              <p className="font-medium">Export as Markdown</p>
              <p className="text-xs text-muted-foreground">Human-readable format</p>
            </div>
          </button>
          
          <button 
            onClick={onCopy}
            className="w-full btn btn-secondary justify-start p-4 h-auto"
          >
            <div className="text-left flex items-center gap-2">
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-success" />
                  <div>
                    <p className="font-medium">Copied to Clipboard!</p>
                  </div>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <div>
                    <p className="font-medium">Copy to Clipboard</p>
                    <p className="text-xs text-muted-foreground">Paste anywhere</p>
                  </div>
                </>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// Archive Modal Component
function ArchiveModal({
  onClose,
  knowledgeItems,
  state,
  setState,
  onArchive,
}: {
  onClose: () => void;
  knowledgeItems: KnowledgeItem[];
  state: { daysOld: number; archived: number };
  setState: (state: any) => void;
  onArchive: () => void;
}) {
  const oldItems = knowledgeItems.filter(item => {
    const daysDiff = (Date.now() - item.date.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff > state.daysOld;
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 cursor-pointer" onClick={onClose}>
      <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Archive Old Items
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
            aria-label="Close archive modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {state.archived > 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-success" />
            <p className="font-semibold text-lg">Archived {state.archived} items</p>
            <p className="text-sm text-muted-foreground mt-2">
              Items older than {state.daysOld} days have been archived
            </p>
            <button onClick={onClose} className="btn btn-primary mt-4">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <label htmlFor="archive-days-range" className="text-sm font-medium mb-2 block">
                  Archive items older than {state.daysOld} days
                </label>
                <input
                  id="archive-days-range"
                  type="range"
                  min="7"
                  max="90"
                  value={state.daysOld}
                  onChange={(e) => setState({ ...state, daysOld: Number(e.target.value) })}
                  className="w-full"
                  aria-label={`Archive items older than ${state.daysOld} days`}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>7 days</span>
                  <span>90 days</span>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm">
                  This will archive <span className="font-semibold">{oldItems.length}</span> items
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Archived items can be recovered from backup
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={onClose} className="btn btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={onArchive}
                disabled={oldItems.length === 0}
                className="btn btn-primary flex-1"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive {oldItems.length} Items
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
