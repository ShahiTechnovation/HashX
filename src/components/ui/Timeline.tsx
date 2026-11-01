import React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type TimelineState = "done" | "current" | "pending" | "failed" | "warning";

export interface TimelineItem {
  title: React.ReactNode;
  description?: React.ReactNode;
  time?: React.ReactNode;
  state: TimelineState;
  meta?: React.ReactNode;
}

/** Vertical audit timeline. A single continuous rail; state lives on the node. */
export const Timeline: React.FC<{ items: TimelineItem[]; className?: string }> = ({ items, className }) => (
  <ol className={cn("relative", className)}>
    {items.map((item, i) => {
      const isLast = i === items.length - 1;
      return (
        <li key={i} className="relative flex gap-3.5 pb-5 last:pb-0">
          {!isLast && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-[9px] top-6 bottom-1 w-px",
                item.state === "done" ? "bg-border-strong" : "bg-border"
              )}
            />
          )}
          <TimelineNode state={item.state} />
          <div className="flex-1 min-w-0 -mt-px">
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  "text-[13px] font-medium",
                  item.state === "pending" ? "text-foreground-muted" : "text-foreground",
                  item.state === "failed" && "text-danger"
                )}
              >
                {item.title}
              </span>
              {item.time && <span className="text-2xs text-foreground-muted tabular-nums whitespace-nowrap">{item.time}</span>}
            </div>
            {item.description && <p className="text-xs text-foreground-muted mt-0.5 leading-relaxed">{item.description}</p>}
            {item.meta && <div className="mt-1.5">{item.meta}</div>}
          </div>
        </li>
      );
    })}
  </ol>
);

const TimelineNode: React.FC<{ state: TimelineState }> = ({ state }) => {
  const base = "relative z-10 flex items-center justify-center w-[19px] h-[19px] rounded-full shrink-0";
  switch (state) {
    case "done":
      return (
        <span className={cn(base, "bg-surface-3 ring-1 ring-border-strong text-foreground-secondary")}>
          <Check className="w-2.5 h-2.5" strokeWidth={3} />
        </span>
      );
    case "current":
      return (
        <span className={cn(base, "bg-primary/15 ring-1 ring-primary/50")}>
          <span className="w-1.5 h-1.5 rounded-full bg-primary-light" />
        </span>
      );
    case "warning":
      return (
        <span className={cn(base, "bg-warning/15 ring-1 ring-warning/50")}>
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
        </span>
      );
    case "failed":
      return (
        <span className={cn(base, "bg-danger/15 ring-1 ring-danger/50 text-danger")}>
          <X className="w-2.5 h-2.5" strokeWidth={3} />
        </span>
      );
    default:
      return <span className={cn(base, "bg-background ring-1 ring-border")} />;
  }
};
