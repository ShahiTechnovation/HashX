"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  AlertOctagon,
  Copy,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Coins,
  Lock,
  FileText,
  Clock,
  Terminal,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient } from "@/lib/api/client";
import {
  FIXTURE_INVOICE_TAMPERED,
  FIXTURE_INVOICE_FAKE_DELIVERY,
  FIXTURE_DELIVERY_FAKE_COUNT,
  FIXTURE_INVOICE_REPLAY,
  FIXTURE_PAYMENT_ATTEMPT_EXISTING,
  FIXTURE_INVOICE_GOLDEN,
} from "@/mocks/fixtures";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { formatAddress } from "@/lib/formatters";

export default function DemoCenterPage() {
  const { mode, triggerRefresh } = useApp();
  const [activeTab, setActiveTab] = useState<"A" | "B" | "C" | "D">("A");

  // State for Scenario C interactive test
  const [duplicateAttemptsTriggered, setDuplicateAttemptsTriggered] = useState(1);
  const [duplicateResult, setDuplicateResult] = useState<string | null>(null);

  const handleTestDuplicatePayment = async () => {
    try {
      const attempt = await demoClient.requestPayment({
        invoice_id: FIXTURE_INVOICE_REPLAY.id,
        payer: "0x1234567890123456789012345678901234567890",
      });
      setDuplicateAttemptsTriggered((c) => c + 1);
      setDuplicateResult(
        `Idempotency invariant enforced: Returned existing payment attempt ID "${attempt.id}" (Flow: ${attempt.flowId}). Zero duplicate HSP orders were created.`
      );
    } catch (err: unknown) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
              Guided Demonstration Center
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-primary/20 text-primary-light border border-primary/40 font-semibold">
              HACKATHON-READY
            </span>
          </div>
          <p className="text-xs text-foreground-secondary mt-1">
            Deterministic proofs of HashX's core thesis: 3 adversarial failure scenarios plus the full golden path.
          </p>
        </div>

        <div className="px-3 py-1.5 rounded-lg bg-surface-2 border border-primary/30 text-xs font-mono text-primary-light flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>DEMO MODE — SIMULATED DATA</span>
        </div>
      </div>

      {/* Scenario Selector Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {[
          {
            id: "A" as const,
            title: "Scenario A",
            subtitle: "Tampered Invoice",
            badge: "SIGNATURE_INVALID",
            color: "border-danger/40 text-danger",
          },
          {
            id: "B" as const,
            title: "Scenario B",
            subtitle: "Fake Fulfillment",
            badge: "TX_COUNT_MISMATCH",
            color: "border-danger/40 text-danger",
          },
          {
            id: "C" as const,
            title: "Scenario C",
            subtitle: "Duplicate Replay",
            badge: "IDEMPOTENT RACE",
            color: "border-warning/40 text-warning",
          },
          {
            id: "D" as const,
            title: "Scenario D",
            subtitle: "Golden Path",
            badge: "VERIFIED & SETTLED",
            color: "border-success/40 text-success",
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              activeTab === tab.id
                ? "bg-surface-2 border-primary shadow-[0_0_20px_rgba(130,56,232,0.15)] ring-1 ring-primary"
                : "bg-surface-1 border-border hover:border-border-strong hover:bg-surface-hover"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-xs text-foreground">{tab.title}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border bg-surface-3 ${tab.color}`}>
                {tab.badge}
              </span>
            </div>
            <div className="text-xs text-foreground-secondary">{tab.subtitle}</div>
          </button>
        ))}
      </div>

      {/* Active Scenario Card */}
      <div className="p-6 rounded-2xl border border-border bg-surface-1 shadow-lg space-y-6">
        {/* Scenario A: Tampered Invoice */}
        {activeTab === "A" && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-start justify-between pb-4 border-b border-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-danger" />
                  <h3 className="text-base font-semibold text-foreground">
                    Scenario A: Invoice Payee Tampering Attack
                  </h3>
                </div>
                <p className="text-xs text-foreground-secondary">
                  A seller agent signed a $1.00 agreement with payee wallet A. In flight, the payee address is altered to attacker wallet B.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded text-xs font-mono bg-danger/20 text-danger border border-danger/40 font-bold">
                ATTACK BLOCKED
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-2">
                <span className="text-[11px] text-foreground-muted uppercase block">Original Signed Payee (Wallet A)</span>
                <span className="text-foreground">{formatAddress("0x742d35Cc6634C0532925a3b844Bc454e4438f44e", 6)}</span>
                <div className="text-[11px] text-foreground-secondary font-sans">
                  The seller authorized structured data committing to this exact destination.
                </div>
              </div>

              <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 space-y-2">
                <span className="text-[11px] text-danger uppercase block">Mutated Attacker Payee (Wallet B)</span>
                <span className="text-danger font-bold">{formatAddress("0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe", 6)}</span>
                <div className="text-[11px] text-danger/80 font-sans">
                  Payment destination substituted before buyer payment execution.
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-2 border border-border text-xs space-y-2">
              <span className="font-semibold text-foreground block font-mono">
                Deterministic Verifier Result:
              </span>
              <p className="text-foreground-secondary leading-relaxed">
                HashX recomputes the canonical EIP-712 digest across all signed fields. Because <code>payee</code> was altered, <code>ecRecover</code> produces a signer address mismatch.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <span className="font-mono text-danger font-bold">
                  Decision: FAIL / SIGNATURE_INVALID
                </span>
                <span className="font-mono text-foreground-muted">
                  • <code>request_payment</code> action strictly inaccessible
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Link href={`/app/trust/${FIXTURE_INVOICE_TAMPERED.id}`}>
                <Button variant="primary" size="sm" className="gap-2">
                  <span>Open in Trust Inspector</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Scenario B: Fake Fulfillment */}
        {activeTab === "B" && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-start justify-between pb-4 border-b border-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-danger" />
                  <h3 className="text-base font-semibold text-foreground">
                    Scenario B: Fraudulent Fulfillment Delivery (Transaction Count Mismatch)
                  </h3>
                </div>
                <p className="text-xs text-foreground-secondary">
                  The seller signs and delivers a JSON report claiming 23 transactions on HashKey Chain for the requested block range.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded text-xs font-mono bg-danger/20 text-danger border border-danger/40 font-bold">
                DELIVERY REJECTED
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-2">
                <span className="text-[11px] text-foreground-muted uppercase block">Seller's Delivery Claim</span>
                <div className="text-lg font-bold text-foreground">23 Transactions</div>
                <div className="text-[11px] text-foreground-secondary font-sans">
                  Stated in <code>hashx.analytics.v1</code> deliverable and signed manifest.
                </div>
              </div>

              <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 space-y-2">
                <span className="text-[11px] text-danger uppercase block">Actual HashKey Chain RPC Recomputation</span>
                <div className="text-lg font-bold text-danger">17 Transactions</div>
                <div className="text-[11px] text-danger/80 font-sans">
                  Independent RPC query recomputed across blocks 1201000..1201500.
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-2 border border-border text-xs space-y-2">
              <span className="font-semibold text-foreground block font-mono">
                Deterministic Verifier Result:
              </span>
              <p className="text-foreground-secondary leading-relaxed">
                HashX independently queries HashKey Chain RPC (chain ID 133) and verifies the factual telemetry. The claimed count does not match on-chain truth.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <span className="font-mono text-danger font-bold">
                  Decision: FAIL / TX_COUNT_MISMATCH
                </span>
                <span className="font-mono text-foreground-muted">
                  • Delivery rejected, payment ineligible
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Link href={`/app/trust/${FIXTURE_INVOICE_FAKE_DELIVERY.id}`}>
                <Button variant="primary" size="sm" className="gap-2">
                  <span>Open in Trust Inspector</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Scenario C: Duplicate Payment Replay */}
        {activeTab === "C" && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-start justify-between pb-4 border-b border-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5 text-warning" />
                  <h3 className="text-base font-semibold text-foreground">
                    Scenario C: Concurrent Duplicate Payment Request Race
                  </h3>
                </div>
                <p className="text-xs text-foreground-secondary">
                  An automated buyer bot or flaky connection repeatedly invokes <code>request_payment</code> against an invoice that already has an active order.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded text-xs font-mono bg-warning/20 text-warning border border-warning/40 font-bold">
                IDEMPOTENCY INVARIANT
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-2 border border-border text-xs space-y-3 font-mono">
              <div className="flex justify-between text-foreground-secondary">
                <span>Target Invoice:</span>
                <span className="text-foreground font-bold">{FIXTURE_INVOICE_REPLAY.id}</span>
              </div>
              <div className="flex justify-between text-foreground-secondary">
                <span>Existing Active Attempt:</span>
                <span className="text-foreground">{FIXTURE_PAYMENT_ATTEMPT_EXISTING.id}</span>
              </div>
              <div className="flex justify-between text-foreground-secondary">
                <span>Existing HSP Flow ID:</span>
                <span className="text-primary-light font-bold">{FIXTURE_PAYMENT_ATTEMPT_EXISTING.flowId}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-2 border border-border text-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-foreground block">
                    Interactive Idempotency Simulator
                  </span>
                  <span className="text-foreground-secondary text-[11px]">
                    Click below to trigger repeated payment requests against this invoice.
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleTestDuplicatePayment}
                  className="gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Call request_payment (#{duplicateAttemptsTriggered})</span>
                </Button>
              </div>

              {duplicateResult && (
                <div className="p-3 rounded-lg bg-surface-3 border border-success/30 text-success text-xs font-mono animate-fade-in">
                  {duplicateResult}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Link href={`/app/settlements/${FIXTURE_PAYMENT_ATTEMPT_EXISTING.id}`}>
                <Button variant="secondary" size="sm" className="gap-2">
                  <span>View Existing Settlement Order</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Scenario D: Golden Path */}
        {activeTab === "D" && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-start justify-between pb-4 border-b border-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-success" />
                  <h3 className="text-base font-semibold text-foreground">
                    Scenario D: Complete Golden Path (Verified Agentic Purchase)
                  </h3>
                </div>
                <p className="text-xs text-foreground-secondary">
                  The full end-to-end commerce lifecycle: intent, EIP-712 signature, fulfillment verification, two-stage human authorization, HSP settlement, and verifiable receipt.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded text-xs font-mono bg-success/20 text-success border border-success/40 font-bold">
                100% RECONCILED
              </span>
            </div>

            {/* 14 Step Lifecycle Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
              {[
                { step: 1, title: "Buyer Agent Requests Analytics", status: "PASS" },
                { step: 2, title: "Seller Creates Structured Invoice", status: "PASS" },
                { step: 3, title: "Seller Signs Invoice via EIP-712", status: "PASS" },
                { step: 4, title: "Seller Submits Deliverable & Manifest", status: "PASS" },
                { step: 5, title: "HashX Verifies Cryptographic Terms", status: "PASS" },
                { step: 6, title: "HashX Deterministically Verifies RPC", status: "PASS" },
                { step: 7, title: "Payment Eligibility Unlocked", status: "PASS" },
                { step: 8, title: "HSP Payment Prepared & Quoted", status: "PASS" },
                { step: 9, title: "Human Stage 1: Approves Exact Terms", status: "PASS" },
                { step: 10, title: "Wallet Signs Exact HSP EIP-712 Payload", status: "PASS" },
                { step: 11, title: "Human Stage 2: Approves Submission", status: "PASS" },
                { step: 12, title: "Payment Broadcast to HashKey Chain", status: "PASS" },
                { step: 13, title: "HSP Settlement Finalized (Irreversible)", status: "PASS" },
                { step: 14, title: "Verifiable Receipt Committed On-Chain", status: "PASS" },
              ].map((s) => (
                <div
                  key={s.step}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-surface-2 border border-border"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    <span className="text-foreground">
                      {s.step}. {s.title}
                    </span>
                  </div>
                  <span className="text-[10px] text-success font-bold">PASS</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-xs text-foreground-muted font-mono">
                Settled on HashKey Chain Testnet (133)
              </span>
              <div className="flex items-center gap-2">
                <Link href={`/app/invoices/${FIXTURE_INVOICE_GOLDEN.id}`}>
                  <Button variant="secondary" size="sm">
                    View Invoice
                  </Button>
                </Link>
                <Link href="/app/receipts/rcpt-golden-001">
                  <Button variant="primary" size="sm" className="gap-2">
                    <span>Inspect Golden Receipt</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
