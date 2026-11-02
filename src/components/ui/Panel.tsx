import React from "react";
import { cn } from "@/lib/utils";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section" | "article" | "aside";
  inset?: boolean;
}

/** Base surface. One border, one radius, no glow. */
export const Panel: React.FC<PanelProps> = ({ as: Tag = "div", inset, className, children, ...props }) => (
  <Tag className={cn(inset ? "panel-inset" : "panel", "overflow-hidden", className)} {...props}>
    {children}
  </Tag>
);

interface PanelHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Compact header for dense side panels. */
  compact?: boolean;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({ title, description, icon, actions, className, compact }) => (
  <div
    className={cn(
      "flex items-start justify-between gap-4 border-b border-border",
      compact ? "px-4 py-3" : "px-4 sm:px-5 py-4",
      className
    )}
  >
    <div className="flex items-start gap-2.5 min-w-0">
      {icon && <span className="mt-0.5 text-foreground-muted shrink-0 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
      <div className="min-w-0">
        <h3 className={cn("font-medium text-foreground tracking-[-0.01em]", compact ? "text-[13px]" : "text-[15px]")}>{title}</h3>
        {description && <p className="text-xs text-foreground-muted mt-0.5 leading-relaxed">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export const PanelBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn("p-4 sm:p-5", className)} {...props} />
);

export const PanelFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn("px-4 sm:px-5 py-3 border-t border-border bg-surface-2/50", className)} {...props} />
);

/** Section heading used between groups of panels on a page. */
export const SectionHeading: React.FC<{
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, description, actions, className }) => (
  <div className={cn("flex items-end justify-between gap-4", className)}>
    <div>
      <h2 className="text-[17px] font-semibold text-foreground tracking-[-0.018em]">{title}</h2>
      {description && <p className="text-[13px] text-foreground-muted mt-1">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);
