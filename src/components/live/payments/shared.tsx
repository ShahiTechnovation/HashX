"use client";

/**
 * Shared helpers for connected-mode payment views (approvals + settlements).
 * Everything displayed here comes verbatim from the HashX backend.
 */
import React from "react";
import { Check, X } from "lucide-react";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/formatters";
import { explorerAddressUrl, findNetwork } from "@shared/networks";
import type { LivePayment, LivePaymentState } from "@/lib/live/types";

export const PRE_SUBMISSION_STATES: readonly LivePaymentState[] = [
  "AWAITING_SIGNATURE_APPROVAL",
  "AWAITING_SUBMISSION_APPROVAL",
  "AUTHORIZED",
];

export const IN_FLIGHT_STATES: readonly LivePaymentState[] = ["SUBMITTED", "INCLUDED"];
export const SETTLED_STATES: readonly LivePaymentState[] = ["CONFIRMED", "FINALIZED"];
export const POST_SUBMISSION_STATES: readonly LivePaymentState[] = [
  "SUBMITTED",
  "INCLUDED",
  "CONFIRMED",
  "FINALIZED",
  "FAILED",
  "DROPPED",
  "TIMEOUT",
];

export function sameAddr(a: string | null | undefined, b: string | null | undefined) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

export function fmtTime(iso: string | null | undefined) {
  return iso ? formatTimestamp(iso) : "—";
}

/** Human countdown for an ISO deadline. */
export function countdown(iso: string | null | undefined, now: Date): { text: string; expired: boolean } {
  if (!iso) return { text: "No expiry recorded", expired: false };
  const ms = new Date(iso).getTime() - now.getTime();
  if (Number.isNaN(ms)) return { text: iso, expired: false };
  if (ms <= 0) return { text: "Expired", expired: true };
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return { text: `${d > 0 ? `${d}d ` : ""}${pad(h)}:${pad(m)}:${pad(s)} remaining`, expired: false };
}

/** Required confirmations parsed from a backend policy string such as "confirmations:12" or "confirmations>=12". */
export function requiredConfirmations(policy: string | null | undefined): number | null {
  if (!policy) return null;
  const m = /confirmations\D*(\d+)/i.exec(policy);
  return m ? Number(m[1]) : null;
}

export function networkLabel(chainId: number | null | undefined, fallback?: string | null) {
  const net = chainId ? findNetwork(chainId) : undefined;
  return net?.name ?? fallback ?? (chainId ? `chain ${chainId}` : "—");
}

/** Full-length digest / hash with copy affordance. */
export const Digest: React.FC<{ value: string | null | undefined; className?: string }> = ({ value, className }) =>
  value ? (
    <CopyableValue value={value} displayText={value} className={cn("max-w-full", className)} />
  ) : (
    <span className="text-foreground-muted">—</span>
  );

/** Address with copy + explorer link on the given chain. */
export const AddressValue: React.FC<{ address: string | null | undefined; chainId: number | null | undefined }> = ({ address, chainId }) =>
  address ? (
    <CopyableValue value={address} displayText={address} explorerUrl={(chainId && explorerAddressUrl(chainId, address)) || undefined} className="max-w-full" />
  ) : (
    <span className="text-foreground-muted">—</span>
  );

export type StepStatus = "done" | "current" | "pending" | "failed";

/** Horizontal step indicator for the approval workflow. */
export const Stepper: React.FC<{ steps: Array<{ title: string; description: string; status: StepStatus }> }> = ({ steps }) => (
  <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    {steps.map((s, i) => (
      <li
        key={s.title}
        className={cn(
          "flex items-start gap-3 rounded-md border p-3",
          s.status === "current" && "border-primary/40 bg-primary/[0.05]",
          s.status === "done" && "border-border bg-surface-2/40",
          s.status === "pending" && "border-border",
          s.status === "failed" && "border-danger/30 bg-danger/[0.04]"
        )}
      >
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-semibold ring-1",
            s.status === "done" && "bg-success/10 text-success ring-success/30",
            s.status === "current" && "bg-primary/15 text-primary-light ring-primary/50",
            s.status === "pending" && "bg-background text-foreground-muted ring-border",
            s.status === "failed" && "bg-danger/10 text-danger ring-danger/40"
          )}
        >
          {s.status === "done" ? <Check className="h-3 w-3" strokeWidth={3} /> : s.status === "failed" ? <X className="h-3 w-3" strokeWidth={3} /> : i + 1}
        </span>
        <div className="min-w-0">
          <div className={cn("text-[13px] font-medium", s.status === "pending" ? "text-foreground-muted" : "text-foreground")}>{s.title}</div>
          <p className="mt-0.5 text-2xs leading-relaxed text-foreground-muted">{s.description}</p>
        </div>
      </li>
    ))}
  </ol>
);

/** Amount as the backend states it: raw integer units plus the integer-math decimal rendering. */
export function paymentDecimals(p: Pick<LivePayment, "tokenDecimals">) {
  return p.tokenDecimals ?? 6;
}
