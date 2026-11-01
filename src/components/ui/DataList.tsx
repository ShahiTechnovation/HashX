import React from "react";
import { cn } from "@/lib/utils";

/**
 * Key/value list for structured records (terms, identities, IDs).
 * Labels sit in a fixed column; values align on a single edge.
 */
export const DataList: React.FC<{ className?: string; children: React.ReactNode; dense?: boolean }> = ({
  className,
  children,
  dense,
}) => <dl className={cn("divide-y divide-border/60", dense && "[&>div]:py-2", className)}>{children}</dl>;

interface DataRowProps {
  label: React.ReactNode;
  children: React.ReactNode;
  hint?: React.ReactNode;
  mono?: boolean;
  stacked?: boolean;
  className?: string;
}

export const DataRow: React.FC<DataRowProps> = ({ label, children, hint, mono, stacked, className }) => (
  <div
    className={cn(
      "py-2.5 first:pt-0 last:pb-0",
      stacked ? "flex flex-col gap-1" : "grid grid-cols-[minmax(120px,38%)_minmax(0,1fr)] gap-4 items-baseline",
      className
    )}
  >
    <dt className="text-xs text-foreground-muted">
      {label}
      {hint && <span className="block text-2xs text-foreground-muted/70 mt-0.5">{hint}</span>}
    </dt>
    <dd className={cn("min-w-0 text-[13px] text-foreground", mono && "font-mono text-xs break-all")}>
      {children}
    </dd>
  </div>
);
