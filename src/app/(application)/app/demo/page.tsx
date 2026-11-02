"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { demoClient } from "@/lib/api/client";
import { FIXTURE_INVOICE_REPLAY } from "@/mocks/fixtures";
import { cn } from "@/lib/utils";
import { buttonStyles } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { DataList, DataRow } from "@/components/ui/DataList";
import { Callout } from "@/components/ui/Callout";
import { Timeline } from "@/components/ui/Timeline";
import { toneStyles } from "@/components/ui/StatusBadge";
import { SimulatedBadge } from "@/components/live/common";
import { ReasonCodeChip } from "@/components/trust/reasonCodes";
import { SCENARIOS, ProofMatrix, type Scenario, type ScenarioId } from "@/components/demo/scenarios";
import {
  CountCompare,
  GoldenSettlement,
  PayeeDiff,
  ReplaySimulator,
  type ReplayCall,
} from "@/components/demo/ScenarioEvidence";

export default function DemoCenterPage() {
  const { mode } = useApp();
  const [activeTab, setActiveTab] = useState<ScenarioId>("A");

  // State for Scenario C interactive test
  const [duplicateAttemptsTriggered, setDuplicateAttemptsTriggered] = useState(1);
  const [duplicateResult, setDuplicateResult] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [replayCalls, setReplayCalls] = useState<ReplayCall[]>([]);
  const [isReplaying, setIsReplaying] = useState(false);

  const handleTestDuplicatePayment = async () => {
    setIsReplaying(true);
    setDuplicateError(null);
    try {
      const attempt = await demoClient.requestPayment({
        invoice_id: FIXTURE_INVOICE_REPLAY.id,
        payer: "0x1234567890123456789012345678901234567890",
      });
      const n = duplicateAttemptsTriggered + 1;
      setDuplicateAttemptsTriggered(n);
      setReplayCalls((calls) => [...calls, { n, attemptId: attempt.id, flowId: attempt.flowId }]);
      setDuplicateResult(
        `Simulated: returned existing payment attempt ${attempt.id} (flow ${attempt.flowId}). No duplicate attempt was created.`
      );
    } catch (err: unknown) {
      console.error(err);
      setDuplicateError(err instanceof Error ? err.message : "request_payment failed.");
    } finally {
      setIsReplaying(false);
    }
  };

  const handleResetReplay = () => {
    setDuplicateAttemptsTriggered(1);
    setReplayCalls([]);
    setDuplicateResult(null);
    setDuplicateError(null);
  };

  const scenario = SCENARIOS.find((s) => s.id === activeTab) ?? SCENARIOS[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Proof Lab"
        title="Adversarial scenarios"
        badges={<SimulatedBadge label="Simulation only" />}
        description="Walk through the checks HashX runs against payee tampering, fabricated fulfillment and duplicate payment requests. Everything runs in your browser."
      />

      <Callout tone="warning" title="Simulated scenarios — no real transactions, hashes are illustrative.">
        Every invoice, signature, transaction hash, amount, and settlement state on this page is a local fixture. Nothing is sent to a
        backend or a blockchain.
      </Callout>

      <ScenarioTabs active={activeTab} onSelect={setActiveTab} />

      <div
        role="tabpanel"
        id={`scenario-panel-${scenario.id}`}
        aria-labelledby={`scenario-tab-${scenario.id}`}
        className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12"
      >
        <div key={scenario.id} className="min-w-0 animate-crossfade space-y-6 lg:col-span-7">
          <Panel>
            <PanelHeader
              title={scenario.title}
              description={scenario.kind}
              actions={<OutcomeBadge scenario={scenario} />}
            />
            <PanelBody className="space-y-6">
              <p className="max-w-2xl text-[15px] leading-relaxed text-foreground-secondary">{scenario.lead}</p>
              <div>
                {scenario.id === "A" && <PayeeDiff />}
                {scenario.id === "B" && <CountCompare />}
                {scenario.id === "C" && (
                  <ReplaySimulator
                    calls={replayCalls}
                    nextCallNumber={duplicateAttemptsTriggered + 1}
                    result={duplicateResult}
                    error={duplicateError}
                    isCalling={isReplaying}
                    onCall={handleTestDuplicatePayment}
                    onReset={handleResetReplay}
                  />
                )}
                {scenario.id === "D" && <GoldenSettlement />}
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Sequence" description="What happens, step by step (simulated)." />
            <PanelBody>
              <Timeline items={scenario.steps} />
            </PanelBody>
          </Panel>
        </div>

        <aside key={`${scenario.id}-aside`} className="min-w-0 animate-crossfade space-y-6 lg:col-span-5">
          <Panel>
            <PanelHeader title="Attack and control" />
            <PanelBody className="space-y-5">
              <DataList>
                <DataRow label={scenario.claimLabel} stacked>
                  {scenario.claim}
                </DataRow>
                <DataRow label="HashX control" stacked>
                  <span className="font-medium text-foreground">{scenario.control.name}</span>
                  <span className="mt-1 block text-[13px] leading-relaxed text-foreground-secondary">
                    {scenario.control.detail}
                  </span>
                </DataRow>
                <DataRow label="Expected verdict" stacked>
                  {scenario.expected.code && <ReasonCodeChip code={scenario.expected.code} size="md" className="mb-1.5" />}
                  <span className="block text-[13px] leading-relaxed text-foreground-secondary">{scenario.expected.text}</span>
                </DataRow>
              </DataList>

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Link href={scenario.primary.href} className={buttonStyles({ variant: "primary", size: "sm" })}>
                  {scenario.primary.label}
                  <ArrowRight />
                </Link>
                {scenario.secondary.map((link) => (
                  <Link key={link.href} href={link.href} className={buttonStyles({ variant: "ghost", size: "sm" })}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Which control decides" description="Every scenario is stopped — or passes — at a specific gate." />
            <PanelBody>
              <ProofMatrix active={activeTab} onSelect={setActiveTab} />
            </PanelBody>
          </Panel>
        </aside>
      </div>

      {/* Real golden path entry */}
      <Panel>
        <div className="flex flex-col gap-4 px-4 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-medium tracking-[-0.01em] text-foreground">Run the real Sepolia golden path</h2>
              <span
                className={cn(
                  "inline-flex h-5 items-center rounded px-1.5 text-2xs font-medium ring-1 ring-inset",
                  mode === "connected" ? toneStyles.success.badge : toneStyles.neutral.badge
                )}
              >
                {mode === "connected" ? "Connected mode" : "Requires connected mode"}
              </span>
            </div>
            <p className="max-w-3xl text-[13px] leading-relaxed text-foreground-secondary">
              Create, sign, verify, deliver, approve, and settle a real invoice against the HashX backend on Ethereum Sepolia (testnet). You
              need: connected mode with a running backend, two browser wallets (seller and buyer), Sepolia ETH for gas, and Circle test USDC
              in the buyer wallet (faucet:{" "}
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-primary-light hover:underline"
              >
                faucet.circle.com
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </a>
              ). Test tokens have no monetary value.
            </p>
          </div>
          <Link
            href="/app/invoices/new"
            className={cn(buttonStyles({ variant: "secondary" }), "shrink-0 self-start lg:self-auto")}
          >
            Create a real invoice
            <ArrowRight />
          </Link>
        </div>
      </Panel>
    </div>
  );
}

const OutcomeBadge: React.FC<{ scenario: Scenario }> = ({ scenario }) => {
  const { tone, label, Icon } = scenario.outcome;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded px-2 text-xs font-medium ring-1 ring-inset",
        toneStyles[tone].badge
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
      {label}
      {scenario.id === "D" && <span className="font-normal opacity-80">(simulated)</span>}
    </span>
  );
};

/** Scenario selector: an accessible tablist with arrow-key navigation. */
const ScenarioTabs: React.FC<{ active: ScenarioId; onSelect: (id: ScenarioId) => void }> = ({ active, onSelect }) => {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = SCENARIOS.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = index === last ? 0 : index + 1;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = index === 0 ? last : index - 1;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    onSelect(SCENARIOS[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label="Scenarios" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {SCENARIOS.map((s, i) => {
        const selected = s.id === active;
        return (
          <button
            key={s.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`scenario-tab-${s.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`scenario-panel-${s.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(s.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "group flex flex-col rounded-lg border bg-surface-1 p-4 text-left transition-[border-color,box-shadow] duration-200",
              selected
                ? "border-primary/60 shadow-[0_0_0_1px_rgb(var(--primary)/0.6)]"
                : "border-border hover:border-border-strong"
            )}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-xs text-foreground-muted">
                {s.group} · {s.kind}
              </span>
              <span className={cn("inline-flex items-center gap-1 text-xs font-medium", toneStyles[s.outcome.tone].text)}>
                <s.outcome.Icon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                {s.outcome.label}
              </span>
            </span>
            <span className="mt-2 text-[15px] font-medium tracking-[-0.01em] text-foreground">{s.title}</span>
            <span className="mt-1 text-[13px] leading-relaxed text-foreground-secondary">{s.summary}</span>
          </button>
        );
      })}
    </div>
  );
};
