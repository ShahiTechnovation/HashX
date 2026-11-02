"use client";

/**
 * Connected-mode receipt view. Renders the persisted hashx.receipt.v2 document verbatim
 * and explains how to verify it independently of HashX.
 */
import React from "react";
import Link from "next/link";
import { Download, Fingerprint, Printer, ScrollText, Terminal } from "lucide-react";
import type { ReceiptBody } from "@shared/protocol";
import { findNetwork, formatTokenAmount } from "@shared/networks";
import { useApp } from "@/providers/AppContext";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { DataList, DataRow } from "@/components/ui/DataList";
import { toneStyles } from "@/components/ui/StatusBadge";
import { LogoMark } from "@/components/brand/Logo";
import { DocSection, ReceiptPaper } from "@/components/receipts/ReceiptDocument";
import { cn } from "@/lib/utils";
import { PageHeader, MetaItem } from "@/components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { LiveError, LiveGate, TestnetBadge, TxLink, useLiveQuery } from "@/components/live/common";
import { AddressValue, Digest, fmtTime } from "@/components/live/payments/shared";

type ReceiptDoc = Partial<ReceiptBody> & { receiptDigest?: string };

const VERIFIER_CHECKS = [
  "Receipt digest equals keccak256 of the canonical receipt body",
  "Invoice digest recomputes from the embedded terms; the seller signature recovers to the seller",
  "Delivery manifest digest recomputes; the manifest signature recovers to the seller and binds the invoice digest and artifact SHA-256",
  "Authorization digest recomputes; the payer signature recovers to the payer and binds invoice + delivery digests, payee, token, amount and chain",
  "The recorded settlement (from, to, token, amount, chain) matches the signed authorization",
  "On-chain via your RPC: chain ID matches, the transaction succeeded, the referenced log is a Transfer from the token contract with exactly (payer → payee, amount), and its block is canonical",
];

export function LiveReceiptDetail({ id }: { id: string }) {
  return (
    <LiveGate purpose="Receipts are visible to the payer and payee only.">
      <ReceiptDetailInner id={id} />
    </LiveGate>
  );
}

function ReceiptDetailInner({ id }: { id: string }) {
  const { liveApi } = useApp();
  const q = useLiveQuery(() => liveApi.getReceipt(id), [id, liveApi]);

  if (q.loading && !q.data) return <div aria-busy="true" className="mx-auto h-[560px] max-w-4xl rounded-lg border border-border bg-surface-1" />;
  if (q.error && !q.data) return <LiveError error={q.error} title="Could not load receipt" onRetry={q.reload} />;
  const r = q.data;
  if (!r) return null;

  const doc: ReceiptDoc = (r.document ?? {}) as ReceiptDoc;
  const s = doc.settlement;
  const chainId = s?.chainId ?? doc.network?.chainId ?? r.chainId;
  const net = findNetwork(chainId);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(r.document, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const verifyCmd = `pnpm --prefix server verify-receipt ${r.id}.json --rpc <your Sepolia RPC URL>`;

  return (
    <div className="space-y-6">
      <PageHeader
        className="no-print"
        back={{ href: "/app/receipts", label: "Receipts" }}
        eyebrow={r.legacy ? "Legacy v1 receipt" : `Receipt · ${doc.schema ?? `version ${r.receiptVersion}`}`}
        title={<span className="font-mono text-[22px] sm:text-2xl tracking-[-0.02em]">{r.id}</span>}
        badges={<TestnetBadge chainId={chainId} />}
        meta={
          <>
            <MetaItem label="Issued">{fmtTime(r.issuedAt)}</MetaItem>
            <MetaItem label="Invoice">
              <Link href={`/app/invoices/${r.invoiceId}`} className="font-mono hover:text-foreground hover:underline">
                {r.invoiceId}
              </Link>
            </MetaItem>
            {r.paymentAttemptId && (
              <MetaItem label="Settlement">
                <Link href={`/app/settlements/${r.paymentAttemptId}`} className="font-mono hover:text-foreground hover:underline">
                  {r.paymentAttemptId}
                </Link>
              </MetaItem>
            )}
          </>
        }
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            <Button size="sm" onClick={exportJson}>
              <Download className="h-3.5 w-3.5" />
              Export receipt JSON
            </Button>
          </>
        }
      />

      {r.revokedAt && (
        <Callout tone="danger" title={`Receipt revoked ${fmtTime(r.revokedAt)}`}>
          {r.revocationReason ?? "No revocation reason was recorded."} Do not rely on this receipt.
        </Callout>
      )}

      {r.legacy && (
        <Callout tone="warning" title="Legacy v1 receipt — not backed by a verified transfer">
          This receipt predates independent on-chain settlement verification. It cannot be checked with the receipt verifier.
        </Callout>
      )}

      <ReceiptPaper label={`Receipt ${r.id}`}>
        <header className="flex flex-col gap-6 px-6 pb-7 pt-8 sm:flex-row sm:items-start sm:justify-between sm:px-10 sm:pt-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <LogoMark size={22} decorative />
              <span className="text-[15px] font-semibold tracking-[-0.03em] text-foreground">HashX</span>
            </div>
            <h1 className="mt-6 text-[26px] font-medium leading-tight tracking-[-0.03em] text-foreground sm:text-[30px]">
              Verifiable settlement receipt
            </h1>
            <p className="mt-2 font-mono text-xs text-foreground-muted">{doc.schema ?? `receipt version ${r.receiptVersion}`}</p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
            <span className="text-xs text-foreground-muted">Issued</span>
            <span className="text-[13px] tabular-nums text-foreground">{fmtTime(r.issuedAt)}</span>
            {r.revokedAt ? (
              <span className={cn("mt-2 text-[13px] font-medium", toneStyles.danger.text)}>Revoked</span>
            ) : r.legacy ? (
              <span className={cn("mt-2 text-[13px] font-medium", toneStyles.warning.text)}>Legacy · not verified</span>
            ) : (
              <span className={cn("mt-2 text-[13px] font-medium", toneStyles.success.text)}>Issued · verified transfer</span>
            )}
          </div>
        </header>

        <div className="border-t border-border px-6 py-6 sm:px-10">
          <div className="flex items-center gap-2 text-xs text-foreground-muted">
            <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" />
            Receipt digest
          </div>
          <div className="mt-2">
            <Digest value={doc.receiptDigest ?? r.receiptDigest} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
            keccak256 of the canonical receipt body. Any change to any field changes this value.
          </p>
        </div>

        <DocSection index={1} title="Invoice" description="Signed commercial intent.">
          <DataList>
            <DataRow label="Invoice ID" mono>{doc.invoice?.id ?? r.invoiceId}</DataRow>
            <DataRow label="Invoice digest" mono>
              <Digest value={doc.invoice?.digest ?? r.invoiceDigest} />
            </DataRow>
            <DataRow label="Seller signature" mono>
              <Digest value={doc.invoice?.sellerSignature} />
            </DataRow>
            <DataRow label="Seller">
              <AddressValue address={r.seller} chainId={chainId} />
            </DataRow>
          </DataList>
        </DocSection>

        <DocSection index={2} title="Delivery" description="Evidence verified before payment became eligible.">
          <DataList>
            <DataRow label="Delivery ID" mono>{doc.delivery?.id ?? "—"}</DataRow>
            <DataRow label="Version" mono>{doc.delivery?.version ?? "—"}</DataRow>
            <DataRow label="Evidence digest" mono>
              <Digest value={doc.delivery?.evidenceDigest ?? r.deliveryEvidenceDigest} />
            </DataRow>
            <DataRow label="Artifact SHA-256" mono>
              <Digest value={doc.delivery?.artifactSha256} />
            </DataRow>
            <DataRow label="Manifest signature" mono>
              <Digest value={doc.delivery?.manifestSignature} />
            </DataRow>
            <DataRow label="Verification run" mono>{doc.delivery?.verificationRunId ?? "—"}</DataRow>
          </DataList>
        </DocSection>

        <DocSection index={3} title="Human authorization" description="Stage 1 terms approval and the payer's EIP-712 signature.">
          <DataList>
            <DataRow label="Attempt" mono>{doc.authorization?.attemptId ?? r.paymentAttemptId ?? "—"}</DataRow>
            <DataRow label="Authorization digest" mono>
              <Digest value={doc.authorization?.digest} />
            </DataRow>
            <DataRow label="Payer signature" mono>
              <Digest value={doc.authorization?.payerSignature} />
            </DataRow>
            <DataRow label="Stage 1 approved">{fmtTime(doc.authorization?.stage1ApprovedAt)}</DataRow>
            <DataRow label="Stage 2 authorized">{fmtTime(doc.authorization?.stage2AuthorizedAt)}</DataRow>
          </DataList>
        </DocSection>

        <DocSection index={4} title="Settlement" description="The verified on-chain ERC-20 Transfer.">
          {s ? (
            <DataList>
              <DataRow label="Rail" mono>{s.rail}</DataRow>
              <DataRow label="Network">
                <span className="inline-flex flex-wrap items-center gap-2">
                  {doc.network?.name ?? net?.name ?? "—"}
                  <span className="font-mono text-xs text-foreground-muted">chainId {s.chainId}</span>
                </span>
              </DataRow>
              <DataRow label="Token" hint={`${s.isTestToken ? "Test " : ""}${s.tokenSymbol}${s.isTestToken ? " · test token, no monetary value" : ""}`}>
                <AddressValue address={s.token} chainId={s.chainId} />
              </DataRow>
              <DataRow label="Transaction">
                <TxLink chainId={s.chainId} hash={s.txHash} />
              </DataRow>
              <DataRow label="Block number" mono>{s.blockNumber}</DataRow>
              <DataRow label="Block hash" mono>
                <Digest value={s.blockHash} />
              </DataRow>
              <DataRow label="Log index" mono>{s.logIndex}</DataRow>
              <DataRow label="From (payer)">
                <AddressValue address={s.from} chainId={s.chainId} />
              </DataRow>
              <DataRow label="To (payee)">
                <AddressValue address={s.to} chainId={s.chainId} />
              </DataRow>
              <DataRow label="Amount">
                <span className="flex flex-col">
                  <span className="text-[15px] font-medium tabular-nums">
                    {formatTokenAmount(s.amount, s.tokenDecimals ?? 6)} {s.isTestToken ? "Test " : ""}
                    {s.tokenSymbol}
                  </span>
                  <span className="font-mono text-xs text-foreground-muted">{s.amount} raw units</span>
                </span>
              </DataRow>
              <DataRow label="Confirmations at issuance" mono>{s.confirmationsAtIssuance}</DataRow>
              <DataRow label="Finality policy" mono>{s.finalityPolicy}</DataRow>
            </DataList>
          ) : (
            <p className="text-[13px] text-foreground-muted">This receipt document contains no verified settlement section.</p>
          )}
        </DocSection>
      </ReceiptPaper>

      {!r.legacy && (
        <Panel className="no-print mx-auto max-w-4xl">
          <PanelHeader
            icon={<Terminal />}
            title="Verify independently"
            description="The verifier needs only the exported JSON and an RPC endpoint you choose — no HashX backend or database."
          />
          <PanelBody className="space-y-5">
            <ol className="list-decimal space-y-1.5 pl-5 text-[13px] text-foreground-secondary">
              <li>
                Click “Export receipt JSON” to download <span className="font-mono text-xs">{r.id}.json</span>.
              </li>
              <li>From a checkout of the HashX repository, run:</li>
            </ol>
            <div className="surface-ink rounded-md border border-border px-3.5 py-2.5">
              <CopyableValue value={verifyCmd} displayText={verifyCmd} className="max-w-full" />
            </div>
            <div>
              <div className="mb-2 text-[13px] font-medium text-foreground">What it checks</div>
              <ul className="space-y-1.5 text-[13px] text-foreground-secondary">
                {VERIFIER_CHECKS.map((c) => (
                  <li key={c} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-foreground-muted" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-foreground-muted">
                Exit code 0 only if every check passes. Without --rpc the on-chain checks are reported as not performed.
              </p>
            </div>
          </PanelBody>
        </Panel>
      )}

      <Panel className="no-print mx-auto max-w-4xl">
        <PanelHeader icon={<ScrollText />} title="Raw receipt document" />
        <PanelBody>
          <CodeViewer title={`${r.id}.json`} data={r.document} />
        </PanelBody>
      </Panel>
    </div>
  );
}
