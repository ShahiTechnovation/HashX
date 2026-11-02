"use client";

import React from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { Button, buttonStyles } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LiveError, LiveGate, errorMessage, useLiveQuery } from "@/components/live/common";
import type { LiveInvoice, LiveVerificationSummary } from "@/lib/live/types";
import { LegacyBadge, RoleBadge, isLegacy } from "@/components/live/invoices/shared";
import { DecisionBadge, formatDateTime } from "./verdict";

/** Upper bound on per-invoice summary requests issued for one page load. */
const MAX_SUMMARIES = 50;

interface Row {
  invoice: LiveInvoice;
  summary: LiveVerificationSummary | null;
  error: unknown;
  skipped: boolean;
}

export function LiveTrustList() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Connected mode · HashX backend"
        title="Trust"
        description="Backend-persisted verification verdicts for every invoice you participate in. Verdicts are computed by the HashX verifier, never in this browser."
      />
      <LiveGate purpose="Verification records are only visible to invoice participants.">
        <TrustTable />
      </LiveGate>
    </div>
  );
}

function TrustTable() {
  const { liveApi } = useApp();
  const { data, error, loading, reload } = useLiveQuery<Row[]>(async () => {
    const invoices = await liveApi.listInvoices();
    return Promise.all(
      invoices.map(async (invoice, i): Promise<Row> => {
        if (i >= MAX_SUMMARIES) return { invoice, summary: null, error: null, skipped: true };
        try {
          return { invoice, summary: await liveApi.verification(invoice.id), error: null, skipped: false };
        } catch (err) {
          return { invoice, summary: null, error: err, skipped: false };
        }
      })
    );
  }, [liveApi]);

  if (error) return <LiveError error={error} title="Could not load invoices" onRetry={reload} />;
  const rows = data ?? [];

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border">
        <span className="text-xs text-foreground-muted">
          {loading && !data ? "Loading…" : `${rows.length} invoice${rows.length === 1 ? "" : "s"} · provenance: backend_persisted`}
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
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing to verify yet"
          description="You are not a participant in any invoice on the HashX backend, so there are no verification records to show."
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
                <th className="py-2.5 px-4 font-medium">Role</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
                <th className="py-2.5 px-4 font-medium">Invoice</th>
                <th className="py-2.5 px-4 font-medium">Delivery</th>
                <th className="py-2.5 px-4 font-medium">Overall</th>
                <th className="py-2.5 px-4 font-medium">Payable</th>
                <th className="py-2.5 px-4 font-medium">Last verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map(({ invoice: inv, summary, error: rowError, skipped }) => {
                const lastRun = [summary?.invoiceVerification?.verifiedAt, summary?.deliveryVerification?.verifiedAt]
                  .filter((x): x is string => Boolean(x))
                  .sort()
                  .pop();
                return (
                  <tr key={inv.id} className="hover:bg-surface-2/50 transition-colors align-top">
                    <td className="py-3 px-4">
                      <Link href={`/app/trust/${inv.id}`} className="font-mono text-primary-light hover:underline">
                        {inv.id}
                      </Link>
                      {isLegacy(inv) && <LegacyBadge className="mt-1 flex w-fit" />}
                    </td>
                    <td className="py-3 px-4"><RoleBadge role={inv.viewerRole} /></td>
                    <td className="py-3 px-4"><StatusBadge status={inv.status} type="invoice" size="sm" /></td>
                    {skipped ? (
                      <td colSpan={5} className="py-3 px-4 text-foreground-muted">
                        Not loaded (list exceeds {MAX_SUMMARIES} invoices) — <Link href={`/app/trust/${inv.id}`} className="text-primary-light hover:underline">open inspector</Link>
                      </td>
                    ) : rowError ? (
                      <td colSpan={5} className="py-3 px-4 text-danger">{errorMessage(rowError)}</td>
                    ) : summary ? (
                      <>
                        <td className="py-3 px-4"><DecisionBadge decision={summary.invoiceVerification ? summary.invoiceDecision : null} size="sm" /></td>
                        <td className="py-3 px-4"><DecisionBadge decision={summary.deliveryDecision ?? null} size="sm" emptyLabel="No delivery" /></td>
                        <td className="py-3 px-4"><DecisionBadge decision={summary.overallDecision} size="sm" /></td>
                        <td className="py-3 px-4">
                          <span className={summary.isEligibleForPayment ? "text-success" : "text-foreground-muted"}>
                            {summary.isEligibleForPayment ? "Yes" : "No"}
                          </span>
                          {!summary.isEligibleForPayment && summary.blockingReasons[0] && (
                            <span className="block max-w-[260px] text-2xs text-foreground-muted mt-0.5">{summary.blockingReasons[0]}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-foreground-muted whitespace-nowrap">{formatDateTime(lastRun)}</td>
                      </>
                    ) : (
                      <td colSpan={5} className="py-3 px-4 text-foreground-muted">—</td>
                    )}
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
