"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Menu,
  ChevronRight,
  Wallet,
  Globe,
  Radio,
  SlidersHorizontal,
  ChevronDown,
  LogOut,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/providers/AppContext";
import { formatAddress } from "@/lib/formatters";
import { Button } from "@/components/ui/Button";

interface TopbarProps {
  onOpenMobileMenu: () => void;
  action?: React.ReactNode;
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenMobileMenu, action }) => {
  const pathname = usePathname();
  const { mode, setMode, chainId, setChainId, walletAddress, isWalletConnected, connectWallet, disconnectWallet } = useApp();
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Derive breadcrumb path
  const pathParts = pathname.split("/").filter(Boolean);
  const breadcrumbs = pathParts.map((part, index) => {
    const href = "/" + pathParts.slice(0, index + 1).join("/");
    const label = part === "app" ? "Dashboard" : part.replace(/-/g, " ");
    return { href, label };
  });

  const handleCopyWallet = async () => {
    if (walletAddress) {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="h-16 border-b border-border bg-surface-1/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open mobile navigation"
          className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-2 md:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb nav */}
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs text-foreground-muted">
          <Link href="/app" className="hover:text-foreground transition-colors">
            HashX
          </Link>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.href}>
              <ChevronRight className="w-3.5 h-3.5 text-foreground-muted/60" />
              <Link
                href={crumb.href}
                className={cn(
                  "capitalize transition-colors",
                  idx === breadcrumbs.length - 1
                    ? "text-foreground font-medium pointer-events-none"
                    : "hover:text-foreground"
                )}
              >
                {crumb.label}
              </Link>
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Environment toggle */}
        <div className="hidden lg:flex items-center rounded-lg bg-surface-2 p-0.5 border border-border text-xs">
          <button
            type="button"
            onClick={() => setMode("demo")}
            className={cn(
              "px-2.5 py-1 rounded-md font-mono text-[11px] transition-all",
              mode === "demo"
                ? "bg-primary text-white font-medium shadow-sm"
                : "text-foreground-secondary hover:text-foreground"
            )}
          >
            Demo Mode
          </button>
          <button
            type="button"
            onClick={() => setMode("connected")}
            className={cn(
              "px-2.5 py-1 rounded-md font-mono text-[11px] transition-all",
              mode === "connected"
                ? "bg-primary text-white font-medium shadow-sm"
                : "text-foreground-secondary hover:text-foreground"
            )}
          >
            Connected Mode
          </button>
        </div>

        {/* Network indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-2 border border-border text-xs text-foreground-secondary font-mono">
          <span className="w-2 h-2 rounded-full bg-success" />
          <span>HashKey {chainId === 133 ? "Testnet (133)" : "Mainnet (177)"}</span>
        </div>

        {/* Wallet status */}
        <div className="relative">
          {isWalletConnected && walletAddress ? (
            <div>
              <button
                type="button"
                onClick={() => setWalletDropdownOpen(!walletDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-hover border border-border text-xs text-foreground font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span>{formatAddress(walletAddress)}</span>
                <ChevronDown className="w-3.5 h-3.5 text-foreground-muted" />
              </button>

              {walletDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-surface-1 shadow-2xl p-3 z-50 animate-fade-in space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-xs font-medium text-foreground">Connected Wallet</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-success">
                      Active EOA
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-surface-2 border border-border flex items-center justify-between">
                    <span className="font-mono text-xs text-foreground-secondary truncate max-w-[170px]">
                      {walletAddress}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyWallet}
                      aria-label="Copy address"
                      className="p-1 rounded text-foreground-muted hover:text-foreground"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="text-[11px] text-foreground-muted leading-tight">
                    Authorizes exact commercial terms and HSP payments without storing private keys.
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      disconnectWallet();
                      setWalletDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 text-xs font-medium transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect Wallet</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={connectWallet}
              className="gap-2"
            >
              <Wallet className="w-3.5 h-3.5 text-primary-light" />
              <span>Connect Wallet</span>
            </Button>
          )}
        </div>

        {/* Contextual Page Action */}
        {action}
      </div>
    </header>
  );
};
