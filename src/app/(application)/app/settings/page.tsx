"use client";

import React from "react";
import {
  Settings,
  Shield,
  Wallet,
  Globe,
  Database,
  Lock,
  ExternalLink,
  Info,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { Button } from "@/components/ui/Button";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { formatAddress } from "@/lib/formatters";

export default function SettingsPage() {
  const { mode, setMode, chainId, setChainId, walletAddress, isWalletConnected, connectWallet, disconnectWallet } = useApp();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-primary-light" />
            <span>Platform Settings & Network Configuration</span>
          </h1>
          <p className="text-xs text-foreground-secondary mt-1">
            Environment execution mode, HashKey Chain RPC endpoints, and smart contract registry bindings.
          </p>
        </div>
      </div>

      {/* Security Statement Notice */}
      <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-start gap-3 text-xs text-foreground-secondary">
        <Lock className="w-5 h-5 text-primary-light shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-foreground">Zero-Custody Architectural Invariant</span>
          <p className="leading-relaxed">
            HashX never receives, stores, or transmits user private keys. All invoice authorizations and HSP payment transactions are signed directly through your browser or hardware wallet.
          </p>
        </div>
      </div>

      {/* Operation Mode */}
      <div className="p-6 rounded-xl border border-border bg-surface-1 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary-light" />
            <h3 className="text-sm font-semibold text-foreground">Execution Mode</h3>
          </div>
          <span className="text-xs font-mono text-primary-light font-medium uppercase">
            Active: {mode}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => setMode("demo")}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              mode === "demo"
                ? "border-primary bg-primary-subtle/20 ring-1 ring-primary"
                : "border-border bg-surface-2 hover:bg-surface-hover"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-foreground">Demo Mode (Simulated)</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary-light">
                RECOMMENDED FOR JUDGING
              </span>
            </div>
            <p className="text-xs text-foreground-secondary leading-relaxed">
              Deterministic scenario fixtures, simulated EIP-712 signatures, mock RPC verifications, and safe simulated HSP settlement.
            </p>
          </div>

          <div
            onClick={() => setMode("connected")}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              mode === "connected"
                ? "border-primary bg-primary-subtle/20 ring-1 ring-primary"
                : "border-border bg-surface-2 hover:bg-surface-hover"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-foreground">Connected Mode</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-foreground-muted">
                LIVE BACKEND
              </span>
            </div>
            <p className="text-xs text-foreground-secondary leading-relaxed">
              Connects to a live persistent HashX backend service with public outbound IP allowlisted by HashKey HSP Operations.
            </p>
          </div>
        </div>
      </div>

      {/* Network Configuration */}
      <div className="p-6 rounded-xl border border-border bg-surface-1 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary-light" />
            <h3 className="text-sm font-semibold text-foreground">HashKey Chain Infrastructure</h3>
          </div>
          <span className="text-xs font-mono text-foreground-muted">
            Chain ID: {chainId}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-lg bg-surface-2 border border-border space-y-1">
            <span className="text-foreground-muted block">Testnet RPC Endpoint:</span>
            <span className="text-foreground">https://testnet.hsk.xyz</span>
            <span className="text-[11px] text-foreground-muted block">Chain ID: 133</span>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-2 border border-border space-y-1">
            <span className="text-foreground-muted block">Mainnet RPC Endpoint:</span>
            <span className="text-foreground">https://mainnet.hsk.xyz</span>
            <span className="text-[11px] text-foreground-muted block">Chain ID: 177</span>
          </div>

          <div className="sm:col-span-2 p-3.5 rounded-lg bg-surface-2 border border-border space-y-1">
            <span className="text-foreground-muted block">
              IHashXEvidenceRegistry Contract Address (Testnet):
            </span>
            <CopyableValue
              value="0x19B861876D8075A11eC6c4596395b058fe8466C2"
              displayText="0x19B861876D8075A11eC6c4596395b058fe8466C2"
              explorerUrl="https://testnet.hsk.xyz/address/0x19B861876D8075A11eC6c4596395b058fe8466C2"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
