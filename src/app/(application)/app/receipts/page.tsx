"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Receipt,
  Search,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import { VerifiableReceipt } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { formatAddress, formatHash, formatTimestamp } from "@/lib/formatters";

export default function ReceiptsIndexPage() {
  const { mode, refreshKey } = useApp();
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

  const filteredReceipts = receipts.filter(
    (r) =>
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.invoiceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.seller.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.buyerRef.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <Receipt className="w-6 h-6 text-primary-light" />
            <span>Verifiable Commercial Receipts</span>
          </h1>
          <p className="text-xs text-foreground-secondary mt-1">
            Immutable cryptographic receipts binding signed intent, verified fulfillment telemetry, and finalized HSP settlement.
          </p>
        </div>
      </div>

      {/* Control bar */}
      <div className="p-4 rounded-xl border border-border bg-surface-1 flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input
            type="text"
            placeholder="Search by receipt ID, invoice ID, or seller..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-surface-2 border border-border text-foreground placeholder:text-foreground-muted font-mono focus:outline-none focus:border-primary"
          />
        </div>
        <span className="text-xs font-mono text-foreground-muted">
          Total Reconciled: {receipts.length}
        </span>
      </div>

      {/* Receipts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredReceipts.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-foreground-muted text-xs">
            No finalized receipts found. Complete an HSP settlement to generate a verifiable receipt.
          </div>
        ) : (
          filteredReceipts.map((rcpt) => (
            <div
              key={rcpt.id}
              className="p-5 rounded-xl border border-border bg-surface-1 hover:border-primary/50 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-foreground block">
                      {rcpt.id}
                    </span>
                    <span className="text-[11px] font-mono text-foreground-muted">
                      Invoice: {rcpt.invoiceId}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-success/10 text-success border border-success/30 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> FINALIZED
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-surface-2 border border-border text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Amount Settled:</span>
                    <span className="font-bold text-foreground">{rcpt.payment.humanAmount}</span>
                  </div>
                  <div className="flex justify-between text-foreground-secondary text-[11px]">
                    <span>Seller:</span>
                    <CopyableValue value={rcpt.seller} displayText={formatAddress(rcpt.seller)} />
                  </div>
                  <div className="flex justify-between text-foreground-secondary text-[11px]">
                    <span>HSP Tx:</span>
                    <CopyableValue
                      value={rcpt.payment.txHash}
                      displayText={formatHash(rcpt.payment.txHash)}
                      explorerUrl={`https://testnet.hsk.xyz/tx/${rcpt.payment.txHash}`}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                <span className="text-[11px] font-mono text-foreground-muted">
                  Issued: {formatTimestamp(rcpt.issuedAt).split(" ")[0]}
                </span>
                <Link href={`/app/receipts/${rcpt.id}`}>
                  <Button variant="secondary" size="sm" className="gap-1.5 text-xs">
                    <span>Inspect Receipt</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
