import React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CopyableValue } from "@/components/ui/CopyableValue";

export interface HashRowSpec {
  label: string;
  hint?: string;
  value?: string;
  explorerUrl?: string;
  /** Optional comparison verdict shown at the row's right edge. */
  match?: { ok: boolean; label: string };
  emptyText?: string;
}

/**
 * Block-explorer style record: fixed label column, full machine value,
 * comparison marker on the right. Rows are hairline-divided, never boxed.
 */
export const HashGroup: React.FC<{ title: string; rows: HashRowSpec[]; className?: string }> = ({ title, rows, className }) => (
  <div className={className}>
    <div className="px-4 sm:px-5 pt-3 pb-1.5 text-2xs font-medium text-foreground-muted">{title}</div>
    <dl className="divide-y divide-border/50">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)_auto] gap-x-4 gap-y-1 items-center px-4 sm:px-5 py-2.5 hover:bg-surface-2/40 transition-colors"
        >
          <dt className="min-w-0">
            <span className="block text-xs text-foreground-secondary">{row.label}</span>
            {row.hint && <span className="block text-2xs text-foreground-muted/80 truncate">{row.hint}</span>}
          </dt>
          <dd className="min-w-0">
            {row.value ? (
              <CopyableValue
                value={row.value}
                label={`Copy ${row.label.toLowerCase()}`}
                explorerUrl={row.explorerUrl}
                className={cn("max-w-full", row.match && !row.match.ok && "[&>span:first-child]:text-danger")}
              />
            ) : (
              <span className="text-xs text-foreground-muted">{row.emptyText ?? "Not available"}</span>
            )}
          </dd>
          <dd className="sm:justify-self-end">
            {row.match && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-2xs font-medium whitespace-nowrap",
                  row.match.ok ? "text-success" : "text-danger"
                )}
              >
                {row.match.ok ? (
                  <Check className="w-3 h-3" strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  <X className="w-3 h-3" strokeWidth={2.5} aria-hidden="true" />
                )}
                {row.match.label}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  </div>
);
