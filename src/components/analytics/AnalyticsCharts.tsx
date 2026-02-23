"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

/**
 * AnalyticsStatCard - Displays a single metric with optional trend indicator
 * Used for: Total Tasks, Completion Rate %, Avg Cycle Time, Agent Count
 */
export function AnalyticsStatCard({
  label,
  value,
  icon: Icon,
  trend,
  unit,
}: {
  label: string;
  value: number | string;
  icon: any;
  trend?: "up" | "down" | "flat";
  unit?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {value}
              {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
            </span>
            {trend && (
              <span
                className={`flex items-center gap-1 text-xs font-medium ${
                  trend === "up"
                    ? "text-green-600"
                    : trend === "down"
                      ? "text-red-600"
                      : "text-gray-600"
                }`}
              >
                {trend === "up" && <ArrowUp className="w-3 h-3" />}
                {trend === "down" && <ArrowDown className="w-3 h-3" />}
                {trend === "flat" && "—"}
              </span>
            )}
          </div>
        </div>
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
    </div>
  );
}

/**
 * MiniBarChart - Horizontal bar chart using CSS for styling
 * No dependencies on charting libraries
 */
export function MiniBarChart({
  data,
  maxValue,
  colorFn,
  horizontal = true,
}: {
  data: Array<{ label: string; value: number }>;
  maxValue?: number;
  colorFn?: (label: string) => string;
  horizontal?: boolean;
}) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);

  const defaultColorFn = (label: string) => {
    const colors: Record<string, string> = {
      P0: "bg-red-500",
      P1: "bg-orange-500",
      P2: "bg-blue-500",
      P3: "bg-green-500",
      backlog: "bg-gray-300",
      ready: "bg-blue-300",
      in_progress: "bg-yellow-300",
      review: "bg-purple-300",
      blocked: "bg-red-300",
      done: "bg-green-300",
    };
    return colors[label] || "bg-gray-400";
  };

  const getColor = colorFn || defaultColorFn;

  if (horizontal) {
    return (
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{item.label}</span>
              <span className="text-xs text-muted-foreground">{item.value}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${getColor(
                  item.label
                )}`}
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  } else {
    // Vertical bar chart layout
    return (
      <div className="flex items-end justify-center gap-2 h-48">
        {data.map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center gap-1 flex-1"
          >
            <div className="w-full relative h-40 flex items-end justify-center">
              <div
                className={`w-full rounded-t ${getColor(item.label)} transition-all`}
                style={{ height: `${(item.value / max) * 100}%` }}
                title={`${item.label}: ${item.value}`}
              />
            </div>
            <span className="text-xs text-center text-muted-foreground truncate">
              {item.label}
            </span>
            <span className="text-xs font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    );
  }
}

/**
 * WeeklyVelocityChart - Vertical bar chart showing completed tasks by week
 */
export function WeeklyVelocityChart({
  data,
}: {
  data: Array<{ week: string; count: number }>;
}) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        No activity data available
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2 h-48">
        {data.map((item) => (
          <div
            key={item.week}
            className="flex flex-col items-center gap-1 flex-1"
          >
            <div className="w-full relative h-40 flex items-end justify-center">
              <div
                className="w-full rounded-t bg-blue-500 transition-all"
                style={{ height: `${(item.count / maxCount) * 100}%` }}
                title={`${item.week}: ${item.count} tasks`}
              />
            </div>
            <span className="text-xs text-center text-muted-foreground truncate">
              {item.week.split("-").pop()}
            </span>
            <span className="text-xs font-medium">{item.count}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground px-2">
        <span>Completed tasks per week</span>
        <span>Last {data.length} weeks</span>
      </div>
    </div>
  );
}

/**
 * StackedBarChart - Horizontal stacked bar showing distribution
 */
export function StackedBarChart({
  segments,
  total,
  label,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  total: number;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">Total: {total}</span>
      </div>
      <div className="flex h-6 rounded-full overflow-hidden bg-gray-100">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={segment.color}
            style={{
              width: `${total === 0 ? 0 : (segment.value / total) * 100}%`,
            }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${segment.color}`} />
            <span>{segment.label}</span>
            <span className="text-muted-foreground">
              {total === 0 ? 0 : Math.round((segment.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
