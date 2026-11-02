"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Download, Printer, Copy, Check, FileCode2, ChevronDown } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { LiveReceiptDetail } from "@/components/live/receipts/LiveReceiptDetail";
import { demoClient, connectedClient } from "@/lib/api/client";
import { VerifiableReceipt, Invoice, Delivery, PaymentAttempt } from "@/types/domain";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { Button, buttonStyles } from "@/components/ui/Button";
import { PageHeader, MetaItem } from "@/components/ui/PageHeader";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { DataList, DataRow } from "@/components/ui/DataList";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { StatusBadge, toneStyles } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LogoMark } from "@/components/brand/Logo";
import { SimulatedBadge } from "@/components/live/common";
import { ReceiptPaper, DocSection, DocField, StatusStamp } from "@/components/receipts/ReceiptDocument";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/formatters";

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
      <div className="space-y-6" aria-busy="true" aria-label="Loading receipt">
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-surface-3" />
          <div className="h-8 w-72 rounded bg-surface-3" />
        </div>
        <div className="mx-auto h-[560px] max-w-4xl rounded-lg border border-border bg-surface-1" />
      </div>
    );
  }

  if (!receipt) {
    return (
      <Panel>
        <EmptyState
          icon={<FileCode2 className="h-[18px] w-[18px]" />}
          title="Receipt not found"
          description={`No verifiable receipt exists for ${receiptId}. Receipts are issued only after settlement reaches finality.`}
          action={
            <Link href="/app/receipts" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              Back to receipts
            </Link>
          }
        />
      </Panel>
    );
  }

  const finalized = receipt.payment.hspStatus === "payment-finalized";

  return (
    <div className="space-y-6">
      <PageHeader
        className="no-print"
        back={{ href: "/app/receipts", label: "Receipts" }}
        eyebrow="Verifiable receipt"
        title={<span className="font-mono text-[22px] sm:text-2xl tracking-[-0.02em]">{receipt.id}</span>}
        badges={
          <>
            <StatusBadge status={receipt.payment.hspStatus} type="hsp" />
            <SimulatedBadge />
          </>
        }
        meta={
          <>
            <MetaItem label="Issued">{formatTimestamp(receipt.issuedAt)}</MetaItem>
            <MetaItem label="Invoice">
              <Link href={`/app/invoices/${receipt.invoiceId}`} className="font-mono hover:text-foreground hover:underline">
                {receipt.invoiceId}
              </Link>
            </MetaItem>
            {attempt && (
              <MetaItem label="Settlement">
                <Link href={`/app/settlements/${attempt.id}`} className="font-mono hover:text-foreground hover:underline">
                  {attempt.id}
                </Link>
              </MetaItem>
            )}
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleCopyProof} aria-live="polite">
              {copied ? <Check className="text-success" /> : <Copy />}
              {copied ? "Digest copied" : "Copy invoice digest"}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDownloadJson}>
              <Download />
              Export JSON
            </Button>
            <Button variant="inverse" size="sm" onClick={handlePrint}>
              <Printer />
              Print
            </Button>
          </>
        }
      />

      <ReceiptPaper label={`Receipt ${receipt.id}`}>
        {/* Document header */}
        <header className="flex flex-col gap-6 px-6 pb-7 pt-8 sm:flex-row sm:items-start sm:justify-between sm:px-10 sm:pt-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <LogoMark size={22} decorative />
              <span className="text-[15px] font-semibold tracking-[-0.03em] text-foreground">HashX</span>
            </div>
            <h1 className="mt-6 text-[26px] font-medium leading-tight tracking-[-0.03em] text-foreground sm:text-[30px]">
              Verifiable settlement receipt
            </h1>
            <p className="mt-2 max-w-md text-[13px] leading-relaxed text-foreground-secondary">
              Binds the seller&apos;s signed commercial intent, the verified delivery evidence, the payer&apos;s authorization, and the
              settlement it was issued against.
            </p>
          </div>
          <StatusStamp
            status={receipt.payment.hspStatus}
            date={formatTimestamp(receipt.payment.finalizedAt || receipt.issuedAt)}
            className="shrink-0 self-start"
          />
        </header>

        <div className="mx-6 mb-7 rounded-md border border-warning/25 bg-warning/[0.05] px-3.5 py-2.5 text-xs leading-relaxed text-foreground-secondary sm:mx-10">
          <span className="font-medium text-warning">Simulated demo record.</span> Hashes, addresses, and settlement states are
          illustrative in-browser fixtures. No real transaction occurred.
        </div>

        {/* Identification band */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border px-6 py-6 sm:px-10 md:grid-cols-4">
          <DocField label="Receipt ID">
            <span className="break-all font-mono text-xs">{receipt.id}</span>
          </DocField>
          <DocField label="Invoice">
            <span className="break-all font-mono text-xs">{receipt.invoiceId}</span>
          </DocField>
          <DocField label="Amount">
            <span className="text-[17px] font-medium tabular-nums tracking-[-0.02em]">{receipt.payment.humanAmount}</span>
            <span className="mt-0.5 block font-mono text-xs text-foreground-muted">{receipt.payment.tokenTotalRaw} raw units</span>
          </DocField>
          <DocField label={finalized ? "Finalized" : "Recorded"}>
            <span className="tabular-nums">{formatTimestamp(receipt.payment.finalizedAt || receipt.issuedAt)}</span>
          </DocField>
        </div>

        <DocSection index={1} title="Commercial intent" description="EIP-712 invoice signed by the seller agent.">
          <DataList>
            <DataRow label="Seller">{receipt.sellerDisplayName || "Registered seller"}</DataRow>
            <DataRow label="Seller wallet">
              <CopyableValue value={receipt.seller} displayText={receipt.seller} className="max-w-full" />
            </DataRow>
            <DataRow label="Buyer reference" mono>{receipt.buyerRef}</DataRow>
            <DataRow label="Invoice digest">
              <CopyableValue value={receipt.invoiceDigest} displayText={receipt.invoiceDigest} className="max-w-full" />
            </DataRow>
          </DataList>
        </DocSection>

        <DocSection index={2} title="Delivery evidence" description="Objective evidence checked before payment became eligible.">
          <DataList>
            <DataRow label="Evidence digest">
              <CopyableValue value={receipt.deliveryEvidenceDigest} displayText={receipt.deliveryEvidenceDigest} className="max-w-full" />
            </DataRow>
            {delivery && (
              <>
                <DataRow label="Artifact SHA-256">
                  <CopyableValue value={delivery.artifactSha256} displayText={delivery.artifactSha256} className="max-w-full" />
                </DataRow>
                <DataRow label="Delivery">
                  <span className="font-mono text-xs">{delivery.id}</span>
                  <span className="text-foreground-muted"> · version {delivery.version}</span>
                </DataRow>
                <DataRow label="Delivery status">
                  <span className={cn("text-[13px]", delivery.status === "ACCEPTED" ? toneStyles.success.text : toneStyles.warning.text)}>
                    {delivery.status === "ACCEPTED" ? "Accepted" : delivery.status === "REJECTED" ? "Rejected" : "Pending verification"}
                  </span>
                </DataRow>
              </>
            )}
          </DataList>
        </DocSection>

        <DocSection index={3} title="Human authorization" description="Two explicit approvals by the payer. Agents cannot approve.">
          <DataList>
            <DataRow label="Payer">
              <CopyableValue value={receipt.payment.payer} displayText={receipt.payment.payer} className="max-w-full" />
            </DataRow>
            <DataRow label="Stage 1 · terms">
              <span className={toneStyles.success.text}>Approved</span>
            </DataRow>
            <DataRow label="Stage 2 · submission">
              <span className={toneStyles.success.text}>Approved</span>
            </DataRow>
          </DataList>
        </DocSection>

        <DocSection index={4} title="Settlement" description="HashKey HSP flow the receipt was issued against (simulated).">
          <DataList>
            <DataRow label="Status">
              <StatusBadge status={receipt.payment.hspStatus} type="hsp" size="sm" />
            </DataRow>
            <DataRow label="Transaction">
              <CopyableValue value={receipt.payment.txHash} displayText={receipt.payment.txHash} className="max-w-full" />
            </DataRow>
            <DataRow label="HSP flow" mono>{receipt.payment.flowId}</DataRow>
            <DataRow label="Payment request" mono>{receipt.payment.paymentRequestId}</DataRow>
            <DataRow label="Payee">
              <CopyableValue value={receipt.payment.payee} displayText={receipt.payment.payee} className="max-w-full" />
            </DataRow>
          </DataList>
        </DocSection>

        <footer className="flex flex-col gap-2 border-t border-border bg-surface-2/50 px-6 py-4 text-xs text-foreground-muted sm:flex-row sm:items-center sm:justify-between sm:px-10 print:bg-white">
          <span className="min-w-0">
            Evidence registry tx <span className="break-all font-mono text-foreground-secondary">{receipt.evidenceRegistryTx}</span>
          </span>
          <span className="shrink-0">Receipt version {receipt.receiptVersion}</span>
        </footer>
      </ReceiptPaper>

      {/* Raw JSON envelope */}
      <Panel className="no-print mx-auto max-w-4xl">
        <button
          type="button"
          onClick={() => setShowJson(!showJson)}
          aria-expanded={showJson}
          aria-controls="receipt-json"
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/60 sm:px-5"
        >
          <span className="flex items-center gap-2.5">
            <FileCode2 className="h-4 w-4 text-foreground-muted" aria-hidden="true" />
            <span className="text-[13px] font-medium text-foreground">Raw receipt JSON</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs text-foreground-muted">
            {showJson ? "Hide" : "Inspect"}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", showJson && "rotate-180")} aria-hidden="true" />
          </span>
        </button>
        {showJson && (
          <PanelBody id="receipt-json" className="animate-fade-in border-t border-border">
            <CodeViewer title={`receipt-${receipt.id}.json`} data={receipt} />
          </PanelBody>
        )}
      </Panel>
    </div>
  );
}
