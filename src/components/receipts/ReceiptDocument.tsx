import React from "react";
import { cn } from "@/lib/utils";
import { resolveStatus, toneStyles } from "@/components/ui/StatusBadge";
import { HSPStatus } from "@/types/domain";

/**
 * Paper-like receipt surface. White in every theme and on paper; hairline rules
 * only, so it survives printing without relying on color.
 */
export const ReceiptPaper: React.FC<{ children: React.ReactNode; className?: string; label?: string }> = ({
  children,
  className,
  label = "Receipt document",
}) => (
  <article
    aria-label={label}
    className={cn(
      "receipt-paper mx-auto w-full max-w-4xl overflow-hidden rounded-lg border border-border bg-white shadow-raised",
      "print:max-w-none print:rounded-none print:border-0 print:shadow-none",
      className
    )}
  >
    {children}
  </article>
);

/**
 * Numbered section of a receipt document. Heading sits in a left gutter,
 * content in the body column — laid out like an audit record.
 */
export const DocSection: React.FC<{
  index: number;
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ index, title, description, aside, children, className }) => (
  <section
    aria-labelledby={`receipt-section-${index}`}
    className={cn(
      "grid grid-cols-1 md:grid-cols-[184px_minmax(0,1fr)] gap-x-10 gap-y-4 px-6 sm:px-10 py-7 border-t border-border break-inside-avoid",
      className
    )}
  >
    <header className="md:pt-px">
      <div className="flex items-baseline gap-2">
        <span className="text-xs tabular-nums text-foreground-muted">{String(index).padStart(2, "0")}</span>
        <h2 id={`receipt-section-${index}`} className="text-[13px] font-medium text-foreground">
          {title}
        </h2>
      </div>
      {description && <p className="mt-1.5 text-xs leading-relaxed text-foreground-muted md:pr-2">{description}</p>}
      {aside && <div className="mt-3">{aside}</div>}
    </header>
    <div className="min-w-0">{children}</div>
  </section>
);

/** Ruled stamp showing the settlement state the receipt was issued against. */
export const StatusStamp: React.FC<{ status: HSPStatus; date?: string; network?: string; className?: string }> = ({
  status,
  date,
  network = "HashKey Chain",
  className,
}) => {
  const { label, tone, Icon } = resolveStatus(status, "hsp");
  const isFinal = status === "payment-finalized";
  return (
    <div
      className={cn(
        "inline-flex flex-col items-start gap-1 rounded-md border px-3.5 py-2.5",
        toneStyles[tone].border,
        toneStyles[tone].bg,
        className
      )}
    >
      <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", toneStyles[tone].text)}>
        <Icon className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden="true" />
        {label}
      </span>
      <span className="text-xs text-foreground-muted">
        {isFinal ? "Irreversible" : "Not final"} · {network}
      </span>
      {date && <span className="text-xs tabular-nums text-foreground-secondary">{date}</span>}
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
    <div className="text-xs text-foreground-muted">{label}</div>
    <div className="mt-1 text-[13px] text-foreground min-w-0">{children}</div>
  </div>
);
