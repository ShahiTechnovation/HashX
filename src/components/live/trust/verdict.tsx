"use client";

/**
 * Connected-mode verdict display. Everything rendered here comes verbatim from the
 * HashX backend's persisted verification runs; nothing is evaluated in the browser.
 */
import React from "react";
import { Check, Clock, Minus, ShieldAlert, ShieldCheck, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneStyles, type Tone } from "@/components/ui/StatusBadge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { DataList, DataRow } from "@/components/ui/DataList";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { EmptyState } from "@/components/ui/EmptyState";
import { findNetwork } from "@shared/networks";
import type { LiveCheckDetail, LiveDelivery, LiveVerificationRun } from "@/lib/live/types";

export type Decision = "PASS" | "FAIL" | "PENDING";

const DECISION_META: Record<Decision, { label: string; tone: Tone; Icon: LucideIcon }> = {
  PASS: { label: "PASS", tone: "success", Icon: ShieldCheck },
  FAIL: { label: "FAIL", tone: "danger", Icon: ShieldAlert },
  PENDING: { label: "PENDING", tone: "warning", Icon: Clock },
};

export function decisionTone(decision: Decision | null | undefined): Tone {
  return decision ? DECISION_META[decision]?.tone ?? "neutral" : "neutral";
}

const badgeBase = "inline-flex items-center rounded-[5px] ring-1 ring-inset font-medium whitespace-nowrap select-none";

/** Backend decision badge. `null`/`undefined` means "no run persisted yet". */
export const DecisionBadge: React.FC<{ decision: Decision | null | undefined; size?: "sm" | "md"; emptyLabel?: string; className?: string }> = ({
  decision,
  size = "md",
  emptyLabel = "Not run",
  className,
}) => {
  const sizing = size === "sm" ? "h-5 px-1.5 text-2xs gap-1" : "h-6 px-2 text-xs gap-1.5";
  const iconCls = size === "sm" ? "w-3 h-3 shrink-0" : "w-3.5 h-3.5 shrink-0";
  if (!decision) {
    return (
      <span className={cn(badgeBase, toneStyles.neutral.badge, sizing, className)}>
        <Minus className={iconCls} aria-hidden="true" />
        {emptyLabel}
      </span>
    );
  }
  const meta = DECISION_META[decision] ?? { label: decision, tone: "neutral" as Tone, Icon: Minus };
  return (
    <span className={cn(badgeBase, toneStyles[meta.tone].badge, sizing, className)}>
      <meta.Icon className={iconCls} strokeWidth={2.25} aria-hidden="true" />
      {meta.label}
    </span>
  );
};

const CHECK_META: Record<LiveCheckDetail["status"], { tone: Tone; Icon: LucideIcon }> = {
  PASS: { tone: "success", Icon: Check },
  FAIL: { tone: "danger", Icon: X },
  PENDING: { tone: "warning", Icon: Clock },
  SKIPPED: { tone: "neutral", Icon: Minus },
};

export const CheckStatusBadge: React.FC<{ status: LiveCheckDetail["status"]; className?: string }> = ({ status, className }) => {
  const meta = CHECK_META[status] ?? CHECK_META.SKIPPED;
  return (
    <span className={cn(badgeBase, "h-5 px-1.5 text-2xs gap-1", toneStyles[meta.tone].badge, className)}>
      <meta.Icon className="w-3 h-3 shrink-0" strokeWidth={2.25} aria-hidden="true" />
      {status}
    </span>
  );
};

/** Reason codes exactly as the backend emitted them; tone follows the run's decision. */
export const ReasonCodes: React.FC<{ codes: string[]; decision?: Decision | null; className?: string }> = ({ codes, decision, className }) => {
  if (!codes.length) return <span className="text-xs text-foreground-muted">None</span>;
  const tone = decisionTone(decision ?? "FAIL");
  return (
    <span className={cn("flex flex-wrap gap-1.5", className)}>
      {codes.map((c) => (
        <span key={c} className={cn("inline-flex items-center h-[18px] px-1.5 rounded font-mono text-[10px] font-medium ring-1 ring-inset", toneStyles[tone].badge)}>
          {c}
        </span>
      ))}
    </span>
  );
};

export const DeliveryStatusBadge: React.FC<{ status: LiveDelivery["status"]; className?: string }> = ({ status, className }) => {
  const tone: Tone = status === "ACCEPTED" ? "success" : status === "REJECTED" ? "danger" : "warning";
  const label = status === "PENDING_VERIFICATION" ? "Pending verification" : status === "ACCEPTED" ? "Accepted" : "Rejected";
  return <span className={cn(badgeBase, "h-5 px-1.5 text-2xs gap-1", toneStyles[tone].badge, className)}>{label}</span>;
};

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) + " UTC";
}

export const HashValue: React.FC<{ value: string | null | undefined; label?: string }> = ({ value, label }) =>
  value ? <CopyableValue value={value} displayText={value.length > 26 ? `${value.slice(0, 14)}…${value.slice(-10)}` : value} label={label ?? "Copy value"} /> : <span className="text-foreground-muted">—</span>;

/** Ordered check list: every key present in `checks` or `checkDetails`. */
function orderedChecks(run: LiveVerificationRun): Array<[string, LiveCheckDetail]> {
  const keys = Array.from(new Set([...Object.keys(run.checkDetails ?? {}), ...Object.keys(run.checks ?? {})]));
  return keys.map((k) => [
    k,
    run.checkDetails?.[k] ?? { status: run.checks[k], rule: k, explanation: "No detail recorded by the verifier for this check." },
  ]);
}

/** Full authoritative rendering of one persisted verification run. */
export const VerificationRunPanel: React.FC<{
  title: string;
  description?: string;
  run: LiveVerificationRun | null;
  emptyText: string;
  actions?: React.ReactNode;
}> = ({ title, description, run, emptyText, actions }) => {
  if (!run) {
    return (
      <Panel>
        <PanelHeader title={title} description={description} actions={actions} />
        <EmptyState title="No verification run persisted" description={emptyText} />
      </Panel>
    );
  }
  const checks = orderedChecks(run);
  const chain = run.chainId ? findNetwork(run.chainId) : undefined;
  return (
    <Panel>
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2">
            {title}
            <DecisionBadge decision={run.decision} size="sm" />
          </span>
        }
        description={description}
        actions={actions}
      />
      <PanelBody className="space-y-5">
        <DataList dense>
          <DataRow label="Run ID" mono>{run.runId ?? "—"}</DataRow>
          <DataRow label="Object">{run.objectType} · <span className="font-mono text-xs">{run.objectId}</span></DataRow>
          <DataRow label="Verified at">{formatDateTime(run.verifiedAt)}</DataRow>
          <DataRow label="Verifier version" mono>{run.verifierVersion}</DataRow>
          <DataRow label="Payable (per this run)">{run.payable ? "Yes" : "No"}</DataRow>
          <DataRow label="Input digest"><HashValue value={run.inputDigest} label="Copy input digest" /></DataRow>
          <DataRow label="Evidence digest"><HashValue value={run.evidenceDigest} label="Copy evidence digest" /></DataRow>
          {run.chainId !== undefined && <DataRow label="Chain">{chain?.name ?? "Unknown chain"} ({run.chainId})</DataRow>}
          {run.observedBlock && <DataRow label="Observed block" mono>{run.observedBlock}</DataRow>}
          {run.signerRecovered && <DataRow label="Recovered signer"><HashValue value={run.signerRecovered} label="Copy signer" /></DataRow>}
          <DataRow label="Reason codes"><ReasonCodes codes={run.reasonCodes ?? []} decision={run.decision} /></DataRow>
        </DataList>

        <div>
          <div className="eyebrow mb-2">Checks ({checks.length})</div>
          {checks.length === 0 ? (
            <p className="text-xs text-foreground-muted">The verifier recorded no individual checks.</p>
          ) : (
            <ul className="divide-y divide-border/60 rounded-md border border-border">
              {checks.map(([key, c]) => (
                <li key={key} className="px-3 py-2.5 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CheckStatusBadge status={c.status} />
                    <span className="font-mono text-xs text-foreground">{key}</span>
                    {c.failureCode && (
                      <span className="font-mono text-[10px] text-danger">{c.failureCode}</span>
                    )}
                  </div>
                  <div className="text-2xs text-foreground-muted">Rule: <span className="text-foreground-secondary">{c.rule}</span></div>
                  <p className="text-xs text-foreground-secondary leading-relaxed">{c.explanation}</p>
                  {(c.expected !== undefined || c.actual !== undefined) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-2xs">
                      <div className="min-w-0"><span className="text-foreground-muted">Expected </span><span className="font-mono break-all text-foreground-secondary">{c.expected ?? "—"}</span></div>
                      <div className="min-w-0"><span className="text-foreground-muted">Actual </span><span className="font-mono break-all text-foreground-secondary">{c.actual ?? "—"}</span></div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="eyebrow mb-2">Evidence sources ({run.evidenceSources?.length ?? 0})</div>
          {!run.evidenceSources?.length ? (
            <p className="text-xs text-foreground-muted">No external evidence sources recorded for this run.</p>
          ) : (
            <ul className="divide-y divide-border/60 rounded-md border border-border">
              {run.evidenceSources.map((s, i) => (
                <li key={i} className="px-3 py-2.5 text-xs space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-foreground">{s.type}</span>
                    {s.chainId !== undefined && (
                      <span className="text-foreground-muted">{findNetwork(s.chainId)?.shortName ?? "Chain"} ({s.chainId})</span>
                    )}
                  </div>
                  <p className="text-foreground-secondary">{s.description}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-2xs text-foreground-muted">
                    {s.rpc && <span>RPC: <span className="text-foreground-secondary">{s.rpc}</span></span>}
                    {s.observedBlock && <span>Observed block: <span className="font-mono text-foreground-secondary">{s.observedBlock}</span></span>}
                    {s.blocksScanned !== undefined && <span>Blocks scanned: <span className="tabular-nums text-foreground-secondary">{s.blocksScanned}</span></span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PanelBody>
    </Panel>
  );
};
