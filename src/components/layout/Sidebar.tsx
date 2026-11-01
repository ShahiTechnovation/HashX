"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  CheckCircle,
  Coins,
  Receipt,
  Sparkles,
  Terminal,
  Settings,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { useApp } from "@/providers/AppContext";

interface SidebarProps {
  onCloseMobile?: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile, className }) => {
  const pathname = usePathname();
  const { pendingApprovalsCount, mode } = useApp();

  const navigation = [
    { name: "Overview", href: "/app", icon: LayoutDashboard },
    { name: "Invoices", href: "/app/invoices", icon: FileText },
    { name: "Trust Inspector", href: "/app/trust", icon: ShieldCheck },
    {
      name: "Approvals",
      href: "/app/approvals",
      icon: CheckCircle,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount}` : undefined,
      badgeVariant: "warning",
    },
    { name: "Settlements", href: "/app/settlements", icon: Coins },
    { name: "Receipts", href: "/app/receipts", icon: Receipt },
    {
      name: "Demo Center",
      href: "/app/demo",
      icon: Sparkles,
      badge: "Guided",
      badgeVariant: "primary",
    },
    { name: "Developers", href: "/app/developers", icon: Terminal },
    { name: "Settings", href: "/app/settings", icon: Settings },
  ];

  return (
    <aside
      className={cn(
        "w-64 h-full bg-surface-1 border-r border-border flex flex-col shrink-0 select-none",
        className
      )}
    >
      <div className="h-16 flex items-center px-5 border-b border-border">
        <Logo href="/app" />
      </div>

      {mode === "demo" && (
        <div className="mx-3.5 mt-3.5 p-2 rounded-lg bg-surface-2/80 border border-primary/20 text-xs text-foreground-secondary flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
            <span className="font-mono text-[11px] text-primary-light font-medium truncate">
              DEMO SIMULATION
            </span>
          </div>
          <Link
            href="/app/demo"
            className="text-[10px] uppercase font-mono text-foreground-muted hover:text-foreground underline shrink-0"
          >
            Guided
          </Link>
        </div>
      )}

      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-thin">
        <div className="px-2 pb-1.5 text-[11px] font-mono uppercase tracking-wider text-foreground-muted">
          Platform
        </div>

        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/app" && pathname.startsWith(item.href));

          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onCloseMobile}
              className={cn(
                "group flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActive
                  ? "bg-primary-subtle/50 text-white border border-primary/40 shadow-sm"
                  : "text-foreground-secondary hover:text-foreground hover:bg-surface-2"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-colors",
                    isActive
                      ? "text-primary-light"
                      : "text-foreground-muted group-hover:text-foreground"
                  )}
                />
                <span className="truncate">{item.name}</span>
              </div>

              {item.badge && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] font-mono rounded-full shrink-0 font-semibold",
                    item.badgeVariant === "primary"
                      ? "bg-primary/20 text-primary-light border border-primary/40"
                      : "bg-warning/20 text-warning border border-warning/40"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="p-3 border-t border-border bg-surface-2/40 space-y-2">
        <div className="px-2 py-1 text-[11px] text-foreground-muted flex items-center justify-between">
          <span>HashKey Chain</span>
          <span className="font-mono text-primary-light font-medium">EVM ID 133</span>
        </div>
        <Link
          href="/"
          className="flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-foreground-secondary hover:text-foreground hover:bg-surface-3 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            Marketing & Docs
          </span>
          <ExternalLink className="w-3 h-3 opacity-60" />
        </Link>
      </div>
    </aside>
  );
};
