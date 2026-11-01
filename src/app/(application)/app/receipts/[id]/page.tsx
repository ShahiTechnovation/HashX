"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Receipt,
  Download,
  Printer,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  Coins,
  FileText,
  Lock,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import { VerifiableReceipt, Invoice } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { formatAddress, formatHash, formatTimestamp } from "@/lib/formatters";

export default function ReceiptDetailPage() {
  const params = useParams();
  const receiptId = params?.id as string;
  const { mode } = useApp();

  const [receipt, setReceipt] = useState<VerifiableReceipt | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = mode === "connected" ? connectedClient : demoClient;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        const rcpts = await client.getReceipts();
        const found = rcpts.find((r: VerifiableReceipt) => r.id === receiptId);
        if (isMounted && found) {
          setReceipt(found);
          const inv = await client.getInvoiceById(found.invoiceId);
          if (isMounted) setInvoice(inv);
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

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    if (!receipt) return;
    const blob = new Blob([receipt.rawPayloadJson || JSON.stringify(receipt, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hashx-receipt-${receipt.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-foreground-muted font-mono text-xs">
        Loading receipt record {receiptId}...
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="p-12 text-center space-y-4">
        <h2 className="text-lg font-bold text-foreground">Receipt Not Found</h2>
        <p className="text-xs text-foreground-secondary">
          No finalized commercial receipt exists with ID <code>{receiptId}</code>.
        </p>
        <Link href="/app/receipts">
          <Button variant="secondary" size="sm">
            Back to Receipts
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header (Hidden on print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border no-print">
        <div className="flex items-center gap-3">
          <Link href="/app/receipts">
            <Button variant="ghost" size="icon" aria-label="Back to Receipts">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-display font-bold text-foreground font-mono">
                {receipt.id}
              </h1>
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-success/20 text-success border border-success/40 font-semibold">
                IRREVERSIBLE FINALITY
              </span>
            </div>
            <p className="text-xs text-foreground-secondary mt-0.5">
              HashKey Chain EVM ID 133 • HSP Agentic Settlement Rail
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadJson} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            <span>Download JSON</span>
          </Button>

          <Button variant="primary" size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="w-3.5 h-3.5" />
            <span>Print Document</span>
          </Button>
        </div>
      </div>

      {/* Verifiable Receipt Document Sheet */}
      <div className="receipt-container p-8 sm:p-10 rounded-2xl border border-border bg-surface-1 shadow-2xl space-y-8">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 pb-6 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-xl text-foreground">
                Hash<span className="text-primary-light">X</span> Global
              </span>
              <span className="text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded bg-surface-2 text-foreground-secondary border border-border">
                Commercial Proof
              </span>
            </div>
            <p className="text-xs text-foreground-muted">
              Official Cryptographic Receipt of Fulfilled Agent Obligation
            </p>
          </div>

          <div className="text-right font-mono text-xs space-y-1">
            <div className="font-bold text-foreground">Receipt #{receipt.id}</div>
            <div className="text-foreground-secondary">
              Settled: {formatTimestamp(receipt.payment.finalizedAt)}
            </div>
            <div className="text-success text-[11px] font-semibold flex items-center justify-end gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> 100% Deterministically Verified
            </div>
          </div>
        </div>

        {/* 1. Commercial Summary */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-foreground-muted font-semibold">
            1. Commercial Exchange Agreement
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono p-4 rounded-xl bg-surface-2 border border-border">
            <div>
              <span className="text-foreground-muted block mb-1">Original Invoice:</span>
              <Link href={`/app/invoices/${receipt.invoiceId}`} className="text-primary-light hover:underline font-bold">
                {receipt.invoiceId}
              </Link>
            </div>
            <div>
              <span className="text-foreground-muted block mb-1">Buyer Reference:</span>
              <span className="text-foreground">{receipt.buyerRef}</span>
            </div>
            <div>
              <span className="text-foreground-muted block mb-1">Seller Identity:</span>
              <div className="font-sans font-medium text-foreground">{receipt.sellerDisplayName || "Seller Agent"}</div>
              <CopyableValue value={receipt.seller} displayText={formatAddress(receipt.seller, 6)} />
            </div>
            <div>
              <span className="text-foreground-muted block mb-1">Total Settled Amount:</span>
              <div className="text-base font-bold text-foreground">
                {receipt.payment.humanAmount}
              </div>
              <span className="text-[11px] text-foreground-muted">Raw: {receipt.payment.tokenTotalRaw} units</span>
            </div>
          </div>
        </div>

        {/* 2. Cryptographic Digest Chain */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-foreground-muted font-semibold">
            2. Cryptographic Proof Chain
          </h3>
          <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-3 text-xs font-mono">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
              <span className="text-foreground-muted">EIP-712 Invoice Digest:</span>
              <CopyableValue value={receipt.invoiceDigest} displayText={receipt.invoiceDigest} />
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
              <span className="text-foreground-muted">Fulfillment Telemetry Digest:</span>
              <CopyableValue value={receipt.deliveryEvidenceDigest} displayText={receipt.deliveryEvidenceDigest} />
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
              <span className="text-foreground-muted">Evidence Registry Commitment:</span>
              <CopyableValue
                value={receipt.evidenceRegistryTx}
                displayText={receipt.evidenceRegistryTx}
                explorerUrl={`https://testnet.hsk.xyz/tx/${receipt.evidenceRegistryTx}`}
              />
            </div>
          </div>
        </div>

        {/* 3. HSP Settlement Confirmation */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-foreground-muted font-semibold">
            3. HSP Settlement Execution
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono p-4 rounded-xl bg-surface-2 border border-border">
            <div>
              <span className="text-foreground-muted block mb-1">HSP Flow ID:</span>
              <span className="text-foreground">{receipt.payment.flowId}</span>
            </div>
            <div>
              <span className="text-foreground-muted block mb-1">Payment Request ID:</span>
              <span className="text-foreground">{receipt.payment.paymentRequestId}</span>
            </div>
            <div>
              <span className="text-foreground-muted block mb-1">Payer Address:</span>
              <CopyableValue value={receipt.payment.payer} displayText={formatAddress(receipt.payment.payer, 6)} />
            </div>
            <div>
              <span className="text-foreground-muted block mb-1">Payee Address:</span>
              <CopyableValue value={receipt.payment.payee} displayText={formatAddress(receipt.payment.payee, 6)} />
            </div>
            <div className="sm:col-span-2 pt-2 border-t border-border">
              <span className="text-foreground-muted block mb-1">HashKey Chain Settlement Tx:</span>
              <CopyableValue
                value={receipt.payment.txHash}
                displayText={receipt.payment.txHash}
                explorerUrl={`https://testnet.hsk.xyz/tx/${receipt.payment.txHash}`}
              />
            </div>
          </div>
        </div>

        {/* Technical JSON Viewer Accordion */}
        <div className="space-y-3 no-print">
          <h3 className="text-xs font-mono uppercase tracking-wider text-foreground-muted font-semibold">
            Raw Proof Commitment Bundle
          </h3>
          <CodeViewer title="Receipt Record JSON" data={receipt} maxHeight="max-h-60" />
        </div>
      </div>
    </div>
  );
}
