"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Clock, RefreshCw } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { LiveSettlements } from "@/components/live/payments/LiveSettlements";
import { demoClient, connectedClient } from "@/lib/api/client";
import { PaymentAttempt } from "@/types/domain";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FinalityTrack } from "@/components/ui/FinalityTrack";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Metric, MetricStrip } from "@/components/ui/Metric";
import { Segmented, SearchInput } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { SimulatedBadge } from "@/components/live/common";
import { ToneBadge, merchantDisplayName } from "@/components/approvals/approval-primitives";
import { cn } from "@/lib/utils";
import { formatAddress, formatTimestamp } from "@/lib/formatters";
import { SettlementGroup, getSettlementGroup, isPreAuthorization } from "@/components/settlements/settlement-utils";

/** Connected mode renders only real backend records; demo mode keeps the simulated fixture view. */
export default function SettlementsPage() {
  const { mode } = useApp();
  return mode === "connected" ? <LiveSettlements /> : <DemoSettlementExplorerIndexPage />;
}

function DemoSettlementExplorerIndexPage() {
  const router = useRouter();
  const { mode, refreshKey, triggerRefresh } = useApp();
  const [paymentAttempts, setPaymentAttempts] = useState<PaymentAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SettlementGroup>("all");

  const client = mode === "connected" ? connectedClient : demoClient;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        const data = await client.getPaymentAttempts();
        if (isMounted) setPaymentAttempts(data);
      } catch (err) {
        console.error("Failed to load settlement attempts:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [mode, refreshKey]);

  const counts = useMemo(() => {
    const c: Record<SettlementGroup, number> = {
      all: paymentAttempts.length,
      inflight: 0,
      safe: 0,
      finalized: 0,
      failed: 0,
    };
    for (const p of paymentAttempts) {
      const g = getSettlementGroup(p);
      if (g) c[g] += 1;
    }
    return c;
  }, [paymentAttempts]);

  const filteredAttempts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return paymentAttempts.filter((p) => {
      const matchesSearch =
        !q ||
        p.id.toLowerCase().includes(q) ||
        p.invoiceId.toLowerCase().includes(q) ||
        p.flowId.toLowerCase().includes(q) ||
        p.paymentRequestId.toLowerCase().includes(q) ||
        p.payer.toLowerCase().includes(q) ||
        p.payee.toLowerCase().includes(q) ||
        (p.txHash ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || getSettlementGroup(p) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [paymentAttempts, searchQuery, statusFilter]);

  const filterOptions: Array<{ value: SettlementGroup; label: string; count: number }> = [
    { value: "all", label: "All", count: counts.all },
    { value: "inflight", label: "In flight", count: counts.inflight },
    { value: "safe", label: "Safe · not final", count: counts.safe },
    { value: "finalized", label: "Finalized", count: counts.finalized },
    { value: "failed", label: "Failed", count: counts.failed },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="HashKey HSP"
        title="Settlements"
        badges={<SimulatedBadge />}
        description="Payment attempts reconciled to actual finality. Safe is not final — only finalized attempts produce receipts."
        actions={
          <Button variant="secondary" size="sm" onClick={triggerRefresh} disabled={isLoading}>
            <RefreshCw className={cn(isLoading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <MetricStrip cols={4}>
        <Metric label="In flight" value={counts.inflight} tone={counts.inflight > 0 ? "info" : undefined} hint="Submitted, awaiting inclusion" />
        <Metric label="Safe · not final" value={counts.safe} tone={counts.safe > 0 ? "warning" : undefined} hint="On-chain, still reversible" />
        <Metric label="Finalized" value={counts.finalized} tone={counts.finalized > 0 ? "success" : undefined} hint="Irreversible; receipt issued" />
        <Metric label="Failed or timed out" value={counts.failed} tone={counts.failed > 0 ? "danger" : undefined} hint="Needs recovery or review" />
      </MetricStrip>

      <Panel>
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
            <Segmented value={statusFilter} onChange={setStatusFilter} options={filterOptions} />
          </div>
          <SearchInput
            wrapperClassName="w-full lg:w-72"
            placeholder="Search attempt, tx hash, or invoice"
            aria-label="Search settlements"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="table-base min-w-[920px]">
            <thead>
              <tr>
                <th>Payment attempt</th>
                <th>Payee</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th className="w-72">Finality</th>
                <th className="w-12">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && paymentAttempts.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6}>
                      <div className="h-4 animate-pulse rounded bg-surface-2" />
                    </td>
                  </tr>
                ))
              ) : filteredAttempts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="!p-0">
                    <EmptyState
                      title="No settlements match"
                      description="Adjust the filter or search to see recorded payment attempts."
                    />
                  </td>
                </tr>
              ) : (
                filteredAttempts.map((p) => {
                  const pre = isPreAuthorization(p);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/app/settlements/${p.id}`)}
                      className="group cursor-pointer hover:bg-surface-2/60"
                    >
                      <td>
                        <Link
                          href={`/app/settlements/${p.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-xs font-medium text-foreground hover:text-primary-light"
                        >
                          {p.id}
                        </Link>
                        <div className="mt-0.5 text-xs tabular-nums text-foreground-muted">
                          {formatTimestamp(p.createdAt).replace(" UTC", "")}
                        </div>
                      </td>

                      <td>
                        <div className="max-w-[180px] truncate text-foreground">
                          {merchantDisplayName(p.approvalSummary?.merchantName || "Verified Agent")}
                        </div>
                        <div className="mt-0.5 font-mono text-xs text-foreground-muted">{formatAddress(p.payee)}</div>
                      </td>

                      <td className="text-right">
                        <div className="font-medium tabular-nums text-foreground">{p.approvalSummary?.humanAmount || "0.00 USDC"}</div>
                        <div className="mt-0.5 text-xs text-foreground-muted">HSP rail</div>
                      </td>

                      <td>
                        {pre ? (
                          <ToneBadge size="sm" tone="neutral" icon={Clock}>
                            Awaiting authorization
                          </ToneBadge>
                        ) : (
                          <StatusBadge status={p.hspStatus} type="hsp" size="sm" />
                        )}
                      </td>

                      <td>
                        {pre ? (
                          <span className="text-xs text-foreground-muted">Not submitted</span>
                        ) : (
                          <FinalityTrack status={p.hspStatus} compact />
                        )}
                      </td>

                      <td className="text-right">
                        <ChevronRight
                          className="ml-auto h-4 w-4 text-foreground-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground"
                          aria-hidden="true"
                        />
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
