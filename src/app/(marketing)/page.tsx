"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Coins,
  CheckCircle2,
  Lock,
  ArrowRight,
  Terminal,
  FileText,
  Clock,
  Sparkles,
  ChevronRight,
  Layers,
  Check,
  Code,
  ExternalLink,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { CodeViewer } from "@/components/ui/CodeViewer";

export default function MarketingHomePage() {
  const [activeStep, setActiveStep] = useState<number>(3); // Default to fulfillment verification

  const workflowSteps = [
    {
      num: 1,
      title: "Seller Agent",
      role: "Propose & Sign",
      desc: "Issues structured invoice signed with EIP-712 from authorized wallet.",
    },
    {
      num: 2,
      title: "Invoice Checks",
      role: "Validate Integrity",
      desc: "Recomputes EIP-712 digest, checks signer binding, nonce replay, and expiration.",
    },
    {
      num: 3,
      title: "Fulfillment Verifier",
      role: "Deterministic RPC",
      desc: "Recomputes telemetry data against HashKey Chain RPC. Prevents fraudulent claims.",
    },
    {
      num: 4,
      title: "Human Authorization",
      role: "Two-Stage Approval",
      desc: "Human verifies exact raw amount, payer, payee, and quote expiry before wallet signing.",
    },
    {
      num: 5,
      title: "HSP Settlement",
      role: "Agentic Payment Rail",
      desc: "Executes on-chain payment on HashKey Chain with strict safe vs finalized distinction.",
    },
    {
      num: 6,
      title: "Verifiable Receipt",
      role: "Auditable Commitment",
      desc: "Irreversible receipt binding invoice, fulfillment telemetry, and settlement tx.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary-subtle selection:text-primary-light">
      {/* Navigation */}
      <header className="h-20 border-b border-border/80 bg-background/80 backdrop-blur-md sticky top-0 z-40 px-6 sm:px-12 flex items-center justify-between">
        <Logo />

        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-foreground-secondary">
          <a href="#how-it-works" className="hover:text-foreground transition-colors">
            How It Works
          </a>
          <a href="#pillars" className="hover:text-foreground transition-colors">
            Architecture
          </a>
          <a href="#developers" className="hover:text-foreground transition-colors">
            Developers (MCP)
          </a>
          <Link href="/app/demo" className="hover:text-foreground transition-colors">
            Demo Center
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/app">
            <Button variant="primary" size="sm" className="gap-2">
              <span>Launch App</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 px-6 sm:px-12 overflow-hidden border-b border-border/60">
        {/* Subtle Violet Atmospheric Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-primary/15 blur-[140px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          {/* Left Column: Storytelling */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-2 border border-border text-[11px] font-mono text-primary-light">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>AGENTIC COMMERCE INFRASTRUCTURE</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-display font-bold tracking-tight text-foreground leading-[1.1]">
              The Trust Layer for <br />
              <span className="bg-gradient-to-r from-white via-foreground to-primary-light bg-clip-text text-transparent">
                Agentic Commerce.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-foreground-secondary max-w-xl leading-relaxed">
              An AI agent should not pay another agent simply because it receives a payment request. HashX verifies commercial intent, validates objective fulfillment, authorizes exact payments, and reconciles HSP settlement on HashKey Chain.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/app">
                <Button variant="primary" size="lg" className="gap-2 text-sm shadow-xl">
                  <span>Launch HashX Platform</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>

              <Link href="/app/demo">
                <Button variant="secondary" size="lg" className="gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-primary-light" />
                  <span>Guided Demo Center</span>
                </Button>
              </Link>
            </div>

            {/* Value Indicators */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border/60 max-w-lg text-xs font-mono">
              <div>
                <span className="text-foreground font-bold block text-sm">EIP-712</span>
                <span className="text-foreground-muted">Cryptographic Invoices</span>
              </div>
              <div>
                <span className="text-foreground font-bold block text-sm">Deterministic</span>
                <span className="text-foreground-muted">RPC Fulfillment Checks</span>
              </div>
              <div>
                <span className="text-foreground font-bold block text-sm">Two-Stage</span>
                <span className="text-foreground-muted">Human Approvals</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Live Verification Flow Preview */}
          <div className="lg:col-span-5">
            <div className="p-6 rounded-2xl border border-border bg-surface-1 shadow-2xl space-y-4 relative">
              <div className="flex items-center justify-between pb-3 border-b border-border text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-success" />
                  <span className="font-mono text-foreground font-semibold">Active Trust Verification</span>
                </div>
                <span className="font-mono text-[11px] text-foreground-muted">HashKey Chain (133)</span>
              </div>

              {/* Live Flow Steps */}
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-surface-2 border border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span className="font-mono text-foreground">Signed Invoice Authenticated</span>
                  </div>
                  <span className="font-mono text-[11px] text-success font-semibold">PASS</span>
                </div>

                <div className="p-3 rounded-xl bg-surface-2 border border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span className="font-mono text-foreground">Telemetry Recomputation Valid</span>
                  </div>
                  <span className="font-mono text-[11px] text-success font-semibold">14 TXS</span>
                </div>

                <div className="p-3 rounded-xl bg-primary-subtle/30 border border-primary/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-primary-light" />
                    <span className="font-mono text-foreground font-medium">Human Authorization Confirmed</span>
                  </div>
                  <span className="font-mono text-[11px] text-primary-light font-bold">1.00 USDT</span>
                </div>

                <div className="p-3 rounded-xl bg-surface-2 border border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <Coins className="w-4 h-4 text-success" />
                    <span className="font-mono text-foreground">HSP Rail Reconciled</span>
                  </div>
                  <span className="font-mono text-[11px] text-success font-semibold">FINALIZED</span>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between text-xs font-mono">
                <span className="text-foreground-muted">Proof Digest:</span>
                <span className="text-primary-light">0x5a6b...a6b7</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Verification Sequence */}
      <section id="how-it-works" className="py-20 px-6 sm:px-12 bg-surface-1/40 border-b border-border/60">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-primary-light">
              Protocol Lifecycle
            </span>
            <h2 className="text-3xl font-display font-bold text-foreground">
              Verification Before Payment
            </h2>
            <p className="text-xs sm:text-sm text-foreground-secondary leading-relaxed">
              Every stage of the agent commerce lifecycle produces immutable cryptographic proofs before financial authorization can proceed.
            </p>
          </div>

          {/* Stepper Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {workflowSteps.map((step) => {
              const isSelected = activeStep === step.num;
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => setActiveStep(step.num)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "border-primary bg-surface-2 shadow-lg ring-1 ring-primary"
                      : "border-border bg-surface-1 hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-surface-3 font-mono text-xs font-bold flex items-center justify-center text-primary-light">
                      {step.num}
                    </span>
                    <span className="text-[10px] font-mono text-foreground-muted uppercase">
                      {step.role}
                    </span>
                  </div>
                  <div className="font-semibold text-xs text-foreground">{step.title}</div>
                  <p className="text-[11px] text-foreground-secondary mt-1 line-clamp-2">
                    {step.desc}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Expanded Step Detail Box */}
          <div className="p-6 rounded-2xl border border-border bg-surface-1 shadow-sm">
            <div className="max-w-3xl space-y-2">
              <span className="text-xs font-mono text-primary-light font-semibold uppercase">
                Stage {activeStep} Detail — {workflowSteps[activeStep - 1].title}
              </span>
              <h3 className="text-lg font-bold text-foreground">
                {workflowSteps[activeStep - 1].role}
              </h3>
              <p className="text-xs sm:text-sm text-foreground-secondary leading-relaxed">
                {workflowSteps[activeStep - 1].desc}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Problem vs Solution Comparison Section */}
      <section className="py-20 px-6 sm:px-12 border-b border-border/60">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl font-display font-bold text-foreground">
              A payment request isn't proof of a fulfilled agreement.
            </h2>
            <p className="text-xs sm:text-sm text-foreground-secondary leading-relaxed">
              In autonomous commerce, relying on simple checkout redirects or unauthenticated requests leads to critical security vulnerabilities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Unsafe Commerce */}
            <div className="p-6 sm:p-8 rounded-2xl border border-danger/30 bg-danger/5 space-y-4">
              <div className="flex items-center gap-2 text-danger font-semibold text-sm">
                <ShieldAlert className="w-5 h-5" />
                <span>Unsafe Naive Agent Spending</span>
              </div>

              <ul className="space-y-3 text-xs text-foreground-secondary">
                <li className="flex items-start gap-2">
                  <span className="text-danger font-bold">✕</span>
                  <span><strong>Payee Substitution:</strong> Prompt injection alters payee address in flight.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-danger font-bold">✕</span>
                  <span><strong>Faked Delivery:</strong> Agents claim completion without verifiable telemetry proofs.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-danger font-bold">✕</span>
                  <span><strong>Replay / Double Spend:</strong> Network retries create multiple duplicate checkout orders.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-danger font-bold">✕</span>
                  <span><strong>Premature Finality:</strong> Unconfirmed transactions marked final prematurely.</span>
                </li>
              </ul>
            </div>

            {/* HashX Verification First */}
            <div className="p-6 sm:p-8 rounded-2xl border border-success/30 bg-success/5 space-y-4">
              <div className="flex items-center gap-2 text-success font-semibold text-sm">
                <ShieldCheck className="w-5 h-5" />
                <span>HashX Verification-First Standard</span>
              </div>

              <ul className="space-y-3 text-xs text-foreground-secondary">
                <li className="flex items-start gap-2">
                  <span className="text-success font-bold">✓</span>
                  <span><strong>EIP-712 Domain Separation:</strong> Altered payee triggers <code>SIGNATURE_INVALID</code>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success font-bold">✓</span>
                  <span><strong>Deterministic RPC Verifier:</strong> Recomputes metrics directly on HashKey Chain.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success font-bold">✓</span>
                  <span><strong>Idempotency Invariant:</strong> Existing payment attempt returned; zero duplicate orders.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success font-bold">✓</span>
                  <span><strong>HSP Finality Reconciler:</strong> Strict distinction between <code>payment-safe</code> and <code>finalized</code>.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Core Pillars */}
      <section id="pillars" className="py-20 px-6 sm:px-12 bg-surface-1/30 border-b border-border/60">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-primary-light">
              Core Architecture
            </span>
            <h2 className="text-3xl font-display font-bold text-foreground">
              Built on Three Uncompromising Pillars
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-border bg-surface-1 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-primary-light font-mono font-bold">
                01
              </div>
              <h3 className="text-lg font-bold text-foreground">Verify</h3>
              <p className="text-xs text-foreground-secondary leading-relaxed">
                Cryptographic invoice authentication using EIP-712 domain separation, seller counterparty resolution, and deterministic fulfillment verification against HashKey Chain RPC.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-surface-1 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-primary-light font-mono font-bold">
                02
              </div>
              <h3 className="text-lg font-bold text-foreground">Authorize</h3>
              <p className="text-xs text-foreground-secondary leading-relaxed">
                Human-controlled authorization of exact payment terms. Full visibility of raw token amounts, payee address, merchant attribution, and quote expiration before signing.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-surface-1 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-primary-light font-mono font-bold">
                03
              </div>
              <h3 className="text-lg font-bold text-foreground">Settle</h3>
              <p className="text-xs text-foreground-secondary leading-relaxed">
                HSP payment rail settlement with 15-second status polling, verified finality, timeout recovery, and immutable evidence commitments on HashKey Chain.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Developer / MCP Section */}
      <section id="developers" className="py-20 px-6 sm:px-12 border-b border-border/60">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-primary-light">
              <Terminal className="w-4 h-4" />
              <span>MODEL CONTEXT PROTOCOL (MCP)</span>
            </div>
            <h2 className="text-3xl font-display font-bold text-foreground">
              First-Class Tooling for AI Agents
            </h2>
            <p className="text-xs sm:text-sm text-foreground-secondary leading-relaxed">
              Integrate HashX directly into your autonomous agents via standardized MCP Streamable HTTP interfaces.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border bg-surface-1">
            <CodeViewer
              title="Agent MCP Tool Call Example: verify_invoice"
              data={{
                tool: "verify_invoice",
                arguments: {
                  invoice_id: "inv-golden-path-scenario-d",
                  expected_seller_id: "cp-seller-01",
                  expected_buyer_ref: "buyer-job-audit-hashkey-104",
                },
                result: {
                  decision: "PASS",
                  checks: {
                    schema: "PASS",
                    signature: "PASS",
                    identity_binding: "PASS",
                    expiry: "PASS",
                    nonce_unused: "PASS",
                    terms_consistent: "PASS",
                  },
                  invoice_digest: "0x5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b",
                },
              }}
              maxHeight="max-h-72"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 sm:px-12 bg-surface-1 border-t border-border text-xs text-foreground-secondary">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <Logo />

          <div className="flex items-center gap-6 text-xs font-mono">
            <Link href="/app" className="hover:text-foreground transition-colors">
              App
            </Link>
            <Link href="/app/invoices" className="hover:text-foreground transition-colors">
              Invoices
            </Link>
            <Link href="/app/trust" className="hover:text-foreground transition-colors">
              Trust Inspector
            </Link>
            <Link href="/app/settlements" className="hover:text-foreground transition-colors">
              Settlements
            </Link>
            <Link href="/app/developers" className="hover:text-foreground transition-colors">
              MCP Tools
            </Link>
            <Link href="/app/demo" className="text-primary-light hover:underline font-semibold">
              Demo Center
            </Link>
          </div>

          <div className="text-[11px] text-foreground-muted font-mono">
            HashKey Chain • EVM Chain ID 133 / 177
          </div>
        </div>
      </footer>
    </div>
  );
}
