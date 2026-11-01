"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "lg",
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

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/60 animate-fade-in" onClick={onClose} aria-hidden="true" />

      <div
        className={cn(
          "relative w-full rounded-xl bg-surface-1 shadow-overlay z-10 animate-scale-in overflow-hidden",
          maxWidthClasses[maxWidth]
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
          <div>
            {title && <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>}
            {description && <p className="text-[13px] text-foreground-secondary mt-1 leading-relaxed">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 -mr-1 -mt-0.5 rounded-md text-foreground-muted hover:text-foreground hover:bg-surface-3 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5">{children}</div>

        {footer && <div className="px-5 py-3.5 border-t border-border bg-surface-2/40 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
};
