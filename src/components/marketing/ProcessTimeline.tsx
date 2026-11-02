import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./primitives";

/** Artifact names are the real protocol objects produced at each step (see docs/api-contracts.md). */
const STEPS = [
  { title: "Agree", body: "The seller agent defines the commercial terms and signs them.", artifact: "EIP-712 invoice" },
  { title: "Deliver", body: "The seller submits the requested work with a signed delivery manifest.", artifact: "Delivery manifest" },
  { title: "Verify", body: "HashX independently checks the agreement and recomputes the evidence.", artifact: "Verification run" },
  { title: "Authorize", body: "A human payer reviews the exact payment and signs it in their own wallet.", artifact: "HashXPaymentAuthorization" },
  { title: "Settle", body: "The transfer is verified on-chain and reconciled into a receipt.", artifact: "hashx.receipt.v2" },
];

export function ProcessTimeline() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="section-y">
      <div className="site-container grid gap-14 lg:grid-cols-12 lg:gap-10">
        <Reveal as="header" className="lg:col-span-5 lg:pr-8">
          <p className="mb-4 text-sm font-medium text-primary-light">How it works</p>
          <h2 id="how-title" className="text-display-lg font-medium text-foreground text-balance">
            One clear path from request to receipt.
          </h2>
          <p className="mt-5 max-w-[460px] text-lede text-foreground-secondary text-pretty">
            Every payment should have a reason, a record, and an explicit authorization.
          </p>
          <Link
            href="/app/demo"
            className="group mt-8 inline-flex items-center gap-1.5 text-[15px] font-medium text-foreground underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-foreground"
          >
            Walk through it in the Proof Lab
            <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </Reveal>

        <div className="relative lg:col-span-7">
          {/* the thread connecting step markers */}
          <span aria-hidden="true" className="absolute bottom-6 left-[15px] top-6 w-px bg-border" />
          <ol className="relative">
          {STEPS.map((step, i) => (
            <Reveal as="li" key={step.title} className="group relative grid grid-cols-[32px_1fr] gap-5">
              <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border-strong bg-background text-xs font-medium tabular-nums text-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="mb-8 flex flex-col gap-3 border-b border-border pb-8 pt-1 group-last:mb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8 group-last:border-b-0 group-last:pb-0">
                <div>
                  <h3 className="text-[19px] font-medium tracking-[-0.02em] text-foreground">{step.title}</h3>
                  <p className="mt-1.5 max-w-[420px] text-[15px] leading-relaxed text-foreground-secondary">{step.body}</p>
                </div>
                <span className="inline-flex shrink-0 self-start rounded-md border border-border bg-surface-1 px-2 py-1 font-mono text-xs text-foreground-secondary">
                  {step.artifact}
                </span>
              </div>
            </Reveal>
          ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
