import React from "react";
import { Info, AlertTriangle, ShieldAlert, CheckCircle2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CalloutTone = "info" | "warning" | "danger" | "success" | "neutral";

const toneMap: Record<CalloutTone, { wrap: string; icon: string; Icon: LucideIcon }> = {
  info: { wrap: "border-info/20 bg-info/[0.05]", icon: "text-info", Icon: Info },
  warning: { wrap: "border-warning/25 bg-warning/[0.05]", icon: "text-warning", Icon: AlertTriangle },
  danger: { wrap: "border-danger/25 bg-danger/[0.05]", icon: "text-danger", Icon: ShieldAlert },
  success: { wrap: "border-success/20 bg-success/[0.05]", icon: "text-success", Icon: CheckCircle2 },
  neutral: { wrap: "border-border bg-surface-2/50", icon: "text-foreground-muted", Icon: Info },
};

interface CalloutProps {
  tone?: CalloutTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}

export const Callout: React.FC<CalloutProps> = ({ tone = "info", title, children, icon, actions, className }) => {
  const t = toneMap[tone];
  const Icon = icon ?? t.Icon;
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={cn("flex gap-3 rounded-lg border px-3.5 py-3", t.wrap, className)}>
      <Icon className={cn("w-4 h-4 mt-px shrink-0", t.icon)} aria-hidden="true" />
      <div className="flex-1 min-w-0 text-[13px] leading-relaxed">
        {title && <div className="font-medium text-foreground">{title}</div>}
        {children && <div className={cn("text-foreground-secondary", title && "mt-0.5 text-xs")}>{children}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 self-center">{actions}</div>}
    </div>
  );
};
