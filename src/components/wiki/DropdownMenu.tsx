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
  const [position, setPosition] = useState({ top: 0, left: 0 });
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

  const handleTriggerClick = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.right - 150,
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <div ref={ref} className="relative">
      {Array.isArray(children)
        ? children.map((child) => {
            if (child.type === DropdownMenuTrigger) {
              return (
                <div key="trigger" onClick={handleTriggerClick}>
                  {child}
                </div>
              );
            }
            if (child.type === DropdownMenuContent) {
              return (
                isOpen && (
                  <div
                    key="content"
                    className="fixed z-50 min-w-max"
                    style={{
                      top: `${position.top}px`,
                      left: `${position.left}px`,
                    }}
                  >
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

export function DropdownMenuContent({ align = "end", children }: DropdownMenuContentProps) {
  return (
    <div
      className="py-1 bg-background border border-input rounded-lg shadow-lg"
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({ className = "", onClick, children }: DropdownMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2 hover:bg-muted transition-colors text-sm text-foreground ${className}`}
    >
      {children}
    </button>
  );
}
