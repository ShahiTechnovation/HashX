"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, ChevronRight, ShieldCheck, FileText, Download, ArrowRight } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { LiveInvoiceList } from "@/components/live/invoices/LiveInvoiceList";
import { demoClient, connectedClient } from "@/lib/api/client";
import { Invoice, InvoiceStatus } from "@/types/domain";
import { StatusBadge, toneStyles } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader, MetaItem } from "@/components/ui/PageHeader";
import { Panel, PanelBody, PanelFooter } from "@/components/ui/Panel";
import { DataList, DataRow } from "@/components/ui/DataList";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Segmented, SearchInput } from "@/components/ui/Field";
import { SimulatedBadge } from "@/components/live/common";
import { cn } from "@/lib/utils";
import { formatAddress, formatMinorToUsd, formatTimestamp } from "@/lib/formatters";

type Scope = "all" | "awaiting_delivery" | "witnessed" | "payable" | "settled" | "blocked";

const SCOPES: Array<{ value: Scope; label: string; statuses: InvoiceStatus[] | null }> = [
  { value: "all", label: "All", statuses: null },
  { value: "awaiting_delivery", label: "Awaiting delivery", statuses: ["DRAFT", "SIGNED"] },
  { value: "witnessed", label: "In verification", statuses: ["VERIFIED", "DELIVERED"] },
  { value: "payable", label: "Awaiting authorization", statuses: ["DELIVERY_ACCEPTED"] },
  { value: "settled", label: "Settled", statuses: ["SETTLED"] },
  { value: "blocked", label: "Blocked", statuses: ["REJECTED", "DELIVERY_REJECTED"] },
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

  const signatureState = (inv: Invoice): { label: string; tone: "success" | "danger" | "warning" | "neutral" } => {
    if (inv.signatureValid === true) return { label: "Signature valid", tone: "success" };
    if (inv.signatureValid === false) return { label: "Signature invalid", tone: "danger" };
    if (inv.signature) return { label: "Signed · not yet verified", tone: "warning" };
    return { label: "Not signed", tone: "neutral" };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        badges={<SimulatedBadge />}
        description="Signed commercial agreements between agents. Each invoice binds seller, buyer, service terms and payment terms in EIP-712 typed data."
        meta={
          <>
            <MetaItem label="Invoices">
              <span className="tabular-nums">{invoices.length}</span>
            </MetaItem>
            <MetaItem label="Open volume">
              <span className="tabular-nums">{formatMinorToUsd(totalDisbursementMinor)}</span>
            </MetaItem>
          </>
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(invoices, null, 2));
                const dl = document.createElement("a");
                dl.setAttribute("href", dataStr);
                dl.setAttribute("download", `hashx-invoices-${Date.now()}.json`);
                dl.click();
              }}
            >
              <Download />
              Export
            </Button>
            <Button variant="secondary" size="sm" onClick={triggerRefresh} disabled={isLoading}>
              <RefreshCw className={cn(isLoading && "animate-spin")} />
              Refresh
            </Button>
            <Link href="/app/invoices/new" className={buttonStyles({ variant: "primary", size: "sm" })}>
              <Plus />
              Create invoice
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Ledger */}
        <Panel className="lg:col-span-8">
          <div className="space-y-3 border-b border-border px-4 py-3 sm:px-5">
            <div className="-mx-1 overflow-x-auto px-1">
              <Segmented
                value={scope}
                onChange={setScope}
                size="sm"
                options={SCOPES.map((s) => ({ value: s.value, label: s.label, count: counts[s.value] }))}
              />
            </div>
            <SearchInput
              placeholder="Search invoice ID, seller, wallet, or reference"
              aria-label="Search invoices"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="table-base min-w-[640px]">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Seller</th>
                  <th className="text-right">Amount</th>
                  <th>Status</th>
                  <th className="text-right">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && invoices.length === 0 ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5}>
                        <div className="h-4 rounded bg-surface-2" />
                      </td>
                    </tr>
                  ))
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <EmptyState
                        title="No matching invoices"
                        description="Adjust the filter or search, or create a new invoice to get started."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const isSelected = selectedInvoice?.id === inv.id;
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => setSelectedInvoiceId(inv.id)}
                        aria-selected={isSelected}
                        className={cn(
                          "group cursor-pointer",
                          isSelected ? "bg-primary-subtle/60 shadow-[inset_2px_0_0_rgb(var(--primary))]" : "hover:bg-surface-2/60"
                        )}
                      >
                        <td>
                          <div className="whitespace-nowrap font-mono text-xs font-medium text-foreground">{inv.id}</div>
                          <div className="mt-0.5 text-xs text-foreground-muted">
                            {formatTimestamp(inv.issuedAt).replace(" UTC", "")}
                          </div>
                        </td>
                        <td>
                          <div className="max-w-[160px] truncate font-medium text-foreground">
                            {inv.sellerDisplayName || "External agent"}
                          </div>
                          <div className="mt-0.5 font-mono text-xs text-foreground-muted">{formatAddress(inv.sellerWallet)}</div>
                        </td>
                        <td className="text-right font-medium text-foreground tabular-nums">
                          {formatMinorToUsd(inv.payment.amount_minor)}
                        </td>
                        <td>
                          <StatusBadge status={inv.status} type="invoice" size="sm" />
                        </td>
                        <td className="text-right">
                          <Link
                            href={`/app/invoices/${inv.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[13px] text-foreground-muted transition-colors hover:text-foreground"
                          >
                            Open
                            <ChevronRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Selected invoice preview */}
        <div className="lg:sticky lg:top-6 lg:col-span-4">
          {selectedInvoice ? (
            <Panel>
              <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
                <div className="min-w-0">
                  <p className="text-xs text-foreground-muted">Selected invoice</p>
                  <h2 className="mt-1 truncate font-mono text-[13px] font-medium text-foreground">{selectedInvoice.id}</h2>
                </div>
                <StatusBadge status={selectedInvoice.status} type="invoice" size="sm" />
              </div>

              <div className="border-b border-border px-5 py-5">
                <p className="text-xs text-foreground-muted">Amount</p>
                <p className="mt-1 text-[30px] font-medium leading-none tracking-[-0.03em] text-foreground tabular-nums">
                  {formatMinorToUsd(selectedInvoice.payment.amount_minor)}{" "}
                  <span className="text-[15px] font-normal tracking-normal text-foreground-muted">{selectedInvoice.payment.currency}</span>
                </p>
              </div>

              <PanelBody>
                <DataList>
                  <DataRow label="Payee">
                    <CopyableValue value={selectedInvoice.payment.payee} displayText={formatAddress(selectedInvoice.payment.payee)} />
                  </DataRow>
                  <DataRow label="Service">
                    <span className="font-mono text-xs">{selectedInvoice.service.type}</span>
                  </DataRow>
                  <DataRow label="Block range">
                    <span className="font-mono text-xs tabular-nums">
                      {selectedInvoice.service.parameters.start_block}–{selectedInvoice.service.parameters.end_block}
                    </span>
                  </DataRow>
                  <DataRow label="Acceptance policy">
                    <span className="font-mono text-xs">{selectedInvoice.service.acceptance_policy}</span>
                  </DataRow>
                  <DataRow label="EIP-712 signature">
                    {(() => {
                      const sig = signatureState(selectedInvoice);
                      return (
                        <span className={cn("inline-flex items-center gap-1.5 text-[13px]", toneStyles[sig.tone].text)}>
                          <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", toneStyles[sig.tone].dot)} />
                          {sig.label}
                        </span>
                      );
                    })()}
                  </DataRow>
                  <DataRow label="Nonce">
                    <span className="font-mono text-xs tabular-nums">{selectedInvoice.nonce}</span>
                  </DataRow>
                </DataList>
              </PanelBody>

              <PanelFooter className="flex flex-col gap-2 sm:flex-row">
                <Link href={`/app/trust/${selectedInvoice.id}`} className={cn(buttonStyles({ variant: "primary", size: "sm" }), "flex-1")}>
                  <ShieldCheck />
                  Inspect evidence
                </Link>
                <Link href={`/app/invoices/${selectedInvoice.id}`} className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "flex-1")}>
                  Open invoice
                  <ArrowRight />
                </Link>
              </PanelFooter>
            </Panel>
          ) : (
            <Panel>
              <EmptyState
                icon={<FileText className="h-[18px] w-[18px]" />}
                title="No invoice selected"
                description="Select an invoice to inspect its terms, signature, and evidence."
              />
            </Panel>
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
