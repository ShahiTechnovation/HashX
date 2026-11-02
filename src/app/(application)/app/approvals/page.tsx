"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  ChevronRight,
  ArrowRight,
  KeyRound,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Lock,
  Search,
  ExternalLink,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { LiveApprovals } from "@/components/live/payments/LiveApprovals";
import { demoClient, connectedClient } from "@/lib/api/client";
import { PaymentAttempt } from "@/types/domain";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { formatAddress, formatTimestamp } from "@/lib/formatters";
import {
  getApprovalGroup,
  getQuoteExpiry,
  merchantDisplayName,
  useNow,
} from "@/components/approvals/approval-primitives";

type Filter = "ALL" | "PENDING" | "COMPLETED";

/** Connected mode renders only real backend records; demo mode keeps the simulated fixture view. */
export default function ApprovalsPage() {
  const { mode } = useApp();
  return mode === "connected" ? <LiveApprovals /> : <DemoApprovalsQueuePage />;
}

function DemoApprovalsQueuePage() {
  const router = useRouter();
  const { mode, refreshKey, triggerRefresh } = useApp();
  const [paymentAttempts, setPaymentAttempts] = useState<PaymentAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStage, setFilterStage] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const now = useNow(1000);

  const client = mode === "connected" ? connectedClient : demoClient;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        const data = await client.getPaymentAttempts();
        if (isMounted) setPaymentAttempts(data);
      } catch (err) {
        console.error("Failed to load payment attempts for approvals:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [mode, refreshKey]);

  const pending = paymentAttempts.filter((p) => getApprovalGroup(p.state) !== "completed");
  const signingCount = paymentAttempts.filter((p) => getApprovalGroup(p.state) === "signing").length;
  const submissionCount = paymentAttempts.filter((p) => getApprovalGroup(p.state) === "submission").length;
  const completedCount = paymentAttempts.length - pending.length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return paymentAttempts.filter((p) => {
      const group = getApprovalGroup(p.state);
      const inFilter =
        filterStage === "ALL" ||
        (filterStage === "PENDING" && group !== "completed") ||
        (filterStage === "COMPLETED" && group === "completed");
      const matches =
        !q ||
        p.id.toLowerCase().includes(q) ||
        p.invoiceId.toLowerCase().includes(q) ||
        p.payee.toLowerCase().includes(q) ||
        merchantDisplayName(p.approvalSummary?.merchantName ?? p.merchantName).toLowerCase().includes(q);
      return inFilter && matches;
    });
  }, [paymentAttempts, filterStage, query]);

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <section className="bg-carbon-nav border border-carbon-border p-4 rounded select-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-carbon-muted mb-1">
              <span>Console</span>
              <span className="text-carbon-border">/</span>
              <span>Human Authorization</span>
              <span className="text-carbon-border">/</span>
              <span className="text-warning font-semibold">Quorum Control</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-carbon-text tracking-tight uppercase">
              Human Payment Authorization Queue
            </h1>
            <p className="text-xs text-carbon-muted font-mono mt-0.5">
              Explicit human approval threshold preventing recursive autonomous agent balance depletion.
            </p>
          </div>

          <button
            onClick={triggerRefresh}
            disabled={isLoading}
            className="px-3 py-1.5 rounded text-xs font-mono text-carbon-muted hover:text-carbon-text bg-carbon-panel border border-carbon-border hover:bg-carbon-void flex items-center gap-1.5 transition-colors self-start sm:self-auto disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
            <span>Sync Quorum</span>
          </button>
        </div>

        {/* Telemetry Strip */}
        <div className="mt-4 pt-3 border-t border-carbon-border/70 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs font-mono text-carbon-muted">
          <div>
            Total in Queue: <span className="text-carbon-text font-bold">{paymentAttempts.length}</span>
          </div>
          <span>•</span>
          <div>
            Awaiting Action:{" "}
            <span className="text-warning font-bold">{pending.length} Pending</span>
          </div>
          <span>•</span>
          <div>
            Protocol Quorum: <span className="text-carbon-text">2-Stage Sequential</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span className="text-success font-medium">Policy Engine Enforced</span>
          </div>
        </div>
      </section>

      {/* 2. Metrics Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-carbon-border bg-carbon-nav rounded overflow-hidden select-none">
        <div className="p-4 border-b sm:border-b-0 sm:border-r border-carbon-border flex flex-col justify-between">
          <div className="text-[10px] font-mono uppercase tracking-wider text-carbon-muted mb-2">
            01 // TOTAL DECISIONS
          </div>
          <div>
            <div className="font-display text-2xl font-bold text-carbon-text">
              {paymentAttempts.length} <span className="text-xs font-mono font-normal text-carbon-muted">items</span>
            </div>
            <div className="font-mono text-xs text-carbon-muted mt-0.5">
              Across all stages
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-carbon-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>Full Audit Trail</span>
          </div>
        </div>

        <div className="p-4 border-b sm:border-b-0 sm:border-r border-carbon-border flex flex-col justify-between bg-warning/[0.04]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-warning mb-2">
            02 // STAGE 1: SIGNING REVIEW
          </div>
          <div>
            <div className="font-display text-2xl font-bold text-warning">
              {signingCount} <span className="text-xs font-mono font-normal text-warning/80">pending</span>
            </div>
            <div className="font-mono text-xs text-warning/90 mt-0.5">
              Terms verification sign-off
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-warning">
            <Clock className="w-3 h-3" />
            <span>Awaiting Review</span>
          </div>
        </div>

        <div className="p-4 border-b lg:border-b-0 sm:border-r border-carbon-border flex flex-col justify-between bg-warning/[0.04]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-warning mb-2">
            03 // STAGE 2: SUBMISSION
          </div>
          <div>
            <div className="font-display text-2xl font-bold text-warning">
              {submissionCount} <span className="text-xs font-mono font-normal text-warning/80">pending</span>
            </div>
            <div className="font-mono text-xs text-warning/90 mt-0.5">
              Final treasury authorization
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-warning">
            <KeyRound className="w-3 h-3" />
            <span>Awaiting HSP Dispatch</span>
          </div>
        </div>

        <div className="p-4 flex flex-col justify-between bg-success/[0.03]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-success mb-2">
            04 // COMPLETED
          </div>
          <div>
            <div className="font-display text-2xl font-bold text-success">
              {completedCount} <span className="text-xs font-mono font-normal text-success/80">dispatched</span>
            </div>
            <div className="font-mono text-xs text-success mt-0.5">
              Dispatched to HSP settlement
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-success">
            <CheckCircle2 className="w-3 h-3" />
            <span>Settlement Rail Active</span>
          </div>
        </div>
      </section>

      {/* 3. Approvals Ledger & Action Cards */}
      <section className="border border-carbon-border rounded bg-carbon-nav overflow-hidden">
        {/* Controls */}
        <div className="p-3.5 border-b border-carbon-border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-carbon-panel/60">
          <div className="flex items-center gap-1">
            {[
              { id: "ALL" as Filter, label: "All Records", count: paymentAttempts.length },
              { id: "PENDING" as Filter, label: "Needs Decision", count: pending.length, highlight: "text-warning" },
              { id: "COMPLETED" as Filter, label: "Completed", count: completedCount, highlight: "text-success" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStage(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-colors",
                  filterStage === tab.id
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
              placeholder="Search ID, agent, or payee..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-carbon-void pl-8 pr-3 py-1.5 rounded text-xs font-mono text-carbon-text border border-carbon-border focus:border-primary focus:outline-none placeholder:text-carbon-muted/60"
            />
          </div>
        </div>

        {/* Data Rows */}
        {isLoading && paymentAttempts.length === 0 ? (
          <div className="p-8 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-carbon-panel rounded animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center">
            <EmptyState
              title="No authorization requests found"
              description="Adjust your search filters or check back when new obligations require human quorum."
            />
          </div>
        ) : (
          <div className="divide-y divide-carbon-border font-mono text-xs">
            {visible.map((attempt) => {
              const group = getApprovalGroup(attempt.state);
              const isSigning = group === "signing";
              const isSubmission = group === "submission";
              const isDone = group === "completed";
              const expiry = getQuoteExpiry(attempt.quoteExpiresAt, now);

              return (
                <div
                  key={attempt.id}
                  className="p-4 bg-carbon-nav/60 hover:bg-carbon-nav transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded bg-carbon-void border border-carbon-border flex flex-col items-center justify-center font-mono text-[10px] text-carbon-muted flex-shrink-0">
                      <span className={cn("font-bold", isDone ? "text-success" : "text-warning")}>
                        #HX
                      </span>
                      <span>{attempt.id.slice(-4).toUpperCase()}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans font-semibold text-xs text-carbon-text">
                          {merchantDisplayName(attempt.approvalSummary?.merchantName ?? attempt.merchantName)}
                        </span>
                        <span className="text-[10px] text-carbon-muted bg-carbon-void px-1.5 py-0.5 rounded border border-carbon-border">
                          {formatAddress(attempt.payee)}
                        </span>
                        <span
                          className={cn(
                            "px-1.5 py-0.2 rounded text-[9px] font-mono font-medium border flex items-center gap-1",
                            isDone
                              ? "bg-success/15 text-success border-success/30"
                              : "bg-warning/15 text-warning border-warning/30"
                          )}
                        >
                          <span
                            className={cn(
                              "w-1 h-1 rounded-full",
                              isDone ? "bg-success" : "bg-warning animate-pulse"
                            )}
                          />
                          {isSigning
                            ? "STAGE 1: AWAITING SIGNING"
                            : isSubmission
                            ? "STAGE 2: AWAITING SUBMISSION"
                            : "DISPATCHED TO SETTLEMENT"}
                        </span>
                      </div>

                      <div className="text-xs text-carbon-muted mt-1">
                        Invoice ID:{" "}
                        <Link
                          href={`/app/invoices/${attempt.invoiceId}`}
                          className="text-carbon-text hover:text-primary transition-colors underline underline-offset-2"
                        >
                          {attempt.invoiceId}
                        </Link>
                      </div>

                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-carbon-muted flex-wrap">
                        {!isDone && (
                          <span
                            className={cn(
                              "flex items-center gap-1 font-mono",
                              expiry.urgency === "expired" ? "text-danger" : "text-warning"
                            )}
                          >
                            <Clock className="w-3 h-3" /> Quote Expiry: {expiry.text}
                          </span>
                        )}
                        <span>•</span>
                        <span>Evidence: Deterministic Match</span>
                        <span>•</span>
                        <span>HSP Rail: {attempt.approvalSummary?.chain || "HashKey Testnet 133"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end gap-6 flex-shrink-0">
                    <div className="text-right">
                      <div className="font-display text-lg font-bold text-carbon-text">
                        {attempt.approvalSummary.humanAmount}{" "}
                        <span className="text-xs font-mono font-normal text-carbon-muted">USDC</span>
                      </div>
                      <div className="text-[10px] text-carbon-muted">
                        State: {attempt.state}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/app/trust/${attempt.invoiceId}`}
                        className="px-3 py-1.5 rounded text-xs font-mono text-carbon-muted hover:text-carbon-text bg-carbon-panel hover:bg-carbon-void border border-carbon-border transition-colors"
                      >
                        Inspect Witness
                      </Link>
                      <Link
                        href={`/app/approvals/${attempt.id}`}
                        className={cn(
                          "px-4 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 shadow-sm transition-colors",
                          isDone
                            ? "bg-carbon-panel text-carbon-text border border-carbon-border hover:bg-carbon-void"
                            : "bg-primary text-white hover:bg-primary/90"
                        )}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>{isDone ? "View Authorization" : "Review & Authorize"}</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
