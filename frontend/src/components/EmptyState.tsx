"use client";

import { memo } from "react";
import { LucideIcon } from "lucide-react";

function EmptyStateComponent({
  icon: Icon,
  message,
  subtext,
}: {
  icon: LucideIcon;
  message: string;
  subtext?: string;
}) {
  return (
    <div className="py-16 text-center">
      <Icon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
      <p className="text-muted-foreground">{message}</p>
      {subtext && (
        <p className="text-sm text-muted-foreground mt-1">{subtext}</p>
      )}
    </div>
  );
}

export const EmptyState = memo(EmptyStateComponent);
