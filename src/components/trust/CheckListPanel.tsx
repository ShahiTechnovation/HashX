import React from "react";
import { Check, X, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CheckStatus, VerificationCheckDetail, VerificationReasonCode } from "@/types/domain";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EvidenceCard } from "@/components/ui/EvidenceCard";
import { countChecks, resolveCheckDetail } from "./evaluate";

/** "6/6 passed" — icon + label + tone, never color alone. */
export const PassCount: React.FC<{ checks: Record<string, CheckStatus>; className?: string }> = ({ checks, className }) => {
  const { total, passed, failed, skipped } = countChecks(checks);
  const tone = failed > 0 ? "danger" : skipped > 0 ? "neutral" : "success";
  const Icon = failed > 0 ? X : skipped > 0 ? Minus : Check;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 h-6 px-2 rounded-[5px] ring-1 ring-inset text-xs font-medium tabular-nums whitespace-nowrap",
        tone === "danger" && "bg-danger/10 text-danger ring-danger/20",
        tone === "success" && "bg-success/10 text-success ring-success/20",
        tone === "neutral" && "bg-surface-3/80 text-foreground-secondary ring-border-strong/60",
        className
      )}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden="true" />
      {passed}/{total} passed
      {failed > 0 && <span className="text-danger/80 font-normal">· {failed} failed</span>}
      {skipped > 0 && failed === 0 && <span className="text-foreground-muted font-normal">· {skipped} skipped</span>}
    </span>
  );
};

interface CheckListPanelProps<K extends string> {
  title: React.ReactNode;
  description: React.ReactNode;
  icon: React.ReactNode;
  keys: K[];
  checks: Record<K, CheckStatus>;
  details: Record<K, VerificationCheckDetail>;
  reasonCodes: VerificationReasonCode[];
  id?: string;
}

/** Numbered evidence list: one panel, hairline rows, failed rows auto-expand. */
export function CheckListPanel<K extends string>({
  title,
  description,
  icon,
  keys,
  checks,
  details,
  reasonCodes,
  id,
}: CheckListPanelProps<K>) {
  return (
    <Panel as="section" id={id} aria-label={typeof title === "string" ? title : undefined}>
      <PanelHeader title={title} description={description} icon={icon} actions={<PassCount checks={checks} />} />
      <div className="divide-y divide-border/60">
        {keys.map((key, i) => {
          const detail = resolveCheckDetail(checks[key], details[key], reasonCodes, key);
          return <EvidenceCard key={`${key}-${detail.status}`} name={key} detail={detail} index={i + 1} />;
        })}
      </div>
    </Panel>
  );
}
