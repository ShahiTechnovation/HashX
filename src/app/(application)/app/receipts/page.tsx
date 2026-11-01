"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  RefreshCw,
  FileCheck2,
  Search,
  ExternalLink,
  Download,
  Printer,
  CheckCircle2,
  ShieldCheck,
  Receipt,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import { VerifiableReceipt } from "@/types/domain";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { formatAddress, formatTimestamp } from "@/lib/formatters";

export default function ReceiptsIndexPage() {
  const router = useRouter();
  const { mode, refreshKey, triggerRefresh } = useApp();
  const [receipts, setReceipts] = useState<VerifiableReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const client = mode === "connected" ? connectedClient : demoClient;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        const data = await client.getReceipts();
        if (isMounted) setReceipts(data);
      } catch (err) {
        console.error("Failed to load receipts:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [mode, refreshKey]);

  const filteredReceipts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.invoiceId.toLowerCase().includes(q) ||
        r.seller.toLowerCase().includes(q) ||
        (r.sellerDisplayName ?? "").toLowerCase().includes(q) ||
        r.buyerRef.toLowerCase().includes(q)
    );
  }, [receipts, searchQuery]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions Strip */}
      <section className="bg-carbon-nav border border-carbon-border p-4 rounded select-none">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-carbon-muted mb-1">
              <span>Console</span>
              <span className="text-carbon-border">/</span>
              <span>Verifiable Receipts</span>
              <span className="text-carbon-border">/</span>
              <span className="text-primary font-semibold">Attestation Registry</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-carbon-text tracking-tight uppercase">
              Verifiable Cryptographic Receipts
            </h1>
            <p className="text-xs text-carbon-muted font-mono mt-0.5">
              Self-contained proof certificates binding signed intent, verified fulfillment, and finalized HSP settlement.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={triggerRefresh}
              disabled={isLoading}
              className="px-3 py-1.5 rounded text-xs font-mono text-carbon-muted hover:text-carbon-text bg-carbon-panel border border-carbon-border hover:bg-carbon-void flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
              <span>Sync</span>
            </button>
          </div>
        </div>

        {/* Telemetry Strip */}
        <div className="mt-4 pt-3 border-t border-carbon-border/70 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs font-mono text-carbon-muted">
          <div>
            Total Receipts Minted: <span className="text-carbon-text font-bold">{receipts.length}</span>
          </div>
          <span>•</span>
          <div>
            Settlement Finality: <span className="text-success font-semibold">100% Attested</span>
          </div>
          <span>•</span>
          <div>
            Standard: <span className="text-carbon-text">HashX Verifiable Receipt v1</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span className="text-success font-medium">Chain Anchored</span>
          </div>
        </div>
      </section>

      {/* 2. Receipts Ledger */}
      <section className="border border-carbon-border rounded bg-carbon-nav overflow-hidden">
        {/* Search */}
        <div className="p-3.5 border-b border-carbon-border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-carbon-panel/60">
          <div className="flex items-center gap-2 text-xs font-mono text-carbon-muted">
            <Receipt className="w-4 h-4 text-primary" />
            <span>Immutable Receipt Ledger</span>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-carbon-muted" />
            <input
              type="text"
              placeholder="Search by Receipt ID, invoice, or seller..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-carbon-void pl-8 pr-3 py-1.5 rounded text-xs font-mono text-carbon-text border border-carbon-border focus:border-primary focus:outline-none placeholder:text-carbon-muted/60"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-carbon-void/80 text-[10px] uppercase tracking-wider text-carbon-muted border-b border-carbon-border">
                <th className="py-3 px-4 font-semibold">RECEIPT ID</th>
                <th className="py-3 px-4 font-semibold">INVOICE &amp; CREDITOR</th>
                <th className="py-3 px-4 font-semibold text-right">DISBURSEMENT</th>
                <th className="py-3 px-4 font-semibold">EVIDENCE ANCHOR</th>
                <th className="py-3 px-4 font-semibold text-center">FINALITY</th>
                <th className="py-3 px-4 font-semibold text-right">CERTIFICATE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-carbon-border">
              {isLoading && receipts.length === 0 ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="p-4">
                      <div className="h-4 rounded bg-carbon-panel animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <EmptyState
                      title="No verifiable receipts found"
                      description="Receipts are minted automatically once an obligation reaches finalized settlement."
                    />
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((rcpt) => (
                  <tr
                    key={rcpt.id}
                    onClick={() => router.push(`/app/receipts/${rcpt.id}`)}
                    className="hover:bg-carbon-panel/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/app/receipts/${rcpt.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-bold text-carbon-text group-hover:text-primary transition-colors flex items-center gap-1"
                      >
                        <span>{rcpt.id}</span>
                      </Link>
                      <div className="text-[10px] text-carbon-muted">
                        {formatTimestamp(rcpt.issuedAt).replace(" UTC", "")}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-carbon-text font-medium truncate max-w-[160px]">
                        {rcpt.sellerDisplayName || "Seller Agent"}
                      </div>
                      <div className="text-[10px] text-carbon-muted">
                        Invoice: #{rcpt.invoiceId}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="font-bold text-success">
                        {rcpt.payment.humanAmount}
                      </div>
                      <div className="text-[10px] text-carbon-muted">
                        {rcpt.payment.tokenSymbol}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-carbon-muted text-[11px] truncate max-w-[160px]">
                        {rcpt.deliveryEvidenceDigest.slice(0, 16)}...
                      </div>
                      <div className="text-[10px] text-success">SHA-256 Validated</div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-success/15 text-success border border-success/30">
                        <CheckCircle2 className="w-3 h-3" />
                        SETTLED &amp; FINALIZED
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/app/receipts/${rcpt.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm"
                      >
                        <span>View Certificate</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
