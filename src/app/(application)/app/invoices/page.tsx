"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Search,
  Download,
  CheckCircle2,
  Clock,
  KeyRound,
  ExternalLink,
  Layers,
  ArrowRight,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { LiveInvoiceList } from "@/components/live/invoices/LiveInvoiceList";
import { demoClient, connectedClient } from "@/lib/api/client";
import { Invoice, InvoiceStatus } from "@/types/domain";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { formatAddress, formatMinorToUsd, formatTimestamp } from "@/lib/formatters";

type Scope = "all" | "awaiting_delivery" | "witnessed" | "payable" | "settled" | "blocked";

const SCOPES: Array<{ value: Scope; label: string; statuses: InvoiceStatus[] | null }> = [
  { value: "all", label: "All Invoices", statuses: null },
  { value: "awaiting_delivery", label: "Awaiting Delivery", statuses: ["DRAFT", "SIGNED"] },
  { value: "witnessed", label: "Delivery Witnessed", statuses: ["VERIFIED", "DELIVERED"] },
  { value: "payable", label: "Awaiting Authorization", statuses: ["DELIVERY_ACCEPTED"] },
  { value: "settled", label: "Settled Archive", statuses: ["SETTLED"] },
  { value: "blocked", label: "Quarantined", statuses: ["REJECTED", "DELIVERY_REJECTED"] },
];

function DemoInvoicesPage() {
  const router = useRouter();
  const { mode, refreshKey, triggerRefresh } = useApp();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");

  const client = mode === "connected" ? connectedClient : demoClient;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadInvoices() {
      try {
        const data = await client.getInvoices();
        if (isMounted) {
          setInvoices(data);
          if (data.length > 0 && !selectedInvoiceId) {
            setSelectedInvoiceId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load invoices:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadInvoices();
    return () => {
      isMounted = false;
    };
  }, [mode, refreshKey]);

  const selectedInvoice = useMemo(
    () => invoices.find((i) => i.id === selectedInvoiceId) || invoices[0] || null,
    [invoices, selectedInvoiceId]
  );

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const currentScope = SCOPES.find((s) => s.value === scope);
    return invoices.filter((inv) => {
      const inScope = !currentScope?.statuses || currentScope.statuses.includes(inv.status);
      const matchesSearch =
        !q ||
        inv.id.toLowerCase().includes(q) ||
        inv.sellerWallet.toLowerCase().includes(q) ||
        inv.buyerRef.toLowerCase().includes(q) ||
        (inv.sellerDisplayName ?? "").toLowerCase().includes(q);
      return inScope && matchesSearch;
    });
  }, [invoices, searchQuery, scope]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        SCOPES.map((s) => [
          s.value,
          invoices.filter((i) => !s.statuses || s.statuses.includes(i.status)).length,
        ])
      ) as Record<Scope, number>,
    [invoices]
  );

  const totalDisbursementMinor = invoices
    .filter((i) => i.status !== "REJECTED" && i.status !== "DELIVERY_REJECTED")
    .reduce((sum, i) => sum + Number(i.payment.amount_minor), 0);

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions Strip */}
      <section className="bg-carbon-nav border border-carbon-border p-4 rounded select-none">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-carbon-muted mb-1">
              <span>Console</span>
              <span className="text-carbon-border">/</span>
              <span>Invoices &amp; Agreements</span>
              <span className="text-carbon-border">/</span>
              <span className="text-primary font-semibold">Commercial Registry v2.4</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-carbon-text tracking-tight uppercase">
              Commercial Invoice Workspace &amp; EIP-712 Registry
            </h1>
            <p className="text-xs text-carbon-muted font-mono mt-0.5">
              Deterministic cryptographic commitment &amp; independent chain witness settlement orchestrator.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(invoices, null, 2));
                const dl = document.createElement("a");
                dl.setAttribute("href", dataStr);
                dl.setAttribute("download", `hashx-invoices-${Date.now()}.json`);
                dl.click();
              }}
              className="px-3 py-1.5 rounded text-xs font-mono text-carbon-muted hover:text-carbon-text bg-carbon-panel border border-carbon-border hover:bg-carbon-void flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Ledger</span>
            </button>

            <button
              onClick={triggerRefresh}
              disabled={isLoading}
              className="px-3 py-1.5 rounded text-xs font-mono text-carbon-muted hover:text-carbon-text bg-carbon-panel border border-carbon-border hover:bg-carbon-void flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
              <span>Sync</span>
            </button>

            <Link
              href="/app/invoices/new"
              className="px-3.5 py-1.5 rounded text-xs font-mono font-semibold text-white bg-primary hover:bg-primary/90 flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create EIP-712 Invoice</span>
            </Link>
          </div>
        </div>

        {/* Telemetry Strip */}
        <div className="mt-4 pt-3 border-t border-carbon-border/70 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs font-mono text-carbon-muted">
          <div>
            Total Active Invoices: <span className="text-carbon-text font-bold">{invoices.length}</span>
          </div>
          <span>•</span>
          <div>
            Total Disbursement:{" "}
            <span className="text-success font-semibold">
              {formatMinorToUsd(totalDisbursementMinor)} USDC
            </span>
          </div>
          <span>•</span>
          <div>
            Signer Standard: <span className="text-carbon-text">EIP-712 Typed Data</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span className="text-success font-medium">HSP Link Synchronized</span>
          </div>
        </div>
      </section>

      {/* 2. Split-Pane Operations Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANE (7 cols / ~58%): High-Density Ledger */}
        <div className="lg:col-span-7 space-y-4">
          {/* Filter Tabs */}
          <div className="flex items-center overflow-x-auto gap-1 border-b border-carbon-border pb-1">
            {SCOPES.map((s) => (
              <button
                key={s.value}
                onClick={() => setScope(s.value)}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-colors shrink-0",
                  scope === s.value
                    ? "bg-carbon-panel text-carbon-text border border-carbon-border shadow-sm font-semibold"
                    : "text-carbon-muted hover:text-carbon-text hover:bg-carbon-panel/40 border border-transparent"
                )}
              >
                <span>{s.label}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-carbon-void text-[10px] text-carbon-muted border border-carbon-border/50">
                  {counts[s.value]}
                </span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-carbon-muted" />
            <input
              type="text"
              placeholder="Search by Invoice ID, Agent Counterparty, or Wallet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-carbon-void pl-9 pr-3 py-2 rounded text-xs font-mono text-carbon-text border border-carbon-border focus:border-primary focus:outline-none placeholder:text-carbon-muted/60"
            />
          </div>

          {/* Table */}
          <div className="bg-carbon-nav border border-carbon-border rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-carbon-void/80 border-b border-carbon-border text-[10px] font-mono uppercase tracking-wider text-carbon-muted">
                    <th className="py-2.5 px-3">INVOICE ID</th>
                    <th className="py-2.5 px-3">COUNTERPARTY</th>
                    <th className="py-2.5 px-3 text-right">AMOUNT (USDC)</th>
                    <th className="py-2.5 px-3 text-center">STATUS</th>
                    <th className="py-2.5 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-carbon-border font-mono text-[11.5px]">
                  {isLoading && invoices.length === 0 ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={5} className="p-4">
                          <div className="h-4 rounded bg-carbon-panel animate-pulse" />
                        </td>
                      </tr>
                    ))
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center">
                        <EmptyState
                          title="No matching invoices"
                          description="Adjust your search filters or create a new invoice to get started."
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const isSelected = selectedInvoice?.id === inv.id;
                      const isBlocked = inv.status === "REJECTED" || inv.status === "DELIVERY_REJECTED";
                      return (
                        <tr
                          key={inv.id}
                          onClick={() => setSelectedInvoiceId(inv.id)}
                          className={cn(
                            "cursor-pointer transition-colors",
                            isSelected
                              ? "bg-carbon-panel border-l-4 border-l-primary"
                              : "hover:bg-carbon-panel/40"
                          )}
                        >
                          <td className="py-3 px-3">
                            <div className="font-bold text-carbon-text flex items-center gap-1">
                              <span>{inv.id}</span>
                            </div>
                            <span className="text-[10px] text-carbon-muted block">
                              {formatTimestamp(inv.issuedAt).replace(" UTC", "")}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-sans font-medium text-carbon-text truncate max-w-[150px]">
                              {inv.sellerDisplayName || "External Agent"}
                            </div>
                            <div className="text-[10px] text-carbon-muted">
                              {formatAddress(inv.sellerWallet)}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right font-bold text-carbon-text">
                            {formatMinorToUsd(inv.payment.amount_minor)}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <StatusBadge status={inv.status} type="invoice" size="sm" />
                          </td>

                          <td className="py-3 px-3 text-right">
                            <Link
                              href={`/app/invoices/${inv.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-carbon-panel hover:bg-carbon-void border border-carbon-border text-[11px] font-mono text-carbon-muted hover:text-carbon-text transition-colors"
                            >
                              <span>Open</span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT PANE (5 cols / ~42%): Interactive Inspect Preview Card */}
        <div className="lg:col-span-5 space-y-4">
          {selectedInvoice ? (
            <div className="bg-carbon-nav border border-carbon-border rounded p-5 space-y-5 sticky top-20 shadow-lg">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-carbon-border">
                <div>
                  <span className="text-[10px] font-mono text-carbon-muted uppercase tracking-wider block">
                    ACTIVE OBLIGATION PREVIEW
                  </span>
                  <h3 className="font-display text-base font-bold text-carbon-text">
                    {selectedInvoice.id}
                  </h3>
                </div>
                <StatusBadge status={selectedInvoice.status} type="invoice" size="sm" />
              </div>

              {/* Amount Box */}
              <div className="p-4 bg-carbon-panel rounded border border-carbon-border">
                <span className="text-[10px] font-mono text-carbon-muted uppercase block">
                  Commercial Stake
                </span>
                <div className="text-2xl font-display font-bold text-carbon-text mt-1">
                  {formatMinorToUsd(selectedInvoice.payment.amount_minor)}{" "}
                  <span className="text-xs font-mono font-normal text-carbon-muted">USDC</span>
                </div>
                <div className="text-[11px] font-mono text-carbon-muted mt-1">
                  Payee: <span className="text-carbon-text font-mono">{formatAddress(selectedInvoice.payment.payee)}</span>
                </div>
              </div>

              {/* Scope & Service */}
              <div className="space-y-2 text-xs font-mono">
                <div className="p-3 bg-carbon-panel rounded border border-carbon-border space-y-1.5">
                  <div className="text-[10px] text-carbon-muted uppercase tracking-wider">
                    Service Specification
                  </div>
                  <div className="text-carbon-text font-medium">
                    {selectedInvoice.service.type}
                  </div>
                  <div className="text-[10px] text-carbon-muted">
                    Blocks: {selectedInvoice.service.parameters.start_block}–{selectedInvoice.service.parameters.end_block}
                  </div>
                  <div className="text-[10px] text-carbon-muted">
                    Acceptance Policy: {selectedInvoice.service.acceptance_policy}
                  </div>
                </div>

                {/* EIP-712 Verification Status */}
                <div className="p-3 bg-carbon-panel rounded border border-carbon-border space-y-1.5">
                  <div className="text-[10px] text-carbon-muted uppercase tracking-wider">
                    Cryptographic Integrity
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-carbon-muted">EIP-712 Signature:</span>
                    <span className="text-success font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Valid secp256k1
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-carbon-muted">Anti-Replay Nonce:</span>
                    <span className="text-carbon-text font-bold">#{selectedInvoice.nonce}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2 font-mono">
                <Link
                  href={`/app/trust/${selectedInvoice.id}`}
                  className="w-full px-4 py-2 rounded text-xs font-semibold text-white bg-primary hover:bg-primary/90 flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Inspect Evidence in Trust Inspector</span>
                </Link>

                <Link
                  href={`/app/invoices/${selectedInvoice.id}`}
                  className="w-full px-4 py-2 rounded text-xs font-medium text-carbon-text bg-carbon-panel border border-carbon-border hover:bg-carbon-void flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Open Full Invoice Workspace</span>
                  <ExternalLink className="w-3 h-3 text-carbon-muted" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-carbon-nav border border-carbon-border rounded p-8 text-center">
              <FileText className="w-8 h-8 text-carbon-muted mx-auto mb-2" />
              <p className="text-xs text-carbon-muted font-mono">
                Select an invoice to inspect cryptographic intent and evidence.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const { mode } = useApp();
  return mode === "connected" ? <LiveInvoiceList /> : <DemoInvoicesPage />;
}
