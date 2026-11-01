import React from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Code, Section, SectionIntro } from "./primitives";

const ROWS = [
  {
    step: "Receive payment request",
    stepMeta: "payee taken from request body",
    failure: "Payee substitution",
    failureBody: "Injected prompt rewrites the address",
    control: "EIP-712 domain separation",
    controlBody: "Any mutated field breaks the signature",
    code: "SIGNATURE_INVALID",
    tone: "danger" as const,
  },
  {
    step: "Trust the delivery claim",
    stepMeta: "seller reports tx_count: 23",
    failure: "Faked delivery",
    failureBody: "Work is claimed, never checked",
    control: "Deterministic RPC verifier",
    controlBody: "Facts recomputed from HashKey Chain",
    code: "TX_COUNT_MISMATCH",
    tone: "danger" as const,
  },
  {
    step: "Sign and send transfer",
    stepMeta: "client retries on timeout",
    failure: "Replay / double spend",
    failureBody: "A retry creates a second order",
    control: "Idempotency invariant",
    controlBody: "Locked row returns the existing attempt",
    code: "REPLAY_NONCE_REUSED",
    tone: "danger" as const,
  },
  {
    step: "Mark as paid",
    stepMeta: "on first block inclusion",
    failure: "Premature finality",
    failureBody: "“Included” is treated as settled",
    control: "HSP finality reconciler",
    controlBody: "Receipt waits for finalized, not safe",
    code: "safe ≠ finalized",
    tone: "warning" as const,
  },
];

const ROW_H = "lg:h-[88px]";

export function ProblemSection() {
  return (
    <Section id="how-it-works">
      <SectionIntro
        layout="split"
        eyebrow="Why HashX"
        title="A payment request is not proof of a fulfilled agreement."
        description="Naive agent payment collapses commerce into one step: request, then pay. Every gap in that step is an attack surface. HashX places a named, deterministic control on each one."
      />

      <div className="mt-14 grid grid-cols-1 lg:grid-cols-12 gap-y-10">
        {/* Naive side */}
        <div className="lg:col-span-7">
          <div className="flex items-center gap-3 h-10 lg:pr-10">
            <span className="text-[13px] font-medium text-foreground">Naive agent payment</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-foreground-muted">
              request <ArrowRight className="w-3 h-3" /> pay
            </span>
          </div>

          <ol className="relative mt-4">
            <span aria-hidden="true" className="absolute left-[3.5px] top-[44px] bottom-[44px] w-px bg-border-strong hidden lg:block" />
            {ROWS.map((r) => (
              <li key={r.failure} className={cn("relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 py-4 lg:py-0 lg:pr-10", ROW_H)}>
                {/* step */}
                <div className="flex items-start gap-3 sm:w-[46%] shrink-0">
                  <span aria-hidden="true" className="relative z-10 mt-[5px] w-2 h-2 border border-foreground-muted bg-background shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[13px] text-foreground-secondary">{r.step}</div>
                    <div className="mt-0.5 font-mono text-2xs text-foreground-muted truncate">{r.stepMeta}</div>
                  </div>
                </div>
                {/* connector */}
                <span aria-hidden="true" className="hidden sm:block flex-1 min-w-6 mx-3 border-t border-dashed border-danger/35" />
                {/* failure */}
                <div className="flex items-start gap-2.5 pl-5 sm:pl-0 sm:w-[40%] shrink-0">
                  <span className="mt-px flex items-center justify-center w-[18px] h-[18px] rounded-full bg-danger/10 ring-1 ring-danger/40 text-danger shrink-0">
                    <X className="w-2.5 h-2.5" strokeWidth={3} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-foreground">{r.failure}</div>
                    <div className="mt-0.5 text-2xs text-foreground-muted">{r.failureBody}</div>
                  </div>
                </div>
                {/* bridge into control panel */}
                <span aria-hidden="true" className="hidden lg:block absolute right-0 top-1/2 w-8 border-t border-dashed border-border-strong" />
              </li>
            ))}
          </ol>

          <Outcome tone="danger" label="Outcome" text="Funds released to an attacker-controlled address. Irreversibly." />
        </div>

        {/* HashX side */}
        <div className="lg:col-span-5">
          <div className="flex items-center gap-3 h-10">
            <span className="text-[13px] font-medium text-foreground">With HashX</span>
            <span className="text-xs text-foreground-muted">every failure has a named control</span>
          </div>

          <ol className="mt-4 rounded-lg border border-border bg-surface-1 shadow-panel divide-y divide-border/60 overflow-hidden">
            {ROWS.map((r) => (
              <li key={r.control} className={cn("flex items-center gap-3 px-4 sm:px-5 py-4 lg:py-0", ROW_H)}>
                <span className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-success/10 ring-1 ring-success/40 text-success shrink-0">
                  <Check className="w-2.5 h-2.5" strokeWidth={3} aria-hidden="true" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-foreground">{r.control}</div>
                  <div className="mt-0.5 text-2xs text-foreground-muted">{r.controlBody}</div>
                </div>
                <Code tone={r.tone} className="hidden sm:inline-flex">
                  {r.code}
                </Code>
              </li>
            ))}
          </ol>

          <Outcome tone="success" label="Outcome" text="Payment gated before money moves. Evidence preserved for audit." />
        </div>
      </div>
    </Section>
  );
}

function Outcome({ tone, label, text }: { tone: "danger" | "success"; label: string; text: string }) {
  return (
    <div className="mt-6 relative pl-4 lg:mr-10">
      <span aria-hidden="true" className={cn("absolute left-0 inset-y-0 w-0.5", tone === "danger" ? "bg-danger/70" : "bg-success/70")} />
      <div className="text-2xs text-foreground-muted">{label}</div>
      <div className={cn("mt-0.5 text-[13px]", tone === "danger" ? "text-foreground-secondary" : "text-foreground")}>{text}</div>
    </div>
  );
}
