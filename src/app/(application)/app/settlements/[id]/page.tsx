"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronDown,
  FileJson2,
  Lock,
  Receipt,
  RefreshCw,
  Stamp,
  CheckCircle2,
  Clock,
  Layers,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { LiveSettlementDetail } from "@/components/live/payments/LiveSettlementDetail";
import { demoClient, connectedClient } from "@/lib/api/client";
import { PaymentAttempt, VerifiableReceipt } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { FinalityTrack } from "@/components/ui/FinalityTrack";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { formatAddress, formatTimestamp, getExplorerTxUrl, getHSPStatusMeta } from "@/lib/formatters";

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
      <div className="space-y-6 animate-pulse">
        <div className="h-14 bg-carbon-nav border border-carbon-border rounded" />
        <div className="h-64 bg-carbon-nav border border-carbon-border rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
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
          <Lock className="w-10 h-10 text-carbon-muted mx-auto mb-3" />
          <h2 className="font-display text-lg font-bold text-carbon-text">
            Settlement Record Not Found
          </h2>
          <p className="text-xs text-carbon-muted font-mono mt-1 mb-4">
            No settlement record matches ID {attemptId}.
          </p>
          <Link
            href="/app/settlements"
            className="px-4 py-2 rounded text-xs font-mono font-medium text-carbon-text bg-carbon-panel border border-carbon-border hover:bg-carbon-void transition-colors inline-block"
          >
            Back to Settlements
          </Link>
        </div>
      </div>
    );
  }

  const meta = getHSPStatusMeta(attempt.hspStatus);
  const isFinal = attempt.hspStatus === "payment-finalized";
  const isSafe = attempt.hspStatus === "payment-safe";

  return (
    <div className="space-y-6">
      {/* 1. Technical Context Header */}
      <section className="bg-carbon-nav border border-carbon-border p-4 rounded select-none">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-carbon-muted mb-1">
              <Link href="/app" className="hover:text-carbon-text transition-colors">
                Console
              </Link>
              <span className="text-carbon-border">/</span>
              <Link href="/app/settlements" className="hover:text-carbon-text transition-colors">
                Settlement Explorer
              </Link>
              <span className="text-carbon-border">/</span>
              <span className="text-primary font-semibold">#{attempt.id}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-carbon-text tracking-tight uppercase">
              Settlement Reconciler &amp; Finality Track
            </h1>
            <p className="text-xs text-carbon-muted font-mono mt-0.5">
              HashKey HSP transaction state tracking from submission to irreversible finality.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePollStatus}
              disabled={isPolling}
              className="px-3 py-1.5 rounded text-xs font-mono text-carbon-muted hover:text-carbon-text bg-carbon-panel border border-carbon-border hover:bg-carbon-void flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isPolling && "animate-spin")} />
              <span>Poll Status</span>
            </button>
            <Link
              href={`/app/trust/${attempt.invoiceId}`}
              className="px-3 py-1.5 rounded text-xs font-mono font-medium text-carbon-text bg-carbon-panel border border-carbon-border hover:bg-carbon-void flex items-center gap-1.5 transition-colors"
            >
              <span>Trust Inspector</span>
              <ExternalLink className="w-3 h-3 text-carbon-muted" />
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Signature Component — The Finality Track Card */}
      <div className="bg-carbon-nav border border-carbon-border rounded p-6 shadow-xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-[2px]",
            isFinal
              ? "bg-gradient-to-r from-success via-primary to-success"
              : isSafe
              ? "bg-gradient-to-r from-sky-400 via-primary to-sky-400"
              : "bg-gradient-to-r from-primary via-warning to-primary"
          )}
        />

        {/* Focused Tx Meta Row */}
        <div className="flex flex-wrap items-center justify-between pb-6 border-b border-carbon-border gap-4">
          <div className="flex items-center gap-4">
            <div className="px-2.5 py-1 bg-carbon-void border border-carbon-border rounded font-mono text-xs font-bold text-primary">
              #HSP-{attempt.id.slice(-4).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display text-base font-bold text-carbon-text">
                  Settlement Intent: {attempt.approvalSummary?.merchantName || "Verified Agent"}
                </span>
                <span className="text-xs font-mono text-carbon-border">|</span>
                <span className="text-xs font-mono text-carbon-muted">
                  Payee: {formatAddress(attempt.payee)}
                </span>
              </div>
              <p className="text-xs text-carbon-muted font-mono mt-0.5">
                Submitted at {formatTimestamp(attempt.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right font-mono">
              <span className="text-[10px] text-carbon-muted uppercase block">
                Disbursement Amount
              </span>
              <span className="font-display text-xl font-bold text-carbon-text">
                {attempt.approvalSummary?.humanAmount || "0.00 USDC"}
              </span>
            </div>

            {/* Current Stage Badge */}
            <div className="px-3 py-1.5 rounded bg-carbon-void border border-carbon-border flex items-center gap-2">
              <span
                className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  isFinal ? "bg-success" : isSafe ? "bg-sky-400 animate-pulse" : "bg-warning"
                )}
              />
              <div className="text-left font-mono">
                <span className="text-[9px] text-carbon-muted block uppercase font-bold tracking-wider">
                  CURRENT STAGE
                </span>
                <span
                  className={cn(
                    "text-xs font-bold uppercase",
                    isFinal ? "text-success" : isSafe ? "text-sky-300" : "text-warning"
                  )}
                >
                  {meta.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Architectural 5-Stage Horizontal Finality Timeline */}
        <div className="py-6">
          <FinalityTrack status={attempt.hspStatus} />
        </div>

        {/* Safe is not final alert banner */}
        {isSafe && !isFinal && (
          <div className="mt-4 p-3 bg-sky-500/10 border border-sky-400/40 rounded flex items-center justify-between text-xs font-mono text-sky-200">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                <strong>SAFE IS NOT FINAL:</strong> Transaction is included on-chain but awaiting consensus finality.
                Verifiable receipt will be anchored upon reaching full settlement finality.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Two-Column Forensic Telemetry & HSP Settlement Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Parameters & Commitments */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-carbon-nav border border-carbon-border rounded p-5 space-y-4">
            <div className="pb-3 border-b border-carbon-border flex items-center justify-between">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-carbon-text">
                Settlement Parameters &amp; On-Chain Anchors
              </h3>
              <StatusBadge status={attempt.hspStatus} type="hsp" size="sm" />
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 bg-carbon-panel rounded border border-carbon-border space-y-1">
                <div className="text-[10px] text-carbon-muted uppercase">On-Chain Transaction Hash</div>
                {attempt.txHash ? (
                  <div className="flex items-center justify-between">
                    <span className="text-carbon-text break-all">{attempt.txHash}</span>
                    <a
                      href={getExplorerTxUrl(attempt.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 flex items-center gap-1 text-[11px] shrink-0 ml-2"
                    >
                      <span>Explorer</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  <span className="text-carbon-muted">Awaiting broadcast inclusion</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-carbon-panel rounded border border-carbon-border space-y-1">
                  <div className="text-[10px] text-carbon-muted uppercase">HSP Flow ID</div>
                  <div className="text-carbon-text font-bold break-all">{attempt.flowId}</div>
                </div>

                <div className="p-3 bg-carbon-panel rounded border border-carbon-border space-y-1">
                  <div className="text-[10px] text-carbon-muted uppercase">Payment Request ID</div>
                  <div className="text-carbon-text font-bold break-all">{attempt.paymentRequestId}</div>
                </div>
              </div>

              <div className="p-3 bg-carbon-panel rounded border border-carbon-border space-y-1">
                <div className="text-[10px] text-carbon-muted uppercase">Evidence Registry Anchor</div>
                {attempt.evidenceRegistryTx ? (
                  <div className="text-success break-all">{attempt.evidenceRegistryTx}</div>
                ) : (
                  <span className="text-carbon-muted">Committed alongside final receipt</span>
                )}
              </div>
            </div>
          </div>

          {/* Raw HSP Telemetry toggle */}
          <div className="bg-carbon-nav border border-carbon-border rounded p-4">
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="w-full flex items-center justify-between text-xs font-mono text-carbon-muted hover:text-carbon-text transition-colors"
            >
              <span className="flex items-center gap-2">
                <FileJson2 className="w-4 h-4 text-primary" />
                <span>Raw HSP Settlement Payload</span>
              </span>
              <span>{showRaw ? "Hide JSON" : "Inspect Raw JSON"}</span>
            </button>

            {showRaw && (
              <div className="mt-3 pt-3 border-t border-carbon-border">
                <CodeViewer title={`hsp-attempt-${attempt.id}.json`} data={attempt} />
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Receipt Anchor Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-carbon-nav border border-carbon-border rounded p-5 space-y-4 sticky top-20 shadow-lg">
            <div className="pb-3 border-b border-carbon-border">
              <span className="text-[10px] font-mono text-carbon-muted uppercase tracking-wider block">
                TERMINAL STATE ARTIFACT
              </span>
              <h3 className="font-display text-base font-bold text-carbon-text mt-0.5">
                Verifiable Cryptographic Receipt
              </h3>
            </div>

            {isFinal ? (
              <div className="space-y-4 font-mono text-xs">
                <div className="p-4 bg-success/10 border border-success/40 rounded space-y-2">
                  <div className="flex items-center gap-2 text-success font-bold text-xs uppercase">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Settlement Irreversibly Finalized</span>
                  </div>
                  <p className="text-[11px] text-carbon-muted leading-relaxed">
                    HashKey HSP has confirmed block finality. An evidence-backed verifiable receipt has been minted and committed to the ledger.
                  </p>
                </div>

                <Link
                  href={`/app/receipts/${attempt.invoiceId}`}
                  className="w-full px-4 py-2.5 rounded text-xs font-semibold text-white bg-success hover:bg-success/90 flex items-center justify-center gap-2 shadow-sm transition-colors text-center"
                >
                  <Receipt className="w-4 h-4" />
                  <span>View Verifiable Receipt Certificate</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-4 font-mono text-xs">
                <div className="p-4 bg-carbon-panel rounded border border-carbon-border space-y-2 text-center">
                  <Clock className="w-8 h-8 text-carbon-muted mx-auto mb-1" />
                  <div className="text-carbon-text font-bold">Awaiting Settlement Finality</div>
                  <p className="text-[11px] text-carbon-muted leading-relaxed max-w-xs mx-auto">
                    The verifiable receipt is only minted once full settlement finality has been attested on chain. Safe transactions will transition to finalized automatically.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
