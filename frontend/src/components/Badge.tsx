"use client";

export function getPriorityBadgeClass(priority: string): string {
  const p = priority.toLowerCase();
  return `badge badge-priority-${p}`;
}

export function getStatusBadgeClass(status: string): string {
  return `badge badge-status-${status}`;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    backlog: "Backlog",
    ready: "Ready",
    in_progress: "In Progress",
    review: "Review",
    blocked: "Blocked",
    done: "Done",
  };
  return labels[status] || status;
}

export function getPriorityLabel(priority: string): string {
  return priority.toUpperCase();
}

export function getTimeEstimateBadgeClass(estimate: string): string {
  const colors: Record<string, string> = {
    XS: "bg-success/10 text-success",
    S: "bg-primary/10 text-primary",
    M: "bg-warning/10 text-warning",
    L: "bg-warning/10 text-warning",
    XL: "bg-destructive/10 text-destructive",
  };
  return `badge ${colors[estimate] || "bg-muted text-muted-foreground"}`;
}
