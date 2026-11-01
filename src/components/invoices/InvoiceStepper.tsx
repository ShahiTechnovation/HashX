import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepDef {
  num: number;
  label: string;
  hint?: string;
}

interface InvoiceStepperProps {
  steps: StepDef[];
  current: number;
  /** Called when a completed step is selected (navigating back only). */
  onSelect?: (num: number) => void;
  className?: string;
}

/**
 * Numbered horizontal stepper. Nodes are joined by hairline connectors;
 * completed steps are selectable to step back without re-validating.
 */
export const InvoiceStepper: React.FC<InvoiceStepperProps> = ({ steps, current, onSelect, className }) => (
  <ol className={cn("flex items-start", className)} aria-label="Invoice composition steps">
    {steps.map((s, i) => {
      const done = current > s.num;
      const active = current === s.num;
      const clickable = done && !!onSelect;
      const isLast = i === steps.length - 1;

      const body = (
        <>
          <span
            className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full text-2xs font-medium tabular-nums shrink-0 transition-colors",
              done && "bg-surface-3 text-foreground-secondary ring-1 ring-border-strong",
              active && "bg-primary text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.16)]",
              !done && !active && "bg-background text-foreground-muted ring-1 ring-border"
            )}
          >
            {done ? <Check className="w-3 h-3" strokeWidth={3} /> : s.num}
          </span>
          <span className="min-w-0 text-left">
            <span
              className={cn(
                "block text-xs font-medium truncate",
                active ? "text-foreground" : done ? "text-foreground-secondary" : "text-foreground-muted"
              )}
            >
              {s.label}
            </span>
            {s.hint && <span className="hidden md:block text-2xs text-foreground-muted truncate">{s.hint}</span>}
          </span>
        </>
      );

      return (
        <li key={s.num} className={cn("flex items-center min-w-0", !isLast && "flex-1")} aria-current={active ? "step" : undefined}>
          {clickable ? (
            <button
              type="button"
              onClick={() => onSelect?.(s.num)}
              className="flex items-center gap-2.5 min-w-0 rounded-md -m-1 p-1 hover:bg-surface-2 transition-colors"
            >
              {body}
            </button>
          ) : (
            <span className="flex items-center gap-2.5 min-w-0">{body}</span>
          )}
          {!isLast && (
            <span
              aria-hidden="true"
              className={cn("flex-1 h-px mx-3 min-w-[16px]", done ? "bg-border-strong" : "bg-border")}
            />
          )}
        </li>
      );
    })}
  </ol>
);
