"use client";

import React, { useState } from "react";
import {
  Terminal,
  Code,
  Copy,
  Check,
  Radio,
  ExternalLink,
  ShieldCheck,
  Server,
  Layers,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { Button } from "@/components/ui/Button";
import { CodeViewer } from "@/components/ui/CodeViewer";

interface MCPToolDef {
  name: string;
  mutates: boolean;
  authorization: string;
  idempotencyKey: string;
  description: string;
  requestSchema: object;
  responseSchema: object;
}

const HASHX_TOOLS: MCPToolDef[] = [
  {
    name: "create_invoice",
    mutates: true,
    authorization: "Seller / Integrator",
    idempotencyKey: "client_request_id",
    description: "Creates an unsigned structured commercial invoice bound to a service definition.",
    requestSchema: {
      client_request_id: "uuid",
      seller_counterparty_id: "uuid",
      buyer_ref: "string",
      service: {
        type: "hsk_address_analytics_v1",
        parameters: {
          address: "0x...",
          start_block: "uint64-string",
          end_block: "uint64-string",
        },
        acceptance_policy: "analytics_v1",
      },
      payment: {
        currency: "USD",
        amount_minor: "100",
        payee: "0x...",
        preferred_chain_id: 133,
      },
      expires_at: "RFC3339",
    },
    responseSchema: {
      invoice_id: "uuid",
      invoice_version: 1,
      status: "DRAFT",
      typed_data: {},
      invoice_digest: "0x...",
      created_at: "RFC3339",
    },
  },
  {
    name: "sign_invoice",
    mutates: true,
    authorization: "Seller Wallet (EOA)",
    idempotencyKey: "invoice_id + version",
    description: "Attaches a validated EIP-712 signature from the seller wallet to the invoice.",
    requestSchema: {
      invoice_id: "uuid",
      signature: "0x65-byte-signature",
      signer: "0x...",
    },
    responseSchema: {
      invoice_id: "uuid",
      status: "SIGNED",
      signature_valid: true,
      signer: "0x...",
      signed_digest: "0x...",
    },
  },
  {
    name: "verify_invoice",
    mutates: false,
    authorization: "Buyer / Integrator",
    idempotencyKey: "N/A",
    description: "Validates schema, EIP-712 signature, seller identity binding, expiry, and replay nonce.",
    requestSchema: {
      invoice_id: "uuid",
      expected_seller_id: "uuid",
      expected_buyer_ref: "string",
    },
    responseSchema: {
      decision: "PASS",
      checks: {
        schema: "PASS",
        signature: "PASS",
        identity_binding: "PASS",
        expiry: "PASS",
        nonce_unused: "PASS",
        terms_consistent: "PASS",
      },
      invoice_digest: "0x...",
      reason_codes: [],
    },
  },
  {
    name: "submit_delivery",
    mutates: true,
    authorization: "Seller Agent",
    idempotencyKey: "invoice_id + delivery_version",
    description: "Submits a digital artifact reference and signed manifest binding delivery to the invoice.",
    requestSchema: {
      invoice_id: "uuid",
      artifact_uri: "s3://...",
      artifact_sha256: "hex",
      manifest: {
        schema: "hashx.delivery.analytics.v1",
        seller: "0x...",
        generated_at: "RFC3339",
        service_parameters_hash: "0x...",
        artifact_sha256: "hex",
      },
      manifest_signature: "0x...",
    },
    responseSchema: {
      delivery_id: "uuid",
      status: "PENDING_VERIFICATION",
      submitted_at: "RFC3339",
    },
  },
  {
    name: "verify_delivery",
    mutates: false,
    authorization: "Buyer / System Verifier",
    idempotencyKey: "N/A",
    description: "Recomputes deterministic analytics facts against HashKey Chain RPC.",
    requestSchema: {
      invoice_id: "uuid",
      delivery_id: "uuid",
    },
    responseSchema: {
      decision: "PASS",
      verifier: "analytics_v1.0.0",
      checks: {
        manifest_signature: "PASS",
        artifact_hash: "PASS",
        schema: "PASS",
        requested_address: "PASS",
        block_range: "PASS",
        transaction_count: "PASS",
        sample_transaction_proofs: "PASS",
        freshness: "PASS",
      },
      evidence_digest: "0x...",
      reason_codes: [],
    },
  },
  {
    name: "request_payment",
    mutates: true,
    authorization: "Buyer Agent",
    idempotencyKey: "invoice_id",
    description: "Enforces payment eligibility and prepares the HSP payment order idempotently.",
    requestSchema: {
      invoice_id: "uuid",
      payer: "0x...",
      merchant_name: "HashX Global",
    },
    responseSchema: {
      payment_attempt_id: "uuid",
      state: "AWAITING_SIGNATURE_APPROVAL",
      flow_id: "...",
      payment_request_id: "...",
      pay_to: "0x...",
      payer: "0x...",
      token_total_raw: "...",
      quote_expires_at: "RFC3339",
      eip712: {},
      approval_summary: {},
    },
  },
  {
    name: "get_payment_status",
    mutates: false,
    authorization: "Buyer / Seller",
    idempotencyKey: "HSP IDs",
    description: "Polls HSP reconciler for authoritative payment progression and HashKey Chain tx hash.",
    requestSchema: {
      invoice_id: "uuid",
    },
    responseSchema: {
      payment_attempt_id: "uuid",
      hsp_status: "payment-processing",
      flow_id: "...",
      payment_request_id: "...",
      attribution_verified: true,
      tx_hash: null,
      last_queried_at: "RFC3339",
    },
  },
  {
    name: "get_receipt",
    mutates: false,
    authorization: "Authorized Participant",
    idempotencyKey: "invoice_id",
    description: "Retrieves verifiable proof linking commercial intent, fulfillment, and HSP settlement.",
    requestSchema: {
      invoice_id: "uuid",
    },
    responseSchema: {
      receipt_version: "1",
      invoice_digest: "0x...",
      seller: "0x...",
      buyer_ref: "...",
      delivery_evidence_digest: "0x...",
      payment: {
        hspStatus: "payment-finalized",
        flow_id: "...",
        payment_request_id: "...",
        tx_hash: "0x...",
        payer: "0x...",
        payee: "0x...",
        token_total_raw: "...",
      },
      evidence_registry_tx: "0x...",
    },
  },
];

export default function DevelopersWorkspacePage() {
  const { mode } = useApp();
  const [selectedTool, setSelectedTool] = useState<MCPToolDef>(HASHX_TOOLS[0]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <Terminal className="w-6 h-6 text-primary-light" />
            <span>Developer & MCP Integration</span>
          </h1>
          <p className="text-xs text-foreground-secondary mt-1">
            Standardized Model Context Protocol (MCP) tool catalog for autonomous AI agents transacting on HashKey Chain.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs font-mono flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                mode === "demo" ? "bg-primary animate-pulse" : "bg-warning"
              }`}
            />
            <span className="text-foreground">
              {mode === "demo"
                ? "Environment: Demo MCP Stubs"
                : "Environment: Live Backend (Requires Allowlisted IP)"}
            </span>
          </div>
        </div>
      </div>

      {/* Architecture Notice (PRD Section 16 Mandate) */}
      <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 text-xs text-foreground-secondary space-y-1.5">
        <div className="flex items-center gap-2 text-primary-light font-semibold font-mono">
          <Layers className="w-4 h-4" />
          <span>Architectural Distinction: HashX Tools vs HSP Tools</span>
        </div>
        <p className="leading-relaxed">
          The 8 tools below are <strong>HashX-owned commercial contracts</strong>. They govern intent, EIP-712 invoice authentication, delivery verification, and human authorization. They integrate with HSP's separate 8 tools (<code>get_chain_config</code>, <code>create_order</code>, <code>get_order</code>, <code>prepare_payment</code>, <code>finalize_payment</code>, <code>estimate_fee</code>, <code>submit_payment</code>, <code>query_payment</code>) on the backend via Streamable HTTP.
        </p>
      </div>

      {/* Main Grid: Tool List on Left, Schemas on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Tool Selector */}
        <div className="space-y-2">
          <span className="text-xs font-mono uppercase tracking-wider text-foreground-muted block px-1">
            HashX MCP Tools (8)
          </span>

          <div className="space-y-1.5">
            {HASHX_TOOLS.map((tool) => {
              const isSelected = selectedTool.name === tool.name;
              return (
                <button
                  key={tool.name}
                  type="button"
                  onClick={() => setSelectedTool(tool)}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                    isSelected
                      ? "bg-surface-2 border-primary shadow-sm ring-1 ring-primary"
                      : "bg-surface-1 border-border hover:bg-surface-hover"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-foreground">
                      {tool.name}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                        tool.mutates
                          ? "bg-warning/10 text-warning border-warning/30"
                          : "bg-surface-3 text-foreground-muted border-border"
                      }`}
                    >
                      {tool.mutates ? "MUTATES" : "READ-ONLY"}
                    </span>
                  </div>
                  <p className="text-[11px] text-foreground-secondary line-clamp-1">
                    {tool.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 2 Columns: Selected Tool Inspector */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-xl border border-border bg-surface-1 shadow-sm space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-lg font-mono font-bold text-foreground">
                  {selectedTool.name}
                </h3>
                <p className="text-xs text-foreground-secondary mt-0.5">
                  {selectedTool.description}
                </p>
              </div>

              <div className="text-right text-[11px] font-mono text-foreground-muted space-y-0.5">
                <div>Auth: <span className="text-foreground">{selectedTool.authorization}</span></div>
                <div>Idempotency: <span className="text-primary-light">{selectedTool.idempotencyKey}</span></div>
              </div>
            </div>

            {/* Request Schema */}
            <div className="space-y-1.5">
              <span className="text-xs font-mono uppercase text-foreground-muted font-semibold block">
                Request Schema
              </span>
              <CodeViewer
                title={`${selectedTool.name} Request Payload`}
                data={selectedTool.requestSchema}
                maxHeight="max-h-60"
              />
            </div>

            {/* Response Schema */}
            <div className="space-y-1.5">
              <span className="text-xs font-mono uppercase text-foreground-muted font-semibold block">
                Response Schema
              </span>
              <CodeViewer
                title={`${selectedTool.name} Response Payload`}
                data={selectedTool.responseSchema}
                maxHeight="max-h-60"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
