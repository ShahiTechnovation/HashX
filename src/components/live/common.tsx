"use client";

/**
 * Shared building blocks for connected-mode (real backend) views.
 * Built only from existing HashX UI primitives so live views match the established design.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ExternalLink, FlaskConical, KeyRound, Wallet } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { toneStyles, type Tone } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { explorerTxUrl, findNetwork, formatTokenAmount } from "@shared/networks";
import { LiveApiError, type LivePaymentState } from "@/lib/live/types";

/** Loads data from the live API with loading / error / reload state. */
export function useLiveQuery<T>(fn: () => Promise<T>, deps: React.DependencyList) {
  const { refreshKey } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fn()
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refreshKey, tick]);
  return { data, error, loading, reload, setData };
}

export function errorMessage(err: unknown): string {
  if (err instanceof LiveApiError) return `${err.message} (${err.code}${err.requestId ? ` · request ${err.requestId.slice(0, 8)}` : ""})`;
  if (err instanceof Error) {
    const short = (err as any).shortMessage as string | undefined;
    return short ?? err.message;
  }
  return String(err);
}

export const LiveError: React.FC<{ error: unknown; title?: string; onRetry?: () => void; className?: string }> = ({ error, title, onRetry, className }) => (
  <Callout
    tone="danger"
    title={title ?? "Request failed"}
    className={className}
    actions={onRetry ? <Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button> : undefined}
  >
    {errorMessage(error)}
  </Callout>
);

/**
 * Requires a connected EOA wallet AND an authenticated SIWE session before rendering children.
 * Financial actions are authorized server-side; this gate only explains what is missing.
 */
export const LiveGate: React.FC<{ children: React.ReactNode; purpose?: string }> = ({ children, purpose }) => {
  const { walletAddress, walletType, connectWallet, isConnecting, session, signIn, isSigningIn, walletError } = useApp();
  if (walletType === "eoa" && walletAddress && session) return <>{children}</>;
  const needsWallet = walletType !== "eoa" || !walletAddress;
  return (
    <Panel>
      <PanelBody className="flex flex-col items-start gap-4 py-8">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {needsWallet ? <Wallet className="h-4 w-4 text-primary-light" /> : <KeyRound className="h-4 w-4 text-primary-light" />}
          {needsWallet ? "Connect your wallet" : "Sign in with your wallet"}
        </div>
        <p className="max-w-xl text-[13px] leading-relaxed text-foreground-secondary">
          {needsWallet
            ? "Connected mode works with real records on the HashX backend. Connect an EIP-1193 browser wallet (for example MetaMask)."
            : "Sign a one-time Sign-In with Ethereum (EIP-4361) message to prove you control this wallet. Signing in does not authorize any payment."}
          {purpose ? ` ${purpose}` : ""}
        </p>
        {needsWallet ? (
          <Button onClick={connectWallet} isLoading={isConnecting}>Connect wallet</Button>
        ) : (
          <Button onClick={signIn} isLoading={isSigningIn}>Sign in with Ethereum</Button>
        )}
        {walletError && <p className="text-xs text-danger">{walletError}</p>}
      </PanelBody>
    </Panel>
  );
};

/** Explicit testnet labelling — Sepolia USDC has no monetary value. */
export const TestnetBadge: React.FC<{ chainId: number | null | undefined; className?: string }> = ({ chainId, className }) => {
  const net = chainId ? findNetwork(chainId) : undefined;
  if (!net) return <span className={cn("text-2xs text-danger", className)}>Unsupported chain</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium ring-1",
        net.isTestnet ? toneStyles.warning.badge : toneStyles.danger.badge,
        className
      )}
    >
      <FlaskConical className="h-3 w-3" />
      {net.isTestnet ? `${net.shortName} · Test tokens, no monetary value` : `${net.shortName} · payments disabled`}
    </span>
  );
};

export const SimulatedBadge: React.FC<{ className?: string; label?: string }> = ({ className, label = "Simulated demo data" }) => (
  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium ring-1", toneStyles.neutral.badge, className)}>
    {label}
  </span>
);

export function tokenAmount(raw: string | null | undefined, decimals: number | null | undefined, symbol: string | null | undefined, chainId?: number | null) {
  if (!raw) return "—";
  const net = chainId ? findNetwork(chainId) : undefined;
  const label = net?.isTestnet ? `Test ${symbol ?? ""}`.trim() : symbol ?? "";
  return `${formatTokenAmount(raw, decimals ?? 6)} ${label}`;
}

export const PAYMENT_STATE_META: Record<LivePaymentState, { label: string; tone: Tone; description: string }> = {
  AWAITING_SIGNATURE_APPROVAL: { label: "Awaiting Stage 1", tone: "warning", description: "Buyer must review and approve the exact obligation." },
  AWAITING_SUBMISSION_APPROVAL: { label: "Awaiting Stage 2", tone: "warning", description: "Buyer wallet must sign the EIP-712 payment authorization." },
  AUTHORIZED: { label: "Authorized · not sent", tone: "accent", description: "Authorized; the buyer wallet has not reported a transfer yet." },
  SUBMITTED: { label: "Submitted", tone: "info", description: "Transaction hash reported; not yet observed in a block." },
  INCLUDED: { label: "Included · confirming", tone: "info", description: "Transfer verified in a block; waiting for the confirmation policy." },
  CONFIRMED: { label: "Confirmed", tone: "success", description: "Transfer independently verified and confirmation policy satisfied." },
  FINALIZED: { label: "Finalized", tone: "success", description: "Transfer block is at or below the chain's finalized block." },
  FAILED: { label: "Failed", tone: "danger", description: "Reverted or did not match the authorized transfer." },
  DROPPED: { label: "Dropped", tone: "danger", description: "Transaction was never observed on-chain." },
  EXPIRED: { label: "Expired", tone: "neutral", description: "Authorization window elapsed before completion." },
  CANCELLED: { label: "Cancelled", tone: "neutral", description: "Cancelled by the payer." },
  TIMEOUT: { label: "Timed out", tone: "neutral", description: "Settlement provider timed out." },
};

export const PaymentStateBadge: React.FC<{ state: LivePaymentState; className?: string }> = ({ state, className }) => {
  const meta = PAYMENT_STATE_META[state] ?? { label: state, tone: "neutral" as Tone };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-medium ring-1", toneStyles[meta.tone].badge, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", toneStyles[meta.tone].dot)} />
      {meta.label}
    </span>
  );
};

export const TxLink: React.FC<{ chainId: number | null | undefined; hash: string | null | undefined; className?: string }> = ({ chainId, hash, className }) => {
  if (!hash) return <span className="text-foreground-muted">—</span>;
  const url = chainId ? explorerTxUrl(chainId, hash) : null;
  const short = `${hash.slice(0, 10)}…${hash.slice(-8)}`;
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className={cn("inline-flex items-center gap-1 font-mono text-xs text-primary-light hover:underline", className)}>
      {short}
      <ExternalLink className="h-3 w-3" />
    </a>
  ) : (
    <span className={cn("font-mono text-xs", className)}>{short}</span>
  );
};

export function shortAddr(a: string | null | undefined) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}

export function newClientRequestId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `ui-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
