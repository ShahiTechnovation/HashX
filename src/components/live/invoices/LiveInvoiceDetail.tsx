"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileCheck2, PackageCheck, PenLine, RefreshCw, ShieldCheck, Wallet, Receipt as ReceiptIcon, ArrowRight } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { Button, buttonStyles } from "@/components/ui/Button";
import { PageHeader, MetaItem } from "@/components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { DataList, DataRow } from "@/components/ui/DataList";
import { Callout } from "@/components/ui/Callout";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  LiveError,
  LiveGate,
  PAYMENT_STATE_META,
  PaymentStateBadge,
  TestnetBadge,
  TxLink,
  errorMessage,
  tokenAmount,
  useLiveQuery,
} from "@/components/live/common";
import { DecisionBadge, DeliveryStatusBadge, HashValue, ReasonCodes, formatDateTime } from "@/components/live/trust/verdict";
import { computeArtifactInBrowser } from "@/lib/live/analytics";
import { signTypedDataJson } from "@/lib/live/wallet";
import type { Hex, LiveDelivery, LiveInvoice, LivePayment, LivePaymentState, LiveReceipt, LiveVerificationSummary } from "@/lib/live/types";
import { explorerAddressUrl, findNetwork } from "@shared/networks";
import { LegacyBadge, RoleBadge, StepList, isLegacy, setStep, type StepItem } from "./shared";

const PRE_SUBMISSION: LivePaymentState[] = ["AWAITING_SIGNATURE_APPROVAL", "AWAITING_SUBMISSION_APPROVAL", "AUTHORIZED"];
const TERMINAL_FAILURE: LivePaymentState[] = ["FAILED", "DROPPED", "EXPIRED", "CANCELLED", "TIMEOUT"];

const DELIVERY_STEPS: StepItem[] = [
  { key: "compute", label: "Compute analytics artifact from the delivery chain's public RPC", state: "idle" },
  { key: "prepare", label: "Prepare delivery manifest on the HashX backend", state: "idle" },
  { key: "sign", label: "Sign EIP-712 delivery manifest in your wallet", state: "idle" },
  { key: "submit", label: "Submit artifact, manifest and signature", state: "idle" },
  { key: "verify", label: "Backend independently recomputes the artifact (delivery verification)", state: "idle" },
];

function settled<T>(r: PromiseSettledResult<T>): { value: T | null; error: unknown } {
  return r.status === "fulfilled" ? { value: r.value, error: null } : { value: null, error: r.reason };
}

export function LiveInvoiceDetail({ id }: { id: string }) {
  return (
    <LiveGate purpose="Only the invoice's seller and buyer can view it.">
      <DetailInner id={id} />
    </LiveGate>
  );
}

function DetailInner({ id }: { id: string }) {
  const router = useRouter();
  const { liveApi, walletAddress, triggerRefresh } = useApp();
  const q = useLiveQuery(async () => {
    const invoice = await liveApi.getInvoice(id);
    const [verification, delivery, payment, receipt] = await Promise.allSettled([
      liveApi.verification(id),
      liveApi.latestDelivery(id),
      liveApi.paymentStatus(id),
      liveApi.receiptForInvoice(id),
    ]);
    return { invoice, verification: settled(verification), delivery: settled(delivery), payment: settled(payment), receipt: settled(receipt) };
  }, [liveApi, id]);

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [deliverySteps, setDeliverySteps] = useState<StepItem[] | null>(null);

  if (q.error) {
    return (
      <div className="space-y-6">
        <PageHeader back={{ href: "/app/invoices", label: "Invoices" }} eyebrow="Invoice" title={id} />
        <LiveError error={q.error} title="Could not load invoice" onRetry={q.reload} />
      </div>
    );
  }
  if (!q.data) {
    return (
      <div className="space-y-6">
        <PageHeader back={{ href: "/app/invoices", label: "Invoices" }} eyebrow="Invoice" title={id} />
        <Panel>
          <PanelBody className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-5 rounded bg-surface-2 animate-pulse" />
            ))}
          </PanelBody>
        </Panel>
      </div>
    );
  }

  const { invoice: inv, verification, delivery, payment, receipt } = q.data;
  const role = inv.viewerRole ?? null;
  const legacy = isLegacy(inv);
  const summary = verification.value;
  const latestDelivery = delivery.value;
  const pay = payment.value;
  const rcpt = receipt.value;
  const account = walletAddress as Hex;

  async function run(key: string, fn: () => Promise<string | void>) {
    setBusy(key);
    setActionError(null);
    setActionNotice(null);
    try {
      const notice = await fn();
      if (notice) setActionNotice(notice);
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(null);
      q.reload();
      triggerRefresh();
    }
  }

  const signInvoice = () =>
    run("sign", async () => {
      const { typedData } = await liveApi.invoiceTypedData(inv.id);
      const signature = await signTypedDataJson(account, typedData);
      const signed = await liveApi.signInvoice(inv.id, signature);
      return `Signature accepted. Invoice is now ${signed.status}.`;
    });

  const verifyInvoice = () =>
    run("verifyInvoice", async () => {
      const r = await liveApi.verifyInvoice(inv.id);
      return `Invoice verification: ${r.decision}${r.reasonCodes.length ? ` (${r.reasonCodes.join(", ")})` : ""}.`;
    });

  const verifyDelivery = () =>
    run("verifyDelivery", async () => {
      const r = await liveApi.verifyDelivery(inv.id);
      return `Delivery verification: ${r.decision}${r.reasonCodes.length ? ` (${r.reasonCodes.join(", ")})` : ""}.`;
    });

  const submitDelivery = () =>
    run("deliver", async () => {
      let s = DELIVERY_STEPS.map((x) => ({ ...x }));
      const update = (key: string, state: StepItem["state"], detail?: string) => {
        s = setStep(s, key, state, detail);
        setDeliverySteps(s);
      };
      setDeliverySteps(s);
      try {
        const p = inv.service.parameters;
        const chainId = inv.deliveryChainId ?? inv.service.delivery_chain_id;
        update("compute", "active", "Connecting to public RPC…");
        const artifact = await computeArtifactInBrowser({
          chainId,
          address: p.address,
          startBlock: Number(p.start_block),
          endBlock: Number(p.end_block),
          onProgress: (done, total) => update("compute", "active", `Fetched block ${done} of ${total}`),
        });
        update("compute", "done", `${artifact.transaction_count} matching transaction(s) in blocks ${artifact.start_block}–${artifact.end_block}`);

        const artifactUri = `hashx-inline://invoices/${inv.id}/${inv.service.type}.json`;
        const artifactContent = artifact as unknown as Record<string, unknown>;
        update("prepare", "active");
        const prep = await liveApi.prepareDelivery(inv.id, artifactUri, artifactContent);
        update("prepare", "done", `Artifact SHA-256 ${prep.artifactSha256}`);

        update("sign", "active");
        const manifestSignature = await signTypedDataJson(account, prep.typedData);
        update("sign", "done");

        update("submit", "active");
        const del = await liveApi.submitDelivery(inv.id, {
          artifact_uri: artifactUri,
          artifact_content: artifactContent,
          manifest: prep.manifest,
          manifest_signature: manifestSignature,
        });
        update("submit", "done", `Delivery v${del.version} recorded`);

        update("verify", "active");
        const r = await liveApi.verifyDelivery(inv.id);
        update("verify", r.decision === "FAIL" ? "error" : "done", `Backend decision: ${r.decision}${r.reasonCodes.length ? ` · ${r.reasonCodes.join(", ")}` : ""}`);
        return `Delivery v${del.version} submitted. Backend delivery verification: ${r.decision}.`;
      } catch (err) {
        const active = s.find((x) => x.state === "active");
        if (active) update(active.key, "error", errorMessage(err));
        throw err;
      }
    });

  const requestPayment = async () => {
    setBusy("pay");
    setActionError(null);
    setActionNotice(null);
    try {
      const attempt = await liveApi.requestPayment(inv.id);
      triggerRefresh();
      router.push(`/app/approvals/${attempt.id}`);
    } catch (err) {
      setActionError(err);
      setBusy(null);
    }
  };

  const status = inv.status;
  const anyBusy = busy !== null;
  const canRequestPayment =
    role === "buyer" && !legacy && Boolean(summary?.isEligibleForPayment) && (!pay || TERMINAL_FAILURE.includes(pay.state));

  // Primary + secondary actions, by role and backend status. The backend re-checks every transition.
  const actions: React.ReactNode[] = [];
  if (!legacy && role === "seller") {
    if (status === "DRAFT")
      actions.push(
        <Button key="sign" onClick={signInvoice} isLoading={busy === "sign"} disabled={anyBusy}>
          <PenLine className="w-3.5 h-3.5" /> Sign with wallet
        </Button>
      );
    if (status === "SIGNED")
      actions.push(
        <Button key="verify" onClick={verifyInvoice} isLoading={busy === "verifyInvoice"} disabled={anyBusy}>
          <ShieldCheck className="w-3.5 h-3.5" /> Verify invoice
        </Button>
      );
    if (status === "VERIFIED" || status === "DELIVERY_REJECTED")
      actions.push(
        <Button key="deliver" onClick={submitDelivery} isLoading={busy === "deliver"} disabled={anyBusy}>
          <PackageCheck className="w-3.5 h-3.5" /> Compute &amp; submit delivery
        </Button>
      );
    if (status === "DELIVERED")
      actions.push(
        <Button key="vd" onClick={verifyDelivery} isLoading={busy === "verifyDelivery"} disabled={anyBusy}>
          <FileCheck2 className="w-3.5 h-3.5" /> Run delivery verification
        </Button>
      );
  }
  if (!legacy && role === "buyer") {
    if (canRequestPayment)
      actions.push(
        <Button key="pay" onClick={requestPayment} isLoading={busy === "pay"} disabled={anyBusy}>
          <Wallet className="w-3.5 h-3.5" /> Request payment
        </Button>
      );
    if (status !== "DRAFT")
      actions.push(
        <Button key="vi" variant="secondary" onClick={verifyInvoice} isLoading={busy === "verifyInvoice"} disabled={anyBusy}>
          <ShieldCheck className="w-3.5 h-3.5" /> Verify invoice
        </Button>
      );
    if (latestDelivery)
      actions.push(
        <Button key="vd" variant="secondary" onClick={verifyDelivery} isLoading={busy === "verifyDelivery"} disabled={anyBusy}>
          <FileCheck2 className="w-3.5 h-3.5" /> Verify delivery
        </Button>
      );
  }
  if (!legacy && role === "seller" && latestDelivery && status !== "DELIVERED")
    actions.push(
      <Button key="vd2" variant="secondary" onClick={verifyDelivery} isLoading={busy === "verifyDelivery"} disabled={anyBusy}>
        <RefreshCw className="w-3.5 h-3.5" /> Re-run delivery verification
      </Button>
    );

  const settleNet = findNetwork(inv.payment.settlement_chain_id);
  const deliveryChainId = inv.deliveryChainId ?? inv.service.delivery_chain_id;
  const deliveryNet = findNetwork(deliveryChainId);

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/app/invoices", label: "Invoices" }}
        eyebrow="Invoice · connected mode"
        title={<span className="font-mono">{inv.id}</span>}
        badges={
          <>
            <StatusBadge status={inv.status} type="invoice" />
            <RoleBadge role={role} />
            {legacy && <LegacyBadge />}
          </>
        }
        description={
          role === "seller"
            ? "You issued this invoice. Its terms are committed by your EIP-712 signature."
            : role === "buyer"
            ? "You are the buyer. Payment can only be requested once the backend reports the invoice and delivery as verified."
            : undefined
        }
        meta={
          <>
            <MetaItem label="Created">{formatDateTime(inv.createdAt)}</MetaItem>
            <MetaItem label="Expires">{formatDateTime(inv.expiresAt)}</MetaItem>
            <MetaItem label="Protocol">v{inv.protocolVersion}</MetaItem>
          </>
        }
        actions={
          <Link href={`/app/trust/${inv.id}`} className={buttonStyles({ variant: "secondary", size: "sm" })}>
            <ShieldCheck className="w-3.5 h-3.5" /> Trust inspector
          </Link>
        }
      />

      {legacy && (
        <Callout tone="warning" title="Legacy v1 invoice — not payable">
          This record predates protocol v2. It is shown for reference only; it cannot be signed, delivered or paid through the v2 flow.
        </Callout>
      )}
      {!legacy && status === "DRAFT" && (
        <Callout tone={role === "seller" ? "warning" : "neutral"} title="Draft — not signed">
          {role === "seller"
            ? "The terms below are stored on the backend but are not committed until your wallet signs them. Use “Sign with wallet” to sign (your wallet switches to Sepolia Testnet)."
            : "The seller has not signed these terms yet."}
        </Callout>
      )}

      {/* Actions */}
      {(actions.length > 0 || actionError !== null || actionNotice || deliverySteps) && (
        <Panel>
          <PanelHeader title="Actions" description="Every action is authorized and re-validated by the HashX backend." />
          <PanelBody className="space-y-4">
            {actions.length > 0 && <div className="flex flex-wrap gap-2">{actions}</div>}
            {deliverySteps && <StepList steps={deliverySteps} />}
            {actionNotice && <Callout tone="info">{actionNotice}</Callout>}
            {actionError !== null && <LiveError error={actionError} title="Action failed" />}
          </PanelBody>
        </Panel>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 space-y-6">
          <Panel>
            <PanelHeader title="Signed terms" description="Exactly as stored by the backend." />
            <PanelBody>
              <DataList>
                <DataRow label="Seller">
                  <span className="block text-foreground-secondary">{inv.sellerDisplayName}</span>
                  <CopyableValue value={inv.sellerWallet} />
                </DataRow>
                <DataRow label="Buyer">{inv.buyerWallet ? <CopyableValue value={inv.buyerWallet} /> : "—"}</DataRow>
                <DataRow label="Buyer reference">{inv.buyerRef}</DataRow>
                <DataRow label="Buyer reference hash"><HashValue value={inv.buyerRefHash} /></DataRow>
                <DataRow label="Payee"><CopyableValue value={inv.payment.payee} /></DataRow>
                <DataRow label="Amount">
                  <span className="block font-medium">
                    {tokenAmount(inv.payment.amount_raw, inv.payment.token_decimals, inv.payment.token_symbol, inv.payment.settlement_chain_id)}
                  </span>
                  <span className="text-2xs text-foreground-muted font-mono">
                    raw {inv.payment.amount_raw ?? "—"} · {inv.payment.token_decimals ?? "?"} decimals
                  </span>
                </DataRow>
                <DataRow label="Token">
                  {inv.payment.token_address ? (
                    <CopyableValue
                      value={inv.payment.token_address}
                      explorerUrl={explorerAddressUrl(inv.payment.settlement_chain_id, inv.payment.token_address) ?? undefined}
                    />
                  ) : (
                    "—"
                  )}
                </DataRow>
                <DataRow label="Settlement">
                  <span className="flex flex-wrap items-center gap-2">
                    {inv.payment.settlement_network ?? settleNet?.name ?? "Unknown"} ({inv.payment.settlement_chain_id})
                    <TestnetBadge chainId={inv.payment.settlement_chain_id} />
                  </span>
                  <span className="block text-2xs text-foreground-muted mt-0.5">Rail: {inv.payment.rail ?? "—"}</span>
                </DataRow>
                <DataRow label="Delivery chain">{deliveryNet?.name ?? "Unknown chain"} ({deliveryChainId})</DataRow>
                <DataRow label="Service">
                  <span className="font-mono text-xs">{inv.service.type}</span>
                  <span className="block text-2xs text-foreground-muted">Acceptance: {inv.service.acceptance_policy}</span>
                </DataRow>
                <DataRow label="Subject address">
                  <CopyableValue value={inv.service.parameters.address} explorerUrl={explorerAddressUrl(deliveryChainId, inv.service.parameters.address) ?? undefined} />
                </DataRow>
                <DataRow label="Block range" mono>
                  {inv.service.parameters.start_block} – {inv.service.parameters.end_block}
                </DataRow>
                <DataRow label="Service terms hash"><HashValue value={inv.serviceTermsHash} /></DataRow>
                <DataRow label="EIP-712 digest"><HashValue value={inv.digest} /></DataRow>
                <DataRow label="Nonce" mono>{inv.nonce}</DataRow>
                <DataRow label="Issued">{formatDateTime(inv.issuedAt)}</DataRow>
                <DataRow label="Expires">{formatDateTime(inv.expiresAt)}</DataRow>
                <DataRow label="Signing chain">{inv.signingChainId ? `${findNetwork(inv.signingChainId)?.name ?? "Unknown"} (${inv.signingChainId})` : "—"}</DataRow>
                <DataRow label="Signature"><HashValue value={inv.signature} /></DataRow>
                <DataRow label="Signer"><HashValue value={inv.signer} /></DataRow>
                <DataRow label="Signature verified at submission">{inv.signature ? (inv.signatureVerifiedAtSubmission ? "Yes" : "No") : "—"}</DataRow>
              </DataList>
            </PanelBody>
          </Panel>

          <DeliveryPanel delivery={latestDelivery} error={delivery.error} onRetry={q.reload} />
        </div>

        <div className="xl:col-span-5 space-y-6">
          <VerificationSummaryPanel invoiceId={inv.id} summary={summary} error={verification.error} onRetry={q.reload} />
          <PaymentPanel invoice={inv} payment={pay} paymentError={payment.error} receipt={rcpt} receiptError={receipt.error} onRetry={q.reload} />
        </div>
      </div>
    </div>
  );
}

function VerificationSummaryPanel({
  invoiceId,
  summary,
  error,
  onRetry,
}: {
  invoiceId: string;
  summary: LiveVerificationSummary | null;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <Panel>
      <PanelHeader
        title="Verification (backend)"
        description="Authoritative eligibility summary persisted by HashX."
        actions={
          <Link href={`/app/trust/${invoiceId}`} className="text-xs text-primary-light hover:underline inline-flex items-center gap-1">
            Details <ArrowRight className="w-3 h-3" />
          </Link>
        }
      />
      <PanelBody className="space-y-4">
        {error !== null ? (
          <LiveError error={error} title="Could not load verification summary" onRetry={onRetry} />
        ) : !summary ? (
          <p className="text-xs text-foreground-muted">No summary available.</p>
        ) : (
          <>
            <DataList dense>
              <DataRow label="Overall decision"><DecisionBadge decision={summary.overallDecision} size="sm" /></DataRow>
              <DataRow label="Invoice decision"><DecisionBadge decision={summary.invoiceVerification ? summary.invoiceDecision : null} size="sm" /></DataRow>
              <DataRow label="Delivery decision"><DecisionBadge decision={summary.deliveryDecision ?? null} size="sm" emptyLabel="No delivery" /></DataRow>
              <DataRow label="Eligible for payment">{summary.isEligibleForPayment ? "Yes" : "No"}</DataRow>
            </DataList>
            <p className="text-xs text-foreground-secondary leading-relaxed">{summary.eligibilityExplanation}</p>
            {summary.blockingReasons.length > 0 && (
              <div>
                <div className="eyebrow mb-1.5">Blocking reasons</div>
                <ul className="list-disc pl-4 space-y-1 text-xs text-foreground-secondary">
                  {summary.blockingReasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {(summary.invoiceVerification?.decision === "PENDING" || summary.deliveryVerification?.decision === "PENDING") && (
              <Callout tone="warning" title="Verification is PENDING">
                The backend could not reach a final verdict (for example the delivery chain RPC was unavailable or the block range is not yet confirmed). Nothing is payable until a re-run returns PASS.
                <div className="mt-2 space-y-1.5">
                  {summary.invoiceVerification?.decision === "PENDING" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-2xs text-foreground-muted">Invoice run</span>
                      <ReasonCodes codes={summary.invoiceVerification.reasonCodes} decision="PENDING" />
                    </div>
                  )}
                  {summary.deliveryVerification?.decision === "PENDING" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-2xs text-foreground-muted">Delivery run</span>
                      <ReasonCodes codes={summary.deliveryVerification.reasonCodes} decision="PENDING" />
                    </div>
                  )}
                </div>
              </Callout>
            )}
            {summary.overallDecision === "FAIL" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xs text-foreground-muted">Reason codes</span>
                <ReasonCodes
                  codes={Array.from(new Set([...(summary.invoiceVerification?.reasonCodes ?? []), ...(summary.deliveryVerification?.reasonCodes ?? [])]))}
                  decision="FAIL"
                />
              </div>
            )}
          </>
        )}
      </PanelBody>
    </Panel>
  );
}

function DeliveryPanel({ delivery, error, onRetry }: { delivery: LiveDelivery | null; error: unknown; onRetry: () => void }) {
  return (
    <Panel>
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2">
            Latest delivery {delivery && <DeliveryStatusBadge status={delivery.status} />}
          </span>
        }
        description="Artifact and signed manifest submitted by the seller."
      />
      {error !== null ? (
        <PanelBody>
          <LiveError error={error} title="Could not load delivery" onRetry={onRetry} />
        </PanelBody>
      ) : !delivery ? (
        <EmptyState title="No delivery submitted" description="The seller has not submitted a delivery for this invoice yet." />
      ) : (
        <PanelBody className="space-y-4">
          <DataList dense>
            <DataRow label="Version">v{delivery.version}</DataRow>
            <DataRow label="Delivery ID" mono>{delivery.id}</DataRow>
            <DataRow label="Submitted">{formatDateTime(delivery.submittedAt)}</DataRow>
            <DataRow label="Artifact URI" mono>{delivery.artifactUri}</DataRow>
            <DataRow label="Artifact SHA-256 (committed)" hint="In the seller-signed manifest"><HashValue value={delivery.artifactSha256} /></DataRow>
            <DataRow label="Artifact SHA-256 (computed)" hint="Computed by the backend over the stored artifact"><HashValue value={delivery.artifactSha256Computed} /></DataRow>
            <DataRow label="Manifest digest"><HashValue value={delivery.manifestDigest} /></DataRow>
            <DataRow label="Manifest signature"><HashValue value={delivery.manifestSignature} /></DataRow>
          </DataList>
          <CodeViewer data={delivery.artifactContent} title="Artifact content" maxHeight="max-h-72" />
        </PanelBody>
      )}
    </Panel>
  );
}

function PaymentPanel({
  invoice,
  payment,
  paymentError,
  receipt,
  receiptError,
  onRetry,
}: {
  invoice: LiveInvoice;
  payment: LivePayment | null;
  paymentError: unknown;
  receipt: LiveReceipt | null;
  receiptError: unknown;
  onRetry: () => void;
}) {
  return (
    <Panel>
      <PanelHeader title="Payment" description="Test USDC on Sepolia Testnet; two-stage human authorization by the buyer." />
      <PanelBody className="space-y-4">
        {paymentError !== null ? (
          <LiveError error={paymentError} title="Could not load payment status" onRetry={onRetry} />
        ) : !payment ? (
          <p className="text-xs text-foreground-muted">
            No payment attempt exists. {invoice.viewerRole === "buyer" ? "You can request payment once the backend reports this invoice as eligible." : "The buyer requests payment after delivery is verified."}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <PaymentStateBadge state={payment.state} />
              <span className="text-2xs text-foreground-muted">{PAYMENT_STATE_META[payment.state]?.description}</span>
            </div>
            <DataList dense>
              <DataRow label="Attempt" mono>{payment.id}</DataRow>
              <DataRow label="Amount">{tokenAmount(payment.tokenTotalRaw, payment.tokenDecimals, payment.tokenSymbol, payment.chainId)}</DataRow>
              <DataRow label="Network">
                <span className="flex flex-wrap items-center gap-2">
                  {payment.network ?? "—"} <TestnetBadge chainId={payment.chainId} />
                </span>
              </DataRow>
              <DataRow label="Payer"><CopyableValue value={payment.payer} /></DataRow>
              <DataRow label="Payee"><CopyableValue value={payment.payee} /></DataRow>
              <DataRow label="Transaction"><TxLink chainId={payment.chainId} hash={payment.txHash} /></DataRow>
              {payment.blockNumber && <DataRow label="Block" mono>{payment.blockNumber} · {payment.confirmations} confirmation(s)</DataRow>}
              {payment.finalityPolicy && <DataRow label="Finality policy" mono>{payment.finalityPolicy}</DataRow>}
              {payment.failureCode && (
                <DataRow label="Failure">
                  <span className="font-mono text-xs text-danger">{payment.failureCode}</span>
                  {payment.failureDetail && <span className="block text-2xs text-foreground-muted">{payment.failureDetail}</span>}
                </DataRow>
              )}
              <DataRow label="Updated">{formatDateTime(payment.updatedAt)}</DataRow>
            </DataList>
            <div className="flex flex-wrap gap-2">
              {PRE_SUBMISSION.includes(payment.state) && (
                <Link href={`/app/approvals/${payment.id}`} className={buttonStyles({ size: "sm" })}>
                  Open approval
                </Link>
              )}
              <Link href={`/app/settlements/${payment.id}`} className={buttonStyles({ variant: "secondary", size: "sm" })}>
                Settlement
              </Link>
            </div>
          </>
        )}

        {receiptError !== null ? (
          <LiveError error={receiptError} title="Could not load receipt" onRetry={onRetry} />
        ) : receipt ? (
          <div className="rounded-md border border-border bg-surface-2/40 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <ReceiptIcon className="w-3.5 h-3.5 text-success" /> Receipt issued
              {receipt.revokedAt && <span className="text-danger">· revoked</span>}
            </div>
            <div className="text-2xs text-foreground-muted">
              {receipt.receiptVersion} · {formatDateTime(receipt.issuedAt)}
            </div>
            <div className="text-2xs">
              Digest <HashValue value={receipt.receiptDigest} />
            </div>
            <Link href={`/app/receipts/${receipt.id}`} className="inline-flex items-center gap-1 text-xs text-primary-light hover:underline">
              Open receipt <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
