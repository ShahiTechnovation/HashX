import React from "react";
import { Check, Clock, Minus } from "lucide-react";
import { HASHKEY_MAINNET, HASHKEY_TESTNET, SEPOLIA, railLabel } from "@shared/networks";
import { cn } from "@/lib/utils";
import { Reveal, SectionHeading } from "./primitives";

/**
 * Two separate rails, described from the typed network configuration (shared/networks.ts) and the
 * capability matrix in docs/PRODUCTION_READINESS.md. A Sepolia ERC-20 transfer is never an HSP payment.
 */
const token = SEPOLIA.settlementToken!;

const RAILS = [
  {
    name: "Ethereum Sepolia",
    rail: railLabel("sepolia-usdc"),
    status: { label: "Implemented · testnet", tone: "success" as const, icon: Check },
    summary:
      "The payer's wallet sends the exact authorized transfer. HashX verifies the Transfer log, recipient, amount and confirmations on-chain before issuing a receipt.",
    facts: [
      ["Chain ID", String(SEPOLIA.chainId)],
      ["Token", `${token.displayName} · ${token.decimals} decimals`],
      ["Contract", `${token.address.slice(0, 6)}…${token.address.slice(-4)}`],
      ["Value", "Test token — no monetary value"],
      ["Live transfer", "Verified on a local EVM; not yet executed on Sepolia"],
    ],
  },
  {
    name: "HashKey HSP",
    rail: railLabel("hashkey-hsp"),
    status: { label: "Not connected · fail-closed", tone: "warning" as const, icon: Clock },
    summary:
      "A separate settlement adapter. Execution stays disabled until credentials, network access and tool schemas are validated with HashKey — requests are refused rather than simulated.",
    facts: [
      ["Chain IDs", `${HASHKEY_TESTNET.chainId} testnet · ${HASHKEY_MAINNET.chainId} mainnet`],
      ["Execution", HASHKEY_TESTNET.paymentExecutionEnabledByDefault ? "Enabled" : "Disabled by default"],
      ["Mainnet payments", HASHKEY_MAINNET.paymentExecutionEnabledByDefault ? "Enabled" : "Disabled by design"],
      ["Delivery checks", HASHKEY_TESTNET.deliveryVerificationSupported ? "Implemented; requires an RPC endpoint" : "Not supported"],
    ],
  },
];

export function SettlementRails() {
  return (
    <section id="rails" aria-labelledby="rails-title" className="section-y border-t border-border">
      <div className="site-container">
        <SectionHeading
          id="rails-title"
          eyebrow="Settlement rails"
          title="Clear about where money moves."
          description="Each rail is its own adapter with its own status. Nothing is presented as live until it is."
        />

        <div className="mt-12 divide-y divide-border border-y border-border">
          {RAILS.map((r) => {
            const Icon = r.status.icon;
            return (
              <Reveal key={r.name} className="grid gap-6 py-10 lg:grid-cols-12 lg:gap-10">
                <div className="lg:col-span-4">
                  <h3 className="text-display-md font-medium text-foreground">{r.name}</h3>
                  <p className="mt-2 text-[14px] text-foreground-muted">{r.rail}</p>
                  <span
                    className={cn(
                      "mt-4 inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[13px] font-medium ring-1 ring-inset",
                      r.status.tone === "success" ? "bg-success/10 text-success ring-success/20" : "bg-warning/10 text-warning ring-warning/20"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {r.status.label}
                  </span>
                </div>
                <p className="text-[16px] leading-relaxed text-foreground-secondary lg:col-span-4">{r.summary}</p>
                <dl className="space-y-2.5 text-[14px] lg:col-span-4">
                  {r.facts.map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-4 border-b border-border/70 pb-2.5 last:border-b-0">
                      <dt className="text-foreground-muted">{k}</dt>
                      <dd className={cn("text-right text-foreground", /^[0-9x]/.test(v) && "font-mono text-[13px]")}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-6 flex items-center gap-2 text-[13px] text-foreground-muted">
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          A Sepolia ERC-20 transfer is never presented as an HSP payment.
        </p>
      </div>
    </section>
  );
}
