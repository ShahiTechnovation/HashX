import React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, FileSignature, ScanSearch, Stamp, Landmark, Fingerprint } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Container, CornerTicks, fadeMask } from "./primitives";
import { TrustPipelineVisual } from "./TrustPipelineVisual";

const TRUTHS = [
  { title: "Signed terms", body: "Payee, amount, and scope bound by an EIP-712 signature." },
  { title: "Checked work", body: "Delivery recomputed against HashKey Chain before payment." },
  { title: "Safe is not final", body: "Receipts issue only once HSP settlement is finalized." },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 bg-grid opacity-60" style={fadeMask("ellipse 60% 70% at 78% 35%")} />

      <Container className="relative grid grid-cols-1 lg:grid-cols-12 gap-14 lg:gap-10 pt-16 sm:pt-24 pb-20 sm:pb-24">
        {/* Narrative */}
        <div className="lg:col-span-6 lg:pr-6 flex flex-col justify-center animate-fade-in">
          <Link
            href="/app/demo"
            className="group self-start inline-flex items-center gap-2 h-7 pl-2.5 pr-2 rounded-md border border-border bg-surface-1/70 text-xs text-foreground-secondary hover:border-border-strong hover:text-foreground transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden="true" />
            Four adversarial scenarios, runnable in the demo center
            <ArrowUpRight className="w-3 h-3 text-foreground-muted group-hover:text-foreground transition-colors" />
          </Link>

          <h1 className="mt-7 font-display font-semibold text-[44px] sm:text-[56px] xl:text-[64px] leading-[1.02] tracking-[-0.04em] text-foreground text-balance">
            The trust layer for agent payments.
          </h1>

          <p className="mt-6 max-w-[34rem] text-base sm:text-[17px] leading-relaxed text-foreground-secondary">
            An agent shouldn&apos;t pay just because it received a payment request. HashX verifies the invoice, checks the delivered work
            against the chain, puts a human on the exact terms, and reconciles HSP settlement on HashKey Chain — then hands you a receipt
            anyone can verify.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/app" className={buttonStyles({ variant: "primary", size: "lg" })}>
              Launch app
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/app/demo" className={buttonStyles({ variant: "secondary", size: "lg" })}>
              Explore the demo
            </Link>
          </div>

          <dl className="mt-12 grid grid-cols-1 sm:grid-cols-3 border-t border-border">
            {TRUTHS.map((t, i) => (
              <div key={t.title} className={cn("pt-5 sm:pr-5", i > 0 && "sm:pl-5 sm:border-l sm:border-border", i > 0 && "max-sm:mt-1")}>
                <dt className="text-[13px] font-medium text-foreground">{t.title}</dt>
                <dd className="mt-1 text-xs leading-relaxed text-foreground-muted">{t.body}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Living product visual */}
        <div className="lg:col-span-6 relative animate-fade-in [animation-delay:120ms]">
          <div className="relative p-3 sm:p-5">
            <CornerTicks />
            <TrustPipelineVisual />
          </div>
        </div>
      </Container>
    </section>
  );
}

const PROOFS = [
  { Icon: FileSignature, title: "Structured invoices", meta: "EIP-712 · domain-separated" },
  { Icon: ScanSearch, title: "Deterministic verification", meta: "Recomputed from chain RPC" },
  { Icon: Stamp, title: "Two-stage approval", meta: "Sign, then submit" },
  { Icon: Landmark, title: "Settlement reconciliation", meta: "HSP · safe vs finalized" },
  { Icon: Fingerprint, title: "Verifiable receipt trail", meta: "Evidence anchored on-chain" },
];

export function ProofStrip() {
  return (
    <div className="border-t border-border bg-surface-1/40">
      <Container>
        <ul className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border border-x border-border">
          {PROOFS.map(({ Icon, title, meta }, i) => (
            <li
              key={title}
              className={cn("flex items-start gap-3 bg-background px-4 py-5", i === PROOFS.length - 1 && "col-span-2 md:col-span-1")}
            >
              <Icon className="w-4 h-4 mt-px text-foreground-muted shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground leading-snug">{title}</div>
                <div className="mt-0.5 text-2xs text-foreground-muted">{meta}</div>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </div>
  );
}
