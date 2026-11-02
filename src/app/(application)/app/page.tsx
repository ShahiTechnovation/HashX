"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, ArrowRight, ChevronRight, Clock, KeyRound, CheckCircle2, Download } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient } from "@/lib/api/client";
import { Invoice, PaymentAttempt, InvoiceStatus } from "@/types/domain";
import { StatusBadge, toneStyles } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader, SectionHeading } from "@/components/ui/Panel";
import { Metric, MetricStrip } from "@/components/ui/Metric";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Segmented, SearchInput } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { formatAddress, formatMinorToUsd, formatTimestamp } from "@/lib/formatters";
import { SimulatedBadge } from "@/components/live/common";
import { LiveDashboard } from "@/components/live/dashboard/LiveDashboard";

const BLOCKED: InvoiceStatus[] = ["REJECTED", "DELIVERY_REJECTED"];

type ScopeTab = "all" | "verifying" | "authorized" | "blocked" | "settled";

export default function DashboardOverviewPage() {
  const { mode } = useApp();
  return mode === "connected" ? <LiveDashboard /> : <DemoDashboardPage />;
}

/** Demo mode: in-browser simulated fixtures only. */
function DemoDashboardPage() {
  const router = useRouter();
  const { mode, refreshKey, triggerRefresh } = useApp();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentAttempts, setPaymentAttempts] = useState<PaymentAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ScopeTab>("all");

  const client = demoClient;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        const [invs, pays] = await Promise.all([client.getInvoices(), client.getPaymentAttempts()]);
        if (isMounted) {
          setInvoices(invs);
          setPaymentAttempts(pays);
        }
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [mode, refreshKey]);

  // Derived counts & volumes
  const blocked = useMemo(() => invoices.filter((i) => BLOCKED.includes(i.status)), [invoices]);
  const settled = useMemo(() => invoices.filter((i) => i.status === "SETTLED"), [invoices]);
  const active = useMemo(
    () => invoices.filter((i) => !BLOCKED.includes(i.status) && i.status !== "SETTLED"),
    [invoices]
  );
  const pendingApprovals = useMemo(
    () =>
      paymentAttempts.filter(
        (p) => p.state === "AWAITING_SIGNATURE_APPROVAL" || p.state === "AWAITING_SUBMISSION_APPROVAL"
      ),
    [paymentAttempts]
  );
  const inSettlement = useMemo(
    () => paymentAttempts.filter((p) => ["SUBMITTED", "PROCESSING", "SAFE"].includes(p.state)),
    [paymentAttempts]
  );

  const activeVolumeMinor = active.reduce((sum, i) => sum + Number(i.payment.amount_minor), 0);
  // Attempt amounts are raw token units (approvalSummary.tokenDecimals); convert to cents for display.
  const attemptMinor = (p: PaymentAttempt) =>
    Number(p.tokenTotalRaw || 0) / 10 ** Math.max(0, (p.approvalSummary?.tokenDecimals ?? 6) - 2);
  const awaitingVolumeMinor = pendingApprovals.reduce((sum, p) => sum + attemptMinor(p), 0);
  const settlementVolumeMinor = inSettlement.reduce((sum, p) => sum + attemptMinor(p), 0);
  const settledVolumeMinor = settled.reduce((sum, i) => sum + Number(i.payment.amount_minor), 0);
  const blockedVolumeMinor = blocked.reduce((sum, i) => sum + Number(i.payment.amount_minor), 0);

  // Filtered rows for Ledger
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((inv) => {
      let matchesScope = true;
      if (scope === "verifying") {
        matchesScope = ["DRAFT", "SIGNED", "VERIFIED", "DELIVERED"].includes(inv.status);
      } else if (scope === "authorized") {
        matchesScope = inv.status === "DELIVERY_ACCEPTED";
      } else if (scope === "blocked") {
        matchesScope = BLOCKED.includes(inv.status);
      } else if (scope === "settled") {
        matchesScope = inv.status === "SETTLED";
      }

      if (!matchesScope) return false;

      if (!q) return true;
      return (
        inv.id.toLowerCase().includes(q) ||
        inv.sellerWallet.toLowerCase().includes(q) ||
        (inv.sellerDisplayName ?? "").toLowerCase().includes(q) ||
        inv.buyerRef.toLowerCase().includes(q)
      );
    });
  }, [invoices, query, scope]);

  const scopeOptions: Array<{ value: ScopeTab; label: string; count: number }> = [
    { value: "all", label: "All", count: invoices.length },
    {
      value: "verifying",
      label: "Verifying",
      count: invoices.filter((i) => ["DRAFT", "SIGNED", "VERIFIED", "DELIVERED"].includes(i.status)).length,
    },
    { value: "authorized", label: "Authorized", count: invoices.filter((i) => i.status === "DELIVERY_ACCEPTED").length },
    { value: "blocked", label: "Blocked", count: blocked.length },
    { value: "settled", label: "Settled", count: settled.length },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        badges={<SimulatedBadge />}
        description="Every obligation from signed intent to receipt. Simulated demo data — in-browser fixtures, no backend, no real transactions. Switch to connected mode for live Sepolia testnet records."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={triggerRefresh} disabled={isLoading} title="Refresh data">
              <RefreshCw className={cn(isLoading && "animate-spin")} />
              Refresh
            </Button>
            <Link href="/app/invoices/new" className={buttonStyles({ variant: "primary", size: "sm" })}>
              <Plus />
              Create invoice
            </Link>
          </>
        }
      />

      {/* Obligation pipeline — real counts from fixtures, ordered as the payment flow */}
      <section aria-labelledby="pipeline-heading" className="space-y-3">
        <SectionHeading
          title={<span id="pipeline-heading">Obligation pipeline</span>}
          description="Counts and volume at each stage. Select a stage to open it."
        />
        <MetricStrip cols={5}>
          <Metric
            href="/app/invoices"
            label="Active obligations"
            value={active.length}
            hint={`${formatMinorToUsd(activeVolumeMinor)} in pipeline`}
          />
          <Metric
            href="/app/approvals"
            tone={pendingApprovals.length > 0 ? "warning" : "neutral"}
            label="Awaiting authorization"
            value={pendingApprovals.length}
            hint={`${formatMinorToUsd(awaitingVolumeMinor)} · needs your decision`}
          />
          <Metric
            href="/app/settlements"
            tone={inSettlement.length > 0 ? "info" : "neutral"}
            label="In settlement"
            value={inSettlement.length}
            hint={`${formatMinorToUsd(settlementVolumeMinor)} · simulated rail`}
          />
          <Metric
            href="/app/receipts"
            tone={settled.length > 0 ? "success" : "neutral"}
            label="Settled (demo)"
            value={settled.length}
            hint={`${formatMinorToUsd(settledVolumeMinor)} · demo receipts`}
          />
          <Metric
            href="/app/trust"
            tone={blocked.length > 0 ? "danger" : "neutral"}
            label="Blocked"
            value={blocked.length}
            hint={`${formatMinorToUsd(blockedVolumeMinor)} · simulated`}
            className="col-span-2 lg:col-span-1"
          />
        </MetricStrip>
      </section>

      {/* Priority: payments that need a human decision */}
      <Panel as="section" aria-labelledby="decision-heading">
        <PanelHeader
          title={<span id="decision-heading">Needs your decision</span>}
          description="Explicit two-stage human authorization is required before any settlement (simulated queue)."
          icon={<KeyRound />}
          actions={
            pendingApprovals.length > 0 ? (
              <span className={cn("inline-flex h-6 items-center rounded px-2 text-xs font-medium tabular-nums", toneStyles.warning.badge)}>
                {pendingApprovals.length} pending
              </span>
            ) : undefined
          }
        />

        {pendingApprovals.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-[18px] w-[18px] text-success" />}
            title="No pending approvals"
            description="Every obligation has either cleared two-stage human authorization or has not yet completed fulfillment verification."
          />
        ) : (
          <ul className="divide-y divide-border">
            {pendingApprovals.map((attempt) => (
              <li
                key={attempt.id}
                className="flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-surface-2/50 sm:px-5 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium text-foreground">
                      {attempt.approvalSummary.merchantName || "Verified agent"}
                    </span>
                    <span className="font-mono text-xs text-foreground-muted">{formatAddress(attempt.payee)}</span>
                  </div>
                  <p className="text-[13px] text-foreground-secondary">
                    {attempt.state === "AWAITING_SIGNATURE_APPROVAL"
                      ? "Stage 1 of 2 — review terms and approve signing"
                      : "Stage 2 of 2 — final settlement authorization"}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
                    <span className="inline-flex items-center gap-1 text-warning">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      Quote expires {formatTimestamp(attempt.quoteExpiresAt).replace(" UTC", "")}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Evidence: deterministic match</span>
                    <span aria-hidden="true">·</span>
                    <span>Simulated rail</span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 lg:justify-end">
                  <div className="text-left lg:text-right">
                    <div className="whitespace-nowrap text-[20px] font-medium tracking-[-0.02em] text-foreground tabular-nums">
                      {attempt.approvalSummary.humanAmount}
                    </div>
                    <div className="text-xs text-foreground-muted">Requires explicit human sign-off</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/app/trust/${attempt.invoiceId}`} className={buttonStyles({ variant: "ghost", size: "sm" })}>
                      Inspect evidence
                    </Link>
                    <Link href={`/app/approvals/${attempt.id}`} className={buttonStyles({ variant: "primary", size: "sm" })}>
                      Review
                      <ArrowRight />
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Obligation ledger */}
      <Panel as="section" aria-labelledby="ledger-heading">
        <PanelHeader title={<span id="ledger-heading">Obligations</span>} description="All invoices in this workspace, newest first." />
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:px-5 md:flex-row md:items-center md:justify-between">
          <div className="-mx-1 overflow-x-auto px-1">
            <Segmented value={scope} onChange={setScope} options={scopeOptions} size="sm" />
          </div>
          <div className="flex w-full items-center gap-2 md:w-auto">
            <SearchInput
              wrapperClassName="flex-1 md:w-64 md:flex-none"
              placeholder="Search ID, seller, or reference"
              aria-label="Search obligations"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(invoices, null, 2));
                const dl = document.createElement("a");
                dl.setAttribute("href", dataStr);
                dl.setAttribute("download", `hashx-audit-${Date.now()}.json`);
                dl.click();
              }}
              title="Export audit JSON"
            >
              <Download />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table-base min-w-[760px]">
            <thead>
              <tr>
                <th>Obligation</th>
                <th>Seller agent</th>
                <th>Reference</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th className="text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && invoices.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6}>
                      <div className="h-4 rounded bg-surface-2" />
                    </td>
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      title="No matching obligations"
                      description="Adjust the filter or search, or create a new invoice to begin."
                    />
                  </td>
                </tr>
              ) : (
                filteredRows.map((inv) => {
                  const isInvBlocked = BLOCKED.includes(inv.status);
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => router.push(`/app/invoices/${inv.id}`)}
                      className="group cursor-pointer hover:bg-surface-2/60"
                    >
                      <td>
                        <Link
                          href={`/app/invoices/${inv.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="whitespace-nowrap font-mono text-xs font-medium text-foreground transition-colors hover:text-primary-light"
                        >
                          {inv.id}
                        </Link>
                        <div className="mt-0.5 text-xs text-foreground-muted">
                          {formatTimestamp(inv.createdAt).replace(" UTC", "")}
                        </div>
                      </td>
                      <td>
                        <div className="max-w-[200px] truncate font-medium text-foreground">
                          {inv.sellerDisplayName || "External agent"}
                        </div>
                        <div className="mt-0.5 font-mono text-xs text-foreground-muted">{formatAddress(inv.sellerWallet)}</div>
                      </td>
                      <td>
                        <div className="max-w-[240px] truncate text-foreground-secondary">
                          {inv.buyerRef || "Batch AI inference SLA execution"}
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="font-medium text-foreground tabular-nums">{formatMinorToUsd(inv.payment.amount_minor)}</div>
                        <div className="text-xs text-foreground-muted">{inv.payment.currency}</div>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={inv.status} type="invoice" size="sm" />
                          {isInvBlocked && (
                            <span className={cn("inline-flex h-5 items-center rounded px-1.5 text-2xs font-medium", toneStyles.danger.badge)}>
                              Quarantined
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/app/trust/${inv.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[13px] text-foreground-muted transition-colors hover:text-foreground"
                        >
                          Inspect
                          <ChevronRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
