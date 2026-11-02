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
  ChevronRight,
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
    <header className="no-print sticky top-0 z-30 flex h-14 shrink-0 select-none items-center justify-between gap-3 border-b border-border bg-background/95 px-4 sm:px-6 lg:px-8">
      {/* Left: mobile trigger + breadcrumbs */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation"
          className="-ml-1.5 rounded-md p-1.5 text-foreground-secondary hover:bg-surface-3 hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-[13px]">
          {visibleCrumbs.map((crumb, idx) => {
            const last = idx === visibleCrumbs.length - 1;
            return (
              <React.Fragment key={crumb.href}>
                {idx > 0 && <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-foreground-muted/70 sm:block" aria-hidden="true" />}
                {last ? (
                  <span
                    aria-current="page"
                    className={cn("truncate font-medium text-foreground", crumb.isId && "font-mono text-xs")}
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link href={crumb.href} className="hidden truncate text-foreground-muted transition-colors hover:text-foreground sm:inline">
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right: network, mode, session, wallet */}
      <div className="flex shrink-0 items-center gap-2">
        {isWrongNetwork ? (
          <button
            type="button"
            onClick={() => switchChain(SEPOLIA_CHAIN_ID)}
            className="flex h-8 items-center gap-1.5 rounded-md border border-warning/35 bg-warning/[0.06] px-2.5 text-xs font-medium text-warning transition-colors hover:bg-warning/10"
            title="Unsupported network. Switch wallet to Ethereum Sepolia Testnet (chain 11155111)"
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warning" />
            Switch to Sepolia
          </button>
        ) : (
          <label className="relative hidden h-8 items-center rounded-md border border-border bg-surface-1 pl-2.5 pr-1 text-xs text-foreground-secondary transition-colors hover:border-border-strong sm:flex">
            <span aria-hidden="true" className={cn("mr-1.5 h-1.5 w-1.5 rounded-full", network?.isTestnet ? "bg-warning" : "bg-danger")} />
            <span className="sr-only">Wallet network</span>
            <select
              value={isPublic ? chainId : ""}
              onChange={(e) => void switchChain(Number(e.target.value))}
              className="h-full cursor-pointer appearance-none bg-transparent pr-5 text-xs text-foreground focus:outline-none"
              title={mode === "demo" ? "Demo mode: network selection is simulated" : "Switch wallet network"}
            >
              {!isPublic && (
                <option value="" disabled>
                  Unsupported chain {chainId}
                </option>
              )}
              {PUBLIC_NETWORKS.map((n) => (
                <option key={n.chainId} value={n.chainId}>
                  {n.shortName}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 text-foreground-muted" aria-hidden="true" />
          </label>
        )}

        {/* Data mode: simulated fixtures vs. the live backend */}
        <div role="radiogroup" aria-label="Data mode" className="flex h-8 items-center rounded-md bg-surface-2 p-0.5 ring-1 ring-inset ring-border">
          {(["demo", "connected"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "h-7 rounded-[6px] px-2.5 text-xs transition-colors",
                mode === m
                  ? "bg-surface-1 font-medium text-foreground shadow-[0_0_0_1px_rgb(var(--border)),0_1px_2px_rgb(25_24_29/0.06)]"
                  : "text-foreground-muted hover:text-foreground"
              )}
            >
              {m === "demo" ? "Demo" : "Connected"}
            </button>
          ))}
        </div>

        {/* Session (connected mode only) */}
        {mode === "connected" &&
          walletType === "eoa" &&
          walletAddress &&
          (session ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="hidden h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-foreground-secondary transition-colors hover:bg-surface-3 hover:text-foreground lg:flex"
              title="Signed in with Ethereum. Click to sign out."
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success" />
              Signed in
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void signIn()}
              disabled={isSigningIn}
              className="flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-surface-1 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
              title="Sign a one-time SIWE message. Signing in never authorizes a payment."
            >
              <KeyRound className="h-3.5 w-3.5" />
              {isSigningIn ? "Signing in…" : "Sign in"}
            </button>
          ))}

        {/* Wallet */}
        <div className="relative" ref={menuRef}>
          {isWalletConnected && walletAddress ? (
            <>
              <button
                type="button"
                onClick={() => setWalletOpen(!walletOpen)}
                aria-expanded={walletOpen}
                aria-haspopup="menu"
                className="flex h-8 items-center gap-1.5 sm:gap-2 rounded-md border border-border bg-surface-1 px-2 sm:px-2.5 text-xs text-foreground transition-colors hover:border-border-strong"
              >
                <span
                  aria-hidden="true"
                  className={cn("h-1.5 w-1.5 rounded-full", walletType === "simulated" ? "bg-warning" : "bg-success")}
                />
                <Wallet className="h-3.5 w-3.5 text-foreground-muted sm:hidden" aria-label={formatAddress(walletAddress)} />
                <span className="hidden font-mono text-xs sm:inline">{formatAddress(walletAddress)}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn("h-3.5 w-3.5 text-foreground-muted transition-transform duration-200", walletOpen && "rotate-180")}
                />
              </button>

              {walletOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-80 animate-fade-in overflow-hidden rounded-lg bg-surface-1 shadow-overlay"
                >
                  <div className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-foreground">Wallet</span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs",
                          walletType === "simulated" ? "text-warning" : "text-success"
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn("h-1.5 w-1.5 rounded-full", walletType === "simulated" ? "bg-warning" : "bg-success")}
                        />
                        {walletType === "simulated" ? "Simulated (demo)" : "Connected EOA"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
                      <span className="break-all font-mono text-xs text-foreground-secondary">{walletAddress}</span>
                      <button
                        type="button"
                        onClick={handleCopyWallet}
                        aria-label={copied ? "Address copied" : "Copy address"}
                        className="shrink-0 rounded p-1 text-foreground-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground-muted">
                      {walletType === "simulated"
                        ? "Simulated demo wallet — cannot sign real transactions. Connected mode requires a real browser wallet."
                        : session
                          ? "Signed in with Ethereum. Your wallet signs invoices and payment authorizations itself; HashX never stores private keys."
                          : "Connected browser wallet, not signed in. Sign in (SIWE) to use the HashX backend. HashX never stores private keys."}
                    </p>
                  </div>
                  {mode === "connected" && session && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        void signOut();
                        setWalletOpen(false);
                      }}
                      className="flex h-10 w-full items-center gap-2 border-t border-border px-4 text-[13px] text-foreground-secondary transition-colors hover:bg-surface-2 hover:text-foreground"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Sign out
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      disconnectWallet();
                      setWalletOpen(false);
                    }}
                    className="flex h-10 w-full items-center gap-2 border-t border-border px-4 text-[13px] text-foreground-secondary transition-colors hover:bg-danger/[0.05] hover:text-danger"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Disconnect
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={connectWallet}
              disabled={isConnecting}
              className="flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-medium text-white transition-colors hover:bg-foreground/85 disabled:opacity-50"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isConnecting ? "Connecting…" : "Connect wallet"}</span>
              <span className="sr-only sm:hidden">Connect wallet</span>
            </button>
          )}
        </div>

        {action}
      </div>
    </header>
  );
};
