import React from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section, SectionIntro, fadeMask } from "./primitives";

/* ------------------------------------------------------------------ */
/* Diagram geometry (viewBox 1200 × 600)                               */
/* ------------------------------------------------------------------ */

type NodeDef = { id: string; x: number; y: number; w: number; title: string; sub: string; meta: string; highlight?: boolean };

const NODE_H = 84;

const NODES: NodeDef[] = [
  { id: "seller", x: 36, y: 110, w: 180, title: "Seller Agent", sub: "Issues and signs invoices", meta: "0x742d…f44e" },
  { id: "buyer", x: 36, y: 330, w: 180, title: "Buyer Agent", sub: "Requests payment", meta: "0x1234…7890" },
  { id: "invoice", x: 340, y: 110, w: 200, title: "Invoice Layer", sub: "Structured, EIP-712 signed", meta: "nonce · expiry · terms_hash" },
  { id: "verify", x: 660, y: 110, w: 200, title: "Verification Engine", sub: "Deterministic checks", meta: "6 invoice · 8 delivery", highlight: true },
  { id: "mcp", x: 340, y: 330, w: 200, title: "MCP Interface", sub: "Streamable HTTP", meta: "8 tools" },
  { id: "approval", x: 660, y: 330, w: 200, title: "Human Approval Layer", sub: "Two-stage authorization", meta: "sign → submit" },
  { id: "rpc", x: 984, y: 110, w: 180, title: "HashKey Chain RPC", sub: "Source of fulfillment facts", meta: "block-range reads" },
  { id: "hsp", x: 984, y: 330, w: 180, title: "HSP Settlement Rail", sub: "Agentic payment rail", meta: "USDT · chain 133" },
];

type EdgeDef = { d: string; label: string; lx: number; ly: number; anchor?: "middle" | "start"; both?: boolean };

const EDGES: EdgeDef[] = [
  { d: "M216 152 H336", label: "EIP-712 invoice", lx: 278, ly: 140 },
  { d: "M540 152 H656", label: "invoice digest", lx: 600, ly: 140 },
  { d: "M864 152 H980", label: "fulfillment reads", lx: 922, ly: 140, both: true },
  { d: "M760 194 V326", label: "evidence digest", lx: 772, ly: 264, anchor: "start" },
  { d: "M216 372 H336", label: "MCP tool call", lx: 278, ly: 360 },
  { d: "M540 372 H656", label: "payment intent", lx: 600, ly: 360 },
  { d: "M860 372 H980", label: "exact terms", lx: 922, ly: 360 },
  { d: "M760 414 V506", label: "approval digest", lx: 772, ly: 488, anchor: "start" },
  { d: "M1074 414 V506", label: "tx hash", lx: 1086, ly: 488, anchor: "start" },
  { d: "M126 510 V418", label: "receipt commitment", lx: 138, ly: 488, anchor: "start" },
];

const C = {
  fg: "rgb(var(--foreground))",
  fg2: "rgb(var(--foreground-secondary))",
  muted: "rgb(var(--foreground-muted))",
  border: "rgb(var(--border))",
  strong: "rgb(var(--border-strong))",
  s1: "rgb(var(--surface-1))",
  bg: "rgb(var(--background))",
  primary: "rgb(var(--primary))",
};

function DiagramNode({ n }: { n: NodeDef }) {
  return (
    <g>
      <rect
        x={n.x}
        y={n.y}
        width={n.w}
        height={NODE_H}
        rx={6}
        fill={C.s1}
        stroke={n.highlight ? "rgb(var(--primary) / 0.65)" : C.strong}
        strokeWidth={1}
      />
      {n.highlight && <rect x={n.x + n.w - 18} y={n.y + 12} width={6} height={6} fill={C.primary} />}
      <text x={n.x + 16} y={n.y + 30} fill={C.fg} fontSize={13} fontWeight={500} className="font-sans">
        {n.title}
      </text>
      <text x={n.x + 16} y={n.y + 49} fill={C.muted} fontSize={11} className="font-sans">
        {n.sub}
      </text>
      <text x={n.x + 16} y={n.y + 68} fill={C.fg2} fontSize={10.5} className="font-mono" opacity={0.85}>
        {n.meta}
      </text>
    </g>
  );
}

function Diagram() {
  return (
    <svg viewBox="0 0 1200 600" className="w-full h-auto" role="img" aria-labelledby="arch-title arch-desc">
      <title id="arch-title">HashX system architecture</title>
      <desc id="arch-desc">
        Seller agent sends an EIP-712 invoice to the invoice layer; the verification engine checks it and reads fulfillment facts from
        HashKey Chain RPC; the evidence digest flows to the human approval layer, which receives payment intents from the buyer agent via
        MCP and sends exact terms to the HSP settlement rail. Approval digests and the settlement tx hash are anchored in the evidence
        registry, which returns a receipt commitment to the buyer agent.
      </desc>
      <defs>
        <marker id="arch-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0.5 L7 4 L0 7.5" fill="none" stroke={C.muted} strokeWidth={1.2} />
        </marker>
      </defs>

      {/* Zones */}
      <rect x={20} y={40} width={212} height={420} rx={8} fill="none" stroke={C.border} strokeDasharray="3 4" />
      <rect x={300} y={40} width={600} height={420} rx={8} fill="rgb(var(--surface-1) / 0.35)" stroke={C.strong} />
      <rect x={968} y={40} width={212} height={420} rx={8} fill="none" stroke={C.border} strokeDasharray="3 4" />

      <text x={36} y={70} fill={C.muted} fontSize={11} className="font-sans" letterSpacing="0.08em">
        AGENTS
      </text>
      <text x={316} y={71} fill={C.fg} fontSize={13} fontWeight={600} className="font-display" letterSpacing="-0.02em">
        HashX
      </text>
      <text x={362} y={70} fill={C.muted} fontSize={11} className="font-sans">
        trust boundary
      </text>
      <text x={984} y={70} fill={C.muted} fontSize={11} className="font-sans" letterSpacing="0.08em">
        HASHKEY CHAIN · 133
      </text>

      {/* Edges */}
      {EDGES.map((e) => (
        <g key={e.label}>
          <path d={e.d} fill="none" stroke={C.strong} strokeWidth={1} />
          <path
            d={e.d}
            fill="none"
            stroke={C.muted}
            strokeWidth={1}
            strokeDasharray="3 5"
            className="animate-flow-dash"
            markerEnd="url(#arch-arrow)"
            markerStart={e.both ? "url(#arch-arrow)" : undefined}
          />
          <text x={e.lx} y={e.ly} textAnchor={e.anchor ?? "middle"} fill={C.fg2} fontSize={11} className="font-sans">
            {e.label}
          </text>
        </g>
      ))}

      {/* Nodes */}
      {NODES.map((n) => (
        <DiagramNode key={n.id} n={n} />
      ))}

      {/* Evidence registry base layer */}
      <rect x={20} y={510} width={1160} height={64} rx={6} fill={C.s1} stroke={C.strong} />
      <text x={36} y={538} fill={C.fg} fontSize={13} fontWeight={500} className="font-sans">
        Evidence Registry · Receipt Layer
      </text>
      <text x={36} y={557} fill={C.muted} fontSize={11} className="font-sans">
        Digests anchored on HashKey Chain. Each receipt binds intent, fulfillment, authorization, and settlement.
      </text>
      <text x={1164} y={547} textAnchor="end" fill={C.fg2} fontSize={10.5} className="font-mono" opacity={0.85}>
        rcpt-golden-001 · 0x8e9f…8e9f
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Stacked version for narrow viewports                                */
/* ------------------------------------------------------------------ */

const STACK: Array<{ title: string; sub: string; highlight?: boolean; via?: string; side?: string }> = [
  { title: "Seller Agent", sub: "Issues and signs invoices", via: "EIP-712 invoice" },
  { title: "Invoice Layer", sub: "Structured, EIP-712 signed", via: "invoice digest" },
  { title: "Verification Engine", sub: "Deterministic checks", highlight: true, side: "Reads fulfillment facts from HashKey Chain RPC", via: "evidence digest" },
  { title: "Human Approval Layer", sub: "Two-stage authorization", side: "Payment intent from Buyer Agent via MCP", via: "exact terms" },
  { title: "HSP Settlement Rail", sub: "USDT on HashKey Chain", via: "tx hash" },
  { title: "Evidence Registry · Receipt Layer", sub: "Digests anchored on-chain", via: "receipt commitment" },
  { title: "Buyer Agent", sub: "Holds a verifiable receipt" },
];

function StackedDiagram() {
  return (
    <ol className="space-y-0">
      {STACK.map((s) => (
        <li key={s.title}>
          <div
            className={cn(
              "relative rounded-md border bg-surface-1 px-4 py-3",
              s.highlight ? "border-primary/50" : "border-border-strong"
            )}
          >
            {s.highlight && <span aria-hidden="true" className="absolute right-3 top-3 w-1.5 h-1.5 bg-primary" />}
            <div className="text-[13px] font-medium text-foreground">{s.title}</div>
            <div className="text-2xs text-foreground-muted mt-0.5">{s.sub}</div>
            {s.side && <div className="mt-2 pt-2 border-t border-border/60 text-2xs text-foreground-secondary">{s.side}</div>}
          </div>
          {s.via && (
            <div className="relative h-10 flex items-center">
              <span aria-hidden="true" className="absolute left-5 top-0 bottom-1 w-px bg-border-strong" />
              <ArrowDown aria-hidden="true" className="absolute left-[14.5px] bottom-0 w-3 h-3 text-foreground-muted" />
              <span className="pl-9 text-2xs text-foreground-secondary">{s.via}</span>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

const PRINCIPLES = [
  { title: "Agents never hold settlement authority", body: "Agents propose and request. Only a human-approved, exact-terms order reaches HSP." },
  { title: "Funds move on the HSP rail", body: "HashX prepares, gates, and reconciles orders. Payment flows payer to payee on HashKey Chain." },
  { title: "The chain is the source of truth", body: "Fulfillment and finality are read from HashKey Chain — never reported by a counterparty." },
];

export function ArchitectureSection() {
  return (
    <Section id="architecture">
      <SectionIntro
        layout="split"
        eyebrow="Architecture"
        title="A trust boundary between agents and money."
        description="Agents talk to HashX, not to the payment rail. Every hop carries a verifiable artifact, and every artifact ends up in the evidence registry."
      />

      <div className="relative mt-14">
        <div aria-hidden="true" className="absolute inset-x-0 sm:-inset-x-6 -inset-y-8 bg-grid opacity-50" style={fadeMask("ellipse 75% 70% at 50% 50%")} />
        <div className="relative hidden lg:block">
          <Diagram />
        </div>
        <div className="relative lg:hidden max-w-md">
          <StackedDiagram />
        </div>
      </div>

      <dl className="mt-14 grid grid-cols-1 md:grid-cols-3 border-t border-border">
        {PRINCIPLES.map((p, i) => (
          <div key={p.title} className={cn("pt-6 md:pr-8", i > 0 && "md:pl-8 md:border-l md:border-border max-md:mt-2")}>
            <dt className="text-[13px] font-medium text-foreground">{p.title}</dt>
            <dd className="mt-1.5 text-[13px] leading-relaxed text-foreground-muted">{p.body}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
