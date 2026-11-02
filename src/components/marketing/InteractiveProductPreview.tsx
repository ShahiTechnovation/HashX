"use client";

import React, { useId, useRef, useState } from "react";
import { FileSignature, ScanSearch, KeyRound, ReceiptText, Check, Clock, ShieldCheck, Lock, type LucideIcon } from "lucide-react";
import { DataList, DataRow } from "@/components/ui/DataList";
import { EvidenceCard } from "@/components/ui/EvidenceCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { cn } from "@/lib/utils";
import { SEPOLIA, SEPOLIA_USDC_ADDRESS } from "@shared/networks";
import { IllustrativeLabel, Reveal, SectionHeading } from "./primitives";

/*
 * Every value below is sample data, rendered with the same components the application uses.
 * The frame carries a permanent "Illustrative preview" label. Token contract and chain ID are
 * the real configured Sepolia values from shared/networks.
 */
const SAMPLE = {
  invoice: "inv_7f2c91d04be6e19a",
  seller: "0x8F3a6b1D2c94E07a5B1f0c3d9E2A7b4C6d8e41c2",
  payer: "0x2B71c0E9d4A35f86B0e1C7a92D3F5e6A8b0c19D4",
  invoiceDigest: "0x5e1c9a07d3b42f8e6a1d0c94b7e2f358a6c1d0e9f4b7a2c8e5d3f1a0b9c7e6d4",
  artifactSha: "sha256:9b2f4c7d1e8a3b60f5c2d9e7a4b1c8f3d6e0a2b5c9f8e7d4a1b3c6e9f2d5a8b0",
  authDigest: "0xa41d7e2c9b0f3e8d6c5a4b1e7f2d9c0b3a6e8f1d4c7b2a5e9f0d3c6b8a1e4f72",
  txHash: "0x3c8e1f0a7d4b2e9c6f5a1d8b3e0c7f4a9d2b6e1c5f8a3d0b7e4c9f2a6d1b5e83",
  receipt: "rcpt_4d19b7e0c2a8f356",
  receiptDigest: "0xd7b2e9f04c1a8e3b6d5f2c0a9e7b4d1f8c3a6e0b5d2f9c7a4e1b8d3f6c0a2e95",
};

const short = (v: string, a = 6, b = 4) => `${v.slice(0, a)}…${v.slice(-b)}`;

type TabKey = "intent" | "evidence" | "approval" | "receipt";
const TABS: Array<{ key: TabKey; label: string; icon: LucideIcon; path: string }> = [
  { key: "intent", label: "Signed Intent", icon: FileSignature, path: "Invoices" },
  { key: "evidence", label: "Evidence Verification", icon: ScanSearch, path: "Trust Inspector" },
  { key: "approval", label: "Human Approval", icon: KeyRound, path: "Approvals" },
  { key: "receipt", label: "Settlement Receipt", icon: ReceiptText, path: "Receipts" },
];

export function InteractiveProductPreview() {
  const [active, setActive] = useState<TabKey>("intent");
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const idx = TABS.findIndex((t) => t.key === active);

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const last = TABS.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = i === last ? 0 : i + 1;
    if (e.key === "ArrowLeft") next = i === 0 ? last : i - 1;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    setActive(TABS[next].key);
    tabRefs.current[next]?.focus();
  };

  return (
    <section id="product" aria-labelledby="product-title" className="section-y border-t border-border bg-surface-1">
      <div className="site-container">
        <SectionHeading
          id="product-title"
          align="center"
          eyebrow="Product"
          title="See what happens before a payment moves."
          description="Four records stand between an agent's request and a transfer. Each one is inspectable, copyable, and independently verifiable."
        />

        <Reveal className="mt-12 sm:mt-14">
          <div role="tablist" aria-label="Product preview" className="mx-auto grid w-full grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 ring-1 ring-inset ring-border sm:flex sm:w-max">
            {TABS.map((t, i) => {
              const Icon = t.icon;
              const selected = t.key === active;
              return (
                <button
                  key={t.key}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  role="tab"
                  type="button"
                  id={`${baseId}-tab-${t.key}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(t.key)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className={cn(
                    "flex h-10 min-w-0 shrink-0 items-center justify-center gap-2 rounded-md px-2.5 text-[13px] transition-[background-color,color,box-shadow] duration-200 sm:px-3.5 sm:text-[14px]",
                    selected
                      ? "bg-surface-1 font-medium text-foreground shadow-[0_0_0_1px_rgb(var(--border)),0_1px_2px_rgb(25_24_29/0.06)]"
                      : "text-foreground-muted hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", selected ? "text-primary" : "")} strokeWidth={1.75} aria-hidden="true" />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Product frame */}
          <div className="mx-auto mt-8 max-w-[1080px] overflow-hidden rounded-xl border border-border bg-surface-1 shadow-raised">
            <div className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-2 text-[13px]">
                <span className="hidden text-foreground-muted sm:inline">HashX</span>
                <span className="hidden text-foreground-muted/60 sm:inline" aria-hidden="true">/</span>
                <span className="text-foreground-muted">{TABS[idx].path}</span>
                <span className="text-foreground-muted/60" aria-hidden="true">/</span>
                <span className="truncate font-mono text-xs text-foreground">{short(SAMPLE.invoice, 8, 4)}</span>
              </div>
              <IllustrativeLabel className="shrink-0" />
            </div>

            <div
              id={`${baseId}-panel`}
              role="tabpanel"
              aria-labelledby={`${baseId}-tab-${active}`}
              tabIndex={0}
              className="grid min-h-[520px] focus-visible:outline-none lg:min-h-[440px]"
            >
              <div key={active} className="grid animate-crossfade">
                {active === "intent" && <IntentPreview />}
                {active === "evidence" && <EvidencePreview />}
                {active === "approval" && <ApprovalPreview />}
                {active === "receipt" && <ReceiptPreview />}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- previews */

function PreviewGrid({ main, side }: { main: React.ReactNode; side: React.ReactNode }) {
  return (
    <div className="grid h-full lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="p-5 sm:p-7">{main}</div>
      <div className="border-t border-border bg-background/60 p-5 sm:p-7 lg:border-l lg:border-t-0">{side}</div>
    </div>
  );
}

function PreviewTitle({ eyebrow, title, badge }: { eyebrow: string; title: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-xs text-foreground-muted">{eyebrow}</div>
        <div className="mt-1 text-[20px] font-medium tracking-[-0.022em] text-foreground">{title}</div>
      </div>
      {badge}
    </div>
  );
}

function SideHeading({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 text-[13px] font-medium text-foreground">{children}</div>;
}

function IntentPreview() {
  return (
    <PreviewGrid
      main={
        <>
          <PreviewTitle eyebrow="Invoice" title="Address analytics · 20 blocks" badge={<StatusBadge type="invoice" status="SIGNED" />} />
          <DataList>
            <DataRow label="Seller">
              <span className="flex flex-col gap-0.5">
                <span>Analytics agent</span>
                <CopyableValue value={SAMPLE.seller} displayText={short(SAMPLE.seller)} label="Copy seller address" />
              </span>
            </DataRow>
            <DataRow label="Buyer reference">buyer-job-analytics-0142</DataRow>
            <DataRow label="Amount">
              <span className="font-medium tabular-nums">2.50 USDC</span>
              <span className="ml-2 font-mono text-xs text-foreground-muted">2500000 units</span>
            </DataRow>
            <DataRow label="Network">
              {SEPOLIA.shortName} <span className="font-mono text-xs text-foreground-muted">· {SEPOLIA.chainId}</span>
            </DataRow>
            <DataRow label="Expires">Nov 03, 2026 · 14:00 UTC</DataRow>
          </DataList>
        </>
      }
      side={
        <>
          <SideHeading>Signature</SideHeading>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-foreground-muted">EIP-712 domain</div>
              <div className="mt-1 text-[13px] text-foreground">
                HashX · version 2 · chain <span className="font-mono text-xs">{SEPOLIA.chainId}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-foreground-muted">Invoice digest</div>
              <CopyableValue className="mt-1" value={SAMPLE.invoiceDigest} displayText={short(SAMPLE.invoiceDigest, 14, 8)} label="Copy invoice digest" />
            </div>
            <div className="flex items-start gap-2.5 rounded-md border border-success/25 bg-success/[0.05] p-3">
              <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <p className="text-[13px] leading-snug text-foreground-secondary">
                <span className="font-medium text-foreground">Recovered signer matches the seller.</span> Changing the payee, amount, token or
                expiry invalidates this signature.
              </p>
            </div>
          </div>
        </>
      }
    />
  );
}

const CHECKS = [
  {
    name: "invoice_signature",
    detail: { status: "PASS" as const, rule: "EIP-712 signer recovers to the invoice seller", explanation: "The typed-data signature was recovered against the stored terms." },
  },
  {
    name: "artifact_hash",
    detail: {
      status: "PASS" as const,
      rule: "Artifact bytes hash to the manifest's SHA-256",
      explanation: "Canonical JSON of the delivered artifact was re-hashed and compared with the signed manifest.",
      expected: short(SAMPLE.artifactSha, 18, 6),
      actual: short(SAMPLE.artifactSha, 18, 6),
    },
  },
  {
    name: "manifest_signature",
    detail: { status: "PASS" as const, rule: "Delivery manifest signed by the seller", explanation: "The manifest signature recovers to the invoice seller and binds to this invoice." },
  },
  {
    name: "tx_count_recomputed",
    detail: {
      status: "PASS" as const,
      rule: "Seller's result matches independent chain recomputation",
      explanation: "HashX re-read the agreed block range from RPC and recomputed the result.",
      expected: "14 transactions",
      actual: "14 transactions",
    },
  },
];

const BLOCKING = [
  { code: "ARTIFACT_TAMPERED", text: "Artifact bytes don't match the signed hash" },
  { code: "TX_COUNT_MISMATCH", text: "Claimed result differs from recomputation" },
  { code: "MANIFEST_SIGNATURE_INVALID", text: "Manifest not signed by the seller" },
];

function EvidencePreview() {
  return (
    <PreviewGrid
      main={
        <>
          <PreviewTitle eyebrow="Verification run" title="Eligible for payment review" badge={<StatusBadge type="verdict" status="PASS" />} />
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="divide-y divide-border">
              {CHECKS.map((c, i) => (
                <EvidenceCard key={c.name} name={c.name} detail={c.detail} index={i + 1} defaultExpanded={i === 3} />
              ))}
            </div>
          </div>
        </>
      }
      side={
        <>
          <SideHeading>What would block payment</SideHeading>
          <ul className="space-y-3">
            {BLOCKING.map((b) => (
              <li key={b.code} className="text-[13px]">
                <span className="inline-flex h-[22px] items-center rounded bg-danger/10 px-2 font-mono text-[11px] font-medium text-danger ring-1 ring-inset ring-danger/25">
                  {b.code}
                </span>
                <p className="mt-1 text-foreground-secondary">{b.text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-[13px] text-foreground-secondary">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <p>
              If chain data can&apos;t be read, the verdict is <span className="font-medium text-warning">Pending</span> — never a pass.
            </p>
          </div>
        </>
      }
    />
  );
}

function ApprovalPreview() {
  return (
    <PreviewGrid
      main={
        <>
          <PreviewTitle eyebrow="Payment authorization" title="Review the exact obligation" badge={
              <span className="inline-flex h-6 items-center gap-1.5 rounded-[6px] bg-warning/10 px-2 text-xs font-medium text-warning ring-1 ring-inset ring-warning/20">
                <Clock className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                Awaiting Stage 2
              </span>
            } />
          <div>
            <div className="text-xs text-foreground-muted">You authorize</div>
            <div className="mt-1 text-[36px] font-medium leading-none tracking-[-0.035em] tabular-nums text-foreground">
              2.50 <span className="text-[22px] text-foreground-secondary">USDC</span>
            </div>
            <div className="mt-2 font-mono text-xs text-foreground-muted">2500000 raw units · 6 decimals · test token</div>
          </div>
          <DataList className="mt-6">
            <DataRow label="Payer">
              <CopyableValue value={SAMPLE.payer} displayText={short(SAMPLE.payer)} label="Copy payer address" />
            </DataRow>
            <DataRow label="Payee">
              <CopyableValue value={SAMPLE.seller} displayText={short(SAMPLE.seller)} label="Copy payee address" />
            </DataRow>
            <DataRow label="Token contract">
              <CopyableValue value={SEPOLIA_USDC_ADDRESS} displayText={short(SEPOLIA_USDC_ADDRESS)} label="Copy token contract" />
            </DataRow>
            <DataRow label="Network">
              {SEPOLIA.name} <span className="font-mono text-xs text-foreground-muted">· {SEPOLIA.chainId}</span>
            </DataRow>
          </DataList>
        </>
      }
      side={
        <>
          <SideHeading>Authorization</SideHeading>
          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-white">
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
              </span>
              <div className="text-[13px]">
                <div className="font-medium text-foreground">Stage 1 · Terms approved</div>
                <div className="text-foreground-muted">Payer confirmed the obligation digest</div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary text-[11px] font-medium text-primary-light">2</span>
              <div className="text-[13px]">
                <div className="font-medium text-foreground">Stage 2 · Wallet signature</div>
                <div className="text-foreground-muted">EIP-712 HashXPaymentAuthorization</div>
              </div>
            </li>
          </ol>
          <div className="mt-6 border-t border-border pt-5">
            <button type="button" disabled className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-md bg-primary text-[14px] font-medium text-white opacity-90">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Sign authorization in wallet
            </button>
            <p className="mt-3 flex items-start gap-1.5 text-xs leading-snug text-foreground-muted">
              <Lock className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Only the payer&apos;s wallet session can perform this step. No agent credential or MCP tool can.
            </p>
          </div>
        </>
      }
    />
  );
}

const SETTLEMENT_STEPS = [
  { label: "Authorized", state: "done" },
  { label: "Submitted", state: "done" },
  { label: "Included", state: "done" },
  { label: "Confirmed", state: "done" },
  { label: "Finalized", state: "pending" },
] as const;

function ReceiptPreview() {
  return (
    <PreviewGrid
      main={
        <>
          <PreviewTitle
            eyebrow="Settlement"
            title="Transfer verified on-chain"
            badge={
              <span className="inline-flex h-6 items-center gap-1.5 rounded-[6px] bg-success/10 px-2 text-xs font-medium text-success ring-1 ring-inset ring-success/20">
                <Check className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                Confirmed
              </span>
            }
          />
          <ol className="grid grid-cols-5 gap-2" aria-label="Settlement progress">
            {SETTLEMENT_STEPS.map((s) => (
              <li key={s.label}>
                <span className={cn("block h-1 rounded-full", s.state === "done" ? "bg-success" : "bg-border-strong")} aria-hidden="true" />
                <span className={cn("mt-2 block text-xs", s.state === "done" ? "text-foreground" : "text-foreground-muted")}>
                  {s.label}
                  <span className="sr-only">{s.state === "done" ? " (complete)" : " (pending)"}</span>
                </span>
              </li>
            ))}
          </ol>
          <DataList className="mt-7">
            <DataRow label="Chain">
              {SEPOLIA.name} <span className="font-mono text-xs text-foreground-muted">· {SEPOLIA.chainId}</span>
            </DataRow>
            <DataRow label="Token">Test USDC · 2.50</DataRow>
            <DataRow label="Transaction">
              <CopyableValue value={SAMPLE.txHash} displayText={short(SAMPLE.txHash, 10, 8)} label="Copy transaction hash" />
            </DataRow>
            <DataRow label="Confirmations">
              <span className="tabular-nums">12 of 12 required</span>
            </DataRow>
          </DataList>
        </>
      }
      side={
        <>
          <SideHeading>Receipt</SideHeading>
          <div className="rounded-lg border border-border bg-surface-1 p-4 shadow-panel">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-foreground">{SAMPLE.receipt}</span>
              <span className="text-xs text-foreground-muted">hashx.receipt.v2</span>
            </div>
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <div>
                <div className="text-xs text-foreground-muted">Receipt digest</div>
                <CopyableValue className="mt-1" value={SAMPLE.receiptDigest} displayText={short(SAMPLE.receiptDigest, 12, 8)} label="Copy receipt digest" />
              </div>
              <div>
                <div className="text-xs text-foreground-muted">Binds</div>
                <div className="mt-1 text-[13px] text-foreground-secondary">Invoice · delivery evidence · authorization · transfer</div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-foreground-muted">
            Receipts are issued only once the transfer meets the confirmation policy. Finality is tracked separately and shown as pending until reached.
          </p>
        </>
      }
    />
  );
}
