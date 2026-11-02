"use client";

import React from "react";
import { ShieldCheck, Wallet } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { toneStyles, type Tone } from "@/components/ui/StatusBadge";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { HASHX_EIP712_DOMAIN } from "@/lib/crypto/eip712";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/live/api";
import { SimulatedBadge } from "@/components/live/common";
import { LiveSettings } from "@/components/live/settings/LiveSettings";
import { PUBLIC_NETWORKS, SEPOLIA_CHAIN_ID, railLabel } from "@shared/networks";

export default function SettingsPage() {
  const { mode } = useApp();
  return mode === "connected" ? <LiveSettings /> : <DemoSettingsPage />;
}

/** Demo mode settings: everything here describes the simulated, in-browser environment. */
function DemoSettingsPage() {
  const { mode, setMode, walletAddress, walletType, isWalletConnected, connectWallet, disconnectWallet } = useApp();

  return (
    <div className="max-w-5xl space-y-10">
      <PageHeader
        className="pb-0"
        eyebrow="Settings"
        title="Workspace settings"
        badges={<SimulatedBadge label="Demo · simulated" />}
        description="You are in demo mode. Data is simulated in the browser; no backend, wallet signature, or chain is involved. Switch to connected mode to see real backend readiness, networks, and agent credentials."
      />

      {/* Environment */}
      <SettingsSection title="Operating mode" description="Simulated walkthrough or the real HashX backend.">
        <SettingsRow
          label="Execution mode"
          description={
            mode === "demo"
              ? "Demo: simulated in-browser fixtures. Signatures, verification results, transaction hashes, and settlement states are illustrative — nothing touches a real chain."
              : "Connected: the real HashX backend with SIWE wallet sessions and direct Test USDC settlement on Ethereum Sepolia (testnet)."
          }
        >
          <div role="radiogroup" aria-label="Execution mode" className="inline-flex items-center gap-0.5 rounded-md bg-surface-2 p-0.5 ring-1 ring-inset ring-border">
            {(["demo", "connected"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "h-8 rounded-[6px] px-3 text-[13px] capitalize transition-colors",
                  mode === m
                    ? "bg-surface-1 font-medium text-foreground shadow-[0_0_0_1px_rgb(var(--border)),0_1px_2px_rgb(25_24_29/0.06)]"
                    : "text-foreground-muted hover:text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </SettingsRow>

        <SettingsRow
          label="Backend endpoint"
          description="HashX API endpoint used in connected mode (unused in demo). Set via NEXT_PUBLIC_HASHX_API_URL."
        >
          <div className="min-w-0">
            <CopyableValue value={API_URL} label="Copy backend endpoint" />
          </div>
        </SettingsRow>
      </SettingsSection>

      {/* Networks (configuration only) */}
      <SettingsSection
        title="Networks"
        description="Network configuration used in connected mode. Demo mode does not contact any chain."
      >
        {PUBLIC_NETWORKS.map((net) => (
          <SettingsRow
            key={net.chainId}
            label={
              <>
                {net.name} <span className="font-mono text-xs font-normal text-foreground-muted">· {net.chainId}</span>
              </>
            }
            description={net.rails.map(railLabel).join(", ")}
          >
            <StatusText
              tone={net.chainId === SEPOLIA_CHAIN_ID ? "success" : net.isTestnet ? "warning" : "neutral"}
              label={net.chainId === SEPOLIA_CHAIN_ID ? "Payments enabled (Test USDC)" : net.isTestnet ? "HSP not connected" : "Payments disabled"}
            />
          </SettingsRow>
        ))}
        <SettingsRow
          label="Evidence Registry contract"
          description="The Evidence Registry v2 contract has not been deployed to any public network yet."
        >
          <StatusText tone="warning" label="Not deployed" />
        </SettingsRow>
      </SettingsSection>

      {/* Wallet */}
      <SettingsSection title="Wallet" description="In demo mode a clearly labelled simulated wallet is used.">
        <SettingsRow
          label="Signing wallet"
          description={
            walletType === "simulated"
              ? "Simulated demo wallet — it cannot sign real transactions."
              : isWalletConnected
                ? "Browser wallet connected. In connected mode every payment still requires explicit two-stage human approval."
                : "No wallet connected."
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            {isWalletConnected && walletAddress ? (
              <>
                <CopyableValue
                  value={walletAddress}
                  displayText={`${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`}
                  label="Copy wallet address"
                />
                <Button variant="ghost" size="xs" onClick={disconnectWallet}>
                  Disconnect
                </Button>
              </>
            ) : (
              <Button variant="primary" size="sm" onClick={connectWallet}>
                <Wallet />
                Connect wallet
              </Button>
            )}
          </div>
        </SettingsRow>

        <SettingsRow
          label="Key custody"
          description="HashX never receives, stores, or transmits private keys. All signatures are produced locally by your wallet."
        >
          <StatusText tone="success" icon label="No key custody" />
        </SettingsRow>
      </SettingsSection>

      {/* Protocol rules */}
      <SettingsSection
        title="Protocol rules"
        description="Rules the connected backend enforces on every obligation (demo mode only simulates them)."
      >
        <SettingsRow
          label="Two-stage human gate"
          description="Payments require explicit approval of the exact terms (Stage 1) and a wallet-signed authorization (Stage 2). Agents cannot approve."
        >
          <StatusText tone="success" icon label="Enforced by backend" />
        </SettingsRow>

        <SettingsRow
          label="Settlement finality rule"
          description="A receipt is issued only after the transfer is independently verified on-chain and the confirmation policy is met."
        >
          <StatusText tone="success" icon label="Confirmed only" />
        </SettingsRow>

        <SettingsRow label="Demo EIP-712 domain" description="Signing domain name used by the simulated demo fixtures.">
          <span className="font-mono text-xs text-foreground">
            &quot;{HASHX_EIP712_DOMAIN.name}&quot; · v{HASHX_EIP712_DOMAIN.version}
          </span>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid grid-cols-1 gap-x-10 gap-y-3 md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="md:pt-4">
        <h2 className="text-[15px] font-medium tracking-[-0.01em] text-foreground">{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-foreground-muted">{description}</p>
      </div>
      <div className="panel divide-y divide-border">{children}</div>
    </section>
  );
}

function SettingsRow({
  label,
  description,
  children,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-5">
      <div className="min-w-0 sm:max-w-[58%]">
        <div className="text-[13px] font-medium text-foreground">{label}</div>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-foreground-secondary">{description}</p>}
      </div>
      <div className="flex min-w-0 shrink-0 sm:justify-end">{children}</div>
    </div>
  );
}

/** Status value for a settings row: dot (or shield) + label, never color alone. */
function StatusText({ tone, label, icon }: { tone: Tone; label: string; icon?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px]", toneStyles[tone].text)}>
      {icon ? (
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
      ) : (
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", toneStyles[tone].dot)} />
      )}
      {label}
    </span>
  );
}
