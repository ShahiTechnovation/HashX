"use client";

/**
 * Connected-mode dashboard. Every number on this page comes from GET /stats on the
 * HashX backend (caller-scoped counts of real persisted records). Nothing is derived
 * from demo fixtures and nothing is estimated.
 */
import React from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Metric, MetricStrip } from "@/components/ui/Metric";
import { Panel, PanelBody, PanelHeader, SectionHeading } from "@/components/ui/Panel";
import { Button, buttonStyles } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Callout } from "@/components/ui/Callout";
import { LiveError, LiveGate, TestnetBadge, useLiveQuery } from "@/components/live/common";
import { SEPOLIA_CHAIN_ID } from "@shared/networks";
import type { LiveStats } from "@/lib/live/types";

const INVOICE_STATUSES: Array<{ key: string; label: string }> = [
  { key: "DRAFT", label: "Draft" },
  { key: "SIGNED", label: "Signed" },
  { key: "VERIFIED", label: "Verified" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "DELIVERY_ACCEPTED", label: "Delivery accepted" },
  { key: "DELIVERY_REJECTED", label: "Delivery rejected" },
  { key: "SETTLED", label: "Settled" },
  { key: "REJECTED", label: "Rejected" },
];

const PAYMENT_GROUPS: Array<{ label: string; states: string[]; tone: "warning" | "info" | "success" | "danger"; hint: string }> = [
  {
    label: "Pending human approval",
    states: ["AWAITING_SIGNATURE_APPROVAL", "AWAITING_SUBMISSION_APPROVAL", "AUTHORIZED"],
    tone: "warning",
    hint: "Stage 1, Stage 2, or authorized but not yet sent",
  },
  { label: "In settlement", states: ["SUBMITTED", "INCLUDED"], tone: "info", hint: "Tx reported or included, confirming" },
  { label: "Confirmed / finalized", states: ["CONFIRMED", "FINALIZED"], tone: "success", hint: "Transfer independently verified on-chain" },
  {
    label: "Failed / dropped / expired / cancelled",
    states: ["FAILED", "DROPPED", "EXPIRED", "CANCELLED", "TIMEOUT"],
    tone: "danger",
    hint: "Terminal without settlement",
  },
];

function sum(rec: Record<string, number>, keys?: string[]) {
  return (keys ?? Object.keys(rec)).reduce((acc, k) => acc + (rec[k] ?? 0), 0);
}

function isEmpty(s: LiveStats) {
  return (
    sum(s.invoicesByStatus) === 0 &&
    sum(s.paymentsByState) === 0 &&
    sum(s.deliveryVerificationsByDecision) === 0 &&
    s.liveReceipts === 0 &&
    BigInt(s.settledTestUsdcRaw || "0") === 0n
  );
}

const LiveDashboardBody: React.FC = () => {
  const { liveApi } = useApp();
  const { data, error, loading, reload } = useLiveQuery(() => liveApi.stats(), [liveApi]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Live testnet records"
        description="Live testnet records from the HashX backend, scoped to the signed-in wallet (as seller or buyer). Counts come directly from persisted records — nothing here is simulated."
        badges={<TestnetBadge chainId={SEPOLIA_CHAIN_ID} />}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={reload} isLoading={loading}>
              {!loading && <RefreshCw className="w-3.5 h-3.5" />}
              Refresh
            </Button>
            <Link href="/app/invoices/new" className={buttonStyles({ size: "sm" })}>
              <Plus className="w-3.5 h-3.5" />
              Create invoice
            </Link>
          </>
        }
      />

      {error ? (
        <LiveError error={error} title="Could not load live statistics" onRetry={reload} />
      ) : !data ? (
        <div className="h-28 rounded-lg border border-border bg-surface-1 animate-pulse" />
      ) : isEmpty(data) ? (
        <Panel>
          <EmptyState
            title="No live records yet"
            description="This wallet has no invoices, deliveries, payments, or receipts on the HashX backend. Create an invoice to start the Sepolia testnet flow."
            action={
              <Link href="/app/invoices/new" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                <Plus className="w-3.5 h-3.5" />
                Create an invoice
              </Link>
            }
          />
        </Panel>
      ) : (
        <>
          <section className="space-y-3">
            <SectionHeading title="Settlement" description="Only payment attempts in CONFIRMED or FINALIZED state are counted as settled." />
            <MetricStrip cols={3}>
              <Metric
                label="Settled amount"
                value={
                  <>
                    {data.settledTestUsdcDisplay}{" "}
                    <span className="text-sm font-sans text-foreground-muted">Test USDC</span>
                  </>
                }
                hint="Sepolia Testnet · test tokens, no monetary value"
                tone="success"
              />
              <Metric label="Live receipts" value={data.liveReceipts} hint="Unrevoked v2 receipts" href="/app/receipts" />
              <Metric
                label="Delivery verifications"
                value={sum(data.deliveryVerificationsByDecision)}
                hint={`${data.deliveryVerificationsByDecision.PASS ?? 0} pass · ${data.deliveryVerificationsByDecision.FAIL ?? 0} fail · ${data.deliveryVerificationsByDecision.PENDING ?? 0} pending`}
              />
            </MetricStrip>
          </section>

          <section className="space-y-3">
            <SectionHeading title="Payments by state" description="Two-stage human authorization; agents can request but never approve." />
            <MetricStrip cols={4}>
              {PAYMENT_GROUPS.map((g) => (
                <Metric key={g.label} label={g.label} value={sum(data.paymentsByState, g.states)} hint={g.hint} tone={g.tone} href="/app/settlements" />
              ))}
            </MetricStrip>
          </section>

          <section className="space-y-3">
            <SectionHeading title="Invoices by status" description="Protocol v2 invoices where this wallet is the seller or the buyer." />
            <MetricStrip cols={4}>
              {INVOICE_STATUSES.map((s) => (
                <Metric key={s.key} label={s.label} value={data.invoicesByStatus[s.key] ?? 0} href="/app/invoices" />
              ))}
            </MetricStrip>
          </section>

          <Panel>
            <PanelHeader title="Delivery verification decisions" description="Independent RPC recomputation results for submitted deliveries." />
            <PanelBody>
              <div className="grid grid-cols-3 gap-4 text-[13px]">
                {(["PASS", "FAIL", "PENDING"] as const).map((d) => (
                  <div key={d}>
                    <div className="text-xs text-foreground-muted">{d}</div>
                    <div className="mt-1 font-display text-xl tabular-nums text-foreground">{data.deliveryVerificationsByDecision[d] ?? 0}</div>
                  </div>
                ))}
              </div>
            </PanelBody>
          </Panel>
        </>
      )}

      <Callout tone="neutral" title="What this page does not show">
        HashKey HSP settlement is not connected, and the Evidence Registry contract is not deployed to a public network. Only direct Test USDC
        transfers on Ethereum Sepolia can settle in connected mode.
      </Callout>
    </div>
  );
};

export const LiveDashboard: React.FC = () => (
  <LiveGate purpose="The dashboard shows only records your wallet participates in.">
    <LiveDashboardBody />
  </LiveGate>
);
