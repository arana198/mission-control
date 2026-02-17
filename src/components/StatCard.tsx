"use client";

import { memo } from "react";
import { LucideIcon } from "lucide-react";

function StatCardComponent({
  label,
  value,
  icon: Icon,
  color = "text-blue-600",
  subtext,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  subtext?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {subtext && (
        <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
      )}
    </div>
  );
}

export const StatCard = memo(StatCardComponent);
