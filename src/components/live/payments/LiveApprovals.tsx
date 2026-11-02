"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Clock, KeyRound } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { Button, buttonStyles } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { useNow } from "@/components/approvals/approval-primitives";
import { cn } from "@/lib/utils";
import { LiveError, LiveGate, PaymentStateBadge, TestnetBadge, shortAddr, tokenAmount, useLiveQuery } from "@/components/live/common";
import type { LivePayment } from "@/lib/live/types";
import { PRE_SUBMISSION_STATES, countdown, sameAddr } from "./shared";

export function LiveApprovals() {
  return (
    <LiveGate purpose="Payment approvals are tied to your wallet session.">
      <ApprovalsInner />
    </LiveGate>
  );
}

function ApprovalsInner() {
  const { liveApi, session } = useApp();
  const q = useLiveQuery(() => liveApi.listPayments(), [liveApi]);
  const now = useNow(1000);

  const open = (q.data ?? []).filter((p) => PRE_SUBMISSION_STATES.includes(p.state));
  const mine = open.filter((p) => sameAddr(p.payer, session?.address));
  const awaitingBuyer = open.filter((p) => !sameAddr(p.payer, session?.address) && sameAddr(p.payee, session?.address));
  const other = open.filter((p) => !mine.includes(p) && !awaitingBuyer.includes(p));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Connected mode · Human authorization"
        title="Payment approvals"
        description="Every payment needs two explicit human steps by the payer — approve the exact terms, then sign an EIP-712 authorization — before the payer's own wallet sends Test USDC on Sepolia Testnet."
        actions={
          <Button variant="secondary" size="sm" onClick={q.reload} isLoading={q.loading}>
            Refresh
          </Button>
        }
      />

      {q.error ? <LiveError error={q.error} title="Could not load payment attempts" onRetry={q.reload} /> : null}

      {q.loading && !q.data ? (
        <Panel>
          <PanelBody className="h-40 animate-pulse" />
        </Panel>
      ) : q.data ? (
        <>
          <ApprovalGroup
            title="Needs your approval"
            description="You are the payer. Review each obligation and authorize it from your wallet."
            items={mine}
            now={now}
            empty="Nothing is waiting for your approval."
            cta="Review & authorize"
          />
          <ApprovalGroup
            title="Awaiting buyer"
            description="You are the seller. The buyer's wallet must approve, sign and send — you cannot act on these."
            items={awaitingBuyer}
            now={now}
            empty="No payments you requested are waiting on a buyer."
            cta="View"
          />
          {other.length > 0 && (
            <ApprovalGroup title="Other attempts" description="Attempts you participate in." items={other} now={now} empty="" cta="View" />
          )}
        </>
      ) : null}
    </div>
  );
}

const ApprovalGroup: React.FC<{ title: string; description: string; items: LivePayment[]; now: Date; empty: string; cta: string }> = ({
  title,
  description,
  items,
  now,
  empty,
  cta,
}) => (
  <Panel>
    <PanelHeader icon={<KeyRound />} title={`${title} (${items.length})`} description={description} />
    {items.length === 0 ? (
      <PanelBody>
        <EmptyState title={empty} description="Payment attempts appear here after a buyer requests payment for a verified delivery." />
      </PanelBody>
    ) : (
      <ul className="divide-y divide-border">
        {items.map((p) => {
          const expiresAt = p.approvalSummary?.authorizationExpiresAt ?? p.authorization?.expiresAt ?? null;
          const exp = countdown(expiresAt, now);
          return (
            <li key={p.id} className="flex flex-col gap-3 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-foreground">{p.id}</span>
                  <PaymentStateBadge state={p.state} />
                  <TestnetBadge chainId={p.chainId} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-foreground-muted">
                  <span>
                    Invoice{" "}
                    <Link href={`/app/invoices/${p.invoiceId}`} className="font-mono hover:text-foreground hover:underline">
                      {p.invoiceId}
                    </Link>
                  </span>
                  <span className="font-mono">
                    {shortAddr(p.payer)} → {shortAddr(p.payee)}
                  </span>
                  <span className={cn("inline-flex items-center gap-1 tabular-nums", exp.expired ? "text-danger" : "text-warning")}>
                    <Clock className="h-3 w-3" />
                    {exp.text}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-4 lg:justify-end">
                <div className="text-right">
                  <div className="text-sm font-semibold text-foreground">{tokenAmount(p.tokenTotalRaw, p.tokenDecimals, p.tokenSymbol, p.chainId)}</div>
                  <div className="font-mono text-2xs text-foreground-muted">{p.tokenTotalRaw} raw</div>
                </div>
                <Link href={`/app/approvals/${p.id}`} className={buttonStyles({ size: "sm", variant: cta === "View" ? "secondary" : "primary" })}>
                  {cta} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </Panel>
);
