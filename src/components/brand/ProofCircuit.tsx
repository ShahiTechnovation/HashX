"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  FileSignature,
  FileCheck2,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Check,
  X,
  Clock,
  Layers,
  FileText,
  AlertTriangle,
} from "lucide-react";

export type CircuitGateState =
  | "inactive"
  | "pending"
  | "verified"
  | "blocked"
  | "awaiting_approval"
  | "submitted"
  | "safe"
  | "finalized";

export interface CircuitGate {
  id: string;
  name: string;
  code: string;
  state: CircuitGateState;
  detail?: string;
  hash?: string;
  timestamp?: string;
  count?: number;
}

export interface ProofCircuitProps {
  variant?: "marketing" | "pipeline" | "inspector" | "settlement" | "demo";
  activeGateId?: string;
  isBlocked?: boolean;
  diverterActive?: boolean;
  blockReason?: string;
  quarantineTarget?: string;
  gates?: CircuitGate[];
  pipelineCounts?: {
    issued?: number;
    verified?: number;
    authorized?: number;
    inFlight?: number;
    settled?: number;
    blocked?: number;
  };
  onGateSelect?: (gateId: string) => void;
  className?: string;
}

/**
 * The Signature HashX Proof Circuit Component System.
 * Visualizes the dual-rail convergence:
 * Commercial Intent Rail + Chain Evidence Rail -> Human Authorization Gate -> HSP Settlement
 * Supports the Diverter Rail when verification fails.
 */
export const ProofCircuit: React.FC<ProofCircuitProps> = ({
  variant = "marketing",
  activeGateId,
  isBlocked = false,
  diverterActive = false,
  blockReason = "PAYEE_MISMATCH_DETECTED",
  quarantineTarget = "0x99A0...11B0",
  gates,
  pipelineCounts = { issued: 18, verified: 14, authorized: 3, inFlight: 7, settled: 42, blocked: 2 },
  onGateSelect,
  className,
}) => {
  const [hoveredGate, setHoveredGate] = useState<string | null>(null);

  // Marketing variant: Editorial representation of the Proof Circuit
  if (variant === "marketing") {
    return (
      <div className={cn("border border-border bg-surface-1 p-5 sm:p-6 relative text-foreground select-none", className)}>
        {/* Header band */}
        <div className="flex items-center justify-between border-b border-border pb-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-none bg-primary inline-block" />
            <span className="font-mono text-[11px] font-semibold tracking-wider text-foreground uppercase">
              THE HASHX PROOF CIRCUIT
            </span>
          </div>
          <span className="px-2 py-0.5 border border-success/30 text-success text-2xs font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span>VERIFIED ENGINE</span>
          </span>
        </div>

        {/* Dual Converging Rails (Intent & Evidence) */}
        <div className="space-y-4">
          {/* Rail A: Commercial Intent */}
          <div className="border border-border bg-surface-2/70 p-3.5 relative pl-4 rounded-sm">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-[11px] font-bold text-primary tracking-wide">
                RAIL A: COMMERCIAL INTENT
              </span>
              <span className="font-mono text-2xs text-foreground-secondary">STAGE 01</span>
            </div>
            <p className="text-[13px] text-foreground font-normal mb-2">
              Domain-bound EIP-712 structured invoice with counterparty binding & anti-replay nonce.
            </p>
            <div className="bg-background/90 border border-border px-2.5 py-1 flex items-center justify-between text-2xs font-mono">
              <span className="text-foreground-secondary">INVOICE SIGNED:</span>
              <span className="text-foreground font-semibold">0x8a9f...41c2</span>
            </div>
          </div>

          {/* Convergence Lines */}
          <div className="grid grid-cols-2 text-center relative py-1">
            <div className="h-5 border-r border-dashed border-border" />
            <div className="h-5 border-l border-dashed border-border" />
          </div>

          {/* Rail B: Chain Evidence Witness */}
          <div className="border border-border bg-surface-2/70 p-3.5 relative pl-4 rounded-sm">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-success" />
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-[11px] font-bold text-success tracking-wide">
                RAIL B: DIGITAL EVIDENCE WITNESS
              </span>
              <span className="font-mono text-2xs text-foreground-secondary">STAGE 02</span>
            </div>
            <p className="text-[13px] text-foreground font-normal mb-2">
              Deterministic fulfillment verification via HashKey RPC state check & deliverable hash.
            </p>
            <div className="bg-background/90 border border-border px-2.5 py-1 flex items-center justify-between text-2xs font-mono">
              <span className="text-foreground-secondary">DELIVERY WITNESSED:</span>
              <span className="text-foreground font-semibold">bafybei...301</span>
            </div>
          </div>

          {/* Convergence Node: Human Authorization Gate */}
          <div className="border-2 border-primary bg-surface-1 p-4 relative rounded-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 border border-primary bg-primary/20" />
                <span className="font-display text-[12px] font-semibold text-foreground tracking-wider uppercase">
                  CONVERGENCE GATE: HUMAN AUTHORIZATION
                </span>
              </div>
              <span className="font-mono text-2xs text-primary font-semibold">2-STAGE GATE</span>
            </div>
            <p className="text-[12px] text-foreground-secondary mb-3">
              Explicit human review quorum prevents autonomous recursive agent balance depletion.
            </p>
            <div className="grid grid-cols-2 gap-2 text-2xs font-mono">
              <div className="bg-background/80 p-2 border border-border">
                <span className="text-foreground-secondary block">STAGE 1: VERIFY TERMS</span>
                <span className="text-success font-semibold flex items-center gap-1 mt-0.5">
                  <Check className="w-3 h-3" /> VERIFIED
                </span>
              </div>
              <div className="bg-background/80 p-2 border border-border">
                <span className="text-foreground-secondary block">STAGE 2: AUTHORIZE PAY</span>
                <span className="text-success font-semibold flex items-center gap-1 mt-0.5">
                  <Check className="w-3 h-3" /> CONFIRMED
                </span>
              </div>
            </div>
          </div>

          {/* Settlement Rail */}
          <div className="bg-background p-3.5 border border-border flex items-center justify-between rounded-sm">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-success" />
              <div>
                <span className="font-mono text-2xs font-bold text-success block">
                  HASHKEY HSP SETTLEMENT
                </span>
                <span className="font-mono text-[10px] text-foreground-secondary">
                  Settlement Reconciled to Actual Finality
                </span>
              </div>
            </div>
            <span className="font-mono text-[12px] font-semibold text-foreground px-2 py-0.5 bg-surface-2 border border-border">
              FINALIZED RECEIPT COMMITTED
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Pipeline variant: Used in Application Overview to visualize obligation lifecycle
  if (variant === "pipeline") {
    const isQuarantined = isBlocked || diverterActive;
    return (
      <div className={cn("border border-border bg-surface-1 p-5 rounded select-none", className)}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-primary" />
            <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
              OBLIGATION PIPELINE // PROOF CIRCUIT
            </h3>
          </div>
          <div className="flex items-center gap-4 text-2xs font-mono text-foreground-secondary">
            <span>● HashKey HSP Reconciler: Active</span>
            <span>Latency: 142ms</span>
          </div>
        </div>

        {/* 5-Gate Primary Circuit */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 relative">
          {/* Gate 1 */}
          <div className="p-3 border border-border bg-surface-2/60 relative">
            <div className="flex justify-between items-center text-2xs font-mono mb-1">
              <span className="text-primary font-bold">01 // INGESTED</span>
              <span className="text-foreground font-semibold">{pipelineCounts.issued ?? 18}</span>
            </div>
            <p className="text-2xs text-foreground font-medium truncate">EIP-712 Domain Signed</p>
            <div className="mt-2 text-[10px] font-mono text-success flex items-center gap-1">
              <Check className="w-2.5 h-2.5" /> secp256k1 Valid
            </div>
          </div>

          {/* Gate 2 */}
          <div className="p-3 border border-border bg-surface-2/60 relative">
            <div className="flex justify-between items-center text-2xs font-mono mb-1">
              <span className="text-success font-bold">02 // WITNESSED</span>
              <span className="text-foreground font-semibold">{pipelineCounts.verified ?? 14}</span>
            </div>
            <p className="text-2xs text-foreground font-medium truncate">Fulfillment Proven</p>
            <div className="mt-2 text-[10px] font-mono text-success flex items-center gap-1">
              <Check className="w-2.5 h-2.5" /> Chain RPC Match
            </div>
          </div>

          {/* Gate 3 */}
          <div className="p-3 border-2 border-warning bg-warning/5 relative">
            <div className="flex justify-between items-center text-2xs font-mono mb-1">
              <span className="text-warning font-bold">03 // HUMAN GATE</span>
              <span className="text-warning font-bold">{pipelineCounts.authorized ?? 3} Action</span>
            </div>
            <p className="text-2xs text-foreground font-medium truncate">Two-Stage Sign-off</p>
            <div className="mt-2 text-[10px] font-mono text-warning flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 animate-spin" /> Awaiting Review
            </div>
          </div>

          {/* Gate 4 */}
          <div className="p-3 border border-border bg-surface-2/60 relative">
            <div className="flex justify-between items-center text-2xs font-mono mb-1">
              <span className="text-primary font-bold">04 // HSP ESCROW</span>
              <span className="text-foreground font-semibold">{pipelineCounts.inFlight ?? 7}</span>
            </div>
            <p className="text-2xs text-foreground font-medium truncate">HSP Rail In Flight</p>
            <div className="mt-2 text-[10px] font-mono text-primary flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Reconciling
            </div>
          </div>

          {/* Gate 5 */}
          <div className="p-3 border border-success/40 bg-success/5 relative">
            <div className="flex justify-between items-center text-2xs font-mono mb-1">
              <span className="text-success font-bold">05 // FINALIZED</span>
              <span className="text-success font-bold">{pipelineCounts.settled ?? 42}</span>
            </div>
            <p className="text-2xs text-foreground font-medium truncate">Receipt Committed</p>
            <div className="mt-2 text-[10px] font-mono text-success flex items-center gap-1">
              <Check className="w-2.5 h-2.5" /> Immutable
            </div>
          </div>
        </div>

        {/* Diverter Rail for Quarantined / Intercepted Transactions */}
        <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3 bg-danger/5 border-danger/30 p-2.5 rounded-sm">
          <div className="flex items-center gap-2 text-2xs font-mono text-danger font-semibold">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>DIVERTER RAIL ACTIVE: {pipelineCounts.blocked ?? 2} Intercepted Threats</span>
            <span className="text-foreground-secondary font-normal text-[11px] hidden sm:inline">
              (Payee Mismatch &amp; Phantom Delivery Intercepted Before Settlement)
            </span>
          </div>
          <span className="px-2 py-0.5 bg-danger/15 border border-danger/40 text-danger text-2xs font-mono">
            QUARANTINED
          </span>
        </div>
      </div>
    );
  }

  // Inspector & Demo variant: Forensic walkthrough of a specific invoice/threat
  const isFailed = isBlocked || diverterActive;
  return (
    <div className={cn("border border-border bg-surface-1 p-4 rounded text-foreground select-none", className)}>
      <div className="flex items-center justify-between border-b border-border pb-2.5 mb-4">
        <span className="font-mono text-2xs font-semibold text-foreground uppercase tracking-wider">
          PROOF CIRCUIT // VERIFICATION PATH
        </span>
        <span
          className={cn(
            "px-2 py-0.5 text-2xs font-mono border",
            isFailed
              ? "border-danger text-danger bg-danger/10"
              : "border-success text-success bg-success/10"
          )}
        >
          {isFailed ? "BLOCKED AT GATE 03" : "VERIFIED ELIGIBLE"}
        </span>
      </div>

      {/* Vertical Track Sequence */}
      <div className="space-y-3 relative">
        {/* Step 1 */}
        <div className="flex items-start gap-3 p-2 bg-surface-2/60 border border-border">
          <div className="w-5 h-5 rounded-none bg-success/15 border border-success text-success flex items-center justify-center shrink-0 mt-0.5">
            <Check className="w-3 h-3" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between items-center text-2xs font-mono">
              <span className="font-semibold text-foreground">01 // EIP-712 INTENT INGESTION</span>
              <span className="text-success">PASSED</span>
            </div>
            <p className="text-[11px] text-foreground-secondary truncate">
              Domain matched, parameters typed, nonce verified.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex items-start gap-3 p-2 bg-surface-2/60 border border-border">
          <div className="w-5 h-5 rounded-none bg-success/15 border border-success text-success flex items-center justify-center shrink-0 mt-0.5">
            <Check className="w-3 h-3" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between items-center text-2xs font-mono">
              <span className="font-semibold text-foreground">02 // SIGNATURE VALIDATION</span>
              <span className="text-success">PASSED</span>
            </div>
            <p className="text-[11px] text-foreground-secondary truncate">
              ECDSA secp256k1 signature matches seller identity.
            </p>
          </div>
        </div>

        {/* Step 3 (Where Diverter triggers if failed) */}
        {isFailed ? (
          <div className="border-2 border-danger bg-danger/10 p-3">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-none bg-danger text-white flex items-center justify-center shrink-0 mt-0.5">
                <X className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between items-center text-2xs font-mono">
                  <span className="font-bold text-danger">03 // PAYEE INTEGRITY CHECK</span>
                  <span className="text-danger font-bold">FAILED</span>
                </div>
                <p className="text-2xs text-danger mt-1">
                  Payee address substituted. Expected 0x429A...38F1, got {quarantineTarget}.
                </p>
                {/* Diverter rail branch */}
                <div className="mt-2.5 pt-2 border-t border-danger/30 text-[11px] font-mono text-danger flex items-center gap-1.5">
                  <ArrowRight className="w-3 h-3" />
                  <span>DIVERTER ACTIVATED: Routed to Quarantine Chamber. Funds safe.</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-2 bg-surface-2/60 border border-border">
            <div className="w-5 h-5 rounded-none bg-success/15 border border-success text-success flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-3 h-3" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between items-center text-2xs font-mono">
                <span className="font-semibold text-foreground">03 // DELIVERY WITNESS</span>
                <span className="text-success">PASSED</span>
              </div>
              <p className="text-[11px] text-foreground-secondary truncate">
                Deterministic RPC consensus &amp; artifact digest validated.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Human Gate */}
        <div
          className={cn(
            "flex items-start gap-3 p-2 border",
            isFailed
              ? "opacity-40 bg-surface-2/30 border-border"
              : "bg-warning/10 border-warning text-foreground"
          )}
        >
          <div
            className={cn(
              "w-5 h-5 rounded-none flex items-center justify-center shrink-0 mt-0.5",
              isFailed
                ? "bg-foreground-muted/20 text-foreground-muted"
                : "bg-warning/20 border border-warning text-warning"
            )}
          >
            {isFailed ? <X className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between items-center text-2xs font-mono">
              <span className="font-semibold">04 // HUMAN AUTHORIZATION</span>
              <span className={isFailed ? "text-danger" : "text-warning"}>
                {isFailed ? "BLOCKED" : "AWAITING KEY"}
              </span>
            </div>
            <p className="text-[11px] text-foreground-secondary truncate">
              {isFailed ? "Execution prohibited by verifier." : "Stage 2 operator sign-off required."}
            </p>
          </div>
        </div>

        {/* Step 5: Settlement */}
        <div
          className={cn(
            "flex items-start gap-3 p-2 border",
            isFailed ? "opacity-30 bg-surface-2/20 border-border" : "bg-surface-2/60 border-border"
          )}
        >
          <div className="w-5 h-5 rounded-none bg-surface-3 text-foreground-muted flex items-center justify-center shrink-0 mt-0.5">
            <Layers className="w-3 h-3" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between items-center text-2xs font-mono">
              <span className="font-semibold text-foreground-secondary">05 // HSP SETTLEMENT</span>
              <span className="text-foreground-muted">{isFailed ? "HALTED" : "STANDBY"}</span>
            </div>
            <p className="text-[11px] text-foreground-muted truncate">
              HashKey settlement engine non-custodial transfer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

