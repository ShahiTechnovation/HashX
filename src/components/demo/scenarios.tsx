import React from "react";
import { Check, X, Repeat2, ShieldAlert, ShieldCheck, Ban, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineItem } from "@/components/ui/Timeline";
import type { Tone } from "@/components/ui/StatusBadge";
import {
  FIXTURE_INVOICE_TAMPERED,
  FIXTURE_INVOICE_FAKE_DELIVERY,
  FIXTURE_DELIVERY_FAKE_COUNT,
  FIXTURE_INVOICE_REPLAY,
  FIXTURE_PAYMENT_ATTEMPT_EXISTING,
  FIXTURE_INVOICE_GOLDEN,
  FIXTURE_PAYMENT_ATTEMPT_GOLDEN,
  FIXTURE_RECEIPT_GOLDEN,
} from "@/mocks/fixtures";
import { MOCK_RPC_TX_COUNT } from "@/components/trust/evaluate";
import { formatAddress } from "@/lib/formatters";

export type ScenarioId = "A" | "B" | "C" | "D";

export interface ScenarioLink {
  href: string;
  label: string;
}

export interface Scenario {
  id: ScenarioId;
  group: "Attacks" | "Reference run";
  kind: string;
  title: string;
  summary: string;
  lead: string;
  outcome: { label: string; tone: Tone; Icon: LucideIcon };
  claimLabel: string;
  claim: string;
  control: { name: string; detail: string };
  expected: { code?: string; text: string };
  steps: TimelineItem[];
  primary: ScenarioLink;
  secondary: ScenarioLink[];
  fixtureId: string;
}

const tampered = FIXTURE_INVOICE_TAMPERED;
const fake = FIXTURE_INVOICE_FAKE_DELIVERY;
const fakeArtifact = FIXTURE_DELIVERY_FAKE_COUNT.artifactContent;
export const CLAIMED_TX = fakeArtifact.transaction_count;
export const RECOMPUTED_TX = MOCK_RPC_TX_COUNT[FIXTURE_DELIVERY_FAKE_COUNT.id] ?? fakeArtifact.transaction_count;
const blocks = (a: number | string, b: number | string) =>
  `${Number(a).toLocaleString("en-US")}–${Number(b).toLocaleString("en-US")}`;

export const SCENARIOS: Scenario[] = [
  {
    id: "A",
    group: "Attacks",
    kind: "Invoice integrity",
    title: "Tampered invoice",
    summary: "Payee swapped after the seller signed.",
    lead: "A seller agent signs a $1.00 invoice. Before the buyer pays, the payee address is replaced with an attacker wallet. Every other field is untouched, so the invoice still looks legitimate.",
    outcome: { label: "Blocked", tone: "danger", Icon: ShieldAlert },
    claimLabel: "The attack",
    claim: "Substitute the payment destination in flight and let the buyer pay the attacker.",
    control: {
      name: "EIP-712 signature recovery",
      detail: "HashX recomputes the typed-data digest over all signed fields. A changed payee changes the digest, so the recovered signer is no longer the seller.",
    },
    expected: { code: "SIGNATURE_INVALID", text: "Verdict Rejected. request_payment is never reachable." },
    steps: [
      {
        title: "Seller signs the invoice",
        description: `EIP-712 HashXInvoice v1, payee ${formatAddress(tampered.sellerWallet)}.`,
        state: "done",
      },
      {
        title: "Payee substituted in transit",
        description: `${formatAddress(tampered.sellerWallet)} → ${formatAddress(tampered.payment.payee)}. The signature bytes are unchanged.`,
        state: "warning",
      },
      {
        title: "Signature recovery fails",
        description: "The recomputed digest no longer recovers to the seller wallet.",
        state: "failed",
      },
      {
        title: "Payment gate stays closed",
        description: "No payment attempt is created and no approval is requested.",
        state: "pending",
      },
    ],
    primary: { href: `/app/trust/${tampered.id}`, label: "Open in Trust Inspector" },
    secondary: [{ href: `/app/invoices/${tampered.id}`, label: "View invoice" }],
    fixtureId: tampered.id,
  },
  {
    id: "B",
    group: "Attacks",
    kind: "Fulfillment",
    title: "Fake fulfillment",
    summary: `Report claims ${CLAIMED_TX} transactions; the chain has ${RECOMPUTED_TX}.`,
    lead: `The seller delivers a signed analytics report for the requested address, claiming ${CLAIMED_TX} transactions across blocks ${blocks(fakeArtifact.start_block, fakeArtifact.end_block)}. The manifest is validly signed and the artifact hash matches.`,
    outcome: { label: "Blocked", tone: "danger", Icon: ShieldAlert },
    claimLabel: "The attack",
    claim: "Deliver plausible but fabricated data, correctly signed, and collect payment for it.",
    control: {
      name: "Objective fulfillment check",
      detail: `HashX recomputes the count for the same address and range from chain RPC, independently of the seller. In this simulation the RPC result is a fixture (chain ${fake.payment.preferred_chain_id}).`,
    },
    expected: { code: "TX_COUNT_MISMATCH", text: "Fulfillment rejected. Payment ineligible." },
    steps: [
      { title: "Invoice verified", description: "Signature, identity binding, expiry, and nonce all pass.", state: "done" },
      {
        title: "Delivery submitted",
        description: "Artifact and signed manifest arrive. Manifest signature and SHA-256 commitment check out.",
        state: "done",
      },
      {
        title: "RPC recomputation disagrees",
        description: `Chain returns ${RECOMPUTED_TX} transactions; the artifact claims ${CLAIMED_TX}.`,
        state: "failed",
      },
      {
        title: "Payment gate stays closed",
        description: "The invoice is valid, but nothing was objectively delivered.",
        state: "pending",
      },
    ],
    primary: { href: `/app/trust/${fake.id}`, label: "Open in Trust Inspector" },
    secondary: [{ href: `/app/invoices/${fake.id}`, label: "View invoice" }],
    fixtureId: fake.id,
  },
  {
    id: "C",
    group: "Attacks",
    kind: "Settlement",
    title: "Duplicate replay",
    summary: "request_payment called again on a live order.",
    lead: "A buyer bot on a flaky connection retries request_payment for an invoice that already has a payment attempt in flight. Without a guard, each retry would create a new attempt and could pay twice.",
    outcome: { label: "Deduplicated", tone: "warning", Icon: Repeat2 },
    claimLabel: "The fault",
    claim: "Retry or race request_payment until a second payment attempt is created for the same invoice.",
    control: {
      name: "Idempotent payment attempts",
      detail: "request_payment is keyed by invoice. While a non-terminal attempt exists, HashX returns it instead of creating a new order.",
    },
    expected: {
      text: `The same attempt (${FIXTURE_PAYMENT_ATTEMPT_EXISTING.id}) comes back on every call. Zero duplicate orders.`,
    },
    steps: [
      { title: "First request creates the attempt", description: `Simulated flow ${FIXTURE_PAYMENT_ATTEMPT_EXISTING.flowId} opened.`, state: "done" },
      { title: "Settlement in flight", description: "Simulated: in flight and not yet final.", state: "done" },
      { title: "Duplicate request arrives", description: "Same invoice, same payer, no new terms.", state: "warning" },
      { title: "Existing attempt returned", description: "No second quote, signature, or order.", state: "done" },
      { title: "One settlement continues", description: "Exactly one payment can reach finality.", state: "current" },
    ],
    primary: { href: `/app/settlements/${FIXTURE_PAYMENT_ATTEMPT_EXISTING.id}`, label: "View existing settlement" },
    secondary: [{ href: "/app/approvals", label: "Approval queue" }],
    fixtureId: FIXTURE_INVOICE_REPLAY.id,
  },
  {
    id: "D",
    group: "Reference run",
    kind: "End to end",
    title: "Golden path",
    summary: "Every gate clears; receipt issued (simulated).",
    lead: "A simulated walkthrough of the full lifecycle with nothing wrong: intent, signed invoice, objective fulfillment, two-stage human approval, settlement to finality, and a receipt. Hashes are illustrative; run the real Sepolia golden path in connected mode.",
    outcome: { label: "Settled", tone: "success", Icon: ShieldCheck },
    claimLabel: "The claim",
    claim: "A buyer agent purchases a $1.00 address analytics report from a registered seller agent.",
    control: {
      name: "All gates, in order",
      detail: "Invoice integrity, fulfillment verification, human authorization twice, and settlement reconciliation (simulated).",
    },
    expected: { text: "Simulated finality. Receipt issued with invoice and evidence digests (illustrative values)." },
    steps: [
      { title: "Buyer agent requests analytics", state: "done" },
      { title: "Seller creates structured invoice", state: "done" },
      { title: "Seller signs invoice (EIP-712)", state: "done" },
      { title: "Seller submits deliverable and manifest", state: "done" },
      { title: "HashX verifies invoice terms", state: "done" },
      { title: "HashX recomputes fulfillment over RPC", state: "done" },
      { title: "Payment eligibility unlocked", state: "done" },
      { title: "Payment obligation prepared", state: "done" },
      { title: "Human stage 1 approves exact terms", state: "done" },
      { title: "Wallet signs exact payment authorization", state: "done" },
      { title: "Human stage 2 approves submission", state: "done" },
      { title: "Payment broadcast (simulated)", state: "done" },
      { title: "Settlement finalized (simulated)", state: "done" },
      { title: "Receipt issued (simulated)", description: FIXTURE_RECEIPT_GOLDEN.id, state: "done" },
    ],
    primary: { href: `/app/receipts/${FIXTURE_RECEIPT_GOLDEN.id}`, label: "Inspect golden receipt" },
    secondary: [
      { href: `/app/trust/${FIXTURE_INVOICE_GOLDEN.id}`, label: "Trust Inspector" },
      { href: `/app/invoices/${FIXTURE_INVOICE_GOLDEN.id}`, label: "View invoice" },
    ],
    fixtureId: FIXTURE_INVOICE_GOLDEN.id,
  },
];

export const GOLDEN_ATTEMPT = FIXTURE_PAYMENT_ATTEMPT_GOLDEN;
export const TAMPERED_INVOICE = tampered;
export const FAKE_ARTIFACT = fakeArtifact;
export const FAKE_INVOICE = fake;

/* ------------------------------------------------------------------ */
/* Proof matrix: which control decides each scenario                   */
/* ------------------------------------------------------------------ */

type Mark = "pass" | "catch" | "dedupe" | "none";

const CONTROLS: Array<{ label: string; marks: Record<ScenarioId, Mark> }> = [
  { label: "Invoice integrity", marks: { A: "catch", B: "pass", C: "pass", D: "pass" } },
  { label: "Fulfillment", marks: { A: "none", B: "catch", C: "pass", D: "pass" } },
  { label: "Human authorization", marks: { A: "none", B: "none", C: "pass", D: "pass" } },
  { label: "Idempotent payment request", marks: { A: "none", B: "none", C: "dedupe", D: "pass" } },
  { label: "Receipt issuance", marks: { A: "none", B: "none", C: "none", D: "pass" } },
];

const MARK: Record<Mark, { Icon?: LucideIcon; cls: string; sr: string }> = {
  pass: { Icon: Check, cls: "text-foreground-muted", sr: "passed" },
  catch: { Icon: X, cls: "text-danger", sr: "caught here" },
  dedupe: { Icon: Repeat2, cls: "text-warning", sr: "deduplicated here" },
  none: { Icon: Ban, cls: "text-foreground-muted/30", sr: "not reached" },
};

export const ProofMatrix: React.FC<{ active: ScenarioId; onSelect: (id: ScenarioId) => void }> = ({ active, onSelect }) => (
  <div>
    <table className="w-full text-xs">
      <thead>
        <tr>
          <th className="text-left font-normal text-2xs text-foreground-muted pb-2">Control</th>
          {SCENARIOS.map((s) => (
            <th key={s.id} className="w-9 pb-2">
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-label={`Show scenario ${s.id}`}
                className={cn(
                  "w-6 h-6 rounded font-mono text-2xs transition-colors",
                  active === s.id ? "bg-surface-3 text-foreground ring-1 ring-inset ring-border-strong" : "text-foreground-muted hover:text-foreground"
                )}
              >
                {s.id}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border/50">
        {CONTROLS.map((c) => (
          <tr key={c.label}>
            <td className="py-2 pr-2 text-foreground-secondary">{c.label}</td>
            {SCENARIOS.map((s) => {
              const m = MARK[c.marks[s.id]];
              return (
                <td key={s.id} className={cn("py-2 text-center", active === s.id && "bg-surface-2/60")}>
                  {m.Icon && <m.Icon className={cn("w-3.5 h-3.5 inline-block", m.cls)} strokeWidth={2.25} aria-hidden="true" />}
                  <span className="sr-only">{m.sr}</span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-2xs text-foreground-muted">
      <span className="inline-flex items-center gap-1">
        <X className="w-3 h-3 text-danger" strokeWidth={2.5} aria-hidden="true" /> Caught
      </span>
      <span className="inline-flex items-center gap-1">
        <Repeat2 className="w-3 h-3 text-warning" strokeWidth={2.5} aria-hidden="true" /> Deduplicated
      </span>
      <span className="inline-flex items-center gap-1">
        <Check className="w-3 h-3" strokeWidth={2.5} aria-hidden="true" /> Passed
      </span>
      <span className="inline-flex items-center gap-1">
        <Ban className="w-3 h-3 text-foreground-muted/40" strokeWidth={2.5} aria-hidden="true" /> Not reached
      </span>
    </div>
  </div>
);
