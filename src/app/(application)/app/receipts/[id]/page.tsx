"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Printer,
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  FileCode2,
  Lock,
  Stamp,
  Layers,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { LiveReceiptDetail } from "@/components/live/receipts/LiveReceiptDetail";
import { demoClient, connectedClient } from "@/lib/api/client";
import { VerifiableReceipt, Invoice, Delivery, PaymentAttempt } from "@/types/domain";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { cn } from "@/lib/utils";
import { formatAddress, formatTimestamp, getExplorerTxUrl } from "@/lib/formatters";

/** Connected mode renders only real backend records; demo mode keeps the simulated fixture view. */
export default function ReceiptDetailRoute() {
  const params = useParams();
  const id = params?.id as string;
  const { mode } = useApp();
  return mode === "connected" ? <LiveReceiptDetail id={id} /> : <DemoReceiptDetailPage />;
}

function DemoReceiptDetailPage() {
  const params = useParams();
  const receiptId = params?.id as string;
  const { mode } = useApp();

  const [receipt, setReceipt] = useState<VerifiableReceipt | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const client = mode === "connected" ? connectedClient : demoClient;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        const rcpts = await client.getReceipts();
        const found = rcpts.find((r: VerifiableReceipt) => r.id === receiptId || r.invoiceId === receiptId);
        if (isMounted && found) {
          setReceipt(found);
          const inv = await client.getInvoiceById(found.invoiceId);
          if (isMounted) setInvoice(inv);

          const [del, attempts] = await Promise.all([
            client.getDeliveryByInvoiceId(found.invoiceId).catch(() => null),
            client.getPaymentAttempts().catch(() => [] as PaymentAttempt[]),
          ]);
          if (isMounted) {
            setDelivery(del);
            setAttempt(
              attempts.find((p) => p.flowId === found.payment.flowId) ??
                attempts.find((p) => p.invoiceId === found.invoiceId) ??
                null
            );
          }
        }
      } catch (err) {
        console.error("Failed to load receipt:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (receiptId) loadData();
    return () => {
      isMounted = false;
    };
  }, [receiptId, mode]);

  const receiptJson = useMemo(
    () => (receipt ? receipt.rawPayloadJson || JSON.stringify(receipt, null, 2) : ""),
    [receipt]
  );

  const handlePrint = () => {
    window.print();
  };

  const handleCopyProof = async () => {
    if (receipt) {
      await navigator.clipboard.writeText(receipt.invoiceDigest);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadJson = () => {
    if (!receipt) return;
    const blob = new Blob([receiptJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hashx-receipt-${receipt.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-14 bg-carbon-nav border border-carbon-border rounded" />
        <div className="max-w-4xl mx-auto h-[600px] bg-carbon-nav border border-carbon-border rounded" />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="space-y-6">
        <div className="bg-carbon-nav border border-carbon-border p-8 rounded text-center">
          <FileCode2 className="w-10 h-10 text-carbon-muted mx-auto mb-3" />
          <h2 className="font-display text-lg font-bold text-carbon-text">
            Receipt Not Found
          </h2>
          <p className="text-xs text-carbon-muted font-mono mt-1 mb-4">
            No verifiable receipt exists for {receiptId}.
          </p>
          <Link
            href="/app/receipts"
            className="px-4 py-2 rounded text-xs font-mono font-medium text-carbon-text bg-carbon-panel border border-carbon-border hover:bg-carbon-void transition-colors inline-block"
          >
            Back to Receipts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Shell Control Bar */}
      <section className="bg-carbon-nav border border-carbon-border p-3.5 rounded flex flex-wrap items-center justify-between gap-4 font-mono text-xs select-none">
        <div className="flex items-center gap-2">
          <Link href="/app/receipts" className="text-carbon-muted hover:text-carbon-text transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Receipts</span>
          </Link>
          <span className="text-carbon-border">/</span>
          <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary font-semibold">
            RECORD #{receipt.id}
          </span>
          <span className="text-success text-[11px] hidden sm:inline ml-2 border-l border-carbon-border pl-3">
            Status: SETTLED &amp; FINALIZED
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyProof}
            className="px-3 py-1.5 rounded bg-carbon-panel hover:bg-carbon-void border border-carbon-border text-carbon-text text-xs font-mono transition-colors flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-carbon-muted" />}
            <span>{copied ? "Digest Copied" : "Copy Digest"}</span>
          </button>

          <button
            onClick={handleDownloadJson}
            className="px-3 py-1.5 rounded bg-carbon-panel hover:bg-carbon-void border border-carbon-border text-carbon-text text-xs font-mono transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-carbon-muted" />
            <span>Export Envelope</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded bg-primary hover:bg-primary/90 text-white text-xs font-mono font-medium transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Certificate</span>
          </button>
        </div>
      </section>

      {/* 2. Physical Parchment Certificate in Carbon Frame */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#FBFAF6] text-[#111719] p-8 sm:p-12 rounded-sm border border-[#D9DCD7] shadow-2xl relative overflow-hidden select-text">
          {/* Subtle security background watermark */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#111719_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Crosshairs on corners */}
          <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-[#111719]/40" />
          <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-[#111719]/40" />
          <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-[#111719]/40" />
          <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-[#111719]/40" />

          {/* Certificate Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b-2 border-[#111719] pb-6 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 bg-[#345BEE] flex items-center justify-center font-mono font-bold text-white text-xs rounded-none">
                  HX
                </div>
                <span className="font-mono text-xs font-bold tracking-widest text-[#111719] uppercase">
                  PROOF SYSTEM / HASHX
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111719] uppercase mt-2">
                Verifiable Settlement Certificate
              </h1>
              <p className="font-mono text-xs text-[#515B60] mt-1">
                CRYPTOGRAPHIC ATTESTATION OF COMMERCIAL INTENT, DELIVERED SERVICE, AND RECONCILED SETTLEMENT
              </p>
            </div>

            {/* Official Seal Badge */}
            <div className="w-24 h-24 rounded-full border-2 border-dashed border-[#345BEE] p-1 flex flex-col items-center justify-center text-center shrink-0 self-center sm:self-auto bg-[#345BEE]/5 select-none">
              <ShieldCheck className="w-6 h-6 text-[#345BEE] mb-0.5" />
              <span className="font-mono text-[8px] font-bold text-[#345BEE] uppercase tracking-tighter leading-tight">
                FINALIZED
              </span>
              <span className="font-mono text-[7px] text-[#515B60] uppercase">
                AUTHENTIC
              </span>
            </div>
          </div>

          {/* Certificate Identification Band */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-6 mb-8 border-b border-[#D9DCD7] font-mono text-xs">
            <div>
              <span className="text-[10px] text-[#788287] uppercase block">Receipt Identifier</span>
              <span className="font-bold text-[#111719] break-all">{receipt.id}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#788287] uppercase block">Associated Invoice</span>
              <span className="font-bold text-[#111719]">#{receipt.invoiceId}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#788287] uppercase block">Final Settlement Amount</span>
              <span className="font-bold text-[#0D824B] text-sm">
                {receipt.payment.humanAmount} {receipt.payment.tokenSymbol}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#788287] uppercase block">Finality Attested At</span>
              <span className="font-medium text-[#111719]">
                {formatTimestamp(receipt.payment.finalizedAt || receipt.issuedAt)}
              </span>
            </div>
          </div>

          {/* The 4 Cryptographic Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Pillar 01: Commercial Intent */}
            <div className="p-4 bg-[#F4F2EB] border border-[#D9DCD7] space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-[#D9DCD7]">
                <span className="font-mono text-[10px] font-bold text-[#345BEE] uppercase tracking-wider">
                  01 // COMMERCIAL INTENT
                </span>
                <span className="font-mono text-[9px] text-[#0D824B] font-bold">EIP-712 AUTHENTIC</span>
              </div>
              <div className="font-mono text-xs space-y-1 pt-1">
                <div className="text-[11px]">
                  <span className="text-[#788287]">Creditor Agent:</span>{" "}
                  <span className="font-semibold text-[#111719]">
                    {receipt.sellerDisplayName || "Registered Agent"}
                  </span>
                </div>
                <div className="text-[11px] truncate">
                  <span className="text-[#788287]">Creditor Wallet:</span>{" "}
                  <span className="text-[#111719]">{formatAddress(receipt.seller, 8)}</span>
                </div>
                <div className="text-[11px] truncate">
                  <span className="text-[#788287]">Invoice Digest:</span>{" "}
                  <span className="text-[#111719] break-all">{receipt.invoiceDigest.slice(0, 26)}...</span>
                </div>
              </div>
            </div>

            {/* Pillar 02: Digital Delivery Proof */}
            <div className="p-4 bg-[#F4F2EB] border border-[#D9DCD7] space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-[#D9DCD7]">
                <span className="font-mono text-[10px] font-bold text-[#345BEE] uppercase tracking-wider">
                  02 // OBJECTIVE DELIVERY
                </span>
                <span className="font-mono text-[9px] text-[#0D824B] font-bold">RPC WITNESS MATCH</span>
              </div>
              <div className="font-mono text-xs space-y-1 pt-1">
                <div className="text-[11px]">
                  <span className="text-[#788287]">Verification:</span>{" "}
                  <span className="font-semibold text-[#111719]">Chain State Match</span>
                </div>
                <div className="text-[11px] truncate">
                  <span className="text-[#788287]">Artifact SHA-256:</span>{" "}
                  <span className="text-[#111719]">{receipt.deliveryEvidenceDigest.slice(0, 26)}...</span>
                </div>
                <div className="text-[11px]">
                  <span className="text-[#788287]">Status:</span>{" "}
                  <span className="text-[#0D824B] font-semibold">Accepted &amp; Fulfillable</span>
                </div>
              </div>
            </div>

            {/* Pillar 03: Explicit Human Quorum */}
            <div className="p-4 bg-[#F4F2EB] border border-[#D9DCD7] space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-[#D9DCD7]">
                <span className="font-mono text-[10px] font-bold text-[#345BEE] uppercase tracking-wider">
                  03 // HUMAN AUTHORIZATION
                </span>
                <span className="font-mono text-[9px] text-[#0D824B] font-bold">2/2 QUORUM CONFIRMED</span>
              </div>
              <div className="font-mono text-xs space-y-1 pt-1">
                <div className="text-[11px]">
                  <span className="text-[#788287]">Stage 1 (Terms Review):</span>{" "}
                  <span className="text-[#0D824B] font-semibold">Approved ✓</span>
                </div>
                <div className="text-[11px]">
                  <span className="text-[#788287]">Stage 2 (Treasury Submit):</span>{" "}
                  <span className="text-[#0D824B] font-semibold">Approved ✓</span>
                </div>
                <div className="text-[11px] truncate">
                  <span className="text-[#788287]">Approver:</span>{" "}
                  <span className="text-[#111719]">Institutional Treasury Officer</span>
                </div>
              </div>
            </div>

            {/* Pillar 04: Reconciled Settlement */}
            <div className="p-4 bg-[#F4F2EB] border border-[#D9DCD7] space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-[#D9DCD7]">
                <span className="font-mono text-[10px] font-bold text-[#345BEE] uppercase tracking-wider">
                  04 // HSP SETTLEMENT
                </span>
                <span className="font-mono text-[9px] text-[#0D824B] font-bold">FINALITY RECONCILED</span>
              </div>
              <div className="font-mono text-xs space-y-1 pt-1">
                <div className="text-[11px] truncate">
                  <span className="text-[#788287]">Settlement Tx:</span>{" "}
                  <span className="text-[#111719] font-mono">{formatAddress(receipt.payment.txHash, 8)}</span>
                </div>
                <div className="text-[11px]">
                  <span className="text-[#788287]">HSP Rail Flow:</span>{" "}
                  <span className="text-[#111719] font-mono">{receipt.payment.flowId}</span>
                </div>
                <div className="text-[11px]">
                  <span className="text-[#788287]">Debiting Party:</span>{" "}
                  <span className="text-[#111719]">{formatAddress(receipt.payment.payer, 6)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Security Anchor */}
          <div className="border-t-2 border-[#111719] pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-[10px] text-[#515B60]">
            <div>
              <span>EVIDENCE REGISTRY TX: </span>
              <span className="text-[#111719] font-bold">{receipt.evidenceRegistryTx}</span>
            </div>
            <div>
              <span>CERTIFICATE VERSION: {receipt.receiptVersion}</span>
            </div>
          </div>
        </div>

        {/* Raw JSON Envelope Toggle */}
        <div className="mt-6 bg-carbon-nav border border-carbon-border rounded p-4">
          <button
            onClick={() => setShowJson(!showJson)}
            className="w-full flex items-center justify-between text-xs font-mono text-carbon-muted hover:text-carbon-text transition-colors"
          >
            <span className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-primary" />
              <span>Cryptographic Receipt JSON Envelope</span>
            </span>
            <span>{showJson ? "Hide Envelope" : "Inspect Raw JSON"}</span>
          </button>

          {showJson && (
            <div className="mt-3 pt-3 border-t border-carbon-border">
              <CodeViewer title={`receipt-${receipt.id}.json`} data={receipt} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
