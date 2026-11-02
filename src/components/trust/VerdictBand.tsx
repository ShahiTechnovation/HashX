import React from "react";
import { Check, X, Clock, Lock, LockOpen, CircleDashed, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VerificationDecision } from "@/types/domain";
import { resolveStatus, toneStyles, type Tone } from "@/components/ui/StatusBadge";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { ReasonCodeChip } from "./reasonCodes";

export interface Gate {
  key: string;
  label: string;
  /** e.g. "6/6 checks passed" */
  detail: string;
  state: "pass" | "fail" | "pending" | "idle" | "open" | "blocked" | "held";
}

const GATE_STYLE: Record<Gate["state"], { tone: Tone; Icon: LucideIcon; word: string }> = {
  pass: { tone: "success", Icon: Check, word: "Pass" },
  fail: { tone: "danger", Icon: X, word: "Fail" },
  pending: { tone: "warning", Icon: Clock, word: "Pending" },
  idle: { tone: "neutral", Icon: CircleDashed, word: "Not run" },
  open: { tone: "success", Icon: LockOpen, word: "Open" },
  blocked: { tone: "danger", Icon: Lock, word: "Closed" },
  held: { tone: "warning", Icon: Lock, word: "Held" },
};

interface VerdictBandProps {
  decision: VerificationDecision;
  consequence: string;
  explanation: string;
  invoiceId: string;
  reasonCodes: string[];
  gates: Gate[];
  /** Right-hand summary column (amount at stake, totals, timestamp). */
  aside?: React.ReactNode;
  className?: string;
}

/**
 * Full-width verdict record. Left edge carries a 2px tone bar; the verdict word
 * is set large in display type; consequence states what it means for money.
 */
export const VerdictBand: React.FC<VerdictBandProps> = ({
  decision,
  consequence,
  explanation,
  invoiceId,
  reasonCodes,
  gates,
  aside,
  className,
}) => {
  const { label, tone, Icon } = resolveStatus(decision, "verdict");
  const t = toneStyles[tone];

  return (
    <section aria-label="Verification verdict" className={cn("panel relative overflow-hidden animate-fade-in", className)}>
      <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-[2px]", t.dot)} />

      <div className="flex flex-col lg:flex-row">
        <div className="flex-1 min-w-0 pl-5 sm:pl-7 pr-5 sm:pr-6 pt-5 pb-5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-foreground-muted">
            <span className="eyebrow">Verdict</span>
            <span aria-hidden="true" className="text-foreground-muted/50">/</span>
            <CopyableValue value={invoiceId} label="Copy invoice ID" className="max-w-full" />
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1 ring-inset", t.badge)}>
              <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
            </span>
            <h2 className={cn("font-medium leading-none tracking-[-0.035em] text-[28px] sm:text-[32px]", t.text)}>
              {label}
            </h2>
          </div>

          <p className="mt-3.5 text-[15px] font-medium text-foreground tracking-[-0.01em]">{consequence}</p>
          <p className="mt-1 text-[13px] text-foreground-secondary leading-relaxed max-w-2xl">{explanation}</p>

          {reasonCodes.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-foreground-muted mr-1">Reason codes</span>
              {reasonCodes.map((code) => (
                <ReasonCodeChip key={code} code={code} size="md" />
              ))}
            </div>
          )}
        </div>

        {aside && (
          <div className="shrink-0 lg:w-[300px] border-t lg:border-t-0 lg:border-l border-border bg-surface-2/50 px-5 py-5">
            {aside}
          </div>
        )}
      </div>

      <ol className="grid grid-cols-1 sm:grid-cols-3 border-t border-border divide-y sm:divide-y-0 sm:divide-x divide-border/70">
        {gates.map((gate, i) => {
          const g = GATE_STYLE[gate.state];
          const gt = toneStyles[g.tone];
          const failed = gate.state === "fail" || gate.state === "blocked";
          return (
            <li
              key={gate.key}
              className={cn("relative flex items-center gap-3 pl-5 sm:pl-7 pr-8 py-3.5", failed && "bg-danger/[0.035]")}
            >
              <span
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-md ring-1 ring-inset shrink-0",
                  gt.badge
                )}
              >
                <g.Icon className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-2">
                  <span className="text-xs text-foreground-muted tabular-nums">{i + 1}</span>
                  <span className="text-[13px] font-medium text-foreground truncate">{gate.label}</span>
                </span>
                <span className="block text-xs text-foreground-muted tabular-nums mt-0.5">
                  <span className={cn("font-medium", gt.text)}>{g.word}</span>
                  <span aria-hidden="true"> · </span>
                  {gate.detail}
                </span>
              </span>
              {i < gates.length - 1 && (
                <ChevronRight
                  aria-hidden="true"
                  className="hidden sm:block absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-muted/60"
                />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};
