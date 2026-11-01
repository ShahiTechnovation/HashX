import React from "react";
import { HSPStatus, PaymentAttempt } from "@/types/domain";
import { formatTimestamp } from "@/lib/formatters";
import type { TimelineItem } from "@/components/ui/Timeline";

export type SettlementGroup = "all" | "inflight" | "safe" | "finalized" | "failed";

/** Attempts still awaiting human authorization have not been broadcast, whatever their HSP field says. */
export function isPreAuthorization(p: PaymentAttempt): boolean {
  return p.state === "AWAITING_SIGNATURE_APPROVAL" || p.state === "AWAITING_SUBMISSION_APPROVAL";
}

/**
 * Settlement grouping. `payment-safe` gets its own bucket — it is on-chain
 * but NOT final, and must never be counted alongside finalized payments.
 */
export function getSettlementGroup(p: PaymentAttempt): Exclude<SettlementGroup, "all"> | null {
  if (isPreAuthorization(p)) return null;
  switch (p.hspStatus) {
    case "payment-finalized":
      return "finalized";
    case "payment-safe":
      return "safe";
    case "payment-failed":
    case "payment-timeout":
      return "failed";
    default:
      return "inflight";
  }
}

const STAGE_ORDER: Partial<Record<HSPStatus, number>> = {
  "payment-submitted": 0,
  "payment-verified": 1,
  "payment-processing": 1,
  "payment-included": 2,
  "payment-safe": 3,
  "payment-finalized": 4,
};

const short = (iso: string) => formatTimestamp(iso).replace(" UTC", "");

/**
 * Derived status history. Only `createdAt` and `updatedAt` are recorded on the
 * attempt, so intermediate transitions carry no timestamp rather than an invented one.
 */
export function buildStatusHistory(p: PaymentAttempt): TimelineItem[] {
  const pre = isPreAuthorization(p);
  const failed = p.hspStatus === "payment-failed";
  const timeout = p.hspStatus === "payment-timeout";
  const reached = pre ? -1 : STAGE_ORDER[p.hspStatus] ?? (failed || timeout ? 0 : -1);
  const latest = short(p.updatedAt);

  const items: TimelineItem[] = [
    {
      title: "Payment prepared",
      description: "HSP order created with flow and payment-request IDs",
      time: short(p.createdAt),
      state: "done",
    },
    {
      title: "Human authorization",
      description: pre
        ? p.state === "AWAITING_SIGNATURE_APPROVAL"
          ? "Awaiting stage 1 · signing approval"
          : "Awaiting stage 2 · submission approval"
        : "Both stages approved",
      state: pre ? "current" : "done",
    },
  ];

  if (pre) {
    items.push({ title: "Submitted to HSP", state: "pending" });
    items.push({ title: "Finalized on HashKey Chain", state: "pending" });
    return items;
  }

  items.push({
    title: "Submitted to HSP",
    state: "done",
    time: reached === 0 && !failed && !timeout ? latest : undefined,
  });

  if (failed || timeout) {
    items.push({
      title: timeout ? "Network timeout · recovery required" : "Payment failed",
      description: timeout
        ? "Query with the existing flow and payment-request IDs. Do not recreate the order."
        : p.failureReason || "Reason preserved in the audit trail.",
      time: latest,
      state: "failed",
    });
    return items;
  }

  items.push({
    title: "Included in block",
    state: reached >= 2 ? "done" : reached === 1 ? "current" : "pending",
    description: reached === 1 ? "Broadcasting and awaiting inclusion" : undefined,
    time: reached === 2 ? latest : undefined,
  });

  items.push({
    title: "Safe depth reached",
    description: reached === 3 ? "On-chain at safe depth — not final, still reversible" : "Not final",
    state: reached === 3 ? "warning" : reached > 3 ? "done" : "pending",
    time: reached === 3 ? latest : undefined,
  });

  items.push({
    title: "Finalized",
    description: reached === 4 ? "Irreversible finality on HashKey Chain" : undefined,
    state: reached === 4 ? "done" : "pending",
    time: reached === 4 ? latest : undefined,
  });

  items.push({
    title: "Evidence anchored",
    description: p.evidenceRegistryTx ? "Commitment written to the evidence registry" : "Written after finality",
    state: p.evidenceRegistryTx ? "done" : "pending",
  });

  return items;
}

/** Placeholder text for a not-yet-available on-chain value. */
export const PendingValue: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-xs text-foreground-muted">{children}</span>
);
