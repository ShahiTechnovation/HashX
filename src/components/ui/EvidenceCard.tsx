"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, AlertCircle, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VerificationCheckDetail } from "@/types/domain";

interface EvidenceCardProps {
  name: string;
  detail: VerificationCheckDetail;
  className?: string;
  defaultExpanded?: boolean;
}

export const EvidenceCard: React.FC<EvidenceCardProps> = ({
  name,
  detail,
  className,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || detail.status === "FAIL");

  const isFail = detail.status === "FAIL";
  const isPass = detail.status === "PASS";

  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-200 overflow-hidden",
        isFail
          ? "border-danger/40 bg-danger/5"
          : isPass
          ? "border-border hover:border-border-strong bg-surface-1/60"
          : "border-border/60 bg-surface-1/30",
        className
      )}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        className="flex items-center justify-between p-3.5 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">
            {isFail ? (
              <ShieldAlert className="w-5 h-5 text-danger" />
            ) : isPass ? (
              <ShieldCheck className="w-5 h-5 text-success" />
            ) : (
              <AlertCircle className="w-5 h-5 text-foreground-muted" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-foreground capitalize">
                {name.replace(/_/g, " ")}
              </span>
              {detail.failureCode && (
                <span className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-danger/20 text-danger border border-danger/40 font-semibold">
                  {detail.failureCode}
                </span>
              )}
            </div>
            <p className="text-xs text-foreground-secondary truncate mt-0.5">
              {detail.rule}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-2">
          <StatusBadge status={detail.status} type="check" size="sm" />
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-foreground-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-foreground-muted" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-3.5 pb-3.5 pt-1 text-xs border-t border-border/40 bg-surface-2/40 space-y-2">
          <div className="text-foreground-secondary leading-relaxed">
            <span className="font-medium text-foreground">Diagnosis: </span>
            {detail.explanation}
          </div>

          {(detail.expected || detail.actual) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/30">
              {detail.expected && (
                <div className="p-2 rounded bg-surface-3/50 border border-border/40">
                  <span className="text-[11px] uppercase tracking-wider font-mono text-foreground-muted block mb-1">
                    Expected Policy Value
                  </span>
                  <div className="font-mono text-xs text-success break-all select-all">
                    {detail.expected}
                  </div>
                </div>
              )}
              {detail.actual && (
                <div className="p-2 rounded bg-surface-3/50 border border-danger/30">
                  <span className="text-[11px] uppercase tracking-wider font-mono text-danger block mb-1">
                    Actual Recomputed Value
                  </span>
                  <div className="font-mono text-xs text-danger break-all select-all">
                    {detail.actual}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
