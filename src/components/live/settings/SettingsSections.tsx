"use client";

/**
 * Settings building blocks. Connected-mode sections read only from the real backend
 * (`/ready`, `/auth/*`, `/counterparties/me`) and from shared/networks configuration.
 * No contract address is ever presented as deployed unless the backend confirmed it on-chain.
 */
import React, { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { DataList, DataRow } from "@/components/ui/DataList";
import { Field, Input } from "@/components/ui/Field";
import { toneStyles, type Tone } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/live/api";
import { errorMessage, LiveError, shortAddr, useLiveQuery } from "@/components/live/common";
import {
  explorerAddressUrl,
  findNetwork,
  HASHKEY_MAINNET_CHAIN_ID,
  HASHKEY_TESTNET_CHAIN_ID,
  PUBLIC_NETWORKS,
  railLabel,
  SEPOLIA_CHAIN_ID,
  type NetworkConfig,
} from "@shared/networks";
import type { LiveReadiness } from "@/lib/live/types";

export const Pill: React.FC<{ tone: Tone; children: React.ReactNode; className?: string }> = ({ tone, children, className }) => (
  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-medium ring-1", toneStyles[tone].badge, className)}>
    <span className={cn("h-1.5 w-1.5 rounded-full", toneStyles[tone].dot)} />
    {children}
  </span>
);

// ---------------------------------------------------------------------------
// (a) Operating mode
// ---------------------------------------------------------------------------

export const ModeSection: React.FC = () => {
  const { mode, setMode } = useApp();
  return (
    <Panel>
      <PanelHeader
        title="Operating mode"
        description="Choose between a simulated walkthrough and the real HashX backend."
        actions={
          <div className="inline-flex items-center gap-0.5 rounded-md bg-surface-2/70 p-0.5 ring-1 ring-inset ring-border">
            {(["demo", "connected"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "h-7 px-2.5 rounded-[5px] text-xs font-medium capitalize transition-colors",
                  mode === m ? "bg-surface-3 text-foreground" : "text-foreground-muted hover:text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        }
      />
      <PanelBody>
        <DataList>
          <DataRow label="Demo">
            Simulated, in-browser fixtures. No backend, no wallet signatures that move funds, no real transactions. Hashes, addresses and
            block numbers shown in demo mode are illustrative.
          </DataRow>
          <DataRow label="Connected">
            The real HashX backend: SIWE wallet sessions, persisted invoices, independent verification, two-stage human authorization, and
            direct Test USDC settlement on Ethereum Sepolia (testnet only — test tokens have no monetary value).
          </DataRow>
          <DataRow label="Backend endpoint" hint="NEXT_PUBLIC_HASHX_API_URL">
            <CopyableValue value={API_URL} label="Copy backend endpoint" />
          </DataRow>
        </DataList>
      </PanelBody>
    </Panel>
  );
};

// ---------------------------------------------------------------------------
// (b) Wallet & session
// ---------------------------------------------------------------------------

export const WalletSessionSection: React.FC = () => {
  const {
    walletAddress,
    walletType,
    chainId,
    connectWallet,
    disconnectWallet,
    isConnecting,
    session,
    signIn,
    signOut,
    isSigningIn,
    walletError,
    liveApi,
  } = useApp();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(session?.displayName ?? "");
    setSavedName(null);
  }, [session]);

  const net = findNetwork(chainId);
  const isEoa = walletType === "eoa" && walletAddress;

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await liveApi.setDisplayName(displayName.trim());
      setSavedName(res.displayName);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel>
      <PanelHeader title="Wallet & session" description="Your browser wallet signs everything. HashX never holds private keys." />
      <PanelBody className="space-y-5">
        <DataList>
          <DataRow label="Wallet">
            {isEoa ? (
              <div className="flex flex-wrap items-center gap-2">
                <CopyableValue
                  value={walletAddress!}
                  displayText={shortAddr(walletAddress)}
                  label="Copy wallet address"
                  explorerUrl={explorerAddressUrl(chainId, walletAddress!) ?? undefined}
                />
                <Button size="xs" variant="ghost" onClick={disconnectWallet}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={connectWallet} isLoading={isConnecting}>
                Connect wallet
              </Button>
            )}
          </DataRow>
          <DataRow label="Wallet network">{net ? `${net.name} · ${net.chainId}` : `Unsupported chain ${chainId}`}</DataRow>
          <DataRow label="Session" hint="Sign-In with Ethereum (EIP-4361)">
            {session ? (
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="success">Signed in</Pill>
                <span className="text-2xs text-foreground-muted">expires {new Date(session.expiresAt).toLocaleString()}</span>
                <Button size="xs" variant="secondary" onClick={() => void signOut()}>
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="neutral">Not signed in</Pill>
                <Button size="xs" onClick={() => void signIn()} isLoading={isSigningIn} disabled={!isEoa}>
                  Sign in
                </Button>
              </div>
            )}
          </DataRow>
        </DataList>
        {walletError && <p className="text-xs text-danger">{walletError}</p>}

        {session && (
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <Field label="Display name" hint="Shown to counterparties on invoices and receipts." className="flex-1">
              <Input value={displayName} maxLength={120} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            <Button size="md" variant="secondary" onClick={save} isLoading={saving} disabled={!displayName.trim()}>
              Save
            </Button>
          </div>
        )}
        {savedName && <p className="text-xs text-success">Display name saved as “{savedName}”.</p>}
        {saveError && <p className="text-xs text-danger">{saveError}</p>}
        <p className="text-2xs text-foreground-muted">Signing in proves wallet control only. It never authorizes a payment.</p>
      </PanelBody>
    </Panel>
  );
};

// ---------------------------------------------------------------------------
// (c) Networks
// ---------------------------------------------------------------------------

function paymentExecution(net: NetworkConfig): { tone: Tone; label: string } {
  if (net.chainId === SEPOLIA_CHAIN_ID) return { tone: "success", label: "Enabled · Test USDC" };
  if (net.chainId === HASHKEY_TESTNET_CHAIN_ID) return { tone: "warning", label: "HSP not connected" };
  if (net.chainId === HASHKEY_MAINNET_CHAIN_ID) return { tone: "danger", label: "Disabled (mainnet)" };
  return { tone: "neutral", label: net.paymentExecutionEnabledByDefault ? "Enabled" : "Disabled" };
}

export const NetworksSection: React.FC = () => {
  const { chainId, switchChain } = useApp();
  return (
    <Panel>
      <PanelHeader title="Networks" description="Configured in shared/networks. Unknown chain IDs are rejected, never defaulted." />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-2xs uppercase tracking-wider text-foreground-muted">
              <th className="px-4 sm:px-5 py-2.5 font-medium">Network</th>
              <th className="px-3 py-2.5 font-medium">Chain ID</th>
              <th className="px-3 py-2.5 font-medium">Rails</th>
              <th className="px-3 py-2.5 font-medium">Payment execution</th>
              <th className="px-3 py-2.5 font-medium">Explorer</th>
              <th className="px-4 sm:px-5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {PUBLIC_NETWORKS.map((net) => {
              const exec = paymentExecution(net);
              const active = net.chainId === chainId;
              return (
                <tr key={net.chainId}>
                  <td className="px-4 sm:px-5 py-3">
                    <div className="text-foreground">{net.name}</div>
                    <div className="text-2xs text-foreground-muted">{net.isTestnet ? "Testnet" : "Mainnet"}</div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs tabular-nums">{net.chainId}</td>
                  <td className="px-3 py-3 text-xs text-foreground-secondary">{net.rails.map(railLabel).join(", ")}</td>
                  <td className="px-3 py-3">
                    <Pill tone={exec.tone}>{exec.label}</Pill>
                  </td>
                  <td className="px-3 py-3">
                    {net.explorerUrl ? (
                      <a href={net.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary-light hover:underline">
                        {net.explorerUrl.replace(/^https?:\/\//, "")}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-foreground-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 sm:px-5 py-3 text-right">
                    {active ? (
                      <span className="text-2xs text-foreground-muted">Wallet is on this network</span>
                    ) : (
                      <Button size="xs" variant="secondary" onClick={() => void switchChain(net.chainId)}>
                        Switch wallet to this network
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
};

// ---------------------------------------------------------------------------
// (d) Backend readiness
// ---------------------------------------------------------------------------

function statusTone(s: string | undefined): Tone {
  if (s === "ok" || s === "ready") return "success";
  if (s === "configured" || s === "migrations_pending" || s === "degraded") return "warning";
  return "danger";
}

const RegistryStatus: React.FC<{ reg: NonNullable<LiveReadiness["chains"][string]["evidenceRegistry"]> }> = ({ reg }) => {
  if (reg.deployed === true) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Pill tone="success">Deployed{reg.version ? ` · v${reg.version}` : ""}</Pill>
        {reg.address && <span className="font-mono text-2xs text-foreground-secondary">{shortAddr(reg.address)}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Pill tone="warning">{reg.configured ? "Not deployed" : "Not configured"}</Pill>
      {reg.reason && <span className="text-2xs text-foreground-muted">{reg.reason}</span>}
    </span>
  );
};

export const ReadinessSection: React.FC = () => {
  const { liveApi } = useApp();
  const { data, error, loading, reload } = useLiveQuery(() => liveApi.readiness(), [liveApi]);
  const hsp = data?.settlement["hashkey-hsp"];

  return (
    <Panel>
      <PanelHeader
        title="Backend readiness"
        description="Live from GET /ready. Contains no URLs, keys, or raw provider errors."
        actions={
          <Button size="xs" variant="ghost" onClick={reload} isLoading={loading}>
            {!loading && <RefreshCw className="h-3 w-3" />}
            Re-check
          </Button>
        }
      />
      <PanelBody className="space-y-5">
        {error ? (
          <LiveError error={error} title="Backend unreachable" onRetry={reload} />
        ) : !data ? (
          <div className="h-24 rounded-md bg-surface-2 animate-pulse" />
        ) : (
          <>
            <DataList>
              <DataRow label="Overall">
                <Pill tone={statusTone(data.status)}>{data.status}</Pill>
                <span className="ml-2 text-2xs text-foreground-muted">checked {new Date(data.checkedAt).toLocaleString()}</span>
              </DataRow>
              <DataRow label="Database">
                <Pill tone={statusTone(data.database.status)}>{data.database.status}</Pill>
                {data.database.pendingMigrations && data.database.pendingMigrations.length > 0 && (
                  <div className="mt-1 text-2xs text-warning">Pending migrations: {data.database.pendingMigrations.join(", ")}</div>
                )}
              </DataRow>
              <DataRow label="Sepolia Test USDC settlement">
                <Pill tone={data.settlement["sepolia-usdc"].available ? "success" : "danger"}>
                  {data.settlement["sepolia-usdc"].available ? "Available" : "Unavailable"}
                </Pill>
              </DataRow>
            </DataList>

            <div className="space-y-3">
              <div className="text-xs font-medium text-foreground-secondary">Chains configured on the backend</div>
              {Object.keys(data.chains).length === 0 && <p className="text-xs text-foreground-muted">No chains configured.</p>}
              {Object.entries(data.chains).map(([id, c]) => (
                <div key={id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-[13px] text-foreground">
                      {c.network ?? findNetwork(c.chainId)?.name ?? "Unknown network"} <span className="font-mono text-2xs text-foreground-muted">· {c.chainId}</span>
                    </span>
                    <Pill tone={c.paymentExecutionEnabled ? "success" : "neutral"}>
                      Payments {c.paymentExecutionEnabled ? "enabled" : "disabled"}
                    </Pill>
                  </div>
                  <DataList dense>
                    <DataRow label="RPC">
                      <Pill tone={statusTone(c.rpc)}>{c.rpc}</Pill>
                    </DataRow>
                    <DataRow label="Latest block">{c.latestBlock ? <span className="font-mono text-xs tabular-nums">{c.latestBlock}</span> : "—"}</DataRow>
                    {c.settlementToken && (
                      <DataRow label="Settlement token">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span className="text-xs">{c.settlementToken.label}</span>
                          <span className="font-mono text-2xs text-foreground-secondary">{shortAddr(c.settlementToken.address)}</span>
                          <Pill tone={c.settlementToken.validatedOnChain ? "success" : "danger"}>
                            {c.settlementToken.validatedOnChain ? "Validated on-chain" : "Not validated"}
                          </Pill>
                          {c.settlementToken.reason && <span className="text-2xs text-foreground-muted">{c.settlementToken.reason}</span>}
                        </span>
                      </DataRow>
                    )}
                    <DataRow label="Evidence Registry">
                      {c.evidenceRegistry ? <RegistryStatus reg={c.evidenceRegistry} /> : <Pill tone="neutral">Not checked</Pill>}
                    </DataRow>
                  </DataList>
                </div>
              ))}
            </div>

            {hsp && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-foreground-secondary">HashKey Settlement Protocol (HSP)</div>
                <DataList dense>
                  <DataRow label="Configured">{hsp.configured ? "Yes" : "No"}</DataRow>
                  <DataRow label="Allowlist confirmed">{hsp.allowlistConfirmed ? "Yes" : "No"}</DataRow>
                  <DataRow label="Connection">
                    <Pill tone={statusTone(hsp.connection)}>{hsp.connection}</Pill>
                  </DataRow>
                  <DataRow label="Authentication">
                    <Pill tone={statusTone(hsp.authentication)}>{hsp.authentication}</Pill>
                  </DataRow>
                  <DataRow label="Tools discovered">{hsp.toolsDiscovered}</DataRow>
                  <DataRow label="Settlement available">
                    <Pill tone={hsp.settlementAvailable ? "success" : "danger"}>{hsp.settlementAvailable ? "Yes" : "No"}</Pill>
                  </DataRow>
                </DataList>
                {hsp.blockers.length > 0 && (
                  <Callout tone="warning" title="HSP blockers">
                    <ul className="list-disc pl-4 space-y-0.5">
                      {hsp.blockers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </Callout>
                )}
              </div>
            )}
          </>
        )}
      </PanelBody>
    </Panel>
  );
};
