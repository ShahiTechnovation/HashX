"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FileText, RefreshCw } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { Button, buttonStyles } from "@/components/ui/Button";
import { PageHeader, MetaItem } from "@/components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { DataList, DataRow } from "@/components/ui/DataList";
import { Callout } from "@/components/ui/Callout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LiveError, LiveGate, useLiveQuery } from "@/components/live/common";
import { LegacyBadge, RoleBadge, isLegacy } from "@/components/live/invoices/shared";
import { DecisionBadge, VerificationRunPanel, formatDateTime } from "./verdict";

export function LiveTrustInspector({ id }: { id: string }) {
  return (
    <LiveGate purpose="Verification records are only visible to invoice participants.">
      <InspectorInner id={id} />
    </LiveGate>
  );
}

function InspectorInner({ id }: { id: string }) {
  const { liveApi, triggerRefresh } = useApp();
  const q = useLiveQuery(async () => {
    const [invoice, summary] = await Promise.all([liveApi.getInvoice(id), liveApi.verification(id)]);
    return { invoice, summary };
  }, [liveApi, id]);
  const [busy, setBusy] = useState<"invoice" | "delivery" | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const header = (extra?: Partial<React.ComponentProps<typeof PageHeader>>) => (
    <PageHeader
      back={{ href: "/app/trust", label: "Trust" }}
      eyebrow="Trust inspector · connected mode"
      title={<span className="font-mono">{id}</span>}
      {...extra}
    />
  );

  if (q.error) {
    return (
      <div className="space-y-6">
        {header()}
        <LiveError error={q.error} title="Could not load verification record" onRetry={q.reload} />
      </div>
    );
  }
  if (!q.data) {
    return (
      <div className="space-y-6">
        {header()}
        <Panel>
          <PanelBody className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-5 rounded bg-surface-2 animate-pulse" />
            ))}
          </PanelBody>
        </Panel>
      </div>
    );
  }

  const { invoice: inv, summary } = q.data;
  const participant = inv.viewerRole === "seller" || inv.viewerRole === "buyer";
  const hasDelivery = summary.deliveryDecision !== undefined;
  const legacy = isLegacy(inv);

  async function rerun(kind: "invoice" | "delivery") {
    setBusy(kind);
    setActionError(null);
    try {
      if (kind === "invoice") await liveApi.verifyInvoice(inv.id);
      else await liveApi.verifyDelivery(inv.id);
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(null);
      q.reload();
      triggerRefresh();
    }
  }

  return (
    <div className="space-y-6">
      {header({
        badges: (
          <>
            <DecisionBadge decision={summary.overallDecision} />
            <StatusBadge status={inv.status} type="invoice" />
            <RoleBadge role={inv.viewerRole} />
            {legacy && <LegacyBadge />}
          </>
        ),
        description: "Authoritative verification summary for this invoice as persisted by the HashX backend.",
        meta: (
          <>
            <MetaItem label="Provenance">{summary.provenance}</MetaItem>
            <MetaItem label="Invoice digest"><span className="font-mono">{inv.digest.slice(0, 12)}…{inv.digest.slice(-8)}</span></MetaItem>
          </>
        ),
        actions: (
          <>
            {participant && (
              <>
                <Button size="sm" variant="secondary" onClick={() => rerun("invoice")} isLoading={busy === "invoice"} disabled={busy !== null || inv.status === "DRAFT"}>
                  <RefreshCw className="w-3.5 h-3.5" /> Re-run invoice verification
                </Button>
                <Button size="sm" variant="secondary" onClick={() => rerun("delivery")} isLoading={busy === "delivery"} disabled={busy !== null || !hasDelivery}>
                  <RefreshCw className="w-3.5 h-3.5" /> Re-run delivery verification
                </Button>
              </>
            )}
            <Link href={`/app/invoices/${inv.id}`} className={buttonStyles({ variant: "ghost", size: "sm" })}>
              <FileText className="w-3.5 h-3.5" /> Invoice
            </Link>
          </>
        ),
      })}

      <Callout tone="neutral" title="Backend-computed verdicts">
        Verdicts are computed and persisted by the HashX backend; this page never computes PASS locally. Re-running asks the backend to verify again against the signed terms and independent chain data.
      </Callout>

      {actionError !== null && <LiveError error={actionError} title="Verification request failed" />}

      <Panel>
        <PanelHeader title="Payment eligibility" description="From GET /invoices/:id/verification." />
        <PanelBody className="space-y-4">
          <DataList dense>
            <DataRow label="Overall decision"><DecisionBadge decision={summary.overallDecision} size="sm" /></DataRow>
            <DataRow label="Invoice decision"><DecisionBadge decision={summary.invoiceVerification ? summary.invoiceDecision : null} size="sm" /></DataRow>
            <DataRow label="Delivery decision"><DecisionBadge decision={summary.deliveryDecision ?? null} size="sm" emptyLabel="No delivery" /></DataRow>
            <DataRow label="Eligible for payment">
              <span className={summary.isEligibleForPayment ? "text-success" : "text-foreground-secondary"}>{summary.isEligibleForPayment ? "Yes" : "No"}</span>
            </DataRow>
            <DataRow label="Explanation">{summary.eligibilityExplanation}</DataRow>
            <DataRow label="Blocking reasons">
              {summary.blockingReasons.length === 0 ? (
                <span className="text-foreground-muted">None</span>
              ) : (
                <ul className="list-disc pl-4 space-y-1 text-xs text-foreground-secondary">
                  {summary.blockingReasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </DataRow>
          </DataList>
          {summary.overallDecision === "PENDING" && (summary.invoiceVerification?.decision === "PENDING" || summary.deliveryVerification?.decision === "PENDING") && (
            <Callout tone="warning" title="A verification run is PENDING">
              The verifier could not reach a final result — typically the chain RPC was unavailable or the requested blocks are not yet confirmed. See the reason codes in the run below and re-run later.
            </Callout>
          )}
        </PanelBody>
      </Panel>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6 items-start">
        <VerificationRunPanel
          title="Invoice verification"
          description={summary.invoiceVerification ? `Latest run · ${formatDateTime(summary.invoiceVerification.verifiedAt)}` : "Signature, terms and nonce checks."}
          run={summary.invoiceVerification}
          emptyText={inv.status === "DRAFT" ? "The invoice is a draft; it must be signed before it can be verified." : "No invoice verification has been run yet."}
        />
        <VerificationRunPanel
          title="Delivery verification"
          description={summary.deliveryVerification ? `Latest run · ${formatDateTime(summary.deliveryVerification.verifiedAt)}` : "Independent recomputation of the delivered artifact."}
          run={summary.deliveryVerification}
          emptyText={hasDelivery ? "A delivery exists but has not been verified yet." : "No delivery has been submitted for this invoice."}
        />
      </div>
    </div>
  );
}
