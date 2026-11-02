"use client";

import React from "react";
import { ShieldCheck, Wallet } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { Button } from "@/components/ui/Button";
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
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <section className="bg-carbon-nav border border-carbon-border p-4 rounded select-none">
        <div className="flex items-center gap-2 text-xs font-mono text-carbon-muted mb-1">
          <span>Console</span>
          <span className="text-carbon-border">/</span>
          <span className="text-primary font-semibold">Settings</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-display font-bold text-carbon-text tracking-tight uppercase">
            Workspace Settings
          </h1>
          <SimulatedBadge label="Demo · simulated" />
        </div>
        <p className="text-xs text-carbon-muted font-mono mt-0.5">
          You are in demo mode. Data is simulated in the browser; no backend, wallet signature, or chain is involved. Switch to
          connected mode to see real backend readiness, networks, and agent credentials.
        </p>
      </section>

      {/* Environment */}
      <SettingsSection title="Operating Mode" description="Simulated walkthrough or the real HashX backend.">
        <SettingsRow
          label="Execution Mode"
          description={
            mode === "demo"
              ? "Demo: simulated in-browser fixtures. Signatures, verification results, transaction hashes, and settlement states are illustrative — nothing touches a real chain."
              : "Connected: the real HashX backend with SIWE wallet sessions and direct Test USDC settlement on Ethereum Sepolia (testnet)."
          }
        >
          <div className="flex items-center rounded border border-carbon-border bg-carbon-void p-0.5 text-xs font-mono">
            {(["demo", "connected"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "px-3 py-1.5 rounded transition-colors capitalize",
                  mode === m
                    ? "bg-carbon-panel text-carbon-text font-bold border border-carbon-border shadow-sm"
                    : "text-carbon-muted hover:text-carbon-text"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </SettingsRow>

        <SettingsRow
          label="Backend Endpoint"
          description="HashX API endpoint used in connected mode (unused in demo). Set via NEXT_PUBLIC_HASHX_API_URL."
        >
          <div className="font-mono text-xs">
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
          <SettingsRow key={net.chainId} label={`${net.name} · ${net.chainId}`} description={net.rails.map(railLabel).join(", ")}>
            <span className="text-xs font-mono text-carbon-muted">
              {net.chainId === SEPOLIA_CHAIN_ID ? "Payments enabled (Test USDC)" : net.isTestnet ? "HSP not connected" : "Payments disabled"}
            </span>
          </SettingsRow>
        ))}
        <SettingsRow
          label="Evidence Registry Contract"
          description="The Evidence Registry v2 contract has not been deployed to any public network yet."
        >
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-warning/80" />
            <span className="text-xs font-mono text-warning font-semibold">Not deployed</span>
          </div>
        </SettingsRow>
      </SettingsSection>

      {/* Wallet */}
      <SettingsSection title="Wallet" description="In demo mode a clearly labelled simulated wallet is used.">
        <SettingsRow
          label="Signing Wallet"
          description={
            walletType === "simulated"
              ? "Simulated demo wallet — it cannot sign real transactions."
              : isWalletConnected
                ? "Browser wallet connected. In connected mode every payment still requires explicit two-stage human approval."
                : "No wallet connected."
          }
        >
          <div className="flex items-center gap-3 font-mono text-xs">
            {isWalletConnected && walletAddress ? (
              <>
                <CopyableValue
                  value={walletAddress}
                  displayText={`${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`}
                  label="Copy wallet address"
                />
                <button
                  onClick={disconnectWallet}
                  className="px-2.5 py-1 rounded bg-carbon-panel border border-carbon-border text-carbon-muted hover:text-danger hover:bg-danger/10 transition-colors"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <Button variant="primary" size="sm" onClick={connectWallet} className="bg-primary text-white hover:bg-primary/90">
                <Wallet className="w-3.5 h-3.5 mr-1" />
                Connect Wallet
              </Button>
            )}
          </div>
        </SettingsRow>

        <SettingsRow
          label="Key Custody"
          description="HashX never receives, stores, or transmits private keys. All signatures are produced locally by your wallet."
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-success">
            <ShieldCheck className="w-4 h-4 text-success" />
            <span>No key custody</span>
          </span>
        </SettingsRow>
      </SettingsSection>

      {/* Protocol rules */}
      <SettingsSection
        title="Protocol Rules"
        description="Rules the connected backend enforces on every obligation (demo mode only simulates them)."
      >
        <SettingsRow
          label="Two-Stage Human Gate"
          description="Payments require explicit approval of the exact terms (Stage 1) and a wallet-signed authorization (Stage 2). Agents cannot approve."
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-success">
            <ShieldCheck className="w-4 h-4 text-success" />
            <span>Enforced by backend</span>
          </span>
        </SettingsRow>

        <SettingsRow
          label="Settlement Finality Rule"
          description="A receipt is issued only after the transfer is independently verified on-chain and the confirmation policy is met."
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-success">
            <ShieldCheck className="w-4 h-4 text-success" />
            <span>Confirmed only</span>
          </span>
        </SettingsRow>

        <SettingsRow label="Demo EIP-712 Domain" description="Signing domain name used by the simulated demo fixtures.">
          <span className="font-mono text-xs text-carbon-text font-bold">
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
    <section className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-x-8 gap-y-3">
      <div className="md:pt-2">
        <h2 className="text-sm font-display font-bold text-carbon-text uppercase tracking-tight">{title}</h2>
        <p className="mt-1 text-xs text-carbon-muted leading-relaxed font-mono">{description}</p>
      </div>
      <div className="bg-carbon-nav border border-carbon-border rounded divide-y divide-carbon-border">{children}</div>
    </section>
  );
}

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-6 px-5 py-4">
      <div className="min-w-0 sm:max-w-[55%]">
        <div className="text-xs font-mono font-semibold text-carbon-text">{label}</div>
        {description && <p className="mt-0.5 text-xs text-carbon-muted leading-relaxed font-sans">{description}</p>}
      </div>
      <div className="flex sm:justify-end min-w-0 shrink-0">{children}</div>
    </div>
  );
}
