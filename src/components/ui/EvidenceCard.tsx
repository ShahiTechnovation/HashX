"use client";

import React, { useState } from "react";
import { ChevronRight, Check, X, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { VerificationCheckDetail } from "@/types/domain";

interface EvidenceCardProps {
  name: string;
  detail: VerificationCheckDetail;
  className?: string;
  defaultExpanded?: boolean;
  index?: number;
}

/**
 * A single verification check row. Designed to stack inside a bordered
 * list (divide-y), not to float as an independent card.
 */
export const EvidenceCard: React.FC<EvidenceCardProps> = ({
  name,
  detail,
  className,
  defaultExpanded = false,
  index,
}) => {
  const isFail = detail.status === "FAIL";
  const isPass = detail.status === "PASS";
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || isFail);

  return (
    <div className={cn("group/ev", isFail && "bg-danger/[0.04]", className)}>
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2/50 transition-colors focus-visible:outline-none focus-visible:bg-surface-2/60"
      >
        <span
          className={cn(
            "flex items-center justify-center w-[18px] h-[18px] rounded-full shrink-0",
            isFail ? "bg-danger/15 text-danger" : isPass ? "bg-success/15 text-success" : "bg-surface-3 text-foreground-muted"
          )}
        >
          {isFail ? <X className="w-3 h-3" strokeWidth={2.75} /> : isPass ? <Check className="w-3 h-3" strokeWidth={2.75} /> : <Minus className="w-3 h-3" strokeWidth={2.75} />}
        </span>

        {index !== undefined && (
          <span className="hidden sm:block w-5 text-xs text-foreground-muted tabular-nums">{String(index).padStart(2, "0")}</span>
        )}

        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className={cn("text-[13px] font-medium capitalize", isFail ? "text-foreground" : "text-foreground/90")}>
              {name.replace(/_/g, " ")}
            </span>
            {detail.failureCode && (
              <span className="px-1.5 h-[18px] inline-flex items-center rounded text-[10px] font-mono font-medium bg-danger/10 text-danger ring-1 ring-inset ring-danger/25">
                {detail.failureCode}
              </span>
            )}
          </span>
          <span className="block text-xs text-foreground-muted truncate mt-0.5">{detail.rule}</span>
        </span>

        <span className={cn("hidden sm:block text-xs font-medium shrink-0", isFail ? "text-danger" : isPass ? "text-success" : "text-foreground-muted")}>
          {isFail ? "Fail" : isPass ? "Pass" : "Skipped"}
        </span>
        <ChevronRight
          className={cn("w-3.5 h-3.5 text-foreground-muted shrink-0 transition-transform duration-150", isExpanded && "rotate-90")}
        />
      </button>

      {isExpanded && (
        <div className="pl-[46px] sm:pl-[66px] pr-4 pb-3.5 text-xs space-y-2.5 animate-fade-in">
          <p className="text-foreground-secondary leading-relaxed max-w-3xl">{detail.explanation}</p>

          {(detail.expected || detail.actual) && (
            <div className="grid grid-cols-1 md:grid-cols-2 rounded-md border border-border overflow-hidden">
              {detail.expected && (
                <div className="p-2.5 bg-background/60">
                  <span className="eyebrow block mb-1">Expected</span>
                  <div className="font-mono text-xs text-foreground/90 break-all">{detail.expected}</div>
                </div>
              )}
              {detail.actual && (
                <div className={cn("p-2.5 border-t md:border-t-0 md:border-l border-border", isFail ? "bg-danger/[0.06]" : "bg-background/60")}>
                  <span className={cn("eyebrow block mb-1", isFail && "text-danger")}>Actual · recomputed</span>
                  <div className={cn("font-mono text-xs break-all", isFail ? "text-danger" : "text-foreground/90")}>{detail.actual}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
