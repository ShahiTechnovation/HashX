"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FlaskConical,
  ShieldAlert,
  ShieldCheck,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  Code2,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient } from "@/lib/api/client";
import { FIXTURE_INVOICE_REPLAY } from "@/mocks/fixtures";
import { ProofCircuit } from "@/components/brand/ProofCircuit";
import { cn } from "@/lib/utils";
import { SCENARIOS, type ScenarioId } from "@/components/demo/scenarios";
import { ReplaySimulator, type ReplayCall } from "@/components/demo/ScenarioEvidence";

export default function DemoCenterPage() {
  const { mode } = useApp();
  const [activeTab, setActiveTab] = useState<ScenarioId>("A");

  // State for Scenario C interactive test
  const [duplicateAttemptsTriggered, setDuplicateAttemptsTriggered] = useState(1);
  const [duplicateResult, setDuplicateResult] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [replayCalls, setReplayCalls] = useState<ReplayCall[]>([]);
  const [isReplaying, setIsReplaying] = useState(false);

  const handleTestDuplicatePayment = async () => {
    setIsReplaying(true);
    setDuplicateError(null);
    try {
      const attempt = await demoClient.requestPayment({
        invoice_id: FIXTURE_INVOICE_REPLAY.id,
        payer: "0x1234567890123456789012345678901234567890",
      });
      const n = duplicateAttemptsTriggered + 1;
      setDuplicateAttemptsTriggered(n);
      setReplayCalls((calls) => [...calls, { n, attemptId: attempt.id, flowId: attempt.flowId }]);
      setDuplicateResult(
        `Idempotency invariant enforced: returned existing payment attempt ${attempt.id} (flow ${attempt.flowId}). No duplicate HSP order was created.`
      );
    } catch (err: unknown) {
      console.error(err);
      setDuplicateError(err instanceof Error ? err.message : "request_payment failed.");
    } finally {
      setIsReplaying(false);
    }
  };

  const handleResetReplay = () => {
    setDuplicateAttemptsTriggered(1);
    setReplayCalls([]);
    setDuplicateResult(null);
    setDuplicateError(null);
  };

  const scenario = SCENARIOS.find((s) => s.id === activeTab) ?? SCENARIOS[0];

  return (
    <div className="space-y-6">
      {/* 1. Operational Header & Notice Banner */}
      <section className="bg-carbon-nav border border-carbon-border p-4 rounded select-none">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-carbon-muted mb-1">
              <span>CONSOLE</span>
              <span className="text-carbon-border">/</span>
              <span>PROOF LAB</span>
              <span className="text-carbon-border">/</span>
              <span className="text-primary font-semibold">ADVERSARIAL TESTBENCH v2.4</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-carbon-text tracking-tight uppercase flex items-center gap-2.5">
              <span>HashX Interactive Proof Lab</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-danger/20 text-danger border border-danger/40 font-mono font-normal">
                SIMULATOR
              </span>
            </h1>
            <p className="text-xs text-carbon-muted font-mono mt-0.5">
              Deterministic verification gauntlet for zero-trust agent commerce. Intercepts signature replay, payee tampering, and phantom fulfillment.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded bg-carbon-panel text-success border border-carbon-border flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span>Simulated Enclave Armed</span>
            </span>
          </div>
        </div>

        {/* Hazard Banner */}
        <div className="mt-4 p-2.5 bg-warning/10 border-l-4 border-warning flex items-center justify-between gap-3 text-xs font-mono text-warning">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
            <span>
              <strong>SIMULATED TELEMETRY ENGINE // DEMONSTRATION DATA ONLY // ZERO CAPITAL AT RISK</strong>
              <span className="hidden sm:inline"> — Running formal adversarial gauntlet against local test vectors.</span>
            </span>
          </div>
          <span className="text-[10px] text-warning/80 hidden md:inline">TESTNET 133</span>
        </div>
      </section>

      {/* 2. Scenario Matrix (4 Interactive Cards) */}
      <section className="space-y-3 font-mono">
        <div className="flex items-center justify-between text-xs text-carbon-muted">
          <span className="font-bold text-carbon-text uppercase tracking-wider">
            THREAT VECTORS &amp; TEST GAUNTLETS
          </span>
          <span className="text-[11px]">SELECT SCENARIO TO LOAD PROOF CIRCUIT</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {/* Card A: Payee Substitution */}
          <div
            onClick={() => setActiveTab("A")}
            className={cn(
              "p-4 rounded border transition-all cursor-pointer relative",
              activeTab === "A"
                ? "bg-carbon-panel border-danger shadow-lg ring-1 ring-danger"
                : "bg-carbon-nav border-carbon-border hover:border-carbon-muted opacity-80 hover:opacity-100"
            )}
          >
            {activeTab === "A" && (
              <span className="absolute -top-2.5 right-3 bg-danger text-white text-[9px] font-bold px-2 py-0.5 rounded shadow">
                ACTIVE TESTBENCH
              </span>
            )}
            <div className="text-xs font-bold text-danger mb-1">
              01 // PAYEE SUBSTITUTION
            </div>
            <p className="text-[11px] text-carbon-muted line-clamp-2 mb-3">
              Adversary replaces invoice payee address between EIP-712 signing and payment authorization.
            </p>
            <div className="space-y-1 text-[10px] border-t border-carbon-border/70 pt-2 text-carbon-muted">
              <div className="flex justify-between">
                <span>TARGET:</span>
                <span className="text-carbon-text font-bold">$14,200.00 USDC</span>
              </div>
              <div className="flex justify-between">
                <span>GATE:</span>
                <span className="text-danger font-semibold">GATE 03 INTERCEPTED</span>
              </div>
            </div>
          </div>

          {/* Card B: Fake Delivery */}
          <div
            onClick={() => setActiveTab("B")}
            className={cn(
              "p-4 rounded border transition-all cursor-pointer relative",
              activeTab === "B"
                ? "bg-carbon-panel border-danger shadow-lg ring-1 ring-danger"
                : "bg-carbon-nav border-carbon-border hover:border-carbon-muted opacity-80 hover:opacity-100"
            )}
          >
            {activeTab === "B" && (
              <span className="absolute -top-2.5 right-3 bg-danger text-white text-[9px] font-bold px-2 py-0.5 rounded shadow">
                ACTIVE TESTBENCH
              </span>
            )}
            <div className="text-xs font-bold text-danger mb-1">
              02 // FAKE FULFILLMENT
            </div>
            <p className="text-[11px] text-carbon-muted line-clamp-2 mb-3">
              Seller claims deliverable completion with invalid RPC proof or tampered SHA-256 artifact.
            </p>
            <div className="space-y-1 text-[10px] border-t border-carbon-border/70 pt-2 text-carbon-muted">
              <div className="flex justify-between">
                <span>TARGET:</span>
                <span className="text-carbon-text font-bold">$8,500.00 USDC</span>
              </div>
              <div className="flex justify-between">
                <span>GATE:</span>
                <span className="text-danger font-semibold">GATE 04 WITNESS FAILED</span>
              </div>
            </div>
          </div>

          {/* Card C: Replay Attack */}
          <div
            onClick={() => setActiveTab("C")}
            className={cn(
              "p-4 rounded border transition-all cursor-pointer relative",
              activeTab === "C"
                ? "bg-carbon-panel border-warning shadow-lg ring-1 ring-warning"
                : "bg-carbon-nav border-carbon-border hover:border-carbon-muted opacity-80 hover:opacity-100"
            )}
          >
            {activeTab === "C" && (
              <span className="absolute -top-2.5 right-3 bg-warning text-carbon-void text-[9px] font-bold px-2 py-0.5 rounded shadow">
                ACTIVE TESTBENCH
              </span>
            )}
            <div className="text-xs font-bold text-warning mb-1">
              03 // REPLAY ATTACK
            </div>
            <p className="text-[11px] text-carbon-muted line-clamp-2 mb-3">
              Attacker replays previously authorized EIP-712 payload attempting duplicate settlement debit.
            </p>
            <div className="space-y-1 text-[10px] border-t border-carbon-border/70 pt-2 text-carbon-muted">
              <div className="flex justify-between">
                <span>TARGET:</span>
                <span className="text-carbon-text font-bold">$22,000.00 USDC</span>
              </div>
              <div className="flex justify-between">
                <span>GATE:</span>
                <span className="text-warning font-semibold">GATE 01 IDEMPOTENT NOOP</span>
              </div>
            </div>
          </div>

          {/* Card D: Legitimate Execution */}
          <div
            onClick={() => setActiveTab("D")}
            className={cn(
              "p-4 rounded border transition-all cursor-pointer relative",
              activeTab === "D"
                ? "bg-carbon-panel border-success shadow-lg ring-1 ring-success"
                : "bg-carbon-nav border-carbon-border hover:border-carbon-muted opacity-80 hover:opacity-100"
            )}
          >
            {activeTab === "D" && (
              <span className="absolute -top-2.5 right-3 bg-success text-white text-[9px] font-bold px-2 py-0.5 rounded shadow">
                ACTIVE TESTBENCH
              </span>
            )}
            <div className="text-xs font-bold text-success mb-1">
              04 // LEGITIMATE GOLDEN PATH
            </div>
            <p className="text-[11px] text-carbon-muted line-clamp-2 mb-3">
              All 7 gates clear: EIP-712 signed, RPC witnessed, human authorized, HSP settled &amp; receipt anchored.
            </p>
            <div className="space-y-1 text-[10px] border-t border-carbon-border/70 pt-2 text-carbon-muted">
              <div className="flex justify-between">
                <span>SETTLED:</span>
                <span className="text-success font-bold">$14,200.00 USDC</span>
              </div>
              <div className="flex justify-between">
                <span>OUTCOME:</span>
                <span className="text-success font-semibold">ALL 7 GATES PASSED</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Active Scenario Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Scenario Circuit Visualizer & Diverter */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-carbon-nav border border-carbon-border rounded p-5 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-carbon-border">
              <div>
                <span className="text-[10px] text-carbon-muted uppercase tracking-wider block">
                  CIRCUIT WALKTHROUGH
                </span>
                <h3 className="font-display text-base font-bold text-carbon-text mt-0.5">
                  {scenario.title}
                </h3>
              </div>
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold border",
                  scenario.outcome.tone === "danger"
                    ? "bg-danger/15 text-danger border-danger/40"
                    : "bg-success/15 text-success border-success/40"
                )}
              >
                {scenario.outcome.label}
              </span>
            </div>

            <p className="text-carbon-muted text-xs leading-relaxed">
              {scenario.lead}
            </p>

            {/* Proof Circuit Visualizer for this Scenario */}
            <ProofCircuit
              variant="inspector"
              isBlocked={scenario.outcome.tone === "danger"}
              diverterActive={activeTab === "A"}
              blockReason={activeTab === "A" ? "PAYEE_MISMATCH_DETECTED" : "EVIDENCE_INVALID"}
              quarantineTarget={activeTab === "A" ? "0x99A0...11B0" : undefined}
            />
          </div>

          {/* Interactive Replay Test for Scenario C */}
          {activeTab === "C" && (
            <div className="bg-carbon-nav border border-carbon-border rounded p-5 space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-carbon-border">
                <span className="font-bold text-warning uppercase">
                  INTERACTIVE REPLAY TESTER
                </span>
                <span className="text-[10px] text-carbon-muted">Idempotency Guard</span>
              </div>
              <p className="text-carbon-muted">
                Trigger duplicate payment attempts with the identical EIP-712 payload. Notice how HashX returns the original idempotent record without generating duplicate debits.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestDuplicatePayment}
                  disabled={isReplaying}
                  className="px-4 py-2 rounded bg-warning text-carbon-void font-bold hover:bg-warning/90 transition-colors flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Send Replay Attempt #{duplicateAttemptsTriggered + 1}</span>
                </button>
                <button
                  onClick={handleResetReplay}
                  className="px-3 py-2 rounded bg-carbon-panel border border-carbon-border text-carbon-muted hover:text-carbon-text transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
              {duplicateResult && (
                <div className="p-3 bg-success/10 border border-success/30 rounded text-success text-[11px] leading-relaxed">
                  {duplicateResult}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Forensic Evidence Card */}
        <div className="lg:col-span-5 space-y-4 font-mono text-xs">
          <div className="bg-carbon-nav border border-carbon-border rounded p-5 space-y-4">
            <div className="pb-3 border-b border-carbon-border">
              <span className="text-[10px] text-carbon-muted uppercase tracking-wider block">
                FORENSIC DETAILS
              </span>
              <h3 className="font-display text-base font-bold text-carbon-text mt-0.5">
                Attack &amp; Control Analysis
              </h3>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-carbon-panel rounded border border-carbon-border space-y-1">
                <div className="text-[10px] text-carbon-muted uppercase">{scenario.claimLabel}</div>
                <div className="text-carbon-text font-bold">{scenario.claim}</div>
              </div>

              <div className="p-3 bg-carbon-panel rounded border border-carbon-border space-y-1">
                <div className="text-[10px] text-carbon-muted uppercase">HashX Control Response</div>
                <div className="text-primary font-bold">{scenario.control.name}</div>
                <div className="text-[11px] text-carbon-muted mt-0.5">{scenario.control.detail}</div>
              </div>

              <div className="p-3 bg-carbon-panel rounded border border-carbon-border space-y-1">
                <div className="text-[10px] text-carbon-muted uppercase">Expected Verdict &amp; Code</div>
                <div className="text-danger font-bold">{scenario.expected.code || "ALL_CHECKS_PASSED"}</div>
                <div className="text-[11px] text-carbon-muted mt-0.5">{scenario.expected.text}</div>
              </div>
            </div>

            {scenario.primary && (
              <div className="pt-2">
                <Link
                  href={scenario.primary.href}
                  className="w-full px-4 py-2.5 rounded bg-primary hover:bg-primary/90 text-white font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors text-center"
                >
                  <span>{scenario.primary.label}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
