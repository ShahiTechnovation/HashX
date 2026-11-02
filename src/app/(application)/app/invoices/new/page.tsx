"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Lock, PenLine, FileSignature } from "lucide-react";
import { keccak256, toBytes, createWalletClient, custom } from "viem";
import { useApp } from "@/providers/AppContext";
import { LiveInvoiceCreate } from "@/components/live/invoices/LiveInvoiceCreate";
import { demoClient, connectedClient } from "@/lib/api/client";
import { MOCK_COUNTERPARTIES } from "@/mocks/fixtures";
import { Button, buttonStyles } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader, PanelFooter } from "@/components/ui/Panel";
import { DataList, DataRow } from "@/components/ui/DataList";
import { Field, Input, Select } from "@/components/ui/Field";
import { Callout } from "@/components/ui/Callout";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { InvoiceStepper, type StepDef } from "@/components/invoices/InvoiceStepper";
import { blockSpan, chainLabel } from "@/components/invoices/utils";
import { cn } from "@/lib/utils";
import { formatAddress, formatMinorToUsd, parseUsdToMinor } from "@/lib/formatters";
import {
  computeServiceTermsHash,
  stringToBytes32,
  HASHX_EIP712_DOMAIN,
  HASHX_EIP712_TYPES,
  buildInvoiceEIP712Message,
} from "@/lib/crypto/eip712";

const STEPS: Array<StepDef & { title: string; description: string }> = [
  {
    num: 1,
    label: "Counterparties",
    hint: "Seller & buyer",
    title: "Counterparty identity binding",
    description: "The seller wallet is bound to a registered counterparty record so the signature can be attributed.",
  },
  {
    num: 2,
    label: "Service",
    hint: "Objective deliverable",
    title: "Locked service definition",
    description: "Define an objective, machine-verifiable deliverable. These parameters are hashed into the signed terms.",
  },
  {
    num: 3,
    label: "Terms",
    hint: "Amount & payee",
    title: "Commercial and payment terms",
    description: "Amounts are serialized as integer minor units. The payee is committed under the seller signature.",
  },
  {
    num: 4,
    label: "Review & sign",
    hint: "EIP-712",
    title: "Review and sign",
    description: "Once signed, the invoice terms are immutable. Any change produces a different digest.",
  },
];

function DemoCreateInvoicePage() {
  const router = useRouter();
  const { mode, triggerRefresh, walletAddress, isWalletConnected, connectWallet } = useApp();
  const client = mode === "connected" ? connectedClient : demoClient;

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [selectedSellerId, setSelectedSellerId] = useState(MOCK_COUNTERPARTIES[0].id);
  const [buyerRef, setBuyerRef] = useState("");
  // Random default is generated after mount so server and client render the same markup (avoids a hydration mismatch).
  useEffect(() => {
    setBuyerRef((prev) => prev || "buyer-job-audit-hsk-" + Math.floor(100 + Math.random() * 900));
  }, []);

  // Service params
  const [targetAddress, setTargetAddress] = useState("0x0B306BF915C4d645ff596e518fAf3F9669b97016");
  const [startBlock, setStartBlock] = useState("1205000");
  const [endBlock, setEndBlock] = useState("1205250");

  // Commercial terms
  const [dollarInput, setDollarInput] = useState("1.00");
  const [payeeAddress, setPayeeAddress] = useState<`0x${string}`>(MOCK_COUNTERPARTIES[0].walletAddress);
  const [preferredChainId, setPreferredChainId] = useState(133);
  const [expiresInDays, setExpiresInDays] = useState(7);

  const selectedSeller = MOCK_COUNTERPARTIES.find((c) => c.id === selectedSellerId) || MOCK_COUNTERPARTIES[0];

  // Update payee if seller changes and payee matches old seller
  const handleSellerChange = (id: string) => {
    setSelectedSellerId(id);
    const seller = MOCK_COUNTERPARTIES.find((c) => c.id === id);
    if (seller) setPayeeAddress(seller.walletAddress);
  };

  const amountMinor = parseUsdToMinor(dollarInput);
  const span = blockSpan(startBlock, endBlock);

  // Validation
  const validateStep = (step: number): boolean => {
    setErrorMessage(null);
    if (step === 1) {
      if (!selectedSellerId) {
        setErrorMessage("Please select a registered seller counterparty.");
        return false;
      }
      if (!buyerRef.trim()) {
        setErrorMessage("Buyer reference is required.");
        return false;
      }
    } else if (step === 2) {
      if (!targetAddress.startsWith("0x") || targetAddress.length !== 42) {
        setErrorMessage("Valid 42-character EVM target address required.");
        return false;
      }
      const start = parseInt(startBlock, 10);
      const end = parseInt(endBlock, 10);
      if (isNaN(start) || isNaN(end) || start >= end) {
        setErrorMessage("Start block must be strictly less than end block.");
        return false;
      }
    } else if (step === 3) {
      if (parseInt(amountMinor, 10) <= 0) {
        setErrorMessage("Invoice amount must be greater than $0.00.");
        return false;
      }
      if (!payeeAddress.startsWith("0x") || payeeAddress.length !== 42) {
        setErrorMessage("Valid payee wallet address required.");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setErrorMessage(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  /** Jump back to an already-completed step (no validation needed when moving backwards). */
  const goToStep = (step: number) => {
    if (step >= currentStep || isSubmitting) return;
    setErrorMessage(null);
    setCurrentStep(step);
  };

  const handleCreateAndSign = async (simulate: boolean) => {
    void simulate;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (mode === "connected") {
        if (!isWalletConnected || !walletAddress) {
          throw new Error("Wallet not connected. Connect your seller EIP-1193 wallet to sign this invoice.");
        }
        if (typeof window === "undefined" || !(window as any).ethereum) {
          throw new Error("No EIP-1193 browser wallet detected.");
        }
      }

      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

      const sellerWalletToBind =
        mode === "connected" && walletAddress ? walletAddress : selectedSeller.walletAddress;

      const created = await client.createInvoice({
        seller_counterparty_id: selectedSeller.id,
        seller_wallet: sellerWalletToBind,
        buyer_ref: buyerRef,
        service: {
          type: "hsk_address_analytics_v1",
          parameters: {
            address: targetAddress as `0x${string}`,
            start_block: startBlock,
            end_block: endBlock,
          },
          acceptance_policy: "analytics_v1",
        },
        payment: {
          currency: "USD",
          amount_minor: amountMinor,
          payee: payeeAddress as `0x${string}`,
          preferred_chain_id: preferredChainId,
        },
        expires_at: expiresAt,
      });

      if (mode === "connected") {
        // Real EIP-712 wallet signature via viem
        const walletClient = createWalletClient({
          transport: custom((window as any).ethereum),
        });

        const activeSigner = walletAddress as `0x${string}`;
        const signature = await walletClient.signTypedData({
          account: activeSigner,
          domain: {
            ...HASHX_EIP712_DOMAIN,
            chainId: preferredChainId,
          },
          types: HASHX_EIP712_TYPES,
          primaryType: "HashXInvoice",
          message: buildInvoiceEIP712Message(created),
        });

        await client.signInvoice({
          invoice_id: created.id,
          signer: activeSigner,
          signature,
        });
      } else {
        // Demo Mode deterministic signing
        await client.signInvoice({
          invoice_id: created.id,
          signer: selectedSeller.walletAddress,
        });
      }

      triggerRefresh();
      router.push(`/app/invoices/${created.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create invoice";
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  // Live EIP-712 message preview. Hashing helpers throw on malformed input,
  // so each derived field degrades to a placeholder rather than breaking render.
  const typedMessage = useMemo(() => {
    const safe = <T,>(fn: () => T, fallback: string): T | string => {
      try {
        return fn();
      } catch {
        return fallback;
      }
    };
    return {
      seller: selectedSeller.walletAddress,
      buyerRefHash: buyerRef.trim() ? safe(() => keccak256(toBytes(buyerRef)), "<invalid>") : "<required>",
      serviceType: stringToBytes32("hsk_address_analytics_v1"),
      serviceTermsHash: safe(
        () => computeServiceTermsHash(targetAddress as `0x${string}`, startBlock, endBlock),
        "<invalid subject address>"
      ),
      amountMinor: amountMinor,
      currency: stringToBytes32("USD"),
      payee: payeeAddress,
      paymentChainId: preferredChainId,
      nonce: "<assigned at creation>",
    };
  }, [selectedSeller.walletAddress, buyerRef, targetAddress, startBlock, endBlock, amountMinor, payeeAddress, preferredChainId]);

  const step = STEPS[currentStep - 1];
  const payeeIsSeller = payeeAddress.toLowerCase() === selectedSeller.walletAddress.toLowerCase();

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/app/invoices", label: "Invoices" }}
        eyebrow="New invoice"
        title="Compose invoice"
        description="Bind seller identity, an objective service definition, and payment terms into one EIP-712 structured agreement on HashKey Chain."
        className="pb-0"
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ── Composer ─────────────────────────────────────────────── */}
        <Panel className="xl:col-span-7 min-w-0">
          <div className="px-4 sm:px-6 py-4 border-b border-border overflow-x-auto">
            <InvoiceStepper steps={STEPS} current={currentStep} onSelect={goToStep} className="sm:min-w-[520px]" />
          </div>

          <div className="px-4 sm:px-6 pt-6 pb-8">
            <div className="mb-6">
              <div className="text-xs text-foreground-muted tabular-nums">
                Step {currentStep} of {STEPS.length}
              </div>
              <h2 className="mt-1.5 text-[20px] font-semibold text-foreground tracking-[-0.022em]">{step.title}</h2>
              <p className="mt-1.5 text-[13px] text-foreground-secondary leading-relaxed max-w-xl">{step.description}</p>
            </div>

            {errorMessage && (
              <Callout tone="danger" className="mb-5 animate-fade-in">
                {errorMessage}
              </Callout>
            )}

            {/* Step 1: Counterparties */}
            {currentStep === 1 && (
              <div className="space-y-5 animate-fade-in">
                <Field
                  label="Seller counterparty"
                  htmlFor="seller"
                  hint="Only active, registered counterparties can issue invoices. This prevents seller impersonation."
                >
                  <Select id="seller" value={selectedSellerId} onChange={(e) => handleSellerChange(e.target.value)} className="w-full">
                    {MOCK_COUNTERPARTIES.filter((c) => c.status === "ACTIVE").map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName} ({formatAddress(c.walletAddress)})
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Seller wallet" htmlFor="seller-wallet" hint="Authorized EOA. The EIP-712 signature must recover to this address.">
                  <Input
                    id="seller-wallet"
                    type="text"
                    disabled
                    value={selectedSeller.walletAddress}
                    className="font-mono text-xs"
                  />
                </Field>

                <Field
                  label="Buyer reference"
                  htmlFor="buyer-ref"
                  hint={
                    <>
                      Hashed into <code className="font-mono">buyerRefHash</code> on the signed structured agreement.
                    </>
                  }
                >
                  <Input
                    id="buyer-ref"
                    type="text"
                    value={buyerRef}
                    onChange={(e) => setBuyerRef(e.target.value)}
                    placeholder="buyer-job-ref-12345"
                    className="font-mono text-xs"
                  />
                </Field>
              </div>
            )}

            {/* Step 2: Service */}
            {currentStep === 2 && (
              <div className="space-y-5 animate-fade-in">
                <div className="panel-inset px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-foreground-muted">Service type</span>
                    <span className="inline-flex items-center gap-1 text-xs text-foreground-muted">
                      <Lock className="w-3 h-3" aria-hidden="true" />
                      Fixed
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-foreground">hsk_address_analytics_v1</div>
                  <p className="mt-2 text-xs text-foreground-muted leading-relaxed">
                    The seller produces on-chain transaction metrics for a subject address across a declared block range. Accepted under policy{" "}
                    <code className="font-mono text-foreground-secondary">analytics_v1</code>.
                  </p>
                </div>

                <Field label="Subject address on HashKey Chain" htmlFor="target-address" hint="42-character EVM address. Recomputed by the verifier against RPC.">
                  <Input
                    id="target-address"
                    type="text"
                    value={targetAddress}
                    onChange={(e) => setTargetAddress(e.target.value)}
                    placeholder="0x…"
                    className="font-mono text-xs"
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Start block" htmlFor="start-block">
                    <Input
                      id="start-block"
                      type="text"
                      inputMode="numeric"
                      value={startBlock}
                      onChange={(e) => setStartBlock(e.target.value)}
                      placeholder="1205000"
                      className="font-mono text-xs tabular-nums"
                    />
                  </Field>
                  <Field
                    label="End block"
                    htmlFor="end-block"
                    hint={span !== null && span > 0 ? <span className="tabular-nums">{span.toLocaleString("en-US")} blocks in range</span> : undefined}
                  >
                    <Input
                      id="end-block"
                      type="text"
                      inputMode="numeric"
                      value={endBlock}
                      onChange={(e) => setEndBlock(e.target.value)}
                      placeholder="1205250"
                      className="font-mono text-xs tabular-nums"
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* Step 3: Commercial Terms */}
            {currentStep === 3 && (
              <div className="space-y-5 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label="Amount (USD)"
                    htmlFor="amount"
                    hint={
                      <>
                        Serialized as <span className="font-mono text-foreground-secondary tabular-nums">{amountMinor}</span> minor units (cents)
                      </>
                    }
                  >
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-foreground-muted pointer-events-none">$</span>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0.10"
                        value={dollarInput}
                        onChange={(e) => setDollarInput(e.target.value)}
                        className="pl-6 tabular-nums"
                      />
                    </div>
                  </Field>

                  <Field label="Settlement network" htmlFor="chain">
                    <Select
                      id="chain"
                      value={preferredChainId}
                      onChange={(e) => setPreferredChainId(parseInt(e.target.value, 10))}
                      className="w-full"
                    >
                      <option value={133}>HashKey Chain Testnet (133)</option>
                      <option value={177}>HashKey Chain Mainnet (177)</option>
                    </Select>
                  </Field>
                </div>

                <Field
                  label="Payee wallet"
                  htmlFor="payee"
                  hint={
                    <>
                      Recipient of HSP settlement. Changing this after signing produces{" "}
                      <code className="font-mono text-foreground-secondary">SIGNATURE_INVALID</code>.
                    </>
                  }
                >
                  <Input
                    id="payee"
                    type="text"
                    value={payeeAddress}
                    onChange={(e) => setPayeeAddress(e.target.value as `0x${string}`)}
                    placeholder="0x…"
                    className="font-mono text-xs"
                  />
                </Field>

                <Field label="Validity window" htmlFor="validity" hint="The invoice cannot be verified or paid after it expires.">
                  <Select
                    id="validity"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(parseInt(e.target.value, 10))}
                    className="w-full sm:w-56"
                  >
                    <option value={1}>1 day</option>
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                  </Select>
                </Field>
              </div>
            )}

            {/* Step 4: Review and Sign */}
            {currentStep === 4 && (
              <div className="space-y-5 animate-fade-in">
                <div className="panel-inset px-4 py-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs text-foreground-muted">Seller requests</div>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-[32px] leading-none font-medium tracking-[-0.03em] tabular-nums text-foreground">
                        {formatMinorToUsd(amountMinor)}
                      </span>
                      <span className="text-[13px] text-foreground-muted">USD</span>
                    </div>
                    <div className="mt-2 font-mono text-xs text-foreground-muted tabular-nums">amount_minor {amountMinor}</div>
                  </div>
                  <div className="text-[13px] text-foreground-secondary sm:text-right">
                    <div className="font-medium text-foreground">{selectedSeller.displayName}</div>
                    <div className="mt-0.5 text-xs text-foreground-muted">
                      pays to <span className="font-mono">{formatAddress(payeeAddress)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-border divide-y divide-border bg-surface-1">
                  <ReviewRow
                    label="Counterparties"
                    onEdit={() => goToStep(1)}
                    summary={
                      <>
                        {selectedSeller.displayName}
                        <span className="text-foreground-muted"> → </span>
                        <span className="font-mono text-xs">{buyerRef}</span>
                      </>
                    }
                  />
                  <ReviewRow
                    label="Service"
                    onEdit={() => goToStep(2)}
                    summary={
                      <>
                        <span className="font-mono text-xs">{formatAddress(targetAddress)}</span>
                        <span className="text-foreground-muted"> · blocks </span>
                        <span className="font-mono text-xs tabular-nums">
                          {startBlock}–{endBlock}
                        </span>
                        {span !== null && <span className="text-foreground-muted tabular-nums"> ({span.toLocaleString("en-US")})</span>}
                      </>
                    }
                  />
                  <ReviewRow
                    label="Terms"
                    onEdit={() => goToStep(3)}
                    summary={
                      <>
                        <span className="tabular-nums">{formatMinorToUsd(amountMinor)}</span>
                        <span className="text-foreground-muted"> · {chainLabel(preferredChainId)} · valid {expiresInDays}d</span>
                      </>
                    }
                  />
                </div>

                <Callout tone="neutral" icon={FileSignature} title="Signature">
                  {mode === "demo"
                    ? "In demo mode, a simulated EIP-712 signature from the registered seller wallet is recorded. Once signed, the invoice terms become immutable."
                    : "The connected backend records the seller wallet's EIP-712 signature. Once signed, the invoice terms become immutable."}
                </Callout>
              </div>
            )}
          </div>

          {/* Nav Controls */}
          <PanelFooter className="flex items-center justify-between gap-3">
            {currentStep > 1 ? (
              <Button variant="secondary" size="md" onClick={handleBack} disabled={isSubmitting}>
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </Button>
            ) : (
              <Link href="/app/invoices" className={buttonStyles({ variant: "ghost", size: "md" })}>
                Cancel
              </Link>
            )}

            {currentStep < STEPS.length ? (
              <Button variant="primary" size="md" onClick={handleNext}>
                Continue
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button variant="primary" size="md" onClick={() => handleCreateAndSign(true)} isLoading={isSubmitting}>
                {!isSubmitting && <FileSignature className="w-3.5 h-3.5" />}
                Create &amp; sign invoice
              </Button>
            )}
          </PanelFooter>
        </Panel>

        {/* ── Live preview ─────────────────────────────────────────── */}
        <aside className="xl:col-span-5 min-w-0 space-y-4 xl:sticky xl:top-6">
          <Panel>
            <PanelHeader
              title="Invoice preview"
              description="Structured record as it will be signed."
              actions={<StatusBadge status="DRAFT" type="invoice" size="sm" />}
            />
            <div className="divide-y divide-border">
              <PreviewGroup title="Parties" active={currentStep === 1}>
                <DataRow label="Seller">{selectedSeller.displayName}</DataRow>
                <DataRow label="Seller wallet" mono>
                  {formatAddress(selectedSeller.walletAddress, 6)}
                </DataRow>
                <DataRow label="Buyer ref" mono>
                  {buyerRef || <Missing />}
                </DataRow>
              </PreviewGroup>

              <PreviewGroup title="Service" active={currentStep === 2}>
                <DataRow label="Type" mono>
                  hsk_address_analytics_v1
                </DataRow>
                <DataRow label="Subject" mono>
                  {targetAddress ? formatAddress(targetAddress, 6) : <Missing />}
                </DataRow>
                <DataRow label="Block range">
                  <span className="font-mono text-xs tabular-nums">
                    {startBlock || "—"} → {endBlock || "—"}
                  </span>
                  {span !== null && span > 0 && (
                    <span className="block text-xs text-foreground-muted mt-0.5 tabular-nums">{span.toLocaleString("en-US")} blocks</span>
                  )}
                </DataRow>
                <DataRow label="Policy" mono>
                  analytics_v1
                </DataRow>
              </PreviewGroup>

              <PreviewGroup title="Payment" active={currentStep === 3}>
                <DataRow label="Amount">
                  <span className="tabular-nums">{formatMinorToUsd(amountMinor)}</span>
                  <span className="text-xs text-foreground-muted"> USD</span>
                  <span className="block font-mono text-xs text-foreground-muted mt-0.5 tabular-nums">{amountMinor} minor units</span>
                </DataRow>
                <DataRow label="Payee">
                  <span className="font-mono text-xs">{payeeAddress ? formatAddress(payeeAddress, 6) : <Missing />}</span>
                  <span className="block text-xs text-foreground-muted mt-0.5">
                    {payeeIsSeller ? "Seller wallet" : "Differs from seller wallet"}
                  </span>
                </DataRow>
                <DataRow label="Chain">
                  {chainLabel(preferredChainId)}
                  <span className="font-mono text-xs text-foreground-muted tabular-nums"> · {preferredChainId}</span>
                </DataRow>
                <DataRow label="Validity">
                  <span className="tabular-nums">{expiresInDays}</span> {expiresInDays === 1 ? "day" : "days"} from signing
                </DataRow>
              </PreviewGroup>
            </div>
          </Panel>

          <CodeViewer
            title="EIP-712 message · HashXInvoice"
            data={typedMessage}
            maxHeight="max-h-72"
            className={cn(currentStep === 4 && "ring-1 ring-inset ring-border-strong")}
            actions={
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-foreground-muted pr-1">
                <PenLine className="w-3 h-3" aria-hidden="true" />
                Live
              </span>
            }
          />
        </aside>
      </div>
    </div>
  );
}

function PreviewGroup({ title, active, children }: { title: string; active: boolean; children: React.ReactNode }) {
  return (
    <section className={cn("relative px-4 sm:px-5 py-4 transition-colors duration-200", active && "bg-primary-subtle/40")}>
      {active && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-primary" />}
      <div className={cn("eyebrow mb-3", active && "text-foreground")}>{title}</div>
      <DataList dense>{children}</DataList>
    </section>
  );
}

function ReviewRow({ label, summary, onEdit }: { label: string; summary: React.ReactNode; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-4 px-4 py-3">
      <span className="w-28 shrink-0 pt-0.5 text-xs text-foreground-muted">{label}</span>
      <span className="flex-1 min-w-0 break-words text-[13px] leading-relaxed text-foreground">{summary}</span>
      <Button variant="ghost" size="xs" onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}

function Missing() {
  return <span className="font-sans text-xs text-warning">Required</span>;
}

export default function CreateInvoicePage() {
  const { mode } = useApp();
  return mode === "connected" ? <LiveInvoiceCreate /> : <DemoCreateInvoicePage />;
}
