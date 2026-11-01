"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Search,
  Filter,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient, connectedClient } from "@/lib/api/client";
import { PaymentAttempt } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { formatAddress, formatTimestamp, formatExpiryCountdown } from "@/lib/formatters";

export default function ApprovalsQueuePage() {
  const { mode, refreshKey } = useApp();
  const [paymentAttempts, setPaymentAttempts] = useState<PaymentAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStage, setFilterStage] = useState("ALL");

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

  const filteredAttempts = paymentAttempts.filter((p) => {
    if (filterStage === "PENDING") {
      return (
        p.state === "AWAITING_SIGNATURE_APPROVAL" ||
        p.state === "AWAITING_SUBMISSION_APPROVAL"
      );
    }
    if (filterStage === "COMPLETED") {
      return p.state === "SUBMITTED" || p.state === "PROCESSING" || p.state === "FINALIZED";
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <CheckCircle className="w-6 h-6 text-warning" />
            <span>Human Financial Authorization Queue</span>
          </h1>
          <p className="text-xs text-foreground-secondary mt-1">
            Mandatory two-stage human review: exact raw amount confirmation before wallet signing and before payment submission.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {[
          { id: "ALL", label: `All Authorization Records (${paymentAttempts.length})` },
          {
            id: "PENDING",
            label: `Requires Approval (${
              paymentAttempts.filter(
                (p) =>
                  p.state === "AWAITING_SIGNATURE_APPROVAL" ||
                  p.state === "AWAITING_SUBMISSION_APPROVAL"
              ).length
            })`,
          },
          { id: "COMPLETED", label: "Signed & Submitted" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterStage(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              filterStage === tab.id
                ? "bg-primary text-white font-medium"
                : "text-foreground-secondary hover:text-foreground hover:bg-surface-2"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Queue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredAttempts.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-foreground-muted text-xs">
            No payment authorization records in this queue view.
          </div>
        ) : (
          filteredAttempts.map((attempt) => {
            const isPendingSignature = attempt.state === "AWAITING_SIGNATURE_APPROVAL";
            const isPendingSubmission = attempt.state === "AWAITING_SUBMISSION_APPROVAL";
            const isActionRequired = isPendingSignature || isPendingSubmission;
            const expiryInfo = formatExpiryCountdown(attempt.quoteExpiresAt);

            return (
              <div
                key={attempt.id}
                className={`p-5 rounded-xl border transition-all bg-surface-1 flex flex-col justify-between ${
                  isActionRequired
                    ? "border-warning/50 shadow-[0_0_20px_rgba(230,175,88,0.08)]"
                    : "border-border"
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-mono font-bold text-foreground">
                        {attempt.id}
                      </span>
                      <span className="text-[11px] font-mono text-foreground-muted block">
                        Invoice: {attempt.invoiceId}
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                          isActionRequired
                            ? "bg-warning/20 text-warning border border-warning/40"
                            : "bg-surface-3 text-foreground-secondary border border-border"
                        }`}
                      >
                        {attempt.state.replace(/_/g, " ")}
                      </span>

                      {isActionRequired && (
                        <span
                          className={`text-[10px] font-mono ${
                            expiryInfo.isExpired ? "text-danger" : "text-foreground-muted"
                          }`}
                        >
                          {expiryInfo.text}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-surface-2 border border-border/80 text-xs space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-foreground-muted">Payment Amount:</span>
                      <div className="text-right">
                        <span className="text-sm font-mono font-bold text-foreground">
                          {attempt.approvalSummary.humanAmount}
                        </span>
                        <span className="text-[11px] font-mono text-foreground-muted block">
                          Raw: {attempt.tokenTotalRaw} units
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between text-foreground-secondary font-mono text-[11px]">
                      <span>Merchant:</span>
                      <span className="text-foreground">{attempt.merchantName} (Attribution Verified)</span>
                    </div>

                    <div className="flex justify-between text-foreground-secondary font-mono text-[11px]">
                      <span>Payee Address:</span>
                      <CopyableValue value={attempt.payee} displayText={formatAddress(attempt.payee)} />
                    </div>

                    <div className="flex justify-between text-foreground-secondary font-mono text-[11px]">
                      <span>Payer Wallet:</span>
                      <CopyableValue value={attempt.payer} displayText={formatAddress(attempt.payer)} />
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] font-mono text-foreground-muted">
                    HSP Status: {attempt.hspStatus}
                  </span>
                  <Link href={`/app/approvals/${attempt.id}`}>
                    <Button
                      variant={isActionRequired ? "primary" : "secondary"}
                      size="sm"
                      className="gap-1.5 text-xs"
                    >
                      <span>{isActionRequired ? "Review & Authorize" : "View Details"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
