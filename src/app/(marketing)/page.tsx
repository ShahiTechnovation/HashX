"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  X,
  FileSignature,
  ScanSearch,
  Lock,
  Landmark,
  ShieldAlert,
  Terminal,
  ExternalLink,
  Code2,
  Copy,
} from "lucide-react";
import { ProofCircuit } from "@/components/brand/ProofCircuit";

export default function MarketingHomePage() {
  const [copiedCode, setCopiedCode] = useState(false);

  const pythonSnippet = `# Conceptual Agent Client Preview (Model Context Protocol Interface)
# Production agents communicate via Streamable HTTP / SSE MCP transports
from hashx_mcp import HashXTrustClient  # Conceptual client package

client = HashXTrustClient(
    agent_id="agt_9941_autonomous",
    settlement_rail="hashkey_chain_testnet_133",
    human_approval_threshold_usd=5000.00
)

# 1. Register Verifiable Service Delivery
delivery_witness = client.submit_delivery(
    task_id="tsk_matrix_computation_81",
    artifact_hash="bafybeicx4z7e9w849qm018a99k4z0029bca71092e01f01",
    witness_proof_type="deterministic_rpc_witness"
)

# 2. Request Settlement Release (Enforces Human Stage-2 Authorization)
payment_receipt = client.request_payment(
    invoice_id="inv_eip712_8a9f41c2",
    amount_usdc=14200.00,
    recipient="0x429A88c2195f38f1b901ca94892c902384f938f1",
    evidence_token=delivery_witness.token
)

# Settlement executed upon Stage-2 signature & HSP confirmation
print(f"Settlement Status: {payment_receipt.status}")
# Cryptographic Receipt Digest: 0x4f12d8a0c...e08a`;

  const copyCode = () => {
    navigator.clipboard.writeText(pythonSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="mineral-light min-h-screen bg-[#F4F2EB] text-[#111719] font-sans selection:bg-[#345BEE] selection:text-white">
      {/* TOP EDITORIAL HEADER */}
      <header className="w-full bg-[#FBFAF6] border-b border-[#D9DCD7] sticky top-0 z-50">
        <div className="flex justify-between items-center w-full px-5 sm:px-8 lg:px-12 max-w-[1360px] mx-auto h-16">
          {/* Brand Cluster with Architectural Monogram */}
          <div className="flex items-center space-x-4">
            <Link className="flex items-center space-x-3 group" href="/">
              <img
                src="/logo.png"
                alt="HashX"
                className="w-8 h-8 object-contain shrink-0 select-none transition-transform group-hover:scale-105 drop-shadow-sm"
              />
              <span className="font-display text-lg tracking-tight text-[#111719] uppercase font-semibold">
                HashX
              </span>
            </Link>
            <div className="hidden lg:flex items-center pl-3 border-l border-[#D9DCD7] text-[11px] font-mono text-[#535D61]">
              <span>SPEC: HSP-2025.A</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-7 text-[12px] font-mono tracking-wider uppercase">
            <a className="text-[#345BEE] border-b border-[#345BEE] pb-0.5 font-semibold" href="#circuit">
              Proof Circuit
            </a>
            <a className="text-[#535D61] hover:text-[#111719] transition-colors" href="#adversarial">
              Threat Matrix
            </a>
            <a className="text-[#535D61] hover:text-[#111719] transition-colors" href="#pipeline">
              Lifecycle
            </a>
            <a className="text-[#535D61] hover:text-[#111719] transition-colors" href="#inspector">
              Trust Inspector
            </a>
            <a className="text-[#535D61] hover:text-[#111719] transition-colors" href="#mcp">
              MCP Tools
            </a>
            <Link className="text-[#535D61] hover:text-[#111719] transition-colors" href="/app/demo">
              Demo
            </Link>
          </nav>

          {/* Right Telemetry & Actions */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 px-2.5 py-1 border border-[#D9DCD7] bg-[#F4F2EB] text-[11px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[#345BEE]" />
              <span className="text-[#535D61] font-medium">HashKey Testnet 133 · HSP QA</span>
            </div>
            <Link
              href="/app"
              className="px-4 py-2 bg-[#111719] hover:bg-[#1a2327] text-[#FBFAF6] font-mono text-[11px] tracking-wider uppercase transition-colors flex items-center space-x-1.5 rounded-sm"
            >
              <span>Open Platform</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN EDITORIAL CANVAS */}
      <main className="w-full max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-10 sm:pt-14 pb-24">
        {/* HERO SECTION: ASYMMETRIC MONOGRAPH */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start pb-16 border-b border-[#D9DCD7]">
          {/* Left Column: Editorial Positioning & Manifesto (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between pr-0 lg:pr-4">
            {/* Monograph Revision Tag */}
            <div className="inline-flex items-center space-x-2 border-b border-[#D9DCD7] pb-2 mb-6">
              <span className="text-[11px] font-mono text-[#345BEE] font-semibold">
                [ PROTOCOL MONOGRAPH // REV 2.4 ]
              </span>
              <span className="text-[#D9DCD7] font-mono">|</span>
              <span className="text-[11px] font-mono text-[#535D61] tracking-widest uppercase">
                HASHX — THE TRUST LAYER FOR AGENT PAYMENTS
              </span>
            </div>

            {/* Monumental Headline */}
            <h1 className="font-display text-[42px] sm:text-[56px] lg:text-[62px] leading-[1.02] tracking-[-0.035em] text-[#111719] mb-6 font-semibold">
              Before agents pay,<br />
              <span className="text-[#345BEE] italic font-light">demand</span> proof.
            </h1>

            {/* High-density Editorial Copy */}
            <p className="text-[16px] sm:text-[17px] text-[#535D61] max-w-xl mb-8 leading-relaxed font-normal">
              A payment request is not proof of a fulfilled agreement. HashX authenticates commercial intent,
              verifies digital service delivery against chain data, enforces explicit human authorization, and
              reconciles settlement through HashKey HSP.
            </p>

            {/* Action Pair */}
            <div className="flex flex-wrap items-center gap-3.5 mb-10">
              <Link
                href="/app"
                className="px-6 py-3.5 bg-[#111719] hover:bg-[#1a2327] text-[#FBFAF6] font-mono text-[12px] tracking-wider uppercase flex items-center space-x-2 transition-colors rounded-sm"
              >
                <span>Explore the Platform</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#circuit"
                className="px-6 py-3.5 bg-[#FBFAF6] border border-[#111719] hover:bg-[#111719] hover:text-[#FBFAF6] text-[#111719] font-mono text-[12px] tracking-wider uppercase transition-colors flex items-center space-x-2 rounded-sm"
              >
                <span>Inspect Verification Circuit</span>
              </a>
            </div>

            {/* Architectural Telemetry Register */}
            <div className="grid grid-cols-3 border border-[#D9DCD7] bg-[#FBFAF6] divide-x divide-[#D9DCD7] rounded-sm">
              <div className="p-3.5">
                <span className="block font-mono text-[10px] text-[#535D61] tracking-wider uppercase mb-1">
                  INTENT SPEC
                </span>
                <span className="font-mono text-[13px] text-[#111719] font-semibold">EIP-712 / V4</span>
              </div>
              <div className="p-3.5">
                <span className="block font-mono text-[10px] text-[#535D61] tracking-wider uppercase mb-1">
                  SETTLEMENT RAIL
                </span>
                <span className="font-mono text-[13px] text-[#111719] font-semibold">HashKey HSP</span>
              </div>
              <div className="p-3.5">
                <span className="block font-mono text-[10px] text-[#535D61] tracking-wider uppercase mb-1">
                  HUMAN GATE
                </span>
                <span className="font-mono text-[13px] text-[#2DD4BF] font-semibold">Two-Stage Sign-off</span>
              </div>
            </div>
          </div>

          {/* Right Column: Signature Proof Circuit (5 cols) */}
          <div className="lg:col-span-5 relative" id="circuit">
            <ProofCircuit variant="marketing" />
          </div>
        </section>

        {/* HORIZONTAL PROOF STRIP */}
        <section className="py-12 border-b border-[#D9DCD7]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#D9DCD7] border border-[#D9DCD7] bg-[#FBFAF6] rounded-sm">
            {/* Col 01 */}
            <div className="p-6 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[11px] text-[#535D61] block mb-3">COL 01 // 04</span>
                <h3 className="font-display text-sm font-semibold text-[#111719] mb-2 uppercase tracking-wide">
                  Signed Intent
                </h3>
                <p className="text-[13px] text-[#535D61] leading-relaxed">
                  Domain-bound EIP-712 structured payloads prevent parameter hijacking, nonce reordering, and arbitrary agent fee tampering.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-[#D9DCD7] text-[11px] font-mono text-[#345BEE] font-semibold">
                RFC-EIP-712-VERIFIED
              </div>
            </div>

            {/* Col 02 */}
            <div className="p-6 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[11px] text-[#535D61] block mb-3">COL 02 // 04</span>
                <h3 className="font-display text-sm font-semibold text-[#111719] mb-2 uppercase tracking-wide">
                  Deterministic Delivery
                </h3>
                <p className="text-[13px] text-[#535D61] leading-relaxed">
                  Chain-witnessed execution receipts independently verified before liquidity releases. Zero payments for unfulfilled tasks.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-[#D9DCD7] text-[11px] font-mono text-[#2DD4BF] font-semibold">
                RPC_EVIDENCE_CHECK_OK
              </div>
            </div>

            {/* Col 03 */}
            <div className="p-6 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[11px] text-[#535D61] block mb-3">COL 03 // 04</span>
                <h3 className="font-display text-sm font-semibold text-[#111719] mb-2 uppercase tracking-wide">
                  Human Sign-Off Gate
                </h3>
                <p className="text-[13px] text-[#535D61] leading-relaxed">
                  Two-stage explicit human authorization: commercial term validation before signing, treasury approval before submission.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-[#D9DCD7] text-[11px] font-mono text-[#111719] font-semibold">
                TWO_STAGE_ENFORCED
              </div>
            </div>

            {/* Col 04 */}
            <div className="p-6 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[11px] text-[#535D61] block mb-3">COL 04 // 04</span>
                <h3 className="font-display text-sm font-semibold text-[#111719] mb-2 uppercase tracking-wide">
                  HSP Settlement
                </h3>
                <p className="text-[13px] text-[#535D61] leading-relaxed">
                  Settlement executed and reconciled through HashKey HSP rails, providing atomic clearing and verifiable receipts.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-[#D9DCD7] text-[11px] font-mono text-[#345BEE] font-semibold">
                HSP_RECONCILER_ACTIVE
              </div>
            </div>
          </div>
        </section>

        {/* THE ADVERSARIAL COMPARISON: "A request is not an agreement" */}
        <section className="py-16 border-b border-[#D9DCD7]" id="adversarial">
          <div className="mb-10">
            <span className="text-[11px] font-mono text-[#345BEE] block mb-1 tracking-wider uppercase font-semibold">
              THREAT MATRIX &amp; ADVERSARIAL REASONING
            </span>
            <h2 className="font-display text-[32px] sm:text-[38px] text-[#111719] tracking-tight uppercase font-semibold">
              A request is not an agreement.
            </h2>
            <p className="text-[14px] text-[#535D61] max-w-2xl mt-2 leading-relaxed">
              Autonomous agents operate with unbounded execution speed. Without an enforced proof circuit,
              standard multi-agent architectures leak corporate treasury through 4 primary systemic vulnerabilities.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Vulnerable Unsafe Flow */}
            <div className="border border-[#EF4444] bg-[#FBFAF6] p-6 relative rounded-sm">
              <div className="flex items-center justify-between border-b border-[#D9DCD7] pb-3 mb-6">
                <div>
                  <span className="font-mono text-[11px] font-bold text-[#EF4444] uppercase block tracking-wider">
                    UNSAFE AGENT PAYMENT FLOW
                  </span>
                  <span className="text-[11px] font-mono text-[#535D61]">CONVENTIONAL AGENT STACK</span>
                </div>
                <span className="px-2 py-0.5 bg-[#EF4444]/10 text-[#EF4444] font-mono text-[11px] font-semibold border border-[#EF4444]/30">
                  HIGH ATTACK SURFACE
                </span>
              </div>

              <div className="space-y-3.5">
                <div className="p-3 bg-[#F4F2EB] border border-[#D9DCD7] flex items-start space-x-3 rounded-sm">
                  <ShieldAlert className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-display text-xs font-semibold uppercase block text-[#111719]">
                      01. Invoice Spoofing &amp; Payee Substitution
                    </span>
                    <p className="text-[12px] text-[#535D61] mt-0.5 leading-snug">
                      Agent receives unverified payment URI. Compromised sub-agent substitutes fraudulent destination address without cryptographic signature binding.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#F4F2EB] border border-[#D9DCD7] flex items-start space-x-3 rounded-sm">
                  <X className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-display text-xs font-semibold uppercase block text-[#111719]">
                      02. Phantom Delivery Releases
                    </span>
                    <p className="text-[12px] text-[#535D61] mt-0.5 leading-snug">
                      Funds disbursed automatically upon an LLM claim of &quot;Task Complete&quot; without deterministic proof of artifact generation.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#F4F2EB] border border-[#D9DCD7] flex items-start space-x-3 rounded-sm">
                  <ShieldAlert className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-display text-xs font-semibold uppercase block text-[#111719]">
                      03. Nonce Desynchronization &amp; Replays
                    </span>
                    <p className="text-[12px] text-[#535D61] mt-0.5 leading-snug">
                      Looping agent retry mechanisms submit duplicate payment requests for the same single API delivery.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#F4F2EB] border border-[#D9DCD7] flex items-start space-x-3 rounded-sm">
                  <X className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-display text-xs font-semibold uppercase block text-[#111719]">
                      04. Blind Autonomous Token Drains
                    </span>
                    <p className="text-[12px] text-[#535D61] mt-0.5 leading-snug">
                      Zero human supervisor checkpoints exist between model tool execution and wallet signing.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#D9DCD7] flex items-center justify-between text-[11px] font-mono text-[#EF4444]">
                <span>RESIDUAL RISK: CRITICAL</span>
                <span>SETTLEMENT ASSURANCE: 0.0%</span>
              </div>
            </div>

            {/* Right: HashX Verified Control Flow */}
            <div className="border-2 border-[#345BEE] bg-[#FBFAF6] p-6 relative rounded-sm">
              <div className="flex items-center justify-between border-b border-[#D9DCD7] pb-3 mb-6">
                <div>
                  <span className="font-mono text-[11px] font-bold text-[#345BEE] uppercase block tracking-wider">
                    HASHX VERIFIED CONTROL FLOW
                  </span>
                  <span className="text-[11px] font-mono text-[#535D61]">DETERMINISTIC TRUST ENGINE</span>
                </div>
                <span className="px-2 py-0.5 bg-[#2DD4BF] text-[#0A1012] font-mono text-[11px] font-semibold">
                  PROOF ENFORCED
                </span>
              </div>

              <div className="space-y-3.5">
                <div className="p-3 bg-[#F4F2EB] border border-[#D9DCD7] flex items-start space-x-3 rounded-sm">
                  <Check className="w-4 h-4 text-[#345BEE] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-display text-xs font-semibold uppercase block text-[#111719]">
                      01. Cryptographic EIP-712 Signatures
                    </span>
                    <p className="text-[12px] text-[#535D61] mt-0.5 leading-snug">
                      Payee, chain ID, specific task hash, and timestamp deadlines are cryptographically pinned to the seller agent&apos;s verified key.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#F4F2EB] border border-[#D9DCD7] flex items-start space-x-3 rounded-sm">
                  <Check className="w-4 h-4 text-[#2DD4BF] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-display text-xs font-semibold uppercase block text-[#111719]">
                      02. Chain Delivery Evidence Verification
                    </span>
                    <p className="text-[12px] text-[#535D61] mt-0.5 leading-snug">
                      Payment eligibility requires matching artifact hash and state verification against HashKey RPC before approval can open.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#F4F2EB] border border-[#D9DCD7] flex items-start space-x-3 rounded-sm">
                  <Lock className="w-4 h-4 text-[#345BEE] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-display text-xs font-semibold uppercase block text-[#111719]">
                      03. Two-Stage Explicit Human Authorization
                    </span>
                    <p className="text-[12px] text-[#535D61] mt-0.5 leading-snug">
                      Explicit human review on exact payment terms, merchant identity, and quote expiration before wallet signing and dispatch.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#F4F2EB] border border-[#D9DCD7] flex items-start space-x-3 rounded-sm">
                  <Landmark className="w-4 h-4 text-[#2DD4BF] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-display text-xs font-semibold uppercase block text-[#111719]">
                      04. HashKey HSP Settlement Reconciliation
                    </span>
                    <p className="text-[12px] text-[#535D61] mt-0.5 leading-snug">
                      Final settlement executes across HashKey HSP institutional rails with immutable receipt commitment logged.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#D9DCD7] flex items-center justify-between text-[11px] font-mono text-[#2DD4BF]">
                <span>RESIDUAL RISK: ZERO-ARBITRARY</span>
                <span className="font-bold">SETTLEMENT ASSURANCE: DETERMINISTIC</span>
              </div>
            </div>
          </div>
        </section>

        {/* 6-STEP VERIFICATION PIPELINE (CARBON DARK BAND) */}
        <section className="my-16 bg-[#0A1012] text-[#F0F1ED] p-8 md:p-12 border border-[#273137] rounded" id="pipeline">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-[#273137] pb-6 mb-8">
            <div>
              <span className="text-[11px] font-mono text-[#2DD4BF] block mb-1 uppercase font-semibold">
                EXECUTION LIFECYCLE
              </span>
              <h2 className="font-display text-[28px] sm:text-[34px] text-[#F0F1ED] tracking-tight uppercase font-semibold">
                The 6-Step Verification Pipeline
              </h2>
            </div>
            <div className="mt-4 md:mt-0 font-mono text-[11px] text-[#91A0A5]">
              <span>DETERMINISTIC LATENCY: &lt;850ms END-TO-END</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Step 01 */}
            <div className="bg-[#131C20] border border-[#273137] p-4 flex flex-col justify-between rounded-sm">
              <div>
                <span className="font-mono text-[11px] text-[#2DD4BF] block mb-2 font-bold">01 // INTENT</span>
                <h4 className="font-display text-xs uppercase text-[#F0F1ED] mb-1 font-semibold">Payload Bound</h4>
                <p className="text-[12px] text-[#91A0A5] leading-snug">
                  Commercial parameters locked into immutable EIP-712 schema.
                </p>
              </div>
              <div className="mt-4 pt-2 border-t border-[#273137] font-mono text-[10px] text-[#2DD4BF]">
                NONCE: VALID
              </div>
            </div>

            {/* Step 02 */}
            <div className="bg-[#131C20] border border-[#273137] p-4 flex flex-col justify-between rounded-sm">
              <div>
                <span className="font-mono text-[11px] text-[#2DD4BF] block mb-2 font-bold">02 // INVOICE</span>
                <h4 className="font-display text-xs uppercase text-[#F0F1ED] mb-1 font-semibold">EIP-712 Signed</h4>
                <p className="text-[12px] text-[#91A0A5] leading-snug">
                  Seller agent key binds task scope and settlement amount.
                </p>
              </div>
              <div className="mt-4 pt-2 border-t border-[#273137] font-mono text-[10px] text-[#2DD4BF]">
                SIG: secp256k1
              </div>
            </div>

            {/* Step 03 */}
            <div className="bg-[#131C20] border border-[#273137] p-4 flex flex-col justify-between rounded-sm">
              <div>
                <span className="font-mono text-[11px] text-[#2DD4BF] block mb-2 font-bold">03 // EVIDENCE</span>
                <h4 className="font-display text-xs uppercase text-[#F0F1ED] mb-1 font-semibold">Work Verified</h4>
                <p className="text-[12px] text-[#91A0A5] leading-snug">
                  Deliverable verified against HashKey RPC state and artifact digest.
                </p>
              </div>
              <div className="mt-4 pt-2 border-t border-[#273137] font-mono text-[10px] text-[#2DD4BF]">
                RPC WITNESS: MATCH
              </div>
            </div>

            {/* Step 04 */}
            <div className="bg-[#131C20] border-2 border-[#345BEE] p-4 flex flex-col justify-between rounded-sm">
              <div>
                <span className="font-mono text-[11px] text-[#345BEE] block mb-2 font-bold">04 // GATE</span>
                <h4 className="font-display text-xs uppercase text-[#F0F1ED] mb-1 font-semibold">Human Review</h4>
                <p className="text-[12px] text-[#91A0A5] leading-snug">
                  Two-stage sign-off confirms terms and authorizes HSP submission.
                </p>
              </div>
              <div className="mt-4 pt-2 border-t border-[#273137] font-mono text-[10px] text-[#345BEE] font-bold">
                2-STAGE APPROVAL
              </div>
            </div>

            {/* Step 05 */}
            <div className="bg-[#131C20] border border-[#273137] p-4 flex flex-col justify-between rounded-sm">
              <div>
                <span className="font-mono text-[11px] text-[#2DD4BF] block mb-2 font-bold">05 // SETTLE</span>
                <h4 className="font-display text-xs uppercase text-[#F0F1ED] mb-1 font-semibold">HSP Execution</h4>
                <p className="text-[12px] text-[#91A0A5] leading-snug">
                  HashKey payment settlement engine processes payment.
                </p>
              </div>
              <div className="mt-4 pt-2 border-t border-[#273137] font-mono text-[10px] text-[#2DD4BF]">
                SAFE → FINALIZED
              </div>
            </div>

            {/* Step 06 */}
            <div className="bg-[#131C20] border border-[#273137] p-4 flex flex-col justify-between rounded-sm">
              <div>
                <span className="font-mono text-[11px] text-[#2DD4BF] block mb-2 font-bold">06 // RECEIPT</span>
                <h4 className="font-display text-xs uppercase text-[#F0F1ED] mb-1 font-semibold">Verifiable Record</h4>
                <p className="text-[12px] text-[#91A0A5] leading-snug">
                  Evidence-backed receipt commitment generated and verifiable by anyone.
                </p>
              </div>
              <div className="mt-4 pt-2 border-t border-[#273137] font-mono text-[10px] text-[#2DD4BF]">
                RECEIPT COMMITTED
              </div>
            </div>
          </div>
        </section>

        {/* TRUST INSPECTOR PRODUCT PREVIEW */}
        <section className="py-16 border-b border-[#D9DCD7]" id="inspector">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8">
            <div>
              <span className="text-[11px] font-mono text-[#345BEE] block mb-1 uppercase font-semibold">
                INTERACTIVE AUDIT CONSOLE
              </span>
              <h2 className="font-display text-[32px] sm:text-[38px] text-[#111719] tracking-tight uppercase font-semibold">
                The Trust Inspector
              </h2>
              <p className="text-[14px] text-[#535D61] mt-1 max-w-xl">
                Engineers and treasury managers inspect cryptographic signatures, fulfillment evidence, and payment eligibility in real time.
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center space-x-3">
              <span className="text-[11px] font-mono text-[#535D61]">INSPECTOR ENGINE v2.4</span>
              <Link
                href="/app/trust"
                className="px-3.5 py-1.5 border border-[#D9DCD7] bg-[#FBFAF6] hover:bg-[#F4F2EB] text-[11px] font-mono text-[#111719] rounded-sm transition-colors"
              >
                Open Trust Inspector
              </Link>
            </div>
          </div>

          {/* Console Preview Container */}
          <div className="border border-[#D9DCD7] bg-[#FBFAF6] rounded-sm">
            <div className="border-b border-[#D9DCD7] px-6 py-3 flex flex-wrap justify-between items-center bg-[#F4F2EB]">
              <div className="flex items-center space-x-3 text-[12px] font-mono">
                <span className="text-[#535D61]">VERIFIER CONTRACT:</span>
                <span className="text-[#111719] font-semibold">0x71C0...948A (HashKey Chain)</span>
              </div>
              <div className="flex items-center space-x-4 text-[11px] font-mono">
                <span className="text-[#535D61]">BLOCK: #19,482,914</span>
                <span className="text-[#2DD4BF] font-semibold">● DETERMINISTIC STATE CONFIRMED</span>
              </div>
            </div>

            <div className="p-6 border-b border-[#D9DCD7] bg-[#FBFAF6] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-[#2DD4BF] text-[#0A1012] flex items-center justify-center rounded-sm">
                  <Check className="w-7 h-7 stroke-[2.5]" />
                </div>
                <div>
                  <span className="font-mono text-[10px] text-[#535D61] tracking-wider uppercase block">
                    VERIFICATION VERDICT
                  </span>
                  <span className="font-display text-[22px] sm:text-[26px] text-[#111719] font-semibold tracking-tight">
                    PAYMENT ELIGIBLE // ALL CHECKS PASSED
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-start md:items-end">
                <span className="px-3 py-1 bg-[#2DD4BF] text-[#0A1012] font-mono text-[11px] font-bold uppercase tracking-wider rounded-sm">
                  VERIFIED: PROOF SECURED
                </span>
                <span className="text-[11px] font-mono text-[#535D61] mt-1">TIMESTAMP: 2026-11-01 23:45:12 UTC</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#D9DCD7] border-b border-[#D9DCD7]">
              {/* Payee Integrity */}
              <div className="p-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-mono text-[11px] text-[#535D61] uppercase font-bold">
                    01 / PAYEE INTEGRITY CHECK
                  </span>
                  <span className="text-[#2DD4BF] font-mono text-[11px] font-bold">PASSED</span>
                </div>
                <div className="space-y-2 text-[12px] font-mono">
                  <div className="flex justify-between py-1 border-b border-[#D9DCD7]">
                    <span className="text-[#535D61]">Payee Address:</span>
                    <span className="text-[#111719] font-semibold">0x429A...38F1</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#D9DCD7]">
                    <span className="text-[#535D61]">Signing Key Match:</span>
                    <span className="text-[#111719]">secp256k1 Signature Verified</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#535D61]">EIP-712 Domain:</span>
                    <span className="text-[#345BEE]">HashX Global (Chain ID: 1)</span>
                  </div>
                </div>
              </div>

              {/* Delivery Witness */}
              <div className="p-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-mono text-[11px] text-[#535D61] uppercase font-bold">
                    02 / DELIVERY WITNESS
                  </span>
                  <span className="text-[#2DD4BF] font-mono text-[11px] font-bold">CONFIRMED</span>
                </div>
                <div className="space-y-2 text-[12px] font-mono">
                  <div className="flex justify-between py-1 border-b border-[#D9DCD7]">
                    <span className="text-[#535D61]">Artifact Hash:</span>
                    <span className="text-[#111719] font-semibold">bafybeicx4z7e9w...849</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#D9DCD7]">
                    <span className="text-[#535D61]">RPC Recomputation:</span>
                    <span className="text-[#2DD4BF]">Deterministic Consensus</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#535D61]">Output State Delta:</span>
                    <span className="text-[#111719] font-semibold">0 Delta Bytes</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-[#F4F2EB] flex flex-col md:flex-row justify-between items-center gap-4 text-[12px] font-mono">
              <div className="flex items-center space-x-3 w-full md:w-auto">
                <span className="text-[#535D61] uppercase font-bold">INVOICE DIGEST:</span>
                <code className="bg-[#FBFAF6] border border-[#D9DCD7] px-3 py-1 text-[#111719] text-xs rounded-sm">
                  0x8a9f24c01e389b42c9081e74f10928a4918e0a12
                </code>
              </div>
              <Link
                href="/app/trust"
                className="px-4 py-2 border border-[#111719] hover:bg-[#111719] hover:text-[#FBFAF6] text-[#111719] font-mono text-[11px] uppercase tracking-wider transition-colors rounded-sm"
              >
                Inspect Live Invoices
              </Link>
            </div>
          </div>
        </section>

        {/* DEVELOPER MCP SECTION */}
        <section className="py-16" id="mcp">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-5 pr-0 lg:pr-4">
              <span className="text-[11px] font-mono text-[#345BEE] block mb-1 uppercase tracking-wider font-semibold">
                DEVELOPER ARCHITECTURE
              </span>
              <h2 className="font-display text-[30px] sm:text-[36px] text-[#111719] tracking-tight uppercase font-semibold mb-4">
                Native Model Context Protocol (MCP).
              </h2>
              <p className="text-[14px] text-[#535D61] mb-6 leading-relaxed">
                HashX functions as the cryptographic verification middleware between autonomous AI agents and execution rails. We decouple commercial intent and fulfillment verification from raw payment settlement.
              </p>

              <div className="space-y-3 mb-6">
                <div className="p-3.5 border border-[#D9DCD7] bg-[#FBFAF6] rounded-sm">
                  <span className="font-display text-xs font-semibold uppercase block text-[#111719] mb-1">
                    Zero Private Key Exposure
                  </span>
                  <p className="text-[12px] text-[#535D61]">
                    Agents invoke standardized MCP tools. The private key never enters the LLM prompt or model context window.
                  </p>
                </div>
                <div className="p-3.5 border border-[#D9DCD7] bg-[#FBFAF6] rounded-sm">
                  <span className="font-display text-xs font-semibold uppercase block text-[#111719] mb-1">
                    Self-Describing JSON Schemas
                  </span>
                  <p className="text-[12px] text-[#535D61]">
                    Native compatibility with Claude Desktop, Cursor, LangChain, and autonomous multi-agent pipelines.
                  </p>
                </div>
              </div>

              {/* 8 Native Tools List */}
              <div className="p-4 bg-[#FBFAF6] border-l-2 border-[#345BEE] border-y border-r border-[#D9DCD7] rounded-sm">
                <span className="font-mono text-[10px] text-[#345BEE] font-bold uppercase tracking-wider block mb-2">
                  THE 8 NATIVE MCP VERIFICATION TOOLS
                </span>
                <div className="grid grid-cols-2 gap-2 text-[12px] font-mono text-[#111719]">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 bg-[#345BEE]" />
                    <code>create_invoice</code>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 bg-[#345BEE]" />
                    <code>verify_delivery</code>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 bg-[#345BEE]" />
                    <code>sign_invoice</code>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 bg-[#345BEE]" />
                    <code>request_payment</code>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 bg-[#345BEE]" />
                    <code>verify_invoice</code>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 bg-[#345BEE]" />
                    <code>get_payment_status</code>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 bg-[#345BEE]" />
                    <code>submit_delivery</code>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 bg-[#345BEE]" />
                    <code>get_receipt</code>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Code Terminal (7 cols) */}
            <div className="lg:col-span-7 bg-[#0A1012] border border-[#273137] p-6 text-[#F0F1ED] rounded">
              <div className="flex items-center justify-between border-b border-[#273137] pb-3 mb-4">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 bg-[#273137] rounded-full" />
                  <span className="w-2.5 h-2.5 bg-[#273137] rounded-full" />
                  <span className="w-2.5 h-2.5 bg-[#273137] rounded-full" />
                  <span className="font-mono text-[11px] text-[#91A0A5] pl-2">hashx_mcp_client.py (Conceptual Preview)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyCode}
                    className="flex items-center gap-1 font-mono text-[11px] text-[#91A0A5] hover:text-[#F0F1ED] transition-colors"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-[#2DD4BF]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? "COPIED" : "COPY"}</span>
                  </button>
                  <span className="font-mono text-[11px] text-[#2DD4BF] pl-2 border-l border-[#273137]">
                    MCP SPEC v2.4
                  </span>
                </div>
              </div>

              <pre className="font-mono text-[12px] text-[#F0F1ED] overflow-x-auto leading-relaxed py-2">
                <code>{pythonSnippet}</code>
              </pre>

              <div className="mt-4 pt-3 border-t border-[#273137] flex justify-between items-center font-mono text-[11px]">
                <span className="text-[#91A0A5]">CLIENT INTERFACE: CONCEPTUAL PREVIEW // MCP STREAMABLE HTTP</span>
                <Link href="/app/developers" className="text-[#2DD4BF] hover:underline flex items-center space-x-1">
                  <span>Explore Developer Registry</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* EDITORIAL FOOTER */}
      <footer className="w-full bg-[#FBFAF6] border-t border-[#D9DCD7]">
        <div className="w-full px-5 sm:px-8 lg:px-12 py-10 max-w-[1360px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <img
                src="/logo.png"
                alt="HashX"
                className="w-6 h-6 object-contain shrink-0 select-none drop-shadow-sm"
              />
              <span className="font-display text-sm text-[#111719] uppercase tracking-wide font-semibold">
                HashX
              </span>
              <span className="text-[11px] font-mono text-[#535D61] border-l border-[#D9DCD7] pl-2">
                THE TRUST LAYER FOR AGENT PAYMENTS
              </span>
            </div>
            <p className="text-[12px] text-[#535D61] max-w-md">
              Automation should move money. Verification should make it safe. All settlement reconciled to actual finality.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-mono">
            <Link className="text-[#535D61] hover:text-[#111719] transition-colors" href="/app">
              Console
            </Link>
            <Link className="text-[#535D61] hover:text-[#111719] transition-colors" href="/app/trust">
              Trust Inspector
            </Link>
            <Link className="text-[#535D61] hover:text-[#111719] transition-colors" href="/app/developers">
              MCP Tools
            </Link>
            <Link className="text-[#535D61] hover:text-[#111719] transition-colors" href="/app/demo">
              Proof Lab
            </Link>
            <span className="text-[#535D61] font-semibold">Status: HashKey Testnet 133 · HSP QA</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
