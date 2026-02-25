"use client";

import { X, BookOpen, Target, BarChart3, TrendingUp, Lightbulb, FileText, Star } from "lucide-react";

interface KnowledgeDetailPanelProps {
  item: {
    id?: string;
    type: string;
    title: string;
    content: string;
    importance: number;
    timestamp?: number;
    tags?: string[];
    metadata?: Record<string, any>;
    date?: Date;
  };
  onClose: () => void;
  memoryPaths?: string[];
}

export function KnowledgeDetailPanel({
  item,
  onClose,
  memoryPaths = [],
}: KnowledgeDetailPanelProps) {
  const typeIcons: Record<string, any> = {
    memory: BookOpen,
    task: Target,
    activity: BarChart3,
    pattern: TrendingUp,
    insight: Lightbulb,
  };

  const Icon = typeIcons[item.type] || FileText;

  return (
    <div className="w-80 border-l bg-muted/30 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Details</h3>
        <button onClick={onClose} className="btn btn-ghost p-2">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-primary/10 rounded-lg">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Type</p>
          <p className="font-medium capitalize">{item.type}</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-1">Title</p>
        <h4 className="font-medium">{item.title}</h4>
      </div>

      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-1">Content</p>
        <p className="text-sm whitespace-pre-wrap">{item.content}</p>
      </div>

      {item.importance && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-1">Importance</p>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${
                  i < item.importance
                    ? "fill-warning text-warning"
                    : "text-muted-foreground"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {item.tags && item.tags.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Tags</p>
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-1 bg-primary/10 text-primary rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-1">Created</p>
        <p className="text-sm">
          {(item.date instanceof Date
            ? item.date
            : item.timestamp
            ? new Date(item.timestamp)
            : new Date()
          ).toLocaleString()}
        </p>
      </div>

      {memoryPaths.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Memory Paths</p>
          <div className="space-y-1">
            {memoryPaths.map((path, i) => (
              <div key={i} className="text-xs font-mono bg-muted p-2 rounded">
                {path}
              </div>
            ))}
          </div>
        </div>
      )}

      {item.metadata && Object.keys(item.metadata).length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Metadata</p>
          <div className="space-y-2">
            {Object.entries(item.metadata).map(([key, value]) => (
              <div key={key} className="text-xs">
                <span className="text-muted-foreground">{key}:</span>{" "}
                <span className="font-mono">{JSON.stringify(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
