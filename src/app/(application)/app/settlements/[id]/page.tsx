"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ChevronDown, Clock, FileJson2, Receipt, RefreshCw } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { LiveSettlementDetail } from "@/components/live/payments/LiveSettlementDetail";
import { demoClient, connectedClient } from "@/lib/api/client";
import { PaymentAttempt, VerifiableReceipt } from "@/types/domain";
import { Button, buttonStyles } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { FinalityTrack } from "@/components/ui/FinalityTrack";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader, MetaItem } from "@/components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { DataList, DataRow } from "@/components/ui/DataList";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { Callout } from "@/components/ui/Callout";
import { Timeline } from "@/components/ui/Timeline";
import { SimulatedBadge } from "@/components/live/common";
import { ToneBadge, merchantDisplayName } from "@/components/approvals/approval-primitives";
import { PendingValue, buildStatusHistory, isPreAuthorization } from "@/components/settlements/settlement-utils";
import { cn } from "@/lib/utils";
import { formatTimestamp, getExplorerTxUrl } from "@/lib/formatters";

/** Connected mode renders only real backend records; demo mode keeps the simulated fixture view. */
export default function SettlementDetailRoute() {
  const params = useParams();
  const id = params?.id as string;
  const { mode } = useApp();
  return mode === "connected" ? <LiveSettlementDetail id={id} /> : <DemoSettlementDetailPage />;
}

function DemoSettlementDetailPage() {
  const params = useParams();
  const attemptId = params?.id as string;
  const { mode } = useApp();

  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const [receipt, setReceipt] = useState<VerifiableReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const client = mode === "connected" ? connectedClient : demoClient;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        const data = await client.getPaymentAttemptById(attemptId);
        if (isMounted) setAttempt(data);

        if (data && data.hspStatus === "payment-finalized") {
          try {
            const rcpt = await client.getReceipt(data.invoiceId);
            if (isMounted) setReceipt(rcpt);
          } catch {
            // Receipt may not yet exist
          }
        }
      } catch (err) {
        console.error("Failed to load settlement details:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (attemptId) loadData();
    return () => {
      isMounted = false;
    };
  }, [attemptId, mode]);

  const handlePollStatus = async () => {
    if (!attempt) return;
    setIsPolling(true);
    try {
      const updated = await client.getPaymentStatus(attempt.invoiceId);
      setAttempt(updated);
      if (updated.hspStatus === "payment-finalized") {
        try {
          const rcpt = await client.getReceipt(updated.invoiceId);
          setReceipt(rcpt);
        } catch {}
      }
    } catch (err) {
      console.error("Polling error:", err);
    } finally {
      setIsPolling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading settlement">
        <div className="h-16 w-1/2 animate-pulse rounded-md bg-surface-2" />
        <div className="h-48 animate-pulse rounded-lg bg-surface-2" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-80 animate-pulse rounded-lg bg-surface-2 lg:col-span-7" />
          <div className="h-80 animate-pulse rounded-lg bg-surface-2 lg:col-span-5" />
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <Panel>
        <EmptyState
          title="Settlement record not found"
          description={`No settlement record matches ${attemptId}. It may belong to a different mode.`}
          action={
            <Link href="/app/settlements" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              Back to settlements
            </Link>
          }
        />
      </Panel>
    );
  }

  const isFinal = attempt.hspStatus === "payment-finalized";
  const isSafe = attempt.hspStatus === "payment-safe";

  const pre = isPreAuthorization(attempt);
  const history = buildStatusHistory(attempt);
  const merchant = merchantDisplayName(attempt.approvalSummary?.merchantName || "Verified Agent");

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/app/settlements", label: "Settlements" }}
        eyebrow="Settlement"
        title={`Payment to ${merchant}`}
        badges={
          <>
            {pre ? (
              <ToneBadge tone="neutral" icon={Clock}>
                Awaiting authorization
              </ToneBadge>
            ) : (
              <StatusBadge status={attempt.hspStatus} type="hsp" />
            )}
            <SimulatedBadge />
          </>
        }
        meta={
          <>
            <MetaItem label="Attempt">
              <span className="font-mono">{attempt.id}</span>
            </MetaItem>
            <MetaItem label="Invoice">
              <Link href={`/app/invoices/${attempt.invoiceId}`} className="font-mono hover:text-foreground hover:underline">
                {attempt.invoiceId}
              </Link>
            </MetaItem>
            <MetaItem label="Created">{formatTimestamp(attempt.createdAt)}</MetaItem>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handlePollStatus} disabled={isPolling}>
              <RefreshCw className={cn(isPolling && "animate-spin")} />
              Refresh status
            </Button>
            <Link href={`/app/trust/${attempt.invoiceId}`} className={buttonStyles({ variant: "ghost", size: "sm" })}>
              Trust Inspector
              <ArrowUpRight />
            </Link>
          </>
        }
      />

      {/* Finality: the one thing this page exists to answer */}
      <Panel>
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          <div>
            <h2 className="text-[15px] font-medium tracking-[-0.01em] text-foreground">Finality</h2>
            <p className="mt-0.5 text-xs text-foreground-muted">
              HashKey HSP lifecycle from submission to irreversible finality.
            </p>
          </div>
          <div className="sm:text-right">
            <div className="text-xs text-foreground-muted">Amount</div>
            <div className="text-[22px] font-medium tabular-nums tracking-[-0.02em] text-foreground">
              {attempt.approvalSummary?.humanAmount || "0.00 USDC"}
            </div>
          </div>
        </div>
        <PanelBody className="space-y-5">
          {pre ? (
            <Callout
              tone="neutral"
              title="Not submitted"
              actions={
                <Link href={`/app/approvals/${attempt.id}`} className={buttonStyles({ variant: "secondary", size: "sm" })}>
                  Open approval
                </Link>
              }
            >
              This payment is still awaiting human authorization and has not been broadcast.
            </Callout>
          ) : (
            <div className="px-1 py-2 sm:px-4">
              <FinalityTrack status={attempt.hspStatus} />
            </div>
          )}

          {isSafe && !isFinal && (
            <Callout tone="warning" title="Safe is not final">
              The transaction is included on-chain but has not reached consensus finality. The verifiable receipt is
              anchored only after full settlement finality.
            </Callout>
          )}
        </PanelBody>
      </Panel>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Panel>
            <PanelHeader title="On-chain references" description="Identifiers for independently checking this settlement." />
            <PanelBody>
              <DataList>
                <DataRow label="Transaction hash">
                  {attempt.txHash ? (
                    <CopyableValue className="max-w-full" value={attempt.txHash} explorerUrl={getExplorerTxUrl(attempt.txHash)} label="Copy transaction hash" />
                  ) : (
                    <PendingValue>Awaiting broadcast inclusion</PendingValue>
                  )}
                </DataRow>
                <DataRow label="HSP flow ID">
                  <CopyableValue className="max-w-full" value={attempt.flowId} label="Copy flow ID" />
                </DataRow>
                <DataRow label="Payment request ID">
                  <CopyableValue className="max-w-full" value={attempt.paymentRequestId} label="Copy payment request ID" />
                </DataRow>
                <DataRow label="Evidence registry anchor">
                  {attempt.evidenceRegistryTx ? (
                    <CopyableValue className="max-w-full" value={attempt.evidenceRegistryTx} label="Copy evidence anchor" />
                  ) : (
                    <PendingValue>Committed alongside the final receipt</PendingValue>
                  )}
                </DataRow>
                <DataRow label="Payer">
                  <CopyableValue className="max-w-full" value={attempt.payer} label="Copy payer address" />
                </DataRow>
                <DataRow label="Payee">
                  <CopyableValue className="max-w-full" value={attempt.payee} label="Copy payee address" />
                </DataRow>
              </DataList>
            </PanelBody>
          </Panel>

          <Panel>
            <button
              type="button"
              onClick={() => setShowRaw(!showRaw)}
              aria-expanded={showRaw}
              aria-controls="hsp-raw-payload"
              className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-surface-2/50 sm:px-5"
            >
              <span className="flex items-center gap-2.5">
                <FileJson2 className="h-4 w-4 text-foreground-muted" aria-hidden="true" />
                <span>
                  <span className="block text-[15px] font-medium tracking-[-0.01em] text-foreground">Raw settlement record</span>
                  <span className="block text-xs text-foreground-muted">The full payment attempt as stored</span>
                </span>
              </span>
              <span className="flex items-center gap-1 text-xs text-foreground-secondary">
                {showRaw ? "Hide" : "Inspect"}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", showRaw && "rotate-180")} aria-hidden="true" />
              </span>
            </button>
            {showRaw && (
              <div id="hsp-raw-payload" className="border-t border-border p-4 sm:p-5">
                <CodeViewer title={`hsp-attempt-${attempt.id}.json`} data={attempt} />
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <Panel>
            <PanelHeader title="Receipt" />
            <PanelBody>
              {isFinal ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <div className="text-[13px] font-medium text-foreground">Settlement finalized</div>
                      <p className="mt-0.5 text-xs leading-relaxed text-foreground-muted">
                        Block finality is confirmed and an evidence-backed receipt was issued for this payment.
                      </p>
                    </div>
                  </div>
                  {receipt && (
                    <DataList dense>
                      <DataRow label="Receipt">
                        <CopyableValue className="max-w-full" value={receipt.id} label="Copy receipt ID" />
                      </DataRow>
                    </DataList>
                  )}
                  <Link href={`/app/receipts/${attempt.invoiceId}`} className={cn(buttonStyles({ variant: "primary", size: "md" }), "w-full")}>
                    <Receipt />
                    View receipt
                  </Link>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-foreground-muted ring-1 ring-inset ring-border">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="text-[13px] font-medium text-foreground">Awaiting finality</div>
                    <p className="mt-0.5 text-xs leading-relaxed text-foreground-muted">
                      A receipt is issued only after settlement finality is attested on-chain. Safe transactions move to
                      finalized automatically.
                    </p>
                  </div>
                </div>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Status history" description="Only recorded timestamps are shown." />
            <PanelBody>
              <Timeline items={history} />
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  );
}
