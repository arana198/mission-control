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
        "rounded-xl bg-surface/60 backdrop-blur-sm border border-border/60",
        className
      )}
    >
      {children}
    </div>
  );
}
