"use client";

import { ReactNode, forwardRef, useId } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

// PERF: Phase 5D - ModalOverlay with accessibility backdrop
export function ModalOverlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-overlay/60 flex items-center justify-center z-50"
      onClick={onClose}
      aria-hidden="false"
      role="presentation"
    >
      {children}
    </div>
  );
}

// PERF: Phase 5D - ModalContent with ARIA role and attributes, ref support
export const ModalContent = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
    titleId?: string;
    isOpen?: boolean;
  }
>(function ModalContent({ children, className = "", onClick, titleId, isOpen = true }, ref) {
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`card max-w-3xl w-full mx-4 sm:max-h-[90vh] sm:rounded-xl sm:mx-4 ${className}`}
      onClick={onClick || ((e) => e.stopPropagation())}
    >
      {children}
    </div>
  );
});

// PERF: Phase 5D - ModalHeader with accessible title and close button
export function ModalHeader({
  title,
  subtitle,
  onClose,
  titleId,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  titleId?: string;
}) {
  return (
    <div className="flex items-center justify-between p-6 border-b">
      <div>
        <h2 id={titleId} className="text-xl font-semibold">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="btn btn-ghost p-2"
        aria-label="Close"
        type="button"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

// PERF: Phase 5D - ModalWrapper with focus trap and accessibility
export function ModalWrapper({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  className = "",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const modalRef = useFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <ModalOverlay onClose={onClose}>
      <ModalContent ref={modalRef} titleId={titleId} isOpen={isOpen} className={className}>
        <ModalHeader title={title} subtitle={subtitle} onClose={onClose} titleId={titleId} />
        {children}
      </ModalContent>
    </ModalOverlay>
  );
}
