"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Filter,
  FileText,
  ShieldCheck,
  ArrowUpDown,
  ExternalLink,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import { Invoice, InvoiceStatus } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { formatAddress, formatTimestamp } from "@/lib/formatters";

export default function InvoicesListPage() {
  const { mode, refreshKey } = useApp();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const client = mode === "connected" ? connectedClient : demoClient;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadInvoices() {
      try {
        const data = await client.getInvoices();
        if (isMounted) setInvoices(data);
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

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.sellerWallet.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.buyerRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.sellerDisplayName && inv.sellerDisplayName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
            Invoice Workspace
          </h1>
          <p className="text-xs text-foreground-secondary mt-1">
            Cryptographically structured commercial requests authenticated by EIP-712 seller signatures.
          </p>
        </div>

        <Link href="/app/invoices/new">
          <Button variant="primary" size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </Button>
        </Link>
      </div>

      {/* Control bar */}
      <div className="p-4 rounded-xl border border-border bg-surface-1 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input
            type="text"
            placeholder="Search by invoice ID, seller, buyer reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-surface-2 border border-border text-foreground placeholder:text-foreground-muted font-mono focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-foreground-muted flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter invoices by status"
            className="py-1.5 px-3 text-xs rounded-lg bg-surface-2 border border-border text-foreground font-mono focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="ALL">All Statuses ({invoices.length})</option>
            <option value="DRAFT">Draft</option>
            <option value="SIGNED">Signed</option>
            <option value="VERIFIED">Verified</option>
            <option value="DELIVERED">Delivered</option>
            <option value="DELIVERY_ACCEPTED">Fulfillment Verified</option>
            <option value="SETTLED">Settled</option>
            <option value="REJECTED">Rejected</option>
            <option value="DELIVERY_REJECTED">Delivery Rejected</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-xl border border-border bg-surface-1 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2/60 text-foreground-muted border-b border-border font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Invoice ID</th>
                <th className="py-3.5 px-4">Seller Counterparty</th>
                <th className="py-3.5 px-4">Buyer Ref</th>
                <th className="py-3.5 px-4">Service</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Issued At</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-foreground-muted">
                    No commercial invoices match the specified criteria.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-surface-hover/50 transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-foreground">
                      <Link
                        href={`/app/invoices/${inv.id}`}
                        className="hover:text-primary-light transition-colors"
                      >
                        {inv.id}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground truncate max-w-[160px]">
                          {inv.sellerDisplayName || "Seller"}
                        </span>
                        <CopyableValue
                          value={inv.sellerWallet}
                          displayText={formatAddress(inv.sellerWallet)}
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-foreground-secondary truncate max-w-[120px]">
                      {inv.buyerRef}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-foreground-secondary">
                      {inv.service.type}
                    </td>
                    <td className="py-3.5 px-4">
                      <AmountDisplay
                        amountMinor={inv.payment.amount_minor}
                        size="sm"
                      />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={inv.status} type="invoice" size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-foreground-secondary font-mono">
                      {formatTimestamp(inv.issuedAt).split(" ")[0]}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link href={`/app/trust/${inv.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                            Trust
                          </Button>
                        </Link>
                        <Link href={`/app/invoices/${inv.id}`}>
                          <Button variant="secondary" size="sm" className="h-7 px-2.5 text-xs">
                            Details
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
