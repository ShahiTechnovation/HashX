"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "md" | "lg" | "xl";
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "lg",
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    md: "max-w-md",
    lg: "max-w-xl",
    xl: "max-w-2xl",
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} aria-hidden="true" />

      <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
        <div
          className={cn(
            "w-screen bg-surface-1 border-l border-border shadow-overlay flex flex-col z-10 animate-slide-in-right",
            widthClasses[width]
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border">
            <div className="min-w-0">
              {title && <h3 className="text-[15px] font-semibold text-foreground tracking-tight">{title}</h3>}
              {subtitle && <p className="text-xs text-foreground-muted mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="p-1 -mr-1 rounded-md text-foreground-muted hover:text-foreground hover:bg-surface-3 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">{children}</div>

          {footer && <div className="px-5 py-3.5 border-t border-border bg-surface-1 flex items-center justify-end gap-2">{footer}</div>}
        </div>
      </div>
    </div>
  );
};
