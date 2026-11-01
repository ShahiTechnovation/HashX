import React from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  X,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Minus,
  RotateCcw,
  CircleDashed,
  type LucideIcon,
} from "lucide-react";
import { InvoiceStatus, HSPStatus, CheckStatus, VerificationDecision } from "@/types/domain";
import { getInvoiceStatusMeta, getHSPStatusMeta } from "@/lib/formatters";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

export const toneStyles: Record<Tone, { badge: string; text: string; dot: string; bg: string; border: string }> = {
  success: { badge: "bg-success/10 text-success ring-success/20", text: "text-success", dot: "bg-success", bg: "bg-success/[0.06]", border: "border-success/25" },
  warning: { badge: "bg-warning/10 text-warning ring-warning/20", text: "text-warning", dot: "bg-warning", bg: "bg-warning/[0.06]", border: "border-warning/25" },
  danger: { badge: "bg-danger/10 text-danger ring-danger/20", text: "text-danger", dot: "bg-danger", bg: "bg-danger/[0.06]", border: "border-danger/25" },
  info: { badge: "bg-info/10 text-info ring-info/20", text: "text-info", dot: "bg-info", bg: "bg-info/[0.06]", border: "border-info/25" },
  neutral: { badge: "bg-surface-3/80 text-foreground-secondary ring-border-strong/60", text: "text-foreground-secondary", dot: "bg-foreground-muted", bg: "bg-surface-2", border: "border-border" },
  accent: { badge: "bg-primary/10 text-primary-light ring-primary/25", text: "text-primary-light", dot: "bg-primary", bg: "bg-primary/[0.06]", border: "border-primary/25" },
};

/** Compact HSP labels for badges. `payment-safe` must always read as NOT final. */
const HSP_BADGE_LABEL: Record<string, string> = {
  "payment-submitted": "Submitted",
  "payment-verified": "Verified",
  "payment-processing": "Processing",
  "payment-included": "Included",
  "payment-safe": "Safe · Not final",
  "payment-finalized": "Finalized",
  "payment-timeout": "Timeout · Recovery",
  "payment-failed": "Failed",
  unknown: "Unknown",
};

export function resolveStatus(
  status: string,
  type: "invoice" | "hsp" | "check" | "verdict" | "generic"
): { label: string; tone: Tone; Icon: LucideIcon } {
  if (type === "invoice") {
    const meta = getInvoiceStatusMeta(status as InvoiceStatus);
    const map: Record<string, { tone: Tone; Icon: LucideIcon }> = {
      success: { tone: "success", Icon: Check },
      warning: { tone: "warning", Icon: Clock },
      danger: { tone: "danger", Icon: X },
    };
    const m = map[meta.variant] ?? { tone: "neutral" as Tone, Icon: CircleDashed };
    if (status === "SIGNED" || status === "DELIVERED") return { label: meta.label, tone: "info", Icon: Clock };
    return { label: meta.label, ...m };
  }

  if (type === "hsp") {
    const meta = getHSPStatusMeta(status as HSPStatus);
    const label = HSP_BADGE_LABEL[status] ?? meta.label;
    switch (meta.category) {
      case "finalized":
        return { label, tone: "success", Icon: Check };
      case "safe":
        return { label, tone: "warning", Icon: ShieldCheck };
      case "pending":
        return { label, tone: "info", Icon: Clock };
      case "recovery":
        return { label, tone: "danger", Icon: RotateCcw };
      case "failed":
        return { label, tone: "danger", Icon: AlertTriangle };
      default:
        return { label, tone: "neutral", Icon: HelpCircle };
    }
  }

  if (type === "verdict") {
    if (status === "PASS") return { label: "Verified", tone: "success", Icon: ShieldCheck };
    if (status === "FAIL") return { label: "Rejected", tone: "danger", Icon: ShieldAlert };
    return { label: "Pending", tone: "warning", Icon: Clock };
  }

  if (type === "check") {
    if (status === "PASS") return { label: "Pass", tone: "success", Icon: Check };
    if (status === "FAIL") return { label: "Fail", tone: "danger", Icon: X };
    return { label: "Skipped", tone: "neutral", Icon: Minus };
  }

  return { label: status, tone: "neutral", Icon: HelpCircle };
}

interface StatusBadgeProps {
  status: InvoiceStatus | HSPStatus | CheckStatus | VerificationDecision | string;
  type?: "invoice" | "hsp" | "check" | "verdict" | "generic";
  size?: "sm" | "md";
  className?: string;
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = "generic",
  size = "md",
  className,
  showIcon = true,
}) => {
  const { label, tone, Icon } = resolveStatus(status, type);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[5px] ring-1 ring-inset font-medium whitespace-nowrap select-none",
        toneStyles[tone].badge,
        size === "sm" ? "h-5 px-1.5 text-2xs gap-1" : "h-6 px-2 text-xs gap-1.5",
        className
      )}
    >
      {showIcon && <Icon className={size === "sm" ? "w-3 h-3 shrink-0" : "w-3.5 h-3.5 shrink-0"} strokeWidth={2.25} aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
};

/** Minimal dot + label, for dense tables and inline meta. */
export const StatusDot: React.FC<{ tone: Tone; label?: React.ReactNode; pulse?: boolean; className?: string }> = ({
  tone,
  label,
  pulse,
  className,
}) => (
  <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
    <span className="relative flex w-1.5 h-1.5">
      {pulse && <span className={cn("absolute inset-0 rounded-full opacity-60 animate-ping", toneStyles[tone].dot)} />}
      <span className={cn("relative w-1.5 h-1.5 rounded-full", toneStyles[tone].dot)} />
    </span>
    {label && <span className="text-foreground-secondary">{label}</span>}
  </span>
);
