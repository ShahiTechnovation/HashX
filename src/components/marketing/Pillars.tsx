import React from "react";
import Link from "next/link";
import { ArrowRight, Check, X, Clock } from "lucide-react";
import { FinalityTrack } from "@/components/ui/FinalityTrack";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { Code, ProofList, Section, SectionIntro, fadeMask } from "./primitives";

export function Pillars() {
  return (
    <Section>
      <SectionIntro
        eyebrow="The platform"
        title="Verify. Authorize. Settle."
        description="Three gates, strictly in order. Nothing reaches the payment rail without clearing the one before it — and every gate leaves evidence behind."
      />

      {/* 01 — Verify: text left, evidence panel right */}
      <div className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        <div className="lg:col-span-5">
          <PillarHeading n="01" title="Verify" />
          <p className="mt-4 text-[15px] leading-relaxed text-foreground-secondary">
            Every invoice is authenticated against its EIP-712 signature and seller registry. Every delivery is recomputed from HashKey
            Chain RPC — the seller&apos;s claim is an input, never the answer.
          </p>
          <ProofList
            className="mt-6"
            items={[
              <>Six invoice checks and eight delivery checks, each with a stable reason code.</>,
              <>Expected and recomputed values are preserved side by side for audit.</>,
            ]}
          />
          <PillarLink href="/app/trust/inv-fake-fulfillment-scenario-b">Inspect a rejected delivery</PillarLink>
        </div>

        <div className="lg:col-span-7">
          <VerifyVisual />
        </div>
      </div>

      {/* 02 Authorize + 03 Settle: asymmetric pair split by a hairline */}
      <div className="mt-20 pt-16 border-t border-border grid grid-cols-1 lg:grid-cols-12 gap-y-16">
        <div className="lg:col-span-5 lg:pr-12">
          <PillarHeading n="02" title="Authorize" />
          <p className="mt-4 text-[15px] leading-relaxed text-foreground-secondary">
            A human approves the exact terms twice — once to sign, once to submit. The amount is shown in raw token units so nothing is
            rounded away.
          </p>
          <AuthorizeVisual />
          <ProofList
            className="mt-6"
            items={[<>Expired quotes block approval and require a re-quote.</>, <>Payee, token contract, and decimals shown before any signature.</>]}
          />
          <PillarLink href="/app/approvals">Open the approval queue</PillarLink>
        </div>

        <div className="lg:col-span-7 lg:pl-12 lg:border-l lg:border-border">
          <PillarHeading n="03" title="Settle" />
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-foreground-secondary">
            Payment moves on the HSP rail. HashX reconciles every status transition and treats <em className="not-italic text-foreground">safe</em>{" "}
            and <em className="not-italic text-foreground">finalized</em> as different facts. A receipt is issued only on finality.
          </p>
          <SettleVisual />
          <ProofList
            className="mt-6"
            items={[<>Timeouts recover by querying existing IDs — orders are never recreated.</>, <>Settlement tx and evidence digest anchored for the receipt.</>]}
          />
          <PillarLink href="/app/settlements">Open Settlement Explorer</PillarLink>
        </div>
      </div>
    </Section>
  );
}

function PillarHeading({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-xs tabular-nums text-foreground-muted">{n}</span>
      <h3 className="font-display font-semibold text-[26px] tracking-[-0.03em] text-foreground">{title}</h3>
    </div>
  );
}

function PillarLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group mt-7 inline-flex items-center gap-1.5 text-[13px] text-foreground hover:text-primary-light transition-colors">
      {children}
      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/* ------------------------------------------------------------------ */

const DELIVERY_CHECKS: Array<{ name: string; rule: string; status: "PASS" | "FAIL" }> = [
  { name: "manifest_signature", rule: "Manifest signed by seller wallet", status: "PASS" },
  { name: "artifact_hash", rule: "SHA-256 byte integrity", status: "PASS" },
  { name: "block_range", rule: "Block range matches agreement", status: "PASS" },
  { name: "transaction_count", rule: "Deterministic RPC transaction count", status: "FAIL" },
  { name: "sample_transaction_proofs", rule: "Samples included in range", status: "PASS" },
];

function VerifyVisual() {
  return (
    <div className="rounded-lg border border-border bg-surface-1 shadow-raised overflow-hidden">
      <div className="relative flex items-center justify-between gap-4 pl-5 pr-4 py-4 border-b border-border">
        <span aria-hidden="true" className="absolute left-0 inset-y-0 w-0.5 bg-danger/80" />
        <div className="min-w-0">
          <div className="text-2xs text-foreground-muted">Delivery verification</div>
          <div className="mt-1 flex items-center gap-2.5">
            <span className="font-display text-xl font-medium tracking-[-0.02em] text-foreground">Rejected</span>
            <span className="text-xs text-danger">Payment gated</span>
          </div>
        </div>
        <span className="font-mono text-2xs text-foreground-muted truncate">del-fake-scenario-b</span>
      </div>
      <ul className="divide-y divide-border/60">
        {DELIVERY_CHECKS.map((c, i) => {
          const fail = c.status === "FAIL";
          return (
            <li key={c.name} className={cn(fail && "bg-danger/[0.04]")}>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={cn(
                    "flex items-center justify-center w-[18px] h-[18px] rounded-full shrink-0",
                    fail ? "bg-danger/15 text-danger" : "bg-success/15 text-success"
                  )}
                >
                  {fail ? <X className="w-3 h-3" strokeWidth={2.75} /> : <Check className="w-3 h-3" strokeWidth={2.75} />}
                </span>
                <span className="hidden sm:block w-5 font-mono text-2xs text-foreground-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-foreground/90">{c.name}</span>
                    {fail && <Code tone="danger">TX_COUNT_MISMATCH</Code>}
                  </span>
                  <span className="block text-2xs text-foreground-muted mt-0.5 truncate">{c.rule}</span>
                </span>
                <span className={cn("text-2xs font-medium uppercase tracking-wider", fail ? "text-danger" : "text-success")}>
                  {fail ? "Fail" : "Pass"}
                </span>
              </div>
              {fail && (
                <div className="grid grid-cols-2 mx-4 mb-3 sm:ml-[62px] rounded-md border border-border overflow-hidden">
                  <div className="p-2.5 bg-background/60">
                    <div className="eyebrow mb-1">Seller claim</div>
                    <div className="font-mono text-xs text-foreground/90 tabular-nums">tx_count: 23</div>
                  </div>
                  <div className="p-2.5 border-l border-border bg-danger/[0.06]">
                    <div className="eyebrow mb-1 text-danger/80">Recomputed · RPC</div>
                    <div className="font-mono text-xs text-danger tabular-nums">tx_count: 17</div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AuthorizeVisual() {
  return (
    <div className="mt-8 rounded-lg border border-border bg-surface-1 shadow-raised overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 h-10 border-b border-border">
        <span className="text-xs text-foreground">Approve submission</span>
        <span className="text-2xs text-foreground-muted">Stage 2 of 2</span>
      </div>
      <div className="px-4 pt-5 pb-4">
        <div className="text-2xs text-foreground-muted">Exact amount</div>
        <div className="mt-1 font-display text-[34px] leading-none font-medium tracking-[-0.035em] tabular-nums text-foreground">
          1.00 <span className="text-foreground-muted text-[22px]">USDT</span>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-px rounded-md overflow-hidden border border-border bg-border">
          {[
            ["Raw units", "1000000"],
            ["Decimals", "6"],
            ["Token", "0x19B8…66C2"],
            ["Payee", "0x742d…f44e"],
          ].map(([k, v]) => (
            <div key={k} className="bg-background/80 px-3 py-2">
              <dt className="text-2xs text-foreground-muted">{k}</dt>
              <dd className="mt-0.5 font-mono text-xs text-foreground tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4">
          <div className="flex items-center justify-between text-2xs">
            <span className="inline-flex items-center gap-1 text-warning">
              <Clock className="w-3 h-3" />
              Quote expires in <span className="tabular-nums">04:12</span>
            </span>
            <span className="text-foreground-muted tabular-nums">10:46:12 UTC</span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-surface-3 overflow-hidden">
            <div className="h-full w-[42%] bg-warning/70" />
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-surface-2/30">
        <span className="inline-flex items-center h-7 px-2.5 rounded-md border border-border text-xs text-foreground-secondary">Reject</span>
        <span className="inline-flex items-center h-7 px-2.5 rounded-md bg-primary text-xs font-medium text-white">Approve exact terms</span>
      </div>
    </div>
  );
}

const RECON_LOG = [
  { t: "10:42:03", s: "payment-submitted", note: "hsp-pr-5519821", tone: "text-foreground-secondary" },
  { t: "10:42:18", s: "payment-processing", note: "flow hsp-flow-90124", tone: "text-foreground-secondary" },
  { t: "10:42:33", s: "payment-included", note: "tx 0x4b7c…6b7c", tone: "text-foreground-secondary" },
  { t: "10:42:48", s: "payment-safe", note: "not final · receipt withheld", tone: "text-warning" },
  { t: "—", s: "payment-finalized", note: "next poll in 15s", tone: "text-foreground-muted" },
];

function SettleVisual() {
  return (
    <div className="relative mt-8">
      <div aria-hidden="true" className="absolute -inset-4 bg-dots opacity-70" style={fadeMask("ellipse 80% 70% at 50% 50%")} />
      <div className="relative">
        <div className="flex items-center justify-between gap-3 mb-5">
          <span className="font-mono text-xs text-foreground">pay-golden-001</span>
          <StatusBadge status="payment-safe" type="hsp" size="sm" />
        </div>
        <FinalityTrack status="payment-safe" />
        <div className="mt-7 rounded-lg border border-border bg-background/80 overflow-hidden">
          <div className="flex items-center justify-between px-3.5 h-8 border-b border-border">
            <span className="text-2xs text-foreground-muted">Reconciler log</span>
            <span className="text-2xs text-foreground-muted">poll · 15s</span>
          </div>
          <ol className="divide-y divide-border/60">
            {RECON_LOG.map((r) => (
              <li key={r.s} className="grid grid-cols-[64px_1fr] sm:grid-cols-[72px_150px_1fr] gap-x-3 px-3.5 py-2 font-mono text-2xs">
                <span className="text-foreground-muted tabular-nums">{r.t}</span>
                <span className={r.tone}>{r.s}</span>
                <span className="col-start-2 sm:col-start-auto text-foreground-muted truncate">{r.note}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
