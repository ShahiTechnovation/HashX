import React from "react";
import Link from "next/link";
import { ArrowRight, FileSignature, ScanSearch, KeyRound, ReceiptText } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { TrustCircuit } from "./TrustCircuit";

export function HeroSection() {
  return (
    <section aria-labelledby="hero-title" className="relative">
      <div className="site-container pb-16 pt-14 sm:pt-20 lg:pb-24 lg:pt-24">
        <div className="mx-auto max-w-[920px] text-center">
          <a
            href="#rails"
            className="animate-enter group inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 py-1 pl-1 pr-3 text-[13px] text-foreground-secondary shadow-panel transition-colors hover:border-border-strong"
          >
            <span className="rounded-full bg-primary-subtle px-2 py-0.5 text-xs font-medium text-primary-light">Testnet</span>
            <span>
              <span className="hidden sm:inline">Settlement rail: </span>test USDC on Ethereum Sepolia
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-foreground-muted transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
          </a>

          <h1
            id="hero-title"
            className="animate-rise mt-7 text-display-xl font-medium text-foreground text-balance"
          >
            Before agents pay,{" "}
            <span className="sm:block">demand proof.</span>
          </h1>

          <p className="animate-enter mx-auto mt-6 max-w-[520px] text-lede text-foreground-secondary text-balance [animation-delay:120ms]">
            Verify agreements. Prove delivery. Approve exact terms. Settle with confidence.
          </p>

          <div className="animate-enter mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row [animation-delay:180ms]">
            <Link href="/app" className={cn(buttonStyles({ variant: "primary", size: "lg" }), "group w-full sm:w-auto")}>
              Explore HashX
              <ArrowRight className="transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <a href="#how-it-works" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full sm:w-auto")}>
              See how it works
            </a>
          </div>
        </div>

        <div className="animate-enter mx-auto mt-16 max-w-[1240px] sm:mt-20 [animation-delay:260ms]">
          <TrustCircuit />
        </div>
      </div>
    </section>
  );
}

const CAPABILITIES = [
  { icon: FileSignature, title: "EIP-712 signing", body: "Typed, domain-bound commercial terms" },
  { icon: ScanSearch, title: "Deterministic evidence checks", body: "Delivered work recomputed from chain data" },
  { icon: KeyRound, title: "Human payment authorization", body: "Two explicit approvals by the human payer" },
  { icon: ReceiptText, title: "Verifiable settlement receipts", body: "Exportable and independently checkable" },
];

export function TrustStrip() {
  return (
    <section aria-label="Verification capabilities" className="border-y border-border bg-surface-1">
      <div className="site-container grid gap-8 py-10 lg:grid-cols-[220px_1fr] lg:items-center lg:gap-12">
        <p className="text-[15px] font-medium leading-snug tracking-[-0.01em] text-foreground">
          Built around cryptographic verification.
        </p>
        <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
              <div>
                <div className="text-[14px] font-medium text-foreground">{title}</div>
                <div className="mt-0.5 text-[13px] leading-snug text-foreground-muted">{body}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
