import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Section } from "./primitives";

const TOOLS: Array<{ name: string; desc: string; mutates: boolean }> = [
  { name: "create_invoice", desc: "Unsigned structured invoice bound to a service definition", mutates: true },
  { name: "sign_invoice", desc: "Attach the seller's EIP-712 signature", mutates: true },
  { name: "verify_invoice", desc: "Schema, signature, identity, expiry, replay nonce", mutates: false },
  { name: "submit_delivery", desc: "Artifact reference and signed delivery manifest", mutates: true },
  { name: "verify_delivery", desc: "Recompute fulfillment facts against chain RPC", mutates: false },
  { name: "request_payment", desc: "Eligibility gate; idempotent HSP order preparation", mutates: true },
  { name: "get_payment_status", desc: "Reconciled HSP status and settlement tx hash", mutates: false },
  { name: "get_receipt", desc: "Verifiable receipt binding intent to settlement", mutates: false },
];

const STEPS = [
  { title: "Connect over MCP", body: "Point your agent at the HashX MCP server. Streamable HTTP, eight typed tools, no SDK lock-in." },
  { title: "Verify before you pay", body: "Call verify_invoice and verify_delivery. Branch on the decision and reason codes — never on prose." },
  { title: "Request, then reconcile", body: "request_payment queues human approval; poll get_payment_status until finalized, then fetch the receipt." },
];

const SAMPLE = {
  request: {
    method: "tools/call",
    params: {
      name: "verify_invoice",
      arguments: {
        invoice_id: "inv-golden-path-scenario-d",
        expected_seller_id: "cp-seller-01",
        expected_buyer_ref: "buyer-job-audit-hashkey-104",
      },
    },
  },
  result: {
    decision: "PASS",
    checks: {
      schema: "PASS",
      signature: "PASS",
      identity_binding: "PASS",
      expiry: "PASS",
      nonce_unused: "PASS",
      terms_consistent: "PASS",
    },
    failure_codes: [],
    chain_id: 133,
    invoice_digest: "0x5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b",
    next_action: "submit_delivery",
  },
};

export function DeveloperSection() {
  return (
    <Section id="developers">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14">
        {/* Narrative */}
        <div className="lg:col-span-5">
          <p className="eyebrow mb-4">Developers</p>
          <h2 className="font-display font-semibold text-[30px] sm:text-[40px] leading-[1.08] tracking-[-0.035em] text-foreground text-balance">
            Your agent calls HashX before it pays.
          </h2>
          <p className="mt-4 text-[15px] sm:text-base leading-relaxed text-foreground-secondary">
            HashX is exposed as a Model Context Protocol server. Any MCP-capable agent can create, verify, and settle obligations with the
            same controls an operator sees in the app.
          </p>

          <ol className="mt-10 space-y-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[28px_1fr] gap-3">
                <span className="text-xs tabular-nums text-foreground-muted pt-px">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="text-[13px] font-medium text-foreground">{s.title}</div>
                  <p className="mt-1 text-[13px] leading-relaxed text-foreground-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/app/developers" className={buttonStyles({ variant: "secondary", size: "md" })}>
              Browse the tool catalog
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link href="/app/demo" className={buttonStyles({ variant: "ghost", size: "md" })}>
              Run a scenario
            </Link>
          </div>
        </div>

        {/* Catalog + sample */}
        <div className="lg:col-span-7 space-y-5 min-w-0">
          <div className="rounded-lg border border-border bg-surface-1 shadow-panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 h-10 px-4 border-b border-border">
              <span className="text-xs text-foreground">MCP tools</span>
              <span className="text-2xs text-foreground-muted">
                Streamable HTTP · <span className="tabular-nums">8</span> tools
              </span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-border/60">
              {[TOOLS.slice(0, 4), TOOLS.slice(4)].map((col, ci) => (
                <li key={ci} className={cn(ci === 1 && "max-sm:border-t max-sm:border-border/60")}>
                  <ul className="divide-y divide-border/60">
                    {col.map((t) => (
                      <li key={t.name} className="px-4 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-foreground">{t.name}</span>
                          <span
                            className={cn(
                              "inline-flex items-center h-[18px] px-1.5 rounded-[4px] text-[10px] font-medium ring-1 ring-inset",
                              t.mutates ? "bg-info/10 text-info ring-info/20" : "bg-surface-3/70 text-foreground-muted ring-border-strong/60"
                            )}
                          >
                            {t.mutates ? "Mutates" : "Read-only"}
                          </span>
                        </div>
                        <div className="mt-0.5 text-2xs text-foreground-muted truncate">{t.desc}</div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>

          <CodeViewer title="verify_invoice · call and result" data={SAMPLE} maxHeight="max-h-[380px]" />
        </div>
      </div>
    </Section>
  );
}
