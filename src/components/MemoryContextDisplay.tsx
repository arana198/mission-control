"use client";

import { useEffect, useState } from "react";
import { getMemoryService } from "@/lib/services/memoryService";
import { BookOpen, Link, TrendingUp, Lightbulb, AlertCircle } from "lucide-react";
import clsx from "clsx";

interface MemoryContext {
  sections: Array<{
    path: string;
    snippet: string;
    relevance: number;
    keywords: string[];
  }>;
  relatedGoals: string[];
  priorStrategies: string[];
  recommendations: string[];
}

interface Props {
  query: string; // Goal title, task title, or search term
  compact?: boolean; // Show condensed version
  className?: string;
}

/**
 * Display relevant memory context inline for any entity
 * 
 * Example usage:
 * <MemoryContextDisplay query="YouTube growth strategy" />
 * 
 * Shows:
 * - Related memory sections
 * - Prior strategies that worked
 * - Pattern recommendations
 */
export function MemoryContextDisplay({
  query,
  compact = false,
  className,
}: Props) {
  const [context, setContext] = useState<MemoryContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!compact);

  const memoryService = getMemoryService();

  useEffect(() => {
    if (!query) {
      setContext(null);
      setLoading(false);
      return;
    }

    const fetchContext = async () => {
      setLoading(true);
      try {
        const sections = await memoryService.searchMemory(query, 3);
        
        // Extract strategies and recommendations from snippets
        const strategies = sections
          .filter((s) =>
            s.snippet.toLowerCase().includes("strategy") ||
            s.snippet.toLowerCase().includes("approach")
          )
          .map((s) => s.snippet.slice(0, 100) + "...");

        const recommendations = sections
          .filter((s) =>
            s.snippet.toLowerCase().includes("should") ||
            s.snippet.toLowerCase().includes("recommend")
          )
          .map((s) => s.snippet.slice(0, 100) + "...");

        setContext({
          sections,
          relatedGoals: [], // Would be populated from goal linkage
          priorStrategies: strategies,
          recommendations,
        });
      } catch (e) {
        // Memory context fetch failed - context will not be displayed
        setContext(null);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchContext, 300);
    return () => clearTimeout(timer);
  }, [query, memoryService]);

  if (loading) {
    return (
      <div className={clsx("animate-pulse", className)}>
        <div className="h-12 bg-secondary rounded" />
      </div>
    );
  }

  if (!context || context.sections.length === 0) {
    return null;
  }

  if (compact && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
      >
        <BookOpen className="w-3 h-3" />
        View memory context
      </button>
    );
  }

  return (
    <div
      className={clsx(
        "space-y-3 p-3 rounded-lg bg-secondary/30 border border-border/50",
        className
      )}
    >
      {/* Header */}
      {compact && (
        <button
          onClick={() => setExpanded(false)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
        >
          <BookOpen className="w-3 h-3" />
          Memory Context
          <span className="text-xs opacity-50">← Hide</span>
        </button>
      )}

      {/* Related Memory Sections */}
      {context.sections.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-foreground/70 flex items-center gap-1">
            <Link className="w-3 h-3" />
            Related Context
          </div>
          <div className="space-y-1">
            {context.sections.map((section, idx) => (
              <a
                key={idx}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  // Navigate to memory section - TODO: Implement navigation
                }}
                className={clsx(
                  "block text-xs p-2 rounded bg-background/50 hover:bg-background transition-colors group",
                  "border border-border/30 hover:border-border/70"
                )}
              >
                <div className="font-mono text-muted-foreground group-hover:text-foreground text-[10px] mb-1">
                  {section.path}
                </div>
                <p className="text-muted-foreground line-clamp-2">
                  {section.snippet.slice(0, 80)}...
                </p>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex flex-wrap gap-1">
                    {section.keywords.slice(0, 2).map((kw) => (
                      <span
                        key={kw}
                        className="text-xs bg-primary/20 px-1.5 py-0.5 rounded text-primary"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {(section.relevance * 100).toFixed(0)}% match
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Prior Strategies */}
      {context.priorStrategies.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-foreground/70 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Prior Strategies
          </div>
          <div className="space-y-1">
            {context.priorStrategies.map((strategy, idx) => (
              <div
                key={idx}
                className="text-xs p-2 rounded bg-background/50 border border-border/30 text-muted-foreground"
              >
                {strategy}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {context.recommendations.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-foreground/70 flex items-center gap-1">
            <Lightbulb className="w-3 h-3" />
            Pattern-Based Recommendations
          </div>
          <div className="space-y-1">
            {context.recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="text-xs p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400"
              >
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{rec}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {context.sections.length === 0 &&
        context.priorStrategies.length === 0 &&
        context.recommendations.length === 0 && (
          <div className="text-xs text-muted-foreground flex items-center gap-2 p-2">
            <AlertCircle className="w-3 h-3" />
            No memory context found for this query
          </div>
        )}
    </div>
  );
}
