"use client";

import React from "react";
import Link from "next/link";
import { useApp } from "@/providers/AppContext";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { LiveError, LiveGate, PaymentStateBadge, TestnetBadge, TxLink, shortAddr, tokenAmount, useLiveQuery } from "@/components/live/common";
import { fmtTime, networkLabel } from "./shared";

export function LiveSettlements() {
  return (
    <LiveGate purpose="Settlements are listed for the payment attempts you participate in.">
      <SettlementsInner />
    </LiveGate>
  );
}

function SettlementsInner() {
  const { liveApi } = useApp();
  const q = useLiveQuery(() => liveApi.listPayments(), [liveApi]);
  const rows = [...(q.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Connected mode · Settlement verification"
        title="Settlements"
        description="Every payment attempt you participate in. A settlement counts only after HashX independently verifies the Test USDC Transfer on Sepolia Testnet and the confirmation policy is met."
        actions={
          <Button variant="secondary" size="sm" onClick={q.reload} isLoading={q.loading}>
            Refresh
          </Button>
        }
      />

      {q.error ? <LiveError error={q.error} title="Could not load payments" onRetry={q.reload} /> : null}

      <Panel>
        {q.loading && !q.data ? (
          <PanelBody className="h-40 animate-pulse" />
        ) : q.data && rows.length === 0 ? (
          <PanelBody>
            <EmptyState
              title="No payment attempts yet"
              description="Payment attempts appear after a buyer requests payment for an invoice whose delivery passed verification."
            />
          </PanelBody>
        ) : rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-2xs uppercase tracking-wider text-foreground-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium sm:px-5">Attempt</th>
                  <th className="px-3 py-2.5 font-medium">State</th>
                  <th className="px-3 py-2.5 font-medium">Network</th>
                  <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Transaction</th>
                  <th className="px-4 py-2.5 font-medium sm:px-5">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2/40">
                    <td className="px-4 py-3 sm:px-5">
                      <Link href={`/app/settlements/${p.id}`} className="font-mono text-foreground hover:text-primary-light hover:underline">
                        {p.id}
                      </Link>
                      <div className="mt-0.5 font-mono text-2xs text-foreground-muted">
                        {shortAddr(p.payer)} → {shortAddr(p.payee)}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <PaymentStateBadge state={p.state} />
                      {p.rail === "legacy-v1" && <div className="mt-1 text-2xs text-warning">Legacy v1 — not verified</div>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-foreground-secondary">{networkLabel(p.chainId, p.network)}</div>
                      <TestnetBadge chainId={p.chainId} className="mt-1" />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="font-medium text-foreground">{tokenAmount(p.tokenTotalRaw, p.tokenDecimals, p.tokenSymbol, p.chainId)}</div>
                      <div className="font-mono text-2xs text-foreground-muted">{p.tokenTotalRaw} raw</div>
                    </td>
                    <td className="px-3 py-3">
                      <TxLink chainId={p.chainId} hash={p.txHash} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-foreground-muted sm:px-5">{fmtTime(p.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
