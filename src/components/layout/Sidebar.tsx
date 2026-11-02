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
  Code2,
  Settings,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/providers/AppContext";
import { findNetwork } from "@shared/networks";
import { Logo } from "@/components/brand/Logo";

interface SidebarProps {
  onCloseMobile?: () => void;
  className?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  count?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile, className }) => {
  const pathname = usePathname();
  const { pendingApprovalsCount, mode, chainId } = useApp();
  const network = findNetwork(chainId);

  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  const workflow: NavItem[] = [
    { name: "Overview", href: "/app", icon: LayoutGrid },
    { name: "Invoices", href: "/app/invoices", icon: FileText },
    { name: "Trust Inspector", href: "/app/trust", icon: ScanSearch },
    { name: "Approvals", href: "/app/approvals", icon: KeyRound, count: pendingApprovalsCount },
    { name: "Settlements", href: "/app/settlements", icon: ArrowLeftRight },
    { name: "Receipts", href: "/app/receipts", icon: ReceiptText },
  ];

  const tools: NavItem[] = [
    { name: "Proof Lab", href: "/app/demo", icon: FlaskConical },
    { name: "Developers", href: "/app/developers", icon: Code2 },
    { name: "Settings", href: "/app/settings", icon: Settings },
  ];

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onCloseMobile}
          aria-current={active ? "page" : undefined}
          className={cn(
            "group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-150",
            active
              ? "bg-surface-1 font-medium text-foreground shadow-[0_0_0_1px_rgb(var(--border)),0_1px_2px_rgb(25_24_29/0.04)]"
              : "text-foreground-secondary hover:bg-surface-3 hover:text-foreground"
          )}
        >
          <Icon
            aria-hidden="true"
            strokeWidth={1.75}
            className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-foreground-muted group-hover:text-foreground-secondary")}
          />
          <span className="truncate">{item.name}</span>
          {item.count ? (
            <span
              className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning/10 px-1.5 text-2xs font-medium tabular-nums text-warning"
              aria-label={`${item.count} pending`}
            >
              {item.count}
            </span>
          ) : null}
        </Link>
      </li>
    );
  };

  return (
    <aside
      className={cn(
        "no-print flex h-full w-[244px] shrink-0 select-none flex-col justify-between border-r border-border bg-surface-nav",
        className
      )}
    >
      <div className="flex min-h-0 flex-col">
        <div className="flex h-16 items-center px-5">
          <Logo size="md" href="/app" />
        </div>

        <nav aria-label="Application" className="flex-1 overflow-y-auto px-3 pb-4">
          <p className="px-2.5 pb-2 pt-3 text-xs text-foreground-muted">Workflow</p>
          <ul className="space-y-0.5">{workflow.map(renderItem)}</ul>
          <p className="px-2.5 pb-2 pt-6 text-xs text-foreground-muted">Tools</p>
          <ul className="space-y-0.5">{tools.map(renderItem)}</ul>
        </nav>
      </div>

      <div className="space-y-3 border-t border-border px-5 py-4">
        <dl className="space-y-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-foreground-muted">Data</dt>
            <dd className="flex items-center gap-1.5 text-foreground-secondary">
              <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", mode === "connected" ? "bg-success" : "bg-warning")} />
              {mode === "connected" ? "Connected backend" : "Simulated demo"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-foreground-muted">Network</dt>
            <dd className="truncate text-foreground-secondary">{network?.shortName ?? `Unsupported (${chainId})`}</dd>
          </div>
        </dl>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-foreground-muted transition-colors hover:text-foreground"
        >
          HashX home
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
};
