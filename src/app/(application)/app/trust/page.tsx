"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import { Invoice } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { formatAddress, formatTimestamp } from "@/lib/formatters";

export default function TrustIndexPage() {
  const { mode, refreshKey } = useApp();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [verdictFilter, setVerdictFilter] = useState("ALL");

  const client = mode === "connected" ? connectedClient : demoClient;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        const data = await client.getInvoices();
        if (isMounted) setInvoices(data);
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

  const filteredInvoices = invoices.filter((inv) => {
    const isPass = inv.status === "VERIFIED" || inv.status === "DELIVERY_ACCEPTED" || inv.status === "SETTLED";
    const isFail = inv.status === "REJECTED" || inv.status === "DELIVERY_REJECTED";
    const isPending = !isPass && !isFail;

    const matchesFilter =
      verdictFilter === "ALL" ||
      (verdictFilter === "PASS" && isPass) ||
      (verdictFilter === "FAIL" && isFail) ||
      (verdictFilter === "PENDING" && isPending);

    const matchesSearch =
      inv.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.sellerWallet.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.buyerRef.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-primary-light" />
            <span>Trust Inspector Index</span>
          </h1>
          <p className="text-xs text-foreground-secondary mt-1">
            Deterministic cryptographic validation, evidence commitment digests, and payment gating verdicts.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl border border-border bg-surface-1 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input
            type="text"
            placeholder="Search invoice or wallet address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-surface-2 border border-border text-foreground placeholder:text-foreground-muted font-mono focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-muted">Verdict:</span>
          <select
            value={verdictFilter}
            onChange={(e) => setVerdictFilter(e.target.value)}
            aria-label="Filter by verdict"
            className="py-1.5 px-3 text-xs rounded-lg bg-surface-2 border border-border text-foreground font-mono focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="ALL">All Verdicts</option>
            <option value="PASS">PASS (Verified)</option>
            <option value="FAIL">FAIL (Blocked)</option>
            <option value="PENDING">PENDING</option>
          </select>
        </div>
      </div>

      {/* Records Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredInvoices.map((inv) => {
          const isPass = inv.status === "VERIFIED" || inv.status === "DELIVERY_ACCEPTED" || inv.status === "SETTLED";
          const isFail = inv.status === "REJECTED" || inv.status === "DELIVERY_REJECTED";
          const verdict = isFail ? "FAIL" : isPass ? "PASS" : "PENDING";

          return (
            <div
              key={inv.id}
              className={`p-5 rounded-xl border transition-all duration-200 bg-surface-1 flex flex-col justify-between ${
                isFail
                  ? "border-danger/40 hover:border-danger/70 shadow-[0_0_15px_rgba(237,112,130,0.08)]"
                  : isPass
                  ? "border-border hover:border-primary/50"
                  : "border-border/60"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono font-bold text-foreground block">
                      {inv.id}
                    </span>
                    <span className="text-[11px] text-foreground-muted font-mono">
                      {inv.buyerRef}
                    </span>
                  </div>
                  <StatusBadge status={verdict} type="verdict" size="sm" />
                </div>

                <div className="p-3 rounded-lg bg-surface-2 border border-border/80 text-xs space-y-1">
                  <div className="text-foreground-secondary flex justify-between">
                    <span>Seller:</span>
                    <span className="font-medium text-foreground">{inv.sellerDisplayName || "Seller"}</span>
                  </div>
                  <div className="text-foreground-secondary flex justify-between">
                    <span>Amount:</span>
                    <AmountDisplay amountMinor={inv.payment.amount_minor} size="sm" />
                  </div>
                  <div className="text-foreground-secondary flex justify-between">
                    <span>Service:</span>
                    <span className="font-mono">{inv.service.type}</span>
                  </div>
                </div>

                {isFail && (
                  <div className="p-2.5 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-1.5 font-mono font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Payment Blocked by Policy</span>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                <span className="text-[11px] font-mono text-foreground-muted">
                  {formatTimestamp(inv.issuedAt).split(" ")[0]}
                </span>
                <Link href={`/app/trust/${inv.id}`}>
                  <Button variant="secondary" size="sm" className="gap-1.5 text-xs">
                    <span>Inspect Evidence</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
