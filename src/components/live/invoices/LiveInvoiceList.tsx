"use client";

import React from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { buttonStyles, Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LiveError, LiveGate, TestnetBadge, shortAddr, tokenAmount, useLiveQuery } from "@/components/live/common";
import { formatDateTime } from "@/components/live/trust/verdict";
import { LegacyBadge, RoleBadge, counterpartyOf, isLegacy } from "./shared";

export function LiveInvoiceList() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Connected mode · HashX backend"
        title="Invoices"
        description="Protocol v2 invoices where your wallet is the seller or the buyer. Amounts are Test USDC on Sepolia Testnet and have no monetary value."
        actions={
          <Link href="/app/invoices/new" className={buttonStyles({ size: "sm" })}>
            <Plus className="w-3.5 h-3.5" />
            Create invoice
          </Link>
        }
      />
      <LiveGate purpose="Invoices are only visible to their seller and buyer.">
        <InvoiceTable />
      </LiveGate>
    </div>
  );
}

function InvoiceTable() {
  const { liveApi } = useApp();
  const { data, error, loading, reload } = useLiveQuery(() => liveApi.listInvoices(), [liveApi]);

  if (error) return <LiveError error={error} title="Could not load invoices" onRetry={reload} />;

  const invoices = data ?? [];
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border">
        <span className="text-xs text-foreground-muted">
          {loading && !data ? "Loading…" : `${invoices.length} invoice${invoices.length === 1 ? "" : "s"} · backend persisted`}
        </span>
        <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className={loading ? "w-3.5 h-3.5 animate-spin" : "w-3.5 h-3.5"} />
          Refresh
        </Button>
      </div>
      {loading && !data ? (
        <div className="p-5 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-5 rounded bg-surface-2 animate-pulse" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="No invoice on the HashX backend lists your wallet as seller or buyer. Create one to bill a buyer wallet in Test USDC."
          action={
            <Link href="/app/invoices/new" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              Create invoice
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-2xs uppercase tracking-wider text-foreground-muted">
                <th className="py-2.5 px-4 font-medium">Invoice</th>
                <th className="py-2.5 px-4 font-medium">Your role</th>
                <th className="py-2.5 px-4 font-medium">Counterparty</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
                <th className="py-2.5 px-4 font-medium">Settlement</th>
                <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                <th className="py-2.5 px-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {invoices.map((inv) => {
                const cp = counterpartyOf(inv);
                return (
                  <tr key={inv.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="py-3 px-4">
                      <Link href={`/app/invoices/${inv.id}`} className="font-mono text-primary-light hover:underline">
                        {inv.id}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <RoleBadge role={inv.viewerRole} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-foreground-secondary">{cp.label}</div>
                      <div className="font-mono text-2xs text-foreground-muted" title={cp.wallet ?? undefined}>
                        {shortAddr(cp.wallet)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={inv.status} type="invoice" size="sm" />
                        {isLegacy(inv) && <LegacyBadge />}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-foreground-secondary">{inv.payment.settlement_network ?? `Chain ${inv.payment.settlement_chain_id}`}</span>
                        <TestnetBadge chainId={inv.payment.settlement_chain_id} />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-foreground whitespace-nowrap">
                      {tokenAmount(inv.payment.amount_raw, inv.payment.token_decimals, inv.payment.token_symbol, inv.payment.settlement_chain_id)}
                    </td>
                    <td className="py-3 px-4 text-foreground-muted whitespace-nowrap">{formatDateTime(inv.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
