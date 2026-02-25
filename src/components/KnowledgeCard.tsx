"use client";

import { memo } from "react";
import {
  BookOpen,
  Target,
  BarChart3,
  TrendingUp,
  Lightbulb,
  FileText,
  Star,
  ChevronRight,
} from "lucide-react";

interface KnowledgeCardProps {
  item: {
    id?: string;
    type: string;
    title: string;
    content: string;
    importance: number;
    timestamp?: number;
    tags?: string[];
    date?: Date;
  };
  onClick: () => void;
}

function KnowledgeCardComponent({ item, onClick }: KnowledgeCardProps) {
  const typeIcons: Record<string, any> = {
    memory: BookOpen,
    task: Target,
    activity: BarChart3,
    pattern: TrendingUp,
    insight: Lightbulb,
  };

  const typeColors: Record<string, string> = {
    memory: "text-primary bg-primary/10",
    task: "text-success bg-success/10",
    activity: "text-warning bg-warning/10",
    pattern: "text-accent bg-accent/10",
    insight: "text-destructive bg-destructive/10",
  };

  const Icon = typeIcons[item.type] || FileText;

  const displayDate = item.date
    ? (item.date instanceof Date ? item.date : new Date(item.date))
    : (item.timestamp ? new Date(item.timestamp) : new Date());

  return (
    <div
      onClick={onClick}
      className="card p-4 cursor-pointer hover:border-primary/30 transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeColors[item.type] || typeColors.insight}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
              {item.title}
            </h3>
            <div className="flex items-center gap-1 ml-2">
              {Array.from({ length: item.importance }).map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-warning text-warning" />
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {item.content}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex flex-wrap gap-1">
              {item.tags && item.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 bg-muted rounded">
                  {tag}
                </span>
              ))}
              {item.tags && item.tags.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{item.tags.length - 3} more
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              {displayDate.toLocaleDateString()}
            </span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

export const KnowledgeCard = memo(KnowledgeCardComponent);
