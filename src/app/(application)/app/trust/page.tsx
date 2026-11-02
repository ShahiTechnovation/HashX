"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { LiveTrustList } from "@/components/live/trust/LiveTrustList";
import { demoClient, connectedClient } from "@/lib/api/client";
import { Delivery, Invoice, VerificationDecision, VerificationReasonCode } from "@/types/domain";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Metric, MetricStrip } from "@/components/ui/Metric";
import { Segmented, SearchInput } from "@/components/ui/Field";
import { SimulatedBadge } from "@/components/live/common";
import { cn } from "@/lib/utils";
import { formatAddress, formatMinorToUsd, formatTimestamp } from "@/lib/formatters";
import { ReasonCodeChip } from "@/components/trust/reasonCodes";
import { runInvoiceVerification, runDeliveryVerification } from "@/components/trust/evaluate";
import { evaluatePaymentEligibility } from "@/lib/verification/engine";

type VerdictFilter = "ALL" | VerificationDecision;

function DemoTrustIndexPage() {
  const router = useRouter();
  const { mode, refreshKey, triggerRefresh } = useApp();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("ALL");

  const client = mode === "connected" ? connectedClient : demoClient;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        const [data, dels] = await Promise.all([
          client.getInvoices(),
          client.getDeliveries().catch((err) => {
            console.error("Failed to load deliveries for trust index:", err);
            return [] as Delivery[];
          }),
        ]);
        if (isMounted) {
          setInvoices(data);
          setDeliveries(dels);
        }
      } catch (err) {
        console.error("Failed to load invoices for trust index:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [mode, refreshKey]);

  /** Re-derive reason codes and verdicts with deterministic engine */
  const records = useMemo(
    () =>
      invoices.map((inv) => {
        const codes: VerificationReasonCode[] = [];
        let verdict: VerificationDecision = "PENDING";
        try {
          const invoiceResult = runInvoiceVerification(inv);
          codes.push(...invoiceResult.reasonCodes);
          const del = deliveries.find((d) => d.invoiceId === inv.id);
          const deliveryResult = del ? runDeliveryVerification(inv, del) : undefined;
          if (deliveryResult) codes.push(...deliveryResult.reasonCodes);
          verdict = evaluatePaymentEligibility(invoiceResult, deliveryResult).overallDecision;
        } catch (err) {
          console.error(`Failed to evaluate ${inv.id}:`, err);
        }
        return { inv, verdict, codes: Array.from(new Set(codes)) };
      }),
    [invoices, deliveries]
  );

  const counts = {
    ALL: records.length,
    PASS: records.filter((r) => r.verdict === "PASS").length,
    FAIL: records.filter((r) => r.verdict === "FAIL").length,
    PENDING: records.filter((r) => r.verdict === "PENDING").length,
  };

  const blockedMinor = records
    .filter((r) => r.verdict === "FAIL")
    .reduce((sum, r) => sum + Number(r.inv.payment.amount_minor), 0);

  const verifiedMinor = records
    .filter((r) => r.verdict === "PASS")
    .reduce((sum, r) => sum + Number(r.inv.payment.amount_minor), 0);

  const rows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter(({ inv, verdict }) => {
      const inScope = verdictFilter === "ALL" || verdict === verdictFilter;
      const matches =
        !q ||
        inv.id.toLowerCase().includes(q) ||
        inv.sellerWallet.toLowerCase().includes(q) ||
        (inv.sellerDisplayName ?? "").toLowerCase().includes(q) ||
        inv.buyerRef.toLowerCase().includes(q);
      return inScope && matches;
    });
  }, [records, searchQuery, verdictFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Verification"
        title="Trust Inspector"
        badges={<SimulatedBadge />}
        description="Every invoice is checked twice before it can be paid: the signed commercial intent (EIP-712) and the delivered work against independently recomputed evidence."
        actions={
          <Button variant="secondary" size="sm" onClick={triggerRefresh} disabled={isLoading}>
            <RefreshCw className={cn(isLoading && "animate-spin")} />
            Re-evaluate
          </Button>
        }
      />

      <MetricStrip cols={4}>
        <Metric label="Audited" value={counts.ALL} hint="Invoices evaluated by the deterministic engine" />
        <Metric
          label="Verified"
          tone="success"
          value={counts.PASS}
          hint={<span className="tabular-nums">{formatMinorToUsd(verifiedMinor)} USDC eligible for human approval</span>}
        />
        <Metric
          label="Blocked"
          tone="danger"
          value={counts.FAIL}
          hint={<span className="tabular-nums">{formatMinorToUsd(blockedMinor)} USDC payment gated</span>}
        />
        <Metric label="Pending" tone="warning" value={counts.PENDING} hint="Awaiting delivery evidence" />
      </MetricStrip>

      <Panel>
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:px-5 md:flex-row md:items-center md:justify-between">
          <div className="-mx-1 overflow-x-auto px-1">
            <Segmented<VerdictFilter>
              value={verdictFilter}
              onChange={setVerdictFilter}
              options={[
                { value: "ALL", label: "All", count: counts.ALL },
                { value: "PASS", label: "Verified", count: counts.PASS },
                { value: "FAIL", label: "Blocked", count: counts.FAIL },
                { value: "PENDING", label: "Pending", count: counts.PENDING },
              ]}
            />
          </div>
          <SearchInput
            wrapperClassName="w-full md:w-72"
            placeholder="Search invoice, agent or wallet"
            aria-label="Search invoices"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="table-base min-w-[860px]">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Seller agent</th>
                <th className="text-right">Amount</th>
                <th>Verdict</th>
                <th>Reason codes</th>
                <th className="w-12">
                  <span className="sr-only">Inspect</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && records.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6}>
                      <div className="h-4 rounded bg-surface-2" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="!p-0">
                    <EmptyState
                      title="No matching records"
                      description="Try a different verdict filter or search term."
                    />
                  </td>
                </tr>
              ) : (
                rows.map(({ inv, verdict, codes }) => (
                  <tr
                    key={inv.id}
                    onClick={() => router.push(`/app/trust/${inv.id}`)}
                    className="group cursor-pointer hover:bg-surface-2/60"
                  >
                    <td>
                      <Link
                        href={`/app/trust/${inv.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-xs font-medium text-foreground group-hover:text-primary-light"
                      >
                        {inv.id}
                      </Link>
                      <div className="mt-0.5 text-xs text-foreground-muted">
                        {formatTimestamp(inv.issuedAt).replace(" UTC", "")}
                      </div>
                    </td>
                    <td>
                      <div className="max-w-[220px] truncate text-foreground">{inv.sellerDisplayName || "Agent"}</div>
                      <div className="mt-0.5 font-mono text-xs text-foreground-muted">{formatAddress(inv.sellerWallet)}</div>
                    </td>
                    <td className="text-right">
                      <span className="font-medium tabular-nums text-foreground">{formatMinorToUsd(inv.payment.amount_minor)}</span>
                      <span className="ml-1 text-xs text-foreground-muted">USDC</span>
                    </td>
                    <td>
                      <StatusBadge status={verdict} type="verdict" size="sm" />
                    </td>
                    <td>
                      <div className="flex max-w-xs flex-wrap items-center gap-1">
                        {codes.length === 0 ? (
                          <span className="text-xs text-foreground-muted">All checks conform</span>
                        ) : (
                          codes.map((code) => <ReasonCodeChip key={code} code={code} />)
                        )}
                      </div>
                    </td>
                    <td className="text-right">
                      <ChevronRight
                        aria-hidden="true"
                        className="ml-auto h-4 w-4 text-foreground-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export default function TrustIndexPage() {
  const { mode } = useApp();
  return mode === "connected" ? <LiveTrustList /> : <DemoTrustIndexPage />;
}
