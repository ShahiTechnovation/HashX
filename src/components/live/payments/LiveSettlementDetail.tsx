"use client";

/**
 * Connected-mode settlement view for one payment attempt.
 * Shows exactly what HashX's independent on-chain verification has recorded.
 */
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Link2, RefreshCw, ScrollText } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { DataList, DataRow } from "@/components/ui/DataList";
import { PageHeader, MetaItem } from "@/components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { Timeline, type TimelineItem } from "@/components/ui/Timeline";
import { cn } from "@/lib/utils";
import {
  LiveError,
  LiveGate,
  PAYMENT_STATE_META,
  PaymentStateBadge,
  TestnetBadge,
  TxLink,
  useLiveQuery,
} from "@/components/live/common";
import type { LiveReceipt } from "@/lib/live/types";
import { formatTokenAmount } from "@shared/networks";
import {
  AddressValue,
  Digest,
  IN_FLIGHT_STATES,
  PRE_SUBMISSION_STATES,
  SETTLED_STATES,
  fmtTime,
  networkLabel,
  paymentDecimals,
  requiredConfirmations,
} from "./shared";

const POLL_MS = 10_000;

export function LiveSettlementDetail({ id }: { id: string }) {
  return (
    <LiveGate purpose="Settlement records are visible to the payer and payee only.">
      <SettlementDetailInner id={id} />
    </LiveGate>
  );
}

function SettlementDetailInner({ id }: { id: string }) {
  const { liveApi, triggerRefresh } = useApp();
  const q = useLiveQuery(() => liveApi.getPayment(id), [id, liveApi]);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileError, setReconcileError] = useState<unknown>(null);
  const [pollError, setPollError] = useState<unknown>(null);
  const [receipt, setReceipt] = useState<LiveReceipt | null | undefined>(undefined);
  const [receiptError, setReceiptError] = useState<unknown>(null);

  const payment = q.data;
  const state = payment?.state;
  const setData = q.setData;

  // Auto-poll while the transfer is not yet final.
  useEffect(() => {
    if (!state || !IN_FLIGHT_STATES.includes(state)) return;
    const t = setInterval(() => {
      liveApi
        .getPayment(id)
        .then((p) => {
          setData(p);
          setPollError(null);
        })
        .catch(setPollError);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [state, id, liveApi, setData]);

  // Locate the receipt once settlement is confirmed.
  const invoiceId = payment?.invoiceId;
  const settled = !!state && SETTLED_STATES.includes(state);
  useEffect(() => {
    if (!settled || !invoiceId) return;
    let cancelled = false;
    setReceiptError(null);
    liveApi
      .receiptForInvoice(invoiceId)
      .then((r) => !cancelled && setReceipt(r))
      .catch((e) => !cancelled && setReceiptError(e));
    return () => {
      cancelled = true;
    };
  }, [settled, invoiceId, liveApi]);

  if (q.loading && !payment) return <Panel><PanelBody className="h-64 animate-pulse" /></Panel>;
  if (q.error && !payment) return <LiveError error={q.error} title="Could not load settlement" onRetry={q.reload} />;
  if (!payment) return null;

  const reconcile = async () => {
    setReconciling(true);
    setReconcileError(null);
    try {
      setData(await liveApi.reconcile(id));
      triggerRefresh();
    } catch (err) {
      setReconcileError(err);
    } finally {
      setReconciling(false);
    }
  };

  const meta = PAYMENT_STATE_META[payment.state];
  const decimals = paymentDecimals(payment);
  const required = requiredConfirmations(payment.finalityPolicy);
  const inFlight = IN_FLIGHT_STATES.includes(payment.state);
  const preSubmission = PRE_SUBMISSION_STATES.includes(payment.state);
  const isLegacy = payment.rail === "legacy-v1";
  const symbol = payment.tokenSymbol ?? "USDC";

  const tl = (title: string, at: string | null, description: string, failed = false): TimelineItem => ({
    title,
    description,
    time: at ? fmtTime(at) : undefined,
    state: at ? "done" : failed ? "failed" : "pending",
  });
  const isFailure = ["FAILED", "DROPPED", "EXPIRED", "CANCELLED", "TIMEOUT"].includes(payment.state);
  const timeline: TimelineItem[] = [
    tl("Transaction reported", payment.submittedAt, "Payer wallet broadcast; hash reported to HashX."),
    tl("Included in a canonical block", payment.includedAt, "Receipt status and matching ERC-20 Transfer log verified."),
    tl("Confirmation policy satisfied", payment.confirmedAt, `Policy ${payment.finalityPolicy ?? "—"}. Receipt is issued at this point.`),
    tl("Finalized", payment.finalizedAt, "Block is at or below the chain's finalized block."),
  ];
  if (isFailure) timeline.push({ title: meta.label, description: payment.failureCode ?? meta.description, state: "failed" });
  // Mark the next pending step as current while verification is in flight.
  if (inFlight) {
    const next = timeline.find((t) => t.state === "pending");
    if (next) next.state = "current";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/app/settlements", label: "Settlements" }}
        eyebrow="Settlement verification"
        title={<span className="font-mono text-xl">{payment.id}</span>}
        badges={
          <>
            <PaymentStateBadge state={payment.state} />
            <TestnetBadge chainId={payment.chainId} />
          </>
        }
        description={meta?.description}
        meta={
          <>
            <MetaItem label="Invoice">
              <Link href={`/app/invoices/${payment.invoiceId}`} className="font-mono hover:text-foreground hover:underline">
                {payment.invoiceId}
              </Link>
            </MetaItem>
            <MetaItem label="Updated">{fmtTime(payment.updatedAt)}</MetaItem>
            <MetaItem label="Last reconciled">{fmtTime(payment.lastReconciledAt)}</MetaItem>
          </>
        }
        actions={
          <Button variant="secondary" size="sm" onClick={reconcile} isLoading={reconciling} disabled={preSubmission || isLegacy}>
            <RefreshCw className="h-3.5 w-3.5" />
            Re-check on-chain
          </Button>
        }
      />

      {isLegacy && (
        <Callout tone="warning" title="Legacy v1 record — not independently verified">
          This record predates direct on-chain settlement verification. Its status was not established by an independently
          verified ERC-20 Transfer.
        </Callout>
      )}

      {inFlight && (
        <Callout tone="info" title={`${meta.label} is not final`}>
          {payment.state === "SUBMITTED"
            ? "The transaction hash has been reported but HashX has not yet observed it in a block."
            : "The matching Transfer was verified in a canonical block, but the confirmation policy is not yet met."}{" "}
          This page re-checks every 10 seconds. No receipt exists until the state is Confirmed.
        </Callout>
      )}

      {preSubmission && (
        <Callout
          tone="neutral"
          title="No transaction reported yet"
          actions={
            <Link href={`/app/approvals/${payment.id}`} className={buttonStyles({ size: "sm", variant: "secondary" })}>
              Open authorization <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          This attempt is still in human authorization ({meta.label}). Nothing has been sent on-chain.
        </Callout>
      )}

      {(payment.failureCode || payment.failureDetail) && (
        <Callout tone="danger" title={`Failure: ${payment.failureCode ?? meta.label}`}>
          {payment.failureDetail ?? meta.description}
        </Callout>
      )}

      {reconcileError ? <LiveError error={reconcileError} title="Re-check failed" /> : null}
      {pollError ? <LiveError error={pollError} title="Background status refresh failed" onRetry={q.reload} /> : null}
      {q.error ? <LiveError error={q.error} title="Refresh failed" onRetry={q.reload} /> : null}

      {settled && (
        <Callout
          tone="success"
          title="Transfer independently verified"
          actions={
            receipt ? (
              <Link href={`/app/receipts/${receipt.id}`} className={buttonStyles({ size: "sm", variant: "secondary" })}>
                <ScrollText className="h-3.5 w-3.5" /> View receipt
              </Link>
            ) : undefined
          }
        >
          {receipt === undefined && !receiptError
            ? "Looking up the receipt…"
            : receipt
              ? `Receipt ${receipt.id} was issued for this settlement.`
              : receiptError
                ? "The receipt could not be loaded."
                : "No receipt has been returned for this invoice yet."}
        </Callout>
      )}
      {receiptError ? <LiveError error={receiptError} title="Receipt lookup failed" /> : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          <PanelHeader icon={<Link2 />} title="On-chain transfer" description="Values recorded by HashX's verifier. Empty fields have not been observed yet." />
          <PanelBody>
            <DataList>
              <DataRow label="Transaction">
                <TxLink chainId={payment.chainId} hash={payment.txHash} />
              </DataRow>
              <DataRow label="Chain">
                <span className="inline-flex flex-wrap items-center gap-2">
                  {networkLabel(payment.chainId, payment.network)}
                  <span className="font-mono text-xs text-foreground-muted">chainId {payment.chainId ?? "—"}</span>
                  <TestnetBadge chainId={payment.chainId} />
                </span>
              </DataRow>
              <DataRow label="Confirmations" hint={payment.finalityPolicy ? `Policy: ${payment.finalityPolicy}` : undefined}>
                <ConfirmationMeter confirmations={payment.confirmations} required={required} hasBlock={!!payment.blockNumber} />
              </DataRow>
              <DataRow label="Block number" mono>{payment.blockNumber ?? "—"}</DataRow>
              <DataRow label="Block hash" mono>
                <Digest value={payment.blockHash} />
              </DataRow>
              <DataRow label="Log index" mono>{payment.logIndex ?? "—"}</DataRow>
              <DataRow label="Rail" mono>{payment.rail}</DataRow>
              <DataRow label="Token" hint={`Test ${symbol} · Sepolia Testnet`}>
                <AddressValue address={payment.tokenAddress} chainId={payment.chainId} />
              </DataRow>
              <DataRow label="Payer (from)">
                <AddressValue address={payment.payer} chainId={payment.chainId} />
              </DataRow>
              <DataRow label="Payee (to)">
                <AddressValue address={payment.payee} chainId={payment.chainId} />
              </DataRow>
              <DataRow label="Amount">
                <span className="flex flex-col">
                  <span className="font-medium">
                    {formatTokenAmount(payment.tokenTotalRaw, decimals)} Test {symbol}
                  </span>
                  <span className="font-mono text-2xs text-foreground-muted">{payment.tokenTotalRaw} raw units ({decimals} decimals)</span>
                </span>
              </DataRow>
            </DataList>
          </PanelBody>
        </Panel>

        <div className="space-y-6 lg:col-span-5">
          <Panel>
            <PanelHeader title="Verification timeline" description="Timestamps recorded by the backend." />
            <PanelBody>
              <Timeline items={timeline} />
              <p className="mt-4 text-2xs text-foreground-muted">
                Last reconciled: {fmtTime(payment.lastReconciledAt)}
              </p>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader title="Obligation binding" />
            <PanelBody>
              <DataList dense>
                <DataRow label="Authorization digest" mono stacked>
                  <Digest value={payment.authorization?.digest} />
                </DataRow>
                <DataRow label="Invoice digest" mono stacked>
                  <Digest value={payment.invoiceDigest} />
                </DataRow>
                <DataRow label="Delivery evidence digest" mono stacked>
                  <Digest value={payment.deliveryEvidenceDigest} />
                </DataRow>
              </DataList>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  );
}

const ConfirmationMeter: React.FC<{ confirmations: number; required: number | null; hasBlock: boolean }> = ({ confirmations, required, hasBlock }) => {
  if (!hasBlock) return <span className="text-foreground-muted">Not yet observed in a block</span>;
  const met = required !== null && confirmations >= required;
  const pct = required ? Math.min(100, Math.floor((confirmations * 100) / required)) : 0;
  return (
    <span className="flex flex-col gap-1.5">
      <span className={cn("font-mono text-xs", met ? "text-success" : "text-warning")}>
        {confirmations}
        {required !== null ? ` / ${required}` : ""} confirmations{met ? " · policy met" : required !== null ? " · policy not yet met" : ""}
      </span>
      {required !== null && (
        <span className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-surface-3">
          <span className={cn("block h-full", met ? "bg-success" : "bg-warning")} style={{ width: `${pct}%` }} />
        </span>
      )}
    </span>
  );
};
