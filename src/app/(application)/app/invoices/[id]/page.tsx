"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Coins,
  FileText,
  Clock,
  Upload,
  CheckCircle2,
  Lock,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  FileCode,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import { Invoice, Delivery, PaymentAttempt, CombinedVerificationResult } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { formatAddress, formatHash, formatTimestamp, formatExpiryCountdown } from "@/lib/formatters";
import { evaluatePaymentEligibility } from "@/lib/verification/engine";
import { Modal } from "@/components/ui/Modal";

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params?.id as string;
  const router = useRouter();
  const { mode, triggerRefresh } = useApp();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [paymentAttempt, setPaymentAttempt] = useState<PaymentAttempt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);
  const [isRequestingPayment, setIsRequestingPayment] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);

  // Delivery form state
  const [claimedTxCount, setClaimedTxCount] = useState<number>(14);

  const client = mode === "connected" ? connectedClient : demoClient;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        const inv = await client.getInvoiceById(invoiceId);
        if (isMounted) setInvoice(inv);

        if (inv) {
          const del = await client.getDeliveryByInvoiceId(inv.id);
          if (isMounted) setDelivery(del);

          try {
            const pay = await client.getPaymentStatus(inv.id);
            if (isMounted) setPaymentAttempt(pay);
          } catch {
            // No payment attempt yet
          }
        }
      } catch (err) {
        console.error("Failed to load invoice details:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (invoiceId) loadData();
    return () => {
      isMounted = false;
    };
  }, [invoiceId, mode]);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-foreground-muted font-mono text-xs">
        Loading commercial record {invoiceId}...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-12 text-center space-y-4">
        <h2 className="text-lg font-bold text-foreground">Invoice Not Found</h2>
        <p className="text-xs text-foreground-secondary">
          No commercial agreement with ID <code>{invoiceId}</code> was located.
        </p>
        <Link href="/app/invoices">
          <Button variant="secondary" size="sm">
            Back to Invoices
          </Button>
        </Link>
      </div>
    );
  }

  // Derive verification decisions
  const isInvoiceVerified = invoice.status === "VERIFIED" || invoice.status === "DELIVERY_ACCEPTED" || invoice.status === "SETTLED";
  const isDeliveryVerified = invoice.status === "DELIVERY_ACCEPTED" || invoice.status === "SETTLED";
  const isEligibleForPayment = isInvoiceVerified && isDeliveryVerified;

  const handleSubmitDelivery = async () => {
    setIsSubmittingDelivery(true);
    try {
      const artifactContent = {
        schema: "hashx.analytics.v1" as const,
        chain_id: invoice.payment.preferred_chain_id,
        address: invoice.service.parameters.address,
        start_block: parseInt(invoice.service.parameters.start_block, 10),
        end_block: parseInt(invoice.service.parameters.end_block, 10),
        transaction_count: claimedTxCount,
        native_value_in_raw: "5000000000000000000",
        native_value_out_raw: "1500000000000000000",
        counterparties: [
          { address: "0x1234567890123456789012345678901234567890" as `0x${string}`, tx_count: claimedTxCount },
        ],
        sample_transactions: [
          {
            hash: "0x3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b" as `0x${string}`,
            block_number: parseInt(invoice.service.parameters.start_block, 10) + 10,
          },
        ],
        generated_at: new Date().toISOString(),
      };

      const newDel = await client.submitDelivery({
        invoice_id: invoice.id,
        artifact_uri: `s3://hashx-deliveries/artifacts/${invoice.id}-v1.json`,
        artifact_sha256: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
        manifest: {
          schema: "hashx.delivery.analytics.v1",
          seller: invoice.sellerWallet,
          generated_at: new Date().toISOString(),
          service_parameters_hash: invoice.serviceTermsHash,
          artifact_sha256: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
        },
        manifest_signature: "0x8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1c" as `0x${string}`,
        artifact_content: artifactContent,
      });

      // Run verification
      await client.verifyDelivery({ invoice_id: invoice.id, delivery_id: newDel.id });

      setDelivery(newDel);
      setDeliveryModalOpen(false);
      triggerRefresh();
      // Reload updated invoice
      const updatedInv = await client.getInvoiceById(invoice.id);
      if (updatedInv) setInvoice(updatedInv);
    } catch (err) {
      console.error("Delivery submission failed:", err);
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  const handleRequestPayment = async () => {
    setIsRequestingPayment(true);
    try {
      const attempt = await client.requestPayment({
        invoice_id: invoice.id,
        payer: "0x1234567890123456789012345678901234567890",
        merchant_name: "HashX Global",
      });
      setPaymentAttempt(attempt);
      triggerRefresh();
      router.push(`/app/approvals/${attempt.id}`);
    } catch (err) {
      console.error("Payment request failed:", err);
    } finally {
      setIsRequestingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <Link href="/app/invoices">
            <Button variant="ghost" size="icon" aria-label="Back to Invoices">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-display font-bold text-foreground font-mono">
                {invoice.id}
              </h1>
              <StatusBadge status={invoice.status} type="invoice" size="sm" />
            </div>
            <p className="text-xs text-foreground-secondary mt-0.5">
              Buyer Reference: <code>{invoice.buyerRef}</code> • Nonce: <code>{invoice.nonce}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/app/trust/${invoice.id}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary-light" />
              <span>Trust Inspector</span>
            </Button>
          </Link>

          {isEligibleForPayment && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleRequestPayment}
              isLoading={isRequestingPayment}
              className="gap-1.5"
            >
              <Coins className="w-4 h-4" />
              <span>Request Payment via HSP</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Commercial Terms & Delivery */}
        <div className="lg:col-span-2 space-y-6">
          {/* Commercial Agreement Card */}
          <div className="p-5 rounded-xl border border-border bg-surface-1 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary-light" />
                <h3 className="text-sm font-semibold text-foreground">
                  Immutable Commercial Agreement
                </h3>
              </div>
              <span className="text-[11px] font-mono text-foreground-muted flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Signed v{invoice.version}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-1">
                <span className="text-[11px] font-mono uppercase text-foreground-muted">Seller Agent</span>
                <div className="font-medium text-foreground">{invoice.sellerDisplayName || "Seller"}</div>
                <CopyableValue value={invoice.sellerWallet} displayText={formatAddress(invoice.sellerWallet)} />
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-1">
                <span className="text-[11px] font-mono uppercase text-foreground-muted">Payment Payee</span>
                <AmountDisplay amountMinor={invoice.payment.amount_minor} size="sm" />
                <CopyableValue value={invoice.payment.payee} displayText={formatAddress(invoice.payment.payee)} />
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-1">
                <span className="text-[11px] font-mono uppercase text-foreground-muted">Target Service</span>
                <div className="font-mono text-foreground">{invoice.service.type}</div>
                <div className="text-[11px] text-foreground-secondary">
                  Policy: <code>{invoice.service.acceptance_policy}</code>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-1">
                <span className="text-[11px] font-mono uppercase text-foreground-muted">Validity Window</span>
                <div className="font-mono text-foreground">{formatTimestamp(invoice.expiresAt)}</div>
                <div className="text-[11px] text-foreground-muted">
                  Issued: {formatTimestamp(invoice.issuedAt)}
                </div>
              </div>
            </div>

            {/* Service Parameters */}
            <div className="p-3.5 rounded-lg bg-surface-2 border border-border text-xs space-y-2">
              <span className="text-[11px] font-mono uppercase text-foreground-muted block">
                Agreed Service Parameters
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                <div>
                  <span className="text-foreground-muted block">Target Address:</span>
                  <CopyableValue value={invoice.service.parameters.address} displayText={formatAddress(invoice.service.parameters.address)} />
                </div>
                <div>
                  <span className="text-foreground-muted block">Start Block:</span>
                  <span className="text-foreground font-semibold">{invoice.service.parameters.start_block}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block">End Block:</span>
                  <span className="text-foreground font-semibold">{invoice.service.parameters.end_block}</span>
                </div>
              </div>
            </div>

            {/* Digest and Signature */}
            <div className="p-3 rounded-lg bg-surface-2/60 border border-border/80 text-xs font-mono space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-foreground-muted">EIP-712 Digest:</span>
                <CopyableValue value={invoice.digest || ""} displayText={formatHash(invoice.digest || "")} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-muted">Seller Signature:</span>
                <CopyableValue value={invoice.signature || ""} displayText={formatHash(invoice.signature || "")} />
              </div>
            </div>
          </div>

          {/* Service Fulfillment / Delivery Card */}
          <div className="p-5 rounded-xl border border-border bg-surface-1 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-primary-light" />
                <h3 className="text-sm font-semibold text-foreground">
                  Fulfillment & Delivery Telemetry
                </h3>
              </div>

              {delivery ? (
                <StatusBadge
                  status={delivery.status === "ACCEPTED" ? "Fulfillment Verified" : delivery.status}
                  type="generic"
                  size="sm"
                />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeliveryModalOpen(true)}
                  className="gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Submit Deliverable</span>
                </Button>
              )}
            </div>

            {delivery ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-1">
                    <span className="text-[11px] font-mono uppercase text-foreground-muted">Artifact SHA-256</span>
                    <CopyableValue value={delivery.artifactSha256} displayText={formatHash(delivery.artifactSha256)} />
                  </div>
                  <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-1">
                    <span className="text-[11px] font-mono uppercase text-foreground-muted">Manifest Signer</span>
                    <CopyableValue value={delivery.manifest.seller} displayText={formatAddress(delivery.manifest.seller)} />
                  </div>
                </div>

                <CodeViewer
                  title="Delivered hashx.analytics.v1 Artifact"
                  data={delivery.artifactContent}
                  maxHeight="max-h-60"
                />
              </div>
            ) : (
              <div className="p-8 text-center rounded-lg border border-dashed border-border bg-surface-2/30 space-y-2">
                <FileText className="w-8 h-8 text-foreground-muted mx-auto" />
                <h4 className="text-sm font-medium text-foreground">Awaiting Service Delivery</h4>
                <p className="text-xs text-foreground-secondary max-w-sm mx-auto">
                  The seller agent has not yet submitted the telemetry artifact and signed manifest.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDeliveryModalOpen(true)}
                  className="mt-2"
                >
                  Simulate Delivery Submission
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Trust Inspector Summary & Settlement State */}
        <div className="space-y-6">
          {/* Trust Gating Panel */}
          <div className="p-5 rounded-xl border border-border bg-surface-1 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center justify-between">
              <span>Verification Gating</span>
              <Link
                href={`/app/trust/${invoice.id}`}
                className="text-xs text-primary-light hover:underline flex items-center gap-1"
              >
                <span>Full Audit</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </h3>

            <div className="space-y-2.5">
              <div className="p-3 rounded-lg bg-surface-2 border border-border flex items-center justify-between text-xs">
                <span>Invoice Authenticity</span>
                <StatusBadge
                  status={invoice.status === "REJECTED" ? "FAIL" : "PASS"}
                  type="check"
                  size="sm"
                />
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-border flex items-center justify-between text-xs">
                <span>Deterministic Delivery</span>
                <StatusBadge
                  status={
                    delivery?.status === "ACCEPTED"
                      ? "PASS"
                      : delivery?.status === "REJECTED"
                      ? "FAIL"
                      : "SKIPPED"
                  }
                  type="check"
                  size="sm"
                />
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-border flex items-center justify-between text-xs">
                <span>Payment Eligible</span>
                <span
                  className={`font-mono text-xs font-semibold ${
                    isEligibleForPayment ? "text-success" : "text-danger"
                  }`}
                >
                  {isEligibleForPayment ? "YES — UNLOCKED" : "NO — GATED"}
                </span>
              </div>
            </div>

            {!isEligibleForPayment && (
              <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-tight">
                  Payment gating enforced: funds cannot be requested or authorized until cryptographic terms and deterministic fulfillment pass verification.
                </span>
              </div>
            )}
          </div>

          {/* Settlement Attempt status (if exists) */}
          {paymentAttempt && (
            <div className="p-5 rounded-xl border border-border bg-surface-1 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">HSP Payment Attempt</h3>
                <StatusBadge status={paymentAttempt.hspStatus} type="hsp" size="sm" />
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between text-foreground-secondary">
                  <span>Flow ID:</span>
                  <span>{paymentAttempt.flowId}</span>
                </div>
                <div className="flex justify-between text-foreground-secondary">
                  <span>Request ID:</span>
                  <span>{paymentAttempt.paymentRequestId}</span>
                </div>
                <div className="flex justify-between text-foreground-secondary">
                  <span>Authorized:</span>
                  <span className="text-foreground">{paymentAttempt.approvalSummary.humanAmount}</span>
                </div>
              </div>

              <Link href={`/app/settlements/${paymentAttempt.id}`}>
                <Button variant="secondary" size="sm" className="w-full mt-2">
                  View Settlement Explorer
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Delivery Submission Modal */}
      <Modal
        isOpen={deliveryModalOpen}
        onClose={() => setDeliveryModalOpen(false)}
        title="Submit Delivery Artifact"
        description="Seller agent delivers JSON analytics telemetry and signed manifest."
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-1">
            <span className="text-[11px] font-mono uppercase text-foreground-muted">Target Service</span>
            <div className="font-mono text-foreground">{invoice.service.type}</div>
            <div className="font-mono text-foreground-secondary">
              Block Range: {invoice.service.parameters.start_block} .. {invoice.service.parameters.end_block}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-medium text-foreground">
              Delivered Transaction Count Claim
            </label>
            <input
              type="number"
              value={claimedTxCount}
              onChange={(e) => setClaimedTxCount(parseInt(e.target.value, 10) || 0)}
              className="w-full p-2.5 rounded-lg bg-surface-2 border border-border text-foreground font-mono"
            />
            <p className="text-[11px] text-foreground-muted">
              The verifier recomputes this against HashKey Chain RPC. Mismatches trigger <code>TX_COUNT_MISMATCH</code>.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => setDeliveryModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmitDelivery}
              isLoading={isSubmittingDelivery}
            >
              Sign Manifest & Submit
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
