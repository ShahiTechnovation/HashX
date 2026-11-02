"use client";

/**
 * Connected-mode payment authorization for one payment attempt.
 *
 * Stage 1  — payer reviews the exact obligation and approves its authorization digest.
 * Stage 2  — payer's wallet signs the EIP-712 HashXPaymentAuthorization.
 * Step 3   — payer's wallet broadcasts the exact authorized ERC-20 transfer; the tx hash is
 *            reported to HashX, which verifies the Transfer on-chain independently.
 */
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, KeyRound, Send, ShieldCheck, XCircle } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { DataList, DataRow } from "@/components/ui/DataList";
import { PageHeader, MetaItem } from "@/components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { useNow } from "@/components/approvals/approval-primitives";
import { cn } from "@/lib/utils";
import {
  LiveError,
  LiveGate,
  PAYMENT_STATE_META,
  PaymentStateBadge,
  TestnetBadge,
  TxLink,
  useLiveQuery,
} from "@/components/live/common";
import { forgetPendingTx, recallPendingTx, rememberPendingTx, sendAuthorizedTransfer, signTypedDataJson } from "@/lib/live/wallet";
import type { Hex, LivePayment } from "@/lib/live/types";
import { formatTokenAmount } from "@shared/networks";
import {
  AddressValue,
  Digest,
  POST_SUBMISSION_STATES,
  Stepper,
  countdown,
  fmtTime,
  networkLabel,
  sameAddr,
  type StepStatus,
} from "./shared";

export function LiveApprovalDetail({ id }: { id: string }) {
  return (
    <LiveGate purpose="Payment authorization requires the payer's signed-in wallet.">
      <ApprovalDetailInner id={id} />
    </LiveGate>
  );
}

type Busy = null | "approve" | "sign" | "send" | "report" | "cancel";

function ApprovalDetailInner({ id }: { id: string }) {
  const router = useRouter();
  const { liveApi, session, walletAddress, triggerRefresh } = useApp();
  const q = useLiveQuery(() => liveApi.getPayment(id), [id, liveApi]);
  const now = useNow(1000);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [reportError, setReportError] = useState<unknown>(null);
  const [pendingTx, setPendingTx] = useState<Hex | null>(null);

  const payment = q.data;
  const state = payment?.state;

  // Recover a broadcast-but-unreported transaction hash from local storage.
  useEffect(() => {
    const stored = recallPendingTx(id);
    if (stored && payment?.txHash && sameAddr(stored, payment.txHash)) {
      // Backend already holds this exact hash; the local copy is no longer needed.
      forgetPendingTx(id);
      setPendingTx(null);
      return;
    }
    setPendingTx(stored);
  }, [id, payment?.txHash, state]);

  useEffect(() => {
    setReviewed(false);
    setActionError(null);
  }, [state]);

  if (q.loading && !payment) return <Panel><PanelBody className="h-64 animate-pulse" /></Panel>;
  if (q.error && !payment) return <LiveError error={q.error} title="Could not load payment attempt" onRetry={q.reload} />;
  if (!payment) return null;

  const summary = payment.approvalSummary;
  const ins = payment.transferInstructions;
  const chainId = summary?.chainId ?? payment.chainId;
  const decimals = summary?.tokenDecimals ?? payment.tokenDecimals ?? 6;
  const expiresAt = summary?.authorizationExpiresAt ?? payment.authorization?.expiresAt ?? null;
  const expiry = countdown(expiresAt, now);
  const isPayer = sameAddr(session?.address, payment.payer);
  const isStage1 = payment.state === "AWAITING_SIGNATURE_APPROVAL";
  const isStage2 = payment.state === "AWAITING_SUBMISSION_APPROVAL";
  const isAuthorized = payment.state === "AUTHORIZED";
  const isPostSubmission = POST_SUBMISSION_STATES.includes(payment.state);
  const canAct = isPayer && !busy && !expiry.expired;

  const apply = (p: LivePayment) => {
    q.setData(p);
    triggerRefresh();
  };

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    setBusy(kind);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(null);
    }
  };

  const approveTerms = () =>
    run("approve", async () => {
      if (!summary) throw new Error("The backend did not return an approval summary for this attempt.");
      apply(await liveApi.approveTerms(id, summary.authorizationDigest));
    });

  const signAuthorization = () =>
    run("sign", async () => {
      if (!walletAddress) throw new Error("Wallet not connected.");
      if (!payment.authorizationTypedData) throw new Error("The backend did not return authorization typed data.");
      if (!sameAddr(walletAddress, payment.payer)) throw new Error(`Connected wallet ${walletAddress} is not the payer ${payment.payer}.`);
      const sig = await signTypedDataJson(walletAddress as Hex, payment.authorizationTypedData);
      apply(await liveApi.authorize(id, sig));
    });

  const report = async (hash: Hex) => {
    setBusy("report");
    setReportError(null);
    try {
      const updated = await liveApi.reportTransaction(id, hash);
      forgetPendingTx(id);
      setPendingTx(null);
      apply(updated);
      router.push(`/app/settlements/${id}`);
    } catch (err) {
      // Keep the hash stored locally so it can be reported again; never re-send.
      setReportError(err);
    } finally {
      setBusy(null);
    }
  };

  const sendTransfer = async () => {
    if (!walletAddress || !ins) return;
    // Never broadcast twice: a stored hash must be reported, not replaced.
    const existing = recallPendingTx(id);
    if (existing) {
      setPendingTx(existing);
      return;
    }
    setBusy("send");
    setActionError(null);
    setReportError(null);
    let hash: Hex;
    try {
      if (!sameAddr(walletAddress, payment.payer)) throw new Error(`Connected wallet ${walletAddress} is not the payer ${payment.payer}.`);
      hash = await sendAuthorizedTransfer(walletAddress as Hex, ins);
    } catch (err) {
      setActionError(err);
      setBusy(null);
      return;
    }
    rememberPendingTx(id, hash);
    setPendingTx(hash);
    await report(hash);
  };

  const cancel = () =>
    run("cancel", async () => {
      if (!window.confirm("Cancel this payment attempt? The buyer will need to request a new payment.")) return;
      apply(await liveApi.cancel(id));
    });

  // Stepper status --------------------------------------------------------------
  const signed = !!payment.authorization?.signature;
  const stepStatus = (i: 0 | 1 | 2): StepStatus => {
    if (isPostSubmission) return "done";
    const currentIdx = isStage1 ? 0 : isStage2 ? 1 : isAuthorized ? 2 : -1;
    if (currentIdx >= 0) return i < currentIdx ? "done" : i === currentIdx ? (expiry.expired ? "failed" : "current") : "pending";
    // EXPIRED / CANCELLED: only mark steps we have evidence for.
    if (signed && i < 2) return "done";
    return "pending";
  };

  const rawAmount = summary?.tokenTotalRaw ?? payment.tokenTotalRaw;
  const humanAmount = formatTokenAmount(rawAmount, decimals);
  const tokenLabel = summary?.tokenLabel ?? `Test ${payment.tokenSymbol ?? "USDC"}`;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/app/approvals", label: "Approvals" }}
        eyebrow="Payment authorization"
        title={<span className="font-mono text-xl">{payment.id}</span>}
        badges={
          <>
            <PaymentStateBadge state={payment.state} />
            <TestnetBadge chainId={chainId} />
          </>
        }
        description={PAYMENT_STATE_META[payment.state]?.description}
        meta={
          <>
            <MetaItem label="Invoice">
              <Link href={`/app/invoices/${payment.invoiceId}`} className="font-mono hover:text-foreground hover:underline">
                {payment.invoiceId}
              </Link>
            </MetaItem>
            <MetaItem label="Created">{fmtTime(payment.createdAt)}</MetaItem>
            <MetaItem label="Your role">{isPayer ? "Payer (buyer)" : sameAddr(session?.address, payment.payee) ? "Payee (seller)" : "Participant"}</MetaItem>
          </>
        }
        actions={
          <Button variant="secondary" size="sm" onClick={q.reload} isLoading={q.loading}>
            Refresh
          </Button>
        }
      />

      {q.error ? <LiveError error={q.error} title="Refresh failed" onRetry={q.reload} /> : null}

      <Stepper
        steps={[
          { title: "Stage 1 · Approve exact terms", description: "Payer confirms the obligation's authorization digest.", status: stepStatus(0) },
          { title: "Stage 2 · Sign authorization", description: "Payer wallet signs the EIP-712 payment authorization.", status: stepStatus(1) },
          { title: "Step 3 · Send Test USDC", description: "Payer wallet broadcasts the authorized ERC-20 transfer.", status: stepStatus(2) },
        ]}
      />

      <Callout tone="info" title="A wallet popup or a submitted transaction is not settlement">
        HashX verifies the on-chain Transfer independently (receipt status, ERC-20 Transfer log, canonical block and the
        confirmation policy). A receipt is issued only after that verification.
      </Callout>

      {payment.rail === "legacy-v1" && (
        <Callout tone="warning" title="Legacy v1 record — not independently verified">
          This attempt predates direct on-chain settlement verification and cannot be authorized here.
        </Callout>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Obligation ---------------------------------------------------------- */}
        <Panel className="lg:col-span-7">
          <PanelHeader
            icon={<ShieldCheck />}
            title="Exact obligation"
            description="Every field below is bound into the authorization digest. Review it against the invoice before approving."
          />
          <PanelBody className="space-y-5">
            <div className="rounded-md border border-border bg-surface-2/40 p-4">
              <div className="text-xs text-foreground-muted">Amount · {tokenLabel}</div>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
                <div className="text-[32px] font-medium leading-none tracking-[-0.03em] tabular-nums text-foreground">
                  {humanAmount} <span className="text-base font-medium text-foreground-secondary">Test {summary?.tokenSymbol ?? payment.tokenSymbol ?? "USDC"}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-foreground-muted">Raw token units ({decimals} decimals)</div>
                  <div className="font-mono text-sm font-semibold text-foreground">{rawAmount}</div>
                </div>
              </div>
              <p className="mt-2 text-2xs text-foreground-muted">Sepolia Testnet test token — no monetary value.</p>
            </div>

            <DataList>
              <DataRow label="Payer (buyer)" mono>
                <AddressValue address={summary?.payer ?? payment.payer} chainId={chainId} />
              </DataRow>
              <DataRow label="Recipient (payee)" mono>
                <AddressValue address={summary?.payee ?? payment.payee} chainId={chainId} />
              </DataRow>
              <DataRow label="Token" hint={tokenLabel}>
                <AddressValue address={summary?.tokenAddress ?? payment.tokenAddress} chainId={chainId} />
              </DataRow>
              <DataRow label="Chain">
                <span className="inline-flex flex-wrap items-center gap-2">
                  {summary?.network ?? networkLabel(chainId, payment.network)}
                  <span className="font-mono text-xs text-foreground-muted">chainId {chainId ?? "—"}</span>
                  <TestnetBadge chainId={chainId} />
                </span>
              </DataRow>
              <DataRow label="Settlement rail" mono>{summary?.rail ?? payment.rail}</DataRow>
              <DataRow label="Authorization digest" hint="EIP-712 HashXPaymentAuthorization" mono>
                <Digest value={summary?.authorizationDigest ?? payment.authorization?.digest} />
              </DataRow>
              <DataRow label="Invoice digest" mono>
                <Digest value={summary?.invoiceDigest ?? payment.invoiceDigest} />
              </DataRow>
              <DataRow label="Delivery evidence digest" mono>
                <Digest value={summary?.deliveryEvidenceDigest ?? payment.deliveryEvidenceDigest} />
              </DataRow>
              <DataRow label="Finality policy" mono>{summary?.finalityPolicy ?? payment.finalityPolicy ?? "—"}</DataRow>
              <DataRow label="Authorization expiry">
                <span className="flex flex-col gap-0.5">
                  <span>{fmtTime(expiresAt)}</span>
                  <span className={cn("inline-flex items-center gap-1 text-xs tabular-nums", expiry.expired ? "text-danger" : "text-warning")}>
                    <Clock className="h-3 w-3" />
                    {expiry.text}
                  </span>
                </span>
              </DataRow>
            </DataList>
            {!summary && (
              <Callout tone="warning" title="No approval summary">
                The backend did not return an approval summary for this attempt, so it cannot be authorized from this view.
              </Callout>
            )}
          </PanelBody>
        </Panel>

        {/* Actions ------------------------------------------------------------ */}
        <div className="space-y-4 lg:col-span-5">
          <Panel>
            <PanelHeader icon={<KeyRound />} title="Human authorization" description={isPayer ? "Only you, the payer, can authorize this payment." : "Read-only view."} />
            <PanelBody className="space-y-4">
              {!isPayer && (
                <Callout tone="neutral" title="Awaiting the buyer">
                  Only the payer wallet ({payment.payer}) can approve, sign and send this payment. You are signed in as{" "}
                  <span className="font-mono">{session?.address}</span>, so this view is read-only.
                </Callout>
              )}

              {expiry.expired && (isStage1 || isStage2 || isAuthorized) && (
                <Callout tone="danger" title="Authorization window expired">
                  Actions are disabled. {isAuthorized ? "Any transaction already broadcast can still be reported below." : "The buyer must request a new payment."}
                </Callout>
              )}

              {isStage1 && (
                <div className="space-y-3">
                  <p className="text-xs leading-relaxed text-foreground-secondary">
                    Stage 1 records your approval of this exact obligation by echoing its authorization digest back to HashX.
                    No funds move and nothing is signed yet.
                  </p>
                  {isPayer && (
                    <label className="flex cursor-pointer select-none items-start gap-3 rounded-md border border-border bg-surface-2/40 p-3">
                      <input
                        type="checkbox"
                        checked={reviewed}
                        onChange={(e) => setReviewed(e.target.checked)}
                        disabled={!summary || expiry.expired}
                        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-border"
                      />
                      <span className="text-xs leading-relaxed text-foreground-secondary">
                        I reviewed the exact payer, recipient, token, chain, amount and expiry
                      </span>
                    </label>
                  )}
                  {isPayer && (
                    <Button className="w-full" onClick={approveTerms} isLoading={busy === "approve"} disabled={!canAct || !reviewed || !summary}>
                      <ShieldCheck className="h-4 w-4" />
                      Approve exact terms (Stage 1)
                    </Button>
                  )}
                </div>
              )}

              {isStage2 && (
                <div className="space-y-3">
                  <p className="text-xs leading-relaxed text-foreground-secondary">
                    Stage 2 asks your wallet for an EIP-712 <span className="font-mono">HashXPaymentAuthorization</span> signature.
                    It binds the invoice digest, delivery evidence digest, payer, payee, token, chain, amount, nonce and expiry —
                    the signature is valid only for this exact obligation. Signing does not move funds.
                  </p>
                  {isPayer && (
                    <Button className="w-full" onClick={signAuthorization} isLoading={busy === "sign"} disabled={!canAct || !payment.authorizationTypedData}>
                      <KeyRound className="h-4 w-4" />
                      Sign payment authorization in wallet
                    </Button>
                  )}
                </div>
              )}

              {isAuthorized && (
                <div className="space-y-3">
                  {ins ? (
                    <>
                      <p className="text-xs leading-relaxed text-foreground-secondary">
                        Your wallet will broadcast exactly this ERC-20 call. You pay Sepolia gas. HashX never holds your keys.
                      </p>
                      <DataList dense className="rounded-md border border-border p-3">
                        <DataRow label="Token contract (to)" mono>
                          <AddressValue address={ins.to} chainId={ins.chainId} />
                        </DataRow>
                        <DataRow label="Method" mono>{ins.method || "transfer(address,uint256)"}</DataRow>
                        <DataRow label="Recipient" mono>
                          <AddressValue address={ins.args.to} chainId={ins.chainId} />
                        </DataRow>
                        <DataRow label="Raw amount" mono>
                          {ins.args.amount}
                          <span className="ml-2 font-sans text-foreground-muted">
                            = {formatTokenAmount(ins.args.amount, decimals)} Test {summary?.tokenSymbol ?? payment.tokenSymbol ?? "USDC"}
                          </span>
                        </DataRow>
                        <DataRow label="Chain">
                          <span className="inline-flex flex-wrap items-center gap-2">
                            {networkLabel(ins.chainId)} <span className="font-mono text-xs text-foreground-muted">({ins.chainId})</span>
                          </span>
                        </DataRow>
                        <DataRow label="Native value" mono>{ins.value}</DataRow>
                      </DataList>
                    </>
                  ) : (
                    <Callout tone="warning" title="No transfer instructions">
                      The backend did not return transfer instructions for this attempt.
                    </Callout>
                  )}

                  {pendingTx ? (
                    <Callout
                      tone="warning"
                      title="A transaction was broadcast but not yet reported"
                      actions={
                        isPayer ? (
                          <Button size="sm" onClick={() => report(pendingTx)} isLoading={busy === "report"} disabled={!!busy && busy !== "report"}>
                            {reportError ? "Retry report" : "Report transaction to HashX"}
                          </Button>
                        ) : undefined
                      }
                    >
                      <span className="block">
                        This browser stored transaction <TxLink chainId={ins?.chainId ?? chainId} hash={pendingTx} /> for this attempt.
                        Report it so HashX can verify it on-chain. It will not be re-sent.
                      </span>
                    </Callout>
                  ) : (
                    isPayer &&
                    ins && (
                      <Button className="w-full" onClick={sendTransfer} isLoading={busy === "send" || busy === "report"} disabled={!canAct}>
                        <Send className="h-4 w-4" />
                        Send Test USDC transfer from wallet
                      </Button>
                    )
                  )}
                  {reportError ? <LiveError error={reportError} title="Reporting the transaction failed — the hash is kept locally" /> : null}
                </div>
              )}

              {isPostSubmission && (
                <div className="space-y-3">
                  <p className="text-xs leading-relaxed text-foreground-secondary">
                    A transaction has been reported{payment.txHash ? <> (<TxLink chainId={chainId} hash={payment.txHash} />)</> : null}. Settlement status is
                    determined by HashX&apos;s independent on-chain verification.
                  </p>
                  <Link href={`/app/settlements/${id}`} className={cn(buttonStyles({ variant: "secondary" }), "w-full")}>
                    Track settlement verification <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}

              {(payment.state === "EXPIRED" || payment.state === "CANCELLED") && (
                <Callout tone="neutral" title={PAYMENT_STATE_META[payment.state].label}>
                  {PAYMENT_STATE_META[payment.state].description}
                  {payment.failureCode ? <span className="block font-mono text-2xs">{payment.failureCode}{payment.failureDetail ? ` · ${payment.failureDetail}` : ""}</span> : null}
                </Callout>
              )}

              {actionError ? <LiveError error={actionError} title="Action failed" /> : null}

              {isPayer && (isStage1 || isStage2) && (
                <Button variant="ghost" size="sm" className="w-full text-danger" onClick={cancel} isLoading={busy === "cancel"} disabled={!!busy}>
                  <XCircle className="h-4 w-4" />
                  Cancel attempt
                </Button>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  );
}
