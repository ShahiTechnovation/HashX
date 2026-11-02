"use client";

import React from "react";
import { Check, X, RefreshCw, RotateCcw, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { DataList, DataRow } from "@/components/ui/DataList";
import { FinalityTrack } from "@/components/ui/FinalityTrack";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatTimestamp } from "@/lib/formatters";
import { FIXTURE_INVOICE_REPLAY, FIXTURE_PAYMENT_ATTEMPT_EXISTING, FIXTURE_RECEIPT_GOLDEN } from "@/mocks/fixtures";
import { CLAIMED_TX, RECOMPUTED_TX, FAKE_ARTIFACT, FAKE_INVOICE, GOLDEN_ATTEMPT, TAMPERED_INVOICE } from "./scenarios";

const EvidenceLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-2.5 text-xs font-medium text-foreground-muted">{children}</div>
);

/* Scenario A — signed payee vs presented payee */
export const PayeeDiff: React.FC = () => (
  <div>
    <EvidenceLabel>Evidence · payee field</EvidenceLabel>
    <div className="rounded-md border border-border overflow-hidden divide-y divide-border">
      <div className="grid grid-cols-1 sm:grid-cols-[150px_minmax(0,1fr)_auto] gap-x-4 gap-y-1 items-center px-3.5 py-3 bg-background/50">
        <div>
          <div className="text-xs text-foreground-secondary">Signed payee</div>
          <div className="text-2xs text-foreground-muted">Committed in the digest</div>
        </div>
        <CopyableValue value={TAMPERED_INVOICE.sellerWallet} className="max-w-full" />
        <span className="inline-flex items-center gap-1 text-2xs font-medium text-success whitespace-nowrap">
          <Check className="w-3 h-3" strokeWidth={2.5} aria-hidden="true" /> Seller-authorized
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[150px_minmax(0,1fr)_auto] gap-x-4 gap-y-1 items-center px-3.5 py-3 bg-danger/[0.05]">
        <div>
          <div className="text-xs text-danger">Presented payee</div>
          <div className="text-2xs text-foreground-muted">What the buyer received</div>
        </div>
        <CopyableValue
          value={TAMPERED_INVOICE.payment.payee}
          className="max-w-full [&>span:first-child]:text-danger"
        />
        <span className="inline-flex items-center gap-1 text-2xs font-medium text-danger whitespace-nowrap">
          <X className="w-3 h-3" strokeWidth={2.5} aria-hidden="true" /> Substituted
        </span>
      </div>
    </div>
  </div>
);

/* Scenario B — claimed vs recomputed transaction count */
export const CountCompare: React.FC = () => {
  const delta = CLAIMED_TX - RECOMPUTED_TX;
  return (
    <div>
      <EvidenceLabel>Evidence · transaction_count</EvidenceLabel>
      <div className="rounded-md border border-border overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="px-4 py-3.5 bg-background/50">
            <div className="text-xs text-foreground-secondary">Seller claim</div>
            <div className="mt-1.5 text-[32px] leading-none font-medium tracking-[-0.035em] tabular-nums text-foreground">
              {CLAIMED_TX}
            </div>
            <div className="mt-2 text-2xs text-foreground-muted">
              Signed artifact · <span className="font-mono">{FAKE_ARTIFACT.schema}</span>
            </div>
          </div>
          <div className="px-4 py-3.5 bg-danger/[0.05]">
            <div className="text-xs text-danger">RPC recomputation</div>
            <div className="mt-1.5 text-[32px] leading-none font-medium tracking-[-0.035em] tabular-nums text-danger">
              {RECOMPUTED_TX}
            </div>
            <div className="mt-2 text-2xs text-foreground-muted tabular-nums">
              Chain {FAKE_INVOICE.payment.preferred_chain_id} · blocks {FAKE_ARTIFACT.start_block.toLocaleString("en-US")}–
              {FAKE_ARTIFACT.end_block.toLocaleString("en-US")}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-border text-xs">
          <span className="inline-flex items-center gap-1.5 text-danger">
            <X className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden="true" />
            <span className="tabular-nums">{delta}</span> transactions with no on-chain record
          </span>
          <span className="font-mono text-2xs text-foreground-muted">{formatShort(FAKE_ARTIFACT.address)}</span>
        </div>
      </div>
    </div>
  );
};

function formatShort(addr: string) {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

/* Scenario C — interactive idempotency simulator */
export interface ReplayCall {
  n: number;
  attemptId: string;
  flowId: string;
}

interface ReplaySimulatorProps {
  calls: ReplayCall[];
  nextCallNumber: number;
  result: string | null;
  error: string | null;
  isCalling: boolean;
  onCall: () => void;
  onReset: () => void;
}

export const ReplaySimulator: React.FC<ReplaySimulatorProps> = ({
  calls,
  nextCallNumber,
  result,
  error,
  isCalling,
  onCall,
  onReset,
}) => {
  const distinctAttempts = new Set([FIXTURE_PAYMENT_ATTEMPT_EXISTING.id, ...calls.map((c) => c.attemptId)]).size;
  return (
    <div className="space-y-4">
      <div>
        <EvidenceLabel>Simulated state</EvidenceLabel>
        <DataList dense>
          <DataRow label="Target invoice">
            <CopyableValue value={FIXTURE_INVOICE_REPLAY.id} />
          </DataRow>
          <DataRow label="Active attempt">
            <span className="inline-flex items-center gap-2 min-w-0">
              <CopyableValue value={FIXTURE_PAYMENT_ATTEMPT_EXISTING.id} />
              <StatusBadge status={FIXTURE_PAYMENT_ATTEMPT_EXISTING.hspStatus} type="hsp" size="sm" />
            </span>
          </DataRow>
          <DataRow label="Simulated flow">
            <CopyableValue value={FIXTURE_PAYMENT_ATTEMPT_EXISTING.flowId} />
          </DataRow>
        </DataList>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 py-3 bg-surface-2/40 border-b border-border">
          <div>
            <div className="text-[13px] font-medium text-foreground">Try it</div>
            <div className="text-2xs text-foreground-muted">Send request_payment again for the same invoice.</div>
          </div>
          <div className="flex items-center gap-1.5">
            {calls.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onReset}>
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onCall} isLoading={isCalling}>
              {!isCalling && <RefreshCw className="w-3.5 h-3.5" />}
              Replay request · call <span className="tabular-nums">#{nextCallNumber}</span>
            </Button>
          </div>
        </div>

        <ol className="surface-ink font-mono text-xs divide-y divide-border/70">
          <li className="flex items-center gap-3 px-3.5 py-2">
            <span className="w-6 text-foreground-muted tabular-nums">#1</span>
            <span className="text-foreground-secondary">request_payment</span>
            <CornerDownRight className="w-3 h-3 text-foreground-muted" aria-hidden="true" />
            <span className="text-foreground/90 truncate">{FIXTURE_PAYMENT_ATTEMPT_EXISTING.id}</span>
            <span className="ml-auto font-sans text-foreground-muted">created</span>
          </li>
          {calls.map((c) => (
            <li key={c.n} className="flex items-center gap-3 px-3.5 py-2 animate-fade-in">
              <span className="w-6 text-foreground-muted tabular-nums">#{c.n}</span>
              <span className="text-foreground-secondary">request_payment</span>
              <CornerDownRight className="w-3 h-3 text-foreground-muted" aria-hidden="true" />
              <span className="text-foreground/90 truncate">{c.attemptId}</span>
              <span
                className={cn(
                  "ml-auto inline-flex items-center gap-1 font-sans whitespace-nowrap",
                  c.attemptId === FIXTURE_PAYMENT_ATTEMPT_EXISTING.id ? "text-warning" : "text-danger"
                )}
              >
                {c.attemptId === FIXTURE_PAYMENT_ATTEMPT_EXISTING.id ? "returned existing" : "new attempt"}
              </span>
            </li>
          ))}
        </ol>

        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-t border-border text-xs">
          <span className="text-foreground-muted">
            Requests sent <span className="tabular-nums text-foreground-secondary">{calls.length + 1}</span>
          </span>
          <span className={cn("inline-flex items-center gap-1.5", distinctAttempts === 1 ? "text-success" : "text-danger")}>
            {distinctAttempts === 1 ? (
              <Check className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <X className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden="true" />
            )}
            Payment attempts created <span className="tabular-nums">{distinctAttempts}</span>
          </span>
        </div>
      </div>

      {result && <p className="text-xs text-foreground-secondary leading-relaxed animate-fade-in">{result}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
};

/* Scenario D — settlement outcome */
export const GoldenSettlement: React.FC = () => (
  <div className="space-y-4">
    <div>
      <EvidenceLabel>Settlement finality (simulated)</EvidenceLabel>
      <div className="rounded-md border border-border px-4 pt-4 pb-3.5 bg-background/50">
        <FinalityTrack status={GOLDEN_ATTEMPT.hspStatus} />
      </div>
    </div>
    <DataList dense>
      <DataRow label="Amount">
        <span className="tabular-nums">{GOLDEN_ATTEMPT.approvalSummary.humanAmount}</span>
        <span className="ml-2 font-mono text-2xs text-foreground-muted">raw {GOLDEN_ATTEMPT.tokenTotalRaw}</span>
      </DataRow>
      {GOLDEN_ATTEMPT.txHash && (
        <DataRow label="Settlement tx" hint="Illustrative hash — not on-chain">
          <CopyableValue value={GOLDEN_ATTEMPT.txHash} className="max-w-full" />
        </DataRow>
      )}
      <DataRow label="Evidence anchor" hint="Illustrative — registry not deployed">
        <CopyableValue value={FIXTURE_RECEIPT_GOLDEN.evidenceRegistryTx} className="max-w-full" />
      </DataRow>
      <DataRow label="Finalized (simulated)">
        <span className="text-xs tabular-nums">{formatTimestamp(FIXTURE_RECEIPT_GOLDEN.payment.finalizedAt)}</span>
      </DataRow>
    </DataList>
  </div>
);
