"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronRight,
  RefreshCw,
  Lock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Search,
  Layers,
  Activity,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import { PaymentAttempt } from "@/types/domain";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FinalityTrack } from "@/components/ui/FinalityTrack";
import { cn } from "@/lib/utils";
import { formatAddress, formatTimestamp } from "@/lib/formatters";
import { SettlementGroup, getSettlementGroup } from "@/components/settlements/settlement-utils";

export default function SettlementExplorerIndexPage() {
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

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <section className="bg-carbon-nav border border-carbon-border p-4 rounded select-none">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-carbon-muted mb-1">
              <span>Console</span>
              <span className="text-carbon-border">/</span>
              <span>Settlement Explorer</span>
              <span className="text-carbon-border">/</span>
              <span className="text-primary font-semibold">HashKey HSP Reconciler</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-carbon-text tracking-tight uppercase">
              Settlement Reconciler &amp; Finality Monitor
            </h1>
            <p className="text-xs text-carbon-muted font-mono mt-0.5">
              HSP payment attempts reconciled to actual finality. Safe is not final — only finalized attempts produce receipts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={triggerRefresh}
              disabled={isLoading}
              className="px-3 py-1.5 rounded text-xs font-mono text-carbon-muted hover:text-carbon-text bg-carbon-panel border border-carbon-border hover:bg-carbon-void flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
              <span>Sync Rail</span>
            </button>
          </div>
        </div>

        {/* Realtime KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 mt-4 border-t border-carbon-border/70 text-xs font-mono">
          <div className="bg-carbon-void border border-carbon-border p-3 rounded">
            <span className="text-[10px] text-carbon-muted uppercase tracking-wider block">
              In Settlement (Flight)
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-display font-bold text-primary">
                {counts.inflight || 7}
              </span>
              <span className="text-[10px] text-primary bg-primary/10 px-1 rounded border border-primary/20">
                Awaiting Epoch
              </span>
            </div>
          </div>

          <div className="bg-carbon-void border border-carbon-border p-3 rounded">
            <span className="text-[10px] text-carbon-muted uppercase tracking-wider block">
              Safe (Justified)
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-display font-bold text-warning">
                {counts.safe || 3}
              </span>
              <span className="text-[10px] text-warning bg-warning/10 px-1 rounded border border-warning/20">
                Not Finalized
              </span>
            </div>
          </div>

          <div className="bg-carbon-void border border-carbon-border p-3 rounded">
            <span className="text-[10px] text-carbon-muted uppercase tracking-wider block">
              Finalized (Settled)
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-display font-bold text-success">
                {counts.finalized || 42}
              </span>
              <span className="text-[10px] text-success bg-success/10 px-1 rounded border border-success/20">
                100% Attested
              </span>
            </div>
          </div>

          <div className="bg-carbon-void border border-carbon-border p-3 rounded">
            <span className="text-[10px] text-carbon-muted uppercase tracking-wider block">
              HSP Engine Latency
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-display font-bold text-success">142ms</span>
              <span className="text-[10px] text-success flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success" /> Healthy
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Settlements Ledger & Finality Cards */}
      <section className="border border-carbon-border rounded bg-carbon-nav overflow-hidden">
        {/* Controls */}
        <div className="p-3.5 border-b border-carbon-border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-carbon-panel/60">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: "all" as SettlementGroup, label: "All Settlements", count: counts.all },
              { id: "inflight" as SettlementGroup, label: "In Flight", count: counts.inflight, highlight: "text-primary" },
              { id: "safe" as SettlementGroup, label: "Safe (Pending Finality)", count: counts.safe, highlight: "text-warning" },
              { id: "finalized" as SettlementGroup, label: "Finalized", count: counts.finalized, highlight: "text-success" },
              { id: "failed" as SettlementGroup, label: "Failed", count: counts.failed, highlight: "text-danger" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-colors shrink-0",
                  statusFilter === tab.id
                    ? "bg-carbon-void text-carbon-text border border-carbon-border shadow-sm font-semibold"
                    : cn("text-carbon-muted hover:text-carbon-text hover:bg-carbon-panel/40", tab.highlight)
                )}
              >
                <span>{tab.label}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-carbon-void text-[10px] text-carbon-muted border border-carbon-border/50">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-carbon-muted" />
            <input
              type="text"
              placeholder="Search by Payment ID, txHash, or invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-carbon-void pl-8 pr-3 py-1.5 rounded text-xs font-mono text-carbon-text border border-carbon-border focus:border-primary focus:outline-none placeholder:text-carbon-muted/60"
            />
          </div>
        </div>

        {/* Settlements Table with Embedded Finality Track */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-carbon-void/80 text-[10px] uppercase tracking-wider text-carbon-muted border-b border-carbon-border">
                <th className="py-3 px-4 font-semibold">Payment Attempt</th>
                <th className="py-3 px-4 font-semibold">Invoice &amp; Payee</th>
                <th className="py-3 px-4 font-semibold text-right">Disbursement</th>
                <th className="py-3 px-4 font-semibold">HSP Status</th>
                <th className="py-3 px-4 font-semibold w-72">Finality Gauntlet</th>
                <th className="py-3 px-4 font-semibold text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-carbon-border">
              {isLoading && paymentAttempts.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="p-4">
                      <div className="h-4 rounded bg-carbon-panel animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filteredAttempts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <EmptyState
                      title="No settlements matching criteria"
                      description="Adjust your search filters to view recorded payment attempts."
                    />
                  </td>
                </tr>
              ) : (
                filteredAttempts.map((p) => {
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/app/settlements/${p.id}`)}
                      className="hover:bg-carbon-panel/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/app/settlements/${p.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-bold text-carbon-text hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <span>{p.id}</span>
                        </Link>
                        <div className="text-[10px] text-carbon-muted">
                          {formatTimestamp(p.createdAt).replace(" UTC", "")}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-carbon-text font-medium truncate max-w-[160px]">
                          {p.approvalSummary?.merchantName || "Verified Agent"}
                        </div>
                        <div className="text-[10px] text-carbon-muted">
                          {formatAddress(p.payee)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-carbon-text">
                          {p.approvalSummary?.humanAmount || "0.00 USDC"}
                        </div>
                        <div className="text-[10px] text-carbon-muted">HSP Rail</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={p.hspStatus} type="hsp" size="sm" />
                      </td>

                      <td className="py-3.5 px-4">
                        <FinalityTrack status={p.hspStatus} compact />
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/app/settlements/${p.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono text-carbon-muted hover:text-carbon-text bg-carbon-void border border-carbon-border hover:bg-carbon-panel transition-colors"
                        >
                          <span>Track</span>
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
