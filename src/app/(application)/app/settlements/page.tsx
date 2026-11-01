"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Coins,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import { PaymentAttempt } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { formatAddress, formatHash, formatTimestamp, getHSPStatusMeta } from "@/lib/formatters";

export default function SettlementExplorerIndexPage() {
  const { mode, refreshKey } = useApp();
  const [paymentAttempts, setPaymentAttempts] = useState<PaymentAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

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

  const filteredAttempts = paymentAttempts.filter((p) => {
    const matchesSearch =
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.flowId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.paymentRequestId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.payer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.payee.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || p.hspStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <Coins className="w-6 h-6 text-primary-light" />
            <span>Settlement Explorer</span>
          </h1>
          <p className="text-xs text-foreground-secondary mt-1">
            Reconciled HSP agentic payment states, HashKey Chain transaction confirmations, and immutable evidence hashes.
          </p>
        </div>
      </div>

      {/* Control bar */}
      <div className="p-4 rounded-xl border border-border bg-surface-1 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input
            type="text"
            placeholder="Search by Payment ID, Flow ID, or wallet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-surface-2 border border-border text-foreground placeholder:text-foreground-muted font-mono focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-muted">HSP Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by HSP status"
            className="py-1.5 px-3 text-xs rounded-lg bg-surface-2 border border-border text-foreground font-mono focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="ALL">All States ({paymentAttempts.length})</option>
            <option value="payment-finalized">Finalized</option>
            <option value="payment-safe">Safe (On-Chain Unfinalized)</option>
            <option value="payment-processing">Processing</option>
            <option value="payment-submitted">Submitted</option>
            <option value="payment-failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Settlements Table */}
      <div className="rounded-xl border border-border bg-surface-1 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2/60 text-foreground-muted border-b border-border font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Attempt ID</th>
                <th className="py-3.5 px-4">HSP Identifiers</th>
                <th className="py-3.5 px-4">Payer / Payee</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">HSP Rail Status</th>
                <th className="py-3.5 px-4">Tx Hash</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAttempts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-foreground-muted">
                    No settlement records found.
                  </td>
                </tr>
              ) : (
                filteredAttempts.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-foreground">
                      <Link
                        href={`/app/settlements/${p.id}`}
                        className="hover:text-primary-light transition-colors"
                      >
                        {p.id}
                      </Link>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-foreground-secondary">
                      <div>Flow: {p.flowId}</div>
                      <div className="text-foreground-muted">Req: {p.paymentRequestId}</div>
                    </td>

                    <td className="py-3.5 px-4 text-[11px]">
                      <div className="flex flex-col font-mono">
                        <span className="text-foreground-muted">From: {formatAddress(p.payer)}</span>
                        <span className="text-foreground">To: {formatAddress(p.payee)}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-foreground">
                        {p.approvalSummary.humanAmount}
                      </div>
                      <span className="text-[10px] font-mono text-foreground-muted block">
                        Raw: {p.tokenTotalRaw}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <StatusBadge status={p.hspStatus} type="hsp" size="sm" />
                    </td>

                    <td className="py-3.5 px-4 font-mono">
                      {p.txHash ? (
                        <CopyableValue
                          value={p.txHash}
                          displayText={formatHash(p.txHash)}
                          explorerUrl={`https://testnet.hsk.xyz/tx/${p.txHash}`}
                        />
                      ) : (
                        <span className="text-foreground-muted italic">Pending broadcast</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link href={`/app/settlements/${p.id}`}>
                        <Button variant="secondary" size="sm" className="h-7 px-2.5 text-xs">
                          Inspect
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
