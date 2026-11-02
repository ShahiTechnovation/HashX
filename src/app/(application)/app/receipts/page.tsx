"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, RefreshCw, Receipt } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { LiveReceipts } from "@/components/live/receipts/LiveReceipts";
import { demoClient, connectedClient } from "@/lib/api/client";
import { VerifiableReceipt } from "@/types/domain";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { PageHeader, MetaItem } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { SearchInput } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SimulatedBadge } from "@/components/live/common";
import { cn } from "@/lib/utils";
import { formatAddress, formatTimestamp } from "@/lib/formatters";

/** Connected mode renders only real backend records; demo mode keeps the simulated fixture view. */
export default function ReceiptsPage() {
  const { mode } = useApp();
  return mode === "connected" ? <LiveReceipts /> : <DemoReceiptsIndexPage />;
}

function DemoReceiptsIndexPage() {
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
      <PageHeader
        eyebrow="Settlement records"
        title="Receipts"
        badges={<SimulatedBadge />}
        description="Each receipt binds the signed invoice, the verified delivery evidence, the payer's authorization, and the settlement it was issued against."
        meta={<MetaItem label="Receipts">{isLoading && receipts.length === 0 ? "—" : receipts.length}</MetaItem>}
        actions={
          <Button variant="secondary" size="sm" onClick={triggerRefresh} disabled={isLoading}>
            <RefreshCw className={cn(isLoading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <Panel>
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[13px] text-foreground-secondary">
            {searchQuery ? `${filteredReceipts.length} of ${receipts.length} receipts` : "All receipts"}
          </p>
          <SearchInput
            wrapperClassName="w-full sm:w-80"
            aria-label="Search receipts"
            placeholder="Search by receipt, invoice, or seller"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="table-base min-w-[760px]">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Seller</th>
                <th className="text-right">Amount</th>
                <th>Evidence digest</th>
                <th>Settlement</th>
                <th className="w-10"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && receipts.length === 0 ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6}>
                      <div className="h-4 rounded bg-surface-3" />
                    </td>
                  </tr>
                ))
              ) : filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      icon={<Receipt className="h-[18px] w-[18px]" />}
                      title={searchQuery ? "No receipts match your search" : "No receipts yet"}
                      description={
                        searchQuery
                          ? "Try a receipt ID, invoice ID, or seller name."
                          : "Receipts are issued automatically once an obligation reaches finalized settlement."
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((rcpt) => (
                  <tr
                    key={rcpt.id}
                    onClick={() => router.push(`/app/receipts/${rcpt.id}`)}
                    className="group cursor-pointer hover:bg-surface-2/60"
                  >
                    <td>
                      <Link
                        href={`/app/receipts/${rcpt.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="whitespace-nowrap font-mono text-xs text-foreground hover:text-primary-light hover:underline"
                      >
                        {rcpt.id}
                      </Link>
                      <div className="mt-0.5 whitespace-nowrap text-xs text-foreground-muted tabular-nums">
                        {formatTimestamp(rcpt.issuedAt).replace(" UTC", "")}
                      </div>
                    </td>
                    <td>
                      <div className="max-w-[220px] truncate text-foreground">{rcpt.sellerDisplayName || "Seller agent"}</div>
                      <div className="mt-0.5 font-mono text-xs text-foreground-muted">{rcpt.invoiceId}</div>
                    </td>
                    <td className="text-right">
                      <div className="font-medium tabular-nums text-foreground">{rcpt.payment.humanAmount}</div>
                      <div className="mt-0.5 font-mono text-xs text-foreground-muted">{rcpt.payment.tokenTotalRaw} raw</div>
                    </td>
                    <td>
                      <span className="font-mono text-xs text-foreground-secondary" title={rcpt.deliveryEvidenceDigest}>
                        {formatAddress(rcpt.deliveryEvidenceDigest, 8)}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={rcpt.payment.hspStatus} type="hsp" size="sm" />
                    </td>
                    <td className="text-right">
                      <ChevronRight
                        aria-hidden="true"
                        className="ml-auto h-4 w-4 text-foreground-muted opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
