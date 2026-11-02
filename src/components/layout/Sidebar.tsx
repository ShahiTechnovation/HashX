"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  FileText,
  ScanSearch,
  KeyRound,
  ArrowLeftRight,
  ReceiptText,
  FlaskConical,
  Terminal,
  Settings,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/providers/AppContext";
import { findNetwork } from "@shared/networks";

interface SidebarProps {
  onCloseMobile?: () => void;
  className?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: React.ReactNode;
  shortcut?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile, className }) => {
  const pathname = usePathname();
  const { pendingApprovalsCount, mode, chainId } = useApp();

  const isActive = (href: string) => {
    if (href === "/app") return pathname === "/app";
    return pathname.startsWith(href);
  };

  const coreNav: NavItem[] = [
    {
      name: "Overview",
      href: "/app",
      icon: LayoutGrid,
      shortcut: "CTRL+1",
    },
    {
      name: "Trust Inspector",
      href: "/app/trust",
      icon: ScanSearch,
      badge: (
        <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-danger/15 text-danger border border-danger/30">
          Forensics
        </span>
      ),
    },
    {
      name: "Invoices & Intent",
      href: "/app/invoices",
      icon: FileText,
      badge: <span className="text-[10px] font-mono text-carbon-muted">EIP-712</span>,
    },
    {
      name: "Human Authorization",
      href: "/app/approvals",
      icon: KeyRound,
      badge: pendingApprovalsCount > 0 ? (
        <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/30 animate-pulse">
          {pendingApprovalsCount} Pending
        </span>
      ) : (
        <span className="text-[9px] font-mono text-carbon-muted">2-stage</span>
      ),
    },
    {
      name: "Settlements",
      href: "/app/settlements",
      icon: ArrowLeftRight,
      badge: (
        <span className="text-[9px] font-mono text-carbon-muted">{mode === "connected" ? "Sepolia" : "Simulated"}</span>
      ),
    },
    {
      name: "Verifiable Receipts",
      href: "/app/receipts",
      icon: ReceiptText,
    },
  ];

  const toolsNav: NavItem[] = [
    {
      name: "Proof Lab",
      href: "/app/demo",
      icon: FlaskConical,
      badge: <span className="text-[9px] font-mono text-carbon-muted">Simulate</span>,
    },
    {
      name: "MCP Tools",
      href: "/app/developers",
      icon: Terminal,
      badge: (
        <span className="text-[9px] font-mono text-carbon-muted">9 tools</span>
      ),
    },
  ];

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={onCloseMobile}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors group",
          active
            ? "bg-carbon-panel text-carbon-text border border-carbon-border/80 shadow-sm"
            : "text-carbon-muted hover:text-carbon-text hover:bg-carbon-panel/40 border border-transparent"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {active && (
            <span
              aria-hidden="true"
              className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-primary rounded-r"
            />
          )}
          <Icon
            strokeWidth={1.8}
            className={cn(
              "w-4 h-4 shrink-0 transition-colors",
              active ? "text-primary" : "text-carbon-muted group-hover:text-carbon-text"
            )}
          />
          <span className="truncate font-sans">{item.name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {item.badge}
          {item.shortcut && (
            <span className="text-[9px] font-mono text-carbon-muted/70 group-hover:text-carbon-muted hidden sm:inline">
              {item.shortcut}
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "w-[240px] flex-shrink-0 bg-carbon-nav border-r border-carbon-border flex flex-col justify-between h-full select-none",
        className
      )}
    >
      <div className="flex flex-col">
        {/* Brand Lockup */}
        <Link
          href="/app"
          className="h-16 px-5 flex items-center gap-3 border-b border-carbon-border group hover:bg-carbon-panel/20 transition-colors"
        >
          <img
            src="/logo.png"
            alt="HashX"
            className="w-8 h-8 object-contain shrink-0 drop-shadow-md select-none transition-transform group-hover:scale-105"
          />
          <div>
            <div className="font-display font-bold text-carbon-text tracking-tight text-sm leading-tight flex items-center gap-1.5">
              HashX
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-carbon-panel text-carbon-muted border border-carbon-border">
                v2
              </span>
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-carbon-muted">
              Proof System / Console
            </div>
          </div>
        </Link>

        {/* Core Operations Section */}
        <div className="px-5 pt-5 pb-2 text-[10px] font-mono uppercase tracking-wider text-carbon-muted font-semibold">
          Core Operations
        </div>
        <nav className="space-y-0.5 px-3" aria-label="Core Navigation">
          {coreNav.map(renderItem)}
        </nav>

        {/* Tooling & Protocols Section */}
        <div className="px-5 pt-5 pb-2 text-[10px] font-mono uppercase tracking-wider text-carbon-muted font-semibold">
          Tooling &amp; Protocols
        </div>
        <nav className="space-y-0.5 px-3" aria-label="Tooling Navigation">
          {toolsNav.map(renderItem)}
        </nav>
      </div>

      {/* Bottom Telemetry & Environment */}
      <div className="p-3 m-3 rounded bg-carbon-void/90 border border-carbon-border space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-carbon-muted flex items-center gap-1.5">
            <span className={cn("w-1.5 h-1.5 rounded-full", mode === "connected" ? "bg-success" : "bg-warning")}></span>
            Mode
          </span>
          <span className={cn("font-semibold text-[10px]", mode === "connected" ? "text-success" : "text-warning")}>
            {mode === "connected" ? "CONNECTED" : "DEMO · SIMULATED"}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-carbon-muted flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-carbon-muted"></span>
            HashKey HSP
          </span>
          <span className="text-carbon-muted text-[10px]">{mode === "connected" ? "NOT CONNECTED" : "SIMULATED"}</span>
        </div>
        <div className="border-t border-carbon-border/70 pt-2 flex items-center justify-between text-[10px] font-mono text-carbon-muted">
          <span>NETWORK</span>
          <span className="text-carbon-text font-mono">
            {findNetwork(chainId)?.shortName ?? `Unsupported chain ${chainId}`}
          </span>
        </div>
        <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-carbon-muted">
          <Link
            href="/app/settings"
            className="hover:text-carbon-text flex items-center gap-1 transition-colors"
          >
            <Settings className="w-3 h-3" />
            <span>Settings</span>
          </Link>
          <Link
            href="/"
            className="hover:text-carbon-text flex items-center gap-1 transition-colors"
          >
            <span>Home</span>
            <ArrowUpRight className="w-2.5 h-2.5" />
          </Link>
        </div>
      </div>
    </aside>
  );
};
