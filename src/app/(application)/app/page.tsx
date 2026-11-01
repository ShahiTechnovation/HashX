"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  ShieldCheck,
  ShieldAlert,
  Coins,
  ArrowUpRight,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import { Invoice, PaymentAttempt } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { formatAddress, formatTimestamp } from "@/lib/formatters";

export default function DashboardOverviewPage() {
  const { mode, refreshKey, triggerRefresh } = useApp();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentAttempts, setPaymentAttempts] = useState<PaymentAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const client = mode === "connected" ? connectedClient : demoClient;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        const invs = await client.getInvoices();
        const pays = await client.getPaymentAttempts();
        if (isMounted) {
          setInvoices(invs);
          setPaymentAttempts(pays);
        }
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [mode, refreshKey]);

  // Compute metrics from actual domain records
  const totalInvoices = invoices.length;
  const verifiedInvoices = invoices.filter(
    (i) => i.status === "VERIFIED" || i.status === "DELIVERY_ACCEPTED" || i.status === "SETTLED"
  ).length;
  const failedInvoices = invoices.filter(
    (i) => i.status === "REJECTED" || i.status === "DELIVERY_REJECTED"
  ).length;
  const pendingApprovals = paymentAttempts.filter(
    (p) => p.state === "AWAITING_SIGNATURE_APPROVAL" || p.state === "AWAITING_SUBMISSION_APPROVAL"
  );
  const finalizedSettlements = paymentAttempts.filter(
    (p) => p.hspStatus === "payment-finalized"
  ).length;

  // Filter invoices for recent activity table
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.id.toLowerCase().includes(filterQuery.toLowerCase()) ||
      inv.sellerWallet.toLowerCase().includes(filterQuery.toLowerCase()) ||
      inv.buyerRef.toLowerCase().includes(filterQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
            Commercial Trust Overview
          </h1>
          <p className="text-xs text-foreground-secondary mt-1">
            Real-time agentic obligations, cryptographic verification gates, and HSP settlement states.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={triggerRefresh}
            isLoading={isLoading}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>

          <Link href="/app/invoices/new">
            <Button variant="primary" size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              <span>Create Invoice</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl border border-border bg-surface-1 shadow-sm">
          <div className="flex items-center justify-between text-foreground-muted mb-2">
            <span className="text-xs font-medium">Total Invoices</span>
            <FileText className="w-4 h-4 text-primary-light" />
          </div>
          <div className="text-2xl font-mono font-bold text-foreground tabular-nums">
            {totalInvoices}
          </div>
          <span className="text-[11px] text-foreground-secondary mt-1 block">
            EIP-712 structured requests
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface-1 shadow-sm">
          <div className="flex items-center justify-between text-foreground-muted mb-2">
            <span className="text-xs font-medium">Verified Obligations</span>
            <ShieldCheck className="w-4 h-4 text-success" />
          </div>
          <div className="text-2xl font-mono font-bold text-success tabular-nums">
            {verifiedInvoices}
          </div>
          <span className="text-[11px] text-foreground-secondary mt-1 block">
            Policy & fulfillment valid
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface-1 shadow-sm">
          <div className="flex items-center justify-between text-foreground-muted mb-2">
            <span className="text-xs font-medium">Requires Approval</span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div className="text-2xl font-mono font-bold text-warning tabular-nums">
            {pendingApprovals.length}
          </div>
          <span className="text-[11px] text-foreground-secondary mt-1 block">
            Human authorization queue
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface-1 shadow-sm">
          <div className="flex items-center justify-between text-foreground-muted mb-2">
            <span className="text-xs font-medium">Finalized Settlement</span>
            <Coins className="w-4 h-4 text-primary-light" />
          </div>
          <div className="text-2xl font-mono font-bold text-primary-light tabular-nums">
            {finalizedSettlements}
          </div>
          <span className="text-[11px] text-foreground-secondary mt-1 block">
            Reconciled on HashKey Chain
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface-1 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-foreground-muted mb-2">
            <span className="text-xs font-medium">Security Failures</span>
            <ShieldAlert className="w-4 h-4 text-danger" />
          </div>
          <div className="text-2xl font-mono font-bold text-danger tabular-nums">
            {failedInvoices}
          </div>
          <span className="text-[11px] text-foreground-secondary mt-1 block">
            Blocked from payment
          </span>
        </div>
      </div>

      {/* Requires Attention Section (If pending approvals or failed audits exist) */}
      {pendingApprovals.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <h3 className="text-sm font-semibold text-foreground">
                Requires Attention — Human Authorization Pending ({pendingApprovals.length})
              </h3>
            </div>
            <Link
              href="/app/approvals"
              className="text-xs font-medium text-warning hover:underline inline-flex items-center gap-1"
            >
              <span>View Approval Queue</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingApprovals.map((attempt) => (
              <div
                key={attempt.id}
                className="p-3 rounded-lg bg-surface-1 border border-border flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-foreground truncate">
                      {attempt.approvalSummary.merchantName}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-warning/10 text-warning border border-warning/30">
                      {attempt.state.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="text-xs text-foreground-secondary font-mono mt-1">
                    Paying: {attempt.approvalSummary.humanAmount} • Payee: {formatAddress(attempt.payee)}
                  </div>
                </div>

                <Link href={`/app/approvals/${attempt.id}`}>
                  <Button variant="primary" size="sm" className="shrink-0 text-xs">
                    Review
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Commercial Invoices Workspace Table */}
      <div className="rounded-xl border border-border bg-surface-1 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Commercial Activity
            </h3>
            <p className="text-xs text-foreground-secondary mt-0.5">
              Verified commercial intent, signed invoices, and fulfillment telemetry.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
              <input
                type="text"
                placeholder="Search invoice or wallet..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-surface-2 border border-border text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary w-48 sm:w-60 font-mono"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter invoices by status"
              className="py-1.5 px-3 text-xs rounded-lg bg-surface-2 border border-border text-foreground font-mono focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SIGNED">Signed</option>
              <option value="VERIFIED">Verified</option>
              <option value="DELIVERY_ACCEPTED">Fulfillment Verified</option>
              <option value="SETTLED">Settled</option>
              <option value="REJECTED">Rejected</option>
              <option value="DELIVERY_REJECTED">Delivery Rejected</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2/60 text-foreground-muted border-b border-border font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Invoice ID</th>
                <th className="py-3 px-4">Seller Agent</th>
                <th className="py-3 px-4">Service Category</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Commercial Status</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-foreground-muted">
                    No matching invoices found.
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
                        <span className="font-medium text-foreground">
                          {inv.sellerDisplayName || "Seller Agent"}
                        </span>
                        <CopyableValue
                          value={inv.sellerWallet}
                          displayText={formatAddress(inv.sellerWallet)}
                        />
                      </div>
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
                      {formatTimestamp(inv.createdAt).split(" ")[0]}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link href={`/app/trust/${inv.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                            Inspect Trust
                          </Button>
                        </Link>
                        <Link href={`/app/invoices/${inv.id}`}>
                          <Button variant="secondary" size="sm" className="h-7 px-2 text-xs">
                            View
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
