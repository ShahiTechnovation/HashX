"use client";

import React, { useEffect, useState } from "react";
import { Check, Play, ShieldAlert } from "lucide-react";
import { FinalityTrack } from "@/components/ui/FinalityTrack";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { HSPStatus } from "@/types/domain";
import { cn } from "@/lib/utils";
import { Code } from "./primitives";

/**
 * Hero visual: one obligation moving through the HashX trust pipeline.
 * A left rail tracks stage progression; the right pane shows the artifact
 * each stage produces; the footer accumulates the evidence trail.
 */

const STAGES = [
  { key: "invoice", label: "Invoice", sub: "EIP-712 signed", ticks: 4, evidence: { k: "invoice", v: "0x5a6b…a6b7" } },
  { key: "verify", label: "Verification", sub: "6 of 6 checks", ticks: 4, evidence: { k: "verdict", v: "0x3c4d…e5f6" } },
  { key: "fulfill", label: "Fulfillment", sub: "RPC recomputed", ticks: 4, evidence: { k: "delivery", v: "0x8a9b…0c1c" } },
  { key: "approve", label: "Human approval", sub: "2 of 2 stages", ticks: 4, evidence: { k: "approval", v: "0x6e7f…9a0b" } },
  { key: "settle", label: "Settlement", sub: "HSP rail", ticks: 7, evidence: { k: "tx", v: "0x4b7c…6b7c" } },
  { key: "receipt", label: "Receipt", sub: "Anchored", ticks: 5, evidence: { k: "receipt", v: "0xc41f…2d90" } },
] as const;

const STARTS: number[] = STAGES.reduce<number[]>((acc, s, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + STAGES[i - 1].ticks);
  return acc;
}, []);
const TOTAL = STAGES.reduce((n, s) => n + s.ticks, 0);
const TICK_MS = 750;

/** Within the settlement stage: submitted → processing → included → safe (held) → finalized. */
const HSP_BY_TICK: HSPStatus[] = [
  "payment-submitted",
  "payment-processing",
  "payment-included",
  "payment-safe",
  "payment-safe",
  "payment-finalized",
  "payment-finalized",
];

function locate(tick: number) {
  let active = 0;
  for (let i = 0; i < STAGES.length; i++) if (tick >= STARTS[i]) active = i;
  return { active, local: tick - STARTS[active] };
}

export function TrustPipelineVisual() {
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTick(STARTS[5] + 2);
      setPaused(true);
    }
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setTick((t) => (t + 1) % TOTAL), TICK_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const { active, local } = locate(tick);
  const hsp: HSPStatus | null = active === 4 ? HSP_BY_TICK[Math.min(local, HSP_BY_TICK.length - 1)] : active > 4 ? "payment-finalized" : null;
  const isDone = (i: number) => i < active || (i === 5 && active === 5 && local >= 2);

  const select = (i: number) => {
    setPaused(true);
    setTick(STARTS[i] + (i === 4 ? 5 : i === 5 ? 2 : 1));
  };

  return (
    <div className="relative">
      <div className="relative rounded-lg border border-border bg-surface-1 shadow-raised overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 h-11 px-4 border-b border-border bg-surface-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xs text-foreground-muted">Obligation</span>
            <span className="font-mono text-xs text-foreground truncate">inv-golden-path-scenario-d</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline font-mono text-2xs text-foreground-muted">chain 133</span>
            {paused ? (
              <button
                type="button"
                onClick={() => setPaused(false)}
                className="inline-flex items-center gap-1 h-6 px-2 rounded text-2xs text-foreground-muted hover:text-foreground hover:bg-surface-3 transition-colors"
              >
                <Play className="w-3 h-3" />
                Resume
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-2xs text-foreground-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-info" aria-hidden="true" />
                Illustrative replay
              </span>
            )}
          </div>
        </div>

        {/* Parties strip */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2.5 border-b border-border bg-background/40 text-2xs">
          <div className="min-w-0">
            <span className="text-foreground-muted">Seller</span>
            <div className="text-foreground-secondary truncate">Nexus Analytics Agent</div>
          </div>
          <div className="text-center">
            <div className="font-display text-[15px] font-medium tabular-nums text-foreground leading-none">1.00 USDT</div>
            <div className="font-mono text-[10px] text-foreground-muted mt-1">1000000 raw · 6 dp</div>
          </div>
          <div className="min-w-0 text-right">
            <span className="text-foreground-muted">Buyer</span>
            <div className="text-foreground-secondary truncate">Treasury Agent alpha</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[176px_1fr]">
          {/* Stage rail */}
          <ol className="relative border-b sm:border-b-0 sm:border-r border-border px-3 py-3 grid grid-cols-6 sm:grid-cols-1 sm:gap-0.5" aria-label="Pipeline stages">
            {STAGES.map((s, i) => {
              const done = isDone(i);
              const current = i === active && !done;
              return (
                <li key={s.key} className="relative">
                  {i < STAGES.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "hidden sm:block absolute left-[15px] top-[25px] -bottom-[9px] w-px",
                        i < active ? "bg-border-strong" : "bg-border"
                      )}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => select(i)}
                    aria-current={i === active ? "step" : undefined}
                    className={cn(
                      "relative w-full flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-2.5 rounded-md px-1.5 py-1.5 text-center sm:text-left transition-colors",
                      i === active ? "sm:bg-surface-2/80" : "hover:bg-surface-2/40"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-px flex items-center justify-center w-[18px] h-[18px] shrink-0 rounded-full ring-1 transition-colors duration-300",
                        done
                          ? "bg-surface-3 ring-border-strong text-success"
                          : current
                          ? "bg-primary/15 ring-primary/60"
                          : "bg-background ring-border"
                      )}
                    >
                      {done ? (
                        <Check className="w-2.5 h-2.5" strokeWidth={3} />
                      ) : current ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-[10px] sm:text-xs leading-tight transition-colors duration-300",
                          i === active ? "text-foreground font-medium" : done ? "text-foreground-secondary" : "text-foreground-muted"
                        )}
                      >
                        {s.label}
                      </span>
                      <span className="hidden sm:block text-2xs text-foreground-muted mt-0.5">
                        {i === 4 && hsp && i === active ? (hsp === "payment-safe" ? "Safe · not final" : hsp.replace("payment-", "")) : done || i === active ? s.sub : "Waiting"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Inspector */}
          <div className="min-w-0 flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
              <span className="text-2xs text-foreground-muted">
                Stage <span className="tabular-nums">{String(active + 1).padStart(2, "0")}</span> / 06
              </span>
              <span className="text-2xs text-foreground-muted">{STAGES[active].label}</span>
            </div>
            <div key={active} className="px-4 pt-3 pb-4 min-h-[276px] animate-fade-in">
              {active === 0 && <InvoicePane />}
              {active === 1 && <VerifyPane local={local} />}
              {active === 2 && <FulfillPane />}
              {active === 3 && <ApprovePane local={local} />}
              {active === 4 && hsp && <SettlePane status={hsp} />}
              {active === 5 && <ReceiptPane anchored={local >= 2} />}
            </div>
          </div>
        </div>

        {/* Evidence trail */}
        <div className="flex items-center gap-3 px-4 h-10 border-t border-border bg-background/40 overflow-hidden">
          <span className="text-2xs text-foreground-muted shrink-0">Evidence</span>
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            {STAGES.map((s, i) => (
              <span
                key={s.key}
                className={cn(
                  "font-mono text-[10px] whitespace-nowrap px-1.5 h-5 inline-flex items-center rounded-[4px] transition-colors duration-300",
                  isDone(i) ? "bg-surface-3/80 text-foreground-secondary" : "text-foreground-muted/40"
                )}
              >
                {isDone(i) ? s.evidence.v : "·······"}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* A second obligation, gated */}
      <div className="relative mt-3 ml-auto w-full sm:w-[86%] rounded-lg border border-border bg-surface-1 shadow-raised overflow-hidden">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-danger/80" />
        <div className="flex items-center gap-3 pl-4 pr-3 py-2.5">
          <ShieldAlert className="w-4 h-4 text-danger shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-2xs text-foreground truncate">inv-tampered-scenario-a</span>
              <Code tone="danger">SIGNATURE_INVALID</Code>
            </div>
            <div className="text-2xs text-foreground-muted mt-0.5 truncate">Payee changed after signing · recovered signer does not match seller</div>
          </div>
          <span className="hidden sm:inline text-2xs font-medium text-danger shrink-0">Payment gated</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stage panes                                                         */
/* ------------------------------------------------------------------ */

function Row({ k, v, mono = true, tone }: { k: string; v: React.ReactNode; mono?: boolean; tone?: "success" | "warning" }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[7px]">
      <span className={cn("text-2xs text-foreground-muted", mono && "font-mono")}>{k}</span>
      <span
        className={cn(
          "text-2xs truncate tabular-nums",
          mono && "font-mono",
          tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground-secondary"
        )}
      >
        {v}
      </span>
    </div>
  );
}

function PaneTitle({ title, meta }: { title: string; meta?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2">
      <span className="text-[13px] font-medium text-foreground">{title}</span>
      {meta}
    </div>
  );
}

function InvoicePane() {
  return (
    <div>
      <PaneTitle title="Structured invoice" meta={<Code>HashXInvoice v1</Code>} />
      <div className="divide-y divide-border/60">
        <Row k="seller" v="0x742d…f44e" />
        <Row k="payee" v="0x742d…f44e" />
        <Row k="amount_minor" v="100" />
        <Row k="chain_id" v="133" />
        <Row k="nonce" v="1004" />
        <Row k="terms_hash" v="0x2f1e…9c4a" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-background/60 border border-border/80 px-2.5 py-2">
        <span className="text-2xs text-foreground-muted">EIP-712 digest</span>
        <span className="font-mono text-2xs text-primary-light">0x5a6b…a6b7</span>
      </div>
    </div>
  );
}

const INVOICE_CHECKS = ["schema", "signature", "identity_binding", "expiry", "nonce_unused", "terms_consistent"];

function VerifyPane({ local }: { local: number }) {
  // Reveal checks progressively across the stage's ticks.
  const revealed = Math.min(INVOICE_CHECKS.length, 2 + local * 2);
  const complete = revealed === INVOICE_CHECKS.length;
  return (
    <div>
      <PaneTitle
        title="Deterministic verification"
        meta={complete ? <StatusBadge status="PASS" type="verdict" size="sm" /> : <span className="text-2xs text-info">Running</span>}
      />
      <ul className="divide-y divide-border/60">
        {INVOICE_CHECKS.map((c, i) => {
          const shown = i < revealed;
          return (
            <li key={c} className="flex items-center justify-between gap-3 py-[7px]">
              <span className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-foreground-muted/70 tabular-nums w-4">{String(i + 1).padStart(2, "0")}</span>
                <span className={cn("font-mono text-2xs", shown ? "text-foreground-secondary" : "text-foreground-muted/60")}>{c}</span>
              </span>
              {shown ? (
                <span className="inline-flex items-center gap-1 text-2xs text-success">
                  <Check className="w-3 h-3" strokeWidth={2.5} />
                  Pass
                </span>
              ) : (
                <span className="text-2xs text-foreground-muted/60">Queued</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-2xs text-foreground-muted">Same input, same verdict. No model judgment in the payment path.</p>
    </div>
  );
}

function FulfillPane() {
  const rows = [
    { m: "block_range", claimed: "1205000–1205500", rpc: "1205000–1205500" },
    { m: "tx_count", claimed: "14", rpc: "14" },
    { m: "sample_proofs", claimed: "2", rpc: "2 included" },
    { m: "artifact_sha256", claimed: "0x91c2…77ae", rpc: "0x91c2…77ae" },
  ];
  return (
    <div>
      <PaneTitle title="Claimed vs recomputed" meta={<span className="text-2xs text-foreground-muted">HashKey Chain RPC</span>} />
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-2xs">
        <span className="text-foreground-muted py-1.5 border-b border-border">Fact</span>
        <span className="text-foreground-muted py-1.5 border-b border-border text-right">Seller claim</span>
        <span className="text-foreground-muted py-1.5 border-b border-border text-right">Chain</span>
        {rows.map((r) => (
          <React.Fragment key={r.m}>
            <span className="font-mono text-foreground-secondary py-[7px] border-b border-border/60">{r.m}</span>
            <span className="font-mono text-foreground-secondary py-[7px] border-b border-border/60 text-right tabular-nums">{r.claimed}</span>
            <span className="font-mono text-success py-[7px] border-b border-border/60 text-right tabular-nums">{r.rpc}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-2xs">
        <span className="text-foreground-muted">A mismatch would fail with</span>
        <Code>TX_COUNT_MISMATCH</Code>
      </div>
    </div>
  );
}

function ApprovePane({ local }: { local: number }) {
  const stage2 = local >= 2;
  return (
    <div>
      <PaneTitle title="Exact-amount authorization" meta={<span className="text-2xs text-warning tabular-nums">Quote expires 04:12</span>} />
      <div className="flex items-end justify-between gap-4 pb-3 border-b border-border/60">
        <div>
          <div className="font-display text-[26px] leading-none font-medium tracking-[-0.03em] tabular-nums text-foreground">1.00 USDT</div>
          <div className="mt-1.5 font-mono text-2xs text-foreground-muted">raw 1000000 · decimals 6</div>
        </div>
        <div className="text-right">
          <div className="text-2xs text-foreground-muted">Payee</div>
          <div className="font-mono text-2xs text-foreground-secondary">0x742d…f44e</div>
        </div>
      </div>
      <ol className="mt-3 space-y-2">
        <ApprovalStep n={1} label="Approve signing" by="Operator · wallet signature" done />
        <ApprovalStep n={2} label="Approve submission" by={stage2 ? "Operator · submitted to HSP" : "Awaiting operator"} done={stage2} />
      </ol>
    </div>
  );
}

function ApprovalStep({ n, label, by, done }: { n: number; label: string; by: string; done: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={cn(
          "flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-medium tabular-nums shrink-0 ring-1",
          done ? "bg-surface-3 ring-border-strong text-success" : "bg-warning/10 ring-warning/30 text-warning"
        )}
      >
        {done ? <Check className="w-3 h-3" strokeWidth={2.75} /> : n}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs text-foreground">
          Stage {n} · {label}
        </span>
        <span className="block text-2xs text-foreground-muted">{by}</span>
      </span>
    </li>
  );
}

function SettlePane({ status }: { status: HSPStatus }) {
  return (
    <div>
      <PaneTitle title="HSP reconciliation" meta={<StatusBadge status={status} type="hsp" size="sm" />} />
      <div className="py-3">
        <FinalityTrack status={status} />
      </div>
      <div className="divide-y divide-border/60 border-t border-border/60">
        <Row k="flow_id" v="hsp-flow-90124" />
        <Row k="tx_hash" v={status === "payment-submitted" ? "pending" : "0x4b7c…6b7c"} />
        <Row
          k="receipt"
          mono={false}
          v={status === "payment-finalized" ? "Released on finality" : "Withheld until finalized"}
          tone={status === "payment-finalized" ? "success" : "warning"}
        />
      </div>
    </div>
  );
}

function ReceiptPane({ anchored }: { anchored: boolean }) {
  const inputs = [
    { k: "invoice_digest", v: "0x5a6b…a6b7" },
    { k: "delivery_digest", v: "0x8a9b…0c1c" },
    { k: "approval_digest", v: "0x6e7f…9a0b" },
    { k: "settlement_tx", v: "0x4b7c…6b7c" },
  ];
  return (
    <div>
      <PaneTitle title="Verifiable receipt" meta={<span className="font-mono text-2xs text-foreground-muted">rcpt-golden-001</span>} />
      <div className="relative pl-4">
        <span aria-hidden="true" className="absolute left-0 top-2 bottom-2 w-2.5 border-l border-y border-border-strong rounded-l-[3px]" />
        {inputs.map((x) => (
          <Row key={x.k} k={x.k} v={x.v} />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-md bg-background/60 border border-border/80 px-2.5 py-2">
        <span className="text-2xs text-foreground-muted">Commitment</span>
        <span className="font-mono text-2xs text-foreground">0xc41f…2d90</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between text-2xs">
        <span className="text-foreground-muted">Evidence registry</span>
        {anchored ? (
          <span className="inline-flex items-center gap-1 text-success">
            <Check className="w-3 h-3" strokeWidth={2.5} />
            Anchored · 0x8e9f…8e9f
          </span>
        ) : (
          <span className="text-info">Anchoring…</span>
        )}
      </div>
    </div>
  );
}
