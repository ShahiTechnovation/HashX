import React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Clock, Stamp, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FinalityTrack } from "@/components/ui/FinalityTrack";
import type { HSPStatus } from "@/types/domain";
import { cn } from "@/lib/utils";
import { Code, Section, SectionIntro } from "./primitives";

export function ProductShowcase() {
  return (
    <Section>
      <SectionIntro
        layout="split"
        eyebrow="Product"
        title="Built for the person who signs off."
        description="Operators see exactly what the verifier saw — every digest, every reason code, every state transition — before and after money moves."
      />

      <div className="mt-14 grid grid-cols-1 lg:grid-cols-12 gap-5">
        <PreviewFrame
          href="/app/trust/inv-tampered-scenario-a"
          path="/app/trust/inv-tampered-scenario-a"
          title="Trust Inspector"
          description="Check-by-check evidence with expected and recomputed values."
          className="lg:col-span-7 lg:row-span-2"
        >
          <TrustInspectorMock />
        </PreviewFrame>

        <PreviewFrame
          href="/app/approvals"
          path="/app/approvals"
          title="Approvals"
          description="Two-stage human authorization against live quote expiry."
          className="lg:col-span-5"
        >
          <ApprovalsMock />
        </PreviewFrame>

        <PreviewFrame
          href="/app/invoices"
          path="/app/invoices/inv-golden-path-scenario-d"
          title="Invoice Workspace"
          description="Structured terms, parties, and signing digest in one record."
          className="lg:col-span-5"
        >
          <InvoiceMock />
        </PreviewFrame>

        <PreviewFrame
          href="/app/settlements"
          path="/app/settlements"
          title="Settlement Explorer"
          description="Every HSP attempt, reconciled to finality."
          className="lg:col-span-12"
        >
          <SettlementsMock />
        </PreviewFrame>
      </div>
    </Section>
  );
}

function PreviewFrame({
  href,
  path,
  title,
  description,
  className,
  children,
}: {
  href: string;
  path: string;
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col rounded-lg border border-border bg-surface-1 shadow-panel overflow-hidden transition-colors hover:border-border-strong",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 h-9 px-3.5 border-b border-border">
        <span className="font-mono text-2xs text-foreground-muted truncate">{path}</span>
        <ArrowUpRight className="w-3.5 h-3.5 text-foreground-muted group-hover:text-foreground transition-colors shrink-0" />
      </div>
      <div aria-hidden="true" className="relative flex-1 bg-background/50 overflow-hidden select-none pointer-events-none">
        {children}
      </div>
      <div className="flex items-baseline justify-between gap-4 px-4 py-3 border-t border-border">
        <span className="text-[13px] font-medium text-foreground">{title}</span>
        <span className="text-2xs text-foreground-muted text-right truncate">{description}</span>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */

const TRUST_CHECKS: Array<{ name: string; status: "PASS" | "FAIL" }> = [
  { name: "schema", status: "PASS" },
  { name: "signature", status: "FAIL" },
  { name: "identity_binding", status: "PASS" },
  { name: "expiry", status: "PASS" },
  { name: "nonce_unused", status: "PASS" },
  { name: "terms_consistent", status: "PASS" },
];

function TrustInspectorMock() {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xs text-foreground-muted">Trust inspector</div>
          <div className="mt-1 font-mono text-[13px] text-foreground truncate">inv-tampered-scenario-a</div>
        </div>
        <StatusBadge status="FAIL" type="verdict" size="sm" />
      </div>

      <div className="relative mt-4 rounded-md border border-border bg-surface-1 pl-4 pr-3 py-3">
        <span className="absolute left-0 inset-y-0 w-0.5 bg-danger/80 rounded-l-md" />
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-display text-lg font-medium tracking-[-0.02em] text-foreground">Rejected</span>
          <span className="text-xs text-danger">Payment gated</span>
        </div>
        <p className="mt-0.5 text-2xs text-foreground-muted">Payee was changed after the seller signed. Signature no longer recovers to the registered seller.</p>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4">
        <div className="rounded-md border border-border bg-surface-1 overflow-hidden">
          <div className="px-3 h-8 flex items-center border-b border-border text-2xs text-foreground-muted">Invoice checks · 5 of 6 passed</div>
          <ul className="divide-y divide-border/60">
            {TRUST_CHECKS.map((c, i) => {
              const fail = c.status === "FAIL";
              return (
                <li key={c.name} className={cn(fail && "bg-danger/[0.05]")}>
                  <div className="flex items-center gap-2.5 px-3 py-2">
                    <span
                      className={cn(
                        "flex items-center justify-center w-4 h-4 rounded-full shrink-0",
                        fail ? "bg-danger/15 text-danger" : "bg-success/15 text-success"
                      )}
                    >
                      {fail ? <X className="w-2.5 h-2.5" strokeWidth={3} /> : <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                    </span>
                    <span className="font-mono text-[10px] text-foreground-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-mono text-2xs text-foreground-secondary flex-1 truncate">{c.name}</span>
                    {fail ? <Code tone="danger">SIGNATURE_INVALID</Code> : <span className="text-[10px] uppercase tracking-wider text-success">Pass</span>}
                  </div>
                  {fail && (
                    <div className="grid grid-cols-2 mx-3 mb-2.5 rounded border border-border overflow-hidden">
                      <div className="px-2 py-1.5 bg-background/60">
                        <div className="text-[10px] text-foreground-muted">Payee at signing</div>
                        <div className="font-mono text-2xs text-foreground/90">0x8920…43e7</div>
                      </div>
                      <div className="px-2 py-1.5 border-l border-border bg-danger/[0.06]">
                        <div className="text-[10px] text-danger/80">Payee in invoice</div>
                        <div className="font-mono text-2xs text-danger">0xde0B…7BAe</div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="hidden sm:block rounded-md border border-border bg-surface-1 overflow-hidden">
          <div className="px-3 h-8 flex items-center border-b border-border text-2xs text-foreground-muted">Evidence</div>
          <dl className="divide-y divide-border/60">
            {[
              ["Digest", "0x9812…ef01"],
              ["Signer", "0x8920…43e7"],
              ["Nonce", "1001"],
              ["Chain", "133"],
              ["Amount", "100 minor"],
            ].map(([k, v]) => (
              <div key={k} className="px-3 py-2">
                <dt className="text-[10px] text-foreground-muted">{k}</dt>
                <dd className="font-mono text-2xs text-foreground-secondary tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}

function ApprovalsMock() {
  const items = [
    { action: "Approve signing", amount: "1.00 USDT", party: "Nexus Analytics Agent → 0x742d…f44e", expiry: "Quote expires 10:46 UTC", expired: false },
    { action: "Approve submission", amount: "2.50 USDT", party: "Nexus Analytics Agent → 0x742d…f44e", expiry: "Quote expires 10:58 UTC", expired: false },
    { action: "Approve signing", amount: "0.40 USDT", party: "Nexus Analytics Agent → 0x742d…f44e", expiry: "Quote expired — re-quote required", expired: true },
  ];
  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground">Approval queue</span>
        <span className="text-2xs font-medium tabular-nums text-warning bg-warning/10 rounded px-1.5 h-5 inline-flex items-center">2</span>
      </div>
      <ul className="mt-3 rounded-md border border-border bg-surface-1 divide-y divide-border/60">
        {items.map((it, i) => (
          <li key={i} className={cn("flex items-start gap-2.5 px-3 py-2.5", it.expired && "opacity-70")}>
            <span
              className={cn(
                "mt-px flex items-center justify-center w-5 h-5 rounded-md shrink-0",
                it.expired ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
              )}
            >
              <Stamp className="w-3 h-3" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-foreground">{it.action}</span>
                <span className="text-xs tabular-nums text-foreground">{it.amount}</span>
              </span>
              <span className="block text-2xs text-foreground-muted truncate">{it.party}</span>
              <span className={cn("mt-0.5 inline-flex items-center gap-1 text-[10px]", it.expired ? "text-danger" : "text-foreground-muted")}>
                <Clock className="w-2.5 h-2.5" />
                {it.expiry}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InvoiceMock() {
  const rows: Array<[string, string, boolean]> = [
    ["Service", "hsk_address_analytics_v1", true],
    ["Amount", "$1.00 USD", false],
    ["Payee", "0x742d…f44e", true],
    ["Block range", "1205000–1205500", true],
    ["Expires", "Nov 5, 2026 · 12:00 UTC", false],
    ["EIP-712 digest", "0x5a6b…a6b7", true],
  ];
  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xs text-foreground-muted">Invoice</div>
          <div className="font-mono text-xs text-foreground truncate">inv-golden-path-scenario-d</div>
        </div>
        <StatusBadge status="SETTLED" type="invoice" size="sm" />
      </div>
      <dl className="mt-3 rounded-md border border-border bg-surface-1 px-3 divide-y divide-border/60">
        {rows.map(([k, v, mono]) => (
          <div key={k} className="grid grid-cols-[100px_1fr] gap-3 py-[7px] items-baseline">
            <dt className="text-2xs text-foreground-muted">{k}</dt>
            <dd className={cn("truncate text-foreground-secondary tabular-nums", mono ? "font-mono text-2xs" : "text-xs")}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const SETTLEMENTS: Array<{ id: string; invoice: string; amount: string; status: HSPStatus; tx: string }> = [
  { id: "pay-golden-001", invoice: "inv-golden-path-scenario-d", amount: "1.00 USDT", status: "payment-finalized", tx: "0x4b7c…6b7c" },
  { id: "pay-attempt-c-active", invoice: "inv-replay-scenario-c", amount: "1.00 USDT", status: "payment-processing", tx: "pending" },
  { id: "pay-analytics-007", invoice: "inv-analytics-hk-107", amount: "0.40 USDT", status: "payment-safe", tx: "0x71d0…c3a8" },
];

function SettlementsMock() {
  return (
    <div className="overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border">
            {["Attempt", "Invoice", "Amount", "Status", "Finality"].map((h, i) => (
              <th
                key={h}
                className={cn(
                  "h-8 px-4 text-[10px] font-medium uppercase tracking-[0.06em] text-foreground-muted whitespace-nowrap",
                  i === 1 && "hidden md:table-cell",
                  i === 2 && "text-right",
                  i === 4 && "hidden sm:table-cell w-[38%]"
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {SETTLEMENTS.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-3">
                <div className="font-mono text-2xs text-foreground">{s.id}</div>
                <div className="font-mono text-[10px] text-foreground-muted mt-0.5">{s.tx}</div>
              </td>
              <td className="hidden md:table-cell px-4 py-3 font-mono text-2xs text-foreground-muted">{s.invoice}</td>
              <td className="px-4 py-3 text-right text-xs tabular-nums text-foreground">{s.amount}</td>
              <td className="px-4 py-3">
                <StatusBadge status={s.status} type="hsp" size="sm" />
              </td>
              <td className="hidden sm:table-cell px-4 py-3">
                <FinalityTrack status={s.status} compact />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
