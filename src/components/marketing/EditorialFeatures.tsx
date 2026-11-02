import React from "react";
import { Check } from "lucide-react";
import { Reveal } from "./primitives";

/**
 * Three value pillars as open editorial columns separated by hairlines — not three cards.
 * Each carries one small, different visual drawn from the real artifact it describes.
 */
export function EditorialFeatures() {
  return (
    <section aria-label="What HashX does" className="section-y">
      <div className="site-container">
        <div className="grid border-y border-border md:grid-cols-3 md:divide-x md:divide-border">
          <Pillar
            n="01"
            title="Verify intent."
            body="Cryptographically authenticate the commercial agreement and the exact payment terms."
            visual={
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between gap-4 text-foreground-muted">
                  <span>payee</span>
                  <span className="text-foreground">0x8f3a…41c2</span>
                </div>
                <div className="flex justify-between gap-4 text-foreground-muted">
                  <span>amount_raw</span>
                  <span className="text-foreground">2500000</span>
                </div>
                <div className="flex justify-between gap-4 text-foreground-muted">
                  <span>chain_id</span>
                  <span className="text-foreground">11155111</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 font-sans text-success">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                  Signer recovered
                </div>
              </div>
            }
          />
          <Pillar
            n="02"
            title="Prove delivery."
            body="Evaluate objective evidence before a payment becomes eligible."
            visual={
              <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border text-xs">
                <div className="p-3">
                  <div className="text-foreground-muted">Claimed</div>
                  <div className="mt-1 text-[20px] font-medium tabular-nums tracking-[-0.02em] text-foreground">14</div>
                </div>
                <div className="border-l border-border bg-success/[0.05] p-3">
                  <div className="text-foreground-muted">Recomputed</div>
                  <div className="mt-1 text-[20px] font-medium tabular-nums tracking-[-0.02em] text-success">14</div>
                </div>
              </div>
            }
          />
          <Pillar
            n="03"
            title="Control settlement."
            body="Require deliberate authorization and record settlement evidence."
            visual={
              <ol className="flex items-center gap-2 text-xs">
                <li className="flex items-center gap-1.5 text-foreground">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[11px] text-white">1</span>
                  Approve terms
                </li>
                <li aria-hidden="true" className="h-px w-5 bg-border-strong" />
                <li className="flex items-center gap-1.5 text-foreground">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[11px] text-white">2</span>
                  Sign in wallet
                </li>
              </ol>
            }
          />
        </div>
      </div>
    </section>
  );
}

function Pillar({ n, title, body, visual }: { n: string; title: string; body: string; visual: React.ReactNode }) {
  return (
    <Reveal className="group flex flex-col border-b border-border px-0 py-10 last:border-b-0 md:border-b-0 md:px-8 md:py-12 md:first:pl-0 md:last:pr-0 lg:px-10">
      <span className="text-sm tabular-nums text-foreground-muted">{n}</span>
      <h3 className="mt-6 text-display-md font-medium text-foreground">{title}</h3>
      <p className="mt-3 max-w-[340px] text-[15px] leading-relaxed text-foreground-secondary">{body}</p>
      <div className="mt-8 max-w-[300px] rounded-lg border border-border bg-surface-1 p-4 shadow-panel transition-[border-color] duration-200 group-hover:border-border-strong">
        {visual}
      </div>
    </Reveal>
  );
}
