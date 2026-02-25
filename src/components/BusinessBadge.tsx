"use client";

import React from "react";

interface Workspace {
  _id: string;
  name: string;
  emoji?: string;
  color?: string;
}

interface WorkspaceBadgeProps {
  business:  | null;
  variant?: "inline" | "small" | "large" | "emoji-only";
  onClick?: () => void;
}

/**
 * WorkspaceBadge Component
 * Shows workspace info in activity entries and other contexts
 * Displays emoji, name, and color styling
 */
export function WorkspaceBadge({ workspace, variant = "inline", onClick }: WorkspaceBadgeProps) {
  if (!workspace) {
    return <span className="text-muted-foreground text-sm">Unknown </span>;
  }

  // Determine background and text colors
  const bgColor =  workspace.color || "#6366f1";
  const style = {
    backgroundColor: bgColor,
    color: "white",
  };

  if (variant === "emoji-only") {
    return (
      <span
        title={ workspace.name}
        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-sm cursor-pointer hover:opacity-80 transition-opacity"
        style={style}
        onClick={onClick}
      >
        { workspace.emoji || "•"}
      </span>
    );
  }

  if (variant === "small") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity"
        style={style}
        onClick={onClick}
      >
        { workspace.emoji && <span>{ workspace.emoji}</span>}
        <span className="truncate">{ workspace.name}</span>
      </span>
    );
  }

  if (variant === "large") {
    return (
      <span
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-base font-semibold cursor-pointer hover:opacity-90 transition-opacity"
        style={style}
        onClick={onClick}
      >
        { workspace.emoji && <span className="text-2xl">{ workspace.emoji}</span>}
        <span>{ workspace.name}</span>
      </span>
    );
  }

  // Default: inline variant
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity"
      style={style}
      onClick={onClick}
    >
      { workspace.emoji && <span>{ workspace.emoji}</span>}
      <span className="truncate">{ workspace.name}</span>
    </span>
  );
}
