import React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock, AlertTriangle, ShieldCheck, ShieldAlert, HelpCircle } from "lucide-react";
import { InvoiceStatus, HSPStatus, CheckStatus, VerificationDecision } from "@/types/domain";
import { getInvoiceStatusMeta, getHSPStatusMeta } from "@/lib/formatters";

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
  let label = status;
  let variant: "success" | "warning" | "danger" | "info" | "secondary" = "secondary";
  let Icon = HelpCircle;

  if (type === "invoice") {
    const meta = getInvoiceStatusMeta(status as InvoiceStatus);
    label = meta.label;
    if (meta.variant === "success") {
      variant = "success";
      Icon = CheckCircle2;
    } else if (meta.variant === "warning") {
      variant = "warning";
      Icon = Clock;
    } else if (meta.variant === "danger") {
      variant = "danger";
      Icon = XCircle;
    } else {
      variant = "secondary";
      Icon = Clock;
    }
  } else if (type === "hsp") {
    const meta = getHSPStatusMeta(status as HSPStatus);
    label = meta.label;
    if (meta.category === "finalized") {
      variant = "success";
      Icon = CheckCircle2;
    } else if (meta.category === "safe") {
      variant = "warning";
      Icon = ShieldCheck;
    } else if (meta.category === "pending") {
      variant = "info";
      Icon = Clock;
    } else if (meta.category === "failed" || meta.category === "recovery") {
      variant = "danger";
      Icon = AlertTriangle;
    }
  } else if (type === "verdict") {
    if (status === "PASS") {
      label = "PASS — VERIFIED";
      variant = "success";
      Icon = ShieldCheck;
    } else if (status === "FAIL") {
      label = "FAIL — REJECTED";
      variant = "danger";
      Icon = ShieldAlert;
    } else {
      label = "PENDING CHECKS";
      variant = "warning";
      Icon = Clock;
    }
  } else if (type === "check") {
    if (status === "PASS") {
      label = "PASS";
      variant = "success";
      Icon = CheckCircle2;
    } else if (status === "FAIL") {
      label = "FAIL";
      variant = "danger";
      Icon = XCircle;
    } else {
      label = "SKIPPED";
      variant = "secondary";
      Icon = Clock;
    }
  }

  const variantStyles = {
    success: "bg-success/10 text-success border-success/30",
    warning: "bg-warning/10 text-warning border-warning/30",
    danger: "bg-danger/10 text-danger border-danger/30",
    info: "bg-info/10 text-info border-info/30",
    secondary: "bg-surface-3 text-foreground-secondary border-border",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-xs font-medium gap-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-mono tracking-tight select-none",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {showIcon && <Icon className={size === "sm" ? "w-3 h-3 shrink-0" : "w-3.5 h-3.5 shrink-0"} aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
};
