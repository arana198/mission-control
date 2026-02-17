import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-slate-900/60 backdrop-blur-sm border border-slate-800/60",
        className
      )}
    >
      {children}
    </div>
  );
}
