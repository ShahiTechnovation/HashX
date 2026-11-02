"use client";

import React from "react";
import { Check, CircleDashed, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneStyles } from "@/components/ui/StatusBadge";
import type { LiveInvoice } from "@/lib/live/types";

export type StepState = "idle" | "active" | "done" | "error";
export interface StepItem {
  key: string;
  label: string;
  state: StepState;
  detail?: string;
}

/** Visible status for multi-step wallet/API flows. */
export const StepList: React.FC<{ steps: StepItem[]; className?: string }> = ({ steps, className }) => (
  <ol className={cn("space-y-2", className)}>
    {steps.map((s) => (
      <li key={s.key} className="flex items-start gap-2.5 text-xs">
        <span className="mt-px shrink-0">
          {s.state === "done" ? (
            <Check className="w-3.5 h-3.5 text-success" />
          ) : s.state === "active" ? (
            <Loader2 className="w-3.5 h-3.5 text-primary-light animate-spin" />
          ) : s.state === "error" ? (
            <X className="w-3.5 h-3.5 text-danger" />
          ) : (
            <CircleDashed className="w-3.5 h-3.5 text-foreground-muted" />
          )}
        </span>
        <span className="min-w-0">
          <span className={cn(s.state === "idle" ? "text-foreground-muted" : s.state === "error" ? "text-danger" : "text-foreground")}>{s.label}</span>
          {s.detail && <span className="block text-2xs text-foreground-muted mt-0.5 break-all">{s.detail}</span>}
        </span>
      </li>
    ))}
  </ol>
);

/** Advances a step list: marks `key` with `state`, optionally with detail. */
export function setStep(steps: StepItem[], key: string, state: StepState, detail?: string): StepItem[] {
  return steps.map((s) => (s.key === key ? { ...s, state, detail: detail !== undefined ? detail : s.detail } : s));
}

export const RoleBadge: React.FC<{ role: LiveInvoice["viewerRole"]; className?: string }> = ({ role, className }) => (
  <span
    className={cn(
      "inline-flex items-center h-5 px-1.5 rounded-[5px] ring-1 ring-inset text-2xs font-medium",
      role === "seller" ? toneStyles.accent.badge : role === "buyer" ? toneStyles.info.badge : toneStyles.neutral.badge,
      className
    )}
  >
    {role === "seller" ? "Seller" : role === "buyer" ? "Buyer" : "Not a participant"}
  </span>
);

/** Legacy (protocol v1) invoices are readable but can never be paid through the v2 flow. */
export function isLegacy(inv: LiveInvoice): boolean {
  return inv.legacy || inv.protocolVersion < 2;
}

export const LegacyBadge: React.FC<{ className?: string }> = ({ className }) => (
  <span className={cn("inline-flex items-center h-5 px-1.5 rounded-[5px] ring-1 ring-inset text-2xs font-medium", toneStyles.neutral.badge, className)}>
    Legacy v1 — not payable
  </span>
);

export function counterpartyOf(inv: LiveInvoice): { label: string; wallet: string | null } {
  if (inv.viewerRole === "buyer") return { label: inv.sellerDisplayName || "Seller", wallet: inv.sellerWallet };
  return { label: "Buyer", wallet: inv.buyerWallet };
}
