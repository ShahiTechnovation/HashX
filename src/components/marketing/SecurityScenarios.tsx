"use client";

import React, { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ShieldX, ShieldCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./primitives";

type Verdict = "rejected" | "returned" | "blocked";

/** Each control and code below is implemented (see docs/SECURITY_MODEL.md, docs/api-contracts.md). */
const SCENARIOS: Array<{
  title: string;
  without: string;
  control: string;
  detail: string;
  code: string;
  verdict: Verdict;
}> = [
  {
    title: "Changed recipient",
    without: "A compromised step swaps the payee address and the transfer goes to the attacker.",
    control: "EIP-712 signature recovery",
    detail:
      "The payee is part of the signed invoice terms. Any change means the recovered signer no longer matches the seller, so the invoice fails verification and no payment can be requested.",
    code: "SIGNATURE_INVALID",
    verdict: "rejected",
  },
  {
    title: "Forged fulfillment",
    without: "The seller agent reports “task complete” and payment releases on the claim alone.",
    control: "Independent evidence recomputation",
    detail:
      "HashX re-hashes the artifact against the signed manifest and recomputes the result from chain RPC. A mismatch fails the check; if the chain can't be read, the verdict stays Pending.",
    code: "TX_COUNT_MISMATCH",
    verdict: "rejected",
  },
  {
    title: "Duplicate payment request",
    without: "A retrying agent loop submits the same request twice and the buyer pays twice.",
    control: "One live attempt per invoice",
    detail:
      "A database constraint allows a single live payment attempt per invoice, including settled ones. A duplicate request returns the existing attempt instead of creating a second obligation.",
    code: "idempotentReplay: true",
    verdict: "returned",
  },
  {
    title: "Unauthorized spending",
    without: "An agent holding a key moves funds with no human in the loop.",
    control: "Two-stage human authorization",
    detail:
      "Agent credentials can request a payment but can never approve terms, sign the authorization or report a transaction. Those steps require the payer's own wallet session.",
    code: "Agent scope: payments:request only",
    verdict: "blocked",
  },
];

const VERDICT = {
  rejected: { label: "Rejected", icon: ShieldX, cls: "text-danger bg-danger/10 ring-danger/20" },
  returned: { label: "Existing attempt returned", icon: ShieldCheck, cls: "text-success bg-success/10 ring-success/20" },
  blocked: { label: "Awaits human approval", icon: Clock, cls: "text-warning bg-warning/10 ring-warning/20" },
} as const;

export function SecurityScenarios() {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <section id="security" aria-labelledby="security-title" className="section-y border-t border-border">
      <div className="site-container">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal as="header" className="lg:col-span-7">
            <p className="mb-4 text-sm font-medium text-primary-light">Security</p>
            <h2 id="security-title" className="text-display-lg font-medium text-foreground text-balance">
              A payment request is not proof.
            </h2>
            <p className="mt-5 max-w-[560px] text-lede text-foreground-secondary text-pretty">
              Four ways agent payments go wrong, and the control HashX applies to each before any money can move.
            </p>
          </Reveal>
          <Reveal className="lg:col-span-5 lg:justify-self-end">
            <Link
              href="/app/demo"
              className="group inline-flex items-center gap-1.5 text-[15px] font-medium text-foreground underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-foreground"
            >
              Run the simulated scenarios in the Proof Lab
              <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </Reveal>
        </div>

        <Reveal className="mt-12 overflow-hidden rounded-xl border border-border bg-surface-1 shadow-panel">
          {/* column headings (desktop) */}
          <div className="hidden grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_40px] gap-6 border-b border-border bg-background px-6 py-3 text-xs text-foreground-muted md:grid">
            <span>Scenario</span>
            <span>Without verification</span>
            <span>With HashX</span>
            <span className="sr-only">Expand</span>
          </div>

          <ul className="divide-y divide-border">
            {SCENARIOS.map((s, i) => {
              const isOpen = open === i;
              const v = VERDICT[s.verdict];
              const VIcon = v.icon;
              return (
                <li key={s.title}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`${baseId}-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_32px] gap-x-4 gap-y-3 px-5 py-5 text-left transition-colors duration-150 hover:bg-background md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_40px] md:gap-6 md:px-6"
                  >
                    <span className="text-[16px] font-medium tracking-[-0.015em] text-foreground">{s.title}</span>
                    <span className="col-start-1 text-[14px] leading-relaxed text-foreground-muted md:col-start-auto">
                      <span className="mb-1 block text-xs md:hidden">Without verification</span>
                      {s.without}
                    </span>
                    <span className="col-start-1 flex flex-col items-start gap-2 md:col-start-auto">
                      <span className="text-[14px] text-foreground">{s.control}</span>
                      <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-[6px] px-2 text-xs font-medium ring-1 ring-inset", v.cls)}>
                        <VIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {v.label}
                      </span>
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "col-start-2 row-start-1 h-4 w-4 justify-self-end text-foreground-muted transition-transform duration-200 md:col-start-auto md:row-start-auto md:mt-1",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>
                  <div
                    id={`${baseId}-${i}`}
                    className={cn("grid transition-[grid-template-rows] duration-[240ms] ease-out", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
                  >
                    <div className="overflow-hidden" inert={!isOpen}>
                      <div className="grid gap-4 px-5 pb-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,2.6fr)_40px] md:gap-6 md:px-6">
                        <span className="hidden md:block" />
                        <div className="rounded-lg border border-border bg-background p-4">
                          <p className="text-[14px] leading-relaxed text-foreground-secondary">{s.detail}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
                            Expected result
                            <code className="rounded border border-border bg-surface-1 px-1.5 py-0.5 font-mono text-xs text-foreground">{s.code}</code>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-border bg-background px-5 py-3 text-xs text-foreground-muted md:px-6">
            Simulated adversarial scenarios. No attack was executed against a live network.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
