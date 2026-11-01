"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ShieldCheck,
  Sparkles,
  Info,
  AlertCircle,
  FileText,
  Lock,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import { MOCK_COUNTERPARTIES } from "@/mocks/fixtures";
import { Button } from "@/components/ui/Button";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { formatAddress, parseUsdToMinor } from "@/lib/formatters";
import { computeServiceTermsHash, stringToBytes32 } from "@/lib/crypto/eip712";

export default function CreateInvoicePage() {
  const router = useRouter();
  const { mode, chainId, triggerRefresh } = useApp();
  const client = mode === "connected" ? connectedClient : demoClient;

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [selectedSellerId, setSelectedSellerId] = useState(MOCK_COUNTERPARTIES[0].id);
  const [buyerRef, setBuyerRef] = useState("buyer-job-audit-hsk-" + Math.floor(100 + Math.random() * 900));

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

  const handleCreateAndSign = async (simulate: boolean) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

      const created = await client.createInvoice({
        seller_counterparty_id: selectedSeller.id,
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

      // Sign the invoice
      await client.signInvoice({
        invoice_id: created.id,
        signer: selectedSeller.walletAddress,
      });

      triggerRefresh();
      router.push(`/app/invoices/${created.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create invoice";
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Link href="/app/invoices">
            <Button variant="ghost" size="icon" aria-label="Back to Invoices">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">
              Compose Commercial Invoice
            </h1>
            <p className="text-xs text-foreground-secondary">
              Step-by-step EIP-712 structured agreement for HashKey Chain.
            </p>
          </div>
        </div>
      </div>

      {/* Stepper Progress */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { num: 1, label: "Counterparties" },
          { num: 2, label: "Service Params" },
          { num: 3, label: "Commercial Terms" },
          { num: 4, label: "Review & Sign" },
        ].map((s) => (
          <div
            key={s.num}
            className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 transition-all ${
              currentStep === s.num
                ? "border-primary bg-primary-subtle/30 text-white"
                : currentStep > s.num
                ? "border-success/40 bg-success/10 text-success"
                : "border-border bg-surface-1 text-foreground-muted"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[11px] font-bold ${
                currentStep > s.num
                  ? "bg-success text-black"
                  : currentStep === s.num
                  ? "bg-primary text-white"
                  : "bg-surface-3 text-foreground-muted"
              }`}
            >
              {currentStep > s.num ? <Check className="w-3 h-3" /> : s.num}
            </span>
            <span className="font-medium truncate">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Step Container */}
      <div className="p-6 rounded-xl border border-border bg-surface-1 shadow-sm space-y-5">
        {/* Step 1: Counterparties */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary-light" />
              <span>Step 1 — Counterparty Identity Binding</span>
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Registered Seller Counterparty
              </label>
              <select
                value={selectedSellerId}
                onChange={(e) => handleSellerChange(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-surface-2 border border-border text-foreground text-xs font-mono focus:outline-none focus:border-primary"
              >
                {MOCK_COUNTERPARTIES.filter((c) => c.status === "ACTIVE").map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName} ({formatAddress(c.walletAddress)})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-foreground-muted">
                Seller wallet identity is bound to a registered counterparty record to prevent unauthorized seller impersonation.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Seller Wallet (Authorized EOA)
              </label>
              <input
                type="text"
                disabled
                value={selectedSeller.walletAddress}
                className="w-full p-2.5 rounded-lg bg-surface-3/50 border border-border text-foreground-secondary text-xs font-mono cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Buyer Reference Identifier
              </label>
              <input
                type="text"
                value={buyerRef}
                onChange={(e) => setBuyerRef(e.target.value)}
                placeholder="e.g. buyer-job-ref-12345"
                className="w-full p-2.5 rounded-lg bg-surface-2 border border-border text-foreground text-xs font-mono focus:outline-none focus:border-primary"
              />
              <p className="text-[11px] text-foreground-muted">
                Will be hashed into <code>buyerRefHash</code> on the canonical EIP-712 structured agreement.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Service */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary-light" />
              <span>Step 2 — Locked Service Definition</span>
            </h3>

            <div className="p-3 rounded-lg bg-surface-2 border border-border text-xs text-foreground-secondary space-y-1">
              <div className="font-mono text-primary-light font-semibold">
                Service Type: hsk_address_analytics_v1
              </div>
              <p className="text-[11px] text-foreground-muted">
                Objective digital deliverable: The seller produces on-chain transaction metrics on HashKey Chain for a target address across a declared block range. Acceptance policy: <code>analytics_v1</code>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Target Address on HashKey Chain
              </label>
              <input
                type="text"
                value={targetAddress}
                onChange={(e) => setTargetAddress(e.target.value)}
                placeholder="0x..."
                className="w-full p-2.5 rounded-lg bg-surface-2 border border-border text-foreground text-xs font-mono focus:outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Start Block Number
                </label>
                <input
                  type="text"
                  value={startBlock}
                  onChange={(e) => setStartBlock(e.target.value)}
                  placeholder="1205000"
                  className="w-full p-2.5 rounded-lg bg-surface-2 border border-border text-foreground text-xs font-mono focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  End Block Number
                </label>
                <input
                  type="text"
                  value={endBlock}
                  onChange={(e) => setEndBlock(e.target.value)}
                  placeholder="1205250"
                  className="w-full p-2.5 rounded-lg bg-surface-2 border border-border text-foreground text-xs font-mono focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Commercial Terms */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary-light" />
              <span>Step 3 — Commercial & Payment Terms</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Amount (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted font-mono text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.10"
                    value={dollarInput}
                    onChange={(e) => setDollarInput(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-surface-2 border border-border text-foreground text-sm font-mono focus:outline-none focus:border-primary"
                  />
                </div>
                <p className="text-[11px] font-mono text-foreground-muted">
                  Serialized minor units: <code>{amountMinor}</code> (cents)
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Settlement Network
                </label>
                <select
                  value={preferredChainId}
                  onChange={(e) => setPreferredChainId(parseInt(e.target.value, 10))}
                  className="w-full p-2.5 rounded-lg bg-surface-2 border border-border text-foreground text-xs font-mono focus:outline-none focus:border-primary"
                >
                  <option value={133}>HashKey Chain Testnet (133)</option>
                  <option value={177}>HashKey Chain Mainnet (177)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Payee Wallet Address (Recipient of HSP Settlement)
              </label>
              <input
                type="text"
                value={payeeAddress}
                onChange={(e) => setPayeeAddress(e.target.value as `0x${string}`)}
                placeholder="0x..."
                className="w-full p-2.5 rounded-lg bg-surface-2 border border-border text-foreground text-xs font-mono focus:outline-none focus:border-primary"
              />
              <p className="text-[11px] text-foreground-muted">
                Must match the signed EIP-712 payee parameter. Changing this post-signature produces <code>SIGNATURE_INVALID</code>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Validity Window (Days)
              </label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value, 10))}
                className="w-full p-2.5 rounded-lg bg-surface-2 border border-border text-foreground text-xs font-mono focus:outline-none focus:border-primary"
              >
                <option value={1}>1 Day</option>
                <option value={3}>3 Days</option>
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 4: Review and Sign */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-success" />
              <span>Step 4 — Review Commercial Agreement & Sign</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-1">
                <span className="text-[11px] uppercase font-mono text-foreground-muted">Seller</span>
                <div className="font-medium text-foreground">{selectedSeller.displayName}</div>
                <div className="font-mono text-foreground-secondary">{formatAddress(selectedSeller.walletAddress)}</div>
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-1">
                <span className="text-[11px] uppercase font-mono text-foreground-muted">Payee & Amount</span>
                <AmountDisplay amountMinor={amountMinor} size="md" />
                <div className="font-mono text-foreground-secondary">{formatAddress(payeeAddress)}</div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-1 text-xs">
              <span className="text-[11px] uppercase font-mono text-foreground-muted">Service Parameters</span>
              <div className="font-mono text-foreground">
                Address: {targetAddress}
              </div>
              <div className="font-mono text-foreground-secondary">
                Block Range: {startBlock} to {endBlock} ({parseInt(endBlock, 10) - parseInt(startBlock, 10)} blocks)
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-surface-2/60 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-foreground-secondary font-medium">
                  EIP-712 Typed Structured Data Preview
                </span>
                <span className="text-[11px] font-mono text-primary-light">
                  PrimaryType: HashXInvoice
                </span>
              </div>
              <pre className="text-[11px] font-mono text-foreground-secondary max-h-40 overflow-y-auto scrollbar-thin p-2 rounded bg-surface-1">
                {JSON.stringify(
                  {
                    seller: selectedSeller.walletAddress,
                    buyerRefHash: "0x...",
                    serviceType: stringToBytes32("hsk_address_analytics_v1"),
                    serviceTermsHash: computeServiceTermsHash(targetAddress as `0x${string}`, startBlock, endBlock),
                    amountMinor: amountMinor,
                    currency: stringToBytes32("USD"),
                    payee: payeeAddress,
                    paymentChainId: preferredChainId,
                    nonce: "1006",
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            <div className="p-3 rounded-lg bg-primary-subtle/30 border border-primary/30 text-xs text-primary-light">
              <span className="font-medium">Signature Notice: </span>
              In Demo Mode, a simulated EIP-712 signature matching the registered seller wallet will be recorded. Once signed, the invoice terms become immutable.
            </div>
          </div>
        )}

        {/* Nav Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          {currentStep > 1 ? (
            <Button variant="secondary" size="sm" onClick={handleBack} disabled={isSubmitting}>
              Back
            </Button>
          ) : (
            <div />
          )}

          {currentStep < 4 ? (
            <Button variant="primary" size="sm" onClick={handleNext} className="gap-1.5">
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={() => handleCreateAndSign(true)}
              isLoading={isSubmitting}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Create & Sign Invoice</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
