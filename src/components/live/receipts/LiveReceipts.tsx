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
        eyebrow="Settlement records · connected"
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
          <PanelBody className="space-y-3" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-4 rounded bg-surface-3" />
            ))}
          </PanelBody>
        ) : q.data && rows.length === 0 ? (
          <PanelBody>
            <EmptyState
              title="No receipts yet"
              description="Receipts appear only after a settlement is independently verified on-chain and its confirmation policy is met."
            />
          </PanelBody>
        ) : rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[860px]">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Status</th>
                  <th>Network</th>
                  <th className="text-right">Amount</th>
                  <th>Transaction</th>
                  <th>Issued</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const st = receiptStatus(r);
                  const s = (r.document as Partial<ReceiptBody> | null)?.settlement;
                  const chainId = s?.chainId ?? r.chainId;
                  return (
                    <tr key={r.id} className="hover:bg-surface-2/60">
                      <td>
                        <Link href={`/app/receipts/${r.id}`} className="whitespace-nowrap font-mono text-xs text-foreground hover:text-primary-light hover:underline">
                          {r.id}
                        </Link>
                        <div className="mt-0.5 text-xs text-foreground-muted">Invoice <span className="font-mono">{r.invoiceId}</span></div>
                      </td>
                      <td>
                        <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", toneStyles[st.tone].badge)}>
                          <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", toneStyles[st.tone].dot)} />
                          {st.label}
                        </span>
                      </td>
                      <td>
                        <TestnetBadge chainId={chainId} />
                      </td>
                      <td className="text-right">
                        {s ? (
                          <>
                            <div className="font-medium tabular-nums text-foreground">{tokenAmount(s.amount, s.tokenDecimals, s.tokenSymbol, chainId)}</div>
                            <div className="mt-0.5 font-mono text-xs text-foreground-muted">{s.amount} raw</div>
                          </>
                        ) : (
                          <span className="text-foreground-muted">—</span>
                        )}
                      </td>
                      <td>
                        <TxLink chainId={chainId} hash={s?.txHash ?? r.txHash} />
                      </td>
                      <td className="whitespace-nowrap text-xs tabular-nums text-foreground-muted">{fmtTime(r.issuedAt)}</td>
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
