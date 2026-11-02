"use client";

import React, { useId, useRef, useState } from "react";
import { Check, Clock, Lock, FileSignature, Wallet, CircleDashed } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { IllustrativeLabel } from "./primitives";

/**
 * Hero visual: Seller agent → HashX trust layer → Buyer authorization → Settlement.
 * Every value is an illustrative fixture (labelled). Settlement is never shown as complete:
 * in the final stage it reads "awaiting on-chain confirmation", mirroring the real state machine.
 */

const STAGES = [
  {
    key: "signed",
    label: "Signed agreement",
    short: "Signed",
    caption:
      "The seller agent signs the exact terms — payee, amount, token, chain and expiry — as EIP-712 typed data. Any later change breaks the signature.",
  },
  {
    key: "verified",
    label: "Fulfillment verified",
    short: "Verified",
    caption:
      "HashX recomputes the delivered work from chain data and checks it against the seller's signed manifest. Only then can the payment be reviewed.",
  },
  {
    key: "authorized",
    label: "Payment authorization",
    short: "Authorized",
    caption:
      "A human payer reviews the exact obligation and signs the authorization in their own wallet. The transfer is verified on-chain before any receipt is issued.",
  },
] as const;

type Stage = 0 | 1 | 2;

export function TrustCircuit() {
  const [stage, setStage] = useState<Stage>(0);
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const last = STAGES.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = i === last ? 0 : i + 1;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = i === 0 ? last : i - 1;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    setStage(next as Stage);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-1 shadow-raised">
      {/* Stage selector */}
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div role="tablist" aria-label="Payment stage" className="grid grid-cols-3 gap-1 sm:flex">
          {STAGES.map((s, i) => {
            const active = stage === i;
            return (
              <button
                key={s.key}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                type="button"
                id={`${baseId}-tab-${i}`}
                aria-selected={active}
                aria-controls={`${baseId}-panel`}
                tabIndex={active ? 0 : -1}
                onClick={() => setStage(i as Stage)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cn(
                  "flex h-9 min-w-0 shrink-0 items-center justify-center gap-1 rounded-md px-1 text-xs transition-colors duration-150 sm:justify-start sm:gap-2 sm:px-3 sm:text-[13px]",
                  active ? "bg-surface-3 font-medium text-foreground" : "text-foreground-muted hover:text-foreground"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] tabular-nums transition-colors duration-200 sm:h-5 sm:w-5 sm:text-[11px]",
                    i < stage ? "bg-primary text-white" : active ? "bg-foreground text-white" : "bg-surface-3 text-foreground-muted"
                  )}
                >
                  {i < stage ? <Check className="h-3 w-3" strokeWidth={2.5} /> : i + 1}
                </span>
                <span className="truncate sm:hidden">{s.short}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>
        <IllustrativeLabel className="self-start sm:self-auto">Illustrative preview · sample data</IllustrativeLabel>
      </div>

      {/* Circuit */}
      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${stage}`}
        className="relative bg-background bg-[radial-gradient(rgb(var(--border-strong))_1px,transparent_1px)] [background-size:20px_20px] px-4 py-8 sm:px-8 sm:py-10"
      >
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-[minmax(0,1fr)_48px_minmax(0,0.92fr)_48px_minmax(0,1fr)_40px_minmax(0,0.72fr)]">
          <SellerNode active={stage === 0} />
          <Connector on={true} />
          <TrustNode stage={stage} />
          <Connector on={stage >= 1} />
          <BuyerNode stage={stage} />
          <Connector on={stage >= 2} />
          <SettlementNode stage={stage} />
        </div>
      </div>

      <p aria-live="polite" className="border-t border-border px-4 py-4 text-[14px] leading-relaxed text-foreground-secondary sm:px-5">
        <span className="font-medium text-foreground">{STAGES[stage].label}. </span>
        {STAGES[stage].caption}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ nodes */

function Connector({ on }: { on: boolean }) {
  return (
    <div aria-hidden="true" className="flex items-center justify-center py-1 lg:py-0">
      {/* vertical on mobile, horizontal on desktop */}
      <span
        className={cn(
          "block h-7 w-0 border-l-[1.5px] transition-colors duration-500 lg:h-0 lg:w-full lg:border-l-0 lg:border-t-[1.5px]",
          on ? "border-solid border-primary" : "border-dashed border-border-strong"
        )}
      />
    </div>
  );
}

function NodeCard({ active, children, className }: { active?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[360px] flex-col rounded-lg border bg-surface-1 transition-[border-color,box-shadow] duration-300 lg:max-w-none",
        active ? "border-primary/45 shadow-[0_0_0_3px_rgb(var(--primary)/0.08)]" : "border-border shadow-panel",
        className
      )}
    >
      {children}
    </div>
  );
}

function NodeHeader({ initials, title, sub }: { initials: string; title: string; sub: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
      <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-3 text-[11px] font-medium text-foreground-secondary">
        {initials}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium leading-tight text-foreground">{title}</div>
        <div className="truncate text-xs text-foreground-muted">{sub}</div>
      </div>
    </div>
  );
}

function Row({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-foreground-muted">{label}</span>
      <span className={cn("truncate text-right text-foreground", mono && "font-mono")}>{children}</span>
    </div>
  );
}

type CheckState = "pass" | "waiting" | "required";

function CheckLine({ state, children }: { state: CheckState; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
          state === "pass" ? "bg-success text-white" : "border border-dashed border-border-strong text-transparent"
        )}
      >
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
      <span className={cn("flex-1", state === "pass" ? "text-foreground" : "text-foreground-muted")}>{children}</span>
      <span className={cn("text-[11px]", state === "pass" ? "text-success" : "text-foreground-muted")}>
        {state === "pass" ? "Pass" : state === "waiting" ? "Waiting" : "Required"}
      </span>
    </li>
  );
}

function SellerNode({ active }: { active: boolean }) {
  return (
    <NodeCard active={active}>
      <NodeHeader initials="SA" title="Seller agent" sub={<span className="font-mono">0x8f3a…41c2</span>} />
      <div className="space-y-2 px-3.5 py-3">
        <Row label="Invoice" mono>inv_7f2c…e19a</Row>
        <Row label="Service">Address analytics</Row>
        <Row label="Amount">
          <span className="tabular-nums">2.50 USDC</span>
        </Row>
      </div>
      <div className="mt-auto flex items-center gap-1.5 border-t border-border px-3.5 py-2.5 text-xs text-success">
        <FileSignature className="h-3.5 w-3.5" aria-hidden="true" />
        Signed · EIP-712
      </div>
    </NodeCard>
  );
}

function TrustNode({ stage }: { stage: Stage }) {
  return (
    <div className="mx-auto flex w-full max-w-[360px] flex-col items-center rounded-lg border border-border bg-surface-1/90 px-3.5 pb-3.5 pt-4 shadow-panel lg:max-w-none">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface-1 shadow-panel">
        <LogoMark size={34} decorative />
      </div>
      <div className="mt-2.5 text-[13px] font-medium text-foreground">HashX trust layer</div>
      <ul className="mt-3 w-full space-y-2 border-t border-border pt-3">
        <CheckLine state="pass">Seller signature</CheckLine>
        <CheckLine state={stage >= 1 ? "pass" : "waiting"}>Delivery evidence</CheckLine>
        <CheckLine state={stage >= 2 ? "pass" : "required"}>Payer authorization</CheckLine>
      </ul>
    </div>
  );
}

function BuyerNode({ stage }: { stage: Stage }) {
  const status =
    stage === 0
      ? { icon: Lock, text: "Locked until evidence verifies", cls: "text-foreground-muted" }
      : stage === 1
        ? { icon: Clock, text: "Ready for payer review", cls: "text-warning" }
        : { icon: Wallet, text: "Authorized in payer wallet", cls: "text-success" };
  const Icon = status.icon;
  return (
    <NodeCard active={stage >= 1}>
      <NodeHeader initials="BP" title="Buyer approval" sub="Human payer" />
      <div className="space-y-2 px-3.5 py-3">
        <Row label="Pay">
          <span className="font-medium tabular-nums">2.50 USDC</span>
        </Row>
        <Row label="To" mono>0x8f3a…41c2</Row>
        <Row label="Network">Sepolia testnet</Row>
      </div>
      <div className={cn("mt-auto flex items-center gap-1.5 border-t border-border px-3.5 py-2.5 text-xs transition-colors duration-300", status.cls)}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {status.text}
      </div>
    </NodeCard>
  );
}

function SettlementNode({ stage }: { stage: Stage }) {
  const pending = stage === 2;
  return (
    <div className="mx-auto flex w-full max-w-[360px] flex-col justify-center rounded-lg border border-dashed border-border-strong bg-surface-1/70 px-3.5 py-4 lg:max-w-none">
      <div className="text-[13px] font-medium text-foreground">Settlement</div>
      <div className={cn("mt-2 flex items-start gap-1.5 text-xs leading-snug", pending ? "text-info" : "text-foreground-muted")}>
        {pending ? <Clock className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <CircleDashed className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        {pending ? "Pending · awaiting on-chain confirmation" : "Not started"}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-foreground-muted">Receipt issued only after the transfer is verified.</p>
    </div>
  );
}
