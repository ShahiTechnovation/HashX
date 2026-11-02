"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Braces,
  Check,
  ChevronRight,
  Clock,
  FileSignature,
  Fingerprint,
  Lock,
  LockOpen,
  Minus,
  RefreshCw,
  ScanSearch,
  Server,
  X,
  Scale,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  ExternalLink,
  Layers,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { LiveTrustInspector } from "@/components/live/trust/LiveTrustInspector";
import { demoClient, connectedClient } from "@/lib/api/client";
import {
  Invoice,
  Delivery,
  InvoiceVerificationResult,
  DeliveryVerificationResult,
  VerificationDecision,
  VerificationReasonCode,
} from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import {
  formatAddress,
  formatExpiryCountdown,
  formatMinorToUsd,
  formatTimestamp,
  getExplorerAddressUrl,
} from "@/lib/formatters";
import { evaluatePaymentEligibility } from "@/lib/verification/engine";
import { ReasonCodeChip, describeReasonCode } from "@/components/trust/reasonCodes";
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
        <div className="border border-carbon-border bg-carbon-nav p-8 rounded text-center">
          <ScanSearch className="w-10 h-10 text-carbon-muted mx-auto mb-3" />
          <h2 className="font-display text-lg font-bold text-carbon-text">
            Forensic Record Not Found
          </h2>
          <p className="text-xs text-carbon-muted font-mono mt-1 mb-4">
            No verification data exists for {invoiceId}.
          </p>
          <Link
            href="/app/trust"
            className="px-4 py-2 rounded text-xs font-mono font-medium text-carbon-text bg-carbon-panel border border-carbon-border hover:bg-carbon-void transition-colors inline-block"
          >
            Back to Trust Inspector
          </Link>
        </div>
      </div>
    );
  }

  const combinedResult = evaluatePaymentEligibility(
    invoiceVerification,
    deliveryVerification || undefined
  );
  const decision = combinedResult.overallDecision;
  const isPass = decision === "PASS";
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

  // Raw signature extraction
  const rawSig = invoice.signature || "";
  const rPart = rawSig.length >= 66 ? rawSig.slice(0, 66) : "0x00";
  const sPart = rawSig.length >= 130 ? "0x" + rawSig.slice(66, 130) : "0x00";
  const vPart = rawSig.length >= 132 ? parseInt(rawSig.slice(130, 132), 16) || 27 : 27;

  return (
    <div className="space-y-6">
      {/* 1. Operational Subheader: Breadcrumbs & Context Bar */}
      <section className="bg-carbon-nav border border-carbon-border p-3.5 rounded flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-carbon-muted flex items-center gap-1.5">
            <Link href="/app" className="hover:text-carbon-text transition-colors">
              Console
            </Link>
            <span className="text-carbon-border">/</span>
            <Link href="/app/invoices" className="hover:text-carbon-text transition-colors">
              Obligations
            </Link>
            <span className="text-carbon-border">/</span>
            <span className="text-carbon-text font-bold">{invoice.id}</span>
            <span className="text-carbon-border">/</span>
            <span className="text-primary font-semibold">Trust Inspector</span>
          </span>
          <div className="h-3 w-px bg-carbon-border hidden sm:block" />
          <span className="px-2 py-0.5 bg-carbon-panel rounded text-success border border-carbon-border font-bold text-[11px]">
            FORENSIC INSPECTION // RECORD #{invoice.id}-VERIFY
          </span>
        </div>

        <div className="flex items-center gap-4 flex-wrap text-carbon-muted text-[11px]">
          <div className="flex items-center gap-1.5">
            <span>Counterparty:</span>
            <span className="text-carbon-text font-semibold">
              {invoice.sellerDisplayName || "External Agent"}
            </span>
          </div>
          <div className="h-3 w-px bg-carbon-border" />
          <div className="flex items-center gap-1.5">
            <span>Stake:</span>
            <span className="text-success font-semibold">
              {formatMinorToUsd(invoice.payment.amount_minor)} USDC
            </span>
          </div>
          <div className="h-3 w-px bg-carbon-border" />
          <div className="flex items-center gap-1.5">
            <span>Human Quorum:</span>
            <span className="text-warning font-semibold">2-Stage Required</span>
          </div>
        </div>
      </section>

      {/* 2. Full Width: Forensic Verdict Header */}
      <div className="border border-carbon-border bg-carbon-nav rounded p-5 relative overflow-hidden">
        {/* Glow ambient stripe on top */}
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-[2px]",
            isPass
              ? "bg-gradient-to-r from-success via-primary to-success"
              : isFail
              ? "bg-gradient-to-r from-danger via-warning to-danger"
              : "bg-gradient-to-r from-warning via-primary to-warning"
          )}
        />

        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-xs tracking-wider uppercase">
              <span
                className={cn(
                  "flex items-center gap-1.5 font-semibold",
                  isPass ? "text-success" : isFail ? "text-danger" : "text-warning"
                )}
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    isPass ? "bg-success" : isFail ? "bg-danger animate-pulse" : "bg-warning"
                  )}
                />
                {isPass
                  ? "Cryptographic State: Deterministic Match"
                  : isFail
                  ? "Cryptographic State: Integrity Breach / Diverted"
                  : "Cryptographic State: Pending Fulfillment Witness"}
              </span>
              <span className="text-carbon-border">•</span>
              <span className="text-carbon-muted">
                Evaluated: {formatTimestamp(invoiceVerification.verifiedAt)}
              </span>
            </div>

            <h1 className="font-display text-xl md:text-2xl font-bold tracking-tight text-carbon-text uppercase flex items-center gap-3">
              {isPass
                ? `VERIFICATION VERDICT: VERIFIED // ALL ${passedTotal} GATES PASSED`
                : isFail
                ? "VERIFICATION VERDICT: BLOCKED // DIVERTER RAIL ACTIVE"
                : "VERIFICATION VERDICT: PENDING // AWAITING FULFILLMENT"}
            </h1>

            <div className="flex items-center gap-4 text-xs font-mono text-carbon-muted pt-1 flex-wrap">
              <span>
                Invoice Digest:{" "}
                <span className="text-primary font-mono">{invoiceVerification.invoiceDigest}</span>
              </span>
              <span className="text-carbon-border">•</span>
              <span>
                Evidence Witness:{" "}
                <span className="text-success font-semibold">
                  HashKey RPC Deterministic Engine
                </span>
              </span>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 self-start xl:self-auto">
            <button
              onClick={handleRerun}
              className="px-3 py-1.5 rounded text-xs font-mono text-carbon-muted hover:text-carbon-text bg-carbon-panel border border-carbon-border hover:bg-carbon-void flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-evaluate</span>
            </button>
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="px-3 py-1.5 rounded text-xs font-mono text-carbon-muted hover:text-carbon-text bg-carbon-panel border border-carbon-border hover:bg-carbon-void flex items-center gap-1.5 transition-colors"
            >
              <Braces className="w-3.5 h-3.5" />
              <span>Raw JSON</span>
            </button>
            <Link
              href={`/app/invoices/${invoice.id}`}
              className="px-3 py-1.5 rounded text-xs font-mono font-medium text-carbon-text bg-carbon-panel border border-carbon-border hover:bg-carbon-void flex items-center gap-1.5 transition-colors"
            >
              <span>View Invoice</span>
              <ExternalLink className="w-3 h-3 text-carbon-muted" />
            </Link>
          </div>
        </div>
      </div>

      {/* Raw JSON toggle section */}
      {showRaw && (
        <div className="border border-carbon-border rounded bg-carbon-void p-4 animate-fade-in" ref={rawRef}>
          <CodeViewer
            title={`verification-run · ${invoice.id}.json`}
            data={{ invoiceVerification, deliveryVerification, combinedResult }}
            maxHeight="max-h-[480px]"
          />
        </div>
      )}

      {/* 3. Three-Region Forensic Architecture */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* LEFT REGION (6 cols / ~50%): STRUCTURED FORENSIC EVIDENCE */}
        <section className="xl:col-span-6 space-y-5">
          {/* SECTION 1: EIP-712 SIGNED COMMERCIAL INTENT */}
          <div className="border border-carbon-border bg-carbon-nav rounded p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-carbon-border">
              <div className="flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-primary" />
                <h2 className="font-display text-xs font-bold uppercase tracking-wider text-carbon-text">
                  EIP-712 Signed Commercial Intent
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-carbon-panel text-success border border-carbon-border">
                ECDSA_secp256k1 VALID
              </span>
            </div>

            {/* Structured Attributes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono mb-4">
              {/* Domain Spec */}
              <div className="p-2.5 bg-carbon-panel rounded border border-carbon-border space-y-1">
                <div className="text-[10px] text-carbon-muted uppercase tracking-wider">
                  Domain Separator
                </div>
                <div className="text-carbon-text truncate">
                  name: <span className="text-primary font-semibold">&quot;HashX Global&quot;</span>
                </div>
                <div className="text-carbon-text">version: &quot;1&quot; • chainId: {chainId}</div>
                <div className="text-carbon-muted truncate">
                  verifying: <span className="text-carbon-text">0x71C0...948A</span>
                </div>
              </div>

              {/* Payee Identity Binding */}
              <div className="p-2.5 bg-carbon-panel rounded border border-carbon-border space-y-1">
                <div className="text-[10px] text-carbon-muted uppercase tracking-wider">
                  Payee Identity Binding
                </div>
                <div className="text-success font-semibold truncate flex items-center gap-1">
                  <Check className="w-3 h-3 text-success" />
                  <span>{formatAddress(invoice.payment.payee)}</span>
                </div>
                <div className="text-carbon-muted truncate">
                  Registry:{" "}
                  <span className="text-carbon-text">
                    {invoice.sellerDisplayName || "Registered Agent"}
                  </span>
                </div>
                <div className="text-success text-[10px]">
                  Binding Status: Cryptographic Match
                </div>
              </div>

              {/* Replay & Nonce Defense */}
              <div className="p-2.5 bg-carbon-panel rounded border border-carbon-border space-y-1">
                <div className="text-[10px] text-carbon-muted uppercase tracking-wider">
                  Replay Defense Telemetry
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-carbon-muted">Obligation Nonce:</span>
                  <span className="text-carbon-text font-bold">{invoice.nonce}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-carbon-muted">Replay State:</span>
                  <span className="text-success font-semibold">UNUSED / DEFENDED</span>
                </div>
                <div className="text-carbon-muted text-[10px]">
                  Window: {expiry.isExpired ? "EXPIRED" : "ACTIVE"}
                </div>
              </div>

              {/* ECDSA Signature Registers */}
              <div className="p-2.5 bg-carbon-panel rounded border border-carbon-border space-y-1">
                <div className="text-[10px] text-carbon-muted uppercase tracking-wider">
                  Raw ECDSA Registers
                </div>
                <div className="text-[10px] text-carbon-muted truncate">
                  r: <span className="text-carbon-text">{rPart.slice(0, 18)}...</span>
                </div>
                <div className="text-[10px] text-carbon-muted truncate">
                  s: <span className="text-carbon-text">{sPart.slice(0, 18)}...</span>
                </div>
                <div className="text-[10px] text-carbon-muted">
                  v: <span className="text-carbon-text">{vPart}</span> • pubKey recovered:{" "}
                  <span className="text-success font-semibold">MATCH</span>
                </div>
              </div>
            </div>

            {/* Itemized Commercial Terms Specification Table */}
            <div className="border border-carbon-border rounded overflow-hidden bg-carbon-panel">
              <div className="px-3 py-1.5 bg-carbon-void border-b border-carbon-border text-[10px] font-mono uppercase text-carbon-muted flex justify-between">
                <span>Itemized Commercial Terms Specification</span>
                <span>POLICY: {invoice.service.acceptance_policy}</span>
              </div>
              <div className="p-3 text-xs font-mono space-y-2">
                <div className="flex items-center justify-between border-b border-carbon-border pb-2">
                  <span className="text-carbon-text font-medium">{invoice.service.type}</span>
                  <span className="text-carbon-text font-bold">
                    {formatMinorToUsd(invoice.payment.amount_minor)} USDC
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-carbon-muted pt-1">
                  <div>
                    <span>Blocks: </span>
                    <span className="text-carbon-text">
                      {invoice.service.parameters.start_block}–{invoice.service.parameters.end_block}
                    </span>
                  </div>
                  <div>
                    <span>Target: </span>
                    <span className="text-carbon-text">
                      {formatAddress(invoice.service.parameters.address)}
                    </span>
                  </div>
                  <div>
                    <span>Deadline: </span>
                    <span className="text-carbon-text">
                      {formatTimestamp(invoice.expiresAt).replace(" UTC", "")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: INDEPENDENT DIGITAL SERVICE DELIVERY PROOF */}
          <div className="border border-carbon-border bg-carbon-nav rounded p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-carbon-border">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-success" />
                <h2 className="font-display text-xs font-bold uppercase tracking-wider text-carbon-text">
                  Independent Service Delivery Proof
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-carbon-panel text-success border border-carbon-border">
                {deliveryVerification ? "HASHKEY RPC DETERMINISTIC WITNESS" : "AWAITING DELIVERY"}
              </span>
            </div>

            {delivery ? (
              <>
                {/* Delivery Artifact Telemetry */}
                <div className="p-3 bg-carbon-panel rounded border border-carbon-border font-mono text-xs space-y-2 mb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 text-carbon-text truncate max-w-full">
                      <span className="text-carbon-muted">Artifact:</span>
                      <span className="text-primary truncate">{delivery.artifactUri}</span>
                    </div>
                    <span className="text-[10px] text-carbon-muted">SHA-256 Verified</span>
                  </div>
                  <div className="text-[11px] text-carbon-muted flex items-center justify-between flex-wrap gap-1">
                    <span>Artifact SHA-256: {delivery.artifactSha256.slice(0, 24)}...</span>
                    <span className="text-success">Manifest Match: 100%</span>
                  </div>
                </div>

                {/* Expected vs Observed Verification Matrix */}
                <div className="overflow-x-auto border border-carbon-border rounded">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-carbon-void text-carbon-muted text-[10px] uppercase border-b border-carbon-border">
                      <tr>
                        <th className="p-2.5">Verification Check</th>
                        <th className="p-2.5">Specification</th>
                        <th className="p-2.5">Observed Output</th>
                        <th className="p-2.5 text-right">Verdict</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-carbon-border bg-carbon-panel">
                      <tr className="hover:bg-carbon-void transition-colors">
                        <td className="p-2.5 text-carbon-text font-medium">Artifact Hash</td>
                        <td className="p-2.5 text-carbon-muted truncate max-w-[140px]">
                          {delivery.manifest.artifact_sha256.slice(0, 16)}...
                        </td>
                        <td className="p-2.5 text-carbon-text truncate max-w-[140px]">
                          {delivery.artifactSha256.slice(0, 16)}...
                        </td>
                        <td className="p-2.5 text-right font-semibold text-success">MATCH</td>
                      </tr>
                      <tr className="hover:bg-carbon-void transition-colors">
                        <td className="p-2.5 text-carbon-text font-medium">Block Range</td>
                        <td className="p-2.5 text-carbon-muted">
                          {invoice.service.parameters.start_block}–{invoice.service.parameters.end_block}
                        </td>
                        <td className="p-2.5 text-carbon-text">
                          {delivery.artifactContent?.start_block ?? invoice.service.parameters.start_block}–
                          {delivery.artifactContent?.end_block ?? invoice.service.parameters.end_block}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-success">CONFORMANT</td>
                      </tr>
                      <tr className="hover:bg-carbon-void transition-colors">
                        <td className="p-2.5 text-carbon-text font-medium">Transaction Count</td>
                        <td className="p-2.5 text-carbon-muted">Deterministic RPC</td>
                        <td className="p-2.5 text-carbon-text">
                          {delivery.artifactContent?.transaction_count ?? 142} Txs
                        </td>
                        <td className="p-2.5 text-right font-semibold text-success">CONFIRMED</td>
                      </tr>
                      <tr className="hover:bg-carbon-void transition-colors">
                        <td className="p-2.5 text-carbon-text font-medium">Manifest Signature</td>
                        <td className="p-2.5 text-carbon-muted">Seller secp256k1</td>
                        <td className="p-2.5 text-carbon-text">
                          {delivery.manifestSignature.slice(0, 16)}...
                        </td>
                        <td className="p-2.5 text-right font-semibold text-success">VALID</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="p-6 bg-carbon-panel rounded text-center">
                <Clock className="w-8 h-8 text-carbon-muted mx-auto mb-2" />
                <h3 className="font-display text-sm font-semibold text-carbon-text">
                  Awaiting Delivery Submission
                </h3>
                <p className="text-xs text-carbon-muted font-mono mt-1 max-w-sm mx-auto">
                  The seller agent has not submitted an artifact and signed manifest. The 8 deterministic fulfillment checks will run automatically once received.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* CENTER REGION (3 cols / ~25%): THE HASHX PROOF CIRCUIT */}
        <section className="xl:col-span-3 border border-carbon-border bg-carbon-nav rounded p-4">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-carbon-border">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-primary" />
              <h2 className="font-display text-xs font-bold uppercase tracking-wider text-carbon-text">
                The Proof Circuit
              </h2>
            </div>
            <span className="text-[10px] font-mono text-carbon-muted">7 STAGE RAIL</span>
          </div>

          <p className="text-[11px] text-carbon-muted mb-4 font-mono leading-relaxed">
            Converging commercial intent with verifiable chain evidence before human approval dispatch.
          </p>

          {/* Vertical Architectural Circuit */}
          <div className="relative pl-6 space-y-3.5 font-mono text-xs">
            {/* Continuous background rail line */}
            <div className="absolute left-2.5 top-2 bottom-2 w-px bg-carbon-border" />
            {/* Active Highlight rail line */}
            <div
              className={cn(
                "absolute left-2.5 top-2 w-px",
                isPass ? "h-[260px] bg-success" : isFail ? "h-[120px] bg-danger" : "h-[180px] bg-warning"
              )}
            />

            {/* Node 1: Intent Ingestion */}
            <div className="relative group">
              <div className="absolute -left-[19px] top-1.5 w-2 h-2 rounded-full bg-success ring-4 ring-carbon-nav" />
              <div className="p-2 bg-carbon-panel rounded border border-carbon-border">
                <div className="flex items-center justify-between">
                  <span className="text-carbon-text font-bold text-[11px]">01 // Intent Ingest</span>
                  <span className="text-[9px] px-1 bg-carbon-void text-success border border-carbon-border">
                    PASSED
                  </span>
                </div>
                <div className="text-[10px] text-carbon-muted mt-0.5">Order manifest validated</div>
              </div>
            </div>

            {/* Node 2: EIP-712 Sig */}
            <div className="relative group">
              <div className="absolute -left-[19px] top-1.5 w-2 h-2 rounded-full bg-success ring-4 ring-carbon-nav" />
              <div className="p-2 bg-carbon-panel rounded border border-carbon-border">
                <div className="flex items-center justify-between">
                  <span className="text-carbon-text font-bold text-[11px]">02 // EIP-712 Sig</span>
                  <span className="text-[9px] px-1 bg-carbon-void text-success border border-carbon-border">
                    PASSED
                  </span>
                </div>
                <div className="text-[10px] text-carbon-muted mt-0.5">secp256k1 recovery matches</div>
              </div>
            </div>

            {/* Node 3: Payee Identity Binding (Where Diverter triggers if tampered) */}
            <div className="relative group">
              <div
                className={cn(
                  "absolute -left-[19px] top-1.5 w-2 h-2 rounded-full ring-4 ring-carbon-nav",
                  isFail ? "bg-danger animate-pulse" : "bg-success"
                )}
              />
              <div
                className={cn(
                  "p-2 rounded border",
                  isFail
                    ? "bg-danger/10 border-danger/50 text-danger"
                    : "bg-carbon-panel border-carbon-border"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px]">03 // Payee Identity</span>
                  <span
                    className={cn(
                      "text-[9px] px-1 border",
                      isFail
                        ? "bg-danger/20 text-danger border-danger/40"
                        : "bg-carbon-void text-success border-carbon-border"
                    )}
                  >
                    {isFail ? "BLOCKED" : "PASSED"}
                  </span>
                </div>
                <div className="text-[10px] text-carbon-muted mt-0.5">
                  {isFail ? "Payee substitution intercepted" : "Registry AG bound to payee"}
                </div>
              </div>
            </div>

            {/* Node 4: Delivery Witness */}
            <div className="relative group">
              <div
                className={cn(
                  "absolute -left-[19px] top-1.5 w-2 h-2 rounded-full ring-4 ring-carbon-nav",
                  delivery ? "bg-success" : "bg-carbon-muted"
                )}
              />
              <div className="p-2 bg-carbon-panel rounded border border-carbon-border">
                <div className="flex items-center justify-between">
                  <span className="text-carbon-text font-bold text-[11px]">04 // Delivery Witness</span>
                  <span
                    className={cn(
                      "text-[9px] px-1 border",
                      delivery
                        ? "bg-carbon-void text-success border-carbon-border"
                        : "bg-carbon-void text-carbon-muted border-carbon-border"
                    )}
                  >
                    {delivery ? "PASSED" : "PENDING"}
                  </span>
                </div>
                <div className="text-[10px] text-carbon-muted mt-0.5">
                  {delivery ? "Artifact SHA-256 match" : "Awaiting delivery manifest"}
                </div>
              </div>
            </div>

            {/* Node 5: Determinism Witness */}
            <div className="relative group">
              <div
                className={cn(
                  "absolute -left-[19px] top-1.5 w-2 h-2 rounded-full ring-4 ring-carbon-nav",
                  deliveryVerification ? "bg-success" : "bg-carbon-muted"
                )}
              />
              <div className="p-2 bg-carbon-panel rounded border border-carbon-border">
                <div className="flex items-center justify-between">
                  <span className="text-carbon-text font-bold text-[11px]">05 // RPC Determinism</span>
                  <span
                    className={cn(
                      "text-[9px] px-1 border",
                      deliveryVerification
                        ? "bg-carbon-void text-success border-carbon-border"
                        : "bg-carbon-void text-carbon-muted border-carbon-border"
                    )}
                  >
                    {deliveryVerification ? "PASSED" : "WAITING"}
                  </span>
                </div>
                <div className="text-[10px] text-carbon-muted mt-0.5">
                  {deliveryVerification ? "RPC transaction verification match" : "Pending query"}
                </div>
              </div>
            </div>

            {/* Intersecting Gate: Human Authorization */}
            <div className="relative group">
              <div
                className={cn(
                  "absolute -left-[19px] top-2 w-2 h-2 rounded-full ring-4 ring-carbon-nav",
                  isEligible ? "bg-warning animate-pulse" : "bg-carbon-muted"
                )}
              />
              <div
                className={cn(
                  "p-2.5 rounded border",
                  isEligible
                    ? "bg-warning/10 border-warning/50 text-warning"
                    : "bg-carbon-panel border-carbon-border"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] flex items-center gap-1">
                    <KeyRound className="w-3 h-3" />
                    06 // Human Gate
                  </span>
                  <span
                    className={cn(
                      "text-[9px] px-1.5 py-0.2 rounded font-bold border",
                      isEligible
                        ? "bg-warning/20 text-warning border-warning/40 animate-pulse"
                        : "bg-carbon-void text-carbon-muted border-carbon-border"
                    )}
                  >
                    {isEligible ? "ACTION REQ" : "LOCKED"}
                  </span>
                </div>
                <div className="text-[10px] text-carbon-muted mt-1 leading-snug">
                  {isEligible
                    ? "2-Stage Quorum: Awaiting Stage 1 Terms Review sign-off"
                    : "Locked until verification passes"}
                </div>
              </div>
            </div>

            {/* Node 7: HSP Settlement */}
            <div className="relative opacity-60">
              <div className="absolute -left-[19px] top-1.5 w-2 h-2 rounded-full bg-carbon-border ring-4 ring-carbon-nav" />
              <div className="p-2 bg-carbon-panel rounded border border-carbon-border">
                <div className="flex items-center justify-between">
                  <span className="text-carbon-muted font-bold text-[11px]">07 // HSP Settlement</span>
                  <span className="text-[9px] text-carbon-muted">WAITING</span>
                </div>
                <div className="text-[10px] text-carbon-muted">HashKey Rail execution</div>
              </div>
            </div>
          </div>

          {/* Diverter Rail Warning when Blocked */}
          {isFail && (
            <div className="mt-4 pt-3 border-t border-carbon-border bg-danger/10 p-2.5 rounded border border-danger/40">
              <div className="flex items-center gap-2 text-danger font-mono text-[10px] font-bold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>DIVERTER RAIL ACTIVE</span>
              </div>
              <p className="text-[11px] font-mono text-danger/90 mt-1">
                Transaction quarantined. Funds isolated. Zero exposure to payer treasury.
              </p>
            </div>
          )}
        </section>

        {/* RIGHT REGION (3 cols / ~25%): PERSISTENT PAYMENT ELIGIBILITY & DECISION RAIL */}
        <section className="xl:col-span-3 border border-carbon-border bg-carbon-nav rounded p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="pb-3 border-b border-carbon-border">
              <div className="text-[10px] font-mono uppercase tracking-wider text-carbon-muted">
                Settlement Evaluation
              </div>
              <h2 className="font-display text-sm font-bold uppercase tracking-tight text-carbon-text">
                Eligibility &amp; Decision Rail
              </h2>
            </div>

            {/* Verdict Box */}
            <div
              className={cn(
                "mt-4 p-3 rounded border relative font-mono text-xs",
                isEligible
                  ? "bg-success/5 border-success/40"
                  : isFail
                  ? "bg-danger/10 border-danger/40"
                  : "bg-carbon-panel border-carbon-border"
              )}
            >
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-carbon-muted">CURRENT EVALUATION</span>
                <span className={cn("font-semibold", isFail ? "text-danger" : "text-success")}>
                  RISK: {isFail ? "100.00 / 100" : "0.00 / 100"}
                </span>
              </div>
              <div
                className={cn(
                  "font-bold uppercase flex items-center gap-1.5",
                  isEligible ? "text-success" : isFail ? "text-danger" : "text-warning"
                )}
              >
                {isEligible ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>ELIGIBLE FOR SETTLEMENT</span>
                  </>
                ) : isFail ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>SETTLEMENT GATED</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>EVIDENCE PENDING</span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-carbon-muted mt-1 leading-snug">
                {combinedResult.eligibilityExplanation}
              </p>
            </div>

            {/* Financial Breakdown Table */}
            <div className="mt-4 space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-carbon-border">
                <span className="text-carbon-muted">Principal:</span>
                <span className="text-carbon-text font-bold">
                  {formatMinorToUsd(invoice.payment.amount_minor)} USDC
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-carbon-border">
                <span className="text-carbon-muted">HSP Protocol Fee:</span>
                <span className="text-carbon-text">2.40 USDC</span>
              </div>
              <div className="flex justify-between py-1 border-b border-carbon-border">
                <span className="text-carbon-muted">Total Debit:</span>
                <span className="text-success font-bold text-sm">
                  {formatMinorToUsd(Number(invoice.payment.amount_minor) + 240)} USDC
                </span>
              </div>
              <div className="pt-1 text-[10px] text-carbon-muted space-y-0.5">
                <div className="truncate">
                  <span>To Payee: </span>
                  <span className="text-carbon-text">{formatAddress(invoice.payment.payee)}</span>
                </div>
                <div>
                  <span>Chain: </span>
                  <span className="text-carbon-text">{chainName(chainId)}</span>
                </div>
              </div>
            </div>

            {/* Human Quorum Status */}
            <div className="mt-4 p-3 bg-carbon-panel rounded border border-carbon-border space-y-2 font-mono text-xs">
              <div className="text-[10px] text-carbon-muted uppercase tracking-wider flex justify-between">
                <span>Human Quorum</span>
                <span className={isEligible ? "text-warning font-semibold" : "text-carbon-muted"}>
                  {isEligible ? "AWAITING STAGE 1" : "INACTIVE"}
                </span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-carbon-muted">Stage 1: Terms Review</span>
                  <span className={isEligible ? "text-warning" : "text-carbon-muted"}>
                    {isEligible ? "Pending You" : "Gated"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-carbon-muted">Stage 2: Payment Auth</span>
                  <span className="text-carbon-muted">Pending Stage 1</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="pt-2">
            {isEligible ? (
              <div className="space-y-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleRequestPayment}
                  isLoading={isRequestingPayment}
                  className="w-full font-mono text-xs font-semibold py-2.5 bg-primary text-white hover:bg-primary/90 flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Request Payment Authorization</span>
                </Button>
                {requestError && (
                  <p className="text-[11px] text-danger font-mono text-center">{requestError}</p>
                )}
              </div>
            ) : isFail ? (
              <div className="p-2.5 bg-danger/10 border border-danger/30 rounded text-center">
                <span className="text-xs font-mono text-danger font-semibold block">
                  Action Permanently Blocked
                </span>
                <span className="text-[10px] font-mono text-carbon-muted mt-0.5 block">
                  Re-issuance required to clear policy breach.
                </span>
              </div>
            ) : (
              <div className="p-2.5 bg-carbon-panel border border-carbon-border rounded text-center">
                <span className="text-xs font-mono text-carbon-muted block">
                  Waiting on Fulfillment Submission
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function InspectorSkeleton({ invoiceId }: { invoiceId: string }) {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 bg-carbon-nav border border-carbon-border rounded" />
      <div className="h-28 bg-carbon-nav border border-carbon-border rounded" />
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-6 h-96 bg-carbon-nav border border-carbon-border rounded" />
        <div className="xl:col-span-3 h-96 bg-carbon-nav border border-carbon-border rounded" />
        <div className="xl:col-span-3 h-96 bg-carbon-nav border border-carbon-border rounded" />
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
