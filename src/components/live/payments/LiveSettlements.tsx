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
            <table className="table-base min-w-[820px]">
              <thead>
                <tr>
                  <th>Attempt</th>
                  <th>State</th>
                  <th>Network</th>
                  <th className="text-right">Amount</th>
                  <th>Transaction</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2/60">
                    <td>
                      <Link href={`/app/settlements/${p.id}`} className="font-mono text-xs font-medium text-foreground hover:text-primary-light hover:underline">
                        {p.id}
                      </Link>
                      <div className="mt-0.5 font-mono text-2xs text-foreground-muted">
                        {shortAddr(p.payer)} → {shortAddr(p.payee)}
                      </div>
                    </td>
                    <td>
                      <PaymentStateBadge state={p.state} />
                      {p.rail === "legacy-v1" && <div className="mt-1 text-2xs text-warning">Legacy v1 — not verified</div>}
                    </td>
                    <td>
                      <div className="text-foreground-secondary">{networkLabel(p.chainId, p.network)}</div>
                      <TestnetBadge chainId={p.chainId} className="mt-1" />
                    </td>
                    <td className="text-right">
                      <div className="font-medium tabular-nums text-foreground">{tokenAmount(p.tokenTotalRaw, p.tokenDecimals, p.tokenSymbol, p.chainId)}</div>
                      <div className="font-mono text-2xs text-foreground-muted">{p.tokenTotalRaw} raw</div>
                    </td>
                    <td>
                      <TxLink chainId={p.chainId} hash={p.txHash} />
                    </td>
                    <td className="whitespace-nowrap text-xs tabular-nums text-foreground-muted">{fmtTime(p.updatedAt)}</td>
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
