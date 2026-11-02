"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { RefreshCw, ArrowRight, KeyRound, Clock, CheckCircle2 } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { LiveApprovals } from "@/components/live/payments/LiveApprovals";
import { demoClient, connectedClient } from "@/lib/api/client";
import { PaymentAttempt } from "@/types/domain";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Metric, MetricStrip } from "@/components/ui/Metric";
import { Segmented, SearchInput } from "@/components/ui/Field";
import { Button, buttonStyles } from "@/components/ui/Button";
import { SimulatedBadge } from "@/components/live/common";
import { cn } from "@/lib/utils";
import { formatAddress } from "@/lib/formatters";
import {
  getApprovalGroup,
  getQuoteExpiry,
  merchantDisplayName,
  ToneBadge,
  useNow,
} from "@/components/approvals/approval-primitives";
import { splitHumanAmount } from "@/components/approvals/amount-utils";

type Filter = "ALL" | "PENDING" | "COMPLETED";

/** Connected mode renders only real backend records; demo mode keeps the simulated fixture view. */
export default function ApprovalsPage() {
  const { mode } = useApp();
  return mode === "connected" ? <LiveApprovals /> : <DemoApprovalsQueuePage />;
}

function DemoApprovalsQueuePage() {
  const { mode, refreshKey, triggerRefresh } = useApp();
  const [paymentAttempts, setPaymentAttempts] = useState<PaymentAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStage, setFilterStage] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const now = useNow(1000);

  const client = mode === "connected" ? connectedClient : demoClient;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        const data = await client.getPaymentAttempts();
        if (isMounted) setPaymentAttempts(data);
      } catch (err) {
        console.error("Failed to load payment attempts for approvals:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [mode, refreshKey]);

  const pending = paymentAttempts.filter((p) => getApprovalGroup(p.state) !== "completed");
  const signingCount = paymentAttempts.filter((p) => getApprovalGroup(p.state) === "signing").length;
  const submissionCount = paymentAttempts.filter((p) => getApprovalGroup(p.state) === "submission").length;
  const completedCount = paymentAttempts.length - pending.length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return paymentAttempts.filter((p) => {
      const group = getApprovalGroup(p.state);
      const inFilter =
        filterStage === "ALL" ||
        (filterStage === "PENDING" && group !== "completed") ||
        (filterStage === "COMPLETED" && group === "completed");
      const matches =
        !q ||
        p.id.toLowerCase().includes(q) ||
        p.invoiceId.toLowerCase().includes(q) ||
        p.payee.toLowerCase().includes(q) ||
        merchantDisplayName(p.approvalSummary?.merchantName ?? p.merchantName).toLowerCase().includes(q);
      return inFilter && matches;
    });
  }, [paymentAttempts, filterStage, query]);

  const filterOptions: Array<{ value: Filter; label: string; count: number }> = [
    { value: "ALL", label: "All", count: paymentAttempts.length },
    { value: "PENDING", label: "Needs decision", count: pending.length },
    { value: "COMPLETED", label: "Completed", count: completedCount },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Human authorization"
        title="Approvals"
        badges={<SimulatedBadge />}
        description="Every payment needs two explicit human approvals — review the exact terms, then authorize submission. Agents can request a payment but can never approve one."
        actions={
          <Button variant="secondary" size="sm" onClick={triggerRefresh} disabled={isLoading}>
            <RefreshCw className={cn(isLoading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <MetricStrip cols={4}>
        <Metric label="Requests" value={paymentAttempts.length} hint="Across all stages" />
        <Metric label="Stage 1 · terms review" value={signingCount} tone={signingCount > 0 ? "warning" : undefined} hint="Awaiting signing approval" />
        <Metric
          label="Stage 2 · submission"
          value={submissionCount}
          tone={submissionCount > 0 ? "warning" : undefined}
          hint="Awaiting submission approval"
        />
        <Metric label="Completed" value={completedCount} tone={completedCount > 0 ? "success" : undefined} hint="Both stages approved" />
      </MetricStrip>

      <Panel>
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:px-5 md:flex-row md:items-center md:justify-between">
          <Segmented value={filterStage} onChange={setFilterStage} options={filterOptions} />
          <SearchInput
            wrapperClassName="w-full md:w-72"
            placeholder="Search ID, merchant, or payee"
            aria-label="Search approvals"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {isLoading && paymentAttempts.length === 0 ? (
          <div className="space-y-3 p-5" aria-busy="true" aria-label="Loading approvals">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-surface-2" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<KeyRound className="h-[18px] w-[18px]" />}
            title="No authorization requests"
            description="Adjust the filter or search. New requests appear here when a buyer requests payment for verified work."
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((attempt) => {
              const group = getApprovalGroup(attempt.state);
              const isSigning = group === "signing";
              const isSubmission = group === "submission";
              const isDone = group === "completed";
              const expiry = getQuoteExpiry(attempt.quoteExpiresAt, now);
              const amount = splitHumanAmount(attempt.approvalSummary.humanAmount);

              return (
                <li
                  key={attempt.id}
                  className="flex flex-col gap-4 px-4 py-4 transition-colors duration-150 hover:bg-surface-2/50 sm:px-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-medium text-foreground">
                        {merchantDisplayName(attempt.approvalSummary?.merchantName ?? attempt.merchantName)}
                      </span>
                      <ToneBadge
                        size="sm"
                        tone={isDone ? "success" : "warning"}
                        icon={isDone ? CheckCircle2 : Clock}
                      >
                        {isSigning
                          ? "Stage 1 · awaiting signing approval"
                          : isSubmission
                          ? "Stage 2 · awaiting submission approval"
                          : "Dispatched to settlement"}
                      </ToneBadge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
                      <span>
                        Invoice{" "}
                        <Link
                          href={`/app/invoices/${attempt.invoiceId}`}
                          className="font-mono text-foreground-secondary underline-offset-2 hover:text-foreground hover:underline"
                        >
                          {attempt.invoiceId}
                        </Link>
                      </span>
                      <span>
                        Payee <span className="font-mono text-foreground-secondary">{formatAddress(attempt.payee)}</span>
                      </span>
                      <span>Rail {attempt.approvalSummary?.chain || "HashKey Testnet 133"}</span>
                      <span>Evidence: deterministic match</span>
                      {!isDone && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 tabular-nums",
                            expiry.urgency === "expired" ? "text-danger" : expiry.urgency === "soon" ? "text-warning" : "text-foreground-secondary"
                          )}
                        >
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">Quote expiry: </span>
                          {expiry.label}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-5 lg:justify-end">
                    <div className="text-right">
                      <div className="text-[17px] font-medium tabular-nums tracking-[-0.01em] text-foreground">
                        {amount.value || attempt.approvalSummary.humanAmount}{" "}
                        <span className="text-xs font-normal text-foreground-muted">
                          {amount.unit || attempt.approvalSummary.tokenSymbol || "USDC"}
                        </span>
                      </div>
                      <div className="font-mono text-2xs text-foreground-muted">{attempt.state}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/app/trust/${attempt.invoiceId}`} className={buttonStyles({ variant: "ghost", size: "sm" })}>
                        Inspect evidence
                      </Link>
                      <Link
                        href={`/app/approvals/${attempt.id}`}
                        className={buttonStyles({ variant: isDone ? "secondary" : "primary", size: "sm" })}
                      >
                        {isDone ? "View authorization" : "Review & authorize"}
                        <ArrowRight />
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
