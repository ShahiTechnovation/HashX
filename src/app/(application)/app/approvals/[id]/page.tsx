"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  FileCode2,
  RefreshCw,
  ShieldAlert,
  KeyRound,
  Clock,
  ExternalLink,
  Layers,
  Lock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { createWalletClient, custom, keccak256, toBytes } from "viem";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import { PaymentAttempt } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { formatAddress, formatMinorToUsd, formatTimestamp, getExplorerAddressUrl } from "@/lib/formatters";
import {
  getApprovalGroup,
  getQuoteExpiry,
  isAttributionVerified,
  merchantDisplayName,
  useNow,
} from "@/components/approvals/approval-primitives";
import { humanMatchesRaw, rawToExactDecimal, splitHumanAmount } from "@/components/approvals/amount-utils";

export default function ApprovalDetailPage() {
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
      <div className="space-y-6 animate-pulse">
        <div className="h-14 bg-carbon-nav border border-carbon-border rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 h-96 bg-carbon-nav border border-carbon-border rounded" />
          <div className="lg:col-span-5 h-96 bg-carbon-nav border border-carbon-border rounded" />
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="space-y-6">
        <div className="bg-carbon-nav border border-carbon-border p-8 rounded text-center">
          <KeyRound className="w-10 h-10 text-carbon-muted mx-auto mb-3" />
          <h2 className="font-display text-lg font-bold text-carbon-text">
            Authorization Record Not Found
          </h2>
          <p className="text-xs text-carbon-muted font-mono mt-1 mb-4">
            No payment attempt matches ID {attemptId}.
          </p>
          <Link
            href="/app/approvals"
            className="px-4 py-2 rounded text-xs font-mono font-medium text-carbon-text bg-carbon-panel border border-carbon-border hover:bg-carbon-void transition-colors inline-block"
          >
            Back to Approvals Queue
          </Link>
        </div>
      </div>
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

  return (
    <div className="space-y-6">
      {/* 1. Operational Quorum Control Header */}
      <section className="bg-carbon-nav border border-carbon-border p-4 rounded select-none">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 text-xs font-mono text-carbon-muted">
            <Link href="/app" className="hover:text-carbon-text transition-colors">
              Console
            </Link>
            <span className="text-carbon-border">/</span>
            <Link href="/app/approvals" className="hover:text-carbon-text transition-colors">
              Human Authorization
            </Link>
            <span className="text-carbon-border">/</span>
            <span className="text-carbon-text font-bold">Quorum Review</span>
            <span className="text-carbon-border">/</span>
            <span className="text-primary font-bold bg-carbon-panel px-1.5 py-0.5 rounded border border-carbon-border">
              #AUTH-{attempt.id.slice(-4).toUpperCase()}
            </span>
            <span className="text-carbon-border">•</span>
            <Link
              href={`/app/invoices/${attempt.invoiceId}`}
              className="text-carbon-muted hover:text-primary transition-colors"
            >
              INVOICE: #{attempt.invoiceId}
            </Link>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 bg-carbon-panel border border-warning/40 rounded">
            <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
            <span className="text-xs font-mono font-bold text-warning">
              {isDone
                ? "2-STAGE HUMAN QUORUM COMPLETED // AUTHORIZED"
                : isStage1
                ? "2-STAGE HUMAN QUORUM ACTIVE // STAGE 1 REVIEW REQUIRED"
                : "2-STAGE HUMAN QUORUM ACTIVE // STAGE 2 SUBMISSION REQUIRED"}
            </span>
          </div>
        </div>

        {/* Quorum Progress Split Badges & Countdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-2 border-t border-carbon-border/70">
          {/* Quote Expiry Countdown */}
          <div className="lg:col-span-5 bg-carbon-void p-3 rounded border border-carbon-border">
            <div className="flex items-center justify-between text-xs font-mono mb-1.5">
              <span className="text-carbon-muted flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-warning" />
                <span>HSP Settlement Window:</span>
              </span>
              <span className={cn("font-bold", expiry.urgency === "expired" ? "text-danger" : "text-warning")}>
                {expiry.text}
              </span>
            </div>
            <div className="w-full bg-carbon-panel h-1.5 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  expiry.urgency === "expired" ? "bg-danger w-full" : "bg-warning w-[75%]"
                )}
              />
            </div>
          </div>

          {/* Key 1 & Key 2 Badges */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
            {/* Key 1 */}
            <div className="bg-carbon-void border border-success/40 p-2.5 rounded flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-carbon-panel border border-success/50 flex items-center justify-center text-success">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-[10px] text-carbon-muted uppercase">Stage 1: Terms</div>
                  <div className="text-xs font-bold text-success">
                    {isStage1 ? "AWAITING YOU" : "CONFIRMED ✓"}
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-success bg-carbon-panel px-1.5 py-0.5 rounded border border-success/30">
                {isStage1 ? "READY" : "SIGNED"}
              </span>
            </div>

            {/* Key 2 */}
            <div className="bg-carbon-void border border-warning/40 p-2.5 rounded flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-carbon-panel border border-warning/50 flex items-center justify-center text-warning">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-[10px] text-carbon-muted uppercase">Stage 2: Treasury</div>
                  <div className="text-xs font-bold text-warning">
                    {isDone ? "DISPATCHED ✓" : isStage2 ? "ACTION REQ" : "PENDING STAGE 1"}
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-warning bg-carbon-panel px-1.5 py-0.5 rounded border border-warning/30">
                {isDone ? "EXECUTED" : "SIGNER READY"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN (7 cols / ~58%): Immutable Transaction Terms */}
        <div className="lg:col-span-7 space-y-6">
          {/* Financial Ledger Inspection Panel */}
          <div className="bg-carbon-nav border border-carbon-border rounded p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-carbon-border mb-6">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                <h2 className="font-display text-xs font-semibold tracking-wider uppercase text-carbon-text">
                  Financial Ledger Inspection
                </h2>
              </div>
              <span className="text-xs font-mono text-success bg-carbon-panel px-2 py-0.5 rounded border border-carbon-border flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Deterministic Debit Lock
              </span>
            </div>

            {/* Big Amount Hero */}
            <div className="bg-carbon-void p-5 rounded border border-carbon-border mb-6">
              <div className="text-xs font-mono text-carbon-muted uppercase mb-1">
                Total Agreed Disbursement
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div className="text-4xl md:text-5xl font-display font-bold text-carbon-text tracking-tight">
                  {summary.humanAmount}{" "}
                  <span className="text-xl text-primary font-mono font-medium">USDC</span>
                </div>
                <div className="text-right font-mono text-xs">
                  <div className="text-carbon-muted">RAW TOKEN UNITS</div>
                  <div className="text-carbon-text font-bold">{attempt.tokenTotalRaw}</div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-carbon-border grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <span className="text-carbon-muted block mb-0.5">Contract / Chain:</span>
                  <span className="text-carbon-text break-all">
                    USDC ({formatAddress(attempt.tokenAddress)})
                  </span>
                  <span className="text-carbon-muted text-[11px] block mt-0.5">
                    {summary?.chain || "HashKey Testnet 133"}
                  </span>
                </div>
                <div className="sm:text-right">
                  <span className="text-carbon-muted block mb-0.5">Gas &amp; Routing Fee:</span>
                  <span className="text-carbon-text">2.40 USDC (Fixed Institutional)</span>
                  <div className="text-xs text-primary font-bold mt-1">
                    Debit Total: {formatMinorToUsd(Number(attempt.tokenTotalRaw) + 240)} USDC
                  </div>
                </div>
              </div>
            </div>

            {/* Counterparty & Entity Binding */}
            <div className="space-y-4">
              <div className="text-xs font-mono text-carbon-muted uppercase tracking-wider">
                Cryptographic Counterparty Binding
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                {/* Payer */}
                <div className="bg-carbon-panel p-3.5 rounded border border-carbon-border">
                  <span className="text-[10px] text-carbon-muted uppercase block">
                    Debiting Party (Payer Treasury)
                  </span>
                  <div className="text-xs font-bold text-carbon-text mt-1 break-all">
                    {formatAddress(attempt.payer, 8)}
                  </div>
                  <div className="text-[11px] text-carbon-muted mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-success" />
                    Autonomous Treasury Alpha
                  </div>
                </div>

                {/* Payee */}
                <div className="bg-carbon-panel p-3.5 rounded border border-carbon-border">
                  <span className="text-[10px] text-carbon-muted uppercase block">
                    Receiving Party (Service Creditor)
                  </span>
                  <div className="text-xs font-bold text-success mt-1 break-all">
                    {formatAddress(attempt.payee, 8)}
                  </div>
                  <div className="text-[11px] text-success mt-1.5 flex items-center justify-between">
                    <span>{merchant}</span>
                    <span className="bg-success/15 px-1 rounded text-[10px] font-bold">100% REGISTRY MATCH</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payload Inspection Toggle */}
          <div className="bg-carbon-nav border border-carbon-border rounded p-4">
            <button
              onClick={() => setShowPayload(!showPayload)}
              className="w-full flex items-center justify-between text-xs font-mono text-carbon-muted hover:text-carbon-text transition-colors"
            >
              <span className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-primary" />
                <span>EIP-712 Structured Payment Payload</span>
              </span>
              <span>{showPayload ? "Hide JSON" : "Inspect Payload JSON"}</span>
            </button>

            {showPayload && (
              <div className="mt-3 pt-3 border-t border-carbon-border">
                <CodeViewer title="transfer-with-authorization.json" data={eip712Payload} />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (5 cols / ~42%): Interactive Authorization Action Terminal */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-carbon-nav border border-carbon-border rounded p-6 shadow-lg space-y-6 sticky top-20">
            <div className="pb-4 border-b border-carbon-border">
              <span className="text-[10px] font-mono text-carbon-muted uppercase tracking-wider block">
                GATE 06 // HUMAN QUORUM TERMINAL
              </span>
              <h2 className="font-display text-lg font-bold text-carbon-text mt-0.5">
                Execute Authorization
              </h2>
            </div>

            {/* Current Stage Description */}
            <div className="p-4 bg-carbon-panel rounded border border-carbon-border space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-carbon-muted">ACTIVE PROTOCOL STAGE</span>
                <span className="text-warning font-semibold">
                  {isStage1 ? "STAGE 1 OF 2" : isStage2 ? "STAGE 2 OF 2" : "COMPLETED"}
                </span>
              </div>
              <div className="text-carbon-text font-bold">
                {isStage1
                  ? "Stage 1: Pre-Signing Terms Review"
                  : isStage2
                  ? "Stage 2: Final Payment Submission to HSP"
                  : "Obligation Successfully Dispatched"}
              </div>
              <p className="text-[11px] text-carbon-muted leading-relaxed">
                {isStage1
                  ? "Authorize the signing key to sign the exact EIP-712 payment authorization payload for the specified amount."
                  : isStage2
                  ? "Authorize broadcast of the signed payment intent to the HashKey HSP settlement rail."
                  : "Payment has cleared human authorization and is processing in the HSP settlement pipeline."}
              </p>
            </div>

            {/* Explicit Human Confirmation Checkbox */}
            {isAwaiting && (
              <div className="p-3.5 bg-carbon-void rounded border border-carbon-border">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    className="mt-0.5 rounded border-carbon-border bg-carbon-panel text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-carbon-muted leading-relaxed">
                    I explicitly verify that payee{" "}
                    <span className="text-carbon-text font-semibold">{formatAddress(attempt.payee)}</span> and amount{" "}
                    <span className="text-carbon-text font-semibold">{summary.humanAmount} USDC</span> match the fulfillment terms.
                  </span>
                </label>
              </div>
            )}

            {actionError && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded text-xs font-mono text-danger">
                {actionError}
              </div>
            )}

            {/* Primary Action Button */}
            <div className="space-y-3 font-mono">
              {isStage1 ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleApproveSigning}
                  isLoading={isProcessing}
                  disabled={!canApprove}
                  className="w-full py-3 bg-primary text-white hover:bg-primary/90 font-semibold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Approve Terms &amp; Sign Payload (Stage 1)</span>
                </Button>
              ) : isStage2 ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleApproveSubmission}
                  isLoading={isProcessing}
                  disabled={!canApprove}
                  className="w-full py-3 bg-primary text-white hover:bg-primary/90 font-semibold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>Authorize HSP Payment Submission (Stage 2)</span>
                </Button>
              ) : (
                <Link
                  href={`/app/settlements/${attempt.id}`}
                  className="w-full py-3 bg-success text-white hover:bg-success/90 font-semibold text-xs flex items-center justify-center gap-2 rounded transition-colors text-center"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Track Settlement Finality</span>
                </Link>
              )}

              <Link
                href={`/app/trust/${attempt.invoiceId}`}
                className="w-full py-2 bg-carbon-panel border border-carbon-border hover:bg-carbon-void text-carbon-text text-xs font-medium flex items-center justify-center gap-1.5 rounded transition-colors text-center"
              >
                <span>Inspect Forensic Chain Evidence</span>
                <ExternalLink className="w-3 h-3 text-carbon-muted" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
