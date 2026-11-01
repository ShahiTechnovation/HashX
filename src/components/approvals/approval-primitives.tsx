"use client";

import React, { useEffect, useState } from "react";
import { Clock, ShieldCheck, ShieldAlert, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneStyles, type Tone } from "@/components/ui/StatusBadge";
import { formatExpiryCountdown } from "@/lib/formatters";
import { PaymentAttempt, PaymentAttemptState } from "@/types/domain";

/* ------------------------------------------------------------------ */
/* Stage classification                                                */
/* ------------------------------------------------------------------ */

export type ApprovalGroup = "signing" | "submission" | "completed";

export function getApprovalGroup(state: PaymentAttemptState): ApprovalGroup {
  if (state === "AWAITING_SIGNATURE_APPROVAL") return "signing";
  if (state === "AWAITING_SUBMISSION_APPROVAL") return "submission";
  return "completed";
}

export function isAwaitingApproval(state: PaymentAttemptState): boolean {
  return state === "AWAITING_SIGNATURE_APPROVAL" || state === "AWAITING_SUBMISSION_APPROVAL";
}

/** Attribution is only treated as verified when both the attempt and its approval summary agree. */
export function isAttributionVerified(attempt: PaymentAttempt): boolean {
  return Boolean(attempt.attributionVerified && attempt.approvalSummary?.attributionVerified !== false);
}

/** Merchant display name. "HashX Global" is a signing-domain constant, not a display name. */
export function merchantDisplayName(name: string | undefined): string {
  if (!name) return "Unnamed merchant";
  return name === "HashX Global" ? "HashX" : name;
}

/* ------------------------------------------------------------------ */
/* Quote expiry                                                        */
/* ------------------------------------------------------------------ */

/** HSP quotes are valid for 5 minutes; under this threshold the quote is "expiring". */
export const QUOTE_WARNING_SECONDS = 5 * 60;

export type ExpiryUrgency = "ok" | "soon" | "expired";

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

export function getQuoteExpiry(iso: string, now: Date) {
  const info = formatExpiryCountdown(iso, now);
  const urgency: ExpiryUrgency = info.isExpired
    ? "expired"
    : info.secondsRemaining < QUOTE_WARNING_SECONDS
    ? "soon"
    : "ok";
  const expiredFor = info.isExpired ? Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000)) : 0;
  const tone: Tone = urgency === "expired" ? "danger" : urgency === "soon" ? "warning" : "neutral";
  const label = info.isExpired
    ? Number.isFinite(expiredFor)
      ? `Expired ${formatDuration(expiredFor)} ago`
      : "Expired"
    : `${formatDuration(info.secondsRemaining)} left`;
  return { ...info, urgency, tone, label };
}

/** Re-renders every `intervalMs` so countdowns stay live. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export const QuoteExpiryTag: React.FC<{ iso: string; now: Date; className?: string }> = ({ iso, now, className }) => {
  const q = getQuoteExpiry(iso, now);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs tabular-nums whitespace-nowrap",
        q.urgency === "ok" ? "text-foreground-secondary" : toneStyles[q.tone].text,
        className
      )}
    >
      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      {q.label}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* Small badges                                                        */
/* ------------------------------------------------------------------ */

export const ToneBadge: React.FC<{
  tone: Tone;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
}> = ({ tone, icon: Icon, children, size = "md", className }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-[5px] ring-1 ring-inset font-medium whitespace-nowrap",
      toneStyles[tone].badge,
      size === "sm" ? "h-5 px-1.5 text-2xs gap-1" : "h-6 px-2 text-xs gap-1.5",
      className
    )}
  >
    {Icon && <Icon className={size === "sm" ? "w-3 h-3 shrink-0" : "w-3.5 h-3.5 shrink-0"} strokeWidth={2.25} />}
    {children}
  </span>
);

export const AttributionTag: React.FC<{ verified: boolean; className?: string }> = ({ verified, className }) => (
  <span className={cn("inline-flex items-center gap-1 text-2xs", verified ? "text-success" : "text-danger", className)}>
    {verified ? <ShieldCheck className="w-3 h-3" aria-hidden="true" /> : <ShieldAlert className="w-3 h-3" aria-hidden="true" />}
    {verified ? "Attribution verified" : "Attribution unverified"}
  </span>
);

/* ------------------------------------------------------------------ */
/* Two-stage stepper                                                   */
/* ------------------------------------------------------------------ */

type StepState = "complete" | "active" | "blocked" | "pending";

interface StepDef {
  index: string;
  title: string;
  description: string;
  state: StepState;
}

export const AuthorizationStepper: React.FC<{
  state: PaymentAttemptState;
  quoteExpired: boolean;
  settlementSlot?: React.ReactNode;
}> = ({ state, quoteExpired, settlementSlot }) => {
  const group = getApprovalGroup(state);
  const stage1: StepState =
    group === "signing" ? (quoteExpired ? "blocked" : "active") : "complete";
  const stage2: StepState =
    group === "signing" ? "pending" : group === "submission" ? (quoteExpired ? "blocked" : "active") : "complete";

  const steps: StepDef[] = [
    {
      index: "1",
      title: "Approve signing",
      description: "Authorize the wallet to sign the exact payload",
      state: stage1,
    },
    {
      index: "2",
      title: "Approve submission",
      description: "Authorize broadcast of the signed payment to HSP",
      state: stage2,
    },
  ];

  return (
    <ol className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] divide-y sm:divide-y-0 sm:divide-x divide-border">
      {steps.map((step) => (
        <li
          key={step.index}
          aria-current={step.state === "active" ? "step" : undefined}
          className={cn(
            "relative flex items-start gap-3 px-4 sm:px-5 py-3.5",
            step.state === "active" && "bg-primary/[0.04]"
          )}
        >
          {step.state === "active" && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
          {step.state === "blocked" && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-danger/70" />}
          <StepNode state={step.state} index={step.index} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-2xs text-foreground-muted">Stage {step.index} of 2</span>
              <StepStateLabel state={step.state} />
            </div>
            <div
              className={cn(
                "text-[13px] font-medium mt-0.5",
                step.state === "pending" ? "text-foreground-muted" : "text-foreground"
              )}
            >
              {step.title}
            </div>
            <p className="text-xs text-foreground-muted mt-0.5 leading-relaxed">{step.description}</p>
          </div>
        </li>
      ))}
      <li className="flex flex-col justify-center gap-1.5 px-4 sm:px-5 py-3.5 sm:min-w-[180px]">
        <span className="text-2xs text-foreground-muted">Then</span>
        {settlementSlot ?? <span className="text-[13px] text-foreground-muted">HSP settlement</span>}
      </li>
    </ol>
  );
};

const StepNode: React.FC<{ state: StepState; index: string }> = ({ state, index }) => {
  const base = "flex items-center justify-center w-6 h-6 rounded-full shrink-0 text-2xs font-medium tabular-nums mt-0.5";
  if (state === "complete")
    return (
      <span className={cn(base, "bg-success/15 ring-1 ring-success/40 text-success")}>
        <Check className="w-3 h-3" strokeWidth={3} />
      </span>
    );
  if (state === "active") return <span className={cn(base, "bg-primary text-white")}>{index}</span>;
  if (state === "blocked") return <span className={cn(base, "bg-danger/15 ring-1 ring-danger/50 text-danger")}>{index}</span>;
  return <span className={cn(base, "ring-1 ring-border text-foreground-muted")}>{index}</span>;
};

const StepStateLabel: React.FC<{ state: StepState }> = ({ state }) => {
  const map: Record<StepState, { label: string; cls: string }> = {
    complete: { label: "Approved", cls: "text-success" },
    active: { label: "Awaiting you", cls: "text-primary-light" },
    blocked: { label: "Quote expired", cls: "text-danger" },
    pending: { label: "Locked", cls: "text-foreground-muted/80" },
  };
  const m = map[state];
  return <span className={cn("text-2xs font-medium", m.cls)}>· {m.label}</span>;
};
