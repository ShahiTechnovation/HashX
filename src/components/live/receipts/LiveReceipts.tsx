"use client";

import React from "react";
import Link from "next/link";
import type { ReceiptBody } from "@shared/protocol";
import { useApp } from "@/providers/AppContext";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { toneStyles } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { LiveError, LiveGate, TestnetBadge, TxLink, tokenAmount, useLiveQuery } from "@/components/live/common";
import type { LiveReceipt } from "@/lib/live/types";
import { fmtTime } from "@/components/live/payments/shared";

export function LiveReceipts() {
  return (
    <LiveGate purpose="Receipts are listed for the settlements you participate in.">
      <ReceiptsInner />
    </LiveGate>
  );
}

function receiptStatus(r: LiveReceipt): { label: string; tone: keyof typeof toneStyles } {
  if (r.revokedAt) return { label: "Revoked", tone: "danger" };
  if (r.legacy) return { label: "Legacy v1 · not verified", tone: "warning" };
  return { label: "Issued · verified transfer", tone: "success" };
}

function ReceiptsInner() {
  const { liveApi } = useApp();
  const q = useLiveQuery(() => liveApi.listReceipts(), [liveApi]);
  const rows = [...(q.data ?? [])].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Connected mode · Receipts"
        title="Receipts"
        description="Portable hashx.receipt.v2 documents. Each binds the signed invoice, verified delivery, the payer's EIP-712 authorization and the independently verified Test USDC Transfer on Sepolia Testnet."
        actions={
          <Button variant="secondary" size="sm" onClick={q.reload} isLoading={q.loading}>
            Refresh
          </Button>
        }
      />

      {q.error ? <LiveError error={q.error} title="Could not load receipts" onRetry={q.reload} /> : null}

      <Panel>
        {q.loading && !q.data ? (
          <PanelBody className="h-40 animate-pulse" />
        ) : q.data && rows.length === 0 ? (
          <PanelBody>
            <EmptyState
              title="No receipts yet"
              description="Receipts appear only after a settlement is independently verified on-chain and its confirmation policy is met."
            />
          </PanelBody>
        ) : rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-2xs uppercase tracking-wider text-foreground-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium sm:px-5">Receipt</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Network</th>
                  <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Transaction</th>
                  <th className="px-4 py-2.5 font-medium sm:px-5">Issued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const st = receiptStatus(r);
                  const s = (r.document as Partial<ReceiptBody> | null)?.settlement;
                  const chainId = s?.chainId ?? r.chainId;
                  return (
                    <tr key={r.id} className="hover:bg-surface-2/40">
                      <td className="px-4 py-3 sm:px-5">
                        <Link href={`/app/receipts/${r.id}`} className="font-mono text-foreground hover:text-primary-light hover:underline">
                          {r.id}
                        </Link>
                        <div className="mt-0.5 font-mono text-2xs text-foreground-muted">invoice {r.invoiceId}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium ring-1", toneStyles[st.tone].badge)}>{st.label}</span>
                      </td>
                      <td className="px-3 py-3">
                        <TestnetBadge chainId={chainId} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        {s ? (
                          <>
                            <div className="font-medium text-foreground">{tokenAmount(s.amount, s.tokenDecimals, s.tokenSymbol, chainId)}</div>
                            <div className="font-mono text-2xs text-foreground-muted">{s.amount} raw</div>
                          </>
                        ) : (
                          <span className="text-foreground-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <TxLink chainId={chainId} hash={s?.txHash ?? r.txHash} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-foreground-muted sm:px-5">{fmtTime(r.issuedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
