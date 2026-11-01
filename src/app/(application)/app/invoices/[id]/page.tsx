"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Coins,
  Upload,
  Lock,
  ArrowRight,
  ArrowUpRight,
  Check,
  X,
  CircleDashed,
  Clock,
  Stamp,
  ReceiptText,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import { Invoice, Delivery, PaymentAttempt, InvoiceStatus } from "@/types/domain";
import { Button, buttonStyles } from "@/components/ui/Button";
import { StatusBadge, toneStyles, type Tone } from "@/components/ui/StatusBadge";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, MetaItem } from "@/components/ui/PageHeader";
import { Panel, PanelHeader, PanelBody, PanelFooter } from "@/components/ui/Panel";
import { DataList, DataRow } from "@/components/ui/DataList";
import { Timeline, type TimelineItem } from "@/components/ui/Timeline";
import { FinalityTrack } from "@/components/ui/FinalityTrack";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import {
  formatAddress,
  formatHash,
  formatMinorToUsd,
  formatTimestamp,
  getExplorerAddressUrl,
} from "@/lib/formatters";
import { BLOCKED_STATUSES, blockSpan, chainLabel, formatShortUtc, sameAddress } from "@/components/invoices/utils";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, mode]);

  if (isLoading) {
    return <DetailSkeleton invoiceId={invoiceId} />;
  }

  if (!invoice) {
    return (
      <div className="space-y-6">
        <PageHeader back={{ href: "/app/invoices", label: "Invoices" }} eyebrow="Invoice" title={<span className="font-mono text-xl">{invoiceId}</span>} className="pb-0" />
        <Panel>
          <EmptyState
            icon={<AlertTriangle className="w-[18px] h-[18px]" />}
            title="Invoice not found"
            description={`No commercial agreement with ID ${invoiceId} exists in ${mode === "connected" ? "the connected backend" : "the demo ledger"}.`}
            action={
              <Link href="/app/invoices" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                Back to invoices
              </Link>
            }
          />
        </Panel>
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
        merchant_name: "HashX",
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

  // ---------------------------------------------------------------------------
  // Derived presentation state
  // ---------------------------------------------------------------------------
  const isBlocked = BLOCKED_STATUSES.includes(invoice.status);
  const isSettled = invoice.status === "SETTLED";
  const activeAttempt = paymentAttempt && paymentAttempt.state !== "FAILED" ? paymentAttempt : null;
  const awaitingApproval =
    !!activeAttempt &&
    (activeAttempt.state === "AWAITING_SIGNATURE_APPROVAL" || activeAttempt.state === "AWAITING_SUBMISSION_APPROVAL");
  const isExpired = new Date(invoice.expiresAt).getTime() < Date.now();
  const span = blockSpan(invoice.service.parameters.start_block, invoice.service.parameters.end_block);
  const openDeliveryModal = () => setDeliveryModalOpen(true);

  const invoiceCheck: "PASS" | "FAIL" | "SKIPPED" =
    invoice.status === "REJECTED" ? "FAIL" : invoice.status === "DRAFT" ? "SKIPPED" : "PASS";
  const deliveryCheck: "PASS" | "FAIL" | "SKIPPED" =
    delivery?.status === "ACCEPTED" ? "PASS" : delivery?.status === "REJECTED" ? "FAIL" : "SKIPPED";

  // Next valid action — exactly one primary.
  type ActionDef = {
    key: string;
    label: string;
    icon: LucideIcon;
    href?: string;
    onClick?: () => void;
    loading?: boolean;
  };
  const trustAction: ActionDef = { key: "trust", label: "Open Trust Inspector", icon: ShieldCheck, href: `/app/trust/${invoice.id}` };
  const requestAction: ActionDef = {
    key: "request",
    label: "Request payment via HSP",
    icon: Coins,
    onClick: handleRequestPayment,
    loading: isRequestingPayment,
  };
  const deliverAction: ActionDef = {
    key: "deliver",
    label: mode === "demo" ? "Simulate delivery" : "Submit deliverable",
    icon: Upload,
    onClick: openDeliveryModal,
  };
  const settlementAction: ActionDef | null = paymentAttempt
    ? { key: "settlement", label: "View settlement", icon: ArrowUpRight, href: `/app/settlements/${paymentAttempt.id}` }
    : null;

  let next: { title: string; description: string; action: ActionDef };
  if (isBlocked) {
    next = {
      title: "Inspect failed verification",
      description: "Payment is gated. Review reason codes and recomputed evidence before any remediation.",
      action: { ...trustAction, label: "Inspect evidence", icon: ShieldAlert },
    };
  } else if (isSettled) {
    next = {
      title: "Obligation settled",
      description: "HSP payment finalized on HashKey Chain. The verifiable receipt anchors the full evidence chain.",
      action: settlementAction ?? { key: "receipts", label: "View receipts", icon: ReceiptText, href: "/app/receipts" },
    };
  } else if (activeAttempt && awaitingApproval) {
    next = {
      title: activeAttempt.state === "AWAITING_SIGNATURE_APPROVAL" ? "Approve signing" : "Approve submission",
      description: "A payment attempt is waiting on human authorization before it can proceed on the HSP rail.",
      action: { key: "approval", label: "Review approval", icon: Stamp, href: `/app/approvals/${activeAttempt.id}` },
    };
  } else if (activeAttempt && settlementAction) {
    next = {
      title: "Track settlement",
      description: "Payment is on the HSP rail. Safe is not final — wait for finalized status before release.",
      action: settlementAction,
    };
  } else if (isEligibleForPayment) {
    next = {
      title: "Request payment",
      description: "Invoice authenticated and fulfillment verified. Open an HSP payment attempt for two-stage human approval.",
      action: requestAction,
    };
  } else if (!delivery) {
    next = {
      title: "Awaiting delivery",
      description: "The seller must submit the analytics artifact and a signed manifest before payment can be considered.",
      action: deliverAction,
    };
  } else {
    next = {
      title: "Verification in progress",
      description: "Delivery received. Deterministic checks must pass before payment unlocks.",
      action: trustAction,
    };
  }

  const secondaryActions = [
    trustAction,
    !delivery && !isSettled ? deliverAction : null,
    isEligibleForPayment && !isSettled && !activeAttempt ? requestAction : null,
    settlementAction,
  ].filter((a): a is ActionDef => !!a && a.key !== next.action.key && !(next.action.href && a.href === next.action.href));

  // Eligibility band
  const band: { tone: Tone; Icon: LucideIcon; title: string; consequence: string } = isBlocked
    ? {
        tone: "danger",
        Icon: ShieldAlert,
        title: "Payment gated",
        consequence:
          invoice.status === "REJECTED"
            ? "Invoice authentication failed. Funds cannot be requested against these terms."
            : "Delivered evidence failed deterministic checks. Funds cannot be requested.",
      }
    : isSettled
    ? { tone: "success", Icon: Check, title: "Settled", consequence: "Payment finalized and reconciled on HashKey Chain." }
    : isEligibleForPayment
    ? {
        tone: "success",
        Icon: ShieldCheck,
        title: "Eligible for payment",
        consequence: "Terms authenticated and fulfillment verified. Payment still requires human approval.",
      }
    : {
        tone: "warning",
        Icon: Clock,
        title: "Payment gated",
        consequence: !delivery
          ? "Awaiting seller delivery. Funds unlock only after objective fulfillment is verified."
          : "Delivery pending verification. Funds unlock only after all checks pass.",
      };

  const timeline = buildTimeline(invoice, delivery, paymentAttempt);

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/app/invoices", label: "Invoices" }}
        eyebrow="Invoice"
        title={<span className="font-mono text-xl sm:text-[22px] tracking-[-0.02em]">{invoice.id}</span>}
        badges={
          <>
            <StatusBadge status={invoice.status} type="invoice" />
            {isExpired && !isSettled && (
              <span className="inline-flex items-center gap-1 h-6 px-2 rounded-[5px] text-xs font-medium ring-1 ring-inset bg-warning/10 text-warning ring-warning/20">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                Expired
              </span>
            )}
          </>
        }
        meta={
          <>
            <MetaItem label="Seller">{invoice.sellerDisplayName || formatAddress(invoice.sellerWallet)}</MetaItem>
            <MetaItem label="Amount">
              <span className="tabular-nums">{formatMinorToUsd(invoice.payment.amount_minor)} {invoice.payment.currency}</span>
            </MetaItem>
            <MetaItem label="Issued">
              <span className="tabular-nums">{formatTimestamp(invoice.issuedAt)}</span>
            </MetaItem>
          </>
        }
        actions={
          <Link href={`/app/trust/${invoice.id}`} className={buttonStyles({ variant: "secondary", size: "md" })}>
            <ShieldCheck className="w-3.5 h-3.5" />
            Trust Inspector
          </Link>
        }
        className="pb-0"
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* ── Main record ───────────────────────────────────────────── */}
        <div className="xl:col-span-8 space-y-6 min-w-0">
          {/* Eligibility verdict band + verification summary */}
          <Panel className="relative">
            <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-0.5", toneStyles[band.tone].dot)} />
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 px-4 sm:px-5 py-5">
              <div className="min-w-0">
                <div className="eyebrow">Payment eligibility</div>
                <div className={cn("mt-2 flex items-center gap-2", toneStyles[band.tone].text)}>
                  <band.Icon className="w-5 h-5 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span className="font-display text-[22px] leading-none font-semibold tracking-[-0.025em]">{band.title}</span>
                </div>
                <p className="mt-2 text-[13px] text-foreground-secondary max-w-md leading-relaxed">{band.consequence}</p>
              </div>
              <div className="sm:text-right shrink-0">
                <div className="eyebrow">Invoice amount</div>
                <div className="mt-2 flex items-baseline sm:justify-end gap-1.5">
                  <span className="font-display text-[28px] leading-none font-semibold tracking-[-0.03em] tabular-nums text-foreground">
                    {formatMinorToUsd(invoice.payment.amount_minor)}
                  </span>
                  <span className="text-2xs font-medium text-foreground-muted">{invoice.payment.currency}</span>
                </div>
                <div className="mt-1.5 font-mono text-2xs text-foreground-muted tabular-nums">
                  amount_minor {invoice.payment.amount_minor}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 border-t border-border divide-y sm:divide-y-0 sm:divide-x divide-border/60">
              <CheckCell label="Invoice authenticity" sub="Signature, identity, nonce, expiry">
                <StatusBadge status={invoiceCheck} type="check" size="sm" />
              </CheckCell>
              <CheckCell label="Deterministic delivery" sub="Artifact, manifest, RPC recompute">
                <StatusBadge status={deliveryCheck} type="check" size="sm" />
              </CheckCell>
              <CheckCell label="Payment eligible" sub={isEligibleForPayment ? "Unlocked for HSP request" : "Gated until both pass"}>
                {isEligibleForPayment || isBlocked ? (
                  <StatusBadge status={isEligibleForPayment ? "PASS" : "FAIL"} type="check" size="sm" />
                ) : (
                  <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-[5px] text-2xs font-medium ring-1 ring-inset bg-warning/10 text-warning ring-warning/20">
                    <Lock className="w-3 h-3" aria-hidden="true" />
                    Gated
                  </span>
                )}
              </CheckCell>
            </div>
            <PanelFooter className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-2xs text-foreground-muted">Summary derived from invoice status. Full recomputed evidence lives in the inspector.</span>
              <Link
                href={`/app/trust/${invoice.id}`}
                className="inline-flex items-center gap-1 text-xs text-foreground-secondary hover:text-foreground whitespace-nowrap"
              >
                Full audit <ArrowRight className="w-3 h-3" />
              </Link>
            </PanelFooter>
          </Panel>

          {/* Commercial terms */}
          <Panel>
            <PanelHeader
              title="Commercial terms"
              description="Bound into the EIP-712 HashXInvoice struct. Any mutation invalidates the seller signature."
              actions={
                <span className="inline-flex items-center gap-1.5 text-2xs text-foreground-muted">
                  <Lock className="w-3 h-3" aria-hidden="true" />
                  Immutable · <span className="tabular-nums">v{invoice.version}</span>
                </span>
              }
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-border/60">
              <div className="px-4 sm:px-5 py-4">
                <div className="eyebrow mb-3">Service</div>
                <DataList>
                  <DataRow label="Service type" mono>
                    {invoice.service.type}
                  </DataRow>
                  <DataRow label="Subject address">
                    <CopyableValue
                      value={invoice.service.parameters.address}
                      displayText={formatAddress(invoice.service.parameters.address, 6)}
                      explorerUrl={getExplorerAddressUrl(invoice.service.parameters.address)}
                      label="Copy subject address"
                    />
                  </DataRow>
                  <DataRow label="Block range">
                    <span className="font-mono text-xs tabular-nums text-foreground">
                      {invoice.service.parameters.start_block}
                      <span className="text-foreground-muted px-1.5">→</span>
                      {invoice.service.parameters.end_block}
                    </span>
                    {span !== null && (
                      <span className="block text-2xs text-foreground-muted mt-0.5 tabular-nums">{span.toLocaleString("en-US")} blocks</span>
                    )}
                  </DataRow>
                  <DataRow label="Acceptance policy" mono>
                    {invoice.service.acceptance_policy}
                  </DataRow>
                  <DataRow label="Terms hash">
                    <CopyableValue value={invoice.serviceTermsHash} displayText={formatHash(invoice.serviceTermsHash)} label="Copy service terms hash" />
                  </DataRow>
                </DataList>
              </div>
              <div className="px-4 sm:px-5 py-4 border-t lg:border-t-0 border-border/60">
                <div className="eyebrow mb-3">Payment</div>
                <DataList>
                  <DataRow label="Amount">
                    <span className="tabular-nums">{formatMinorToUsd(invoice.payment.amount_minor)}</span>
                    <span className="block font-mono text-2xs text-foreground-muted mt-0.5 tabular-nums">
                      {invoice.payment.amount_minor} minor units
                    </span>
                  </DataRow>
                  <DataRow label="Currency">{invoice.payment.currency}</DataRow>
                  <DataRow label="Preferred chain">
                    {chainLabel(invoice.payment.preferred_chain_id)}
                    <span className="block font-mono text-2xs text-foreground-muted mt-0.5 tabular-nums">
                      chainId {invoice.payment.preferred_chain_id}
                    </span>
                  </DataRow>
                  <DataRow label="Issued">
                    <span className="tabular-nums">{formatTimestamp(invoice.issuedAt)}</span>
                  </DataRow>
                  <DataRow label="Expires">
                    <span className={cn("tabular-nums", isExpired && "text-warning")}>{formatTimestamp(invoice.expiresAt)}</span>
                    {isExpired && (
                      <span className="mt-0.5 flex items-center gap-1 text-2xs text-warning">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        Validity window elapsed
                      </span>
                    )}
                  </DataRow>
                  <DataRow label="Nonce" mono>
                    <span className="tabular-nums">{invoice.nonce}</span>
                  </DataRow>
                </DataList>
              </div>
            </div>
          </Panel>

          {/* Parties */}
          <Panel>
            <PanelHeader title="Parties" description="Seller identity is bound to a registered counterparty; the buyer is committed by hashed reference." />
            <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-border/60">
              <div className="px-4 sm:px-5 py-4">
                <div className="eyebrow">Seller</div>
                <div className="mt-2 text-sm font-medium text-foreground">{invoice.sellerDisplayName || "Seller agent"}</div>
                <div className="font-mono text-2xs text-foreground-muted mt-0.5">{invoice.sellerId}</div>
                <DataList className="mt-4">
                  <DataRow label="Wallet">
                    <CopyableValue
                      value={invoice.sellerWallet}
                      displayText={formatAddress(invoice.sellerWallet, 6)}
                      explorerUrl={getExplorerAddressUrl(invoice.sellerWallet)}
                      label="Copy seller wallet"
                    />
                  </DataRow>
                  <DataRow label="Payee">
                    <CopyableValue
                      value={invoice.payment.payee}
                      displayText={formatAddress(invoice.payment.payee, 6)}
                      explorerUrl={getExplorerAddressUrl(invoice.payment.payee)}
                      label="Copy payee address"
                    />
                    <MatchLine
                      ok={sameAddress(invoice.payment.payee, invoice.sellerWallet)}
                      okText="Payee is the seller wallet"
                      noText="Payee differs from seller wallet"
                      neutralWhenFalse
                    />
                  </DataRow>
                </DataList>
              </div>
              <div className="px-4 sm:px-5 py-4 border-t md:border-t-0 border-border/60">
                <div className="eyebrow">Buyer</div>
                <div className="mt-2 font-mono text-xs text-foreground break-all">{invoice.buyerRef}</div>
                <div className="text-2xs text-foreground-muted mt-0.5">Buyer reference</div>
                <DataList className="mt-4">
                  <DataRow label="Reference hash">
                    <CopyableValue value={invoice.buyerRefHash} displayText={formatHash(invoice.buyerRefHash)} label="Copy buyer reference hash" />
                  </DataRow>
                  <DataRow label="Payer">
                    {paymentAttempt ? (
                      <CopyableValue
                        value={paymentAttempt.payer}
                        displayText={formatAddress(paymentAttempt.payer, 6)}
                        explorerUrl={getExplorerAddressUrl(paymentAttempt.payer)}
                        label="Copy payer address"
                      />
                    ) : (
                      <span className="text-xs text-foreground-muted">Bound at payment request</span>
                    )}
                  </DataRow>
                </DataList>
              </div>
            </div>
          </Panel>

          {/* Signature */}
          <SignaturePanel invoice={invoice} />

          {/* Delivery evidence */}
          <Panel>
            <PanelHeader
              title="Fulfillment evidence"
              description={`Signed manifest and artifact evaluated under ${invoice.service.acceptance_policy}.`}
              actions={
                delivery ? (
                  <StatusBadge
                    status={delivery.status === "ACCEPTED" ? "DELIVERY_ACCEPTED" : delivery.status === "REJECTED" ? "DELIVERY_REJECTED" : "DELIVERED"}
                    type="invoice"
                    size="sm"
                  />
                ) : (
                  <Button variant="secondary" size="sm" onClick={openDeliveryModal}>
                    <Upload className="w-3.5 h-3.5" />
                    Submit deliverable
                  </Button>
                )
              }
            />
            {delivery ? (
              <>
                <PanelBody>
                  <DataList>
                    <DataRow label="Delivery ID">
                      <CopyableValue value={delivery.id} label="Copy delivery ID" />
                    </DataRow>
                    <DataRow label="Artifact SHA-256">
                      <CopyableValue value={delivery.artifactSha256} displayText={formatHash(delivery.artifactSha256, 10)} label="Copy artifact hash" />
                    </DataRow>
                    <DataRow label="Artifact URI">
                      <CopyableValue value={delivery.artifactUri} label="Copy artifact URI" />
                    </DataRow>
                    <DataRow label="Manifest signature">
                      <CopyableValue value={delivery.manifestSignature} displayText={formatHash(delivery.manifestSignature, 10)} label="Copy manifest signature" />
                    </DataRow>
                    <DataRow label="Manifest signer">
                      <CopyableValue
                        value={delivery.manifest.seller}
                        displayText={formatAddress(delivery.manifest.seller, 6)}
                        explorerUrl={getExplorerAddressUrl(delivery.manifest.seller)}
                        label="Copy manifest signer"
                      />
                      <MatchLine
                        ok={sameAddress(delivery.manifest.seller, invoice.sellerWallet)}
                        okText="Matches invoice seller"
                        noText="Does not match invoice seller"
                      />
                    </DataRow>
                    <DataRow label="Params hash">
                      <CopyableValue
                        value={delivery.manifest.service_parameters_hash}
                        displayText={formatHash(delivery.manifest.service_parameters_hash)}
                        label="Copy service parameters hash"
                      />
                      <MatchLine
                        ok={delivery.manifest.service_parameters_hash === invoice.serviceTermsHash}
                        okText="Matches signed terms hash"
                        noText="Differs from signed terms hash"
                      />
                    </DataRow>
                    <DataRow label="Submitted">
                      <span className="tabular-nums">{formatTimestamp(delivery.submittedAt)}</span>
                    </DataRow>
                  </DataList>
                </PanelBody>
                <div className="px-4 sm:px-5 pb-5">
                  <CodeViewer title={`${delivery.artifactContent.schema} artifact`} data={delivery.artifactContent} maxHeight="max-h-60" />
                </div>
              </>
            ) : (
              <EmptyState
                icon={<Upload className="w-[18px] h-[18px]" />}
                title="Awaiting service delivery"
                description="The seller agent has not yet submitted the analytics artifact and signed manifest."
                actionLabel={mode === "demo" ? "Simulate delivery submission" : "Submit deliverable"}
                onAction={openDeliveryModal}
                className="py-10"
              />
            )}
          </Panel>
        </div>

        {/* ── Right rail ────────────────────────────────────────────── */}
        <div className="xl:col-span-4 space-y-6 min-w-0">
          {/* Action rail */}
          <Panel>
            <PanelHeader title="Next action" compact />
            <div className="px-4 py-4">
              <div className="text-[13px] font-medium text-foreground">{next.title}</div>
              <p className="text-xs text-foreground-muted mt-1 leading-relaxed">{next.description}</p>
              <div className="mt-4">
                <ActionButton action={next.action} variant="primary" />
              </div>
            </div>
            {secondaryActions.length > 0 && (
              <div className="px-4 py-3 border-t border-border flex flex-col gap-2">
                {secondaryActions.map((a) => (
                  <ActionButton key={a.key} action={a} variant="secondary" />
                ))}
              </div>
            )}
          </Panel>

          {/* HSP payment attempt */}
          {paymentAttempt && (
            <Panel>
              <PanelHeader title="HSP payment attempt" compact actions={<StatusBadge status={paymentAttempt.hspStatus} type="hsp" size="sm" />} />
              <div className="px-4 pt-4 pb-3">
                <FinalityTrack status={paymentAttempt.hspStatus} />
              </div>
              <div className="px-4 pb-4">
                <DataList dense>
                  <DataRow label="Authorized">
                    <span className="tabular-nums">{paymentAttempt.approvalSummary.humanAmount}</span>
                  </DataRow>
                  <DataRow label="Flow ID">
                    <CopyableValue value={paymentAttempt.flowId} label="Copy flow ID" />
                  </DataRow>
                  <DataRow label="Request ID">
                    <CopyableValue value={paymentAttempt.paymentRequestId} label="Copy payment request ID" />
                  </DataRow>
                </DataList>
              </div>
              <PanelFooter className="px-4 sm:px-4 py-2.5">
                <Link
                  href={`/app/settlements/${paymentAttempt.id}`}
                  className="inline-flex items-center gap-1 text-xs text-foreground-secondary hover:text-foreground"
                >
                  View settlement explorer <ArrowRight className="w-3 h-3" />
                </Link>
              </PanelFooter>
            </Panel>
          )}

          {/* Activity */}
          <Panel>
            <PanelHeader title="Activity" compact />
            <div className="px-4 py-4">
              <Timeline items={timeline} />
            </div>
          </Panel>

          {/* Identifiers */}
          <Panel>
            <PanelHeader title="Identifiers" compact />
            <div className="px-4 py-3.5">
              <DataList dense>
                <IdRow label="Invoice" value={invoice.id} />
                <IdRow label="Client request" value={invoice.clientRequestId} />
                <IdRow label="Seller" value={invoice.sellerId} />
                {invoice.digest && <IdRow label="Digest" value={invoice.digest} display={formatHash(invoice.digest)} />}
                {delivery && <IdRow label="Delivery" value={delivery.id} />}
                {paymentAttempt && <IdRow label="Payment attempt" value={paymentAttempt.id} />}
              </DataList>
            </div>
          </Panel>
        </div>
      </div>

      {/* Delivery Submission Modal */}
      <Modal
        isOpen={deliveryModalOpen}
        onClose={() => setDeliveryModalOpen(false)}
        title="Submit delivery artifact"
        description="Seller agent delivers the analytics artifact and a signed manifest. Verification runs immediately after submission."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeliveryModalOpen(false)} disabled={isSubmittingDelivery}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmitDelivery} isLoading={isSubmittingDelivery}>
              Sign manifest &amp; submit
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="panel-inset px-3.5 py-3">
            <DataList dense>
              <DataRow label="Service" mono>
                {invoice.service.type}
              </DataRow>
              <DataRow label="Block range" mono>
                <span className="tabular-nums">
                  {invoice.service.parameters.start_block} → {invoice.service.parameters.end_block}
                </span>
              </DataRow>
              <DataRow label="Subject" mono>
                {formatAddress(invoice.service.parameters.address, 6)}
              </DataRow>
            </DataList>
          </div>

          <Field
            label="Claimed transaction count"
            htmlFor="claimed-tx-count"
            hint={
              <>
                The verifier recomputes this against HashKey Chain RPC. A mismatch raises{" "}
                <code className="font-mono text-danger/90">TX_COUNT_MISMATCH</code>.
              </>
            }
          >
            <Input
              id="claimed-tx-count"
              type="number"
              value={claimedTxCount}
              onChange={(e) => setClaimedTxCount(parseInt(e.target.value, 10) || 0)}
              className="font-mono tabular-nums"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Local components
// -----------------------------------------------------------------------------

function CheckCell({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3">
      <div className="min-w-0">
        <div className="text-xs text-foreground">{label}</div>
        <div className="text-2xs text-foreground-muted mt-0.5 truncate">{sub}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function MatchLine({ ok, okText, noText, neutralWhenFalse }: { ok: boolean; okText: string; noText: string; neutralWhenFalse?: boolean }) {
  return (
    <span
      className={cn(
        "mt-1 flex items-center gap-1 text-2xs",
        ok ? "text-success" : neutralWhenFalse ? "text-foreground-muted" : "text-danger"
      )}
    >
      {ok ? <Check className="w-3 h-3" strokeWidth={2.5} aria-hidden="true" /> : <X className="w-3 h-3" strokeWidth={2.5} aria-hidden="true" />}
      {ok ? okText : noText}
    </span>
  );
}

function IdRow({ label, value, display }: { label: string; value: string; display?: string }) {
  return (
    <DataRow label={label} className="grid-cols-[96px_1fr]">
      <CopyableValue value={value} displayText={display} label={`Copy ${label.toLowerCase()}`} className="max-w-full" />
    </DataRow>
  );
}

function ActionButton({
  action,
  variant,
}: {
  action: { label: string; icon: LucideIcon; href?: string; onClick?: () => void; loading?: boolean };
  variant: "primary" | "secondary";
}) {
  const Icon = action.icon;
  const cls = cn(buttonStyles({ variant, size: variant === "primary" ? "md" : "sm" }), "w-full justify-center");
  if (action.href) {
    return (
      <Link href={action.href} className={cls}>
        <Icon className="w-3.5 h-3.5" />
        {action.label}
      </Link>
    );
  }
  return (
    <Button variant={variant} size={variant === "primary" ? "md" : "sm"} onClick={action.onClick} isLoading={action.loading} className="w-full">
      {!action.loading && <Icon className="w-3.5 h-3.5" />}
      {action.label}
    </Button>
  );
}

function SignaturePanel({ invoice }: { invoice: Invoice }) {
  const hasSignature = !!invoice.signature;
  const signerMatches = sameAddress(invoice.signer, invoice.sellerWallet);

  const state: { tone: Tone; Icon: LucideIcon; label: string; detail: string } = !hasSignature
    ? {
        tone: "neutral",
        Icon: CircleDashed,
        label: "Unsigned",
        detail: "Awaiting the seller wallet's EIP-712 signature over the canonical invoice digest.",
      }
    : invoice.signatureValid === false
    ? {
        tone: "danger",
        Icon: ShieldAlert,
        label: "Invalid signature",
        detail: "The recovered signer does not authenticate these terms. The invoice cannot be relied upon.",
      }
    : invoice.signatureValid
    ? {
        tone: "success",
        Icon: ShieldCheck,
        label: "Valid signature",
        detail: signerMatches
          ? "Signature recovers to the registered seller wallet over the exact digest below."
          : "Signature is well-formed, but the signer differs from the registered seller wallet.",
      }
    : {
        tone: "info",
        Icon: Clock,
        label: "Signature recorded",
        detail: "A signature is attached but has not yet been verified.",
      };

  return (
    <Panel>
      <PanelHeader title="Seller signature" description="EIP-712 typed data · primary type HashXInvoice" />
      <div className={cn("flex items-start gap-3 px-4 sm:px-5 py-3.5 border-b border-border", toneStyles[state.tone].bg)}>
        <span className={cn("mt-px flex items-center justify-center w-7 h-7 rounded-md ring-1 ring-inset shrink-0", toneStyles[state.tone].badge)}>
          <state.Icon className="w-4 h-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className={cn("text-[13px] font-medium", toneStyles[state.tone].text)}>{state.label}</div>
          <p className="text-xs text-foreground-secondary mt-0.5 leading-relaxed">{state.detail}</p>
        </div>
      </div>
      <PanelBody>
        <DataList>
          <DataRow label="Digest">
            {invoice.digest ? (
              <CopyableValue value={invoice.digest} displayText={formatHash(invoice.digest, 10)} label="Copy EIP-712 digest" />
            ) : (
              <span className="text-xs text-foreground-muted">Not computed</span>
            )}
          </DataRow>
          <DataRow label="Signature">
            {invoice.signature ? (
              <CopyableValue value={invoice.signature} displayText={formatHash(invoice.signature, 10)} label="Copy signature" />
            ) : (
              <span className="text-xs text-foreground-muted">None</span>
            )}
          </DataRow>
          <DataRow label="Signer">
            {invoice.signer ? (
              <>
                <CopyableValue
                  value={invoice.signer}
                  displayText={formatAddress(invoice.signer, 6)}
                  explorerUrl={getExplorerAddressUrl(invoice.signer)}
                  label="Copy signer address"
                />
                <MatchLine ok={signerMatches} okText="Matches registered seller wallet" noText="Does not match registered seller wallet" />
              </>
            ) : (
              <span className="text-xs text-foreground-muted">—</span>
            )}
          </DataRow>
        </DataList>
      </PanelBody>
    </Panel>
  );
}

function DetailSkeleton({ invoiceId }: { invoiceId: string }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label={`Loading invoice ${invoiceId}`}>
      <div className="space-y-3">
        <div className="h-3 w-20 rounded bg-surface-2 animate-pulse" />
        <div className="h-3 w-14 rounded bg-surface-2 animate-pulse" />
        <div className="h-6 w-72 rounded bg-surface-2 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-6">
          {[160, 260, 180].map((h) => (
            <div key={h} className="panel animate-pulse" style={{ height: h }} />
          ))}
        </div>
        <div className="xl:col-span-4 space-y-6">
          {[150, 280].map((h) => (
            <div key={h} className="panel animate-pulse" style={{ height: h }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Timeline derivation
// -----------------------------------------------------------------------------

const STATUS_RANK: Record<InvoiceStatus, number> = {
  DRAFT: 0,
  SIGNED: 1,
  VERIFIED: 2,
  REJECTED: 1,
  DELIVERED: 3,
  DELIVERY_REJECTED: 3,
  DELIVERY_ACCEPTED: 4,
  SETTLED: 6,
};

function buildTimeline(invoice: Invoice, delivery: Delivery | null, attempt: PaymentAttempt | null): TimelineItem[] {
  const failAt = invoice.status === "REJECTED" ? 2 : invoice.status === "DELIVERY_REJECTED" ? 4 : -1;
  let reached = STATUS_RANK[invoice.status] ?? 0;
  if (invoice.signature) reached = Math.max(reached, 1);
  if (delivery && failAt === -1) reached = Math.max(reached, 3);
  const activeAttempt = attempt && attempt.state !== "FAILED" ? attempt : null;
  const awaiting =
    !!activeAttempt &&
    (activeAttempt.state === "AWAITING_SIGNATURE_APPROVAL" || activeAttempt.state === "AWAITING_SUBMISSION_APPROVAL");
  if (activeAttempt && !awaiting && failAt === -1) reached = Math.max(reached, 5);

  const stages: Array<{ title: string; done: string; pending: string; failed?: string; time?: string }> = [
    { title: "Invoice created", done: `Nonce ${invoice.nonce} · version ${invoice.version}`, pending: "", time: invoice.createdAt },
    { title: "Signed by seller", done: "EIP-712 signature recorded over canonical digest", pending: "Awaiting seller signature" },
    {
      title: "Invoice verified",
      done: "Schema, identity binding, expiry, and nonce checks",
      pending: "Authenticity checks not yet run",
      failed: "Invoice verification failed · payment gated",
    },
    { title: "Delivery submitted", done: "Artifact and signed manifest received", pending: "Awaiting seller delivery", time: delivery?.submittedAt },
    {
      title: "Fulfillment verified",
      done: "Deterministic checks passed against HashKey Chain",
      pending: "Deterministic delivery checks",
      failed: "Fulfillment rejected · evidence mismatch",
    },
    {
      title: "Human authorization",
      done: "Signing and submission approved",
      pending: awaiting ? "Awaiting two-stage human approval" : "Two-stage approval: signing, then submission",
      time: activeAttempt?.createdAt,
    },
    {
      title: "Settled",
      done: "HSP payment finalized · receipt anchored",
      pending: activeAttempt && !awaiting ? "On HSP rail · not final" : "HSP settlement on HashKey Chain",
      time: invoice.status === "SETTLED" ? activeAttempt?.updatedAt : undefined,
    },
  ];

  let currentAssigned = false;
  return stages.map((s, i) => {
    let state: TimelineItem["state"];
    if (failAt === i) {
      state = "failed";
      currentAssigned = true;
    } else if (i <= reached && (failAt === -1 || i < failAt)) {
      state = "done";
    } else if (!currentAssigned && failAt === -1) {
      state = i === 5 && awaiting ? "warning" : "current";
      currentAssigned = true;
    } else {
      state = "pending";
    }

    const description = state === "failed" ? s.failed : state === "done" ? s.done : s.pending || undefined;
    return {
      title: s.title,
      description,
      state,
      time: s.time && state !== "pending" ? formatShortUtc(s.time) : undefined,
    };
  });
}
