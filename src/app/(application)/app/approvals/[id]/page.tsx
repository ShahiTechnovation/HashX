"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, ChevronDown, Clock, ExternalLink, FileCode2, KeyRound, ShieldAlert } from "lucide-react";
import { createWalletClient, custom, keccak256, toBytes } from "viem";
import { useApp } from "@/providers/AppContext";
import { LiveApprovalDetail } from "@/components/live/payments/LiveApprovalDetail";
import { demoClient, connectedClient } from "@/lib/api/client";
import { PaymentAttempt } from "@/types/domain";
import { Button, buttonStyles } from "@/components/ui/Button";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader, MetaItem } from "@/components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { DataList, DataRow } from "@/components/ui/DataList";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { Callout } from "@/components/ui/Callout";
import { SimulatedBadge } from "@/components/live/common";
import { cn } from "@/lib/utils";
import { formatAddress, formatTimestamp, getExplorerAddressUrl } from "@/lib/formatters";
import {
  AttributionTag,
  AuthorizationStepper,
  QuoteExpiryTag,
  ToneBadge,
  getApprovalGroup,
  getQuoteExpiry,
  isAttributionVerified,
  merchantDisplayName,
  useNow,
} from "@/components/approvals/approval-primitives";
import { humanMatchesRaw, rawToExactDecimal, splitHumanAmount } from "@/components/approvals/amount-utils";

/** Connected mode renders only real backend records; demo mode keeps the simulated fixture view. */
export default function ApprovalDetailRoute() {
  const params = useParams();
  const id = params?.id as string;
  const { mode } = useApp();
  return mode === "connected" ? <LiveApprovalDetail id={id} /> : <DemoApprovalDetailPage />;
}

function DemoApprovalDetailPage() {
  const params = useParams();
  const attemptId = params?.id as string;
  const router = useRouter();
  const { mode, triggerRefresh, walletAddress, isWalletConnected, connectWallet } = useApp();

  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [showPayload, setShowPayload] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const nowTime = useNow(1000);

  const client = mode === "connected" ? connectedClient : demoClient;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        const data = await client.getPaymentAttemptById(attemptId);
        if (isMounted) setAttempt(data);
      } catch (err) {
        console.error("Failed to load payment attempt:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (attemptId) loadData();
    return () => {
      isMounted = false;
    };
  }, [attemptId, mode]);

  const attemptState = attempt?.state;
  useEffect(() => {
    setAcknowledged(false);
  }, [attemptState]);

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading authorization">
        <div className="h-16 w-1/2 animate-pulse rounded-md bg-surface-2" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-96 animate-pulse rounded-lg bg-surface-2 lg:col-span-7" />
          <div className="h-96 animate-pulse rounded-lg bg-surface-2 lg:col-span-5" />
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <Panel>
        <EmptyState
          icon={<KeyRound className="h-[18px] w-[18px]" />}
          title="Authorization record not found"
          description={`No payment attempt matches ${attemptId}. It may belong to a different mode.`}
          action={
            <Link href="/app/approvals" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              Back to approvals
            </Link>
          }
        />
      </Panel>
    );
  }

  const summary = attempt.approvalSummary;
  const expiry = getQuoteExpiry(attempt.quoteExpiresAt, nowTime);
  const group = getApprovalGroup(attempt.state);
  const isStage1 = attempt.state === "AWAITING_SIGNATURE_APPROVAL";
  const isStage2 = attempt.state === "AWAITING_SUBMISSION_APPROVAL";
  const isAwaiting = isStage1 || isStage2;
  const isDone = group === "completed";
  const merchant = merchantDisplayName(summary?.merchantName ?? attempt.merchantName);
  const tokenSymbol = summary?.tokenSymbol ?? "USDC";
  const tokenDecimals = summary?.tokenDecimals ?? 6;
  const { value: amountValue, unit: amountUnit } = splitHumanAmount(summary?.humanAmount ?? "");
  const exactDecimal = rawToExactDecimal(attempt.tokenTotalRaw, tokenDecimals);
  const canApprove = isAwaiting && !expiry.isExpired && acknowledged && !isProcessing;

  const handleApproveSigning = async () => {
    setIsProcessing(true);
    setActionError(null);
    try {
      const updated = await client.approveSigning(attempt.id);
      setAttempt(updated);
      triggerRefresh();
    } catch (err) {
      console.error("Signing approval failed:", err);
      setActionError(err instanceof Error ? err.message : "Signing approval failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveSubmission = async () => {
    setIsProcessing(true);
    setActionError(null);
    try {
      let signature: `0x${string}` | undefined;

      if (mode === "connected") {
        if (!isWalletConnected || !walletAddress) {
          throw new Error("Wallet not connected. Connect your payer EIP-1193 wallet to authorize payment submission.");
        }
        if (walletAddress.toLowerCase() !== attempt.payer.toLowerCase()) {
          throw new Error(
            `Connected wallet (${walletAddress}) does not match authorized payer (${attempt.payer}). Switch to payer wallet in MetaMask.`
          );
        }
        if (typeof window === "undefined" || !(window as any).ethereum) {
          throw new Error("No EIP-1193 browser wallet detected.");
        }

        const walletClient = createWalletClient({
          transport: custom((window as any).ethereum),
        });

        const termsHash = keccak256(toBytes(attempt.tokenTotalRaw));
        signature = await walletClient.signMessage({
          account: walletAddress as `0x${string}`,
          message: { raw: toBytes(termsHash) },
        });
      }

      const updated = await client.approveSubmission(attempt.id, signature);
      setAttempt(updated);
      setJustSubmitted(true);
      triggerRefresh();
      setTimeout(() => {
        router.push(`/app/settlements/${attempt.id}`);
      }, 1200);
    } catch (err) {
      console.error("Submission approval failed:", err);
      setActionError(err instanceof Error ? err.message : "Submission approval failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const eip712Payload = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    domain: {
      name: "USD Coin",
      version: "1",
      chainId: attempt.approvalSummary.chainId,
      verifyingContract: attempt.tokenAddress,
    },
    message: {
      from: attempt.payer,
      to: attempt.payee,
      value: attempt.tokenTotalRaw,
      validAfter: 0,
      validBefore: Math.floor(new Date(attempt.quoteExpiresAt).getTime() / 1000),
      nonce: "0x4a9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
    },
  };

  const unit = amountUnit || tokenSymbol;
  const amountCheck = humanMatchesRaw(summary?.humanAmount ?? "", attempt.tokenTotalRaw, tokenDecimals);
  const attributionVerified = isAttributionVerified(attempt);
  const chainLabel = summary?.chain || "HashKey Testnet 133";

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/app/approvals", label: "Approvals" }}
        eyebrow="Payment authorization"
        title={`Payment to ${merchant}`}
        badges={
          <>
            <ToneBadge tone={isDone ? "success" : "warning"} icon={isDone ? CheckCircle2 : Clock}>
              {isStage1 ? "Stage 1 of 2 · terms review" : isStage2 ? "Stage 2 of 2 · submission" : "Both stages approved"}
            </ToneBadge>
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
      />

      <Panel>
        <AuthorizationStepper
          state={attempt.state}
          quoteExpired={expiry.isExpired}
          settlementSlot={
            isDone ? (
              <Link
                href={`/app/settlements/${attempt.id}`}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-primary-light hover:underline"
              >
                Track HSP settlement
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : undefined
          }
        />
      </Panel>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Review: the exact obligation being authorized */}
        <div className="space-y-6 lg:col-span-7">
          <Panel>
            <PanelHeader title="Payment summary" description="The exact terms this authorization covers. Nothing here can change after approval." />
            <PanelBody className="space-y-6">
              <div>
                <div className="text-xs text-foreground-muted">Amount</div>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[40px] font-medium leading-none tracking-[-0.035em] tabular-nums text-foreground">
                    {amountValue || summary?.humanAmount}
                  </span>
                  <span className="text-lg font-medium text-foreground-secondary">{unit}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-foreground-muted">
                  <span>
                    Exact <span className="font-mono text-foreground-secondary">{exactDecimal}</span>
                  </span>
                  <span>
                    Raw units <span className="font-mono text-foreground-secondary">{attempt.tokenTotalRaw}</span>
                  </span>
                  <span>{tokenDecimals} decimals</span>
                  {amountCheck === true && (
                    <span className="inline-flex items-center gap-1 text-success">
                      <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                      Display amount matches raw units
                    </span>
                  )}
                  {amountCheck === false && (
                    <span className="inline-flex items-center gap-1 text-danger">
                      <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                      Display amount does not match raw units
                    </span>
                  )}
                </div>
              </div>

              <DataList>
                <DataRow label="Recipient">
                  <div className="space-y-1">
                    <CopyableValue className="max-w-full" value={attempt.payee} explorerUrl={getExplorerAddressUrl(attempt.payee)} label="Copy recipient address" />
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-xs text-foreground-secondary">{merchant}</span>
                      <AttributionTag verified={attributionVerified} />
                    </div>
                  </div>
                </DataRow>
                <DataRow label="Payer">
                  <CopyableValue className="max-w-full" value={attempt.payer} explorerUrl={getExplorerAddressUrl(attempt.payer)} label="Copy payer address" />
                </DataRow>
                <DataRow label="Token">
                  <div className="space-y-1">
                    <span className="text-[13px] text-foreground">{tokenSymbol}</span>
                    <CopyableValue className="max-w-full" value={attempt.tokenAddress} explorerUrl={getExplorerAddressUrl(attempt.tokenAddress)} label="Copy token contract" />
                  </div>
                </DataRow>
                <DataRow label="Network">
                  {chainLabel}
                  {summary?.chainId ? <span className="ml-2 font-mono text-xs text-foreground-muted">chain {summary.chainId}</span> : null}
                </DataRow>
                {summary?.invoiceValueUsd ? <DataRow label="Invoice value">{summary.invoiceValueUsd}</DataRow> : null}
                {summary?.paymentFeeEstimateUsd ? (
                  <DataRow label="Fee estimate" hint="Provider estimate, not part of the signed amount">
                    {summary.paymentFeeEstimateUsd}
                  </DataRow>
                ) : null}
                <DataRow label="Quote expires">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <QuoteExpiryTag iso={attempt.quoteExpiresAt} now={nowTime} />
                    <span className="text-xs text-foreground-muted">{formatTimestamp(attempt.quoteExpiresAt)}</span>
                  </div>
                </DataRow>
              </DataList>
            </PanelBody>
          </Panel>

          <Panel>
            <button
              type="button"
              onClick={() => setShowPayload(!showPayload)}
              aria-expanded={showPayload}
              aria-controls="eip712-payload"
              className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-surface-2/50 sm:px-5"
            >
              <span className="flex items-center gap-2.5">
                <FileCode2 className="h-4 w-4 text-foreground-muted" aria-hidden="true" />
                <span>
                  <span className="block text-[15px] font-medium tracking-[-0.01em] text-foreground">EIP-712 payment payload</span>
                  <span className="block text-xs text-foreground-muted">The structured data the payer wallet signs</span>
                </span>
              </span>
              <span className="flex items-center gap-1 text-xs text-foreground-secondary">
                {showPayload ? "Hide" : "Inspect"}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", showPayload && "rotate-180")} aria-hidden="true" />
              </span>
            </button>
            {showPayload && (
              <div id="eip712-payload" className="border-t border-border p-4 sm:p-5">
                <CodeViewer title="transfer-with-authorization.json" data={eip712Payload} />
              </div>
            )}
          </Panel>
        </div>

        {/* Decision: one deliberate action, clearly separated from the review */}
        <div className="lg:sticky lg:top-6 lg:col-span-5">
          <Panel className="shadow-raised">
            <PanelBody className="space-y-5">
              <div>
                <div className="text-xs text-foreground-muted">
                  {isStage1 ? "Stage 1 of 2" : isStage2 ? "Stage 2 of 2" : "Completed"}
                </div>
                <h2 className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-foreground">
                  {isStage1
                    ? "Review terms and approve signing"
                    : isStage2
                    ? "Authorize payment submission"
                    : "Authorization complete"}
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-foreground-secondary">
                  {isStage1
                    ? "Authorize the signing key to sign the exact EIP-712 payment authorization payload for the amount shown."
                    : isStage2
                    ? "Authorize broadcast of the signed payment intent to the HashKey HSP settlement rail."
                    : "This payment cleared both human approvals and was handed to HSP settlement. Settlement is not final until it is finalized on-chain."}
                </p>
              </div>

              <dl className="divide-y divide-border rounded-md border border-border bg-surface-2/60 text-[13px]">
                <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                  <dt className="text-foreground-muted">Pay</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {amountValue || summary?.humanAmount} {unit}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                  <dt className="text-foreground-muted">To</dt>
                  <dd className="font-mono text-xs text-foreground">{formatAddress(attempt.payee, 6)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                  <dt className="text-foreground-muted">On</dt>
                  <dd className="text-foreground">{chainLabel}</dd>
                </div>
                {isAwaiting && (
                  <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                    <dt className="text-foreground-muted">Quote</dt>
                    <dd>
                      <QuoteExpiryTag iso={attempt.quoteExpiresAt} now={nowTime} />
                    </dd>
                  </div>
                )}
              </dl>

              {isAwaiting && expiry.isExpired && (
                <Callout tone="danger" title="Quote expired">
                  This quote can no longer be approved. A new payment request is required.
                </Callout>
              )}

              {isAwaiting && (
                <label className="flex cursor-pointer select-none items-start gap-3 rounded-md border border-border-strong bg-surface-1 p-3.5 transition-colors hover:border-foreground-muted/50">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border-strong accent-[rgb(var(--primary))]"
                  />
                  <span className="text-[13px] leading-relaxed text-foreground-secondary">
                    I have verified that recipient <span className="font-mono text-xs font-medium text-foreground">{formatAddress(attempt.payee)}</span> and
                    amount{" "}
                    <span className="font-medium text-foreground">
                      {amountValue || summary?.humanAmount} {unit}
                    </span>{" "}
                    match the fulfilled terms.
                  </span>
                </label>
              )}

              {actionError && (
                <Callout tone="danger" title="Authorization failed">
                  {actionError}
                </Callout>
              )}

              {justSubmitted && (
                <Callout tone="info" title="Submission authorized">
                  Opening settlement tracking. The payment is not settled until it is finalized.
                </Callout>
              )}

              <div className="space-y-2 border-t border-border pt-5">
                {isStage1 ? (
                  <Button size="lg" className="w-full" onClick={handleApproveSigning} isLoading={isProcessing} disabled={!canApprove}>
                    {!isProcessing && <KeyRound />}
                    Approve terms · Stage 1
                  </Button>
                ) : isStage2 ? (
                  <Button size="lg" className="w-full" onClick={handleApproveSubmission} isLoading={isProcessing} disabled={!canApprove}>
                    {!isProcessing && <KeyRound />}
                    Authorize submission · Stage 2
                  </Button>
                ) : (
                  <Link href={`/app/settlements/${attempt.id}`} className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full")}>
                    Track settlement
                    <ArrowRight />
                  </Link>
                )}

                <Link href={`/app/trust/${attempt.invoiceId}`} className={cn(buttonStyles({ variant: "ghost", size: "md" }), "w-full")}>
                  Inspect verification evidence
                  <ExternalLink />
                </Link>

                {isAwaiting && !acknowledged && !expiry.isExpired && (
                  <p className="text-center text-xs text-foreground-muted">Confirm the recipient and amount to enable approval.</p>
                )}
              </div>

              <p className="border-t border-border pt-4 text-xs leading-relaxed text-foreground-muted">
                Demo mode: approvals update simulated fixtures only. No wallet signature is requested and nothing is broadcast.
              </p>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  );
}
