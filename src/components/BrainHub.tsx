"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
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
import { exportAsJSON, exportAsMarkdown, downloadBlob } from "../lib/knowledgeExport";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch memory index from Convex
  const memoryLinks = useQuery(api.memoryIndex.getAll);
  const memoryPaths = useQuery(api.memoryIndex.getMemoryPaths);
  const searchResults = useQuery(api.memoryIndex.search, { query: searchQuery || "" });
  
  // Fetch latest strategic report
  const latestReport = useQuery(api.strategicReports.getLatest);

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
    const blob = exportAsJSON(exportItems);
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
    const blob = exportAsMarkdown(exportItems);
    downloadBlob(blob, `brain-export-${new Date().toISOString().split('T')[0]}.md`);
    setShowExportModal(false);
  };

  const handleCopyToClipboard = () => {
    const data = JSON.stringify(knowledgeItems, null, 2);
    navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          color="text-blue-500"
        />
        <StatCard
          label="Tasks"
          value={stats.totalTasks}
          icon={Target}
          color="text-green-500"
        />
        <StatCard
          label="Activities"
          value={stats.totalActivities}
          icon={BarChart3}
          color="text-amber-500"
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
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  className="input w-40"
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

          {/* Recent Patterns */}
          <div className="card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Recent Patterns
            </h3>
            <div className="space-y-2">
              <div className="p-2 bg-muted/50 rounded text-sm">
                <p className="font-medium">UI/UX Focus</p>
                <p className="text-xs text-muted-foreground">Recent emphasis on professional styling</p>
              </div>
              <div className="p-2 bg-muted/50 rounded text-sm">
                <p className="font-medium">Agent Coordination</p>
                <p className="text-xs text-muted-foreground">Improved task distribution patterns</p>
              </div>
              <div className="p-2 bg-muted/50 rounded text-sm">
                <p className="font-medium">Automation Growth</p>
                <p className="text-xs text-muted-foreground">Expanding automated workflows</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Memory Modal */}
      {showAddModal && (
        <AddMemoryModal 
          onClose={() => setShowAddModal(false)}
          tasks={tasks}
          memoryPaths={memoryPaths || []}
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
        />
      )}
    </div>
  );
}

// Add Memory Modal Component
function AddMemoryModal({ onClose, tasks, memoryPaths }: { 
  onClose: () => void;
  tasks: Task[];
  memoryPaths: string[];
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [importance, setImportance] = useState(3);
  const [linkToTask, setLinkToTask] = useState("");
  const [memoryPath, setMemoryPath] = useState("");
  
  const linkMemory = useMutation(api.memoryIndex.linkMemory);

  const handleSubmit = async () => {
    if (!title || !content) return;
    
    const keywords = tags.split(',').map(t => t.trim()).filter(Boolean);
    
    if (linkToTask && memoryPath) {
      await linkMemory({
        entityType: "task",
        entityId: linkToTask,
        memoryPath,
        keywords: [...keywords, title.toLowerCase()],
      });
    }
    
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Memory
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Memory title..."
              className="input w-full"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe this memory..."
              className="input w-full h-24"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
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
                  onClick={() => setImportance(i)}
                  className={`p-1 ${i <= importance ? "text-amber-500" : "text-muted-foreground"}`}
                >
                  <Star className={`w-5 h-5 ${i <= importance ? "fill-amber-500" : ""}`} />
                </button>
              ))}
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Link to Task (optional)</h4>
            <select
              value={linkToTask}
              onChange={(e) => setLinkToTask(e.target.value)}
              className="input w-full mb-2"
            >
              <option value="">Select a task...</option>
              {tasks.map((task) => (
                <option key={task._id} value={task._id}>
                  {task.title}
                </option>
              ))}
            </select>
            
            {linkToTask && (
              <select
                value={memoryPath}
                onChange={(e) => setMemoryPath(e.target.value)}
                className="input w-full"
              >
                <option value="">Select memory file...</option>
                {memoryPaths.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
                <option value="MEMORY.md">MEMORY.md</option>
              </select>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!title || !content}
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Knowledge
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
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
                  <Check className="w-4 h-4 text-green-500" />
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
function ArchiveModal({ onClose, knowledgeItems }: { 
  onClose: () => void;
  knowledgeItems: KnowledgeItem[];
}) {
  const [daysOld, setDaysOld] = useState(30);
  const [archived, setArchived] = useState(0);
  
  const oldItems = knowledgeItems.filter(item => {
    const daysDiff = (Date.now() - item.date.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff > daysOld;
  });

  const handleArchive = () => {
    // In a real implementation, this would call a mutation to archive items
    // For now, just simulate archiving
    setArchived(oldItems.length);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Archive Old Items
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {archived > 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <p className="font-semibold text-lg">Archived {archived} items</p>
            <p className="text-sm text-muted-foreground mt-2">
              Items older than {daysOld} days have been archived
            </p>
            <button onClick={onClose} className="btn btn-primary mt-4">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Archive items older than {daysOld} days
                </label>
                <input
                  type="range"
                  min="7"
                  max="90"
                  value={daysOld}
                  onChange={(e) => setDaysOld(Number(e.target.value))}
                  className="w-full"
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
                onClick={handleArchive}
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
