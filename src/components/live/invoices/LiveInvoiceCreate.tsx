"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isAddress, getAddress } from "viem";
import { FileSignature, History } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/Panel";
import { Field, Input, Select } from "@/components/ui/Field";
import { Callout } from "@/components/ui/Callout";
import { DataList, DataRow } from "@/components/ui/DataList";
import { LiveError, LiveGate, TestnetBadge, errorMessage, newClientRequestId } from "@/components/live/common";
import { publicClientFor, signTypedDataJson } from "@/lib/live/wallet";
import { LiveApiError, type CreateLiveInvoiceInput, type Hex } from "@/lib/live/types";
import { PUBLIC_NETWORKS, SEPOLIA, SEPOLIA_CHAIN_ID, findNetwork, formatTokenAmount, parseTokenAmount } from "@shared/networks";
import { ACCEPTANCE_POLICY_EXACT, SERVICE_TYPE_ADDRESS_ANALYTICS } from "@shared/protocol";
import { StepList, setStep, type StepItem } from "./shared";

const MAX_BLOCK_RANGE = 50;
const USDC_DECIMALS = SEPOLIA.settlementToken!.decimals;
const DELIVERY_NETWORKS = PUBLIC_NETWORKS.filter((n) => n.deliveryVerificationSupported);

const INITIAL_STEPS: StepItem[] = [
  { key: "create", label: "Create draft invoice on the HashX backend", state: "idle" },
  { key: "sign", label: "Sign EIP-712 invoice terms in your wallet (switches to Sepolia Testnet)", state: "idle" },
  { key: "record", label: "Submit signature (backend recovers signer over stored terms)", state: "idle" },
  { key: "verify", label: "Run backend invoice verification", state: "idle" },
];

export function LiveInvoiceCreate() {
  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/app/invoices", label: "Invoices" }}
        eyebrow="Connected mode · HashX backend"
        title="Create invoice"
        description="Bill a buyer wallet for an EVM address analytics report. The terms are signed by your wallet with EIP-712 and settle in Test USDC on Sepolia Testnet (no monetary value)."
      />
      <LiveGate purpose="Only the signed-in seller wallet can create and sign invoices.">
        <CreateForm />
      </LiveGate>
    </div>
  );
}

function CreateForm() {
  const router = useRouter();
  const { liveApi, walletAddress } = useApp();
  // One idempotency key per form session: retries of the same body replay instead of duplicating.
  const [clientRequestId, setClientRequestId] = useState(() => newClientRequestId());

  const [buyer, setBuyer] = useState("");
  const [buyerRef, setBuyerRef] = useState("");
  const [deliveryChainId, setDeliveryChainId] = useState<number>(SEPOLIA_CHAIN_ID);
  const [subject, setSubject] = useState("");
  const [startBlock, setStartBlock] = useState("");
  const [endBlock, setEndBlock] = useState("");
  const [amount, setAmount] = useState("");
  const [payee, setPayee] = useState<string>(walletAddress ?? "");
  const [expiryHours, setExpiryHours] = useState("24");

  const [touched, setTouched] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [steps, setSteps] = useState<StepItem[]>(INITIAL_STEPS);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!isAddress(buyer, { strict: false })) e.buyer = "Enter a valid 0x wallet address.";
    else if (walletAddress && buyer.toLowerCase() === walletAddress.toLowerCase()) e.buyer = "Buyer must be a different wallet from yours (the seller).";
    if (!buyerRef.trim()) e.buyerRef = "Required. It is hashed into the signed terms.";
    else if (buyerRef.length > 255) e.buyerRef = "Maximum 255 characters.";
    if (!isAddress(subject, { strict: false })) e.subject = "Enter the 0x address to analyse.";
    const s = /^\d+$/.test(startBlock.trim()) ? BigInt(startBlock.trim()) : null;
    const en = /^\d+$/.test(endBlock.trim()) ? BigInt(endBlock.trim()) : null;
    if (s === null) e.startBlock = "Whole block number required.";
    if (en === null) e.endBlock = "Whole block number required.";
    if (s !== null && en !== null) {
      if (en < s) e.endBlock = "End block must be ≥ start block.";
      else if (en - s + 1n > BigInt(MAX_BLOCK_RANGE)) e.endBlock = `Range is ${(en - s + 1n).toString()} blocks; the maximum is ${MAX_BLOCK_RANGE}.`;
    }
    try {
      const raw = parseTokenAmount(amount, USDC_DECIMALS);
      if (raw <= 0n) e.amount = "Amount must be greater than zero.";
    } catch (err) {
      e.amount = amount.trim() ? (err as Error).message : "Enter an amount in Test USDC (up to 6 decimals).";
    }
    if (!isAddress(payee, { strict: false })) e.payee = "Enter a valid payee address.";
    const h = Number(expiryHours);
    if (!/^\d+$/.test(expiryHours.trim()) || h < 1 || h > 720) e.expiry = "Whole hours between 1 and 720.";
    return e;
  }, [buyer, buyerRef, subject, startBlock, endBlock, amount, payee, expiryHours, walletAddress]);

  const valid = Object.keys(errors).length === 0;
  const show = (k: string) => (touched ? errors[k] : undefined);

  let amountPreview: string | null = null;
  try {
    amountPreview = parseTokenAmount(amount, USDC_DECIMALS).toString();
  } catch {
    amountPreview = null;
  }

  async function fillRecentBlocks() {
    setRecentError(null);
    setRecentLoading(true);
    try {
      const latest = await publicClientFor(deliveryChainId).getBlockNumber();
      const end = latest - 12n;
      const start = end - 9n;
      setEndBlock(end.toString());
      setStartBlock(start.toString());
    } catch (err) {
      setRecentError(`Could not read the latest block from the public RPC: ${errorMessage(err)}`);
    } finally {
      setRecentLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid || !walletAddress) return;
    setSubmitting(true);
    setSubmitError(null);
    let s = INITIAL_STEPS.map((x) => ({ ...x }));
    const update = (key: string, state: StepItem["state"], detail?: string) => {
      s = setStep(s, key, state, detail);
      setSteps(s);
    };

    const input: CreateLiveInvoiceInput = {
      client_request_id: clientRequestId,
      buyer_wallet: getAddress(buyer) as Hex,
      buyer_ref: buyerRef.trim(),
      service: {
        type: SERVICE_TYPE_ADDRESS_ANALYTICS,
        delivery_chain_id: deliveryChainId,
        parameters: { address: getAddress(subject) as Hex, start_block: BigInt(startBlock.trim()).toString(), end_block: BigInt(endBlock.trim()).toString() },
        acceptance_policy: ACCEPTANCE_POLICY_EXACT,
      },
      payment: {
        rail: "sepolia-usdc",
        settlement_chain_id: SEPOLIA_CHAIN_ID,
        amount_raw: parseTokenAmount(amount, USDC_DECIMALS).toString(),
        payee: getAddress(payee) as Hex,
      },
      expires_in_seconds: Number(expiryHours) * 3600,
    };

    let invoiceId: string | null = null;
    try {
      update("create", "active");
      const created = await liveApi.createInvoice(input);
      invoiceId = created.id;
      update("create", "done", `${created.id}${created.idempotentReplay ? " (existing draft replayed for this request)" : ""}`);

      // Replays of an already-signed request skip straight to the detail page.
      if (created.status !== "DRAFT") {
        router.push(`/app/invoices/${created.id}`);
        return;
      }

      update("sign", "active");
      const signature = await signTypedDataJson(walletAddress as Hex, created.typedData);
      update("sign", "done");

      update("record", "active");
      await liveApi.signInvoice(created.id, signature);
      update("record", "done");

      update("verify", "active");
      const run = await liveApi.verifyInvoice(created.id);
      update("verify", run.decision === "FAIL" ? "error" : "done", `Backend decision: ${run.decision}`);

      router.push(`/app/invoices/${created.id}`);
    } catch (err) {
      const active = s.find((x) => x.state === "active");
      if (active) update(active.key, "error", errorMessage(err));
      setSubmitError(err);
      setSubmitting(false);
      // The draft exists once creation succeeded; its detail page offers sign / verify retries.
      if (invoiceId) router.push(`/app/invoices/${invoiceId}`);
    }
  }

  const idempotencyConflict = submitError instanceof LiveApiError && submitError.code === "IDEMPOTENCY_KEY_REUSED";
  const deliveryNet = findNetwork(deliveryChainId);

  return (
    <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-7 space-y-6">
        <Panel>
          <PanelHeader title="Buyer" description="Only this wallet will be able to view, verify and pay the invoice." />
          <PanelBody className="space-y-4">
            <Field label="Buyer wallet" htmlFor="buyer" error={show("buyer")}>
              <Input id="buyer" value={buyer} onChange={(e) => setBuyer(e.target.value.trim())} placeholder="0x…" autoComplete="off" disabled={submitting} />
            </Field>
            <Field label="Buyer reference" htmlFor="buyerRef" error={show("buyerRef")} hint="Free text such as a PO number. Its hash is part of the signed terms.">
              <Input id="buyerRef" value={buyerRef} onChange={(e) => setBuyerRef(e.target.value)} maxLength={255} disabled={submitting} />
            </Field>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Service: EVM address analytics" description={`Deterministic report (${SERVICE_TYPE_ADDRESS_ANALYTICS}, acceptance ${ACCEPTANCE_POLICY_EXACT}) that HashX recomputes independently from chain data.`} />
          <PanelBody className="space-y-4">
            <Field label="Delivery chain" htmlFor="deliveryChain" hint="The chain the analytics report is computed from and verified against.">
              <Select id="deliveryChain" className="w-full" value={deliveryChainId} onChange={(e) => setDeliveryChainId(Number(e.target.value))} disabled={submitting}>
                {DELIVERY_NETWORKS.map((n) => (
                  <option key={n.chainId} value={n.chainId}>
                    {n.name} ({n.chainId})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subject address" htmlFor="subject" error={show("subject")}>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value.trim())} placeholder="0x…" autoComplete="off" disabled={submitting} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Start block" htmlFor="startBlock" error={show("startBlock")}>
                <Input id="startBlock" inputMode="numeric" value={startBlock} onChange={(e) => setStartBlock(e.target.value.trim())} disabled={submitting} />
              </Field>
              <Field label="End block" htmlFor="endBlock" error={show("endBlock")} hint={`Inclusive. At most ${MAX_BLOCK_RANGE} blocks.`}>
                <Input id="endBlock" inputMode="numeric" value={endBlock} onChange={(e) => setEndBlock(e.target.value.trim())} disabled={submitting} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" size="sm" onClick={fillRecentBlocks} isLoading={recentLoading} disabled={submitting}>
                <History className="w-3.5 h-3.5" />
                Use recent blocks
              </Button>
              <span className="text-2xs text-foreground-muted">
                Reads the latest block of {deliveryNet?.shortName ?? "the chain"} from its public RPC; sets end = latest − 12 and a 10-block range.
              </span>
            </div>
            {recentError && <p className="text-2xs text-danger">{recentError}</p>}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Payment terms" description="Settlement happens only after delivery is independently verified and the buyer approves in two stages." />
          <PanelBody className="space-y-4">
            <Field label="Settlement rail" htmlFor="rail" hint="HashKey Settlement Protocol (HSP) is not connected in this deployment, so it cannot be selected.">
              <Select id="rail" className="w-full" value="sepolia-usdc" onChange={() => undefined} disabled={submitting}>
                <option value="sepolia-usdc">Sepolia Test USDC (direct transfer)</option>
                <option value="hashkey-hsp" disabled>
                  HashKey HSP — not connected (unavailable)
                </option>
              </Select>
            </Field>
            <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-secondary">
              Settles on {SEPOLIA.shortName} <TestnetBadge chainId={SEPOLIA_CHAIN_ID} />
            </div>
            <Field
              label="Amount (Test USDC)"
              htmlFor="amount"
              error={show("amount")}
              hint={amountPreview ? `= ${amountPreview} raw units (6 decimals) · ${formatTokenAmount(amountPreview, USDC_DECIMALS)} Test USDC` : "Decimal amount, up to 6 decimal places."}
            >
              <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.trim())} placeholder="2.5" disabled={submitting} />
            </Field>
            <Field label="Payee" htmlFor="payee" error={show("payee")} hint="Defaults to your connected wallet.">
              <Input id="payee" value={payee} onChange={(e) => setPayee(e.target.value.trim())} autoComplete="off" disabled={submitting} />
            </Field>
            <Field label="Expires in (hours)" htmlFor="expiry" error={show("expiry")}>
              <Input id="expiry" inputMode="numeric" value={expiryHours} onChange={(e) => setExpiryHours(e.target.value.trim())} disabled={submitting} />
            </Field>
          </PanelBody>
        </Panel>
      </div>

      <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-20">
        <Panel>
          <PanelHeader title="Summary" icon={<FileSignature />} />
          <PanelBody>
            <DataList dense>
              <DataRow label="Seller (you)" mono>{walletAddress}</DataRow>
              <DataRow label="Network">Sepolia Testnet</DataRow>
              <DataRow label="Token">Test USDC · {SEPOLIA.settlementToken!.address}</DataRow>
              <DataRow label="Amount">{amountPreview ? `${formatTokenAmount(amountPreview, USDC_DECIMALS)} Test USDC` : "—"}</DataRow>
              <DataRow label="Client request ID" mono>{clientRequestId}</DataRow>
            </DataList>
          </PanelBody>
          <PanelBody className="border-t border-border">
            <StepList steps={steps} />
          </PanelBody>
          <PanelFooter className="space-y-3">
            {touched && !valid && <p className="text-2xs text-danger">Fix the highlighted fields before submitting.</p>}
            {submitError !== null && (
              <LiveError
                error={submitError}
                title="Invoice was not created"
              />
            )}
            {idempotencyConflict && (
              <Callout tone="warning" title="Request ID already used with different terms">
                This form session already created an invoice with other terms. Start a new request to create a separate invoice.
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setClientRequestId(newClientRequestId());
                      setSubmitError(null);
                      setSteps(INITIAL_STEPS);
                    }}
                  >
                    Start new request
                  </Button>
                </div>
              </Callout>
            )}
            <Button type="submit" className="w-full" isLoading={submitting}>
              Create, sign and verify
            </Button>
            <p className="text-2xs text-foreground-muted leading-relaxed">
              Your wallet will ask you to sign typed data on Sepolia Testnet. Signing commits the invoice terms; it does not move funds. If you reject the signature the draft remains and can be signed from its page.
            </p>
          </PanelFooter>
        </Panel>
      </div>
    </form>
  );
}
