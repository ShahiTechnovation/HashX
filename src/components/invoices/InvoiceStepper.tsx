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
              "flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium tabular-nums shrink-0 transition-colors duration-200",
              done && "bg-foreground text-white",
              active && "bg-primary text-white ring-4 ring-primary/15",
              !done && !active && "bg-surface-1 text-foreground-muted ring-1 ring-border-strong"
            )}
          >
            {done ? <Check className="w-3 h-3" strokeWidth={3} /> : s.num}
          </span>
          <span className="min-w-0 text-left">
            <span
              className={cn(
                "block text-[13px] font-medium whitespace-nowrap",
                !active && "sr-only sm:not-sr-only",
                active ? "text-foreground" : done ? "text-foreground-secondary" : "text-foreground-muted"
              )}
            >
              {s.label}
            </span>
            {s.hint && <span className="hidden 2xl:block text-xs text-foreground-muted truncate">{s.hint}</span>}
          </span>
        </>
      );

      return (
        <li key={s.num} className={cn("flex items-center", !isLast && "flex-1")} aria-current={active ? "step" : undefined}>
          {clickable ? (
            <button
              type="button"
              onClick={() => onSelect?.(s.num)}
              className="flex shrink-0 items-center gap-2.5 rounded-md -m-1 p-1 hover:bg-surface-2 transition-colors"
            >
              {body}
            </button>
          ) : (
            <span className="flex shrink-0 items-center gap-2.5">{body}</span>
          )}
          {!isLast && (
            <span
              aria-hidden="true"
              className={cn("flex-1 h-px mx-1.5 min-w-[8px] sm:mx-3 sm:min-w-[16px]", done ? "bg-foreground/40" : "bg-border-strong")}
            />
          )}
        </li>
      );
    })}
  </ol>
);
