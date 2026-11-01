"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Coins,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Receipt,
  RefreshCw,
  AlertTriangle,
  Layers,
  Database,
  ArrowRight,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import { PaymentAttempt, VerifiableReceipt } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { formatAddress, formatHash, formatTimestamp, getHSPStatusMeta } from "@/lib/formatters";

export default function SettlementDetailPage() {
  const params = useParams();
  const attemptId = params?.id as string;
  const { mode } = useApp();

  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const [receipt, setReceipt] = useState<VerifiableReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);

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
      <div className="p-12 text-center text-foreground-muted font-mono text-xs">
        Loading settlement record {attemptId}...
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="p-12 text-center space-y-4">
        <h2 className="text-lg font-bold text-foreground">Record Not Found</h2>
        <p className="text-xs text-foreground-secondary">
          No settlement attempt found for ID <code>{attemptId}</code>.
        </p>
        <Link href="/app/settlements">
          <Button variant="secondary" size="sm">
            Back to Settlements
          </Button>
        </Link>
      </div>
    );
  }

  const meta = getHSPStatusMeta(attempt.hspStatus);
  const isFinalized = attempt.hspStatus === "payment-finalized";
  const isSafe = attempt.hspStatus === "payment-safe";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <Link href="/app/settlements">
            <Button variant="ghost" size="icon" aria-label="Back to Settlements">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-display font-bold text-foreground font-mono">
                {attempt.id}
              </h1>
              <StatusBadge status={attempt.hspStatus} type="hsp" size="sm" />
            </div>
            <p className="text-xs text-foreground-secondary mt-0.5">
              HSP Payment Request ID: <code>{attempt.paymentRequestId}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePollStatus}
            isLoading={isPolling}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Poll HSP Status (15s)</span>
          </Button>

          {isFinalized && receipt && (
            <Link href={`/app/receipts/${receipt.id}`}>
              <Button variant="primary" size="sm" className="gap-1.5">
                <Receipt className="w-4 h-4" />
                <span>Verifiable Receipt</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Critical Status Explanation Notice */}
      {isSafe && (
        <div className="p-4 rounded-xl border border-warning/40 bg-warning/10 text-warning flex items-start gap-3 text-xs">
          <Clock className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block">State: On-Chain Safe (Unfinalized)</span>
            <p className="text-foreground-secondary leading-relaxed">
              This transaction has been included in a HashKey Chain block and is considered safe from shallow reorganizations, but has NOT yet reached irreversible finality. Receipt generation remains locked until <code>payment-finalized</code> is confirmed by HSP reconciler.
            </p>
          </div>
        </div>
      )}

      {/* Settlement Overview Card */}
      <div className="p-6 rounded-xl border border-border bg-surface-1 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-primary-light" />
            <h3 className="text-sm font-semibold text-foreground">
              HSP Rail Settlement Telemetry
            </h3>
          </div>
          <span className="text-xs font-mono text-foreground-muted">
            Last Reconciled: {formatTimestamp(attempt.updatedAt)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-lg bg-surface-2 border border-border space-y-1">
            <span className="text-[11px] uppercase text-foreground-muted block">HSP Flow ID</span>
            <span className="text-foreground text-sm font-bold">{attempt.flowId}</span>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-2 border border-border space-y-1">
            <span className="text-[11px] uppercase text-foreground-muted block">Total Authorized Token Units</span>
            <span className="text-foreground text-sm font-bold">{attempt.approvalSummary.humanAmount}</span>
            <span className="text-[10px] text-foreground-muted block">Raw units: {attempt.tokenTotalRaw}</span>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-2 border border-border space-y-1">
            <span className="text-[11px] uppercase text-foreground-muted block">Payer Wallet (Debit)</span>
            <CopyableValue value={attempt.payer} displayText={formatAddress(attempt.payer, 6)} />
          </div>

          <div className="p-3.5 rounded-lg bg-surface-2 border border-border space-y-1">
            <span className="text-[11px] uppercase text-foreground-muted block">Payee Wallet (Credit)</span>
            <CopyableValue value={attempt.payee} displayText={formatAddress(attempt.payee, 6)} />
          </div>

          <div className="p-3.5 rounded-lg bg-surface-2 border border-border space-y-1">
            <span className="text-[11px] uppercase text-foreground-muted block">HashKey Chain Settlement Tx</span>
            {attempt.txHash ? (
              <CopyableValue
                value={attempt.txHash}
                displayText={formatHash(attempt.txHash, 8)}
                explorerUrl={`https://testnet.hsk.xyz/tx/${attempt.txHash}`}
              />
            ) : (
              <span className="text-foreground-muted italic">Awaiting block inclusion</span>
            )}
          </div>

          <div className="p-3.5 rounded-lg bg-surface-2 border border-border space-y-1">
            <span className="text-[11px] uppercase text-foreground-muted block">Evidence Registry Tx (Commitment)</span>
            {attempt.evidenceRegistryTx ? (
              <CopyableValue
                value={attempt.evidenceRegistryTx}
                displayText={formatHash(attempt.evidenceRegistryTx, 8)}
                explorerUrl={`https://testnet.hsk.xyz/tx/${attempt.evidenceRegistryTx}`}
              />
            ) : (
              <span className="text-foreground-muted italic">Written on finality</span>
            )}
          </div>
        </div>

        {/* Timeline of Actual Events */}
        <div className="space-y-3 pt-3 border-t border-border">
          <span className="text-xs font-semibold text-foreground block">
            State Transition Audit Trail
          </span>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-2 border border-border">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <div className="flex-1 flex justify-between">
                <span className="text-foreground font-mono">1. Order Created & Validated</span>
                <span className="text-foreground-muted font-mono">{formatTimestamp(attempt.createdAt)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-2 border border-border">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <div className="flex-1 flex justify-between">
                <span className="text-foreground font-mono">2. Two-Stage Human Authorization Granted</span>
                <span className="text-foreground-muted font-mono">{formatTimestamp(attempt.createdAt)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-2 border border-border">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <div className="flex-1 flex justify-between">
                <span className="text-foreground font-mono">3. Payment Submitted to HSP Rail</span>
                <span className="text-foreground-muted font-mono">{formatTimestamp(attempt.updatedAt)}</span>
              </div>
            </div>

            <div
              className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                isFinalized
                  ? "bg-surface-2 border-border"
                  : "bg-surface-1/40 border-border/40 text-foreground-muted"
              }`}
            >
              {isFinalized ? (
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              ) : (
                <Clock className="w-4 h-4 text-warning shrink-0" />
              )}
              <div className="flex-1 flex justify-between">
                <span className="font-mono">
                  {isFinalized
                    ? "4. Finalized on HashKey Chain (Irreversible)"
                    : "4. Settlement Finality Confirmation (In Progress)"}
                </span>
                <span className="text-foreground-muted font-mono">
                  {isFinalized ? formatTimestamp(attempt.updatedAt) : "Polling..."}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
