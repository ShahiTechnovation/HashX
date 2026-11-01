import React from "react";
import { Check, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { HSPStatus } from "@/types/domain";

/**
 * Settlement finality track. Renders the HSP lifecycle as discrete stages
 * so `safe` and `finalized` can never be visually confused:
 *   - Safe uses an amber, half-filled node and the label "Not final".
 *   - Finalized is the only stage rendered with a solid mint node.
 */
const STAGES = [
  { key: "submitted", label: "Submitted" },
  { key: "processing", label: "Processing" },
  { key: "included", label: "Included" },
  { key: "safe", label: "Safe", sub: "Not final" },
  { key: "finalized", label: "Finalized", sub: "Irreversible" },
] as const;

function stageIndex(status: HSPStatus): number {
  switch (status) {
    case "payment-submitted":
      return 0;
    case "payment-verified":
    case "payment-processing":
      return 1;
    case "payment-included":
      return 2;
    case "payment-safe":
      return 3;
    case "payment-finalized":
      return 4;
    default:
      return -1;
  }
}

interface FinalityTrackProps {
  status: HSPStatus;
  className?: string;
  compact?: boolean;
}

export const FinalityTrack: React.FC<FinalityTrackProps> = ({ status, className, compact }) => {
  const isFailed = status === "payment-failed";
  const isRecovery = status === "payment-timeout";
  const current = stageIndex(status);
  const isFinal = status === "payment-finalized";

  return (
    <div className={cn("w-full", className)}>
      <ol className="grid grid-cols-5">
        {STAGES.map((stage, i) => {
          const reached = current >= i;
          const isCurrent = current === i;
          const isSafeStage = stage.key === "safe";
          const isFinalStage = stage.key === "finalized";

          let node: React.ReactNode;
          if ((isFailed || isRecovery) && i === Math.max(current, 0)) {
            node = (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-danger/15 ring-1 ring-danger/60 text-danger">
                {isRecovery ? <RotateCcw className="w-2.5 h-2.5" strokeWidth={3} /> : <X className="w-2.5 h-2.5" strokeWidth={3} />}
              </span>
            );
          } else if (isFinalStage && isFinal) {
            node = (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-success text-background">
                <Check className="w-3 h-3" strokeWidth={3} />
              </span>
            );
          } else if (isSafeStage && reached) {
            node = (
              <span className="relative flex items-center justify-center w-5 h-5 rounded-full ring-1 ring-warning/70 bg-background overflow-hidden">
                <span className="absolute inset-y-0 left-0 w-1/2 bg-warning/70" />
              </span>
            );
          } else if (reached) {
            node = (
              <span
                className={cn(
                  "flex items-center justify-center w-5 h-5 rounded-full ring-1",
                  isCurrent ? "bg-info/15 ring-info/60 text-info" : "bg-surface-3 ring-border-strong text-foreground-secondary"
                )}
              >
                {isCurrent ? <span className="w-1.5 h-1.5 rounded-full bg-info" /> : <Check className="w-2.5 h-2.5" strokeWidth={3} />}
              </span>
            );
          } else {
            node = <span className="w-5 h-5 rounded-full ring-1 ring-border bg-background" />;
          }

          const connectorDone = current > i && !(isFailed || isRecovery);
          const connectorTone =
            connectorDone && i + 1 === 4 && isFinal
              ? "bg-success/60"
              : connectorDone && i + 1 === 3
              ? "bg-warning/50"
              : connectorDone
              ? "bg-border-strong"
              : "bg-border";

          return (
            <li key={stage.key} className="relative flex flex-col items-center text-center">
              {i < STAGES.length - 1 && (
                <span aria-hidden="true" className={cn("absolute top-2.5 left-1/2 w-full h-px", connectorTone)} />
              )}
              <span className="relative z-10">{node}</span>
              {!compact && (
                <span className="mt-2 flex flex-col items-center">
                  <span
                    className={cn(
                      "text-2xs font-medium",
                      isFinalStage && isFinal
                        ? "text-success"
                        : isSafeStage && reached
                        ? "text-warning"
                        : reached
                        ? "text-foreground-secondary"
                        : "text-foreground-muted/70"
                    )}
                  >
                    {stage.label}
                  </span>
                  {"sub" in stage && (
                    <span className="text-[10px] text-foreground-muted/80 mt-px">{stage.sub}</span>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {(isFailed || isRecovery) && !compact && (
        <p className="mt-3 text-xs text-danger">
          {isRecovery
            ? "Network timeout — query with existing IDs; do not recreate the order."
            : "Payment failed on the HSP rail. Reason preserved in audit trail."}
        </p>
      )}
    </div>
  );
};
