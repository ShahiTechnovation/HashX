"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Menu,
  ChevronDown,
  LogOut,
  Copy,
  Check,
  Wallet,
  Layers,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/providers/AppContext";
import { formatAddress } from "@/lib/formatters";
import { PUBLIC_NETWORKS, SEPOLIA_CHAIN_ID, findNetwork } from "@shared/networks";

interface TopbarProps {
  onOpenMobileMenu: () => void;
  action?: React.ReactNode;
}

const SEGMENT_LABELS: Record<string, string> = {
  app: "Overview",
  invoices: "Invoices",
  trust: "Trust Inspector",
  approvals: "Approvals",
  settlements: "Settlements",
  receipts: "Receipts",
  developers: "Developers",
  demo: "Proof Lab",
  settings: "Settings",
  new: "New invoice",
};

export const Topbar: React.FC<TopbarProps> = ({ onOpenMobileMenu, action }) => {
  const pathname = usePathname();
  const {
    mode,
    setMode,
    chainId,
    walletAddress,
    walletType,
    isWalletConnected,
    isWrongNetwork,
    isConnecting,
    walletError,
    connectWallet,
    disconnectWallet,
    switchChain,
    session,
    signIn,
    signOut,
    isSigningIn,
  } = useApp();
  const network = findNetwork(chainId);
  const isPublic = PUBLIC_NETWORKS.some((n) => n.chainId === chainId);
  const [walletOpen, setWalletOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!walletOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setWalletOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setWalletOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [walletOpen]);

  const parts = pathname.split("/").filter(Boolean);
  const crumbs = parts.map((part, index) => ({
    href: "/" + parts.slice(0, index + 1).join("/"),
    label: SEGMENT_LABELS[part] ?? decodeURIComponent(part),
    isId: !(part in SEGMENT_LABELS),
  }));
  const visibleCrumbs = crumbs.length > 1 ? crumbs.slice(1) : crumbs;

  const handleCopyWallet = async () => {
    if (walletAddress) {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <header className="h-16 shrink-0 border-b border-carbon-border bg-carbon-void/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 select-none">
      {/* Left: Mobile trigger, Workspace & Breadcrumbs */}
      <div className="flex items-center gap-3.5 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation"
          className="p-1.5 -ml-1 rounded text-carbon-muted hover:text-carbon-text hover:bg-carbon-panel md:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Workspace Pill */}
        <div className="hidden lg:flex items-center gap-2 bg-carbon-nav px-2.5 py-1 rounded border border-carbon-border text-xs">
          <Layers className="w-3.5 h-3.5 text-primary" />
          <span className="font-display font-semibold text-carbon-text tracking-tight">
            {mode === "connected" ? "Connected · live backend" : "Demo · simulated"}
          </span>
        </div>

        {/* Network selector (shared/networks PUBLIC_NETWORKS) */}
        <label className="hidden sm:flex items-center gap-1.5 pl-1">
          <span className={cn("inline-block w-2 h-2 rounded-full", network?.isTestnet ? "bg-warning" : "bg-danger")} />
          <span className="sr-only">Wallet network</span>
          <select
            value={isPublic ? chainId : ""}
            onChange={(e) => void switchChain(Number(e.target.value))}
            className="bg-transparent font-mono text-[11px] uppercase tracking-wider text-carbon-text focus:outline-none cursor-pointer"
            title={mode === "demo" ? "Demo mode: network selection is simulated" : "Switch wallet network"}
          >
            {!isPublic && (
              <option value="" disabled>
                Unsupported chain {chainId}
              </option>
            )}
            {PUBLIC_NETWORKS.map((n) => (
              <option key={n.chainId} value={n.chainId} className="bg-carbon-panel normal-case">
                {n.shortName} · {n.chainId}
              </option>
            ))}
          </select>
        </label>

        {/* Mobile / Secondary Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex sm:hidden items-center gap-1.5 text-xs min-w-0 font-mono"
        >
          {visibleCrumbs.map((crumb, idx) => {
            const last = idx === visibleCrumbs.length - 1;
            return (
              <React.Fragment key={crumb.href}>
                {idx > 0 && <span className="text-carbon-muted/50">/</span>}
                {last ? (
                  <span
                    aria-current="page"
                    className={cn(
                      "text-carbon-text font-medium truncate",
                      crumb.isId && "font-mono text-2xs"
                    )}
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="text-carbon-muted hover:text-carbon-text transition-colors truncate"
                  >
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right: Telemetry & Controls */}
      <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono">
        {/* Rail Telemetry */}
        <div className="hidden xl:flex items-center gap-1.5 text-carbon-muted">
          <span>Settlement:</span>
          <span className={cn("font-semibold", mode === "connected" ? "text-carbon-text" : "text-primary")}>
            {mode === "connected" ? "Sepolia Test USDC · HSP not connected" : "Simulated"}
          </span>
        </div>

        <div className="hidden xl:block h-3.5 w-px bg-carbon-border" />

        {/* Quorum Notice */}
        <div className="hidden md:flex items-center gap-1.5 text-carbon-muted">
          <span>Approval:</span>
          <span className="text-warning font-semibold bg-warning/10 px-1.5 py-0.5 rounded border border-warning/20 text-[11px]">
            2-Stage Required
          </span>
        </div>

        {/* Wrong Network Notice */}
        {isWrongNetwork && (
          <button
            type="button"
            onClick={() => switchChain(SEPOLIA_CHAIN_ID)}
            className="flex items-center gap-1.5 h-8 px-2.5 rounded bg-warning/10 border border-warning/30 text-warning text-xs hover:bg-warning/20 transition-colors font-mono"
            title="Unsupported network. Switch wallet to Ethereum Sepolia Testnet (chain 11155111)"
          >
            <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
            Switch to Sepolia
          </button>
        )}

        <div className="hidden md:block h-3.5 w-px bg-carbon-border" />

        {/* Mode Toggle (Demo vs Connected) */}
        <div className="flex items-center h-8 rounded border border-carbon-border bg-carbon-nav p-0.5 text-xs">
          {(["demo", "connected"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "h-6 px-2.5 rounded font-mono text-[11px] transition-colors capitalize",
                mode === m
                  ? "bg-carbon-panel text-carbon-text font-semibold border border-carbon-border shadow-sm"
                  : "text-carbon-muted hover:text-carbon-text"
              )}
            >
              {m === "demo" ? (mode === "demo" ? "Demo · simulated" : "Demo") : "Connected"}
            </button>
          ))}
        </div>

        {/* Session (connected mode only) */}
        {mode === "connected" && walletType === "eoa" && walletAddress &&
          (session ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded border border-success/30 bg-success/10 text-success text-[11px] hover:bg-success/15 transition-colors"
              title="Signed in with Ethereum. Click to sign out."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Signed in · Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void signIn()}
              disabled={isSigningIn}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors disabled:opacity-50"
              title="Sign a one-time SIWE message. Signing in never authorizes a payment."
            >
              <KeyRound className="w-3.5 h-3.5" />
              {isSigningIn ? "Signing in…" : "Sign in"}
            </button>
          ))}

        {/* Wallet Connector / Badge */}
        <div className="relative" ref={menuRef}>
          {isWalletConnected && walletAddress ? (
            <>
              <button
                type="button"
                onClick={() => setWalletOpen(!walletOpen)}
                aria-expanded={walletOpen}
                aria-haspopup="menu"
                className={cn(
                  "flex items-center gap-2 h-8 px-2.5 rounded border text-xs transition-colors focus-visible:outline-none focus-visible:ring-1",
                  walletType === "simulated"
                    ? "border-warning/30 bg-warning/10 hover:bg-warning/15 text-warning focus-visible:ring-warning"
                    : "border-primary/30 bg-primary/10 hover:bg-primary/15 text-primary focus-visible:ring-primary"
                )}
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    walletType === "simulated" ? "bg-warning" : "bg-success"
                  )}
                />
                <span className="font-mono text-[11px] font-medium">
                  {formatAddress(walletAddress)}
                </span>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform",
                    walletType === "simulated" ? "text-warning/70" : "text-primary/70",
                    walletOpen && "rotate-180"
                  )}
                />
              </button>

              {walletOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-72 rounded bg-carbon-panel border border-carbon-border shadow-2xl z-50 animate-fade-in overflow-hidden"
                >
                  <div className="px-3.5 pt-3 pb-3 border-b border-carbon-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-carbon-text">
                        Wallet
                      </span>
                      {walletType === "simulated" ? (
                        <span className="text-[10px] text-warning font-mono flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                          Simulated (Demo)
                        </span>
                      ) : (
                        <span className="text-[10px] text-success font-mono flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-success" />
                          Connected EOA
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 rounded bg-carbon-void border border-carbon-border px-2.5 py-1.5">
                      <span className="font-mono text-2xs text-carbon-muted break-all">
                        {walletAddress}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyWallet}
                        aria-label="Copy address"
                        className="p-1 rounded text-carbon-muted hover:text-carbon-text shrink-0"
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-carbon-muted leading-relaxed font-sans">
                      {walletType === "simulated"
                        ? "Simulated demo wallet — cannot sign real transactions. Connected mode requires a real browser wallet."
                        : session
                          ? "Signed in with Ethereum. Your wallet signs invoices and payment authorizations itself; HashX never stores private keys."
                          : "Connected browser wallet, not signed in. Sign in (SIWE) to use the HashX backend. HashX never stores private keys."}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      disconnectWallet();
                      setWalletOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 h-9 text-xs text-carbon-muted hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={connectWallet}
              disabled={isConnecting}
              className="flex items-center gap-1.5 h-8 px-3 rounded border border-primary/40 bg-primary/10 hover:bg-primary/20 text-xs font-mono font-medium text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>{isConnecting ? "Connecting…" : "Connect Wallet"}</span>
            </button>
          )}
        </div>

        {action}
      </div>
    </header>
  );
};
