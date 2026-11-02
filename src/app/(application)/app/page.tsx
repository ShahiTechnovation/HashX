"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  RefreshCw,
  ArrowRight,
  ChevronRight,
  ShieldAlert,
  Clock,
  KeyRound,
  FileCheck2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Download,
  ExternalLink,
  Layers,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import { Invoice, PaymentAttempt, InvoiceStatus } from "@/types/domain";
import { ProofCircuit } from "@/components/brand/ProofCircuit";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { formatAddress, formatMinorToUsd, formatTimestamp } from "@/lib/formatters";

const BLOCKED: InvoiceStatus[] = ["REJECTED", "DELIVERY_REJECTED"];

type ScopeTab = "all" | "verifying" | "authorized" | "blocked" | "settled";

export default function DashboardOverviewPage() {
  const router = useRouter();
  const { mode, refreshKey, triggerRefresh } = useApp();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentAttempts, setPaymentAttempts] = useState<PaymentAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ScopeTab>("all");

  const client = mode === "connected" ? connectedClient : demoClient;

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
  const awaitingVolumeMinor = pendingApprovals.reduce(
    (sum, p) => sum + Number(p.tokenTotalRaw || 0),
    0
  );
  const settlementVolumeMinor = inSettlement.reduce(
    (sum, p) => sum + Number(p.tokenTotalRaw || 0),
    0
  );
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

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-carbon-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-carbon-muted">
            <span>CONSOLE</span>
            <span>//</span>
            <span className="text-carbon-text">APPLICATION OVERVIEW</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-carbon-text mt-0.5">
            Operations &amp; Proof Pipeline
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={triggerRefresh}
            disabled={isLoading}
            className="px-3 py-1.5 rounded text-xs font-mono text-carbon-muted hover:text-carbon-text bg-carbon-nav border border-carbon-border hover:bg-carbon-panel flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
            <span className="hidden sm:inline">Re-sync</span>
          </button>

          <Link
            href="/app/invoices/new"
            className="px-4 py-1.5 rounded text-xs font-mono font-semibold text-white bg-primary hover:bg-primary/90 shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Invoice</span>
          </Link>
        </div>
      </div>

      {/* 2. 5-Column Architectural Metrics Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 border border-carbon-border bg-carbon-nav rounded overflow-hidden select-none">
        {/* Metric 01: Active Obligations */}
        <div className="p-4 border-b sm:border-b-0 sm:border-r border-carbon-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-carbon-muted mb-2">
            <span>01 // ACTIVE OBLIGATIONS</span>
            <Layers className="w-3.5 h-3.5 text-carbon-muted" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold text-carbon-text tracking-tight">
              {active.length} <span className="text-xs font-mono font-normal text-carbon-muted">items</span>
            </div>
            <div className="font-mono text-xs text-carbon-muted mt-0.5">
              {formatMinorToUsd(activeVolumeMinor)} <span className="text-[10px]">USDC</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-carbon-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-carbon-muted"></span>
            <span>In Pipeline</span>
          </div>
        </div>

        {/* Metric 02: Awaiting Authorization (Amber) */}
        <div className="p-4 border-b sm:border-b-0 sm:border-r border-carbon-border flex flex-col justify-between bg-warning/[0.04]">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-warning mb-2">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-warning animate-ping"></span>
              02 // AWAITING AUTHORIZATION
            </span>
            <Clock className="w-3.5 h-3.5 text-warning" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold text-warning tracking-tight">
              {pendingApprovals.length}{" "}
              <span className="text-xs font-mono font-normal text-warning/80">items</span>
            </div>
            <div className="font-mono text-xs text-warning/90 mt-0.5">
              {formatMinorToUsd(awaitingVolumeMinor)} <span className="text-[10px]">USDC</span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] font-mono">
            <span className="text-warning font-medium">NEEDS YOUR DECISION</span>
            <span className="px-1.5 py-0.5 bg-warning/15 text-warning border border-warning/30 rounded text-[9px] font-semibold">
              ACTION REQ
            </span>
          </div>
        </div>

        {/* Metric 03: In Settlement (Signal Blue) */}
        <div className="p-4 border-b lg:border-b-0 sm:border-r border-carbon-border flex flex-col justify-between bg-primary/[0.03]">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-primary mb-2">
            <span>03 // IN SETTLEMENT</span>
            <Lock className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold text-carbon-text tracking-tight">
              {inSettlement.length}{" "}
              <span className="text-xs font-mono font-normal text-carbon-muted">items</span>
            </div>
            <div className="font-mono text-xs text-primary mt-0.5">
              {formatMinorToUsd(settlementVolumeMinor)} <span className="text-[10px] text-carbon-muted">USDC</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-carbon-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            <span>HashKey HSP Rail</span>
          </div>
        </div>

        {/* Metric 04: Finalized 24H (Controlled Mint) */}
        <div className="p-4 border-b sm:border-b-0 sm:border-r border-carbon-border flex flex-col justify-between bg-success/[0.03]">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-success mb-2">
            <span>04 // FINALIZED (24H)</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold text-carbon-text tracking-tight">
              {settled.length}{" "}
              <span className="text-xs font-mono font-normal text-carbon-muted">items</span>
            </div>
            <div className="font-mono text-xs text-success mt-0.5">
              {formatMinorToUsd(settledVolumeMinor)} <span className="text-[10px] text-carbon-muted">USDC</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-carbon-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
            <span>Receipts Committed</span>
          </div>
        </div>

        {/* Metric 05: Intercepted (Muted Red) */}
        <div className="p-4 flex flex-col justify-between bg-danger/[0.03]">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-danger mb-2">
            <span>05 // INTERCEPTED</span>
            <ShieldAlert className="w-3.5 h-3.5 text-danger" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold text-danger tracking-tight">
              {blocked.length}{" "}
              <span className="text-xs font-mono font-normal text-danger/80">items</span>
            </div>
            <div className="font-mono text-xs text-danger/90 mt-0.5">
              {formatMinorToUsd(blockedVolumeMinor)} <span className="text-[10px]">USDC</span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] font-mono">
            <span className="text-danger font-medium">{blocked.length} Threats Prevented</span>
            <span className="px-1.5 py-0.5 bg-danger/20 text-danger border border-danger/40 rounded text-[9px] font-bold">
              ISOLATED
            </span>
          </div>
        </div>
      </section>

      {/* 3. Signature Proof Circuit: The Obligation Pipeline */}
      <ProofCircuit
        variant="pipeline"
        pipelineCounts={{
          issued: active.length,
          verified: invoices.filter((i) => ["VERIFIED", "DELIVERED"].includes(i.status)).length,
          authorized: pendingApprovals.length,
          inFlight: inSettlement.length,
          settled: settled.length,
          blocked: blocked.length,
        }}
      />

      {/* 4. Priority Action Area: "NEEDS YOUR DECISION" */}
      <section className="border border-warning/40 rounded bg-carbon-panel overflow-hidden">
        {/* Banner Header */}
        <div className="px-5 py-3.5 bg-warning/10 border-b border-warning/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-warning"></span>
            </span>
            <div>
              <h3 className="font-display font-bold text-sm tracking-tight text-carbon-text flex items-center gap-2">
                NEEDS YOUR DECISION
                <span className="text-xs font-mono font-normal text-warning">
                  // 2-STAGE HUMAN PAYMENT AUTHORIZATION QUEUE ({pendingApprovals.length} PENDING)
                </span>
              </h3>
            </div>
          </div>
          <div className="text-xs font-mono text-carbon-muted flex items-center gap-2">
            <span>
              Explicit Human Authorization Required Prior to HashKey HSP Settlement
            </span>
          </div>
        </div>

        {/* Pending Rows */}
        {pendingApprovals.length === 0 ? (
          <div className="p-8 text-center bg-carbon-nav/40">
            <CheckCircle2 className="w-8 h-8 text-success/80 mx-auto mb-2" />
            <h4 className="font-display text-sm font-semibold text-carbon-text">
              All Clear — No Pending Approvals
            </h4>
            <p className="text-xs text-carbon-muted font-mono mt-1 max-w-md mx-auto">
              Every obligation has either cleared two-stage human authorization or has not yet completed deterministic fulfillment verification.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-carbon-border">
            {pendingApprovals.map((attempt) => (
              <div
                key={attempt.id}
                className="p-4 bg-carbon-nav/60 hover:bg-carbon-nav transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Left: Meta & Counterparty */}
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded bg-carbon-void border border-carbon-border flex flex-col items-center justify-center font-mono text-[10px] text-carbon-muted flex-shrink-0">
                    <span className="text-warning font-bold">#HX</span>
                    <span>{attempt.id.slice(-4).toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-sans font-semibold text-xs text-carbon-text">
                        {attempt.approvalSummary.merchantName || "Verified Agent"}
                      </span>
                      <span className="text-[10px] font-mono text-carbon-muted bg-carbon-void px-1.5 py-0.5 rounded border border-carbon-border">
                        {formatAddress(attempt.payee)}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-success/15 text-success border border-success/30 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-success"></span> VERIFIED
                      </span>
                    </div>

                    <div className="text-xs text-carbon-muted mt-1">
                      Stage:{" "}
                      <span className="text-carbon-text font-medium">
                        {attempt.state === "AWAITING_SIGNATURE_APPROVAL"
                          ? "Stage 1 — Terms Review & Signing Authorization"
                          : "Stage 2 — Final Treasury Settlement Authorization"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-carbon-muted flex-wrap">
                      <span className="text-warning flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Quote Expiry:{" "}
                        {formatTimestamp(attempt.quoteExpiresAt).replace(" UTC", "")}
                      </span>
                      <span>•</span>
                      <span>Evidence: Deterministic Match</span>
                      <span>•</span>
                      <span>HSP Rail: Testnet 133</span>
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Actions */}
                <div className="flex items-center justify-between lg:justify-end gap-6 flex-shrink-0">
                  <div className="text-right">
                    <div className="font-display text-lg font-bold text-carbon-text">
                      {attempt.approvalSummary.humanAmount}{" "}
                      <span className="text-xs font-mono font-normal text-carbon-muted">USDC</span>
                    </div>
                    <div className="text-[10px] font-mono text-carbon-muted">
                      Policy: Explicit Human Sign-off
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/app/trust/${attempt.invoiceId}`}
                      className="px-3 py-1.5 rounded text-xs font-mono text-carbon-muted hover:text-carbon-text bg-carbon-panel hover:bg-carbon-nav border border-carbon-border transition-colors"
                    >
                      Inspect Witness
                    </Link>
                    <Link
                      href={`/app/approvals/${attempt.id}`}
                      className="px-4 py-1.5 rounded text-xs font-mono font-semibold text-white bg-primary hover:bg-primary/90 shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Review &amp; Authorize</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Compact Obligation Ledger & Activity Stream */}
      <section className="border border-carbon-border rounded bg-carbon-nav overflow-hidden">
        {/* Filter Tabs & Table Controls Bar */}
        <div className="p-3.5 border-b border-carbon-border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-carbon-panel/60">
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {[
              { id: "all" as ScopeTab, label: "All Obligations", count: invoices.length },
              {
                id: "verifying" as ScopeTab,
                label: "Verifying",
                count: invoices.filter((i) => ["DRAFT", "SIGNED", "VERIFIED", "DELIVERED"].includes(i.status)).length,
              },
              {
                id: "authorized" as ScopeTab,
                label: "Authorized",
                count: invoices.filter((i) => i.status === "DELIVERY_ACCEPTED").length,
                highlight: "text-warning",
              },
              {
                id: "blocked" as ScopeTab,
                label: "Blocked",
                count: blocked.length,
                highlight: "text-danger",
              },
              {
                id: "settled" as ScopeTab,
                label: "Finalized Archive",
                count: settled.length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setScope(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-colors shrink-0",
                  scope === tab.id
                    ? "bg-carbon-void text-carbon-text border border-carbon-border shadow-sm"
                    : cn("text-carbon-muted hover:text-carbon-text hover:bg-carbon-panel/50", tab.highlight)
                )}
              >
                <span>{tab.label}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-carbon-void/80 text-[10px] text-carbon-muted border border-carbon-border/50">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input & Action */}
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-carbon-muted" />
              <input
                type="text"
                placeholder="Search by Hash / Agent ID..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-carbon-void pl-8 pr-3 py-1.5 rounded text-xs font-mono text-carbon-text border border-carbon-border focus:border-primary focus:outline-none placeholder:text-carbon-muted/60"
              />
            </div>
            <button
              onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(invoices, null, 2));
                const dl = document.createElement("a");
                dl.setAttribute("href", dataStr);
                dl.setAttribute("download", `hashx-audit-${Date.now()}.json`);
                dl.click();
              }}
              className="px-3 py-1.5 rounded text-xs font-mono text-carbon-muted hover:text-carbon-text bg-carbon-void border border-carbon-border hover:bg-carbon-panel flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Audit</span>
            </button>
          </div>
        </div>

        {/* High Density Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-carbon-void/80 text-[10px] font-mono uppercase tracking-wider text-carbon-muted border-b border-carbon-border">
                <th className="py-3 px-4 font-semibold">Obligation ID</th>
                <th className="py-3 px-4 font-semibold">Counterparty Agent</th>
                <th className="py-3 px-4 font-semibold">Service Deliverable</th>
                <th className="py-3 px-4 font-semibold text-right">Amount</th>
                <th className="py-3 px-4 font-semibold">Verification Proof</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-carbon-border text-xs font-mono">
              {isLoading && invoices.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="p-4">
                      <div className="h-4 rounded bg-carbon-panel animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <EmptyState
                      title="No matching obligations found"
                      description="Adjust your search filters or create a new invoice to begin."
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
                      className="hover:bg-carbon-panel/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`/app/invoices/${inv.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-bold text-carbon-text hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <span>{inv.id}</span>
                        </Link>
                        <div className="text-[10px] text-carbon-muted">
                          {formatTimestamp(inv.createdAt).replace(" UTC", "")}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-sans font-medium text-carbon-text truncate max-w-[200px]">
                          {inv.sellerDisplayName || "External Agent"}
                        </div>
                        <div className="text-[10px] text-carbon-muted font-mono">
                          {formatAddress(inv.sellerWallet)}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-carbon-text truncate max-w-[240px]">
                          {inv.buyerRef || "Batch AI inference SLA execution"}
                        </div>
                        <div className="text-[10px] text-carbon-muted">
                          Domain: HashX Global
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-carbon-text">
                          {formatMinorToUsd(inv.payment.amount_minor)}
                        </div>
                        <div className="text-[10px] text-carbon-muted">USDC</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={inv.status} type="invoice" size="sm" />
                          {isInvBlocked && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-danger/15 text-danger border border-danger/30">
                              QUARANTINED
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/app/trust/${inv.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono text-carbon-muted hover:text-carbon-text bg-carbon-void border border-carbon-border hover:bg-carbon-panel transition-colors"
                        >
                          <span>Inspect</span>
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
