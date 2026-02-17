"use client";

import { ReactNode } from "react";
import { X } from "lucide-react";

export function ModalOverlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      {children}
    </div>
  );
}

export function ModalContent({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={`card max-w-3xl w-full mx-4 ${className}`}
      onClick={onClick || ((e) => e.stopPropagation())}
    >
      {children}
    </div>
  );
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-6 border-b">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      <button onClick={onClose} className="btn btn-ghost p-2">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
