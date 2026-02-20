"use client";

import { useState, useRef, useEffect } from "react";

interface DropdownMenuProps {
  children: React.ReactNode;
}

interface DropdownMenuTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

interface DropdownMenuContentProps {
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}

interface DropdownMenuItemProps {
  className?: string;
  onClick: () => void;
  children: React.ReactNode;
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={ref} className="relative">
      {Array.isArray(children)
        ? children.map((child) => {
            if (child.type === DropdownMenuTrigger) {
              return (
                <div key="trigger" onClick={() => setIsOpen(!isOpen)}>
                  {child}
                </div>
              );
            }
            if (child.type === DropdownMenuContent) {
              return (
                isOpen && (
                  <div key="content" className="absolute top-full z-50 min-w-max">
                    {child}
                  </div>
                )
              );
            }
            return child;
          })
        : children}
    </div>
  );
}

export function DropdownMenuTrigger({ asChild, children }: DropdownMenuTriggerProps) {
  if (asChild) {
    return children;
  }
  return <button>{children}</button>;
}

export function DropdownMenuContent({ align = "start", children }: DropdownMenuContentProps) {
  const alignClass = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  }[align];

  return (
    <div
      className={`${alignClass} mt-1 py-1 bg-white border border-input rounded-lg shadow-lg`}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({ className = "", onClick, children }: DropdownMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2 hover:bg-muted transition-colors text-sm ${className}`}
    >
      {children}
    </button>
  );
}
