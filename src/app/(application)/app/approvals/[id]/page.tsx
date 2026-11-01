"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Lock,
  ArrowRight,
  ExternalLink,
  Coins,
  RefreshCw,
  FileText,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import { PaymentAttempt } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { formatAddress, formatHash, formatTimestamp, formatExpiryCountdown } from "@/lib/formatters";

export default function ApprovalDetailPage() {
  const params = useParams();
  const attemptId = params?.id as string;
  const router = useRouter();
  const { mode, triggerRefresh } = useApp();

  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nowTime, setNowTime] = useState(new Date());

  const client = mode === "connected" ? connectedClient : demoClient;

  // Clock countdown timer
  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  if (isLoading) {
    return (
      <div className="p-12 text-center text-foreground-muted font-mono text-xs">
        Loading payment authorization record {attemptId}...
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="p-12 text-center space-y-4">
        <h2 className="text-lg font-bold text-foreground">Record Not Found</h2>
        <p className="text-xs text-foreground-secondary">
          No payment attempt found with ID <code>{attemptId}</code>.
        </p>
        <Link href="/app/approvals">
          <Button variant="secondary" size="sm">
            Back to Queue
          </Button>
        </Link>
      </div>
    );
  }

  const expiryInfo = formatExpiryCountdown(attempt.quoteExpiresAt, nowTime);
  const isStage1 = attempt.state === "AWAITING_SIGNATURE_APPROVAL";
  const isStage2 = attempt.state === "AWAITING_SUBMISSION_APPROVAL";
  const isSubmittedOrFinal =
    attempt.state === "SUBMITTED" ||
    attempt.state === "PROCESSING" ||
    attempt.state === "FINALIZED";

  const handleApproveSigning = async () => {
    setIsProcessing(true);
    try {
      if (mode === "demo") {
        const updated = await demoClient.approveSigning(attempt.id);
        setAttempt(updated);
        triggerRefresh();
      }
    } catch (err) {
      console.error("Signing approval failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveSubmission = async () => {
    setIsProcessing(true);
    try {
      if (mode === "demo") {
        const updated = await demoClient.approveSubmission(attempt.id);
        setAttempt(updated);
        triggerRefresh();
        // Redirect to settlement view after a moment
        setTimeout(() => {
          router.push(`/app/settlements/${attempt.id}`);
        }, 1200);
      }
    } catch (err) {
      console.error("Submission approval failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <Link href="/app/approvals">
            <Button variant="ghost" size="icon" aria-label="Back to Queue">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-display font-bold text-foreground font-mono">
                {attempt.id}
              </h1>
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-warning/20 text-warning border border-warning/40">
                {attempt.state.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-xs text-foreground-secondary mt-0.5">
              Associated Invoice: <Link href={`/app/invoices/${attempt.invoiceId}`} className="text-primary-light hover:underline font-mono">{attempt.invoiceId}</Link>
            </p>
          </div>
        </div>

        <Link href={`/app/settlements/${attempt.id}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Coins className="w-4 h-4 text-primary-light" />
            <span>Settlement Explorer</span>
          </Button>
        </Link>
      </div>

      {/* Quote Expiry Alert if Expired */}
      {expiryInfo.isExpired && (isStage1 || isStage2) && (
        <div className="p-4 rounded-xl border border-danger/40 bg-danger/10 text-danger flex items-center justify-between text-xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <span className="font-semibold block">HSP Payment Quote Expired</span>
              <span>
                HSP rate quotes are valid for 5 minutes. Security policy disables signing or submitting with expired terms. Please request a fresh quote.
              </span>
            </div>
          </div>
          <Button variant="secondary" size="sm" className="shrink-0 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reprepare Quote</span>
          </Button>
        </div>
      )}

      {/* Stepper of Approvals */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div
          className={`p-3 rounded-lg border flex items-center gap-2 ${
            isStage1
              ? "border-warning bg-warning/10 text-warning"
              : isStage2 || isSubmittedOrFinal
              ? "border-success/40 bg-success/10 text-success"
              : "border-border text-foreground-muted"
          }`}
        >
          <span className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[11px] font-bold bg-surface-3">
            1
          </span>
          <span className="font-medium">Signing Authorization</span>
        </div>

        <div
          className={`p-3 rounded-lg border flex items-center gap-2 ${
            isStage2
              ? "border-warning bg-warning/10 text-warning"
              : isSubmittedOrFinal
              ? "border-success/40 bg-success/10 text-success"
              : "border-border text-foreground-muted"
          }`}
        >
          <span className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[11px] font-bold bg-surface-3">
            2
          </span>
          <span className="font-medium">Submission Confirmation</span>
        </div>

        <div
          className={`p-3 rounded-lg border flex items-center gap-2 ${
            isSubmittedOrFinal
              ? "border-success/40 bg-success/10 text-success"
              : "border-border text-foreground-muted"
          }`}
        >
          <span className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[11px] font-bold bg-surface-3">
            3
          </span>
          <span className="font-medium">HSP Rail Execution</span>
        </div>
      </div>

      {/* Exact Terms Authorization Card (PRD Mandate) */}
      <div className="p-6 rounded-xl border border-border bg-surface-1 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary-light" />
            <h3 className="text-sm font-semibold text-foreground">
              Exact Prepared HSP Payment Information
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-warning" />
            <span className={expiryInfo.isExpired ? "text-danger" : "text-warning"}>
              {expiryInfo.text}
            </span>
          </div>
        </div>

        {/* Financial Specification Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-surface-2 border border-border space-y-1">
            <span className="text-[11px] uppercase font-mono text-foreground-muted">Merchant Name</span>
            <div className="font-medium text-foreground">{attempt.merchantName}</div>
            <div className="text-[11px] font-mono text-success flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Attribution Verified
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-2 border border-border space-y-1">
            <span className="text-[11px] uppercase font-mono text-foreground-muted">Total Authorized Amount</span>
            <div className="text-lg font-mono font-bold text-foreground">
              {attempt.approvalSummary.humanAmount}
            </div>
            <div className="text-[11px] font-mono text-foreground-muted">
              Raw integer tokens: <code>{attempt.tokenTotalRaw}</code> units
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-2 border border-border space-y-1">
            <span className="text-[11px] uppercase font-mono text-foreground-muted">Payer Wallet (You)</span>
            <CopyableValue value={attempt.payer} displayText={formatAddress(attempt.payer, 6)} />
            <div className="text-[11px] text-foreground-secondary">
              Authorized EOA on HashKey Chain
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-2 border border-border space-y-1">
            <span className="text-[11px] uppercase font-mono text-foreground-muted">Payee Wallet (Seller)</span>
            <CopyableValue value={attempt.payee} displayText={formatAddress(attempt.payee, 6)} />
            <div className="text-[11px] text-foreground-secondary">
              Recipient bound to signed invoice
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-2 border border-border space-y-1">
            <span className="text-[11px] uppercase font-mono text-foreground-muted">Token Contract Address</span>
            <CopyableValue value={attempt.tokenAddress} displayText={formatAddress(attempt.tokenAddress, 6)} />
            <div className="text-[11px] text-foreground-secondary">
              Asset: {attempt.approvalSummary.tokenSymbol} ({attempt.approvalSummary.tokenDecimals} decimals)
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-2 border border-border space-y-1">
            <span className="text-[11px] uppercase font-mono text-foreground-muted">Network & Rail</span>
            <div className="font-mono text-foreground">{attempt.approvalSummary.chain}</div>
            <div className="text-[11px] text-foreground-secondary">
              HSP Flow ID: <code>{attempt.flowId}</code>
            </div>
          </div>
        </div>

        {/* EIP-712 Signing Payload JSON */}
        <CodeViewer
          title="Prepared HSP EIP-712 Signing Payload"
          data={{
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
              name: "USD Tether",
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
          }}
          maxHeight="max-h-48"
        />

        {/* Action Controls */}
        <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-foreground-secondary">
            {isStage1 && "Approval 1 of 2: Authorize wallet signature of the exact payload above."}
            {isStage2 && "Approval 2 of 2: Authorize broadcast and submission to HSP."}
            {isSubmittedOrFinal && "Authorization complete: payment execution in progress."}
          </div>

          <div>
            {isStage1 && (
              <Button
                variant="primary"
                size="md"
                onClick={handleApproveSigning}
                disabled={expiryInfo.isExpired}
                isLoading={isProcessing}
                className="gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>1. Authorize & Sign Payload</span>
              </Button>
            )}

            {isStage2 && (
              <Button
                variant="primary"
                size="md"
                onClick={handleApproveSubmission}
                disabled={expiryInfo.isExpired}
                isLoading={isProcessing}
                className="gap-2 bg-success hover:bg-success/90"
              >
                <CheckCircle className="w-4 h-4" />
                <span>2. Deliberately Submit Payment</span>
              </Button>
            )}

            {isSubmittedOrFinal && (
              <Link href={`/app/settlements/${attempt.id}`}>
                <Button variant="secondary" size="md" className="gap-2">
                  <span>Track Settlement Status</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
