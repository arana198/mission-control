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
    XS: "bg-green-100 text-green-700",
    S: "bg-blue-100 text-blue-700",
    M: "bg-yellow-100 text-yellow-700",
    L: "bg-orange-100 text-orange-700",
    XL: "bg-red-100 text-red-700",
  };
  return `badge ${colors[estimate] || "bg-gray-100 text-gray-700"}`;
}
