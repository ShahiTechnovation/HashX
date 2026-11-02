"use client";

import React, { useId, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./primitives";

/** Answers describe implemented behaviour only (docs/PRODUCTION_READINESS.md, docs/SECURITY_MODEL.md). */
const FAQS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "What is HashX?",
    a: "HashX is a verification and authorization layer for payments between AI agents. It checks that an invoice was signed by the seller, that the delivered work matches the agreed terms, and that a human explicitly approved the exact payment — then verifies the settlement on-chain and issues a receipt.",
  },
  {
    q: "How does HashX verify an agent's work?",
    a: "For the supported service type (EVM address analytics), HashX re-hashes the delivered artifact against the seller's signed delivery manifest and recomputes the result from chain RPC data for the agreed block range. Any mismatch fails verification. If the chain can't be read, the verdict is Pending — never a pass.",
  },
  {
    q: "Can agents move funds autonomously?",
    a: "No. With scoped credentials, agents can create invoices, submit deliveries, run verification and request payment. Approving terms, signing the payment authorization and reporting the transaction all require a human payer's wallet session — no agent credential or MCP tool can perform them.",
  },
  {
    q: "How are payments authorized?",
    a: "In two stages. In Stage 1 the payer approves the exact obligation digest. In Stage 2 the payer's wallet signs an EIP-712 HashXPaymentAuthorization that binds the invoice, delivery evidence, payer, payee, token, chain, raw amount, a random nonce and an expiry. The payer's wallet then sends the transfer itself.",
  },
  {
    q: "Which networks does HashX support?",
    a: "The implemented settlement rail is Circle's test USDC on Ethereum Sepolia. HashKey HSP is a separate adapter that is not connected yet and refuses requests rather than simulating them. HashKey Mainnet payments are disabled by design.",
  },
  {
    q: "Is HashX custodial?",
    a: "No. HashX never holds funds or private keys. Invoices and authorizations are signed in the owner's wallet, the payer's wallet broadcasts the transfer, and HashX independently verifies it on-chain.",
  },
  {
    q: "How can developers integrate it?",
    a: "Through the REST API — wallet sessions use Sign-In with Ethereum, agents use scoped bearer credentials — or through the MCP Streamable HTTP endpoint at /mcp, which exposes nine tools backed by the same services and authorization rules. The Developers page in the app documents both.",
  },
];

export function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(null);
  const baseId = useId();

  return (
    <section id="faq" aria-labelledby="faq-title" className="section-y border-t border-border">
      <div className="site-container grid gap-12 lg:grid-cols-12 lg:gap-10">
        <Reveal as="header" className="lg:col-span-4">
          <p className="mb-4 text-sm font-medium text-primary-light">FAQ</p>
          <h2 id="faq-title" className="text-display-lg font-medium text-foreground">
            Questions, answered plainly.
          </h2>
        </Reveal>

        <Reveal className="lg:col-span-8">
          <ul className="border-t border-border">
            {FAQS.map((f, i) => {
              const isOpen = open === i;
              return (
                <li key={f.q} className="border-b border-border">
                  <h3>
                    <button
                      type="button"
                      id={`${baseId}-q-${i}`}
                      aria-expanded={isOpen}
                      aria-controls={`${baseId}-a-${i}`}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="group flex w-full items-center justify-between gap-6 py-6 text-left"
                    >
                      <span className="text-[18px] font-medium tracking-[-0.018em] text-foreground sm:text-[19px]">{f.q}</span>
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-foreground-secondary transition-colors duration-150 group-hover:border-border-strong group-hover:text-foreground"
                      >
                        <Plus className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-45")} />
                      </span>
                    </button>
                  </h3>
                  <div
                    id={`${baseId}-a-${i}`}
                    role="region"
                    aria-labelledby={`${baseId}-q-${i}`}
                    className={cn("grid transition-[grid-template-rows] duration-[240ms] ease-out", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
                  >
                    <div className="overflow-hidden" inert={!isOpen}>
                      <p className="max-w-[680px] pb-7 pr-12 text-[16px] leading-relaxed text-foreground-secondary">{f.a}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
