"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import { Delivery, Invoice, VerificationDecision, VerificationReasonCode } from "@/types/domain";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { formatAddress, formatMinorToUsd, formatTimestamp } from "@/lib/formatters";
import { ReasonCodeChip } from "@/components/trust/reasonCodes";
import { runInvoiceVerification, runDeliveryVerification } from "@/components/trust/evaluate";
import { evaluatePaymentEligibility } from "@/lib/verification/engine";

type VerdictFilter = "ALL" | VerificationDecision;

export default function TrustIndexPage() {
  const router = useRouter();
  const { mode, refreshKey, triggerRefresh } = useApp();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("ALL");

  const client = mode === "connected" ? connectedClient : demoClient;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        const [data, dels] = await Promise.all([
          client.getInvoices(),
          client.getDeliveries().catch((err) => {
            console.error("Failed to load deliveries for trust index:", err);
            return [] as Delivery[];
          }),
        ]);
        if (isMounted) {
          setInvoices(data);
          setDeliveries(dels);
        }
      } catch (err) {
        console.error("Failed to load invoices for trust index:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [mode, refreshKey]);

  /** Re-derive reason codes and verdicts with deterministic engine */
  const records = useMemo(
    () =>
      invoices.map((inv) => {
        const codes: VerificationReasonCode[] = [];
        let verdict: VerificationDecision = "PENDING";
        try {
          const invoiceResult = runInvoiceVerification(inv);
          codes.push(...invoiceResult.reasonCodes);
          const del = deliveries.find((d) => d.invoiceId === inv.id);
          const deliveryResult = del ? runDeliveryVerification(inv, del) : undefined;
          if (deliveryResult) codes.push(...deliveryResult.reasonCodes);
          verdict = evaluatePaymentEligibility(invoiceResult, deliveryResult).overallDecision;
        } catch (err) {
          console.error(`Failed to evaluate ${inv.id}:`, err);
        }
        return { inv, verdict, codes: Array.from(new Set(codes)) };
      }),
    [invoices, deliveries]
  );

  const counts = {
    ALL: records.length,
    PASS: records.filter((r) => r.verdict === "PASS").length,
    FAIL: records.filter((r) => r.verdict === "FAIL").length,
    PENDING: records.filter((r) => r.verdict === "PENDING").length,
  };

  const blockedMinor = records
    .filter((r) => r.verdict === "FAIL")
    .reduce((sum, r) => sum + Number(r.inv.payment.amount_minor), 0);

  const verifiedMinor = records
    .filter((r) => r.verdict === "PASS")
    .reduce((sum, r) => sum + Number(r.inv.payment.amount_minor), 0);

  const rows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter(({ inv, verdict }) => {
      const inScope = verdictFilter === "ALL" || verdict === verdictFilter;
      const matches =
        !q ||
        inv.id.toLowerCase().includes(q) ||
        inv.sellerWallet.toLowerCase().includes(q) ||
        (inv.sellerDisplayName ?? "").toLowerCase().includes(q) ||
        inv.buyerRef.toLowerCase().includes(q);
      return inScope && matches;
    });
  }, [records, searchQuery, verdictFilter]);

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-carbon-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-carbon-muted">
            <span>FORENSICS</span>
            <span>//</span>
            <span className="text-carbon-text">CRYPTOGRAPHIC AUDIT</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-carbon-text mt-0.5">
            Trust Inspector
          </h1>
          <p className="text-xs text-carbon-muted font-mono mt-1">
            Deterministic dual-gate verification checking EIP-712 commercial intent and RPC fulfillment witnesses.
          </p>
        </div>

        <button
          onClick={triggerRefresh}
          disabled={isLoading}
          className="px-3 py-1.5 rounded text-xs font-mono text-carbon-muted hover:text-carbon-text bg-carbon-nav border border-carbon-border hover:bg-carbon-panel flex items-center gap-1.5 transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
          <span>Re-evaluate</span>
        </button>
      </div>

      {/* Forensic Metrics Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-carbon-border bg-carbon-nav rounded overflow-hidden select-none">
        <div className="p-4 border-b sm:border-b-0 sm:border-r border-carbon-border flex flex-col justify-between">
          <div className="text-[10px] font-mono uppercase tracking-wider text-carbon-muted mb-2">
            01 // TOTAL AUDITED
          </div>
          <div>
            <div className="font-display text-2xl font-bold text-carbon-text">
              {counts.ALL} <span className="text-xs font-mono font-normal text-carbon-muted">records</span>
            </div>
            <div className="font-mono text-xs text-carbon-muted mt-0.5">
              100% Deterministic Engine
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-carbon-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            <span>Dual-Gate Evaluated</span>
          </div>
        </div>

        <div className="p-4 border-b sm:border-b-0 sm:border-r border-carbon-border flex flex-col justify-between bg-success/[0.03]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-success mb-2">
            02 // DETERMINISTIC MATCH
          </div>
          <div>
            <div className="font-display text-2xl font-bold text-success">
              {counts.PASS} <span className="text-xs font-mono font-normal text-success/80">passed</span>
            </div>
            <div className="font-mono text-xs text-success/90 mt-0.5">
              {formatMinorToUsd(verifiedMinor)} <span className="text-[10px]">USDC</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-success">
            <CheckCircle2 className="w-3 h-3" />
            <span>Eligible for Human Approval</span>
          </div>
        </div>

        <div className="p-4 border-b lg:border-b-0 sm:border-r border-carbon-border flex flex-col justify-between bg-danger/[0.04]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-danger mb-2">
            03 // INTERCEPTED THREATS
          </div>
          <div>
            <div className="font-display text-2xl font-bold text-danger">
              {counts.FAIL} <span className="text-xs font-mono font-normal text-danger/80">quarantined</span>
            </div>
            <div className="font-mono text-xs text-danger/90 mt-0.5">
              {formatMinorToUsd(blockedMinor)} <span className="text-[10px]">USDC</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-danger">
            <XCircle className="w-3 h-3" />
            <span>Payment Permanently Blocked</span>
          </div>
        </div>

        <div className="p-4 flex flex-col justify-between">
          <div className="text-[10px] font-mono uppercase tracking-wider text-carbon-muted mb-2">
            04 // PENDING EVIDENCE
          </div>
          <div>
            <div className="font-display text-2xl font-bold text-carbon-text">
              {counts.PENDING} <span className="text-xs font-mono font-normal text-carbon-muted">held</span>
            </div>
            <div className="font-mono text-xs text-carbon-muted mt-0.5">
              Awaiting RPC / Delivery Manifest
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-carbon-muted">
            <Clock className="w-3 h-3" />
            <span>Fulfillment Gate Pending</span>
          </div>
        </div>
      </section>

      {/* Forensic Ledger Table */}
      <section className="border border-carbon-border rounded bg-carbon-nav overflow-hidden">
        {/* Controls Bar */}
        <div className="p-3.5 border-b border-carbon-border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-carbon-panel/60">
          <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto">
            {[
              { id: "ALL" as VerdictFilter, label: "All Audits", count: counts.ALL },
              { id: "PASS" as VerdictFilter, label: "Verified", count: counts.PASS, color: "text-success" },
              { id: "FAIL" as VerdictFilter, label: "Blocked / Quarantined", count: counts.FAIL, color: "text-danger" },
              { id: "PENDING" as VerdictFilter, label: "Pending Fulfillment", count: counts.PENDING, color: "text-carbon-muted" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setVerdictFilter(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-colors shrink-0",
                  verdictFilter === tab.id
                    ? "bg-carbon-void text-carbon-text border border-carbon-border shadow-sm"
                    : cn("text-carbon-muted hover:text-carbon-text hover:bg-carbon-panel/40", tab.color)
                )}
              >
                <span>{tab.label}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-carbon-void text-[10px] text-carbon-muted border border-carbon-border/60">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-carbon-muted" />
            <input
              type="text"
              placeholder="Search invoice or wallet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-carbon-void pl-8 pr-3 py-1.5 rounded text-xs font-mono text-carbon-text border border-carbon-border focus:border-primary focus:outline-none placeholder:text-carbon-muted/60"
            />
          </div>
        </div>

        {/* High-Density Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-carbon-void/80 text-[10px] font-mono uppercase tracking-wider text-carbon-muted border-b border-carbon-border">
                <th className="py-3 px-4 font-semibold">Obligation</th>
                <th className="py-3 px-4 font-semibold">Counterparty Agent</th>
                <th className="py-3 px-4 font-semibold text-right">Stake (USDC)</th>
                <th className="py-3 px-4 font-semibold">Cryptographic Verdict</th>
                <th className="py-3 px-4 font-semibold">Forensic Reasons</th>
                <th className="py-3 px-4 font-semibold text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-carbon-border text-xs font-mono">
              {isLoading && records.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="p-4">
                      <div className="h-4 rounded bg-carbon-panel animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <EmptyState
                      title="No matching forensic records"
                      description="Adjust your search filters or check your network mode."
                    />
                  </td>
                </tr>
              ) : (
                rows.map(({ inv, verdict, codes }) => {
                  const isPass = verdict === "PASS";
                  const isFail = verdict === "FAIL";
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => router.push(`/app/trust/${inv.id}`)}
                      className="hover:bg-carbon-panel/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`/app/trust/${inv.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-bold text-carbon-text group-hover:text-primary transition-colors"
                        >
                          {inv.id}
                        </Link>
                        <div className="text-[10px] text-carbon-muted">
                          {formatTimestamp(inv.issuedAt).replace(" UTC", "")}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-sans font-medium text-carbon-text truncate max-w-[200px]">
                          {inv.sellerDisplayName || "Agent"}
                        </div>
                        <div className="text-[10px] text-carbon-muted font-mono">
                          {formatAddress(inv.sellerWallet)}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-carbon-text">
                          {formatMinorToUsd(inv.payment.amount_minor)}
                        </div>
                        <div className="text-[10px] text-carbon-muted">USDC</div>
                      </td>

                      <td className="py-3 px-4">
                        {isPass ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-success/15 text-success border border-success/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-success" />
                            VERIFIED MATCH
                          </span>
                        ) : isFail ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-danger/15 text-danger border border-danger/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                            BLOCKED / QUARANTINE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono text-carbon-muted bg-carbon-void border border-carbon-border">
                            <Clock className="w-3 h-3 text-carbon-muted" />
                            AWAITING EVIDENCE
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 flex-wrap max-w-xs">
                          {codes.length === 0 ? (
                            <span className="text-[10px] text-carbon-muted">All checks conformant</span>
                          ) : (
                            codes.map((code) => <ReasonCodeChip key={code} code={code} />)
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
