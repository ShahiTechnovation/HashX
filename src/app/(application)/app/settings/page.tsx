"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, Lock, Wallet, ExternalLink, RefreshCw } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { OperationMode } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { HASHX_EIP712_DOMAIN } from "@/lib/crypto/eip712";
import { cn } from "@/lib/utils";
import { getExplorerAddressUrl } from "@/lib/formatters";

const EVIDENCE_REGISTRY_TESTNET = "0x19B861876D8075A11eC6c4596395b058fe8466C2";
const HASHX_API_URL = process.env.NEXT_PUBLIC_HASHX_API_URL || "http://localhost:8080";

const NETWORKS: Record<number, { name: string; rpc: string; registry: string | null }> = {
  133: { name: "HashKey Chain Testnet", rpc: "https://testnet.hsk.xyz", registry: EVIDENCE_REGISTRY_TESTNET },
  177: { name: "HashKey Chain Mainnet", rpc: "https://mainnet.hsk.xyz", registry: null },
};

export default function SettingsPage() {
  const {
    mode,
    setMode,
    chainId,
    setChainId,
    walletAddress,
    isWalletConnected,
    connectWallet,
    disconnectWallet,
  } = useApp();
  const network = NETWORKS[chainId] ?? NETWORKS[133];

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <section className="bg-carbon-nav border border-carbon-border p-4 rounded select-none">
        <div className="flex items-center gap-2 text-xs font-mono text-carbon-muted mb-1">
          <span>Console</span>
          <span className="text-carbon-border">/</span>
          <span className="text-primary font-semibold">Settings &amp; Node Bindings</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-carbon-text tracking-tight uppercase">
          Workspace Settings &amp; Invariants
        </h1>
        <p className="text-xs text-carbon-muted font-mono mt-0.5">
          Execution environment, HashKey Chain RPC endpoints, and approver wallet configuration.
        </p>
      </section>

      {/* Environment */}
      <SettingsSection
        title="Execution Environment"
        description="Where invoices, deterministic verifications, and payments are executed."
      >
        <SettingsRow
          label="Execution Mode"
          description={
            mode === "demo"
              ? "Deterministic fixtures, simulated EIP-712 signatures, mock RPC verification, and simulated HSP settlement. Recommended for local evaluation."
              : "Live HashX backend. Requires public IP allowlisting by HashKey HSP Operations."
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
          description="HashX API endpoint used in connected mode. Set via NEXT_PUBLIC_HASHX_API_URL."
        >
          <div className="font-mono text-xs">
            <CopyableValue value={HASHX_API_URL} label="Copy backend endpoint" />
          </div>
        </SettingsRow>
      </SettingsSection>

      {/* Network */}
      <SettingsSection
        title="HashKey Chain Binding"
        description="HashKey Chain network configuration for signing, RPC witnessing, and HSP settlement."
      >
        <SettingsRow
          label="Network Chain ID"
          description="Invoices bind to this chain ID in their EIP-712 payment terms."
        >
          <select
            value={chainId}
            onChange={(e) => setChainId(Number(e.target.value))}
            className="bg-carbon-void border border-carbon-border text-carbon-text rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-primary"
          >
            <option value={133}>HashKey Chain Testnet · 133</option>
            <option value={177} disabled>
              HashKey Chain Mainnet · 177 (Registry not yet deployed)
            </option>
          </select>
        </SettingsRow>

        <SettingsRow
          label="RPC Endpoint"
          description="Deterministic RPC provider queried to recompute delivery facts during verification."
        >
          <div className="font-mono text-xs">
            <CopyableValue value={network.rpc} label="Copy RPC endpoint" />
          </div>
        </SettingsRow>

        <SettingsRow
          label="Evidence Registry Contract"
          description="IHashXEvidenceRegistry contract that anchors cryptographic receipt commitments."
        >
          {network.registry ? (
            <div className="font-mono text-xs">
              <CopyableValue
                value={network.registry}
                displayText={`${network.registry.slice(0, 10)}…${network.registry.slice(-8)}`}
                label="Copy registry address"
                explorerUrl={getExplorerAddressUrl(network.registry)}
              />
            </div>
          ) : (
            <span className="text-xs font-mono text-carbon-muted">Not deployed on this network</span>
          )}
        </SettingsRow>
      </SettingsSection>

      {/* Wallet */}
      <SettingsSection
        title="Approver Wallet"
        description="The browser wallet that signs invoices and authorizes payment permits."
      >
        <SettingsRow
          label="Signing Wallet"
          description={
            isWalletConnected
              ? "Connected EOA. Every financialPermit still requires explicit two-stage human approval."
              : "No wallet connected. Signing actions will prompt connection."
          }
        >
          <div className="flex items-center gap-3 font-mono text-xs">
            {isWalletConnected && walletAddress ? (
              <>
                <CopyableValue
                  value={walletAddress}
                  displayText={`${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`}
                  label="Copy wallet address"
                  explorerUrl={getExplorerAddressUrl(walletAddress)}
                />
                <button
                  onClick={disconnectWallet}
                  className="px-2.5 py-1 rounded bg-carbon-panel border border-carbon-border text-carbon-muted hover:text-danger hover:bg-danger/10 transition-colors"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={connectWallet}
                className="bg-primary text-white hover:bg-primary/90"
              >
                <Wallet className="w-3.5 h-3.5 mr-1" />
                Connect Wallet
              </Button>
            )}
          </div>
        </SettingsRow>

        <SettingsRow
          label="Key Custody Guarantee"
          description="HashX never receives, stores, or transmits private keys. All signatures execute locally inside your wallet or HSM."
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-success">
            <ShieldCheck className="w-4 h-4 text-success" />
            <span>Zero Key Custody Enforced</span>
          </span>
        </SettingsRow>
      </SettingsSection>

      {/* Protocol Invariants */}
      <SettingsSection
        title="Protocol Invariants"
        description="Immutable system rules enforced on every commercial obligation."
      >
        <SettingsRow
          label="Two-Stage Human Gate"
          description="Payments require explicit approval before signing and again before HSP submission."
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-success">
            <ShieldCheck className="w-4 h-4 text-success" />
            <span>Enforced</span>
          </span>
        </SettingsRow>

        <SettingsRow
          label="Settlement Finality Rule"
          description="Receipts are issued only at payment-finalized. payment-safe is verified on chain but never marked as final."
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-success">
            <ShieldCheck className="w-4 h-4 text-success" />
            <span>Finalized Only</span>
          </span>
        </SettingsRow>

        <SettingsRow
          label="EIP-712 Domain Constant"
          description="Signing domain for typed invoices. Retains domain name 'HashX Global'."
        >
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
        <h2 className="text-sm font-display font-bold text-carbon-text uppercase tracking-tight">
          {title}
        </h2>
        <p className="mt-1 text-xs text-carbon-muted leading-relaxed font-mono">
          {description}
        </p>
      </div>
      <div className="bg-carbon-nav border border-carbon-border rounded divide-y divide-carbon-border">
        {children}
      </div>
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
        {description && (
          <p className="mt-0.5 text-xs text-carbon-muted leading-relaxed font-sans">
            {description}
          </p>
        )}
      </div>
      <div className="flex sm:justify-end min-w-0 shrink-0">{children}</div>
    </div>
  );
}
