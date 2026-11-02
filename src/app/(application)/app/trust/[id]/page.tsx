"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Braces, Check, Clock, FileSignature, FileText, Fingerprint, KeyRound, RefreshCw, Scale, ScanSearch, X } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { LiveTrustInspector } from "@/components/live/trust/LiveTrustInspector";
import { demoClient, connectedClient } from "@/lib/api/client";
import {
  Invoice,
  Delivery,
  InvoiceVerificationResult,
  DeliveryVerificationResult,
} from "@/types/domain";
import { Button, buttonStyles } from "@/components/ui/Button";
import { PageHeader, MetaItem } from "@/components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { DataList, DataRow } from "@/components/ui/DataList";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { StatusBadge, toneStyles } from "@/components/ui/StatusBadge";
import { SimulatedBadge } from "@/components/live/common";
import { VerdictBand, type Gate } from "@/components/trust/VerdictBand";
import { CheckListPanel } from "@/components/trust/CheckListPanel";
import { HashGroup, type HashRowSpec } from "@/components/trust/EvidenceHashes";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { formatAddress, formatExpiryCountdown, formatMinorToUsd, formatTimestamp } from "@/lib/formatters";
import { evaluatePaymentEligibility } from "@/lib/verification/engine";
import {
  INVOICE_CHECK_KEYS,
  DELIVERY_CHECK_KEYS,
  chainName,
  countChecks,
  runInvoiceVerification,
  runDeliveryVerification,
} from "@/components/trust/evaluate";

function DemoTrustInspectorPage() {
  const params = useParams();
  const invoiceId = params?.id as string;
  const router = useRouter();
  const { mode, walletAddress, isWalletConnected } = useApp();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [invoiceVerification, setInvoiceVerification] = useState<InvoiceVerificationResult | null>(null);
  const [deliveryVerification, setDeliveryVerification] = useState<DeliveryVerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestingPayment, setIsRequestingPayment] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const rawRef = useRef<HTMLDivElement>(null);

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

          if (mode === "connected") {
            // In Connected Mode, authoritative verification must come from backend persistent records
            const verification = await client.getInvoiceVerification(inv.id);
            if (isMounted && verification?.invoiceVerification) {
              setInvoiceVerification(verification.invoiceVerification);
              setDeliveryVerification(verification.deliveryVerification || null);
            } else if (isMounted) {
              // Trigger authoritative backend verification if not yet recorded
              try {
                await client.verifyInvoice({ invoice_id: inv.id });
                if (del) await client.verifyDelivery({ invoice_id: inv.id });
                const fresh = await client.getInvoiceVerification(inv.id);
                if (fresh) {
                  setInvoiceVerification(fresh.invoiceVerification);
                  setDeliveryVerification(fresh.deliveryVerification || null);
                }
              } catch {
                setInvoiceVerification(null);
                setDeliveryVerification(null);
              }
            }
          } else {
            // In Demo Mode, use local deterministic verification engine with adversarial fixtures
            const invResult = runInvoiceVerification(inv);
            if (isMounted) setInvoiceVerification(invResult);

            if (del) {
              const delResult = runDeliveryVerification(inv, del);
              if (isMounted) setDeliveryVerification(delResult);
            } else if (isMounted) {
              setDeliveryVerification(null);
            }
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

  if (isLoading) return <InspectorSkeleton invoiceId={invoiceId} />;

  if (!invoice || !invoiceVerification) {
    return (
      <div className="space-y-6">
        <PageHeader back={{ href: "/app/trust", label: "Trust Inspector" }} eyebrow="Verification record" title={<span className="font-mono">{invoiceId}</span>} />
        <Panel>
          <EmptyState
            icon={<ScanSearch className="h-[18px] w-[18px]" />}
            title="No verification record found"
            description={`No invoice or verification data exists for ${invoiceId} in this mode.`}
            action={
              <Link href="/app/trust" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                Back to Trust Inspector
              </Link>
            }
          />
        </Panel>
      </div>
    );
  }

  const combinedResult = evaluatePaymentEligibility(
    invoiceVerification,
    deliveryVerification || undefined
  );
  const decision = combinedResult.overallDecision;
  const isFail = decision === "FAIL";
  const isEligible = combinedResult.isEligibleForPayment;

  const invCounts = countChecks(invoiceVerification.checks);
  const delCounts = deliveryVerification ? countChecks(deliveryVerification.checks) : null;
  const passedTotal = invCounts.passed + (delCounts?.passed ?? 0);
  const totalChecks = invCounts.total + DELIVERY_CHECK_KEYS.length;

  const reasonCodes = Array.from(
    new Set([...invoiceVerification.reasonCodes, ...(deliveryVerification?.reasonCodes ?? [])])
  );

  const chainId = invoice.payment.preferred_chain_id;
  const expiry = formatExpiryCountdown(invoice.expiresAt);

  const handleRequestPayment = async () => {
    setIsRequestingPayment(true);
    setRequestError(null);
    try {
      if (mode === "connected" && (!isWalletConnected || !walletAddress)) {
        throw new Error("Connect your payer wallet (EIP-1193) before requesting payment execution.");
      }

      const activePayer =
        mode === "connected" && walletAddress
          ? walletAddress
          : ("0x742d35Cc6634C0532925a3b844Bc454e4438f44e" as `0x${string}`);

      const attempt = await client.requestPayment({
        invoice_id: invoice.id,
        payer: activePayer,
        merchant_name: "HashX",
      });
      router.push(`/app/approvals/${attempt.id}`);
    } catch (err) {
      console.error("Failed to request payment:", err);
      setRequestError(err instanceof Error ? err.message : "Payment request failed.");
    } finally {
      setIsRequestingPayment(false);
    }
  };

  const handleRerun = async () => {
    if (!invoice) return;
    setIsLoading(true);
    try {
      if (mode === "connected") {
        await client.verifyInvoice({ invoice_id: invoice.id });
        if (delivery) {
          await client.verifyDelivery({ invoice_id: invoice.id });
        }
        const updated = await client.getInvoiceVerification(invoice.id);
        if (updated) {
          setInvoiceVerification(updated.invoiceVerification);
          setDeliveryVerification(updated.deliveryVerification || null);
        }
      } else {
        setInvoiceVerification(runInvoiceVerification(invoice));
        setDeliveryVerification(delivery ? runDeliveryVerification(invoice, delivery) : null);
      }
    } catch (err: any) {
      console.error("Re-verification failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const invoiceGate: Gate["state"] =
    invoiceVerification.decision === "PASS" ? "pass" : invoiceVerification.decision === "FAIL" ? "fail" : "pending";
  const deliveryGate: Gate["state"] = !deliveryVerification
    ? "idle"
    : deliveryVerification.decision === "PASS"
      ? "pass"
      : deliveryVerification.decision === "FAIL"
        ? "fail"
        : "pending";
  const gates: Gate[] = [
    {
      key: "intent",
      label: "Signed intent",
      detail: `${invCounts.passed}/${invCounts.total} checks passed`,
      state: invoiceGate,
    },
    {
      key: "delivery",
      label: "Delivery evidence",
      detail: delCounts ? `${delCounts.passed}/${delCounts.total} checks passed` : "No delivery submitted",
      state: deliveryGate,
    },
    {
      key: "payment",
      label: "Payment gate",
      detail: isEligible ? "Human authorization required" : isFail ? "Re-issue required" : "Waiting on evidence",
      state: isEligible ? "open" : isFail ? "blocked" : "held",
    },
  ];

  const consequence = isEligible
    ? "Eligible for payment — a human payer must still authorize it."
    : isFail
      ? "Payment gated. This invoice cannot be paid as issued."
      : "Payment held until the delivered work is verified.";

  const intentRows: HashRowSpec[] = [
    { label: "Invoice digest", hint: "EIP-712 typed-data hash", value: invoiceVerification.invoiceDigest },
    { label: "Seller signature", hint: "secp256k1 over the digest", value: invoice.signature, emptyText: "Unsigned" },
    {
      label: "Recovered signer",
      hint: "Must equal the seller wallet",
      value: invoiceVerification.signerRecovered,
      match:
        invoiceVerification.checks.signature === "PASS"
          ? { ok: true, label: "Matches seller" }
          : invoiceVerification.checks.signature === "FAIL"
            ? { ok: false, label: "Does not match" }
            : undefined,
    },
    { label: "Seller wallet", value: invoice.sellerWallet },
    { label: "Service terms hash", value: invoice.serviceTermsHash },
    { label: "Buyer reference hash", value: invoice.buyerRefHash },
  ];

  const deliveryRows: HashRowSpec[] = delivery
    ? [
        { label: "Artifact URI", value: delivery.artifactUri },
        {
          label: "Artifact SHA-256",
          hint: "Recomputed from artifact bytes",
          value: delivery.artifactSha256,
          match:
            deliveryVerification?.checks.artifact_hash === "PASS"
              ? { ok: true, label: "Matches manifest" }
              : deliveryVerification?.checks.artifact_hash === "FAIL"
                ? { ok: false, label: "Mismatch" }
                : undefined,
        },
        { label: "Manifest SHA-256", hint: "Committed by the seller", value: delivery.manifest.artifact_sha256 },
        {
          label: "Manifest signature",
          value: delivery.manifestSignature,
          match:
            deliveryVerification?.checks.manifest_signature === "PASS"
              ? { ok: true, label: "Signed by seller" }
              : deliveryVerification?.checks.manifest_signature === "FAIL"
                ? { ok: false, label: "Invalid" }
                : undefined,
        },
        { label: "Evidence digest", value: deliveryVerification?.evidenceDigest, emptyText: "Not yet verified" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/app/trust", label: "Trust Inspector" }}
        eyebrow="Verification record"
        title={<span className="font-mono text-[22px] sm:text-[26px] tracking-[-0.02em]">{invoice.id}</span>}
        badges={
          <>
            <StatusBadge status={decision} type="verdict" />
            <SimulatedBadge />
          </>
        }
        description="Deterministic checks of the seller's signed terms and of the delivered work, evaluated in this browser against simulated fixtures."
        meta={
          <>
            <MetaItem label="Seller">{invoice.sellerDisplayName || "External agent"}</MetaItem>
            <MetaItem label="Amount">
              <span className="tabular-nums">{formatMinorToUsd(invoice.payment.amount_minor)} USDC</span>
            </MetaItem>
            <MetaItem label="Evaluated">{formatTimestamp(invoiceVerification.verifiedAt)}</MetaItem>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleRerun}>
              <RefreshCw />
              Re-evaluate
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowRaw(!showRaw)} aria-expanded={showRaw}>
              <Braces />
              {showRaw ? "Hide JSON" : "Raw JSON"}
            </Button>
            <Link href={`/app/invoices/${invoice.id}`} className={buttonStyles({ variant: "ghost", size: "sm" })}>
              <FileText />
              Invoice
            </Link>
          </>
        }
      />

      <VerdictBand
        decision={decision}
        consequence={consequence}
        explanation={combinedResult.eligibilityExplanation}
        invoiceId={invoice.id}
        reasonCodes={reasonCodes}
        gates={gates}
        aside={
          <DataList dense>
            <DataRow label="At stake">
              <span className="font-medium tabular-nums">{formatMinorToUsd(invoice.payment.amount_minor)} USDC</span>
            </DataRow>
            <DataRow label="Checks passed">
              <span className="tabular-nums">
                {passedTotal} of {totalChecks}
              </span>
            </DataRow>
            <DataRow label="Verifier" stacked>
              <span className="break-all font-mono text-xs">{invoiceVerification.verifierVersion}</span>
            </DataRow>
            {deliveryVerification && (
              <DataRow label="Evidence verified" stacked>
                {formatTimestamp(deliveryVerification.verifiedAt)}
              </DataRow>
            )}
          </DataList>
        }
      />

      {showRaw && (
        <div ref={rawRef} className="animate-fade-in">
          <CodeViewer
            title={`verification-run · ${invoice.id}.json`}
            data={{ invoiceVerification, deliveryVerification, combinedResult }}
            maxHeight="max-h-[480px]"
          />
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="min-w-0 space-y-6 xl:col-span-8">
          <CheckListPanel
            title="Signed intent"
            description="EIP-712 signature, seller identity binding, expiry, nonce and terms consistency."
            icon={<FileSignature />}
            keys={INVOICE_CHECK_KEYS}
            checks={invoiceVerification.checks}
            details={invoiceVerification.checkDetails}
            reasonCodes={invoiceVerification.reasonCodes}
          />

          {deliveryVerification ? (
            <CheckListPanel
              title="Delivery evidence"
              description="The delivered artifact recomputed independently and compared with the signed terms."
              icon={<Scale />}
              keys={DELIVERY_CHECK_KEYS}
              checks={deliveryVerification.checks}
              details={deliveryVerification.checkDetails}
              reasonCodes={deliveryVerification.reasonCodes}
            />
          ) : (
            <Panel>
              <PanelHeader
                title="Delivery evidence"
                description="The delivered artifact recomputed independently and compared with the signed terms."
                icon={<Scale />}
              />
              <EmptyState
                icon={<Clock className="h-[18px] w-[18px]" />}
                title="No delivery submitted yet"
                description={`The seller agent has not submitted an artifact and signed manifest. The ${DELIVERY_CHECK_KEYS.length} fulfillment checks run once a delivery arrives.`}
              />
            </Panel>
          )}

          <Panel>
            <PanelHeader
              title="Evidence identifiers"
              description="Every value the verdict depends on. Copy any value to verify it independently."
              icon={<Fingerprint />}
            />
            <HashGroup title="Signed intent" rows={intentRows} className="pb-2" />
            {delivery && <HashGroup title="Delivery" rows={deliveryRows} className="border-t border-border pb-2" />}
          </Panel>
        </div>

        <aside className="min-w-0 space-y-6 xl:col-span-4">
          <Panel>
            <PanelHeader title="Payment eligibility" icon={<KeyRound />} />
            <PanelBody className="space-y-5">
              <div
                className={cn(
                  "flex items-start gap-2.5 rounded-md border px-3.5 py-3",
                  isEligible ? toneStyles.success.bg : isFail ? toneStyles.danger.bg : toneStyles.warning.bg,
                  isEligible ? toneStyles.success.border : isFail ? toneStyles.danger.border : toneStyles.warning.border
                )}
              >
                {isEligible ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                ) : isFail ? (
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                ) : (
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-[13px] font-medium",
                      isEligible ? "text-success" : isFail ? "text-danger" : "text-warning"
                    )}
                  >
                    {isEligible ? "Eligible for authorization" : isFail ? "Payment blocked" : "Evidence pending"}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-foreground-secondary">
                    {/* The headline already states the outcome; drop the engine's repeated prefix. */}
                    {combinedResult.eligibilityExplanation.replace(/^(Payment blocked|Eligible for payment):\s*/i, "")}
                  </p>
                </div>
              </div>

              <DataList dense>
                <DataRow label="Amount">
                  <span className="font-medium tabular-nums">{formatMinorToUsd(invoice.payment.amount_minor)} USDC</span>
                </DataRow>
                <DataRow label="Payee">
                  <CopyableValue value={invoice.payment.payee} displayText={formatAddress(invoice.payment.payee)} label="Copy payee address" />
                </DataRow>
                <DataRow label="Network">
                  {chainName(chainId)} <span className="font-mono text-xs text-foreground-muted">({chainId})</span>
                </DataRow>
                <DataRow label="Expires">
                  <span className={cn(expiry.isExpired && "text-danger")}>{expiry.text}</span>
                </DataRow>
                <DataRow label="Nonce">
                  <span className="font-mono text-xs">{invoice.nonce}</span>
                </DataRow>
              </DataList>

              <div>
                <p className="eyebrow mb-2">Human authorization</p>
                <ol className="divide-y divide-border rounded-md border border-border text-[13px]">
                  <li className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="text-foreground">Stage 1 · Terms review</span>
                    <span className={cn("text-xs", isEligible ? "text-warning" : "text-foreground-muted")}>
                      {isEligible ? "Awaiting payer" : "Locked"}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="text-foreground">Stage 2 · Wallet signature</span>
                    <span className="text-xs text-foreground-muted">After Stage 1</span>
                  </li>
                </ol>
              </div>

              {isEligible ? (
                <div className="space-y-2">
                  <Button className="w-full" onClick={handleRequestPayment} isLoading={isRequestingPayment}>
                    <KeyRound />
                    Request payment authorization
                  </Button>
                  {requestError && (
                    <p role="alert" className="text-center text-xs text-danger">
                      {requestError}
                    </p>
                  )}
                  <p className="text-center text-xs text-foreground-muted">Creates an approval request. No funds move.</p>
                </div>
              ) : isFail ? (
                <p className="text-xs leading-relaxed text-foreground-secondary">
                  The seller must re-issue and re-sign corrected terms before this obligation can be paid.
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-foreground-secondary">
                  Authorization opens once a delivery is submitted and passes verification.
                </p>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Signed terms" icon={<FileText />} />
            <PanelBody>
              <DataList dense>
                <DataRow label="Service">
                  <span className="font-mono text-xs">{invoice.service.type}</span>
                </DataRow>
                <DataRow label="Acceptance policy">
                  <span className="font-mono text-xs">{invoice.service.acceptance_policy}</span>
                </DataRow>
                <DataRow label="Subject address">
                  <CopyableValue
                    value={invoice.service.parameters.address}
                    displayText={formatAddress(invoice.service.parameters.address)}
                    label="Copy subject address"
                  />
                </DataRow>
                <DataRow label="Block range">
                  <span className="font-mono text-xs tabular-nums">
                    {invoice.service.parameters.start_block}–{invoice.service.parameters.end_block}
                  </span>
                </DataRow>
                <DataRow label="Issued">{formatTimestamp(invoice.issuedAt)}</DataRow>
                <DataRow label="Deadline">{formatTimestamp(invoice.expiresAt)}</DataRow>
              </DataList>
            </PanelBody>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function InspectorSkeleton({ invoiceId }: { invoiceId: string }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label={`Loading verification record ${invoiceId}`}>
      <div className="space-y-3 pb-2">
        <div className="h-3 w-24 rounded bg-surface-3" />
        <div className="h-7 w-72 max-w-full rounded bg-surface-3" />
      </div>
      <div className="panel h-48" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="panel h-96 xl:col-span-8" />
        <div className="panel h-96 xl:col-span-4" />
      </div>
    </div>
  );
}

export default function TrustInspectorPage() {
  const { mode } = useApp();
  const params = useParams();
  const invoiceId = params?.id as string;
  return mode === "connected" ? <LiveTrustInspector id={invoiceId} /> : <DemoTrustInspectorPage />;
}
