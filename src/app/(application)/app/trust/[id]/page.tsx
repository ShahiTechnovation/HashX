"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  AlertOctagon,
  Coins,
  FileText,
  Clock,
  Layers,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  Database,
  Lock,
  Code,
  Terminal,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import {
  Invoice,
  Delivery,
  InvoiceVerificationResult,
  DeliveryVerificationResult,
  CombinedVerificationResult,
  InvoiceCheckKey,
  DeliveryCheckKey,
} from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EvidenceCard } from "@/components/ui/EvidenceCard";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { Drawer } from "@/components/ui/Drawer";
import { formatAddress, formatHash, formatTimestamp } from "@/lib/formatters";
import { evaluatePaymentEligibility } from "@/lib/verification/engine";
import { MOCK_COUNTERPARTIES, FIXTURE_DELIVERY_FAKE_COUNT } from "@/mocks/fixtures";
import { verifyInvoice as runVerifyInvoice, verifyDelivery as runVerifyDelivery } from "@/lib/verification/engine";

export default function TrustInspectorPage() {
  const params = useParams();
  const invoiceId = params?.id as string;
  const router = useRouter();
  const { mode } = useApp();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [invoiceVerification, setInvoiceVerification] = useState<InvoiceVerificationResult | null>(null);
  const [deliveryVerification, setDeliveryVerification] = useState<DeliveryVerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);
  const [isRequestingPayment, setIsRequestingPayment] = useState(false);

  const client = mode === "connected" ? connectedClient : demoClient;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        const inv = await client.getInvoiceById(invoiceId);
        if (isMounted) setInvoice(inv);

        if (inv) {
          // Perform deterministic invoice check
          const invResult = runVerifyInvoice(inv, MOCK_COUNTERPARTIES);
          if (isMounted) setInvoiceVerification(invResult);

          const del = await client.getDeliveryByInvoiceId(inv.id);
          if (isMounted) setDelivery(del);

          if (del) {
            const mockTxCount = del.id === FIXTURE_DELIVERY_FAKE_COUNT.id ? 17 : undefined;
            const delResult = runVerifyDelivery(inv, del, mockTxCount);
            if (isMounted) setDeliveryVerification(delResult);
          }
        }
      } catch (err) {
        console.error("Failed to load verification data:", err);
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
        Loading trust observability telemetry for {invoiceId}...
      </div>
    );
  }

  if (!invoice || !invoiceVerification) {
    return (
      <div className="p-12 text-center space-y-4">
        <h2 className="text-lg font-bold text-foreground">Record Not Found</h2>
        <p className="text-xs text-foreground-secondary">
          No verification logs available for ID <code>{invoiceId}</code>.
        </p>
        <Link href="/app/trust">
          <Button variant="secondary" size="sm">
            Back to Trust Index
          </Button>
        </Link>
      </div>
    );
  }

  const combinedResult = evaluatePaymentEligibility(invoiceVerification, deliveryVerification || undefined);
  const isPass = combinedResult.overallDecision === "PASS";
  const isFail = combinedResult.overallDecision === "FAIL";
  const isPending = combinedResult.overallDecision === "PENDING";

  const handleRequestPayment = async () => {
    setIsRequestingPayment(true);
    try {
      const attempt = await client.requestPayment({
        invoice_id: invoice.id,
        payer: "0x1234567890123456789012345678901234567890",
        merchant_name: "HashX Global",
      });
      router.push(`/app/approvals/${attempt.id}`);
    } catch (err) {
      console.error("Failed to request payment:", err);
    } finally {
      setIsRequestingPayment(false);
    }
  };

  const invoiceCheckKeys: InvoiceCheckKey[] = [
    "schema",
    "signature",
    "identity_binding",
    "expiry",
    "nonce_unused",
    "terms_consistent",
  ];

  const deliveryCheckKeys: DeliveryCheckKey[] = [
    "manifest_signature",
    "artifact_hash",
    "schema",
    "requested_address",
    "block_range",
    "transaction_count",
    "sample_transaction_proofs",
    "freshness",
  ];

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <Link href="/app/trust">
            <Button variant="ghost" size="icon" aria-label="Back to Trust Index">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-display font-bold text-foreground">
                Trust Inspector
              </h1>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-2 text-foreground-secondary border border-border">
                {invoice.id}
              </span>
            </div>
            <p className="text-xs text-foreground-secondary mt-0.5">
              Cryptographic observability & deterministic verification pipeline.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEvidenceDrawerOpen(true)}
            className="gap-1.5"
          >
            <Code className="w-4 h-4 text-primary-light" />
            <span>Raw Evidence Digest</span>
          </Button>

          <Link href={`/app/invoices/${invoice.id}`}>
            <Button variant="secondary" size="sm">
              View Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Prominent Signature Verdict Banner */}
      <div
        className={`p-6 rounded-xl border transition-all duration-300 ${
          isPass
            ? "border-success/40 bg-success/5 shadow-[0_0_30px_rgba(66,202,155,0.12)]"
            : isFail
            ? "border-danger/50 bg-danger/5 shadow-[0_0_35px_rgba(237,112,130,0.15)]"
            : "border-warning/40 bg-warning/5"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl border shrink-0 ${
                isPass
                  ? "border-success/40 bg-success/10 text-success"
                  : isFail
                  ? "border-danger/40 bg-danger/10 text-danger"
                  : "border-warning/40 bg-warning/10 text-warning"
              }`}
            >
              {isPass ? (
                <ShieldCheck className="w-8 h-8" />
              ) : isFail ? (
                <ShieldAlert className="w-8 h-8" />
              ) : (
                <Clock className="w-8 h-8" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xl font-display font-bold tracking-tight ${
                    isPass ? "text-success" : isFail ? "text-danger" : "text-warning"
                  }`}
                >
                  VERDICT: {isPass ? "PASS — VERIFIED" : isFail ? "FAIL — PAYMENT BLOCKED" : "PENDING VERIFICATION"}
                </span>
                <span className="text-xs font-mono text-foreground-muted">
                  • Verifier {invoiceVerification.verifierVersion}
                </span>
              </div>
              <p className="text-xs text-foreground-secondary leading-relaxed max-w-2xl">
                {combinedResult.eligibilityExplanation}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end shrink-0 text-xs font-mono text-foreground-secondary">
            <span>Evaluated at {formatTimestamp(invoiceVerification.verifiedAt)}</span>
            <span className="text-primary-light">RPC: https://testnet.hsk.xyz (133)</span>
          </div>
        </div>
      </div>

      {/* Main Checks Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Col: Invoice Cryptographic Checks (6 checks) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary-light" />
              <h3 className="text-sm font-semibold text-foreground">
                Invoice Cryptographic Checks (6)
              </h3>
            </div>
            <span className="text-xs font-mono text-foreground-muted">
              EIP-712 Spec
            </span>
          </div>

          <div className="space-y-2.5">
            {invoiceCheckKeys.map((key) => {
              const detail = invoiceVerification.checkDetails[key];
              return (
                <EvidenceCard
                  key={key}
                  name={key}
                  detail={detail}
                />
              );
            })}
          </div>
        </div>

        {/* Right Col: Deterministic Delivery Fulfillment Checks (8 checks) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary-light" />
              <h3 className="text-sm font-semibold text-foreground">
                Fulfillment Delivery Checks (8)
              </h3>
            </div>
            <span className="text-xs font-mono text-foreground-muted">
              Policy: analytics_v1
            </span>
          </div>

          {deliveryVerification ? (
            <div className="space-y-2.5">
              {deliveryCheckKeys.map((key) => {
                const detail = deliveryVerification.checkDetails[key];
                return (
                  <EvidenceCard
                    key={key}
                    name={key}
                    detail={detail}
                  />
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center rounded-xl border border-dashed border-border bg-surface-1/40 space-y-2">
              <Clock className="w-8 h-8 text-foreground-muted mx-auto" />
              <h4 className="text-sm font-medium text-foreground">Awaiting Delivery Submission</h4>
              <p className="text-xs text-foreground-secondary max-w-sm mx-auto">
                Delivery artifact and manifest have not been submitted by the seller. 8 deterministic telemetry checks are pending.
              </p>
              <Link href={`/app/invoices/${invoice.id}`}>
                <Button variant="secondary" size="sm" className="mt-2">
                  Go to Invoice to Submit
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Payment Eligibility Decision & Action Bar */}
      <div className="p-5 rounded-xl border border-border bg-surface-1 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Payment Eligibility Status
          </h4>
          <p className="text-xs text-foreground-secondary mt-0.5">
            {combinedResult.isEligibleForPayment
              ? "All cryptographic and deterministic fulfillment criteria passed. Payment may now be prepared."
              : "Payment actions remain disabled by deterministic policy code until all verification gates pass."}
          </p>
        </div>

        <div>
          {combinedResult.isEligibleForPayment ? (
            <Button
              variant="primary"
              size="md"
              onClick={handleRequestPayment}
              isLoading={isRequestingPayment}
              className="gap-2"
            >
              <Coins className="w-4 h-4" />
              <span>Proceed to Human Approval</span>
            </Button>
          ) : (
            <Button variant="secondary" size="md" disabled className="gap-2 cursor-not-allowed opacity-50">
              <Lock className="w-4 h-4 text-danger" />
              <span>Payment Ineligible</span>
            </Button>
          )}
        </div>
      </div>

      {/* Raw Evidence Drawer */}
      <Drawer
        isOpen={evidenceDrawerOpen}
        onClose={() => setEvidenceDrawerOpen(false)}
        title="Technical Verification Evidence"
        subtitle={`Audit proof digest for ${invoice.id}`}
        width="lg"
      >
        <div className="space-y-4 text-xs font-mono">
          <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-1.5">
            <span className="text-[11px] text-foreground-muted block">Invoice EIP-712 Digest:</span>
            <CopyableValue value={invoiceVerification.invoiceDigest} displayText={invoiceVerification.invoiceDigest} />
          </div>

          {deliveryVerification && (
            <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-1.5">
              <span className="text-[11px] text-foreground-muted block">Delivery Evidence Digest:</span>
              <CopyableValue value={deliveryVerification.evidenceDigest} displayText={deliveryVerification.evidenceDigest} />
            </div>
          )}

          <div className="space-y-2">
            <span className="font-sans font-semibold text-foreground block">
              Active Reason Codes ({invoiceVerification.reasonCodes.concat(deliveryVerification?.reasonCodes || []).length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {invoiceVerification.reasonCodes
                .concat(deliveryVerification?.reasonCodes || [])
                .map((code, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 rounded bg-danger/20 text-danger border border-danger/40 text-xs font-mono font-semibold"
                  >
                    {code}
                  </span>
                ))}
              {invoiceVerification.reasonCodes.length === 0 &&
                (!deliveryVerification || deliveryVerification.reasonCodes.length === 0) && (
                  <span className="text-success text-xs font-sans">
                    No policy violation codes recorded. All checks passed.
                  </span>
                )}
            </div>
          </div>

          <CodeViewer
            title="Full Verification Run Result (JSON)"
            data={{
              invoiceVerification,
              deliveryVerification,
              combinedResult,
            }}
            maxHeight="max-h-96"
          />
        </div>
      </Drawer>
    </div>
  );
}
