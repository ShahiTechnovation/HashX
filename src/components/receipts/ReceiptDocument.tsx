import React from "react";
import { cn } from "@/lib/utils";
import { resolveStatus, toneStyles } from "@/components/ui/StatusBadge";
import { HSPStatus } from "@/types/domain";

/**
 * Numbered section of a receipt document. Heading sits in a left gutter,
 * content in the body column — laid out like an audit record so it survives
 * printing without relying on color.
 */
export const DocSection: React.FC<{
  index: number;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ index, title, description, children, className }) => (
  <section
    aria-labelledby={`receipt-section-${index}`}
    className={cn("grid grid-cols-1 md:grid-cols-[176px_minmax(0,1fr)] gap-x-8 gap-y-4 px-6 sm:px-10 py-7 border-t border-border break-inside-avoid", className)}
  >
    <header className="md:pt-px">
      <div className="flex items-baseline gap-2">
        <span className="text-2xs tabular-nums text-foreground-muted">{String(index).padStart(2, "0")}</span>
        <h2 id={`receipt-section-${index}`} className="eyebrow text-foreground-secondary">
          {title}
        </h2>
      </div>
      {description && <p className="mt-1.5 text-2xs leading-relaxed text-foreground-muted md:pr-2">{description}</p>}
    </header>
    <div className="min-w-0">{children}</div>
  </section>
);

/** Ruled stamp showing the settlement state the receipt was issued against. */
export const StatusStamp: React.FC<{ status: HSPStatus; date?: string; className?: string }> = ({ status, date, className }) => {
  const { label, tone, Icon } = resolveStatus(status, "hsp");
  const isFinal = status === "payment-finalized";
  return (
    <div
      className={cn(
        "inline-flex flex-col items-center gap-1 rounded-md border px-4 py-2.5 text-center",
        "outline outline-1 outline-offset-[3px]",
        toneStyles[tone].border,
        tone === "success" ? "outline-success/20" : tone === "warning" ? "outline-warning/20" : "outline-border",
        className
      )}
    >
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em]", toneStyles[tone].text)}>
        <Icon className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden="true" />
        {label}
      </span>
      <span className="text-[10px] uppercase tracking-[0.1em] text-foreground-muted">
        {isFinal ? "Irreversible · HashKey Chain" : "Not final · HashKey Chain"}
      </span>
      {date && <span className="text-2xs tabular-nums text-foreground-secondary">{date}</span>}
    </div>
  );
};

/** Label / value field used in the document's party and meta grids. */
export const DocField: React.FC<{ label: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className,
}) => (
  <div className={cn("min-w-0", className)}>
    <div className="text-2xs text-foreground-muted">{label}</div>
    <div className="mt-1 text-[13px] text-foreground min-w-0">{children}</div>
  </div>
);
